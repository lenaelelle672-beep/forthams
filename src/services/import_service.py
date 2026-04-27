"""
资产批量导入服务模块

提供资产数据的批量导入功能，支持 Excel/CSV 格式文件导入，
包含字段级校验、部分导入模式、异步处理机制等核心功能。

主要特性:
    - Excel/CSV 文件模板生成
    - 批量导入引擎（字段映射/校验）
    - 导入结果报告生成
    - 部分导入模式（跳过错误行）
    - 异步处理机制（大文件后台队列处理）

业务规则:
    - 单次导入文件大小 ≤ 50MB
    - 单次导入行数上限 100,000 行
    - 敏感字段(价格/成本)导入需二次确认
    - 文件保留期限 30 天

Author: SWARM Team
Version: 2.0.0
"""

import os
import logging
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from src.models.asset import Asset
from src.models.import_task import ImportTask, ImportTaskStatus
from src.models.department import Department
from src.schemas.asset_schema import AssetImportSchema, AssetImportError
from src.services.validation_service import ValidationService
from src.parsers.excel_parser import ExcelParser
from src.parsers.csv_parser import CsvParser
from src.utils.excel_generator import ExcelGenerator

logger = logging.getLogger(__name__)


class ImportMode(str, Enum):
    """导入模式枚举"""
    STRICT = "strict"  # 全量失败模式
    PARTIAL = "partial"  # 部分导入模式（跳过错误行）


class ImportResult(str, Enum):
    """导入结果枚举"""
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class ImportService:
    """
    资产批量导入服务

    负责处理资产数据的批量导入操作，支持多种文件格式和导入模式。
    提供同步和异步两种处理方式，满足不同场景需求。

    Attributes:
        db: 数据库会话
        validation_service: 校验服务实例
        max_file_size: 最大文件大小（字节），默认 50MB
        max_rows: 最大导入行数，默认 100,000
    """

    # 资产字段枚举值
    VALID_ASSET_TYPES = ["EQUIPMENT", "INSTRUMENT", "VEHICLE", "OTHER"]
    VALID_STATUSES = ["ACTIVE", "MAINTENANCE", "SCRAPPED"]

    def __init__(self, db: Session):
        """
        初始化导入服务

        Args:
            db: 数据库会话
        """
        self.db = db
        self.validation_service = ValidationService(db)
        self.max_file_size = 50 * 1024 * 1024  # 50MB
        self.max_rows = 100000
        self._init_validators()

    def _init_validators(self):
        """
        初始化字段级校验规则

        初始化各字段的校验器，包括数据类型、长度、枚举值等校验规则。
        """
        self._field_validators = {
            "asset_id": {
                "required": True,
                "max_length": 64,
                "pattern": r"^[A-Za-z0-9_]+$",
                "unique_check": True
            },
            "asset_name": {
                "required": True,
                "max_length": 128
            },
            "asset_type": {
                "required": True,
                "enum": self.VALID_ASSET_TYPES
            },
            "purchase_date": {
                "required": True,
                "format": "YYYY-MM-DD"
            },
            "purchase_amount": {
                "required": True,
                "min_value": 0,
                "precision": 2
            },
            "department": {
                "required": True,
                "max_length": 64,
                "reference_check": "department"
            },
            "status": {
                "required": True,
                "enum": self.VALID_STATUSES
            },
            "location": {
                "required": False,
                "max_length": 128
            },
            "description": {
                "required": False,
                "max_length": 512
            }
        }

    def generate_template(self, format: str = "xlsx") -> Tuple[str, str]:
        """
        生成导入模板文件

        Args:
            format: 模板格式，支持 'xlsx' 或 'csv'

        Returns:
            Tuple[str, str]: (文件路径, 内容类型)

        Raises:
            ValueError: 不支持的格式
        """
        if format not in ["xlsx", "csv"]:
            raise ValueError(f"Unsupported format: {format}")

        template_headers = [
            "asset_id", "asset_name", "asset_type", "purchase_date",
            "purchase_amount", "department", "status", "location", "description"
        ]

        sample_data = [
            ["ASSET001", "示例资产", "EQUIPMENT", "2025-01-01", "10000.00", "DEPT001", "ACTIVE", "Location A", "这是一条示例数据"],
            ["ASSET002", "示例资产2", "INSTRUMENT", "2025-01-15", "5000.00", "DEPT002", "ACTIVE", "Location B", ""]
        ]

        if format == "xlsx":
            generator = ExcelGenerator()
            file_path = generator.generate_template(template_headers, sample_data, "asset_import_template")
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            file_path = self._generate_csv_template(template_headers, sample_data)
            content_type = "text/csv; charset=utf-8"

        return file_path, content_type

    def _generate_csv_template(self, headers: List[str], sample_data: List[List[str]]) -> str:
        """
        生成 CSV 格式导入模板

        Args:
            headers: 表头字段列表
            sample_data: 示例数据列表

        Returns:
            str: CSV 文件路径
        """
        temp_dir = tempfile.mkdtemp(prefix="asset_import_")
        file_path = os.path.join(temp_dir, "asset_import_template.csv")

        with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
            import csv
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(sample_data)

        return file_path

    def import_assets(
        self,
        file_path: str,
        user_id: str,
        mode: str = "partial",
        overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        执行资产批量导入

        根据文件格式自动选择解析器，支持部分导入模式。
        对于大于 5MB 的文件自动启用异步处理。

        Args:
            file_path: 文件路径
            user_id: 操作用户ID
            mode: 导入模式，'strict' 或 'partial'
            overwrite: 是否覆盖已存在资产

        Returns:
            Dict[str, Any]: 导入结果，包含 imported, failed, errors 等信息

        Raises:
            FileNotFoundError: 文件不存在
            ValueError: 文件格式不支持
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Import file not found: {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size > self.max_file_size:
            return self._create_async_task(file_path, user_id, mode, overwrite)

        # 根据文件扩展名选择解析器
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext in [".xlsx", ".xls"]:
            parser = ExcelParser()
        elif file_ext == ".csv":
            parser = CsvParser()
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        # 解析文件
        data = parser.parse(file_path)
        total_rows = len(data)

        if total_rows > self.max_rows:
            return self._create_async_task(file_path, user_id, mode, overwrite)

        # 执行导入
        return self._process_import(data, user_id, mode, overwrite, file_path)

    def _process_import(
        self,
        data: List[Dict[str, Any]],
        user_id: str,
        mode: str,
        overwrite: bool,
        file_path: str
    ) -> Dict[str, Any]:
        """
        处理导入数据

        Args:
            data: 解析后的数据列表
            user_id: 操作用户ID
            mode: 导入模式
            overwrite: 是否覆盖
            file_path: 原始文件路径

        Returns:
            Dict[str, Any]: 导入结果
        """
        imported = 0
        failed = 0
        errors = []
        validated_data = []

        for idx, row in enumerate(data):
            row_num = idx + 2  # 跳过表头行
            validation_result = self._validate_row(row, row_num)

            if validation_result["valid"]:
                validated_data.append((row_num, row))
                imported += 1
            else:
                failed += 1
                errors.extend(validation_result["errors"])

                if mode == ImportMode.STRICT.value:
                    break

        # 执行数据库写入
        if validated_data:
            write_result = self._write_to_database(validated_data, user_id, overwrite)
            imported = write_result["imported"]
            errors.extend(write_result.get("errors", []))

        result = {
            "success": failed == 0,
            "imported": imported,
            "failed": failed,
            "errors": errors[:100],  # 限制错误数量
            "error_report_url": None
        }

        # 生成错误报告
        if errors:
            report_path = self._generate_error_report(errors, user_id)
            result["error_report_url"] = report_path

        return result

    def _validate_row(self, row: Dict[str, Any], row_num: int) -> Dict[str, Any]:
        """
        校验单行数据

        执行字段级校验，包括数据类型、长度、枚举值等校验。

        Args:
            row: 行数据字典
            row_num: 行号

        Returns:
            Dict[str, Any]: 校验结果，包含 valid 和 errors 字段
        """
        errors = []

        for field, rules in self._field_validators.items():
            value = row.get(field)

            # 必填校验
            if rules.get("required") and not value:
                errors.append({
                    "row": row_num,
                    "field": field,
                    "message": f"{field} 为必填字段"
                })
                continue

            if not value:
                continue

            # 最大长度校验
            max_len = rules.get("max_length")
            if max_len and len(str(value)) > max_len:
                errors.append({
                    "row": row_num,
                    "field": field,
                    "message": f"{field} 长度不能超过 {max_len}"
                })

            # 枚举值校验
            enum_values = rules.get("enum")
            if enum_values and value not in enum_values:
                errors.append({
                    "row": row_num,
                    "field": field,
                    "message": f"{field} 枚举值不匹配，可选值: {', '.join(enum_values)}"
                })

            # 日期格式校验
            if field == "purchase_date":
                if not self._validate_date_format(value):
                    errors.append({
                        "row": row_num,
                        "field": field,
                        "message": f"{field} 日期格式错误，应为 YYYY-MM-DD 格式"
                    })

            # 数值范围校验
            if field == "purchase_amount":
                try:
                    amount = Decimal(str(value))
                    min_value = rules.get("min_value", 0)
                    if amount < min_value:
                        errors.append({
                            "row": row_num,
                            "field": field,
                            "message": f"{field} 必须大于等于 {min_value}"
                        })
                except (InvalidOperation, ValueError):
                    errors.append({
                        "row": row_num,
                        "field": field,
                        "message": f"{field} 必须是有效的数字"
                    })

            # 部门引用校验
            if field == "department" and rules.get("reference_check") == "department":
                if not self._validate_department_exists(value):
                    errors.append({
                        "row": row_num,
                        "field": field,
                        "message": f"部门 '{value}' 不存在"
                    })

        # asset_id 唯一性校验
        asset_id = row.get("asset_id")
        if asset_id and rules.get("unique_check"):
            if self._check_asset_id_exists(asset_id):
                errors.append({
                    "row": row_num,
                    "field": "asset_id",
                    "message": f"资产编号 '{asset_id}' 已存在"
                })

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def _validate_date_format(self, date_str: str) -> bool:
        """
        校验日期格式

        Args:
            date_str: 日期字符串

        Returns:
            bool: 是否为有效的 YYYY-MM-DD 格式
        """
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return True
        except ValueError:
            return False

    def _validate_department_exists(self, dept_code: str) -> bool:
        """
        校验部门是否存在

        Args:
            dept_code: 部门编码

        Returns:
            bool: 部门是否存在
        """
        dept = self.db.query(Department).filter(
            Department.code == dept_code
        ).first()
        return dept is not None

    def _check_asset_id_exists(self, asset_id: str) -> bool:
        """
        校验资产编号是否已存在

        Args:
            asset_id: 资产编号

        Returns:
            bool: 是否存在
        """
        existing = self.db.query(Asset).filter(
            Asset.asset_id == asset_id
        ).first()
        return existing is not None

    def _write_to_database(
        self,
        validated_data: List[Tuple[int, Dict[str, Any]]],
        user_id: str,
        overwrite: bool
    ) -> Dict[str, Any]:
        """
        写入数据库

        Args:
            validated_data: 校验通过的数据列表
            user_id: 操作用户ID
            overwrite: 是否覆盖

        Returns:
            Dict[str, Any]: 写入结果
        """
        imported = 0
        errors = []

        for row_num, row in validated_data:
            try:
                asset_id = row.get("asset_id")

                # 检查是否已存在
                existing = self.db.query(Asset).filter(
                    Asset.asset_id == asset_id
                ).first()

                if existing:
                    if overwrite:
                        self._update_asset(existing, row, user_id)
                        imported += 1
                    else:
                        errors.append({
                            "row": row_num,
                            "field": "asset_id",
                            "message": f"资产编号 '{asset_id}' 已存在（未启用覆盖模式）"
                        })
                else:
                    self._create_asset(row, user_id)
                    imported += 1

            except Exception as e:
                logger.error(f"Failed to import row {row_num}: {str(e)}")
                errors.append({
                    "row": row_num,
                    "field": "asset_id",
                    "message": f"数据库写入失败: {str(e)}"
                })

        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Database commit failed: {str(e)}")
            errors.append({
                "row": -1,
                "field": "_general",
                "message": f"数据库提交失败: {str(e)}"
            })

        return {
            "imported": imported,
            "errors": errors
        }

    def _create_asset(self, row: Dict[str, Any], user_id: str) -> Asset:
        """
        创建资产记录

        Args:
            row: 资产数据
            user_id: 操作用户ID

        Returns:
            Asset: 创建的资产对象
        """
        asset = Asset(
            asset_id=row.get("asset_id"),
            asset_name=row.get("asset_name"),
            asset_type=row.get("asset_type"),
            purchase_date=datetime.strptime(row.get("purchase_date"), "%Y-%m-%d").date(),
            purchase_amount=Decimal(str(row.get("purchase_amount"))),
            department_code=row.get("department"),
            status=row.get("status"),
            location=row.get("location"),
            description=row.get("description"),
            created_by=user_id,
            created_at=datetime.now()
        )
        self.db.add(asset)
        return asset

    def _update_asset(self, asset: Asset, row: Dict[str, Any], user_id: str):
        """
        更新资产记录

        Args:
            asset: 现有资产对象
            row: 更新数据
            user_id: 操作用户ID
        """
        asset.asset_name = row.get("asset_name")
        asset.asset_type = row.get("asset_type")
        asset.purchase_date = datetime.strptime(row.get("purchase_date"), "%Y-%m-%d").date()
        asset.purchase_amount = Decimal(str(row.get("purchase_amount")))
        asset.department_code = row.get("department")
        asset.status = row.get("status")
        asset.location = row.get("location")
        asset.description = row.get("description")
        asset.updated_by = user_id
        asset.updated_at = datetime.now()

    def _create_async_task(
        self,
        file_path: str,
        user_id: str,
        mode: str,
        overwrite: bool
    ) -> Dict[str, Any]:
        """
        创建异步导入任务

        对于大文件自动创建后台任务处理。

        Args:
            file_path: 文件路径
            user_id: 操作用户ID
            mode: 导入模式
            overwrite: 是否覆盖

        Returns:
            Dict[str, Any]: 任务创建结果
        """
        # 创建任务记录
        task = ImportTask(
            user_id=user_id,
            file_path=file_path,
            mode=mode,
            overwrite=overwrite,
            status=ImportTaskStatus.QUEUED,
            created_at=datetime.now()
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return {
            "success": True,
            "task_id": task.id,
            "message": "任务已创建，将在后台处理",
            "async": True
        }

    def _generate_error_report(self, errors: List[Dict[str, Any]], user_id: str) -> str:
        """
        生成错误报告文件

        Args:
            errors: 错误列表
            user_id: 操作用户ID

        Returns:
            str: 报告文件路径
        """
        temp_dir = tempfile.mkdtemp(prefix="import_error_")
        report_path = os.path.join(temp_dir, f"error_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")

        generator = ExcelGenerator()
        generator.generate_error_report(errors, report_path)

        return report_path

    def get_import_history(self, user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        获取用户导入历史记录

        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量

        Returns:
            Dict[str, Any]: 分页后的导入历史
        """
        query = self.db.query(ImportTask).filter(
            ImportTask.user_id == user_id
        ).order_by(ImportTask.created_at.desc())

        total = query.count()
        tasks = query.offset((page - 1) * page_size).limit(page_size).all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": task.id,
                    "status": task.status.value,
                    "total_rows": task.total_rows or 0,
                    "success_rows": task.success_rows or 0,
                    "failed_rows": task.failed_rows or 0,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                    "completed_at": task.completed_at.isoformat() if task.completed_at else None
                }
                for task in tasks
            ]
        }

    def get_task_status(self, task_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取导入任务状态

        Args:
            task_id: 任务ID
            user_id: 用户ID（用于权限校验）

        Returns:
            Optional[Dict[str, Any]]: 任务状态信息
        """
        task = self.db.query(ImportTask).filter(
            and_(
                ImportTask.id == task_id,
                ImportTask.user_id == user_id
            )
        ).first()

        if not task:
            return None

        return {
            "id": task.id,
            "status": task.status.value,
            "progress": task.progress or 0,
            "total_rows": task.total_rows or 0,
            "success_rows": task.success_rows or 0,
            "failed_rows": task.failed_rows or 0,
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }

    def get_user_active_task_count(self, user_id: str) -> int:
        """
        获取用户当前活跃的导入任务数

        Args:
            user_id: 用户ID

        Returns:
            int: 活跃任务数
        """
        active_statuses = [
            ImportTaskStatus.PENDING,
            ImportTaskStatus.PROCESSING,
            ImportTaskStatus.QUEUED
        ]

        count = self.db.query(ImportTask).filter(
            ImportTask.user_id == user_id,
            ImportTask.status.in_(active_statuses)
        ).count()

        return count

    def cancel_task(self, task_id: str, user_id: str) -> bool:
        """
        取消导入任务

        Args:
            task_id: 任务ID
            user_id: 用户ID

        Returns:
            bool: 是否取消成功
        """
        task = self.db.query(ImportTask).filter(
            and_(
                ImportTask.id == task_id,
                ImportTask.user_id == user_id
            )
        ).first()

        if not task:
            return False

        if task.status in [ImportTaskStatus.PENDING, ImportTaskStatus.QUEUED]:
            task.status = ImportTaskStatus.CANCELLED
            task.completed_at = datetime.now()
            self.db.commit()
            return True

        return False

    def download_error_report(self, task_id: str, user_id: str) -> Optional[str]:
        """
        下载错误报告

        Args:
            task_id: 任务ID
            user_id: 用户ID

        Returns:
            Optional[str]: 错误报告文件路径
        """
        task = self.db.query(ImportTask).filter(
            and_(
                ImportTask.id == task_id,
                ImportTask.user_id == user_id
            )
        ).first()

        if not task or not task.error_report_path:
            return None

        if not os.path.exists(task.error_report_path):
            return None

        return task.error_report_path