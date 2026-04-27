"""
资产数据访问层 (Asset Repository)

本模块提供资产管理相关的数据持久化操作，包括：
- 基础CRUD操作
- 批量导入/导出支持
- 分页查询与筛选

约束说明：
- 单次导入行数上限：100,000 行
- 单次导出行数上限：500,000 行
- 文件格式支持：.xlsx / .xls / .csv (UTF-8)

字段规范：
- asset_id: 字符串，1-64字符，唯一性校验，字母数字下划线
- asset_name: 字符串，1-128字符，非空
- asset_type: 枚举值，EQUIPMENT/INSTRUMENT/VEHICLE/OTHER
- purchase_date: 日期，ISO 8601格式 YYYY-MM-DD
- purchase_amount: 小数，≥0，精度2位
- department: 字符串，1-64字符，需匹配已存在部门编码
- status: 枚举值，ACTIVE/MAINTENANCE/SCRAPPED
- location: 字符串，0-128字符，可选
- description: 字符串，0-512字符，可选

功能标识：SWARM-2025-Q2-P2-006 (资产批量导入导出 - Iteration 2)
"""

import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import and_, or_, func, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, DataError

from models.asset import Asset
from models.import_task import ImportTask, ImportTaskStatus

logger = logging.getLogger(__name__)


class AssetStatus(Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    SCRAPPED = "SCRAPPED"


class AssetType(Enum):
    """资产类型枚举"""
    EQUIPMENT = "EQUIPMENT"
    INSTRUMENT = "INSTRUMENT"
    VEHICLE = "VEHICLE"
    OTHER = "OTHER"


class AssetRepository:
    """
    资产数据访问层
    
    提供资产的数据库操作，包括单条操作和批量操作。
    支持批量导入导出的核心数据访问方法。
    
    Attributes:
        db: SQLAlchemy数据库会话
    """
    
    # 批量操作配置
    BATCH_SIZE = 1000  # 每批次处理数量
    MAX_IMPORT_ROWS = 100000  # 单次导入最大行数
    MAX_EXPORT_ROWS = 500000  # 单次导出最大行数
    
    # 字段长度限制
    FIELD_LIMITS = {
        "asset_id": 64,
        "asset_name": 128,
        "department": 64,
        "location": 128,
        "description": 512,
    }
    
    # 枚举值约束
    VALID_ASSET_TYPES = [e.value for e in AssetType]
    VALID_STATUSES = [e.value for e in AssetStatus]
    
    def __init__(self, db: Session):
        """
        初始化资产仓库
        
        Args:
            db: SQLAlchemy数据库会话实例
        """
        self.db = db
    
    def get_by_id(self, asset_id: str) -> Optional[Asset]:
        """
        根据资产ID获取资产记录
        
        Args:
            asset_id: 资产唯一标识
            
        Returns:
            Asset对象或None（未找到）
        """
        return self.db.query(Asset).filter(Asset.asset_id == asset_id).first()
    
    def get_by_asset_ids(self, asset_ids: List[str]) -> List[Asset]:
        """
        根据资产ID列表批量获取资产记录
        
        Args:
            asset_ids: 资产ID列表
            
        Returns:
            Asset对象列表
        """
        if not asset_ids:
            return []
        return self.db.query(Asset).filter(Asset.asset_id.in_(asset_ids)).all()
    
    def exists(self, asset_id: str) -> bool:
        """
        检查资产是否存在
        
        Args:
            asset_id: 资产唯一标识
            
        Returns:
            bool: 存在返回True，否则返回False
        """
        return self.db.query(
            self.db.query(Asset).filter(Asset.asset_id == asset_id).exists()
        ).scalar()
    
    def create(self, asset_data: Dict[str, Any]) -> Asset:
        """
        创建单个资产记录
        
        Args:
            asset_data: 资产数据字典
            
        Returns:
            创建的Asset对象
            
        Raises:
            IntegrityError: asset_id重复时抛出
        """
        asset = Asset(**asset_data)
        self.db.add(asset)
        self.db.flush()
        return asset
    
    def bulk_create(
        self, 
        assets_data: List[Dict[str, Any]], 
        batch_size: Optional[int] = None,
        skip_errors: bool = True
    ) -> Tuple[int, List[Dict[str, Any]]]:
        """
        批量创建资产记录
        
        支持分批处理，适用于大文件导入场景。
        默认跳过错误行继续处理（部分导入模式）。
        
        Args:
            assets_data: 资产数据列表
            batch_size: 每批次处理数量，默认BATCH_SIZE
            skip_errors: 是否跳过错误行，默认True
            
        Returns:
            Tuple[成功数量, 错误列表]
            - 成功数量: 成功创建的记录数
            - 错误列表: [{"row": 行号, "field": 字段名, "message": 错误原因}, ...]
        """
        batch_size = batch_size or self.BATCH_SIZE
        success_count = 0
        errors = []
        
        total_rows = len(assets_data)
        if total_rows > self.MAX_IMPORT_ROWS:
            logger.warning(
                f"导入行数 {total_rows} 超过上限 {self.MAX_IMPORT_ROWS}，将只处理前 {self.MAX_IMPORT_ROWS} 行"
            )
            assets_data = assets_data[:self.MAX_IMPORT_ROWS]
        
        for i in range(0, len(assets_data), batch_size):
            batch = assets_data[i:i + batch_size]
            for idx, asset_data in enumerate(batch):
                actual_row = i + idx + 1  # 1-indexed row number
                try:
                    asset = Asset(**asset_data)
                    self.db.add(asset)
                    success_count += 1
                except IntegrityError as e:
                    self.db.rollback()
                    error_msg = str(e.orig).split('\n')[0] if hasattr(e, 'orig') else str(e)
                    if skip_errors:
                        errors.append({
                            "row": actual_row,
                            "field": "asset_id",
                            "message": f"资产编号重复或违反约束: {error_msg}"
                        })
                        logger.debug(f"行 {actual_row} 导入失败: {error_msg}")
                    else:
                        raise
                except DataError as e:
                    self.db.rollback()
                    errors.append({
                        "row": actual_row,
                        "field": "data",
                        "message": f"数据类型错误: {str(e)}"
                    })
                except Exception as e:
                    self.db.rollback()
                    errors.append({
                        "row": actual_row,
                        "field": "unknown",
                        "message": f"未知错误: {str(e)}"
                    })
            
            try:
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.error(f"批次提交失败: {str(e)}")
                if not skip_errors:
                    raise
        
        return success_count, errors
    
    def bulk_upsert(
        self, 
        assets_data: List[Dict[str, Any]], 
        batch_size: Optional[int] = None,
        skip_errors: bool = True
    ) -> Tuple[int, int, List[Dict[str, Any]]]:
        """
        批量插入或更新资产记录（存在则更新，不存在则插入）
        
        Args:
            assets_data: 资产数据列表
            batch_size: 每批次处理数量，默认BATCH_SIZE
            skip_errors: 是否跳过错误行，默认True
            
        Returns:
            Tuple[新增数量, 更新数量, 错误列表]
        """
        batch_size = batch_size or self.BATCH_SIZE
        insert_count = 0
        update_count = 0
        errors = []
        
        total_rows = len(assets_data)
        if total_rows > self.MAX_IMPORT_ROWS:
            logger.warning(
                f"导入行数 {total_rows} 超过上限 {self.MAX_IMPORT_ROWS}，将只处理前 {self.MAX_IMPORT_ROWS} 行"
            )
            assets_data = assets_data[:self.MAX_IMPORT_ROWS]
        
        asset_ids = [a.get("asset_id") for a in assets_data if a.get("asset_id")]
        existing_assets = {
            asset.asset_id: asset 
            for asset in self.get_by_asset_ids(asset_ids)
        }
        
        for idx, asset_data in enumerate(assets_data):
            actual_row = idx + 1
            try:
                asset_id = asset_data.get("asset_id")
                if asset_id and asset_id in existing_assets:
                    existing = existing_assets[asset_id]
                    for key, value in asset_data.items():
                        if key != "asset_id":
                            setattr(existing, key, value)
                    update_count += 1
                else:
                    asset = Asset(**asset_data)
                    self.db.add(asset)
                    insert_count += 1
            except Exception as e:
                if skip_errors:
                    errors.append({
                        "row": actual_row,
                        "field": asset_data.get("asset_id", "unknown"),
                        "message": str(e)
                    })
                else:
                    raise
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"批量upsert提交失败: {str(e)}")
            if not skip_errors:
                raise
        
        return insert_count, update_count, errors
    
    def bulk_update(
        self, 
        assets_data: List[Dict[str, Any]], 
        batch_size: Optional[int] = None,
        skip_errors: bool = True
    ) -> Tuple[int, List[Dict[str, Any]]]:
        """
        批量更新资产记录
        
        Args:
            assets_data: 资产数据列表（必须包含asset_id）
            batch_size: 每批次处理数量，默认BATCH_SIZE
            skip_errors: 是否跳过错误行，默认True
            
        Returns:
            Tuple[更新数量, 错误列表]
        """
        batch_size = batch_size or self.BATCH_SIZE
        success_count = 0
        errors = []
        
        asset_ids = [a.get("asset_id") for a in assets_data if a.get("asset_id")]
        existing_assets = {
            asset.asset_id: asset 
            for asset in self.get_by_asset_ids(asset_ids)
        }
        
        for idx, asset_data in enumerate(assets_data):
            actual_row = idx + 1
            asset_id = asset_data.get("asset_id")
            
            if not asset_id:
                if skip_errors:
                    errors.append({
                        "row": actual_row,
                        "field": "asset_id",
                        "message": "asset_id 不能为空"
                    })
                    continue
                else:
                    raise ValueError(f"行 {actual_row}: asset_id 不能为空")
            
            if asset_id not in existing_assets:
                if skip_errors:
                    errors.append({
                        "row": actual_row,
                        "field": "asset_id",
                        "message": f"资产编号 {asset_id} 不存在"
                    })
                    continue
                else:
                    raise ValueError(f"行 {actual_row}: 资产编号 {asset_id} 不存在")
            
            try:
                existing = existing_assets[asset_id]
                for key, value in asset_data.items():
                    if key != "asset_id":
                        setattr(existing, key, value)
                success_count += 1
            except Exception as e:
                if skip_errors:
                    errors.append({
                        "row": actual_row,
                        "field": asset_id,
                        "message": str(e)
                    })
                else:
                    raise
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"批量更新提交失败: {str(e)}")
            if not skip_errors:
                raise
        
        return success_count, errors
    
    def list_assets(
        self,
        status: Optional[str] = None,
        department: Optional[str] = None,
        asset_type: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        page: int = 1,
        page_size: int = 100,
        export_all: bool = False
    ) -> Tuple[List[Asset], int]:
        """
        分页查询资产列表
        
        支持多种筛选条件，适用于列表展示和导出场景。
        
        Args:
            status: 资产状态筛选
            department: 部门筛选
            asset_type: 资产类型筛选
            date_from: 采购日期起始
            date_to: 采购日期截止
            page: 页码（从1开始）
            page_size: 每页数量
            export_all: 是否导出全部（忽略分页限制）
            
        Returns:
            Tuple[资产列表, 总数量]
        """
        query = self.db.query(Asset)
        
        filters = []
        if status:
            filters.append(Asset.status == status)
        if department:
            filters.append(Asset.department == department)
        if asset_type:
            filters.append(Asset.asset_type == asset_type)
        if date_from:
            filters.append(Asset.purchase_date >= date_from)
        if date_to:
            filters.append(Asset.purchase_date <= date_to)
        
        if filters:
            query = query.filter(and_(*filters))
        
        total = query.count()
        
        if export_all:
            return query.limit(self.MAX_EXPORT_ROWS).all(), min(total, self.MAX_EXPORT_ROWS)
        else:
            offset = (page - 1) * page_size
            return query.offset(offset).limit(page_size).all(), total
    
    def get_all_assets(
        self,
        status: Optional[str] = None,
        department: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取所有资产数据（用于导出）
        
        Args:
            status: 资产状态筛选
            department: 部门筛选
            
        Returns:
            资产数据字典列表
        """
        assets, _ = self.list_assets(
            status=status,
            department=department,
            page=1,
            page_size=self.MAX_EXPORT_ROWS,
            export_all=True
        )
        
        return [
            {
                "asset_id": a.asset_id,
                "asset_name": a.asset_name,
                "asset_type": a.asset_type,
                "purchase_date": a.purchase_date.isoformat() if a.purchase_date else None,
                "purchase_amount": float(a.purchase_amount) if a.purchase_amount else None,
                "department": a.department,
                "status": a.status,
                "location": a.location,
                "description": a.description,
            }
            for a in assets
        ]
    
    def delete(self, asset_id: str) -> bool:
        """
        删除单个资产记录
        
        Args:
            asset_id: 资产唯一标识
            
        Returns:
            bool: 删除成功返回True，资产不存在返回False
        """
        asset = self.get_by_id(asset_id)
        if not asset:
            return False
        
        self.db.delete(asset)
        self.db.flush()
        return True
    
    def bulk_delete(self, asset_ids: List[str]) -> Tuple[int, List[str]]:
        """
        批量删除资产记录
        
        Args:
            asset_ids: 资产ID列表
            
        Returns:
            Tuple[删除成功数量, 未找到的ID列表]
        """
        existing = self.get_by_asset_ids(asset_ids)
        existing_ids = {a.asset_id for a in existing}
        
        not_found_ids = set(asset_ids) - existing_ids
        delete_count = 0
        
        for asset in existing:
            self.db.delete(asset)
            delete_count += 1
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"批量删除提交失败: {str(e)}")
            raise
        
        return delete_count, list(not_found_ids)
    
    def check_asset_ids_exist(self, asset_ids: List[str]) -> Dict[str, bool]:
        """
        批量检查资产ID是否存在
        
        Args:
            asset_ids: 资产ID列表
            
        Returns:
            Dict[str, bool]: asset_id -> 是否存在
        """
        if not asset_ids:
            return {}
        
        existing = self.get_by_asset_ids(asset_ids)
        existing_ids = {a.asset_id for a in existing}
        
        return {aid: aid in existing_ids for aid in asset_ids}
    
    def get_department_codes(self) -> List[str]:
        """
        获取所有已存在的部门编码列表
        
        用于导入时的部门校验。
        
        Returns:
            部门编码列表
        """
        result = self.db.query(Asset.department).distinct().all()
        return [r[0] for r in result if r[0]]
    
    def validate_import_data(self, asset_data: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        验证单条导入数据的合法性
        
        执行字段级校验规则：
        - 数据类型检查
        - 必填字段检查
        - 长度限制检查
        - 枚举值检查
        - 唯一性检查
        
        Args:
            asset_data: 资产数据字典
            
        Returns:
            错误列表 [{"field": 字段名, "message": 错误原因}, ...]
            空列表表示校验通过
        """
        errors = []
        
        if not asset_data.get("asset_id"):
            errors.append({"field": "asset_id", "message": "资产编号不能为空"})
        elif len(asset_data["asset_id"]) > self.FIELD_LIMITS["asset_id"]:
            errors.append({
                "field": "asset_id", 
                "message": f"资产编号长度不能超过{self.FIELD_LIMITS['asset_id']}字符"
            })
        elif not all(c.isalnum() or c in '_-' for c in asset_data["asset_id"]):
            errors.append({
                "field": "asset_id",
                "message": "资产编号只能包含字母、数字、下划线和连字符"
            })
        
        if not asset_data.get("asset_name"):
            errors.append({"field": "asset_name", "message": "资产名称不能为空"})
        elif len(asset_data["asset_name"]) > self.FIELD_LIMITS["asset_name"]:
            errors.append({
                "field": "asset_name",
                "message": f"资产名称长度不能超过{self.FIELD_LIMITS['asset_name']}字符"
            })
        
        asset_type = asset_data.get("asset_type")
        if not asset_type:
            errors.append({"field": "asset_type", "message": "资产类型不能为空"})
        elif asset_type not in self.VALID_ASSET_TYPES:
            errors.append({
                "field": "asset_type",
                "message": f"资产类型必须是以下值之一: {', '.join(self.VALID_ASSET_TYPES)}"
            })
        
        status = asset_data.get("status")
        if not status:
            errors.append({"field": "status", "message": "资产状态不能为空"})
        elif status not in self.VALID_STATUSES:
            errors.append({
                "field": "status",
                "message": f"资产状态必须是以下值之一: {', '.join(self.VALID_STATUSES)}"
            })
        
        if not asset_data.get("purchase_date"):
            errors.append({"field": "purchase_date", "message": "采购日期不能为空"})
        else:
            try:
                if isinstance(asset_data["purchase_date"], str):
                    datetime.strptime(asset_data["purchase_date"], "%Y-%m-%d")
            except ValueError:
                errors.append({
                    "field": "purchase_date",
                    "message": "采购日期格式错误，应为 YYYY-MM-DD"
                })
        
        if not asset_data.get("department"):
            errors.append({"field": "department", "message": "所属部门不能为空"})
        elif len(asset_data["department"]) > self.FIELD_LIMITS["department"]:
            errors.append({
                "field": "department",
                "message": f"部门编码长度不能超过{self.FIELD_LIMITS['department']}字符"
            })
        
        purchase_amount = asset_data.get("purchase_amount")
        if purchase_amount is None:
            errors.append({"field": "purchase_amount", "message": "采购金额不能为空"})
        else:
            try:
                amount = float(purchase_amount)
                if amount < 0:
                    errors.append({
                        "field": "purchase_amount",
                        "message": "采购金额必须大于等于0"
                    })
            except (ValueError, TypeError):
                errors.append({
                    "field": "purchase_amount",
                    "message": "采购金额格式错误，应为数字"
                })
        
        location = asset_data.get("location")
        if location and len(location) > self.FIELD_LIMITS["location"]:
            errors.append({
                "field": "location",
                "message": f"存放地点长度不能超过{self.FIELD_LIMITS['location']}字符"
            })
        
        description = asset_data.get("description")
        if description and len(description) > self.FIELD_LIMITS["description"]:
            errors.append({
                "field": "description",
                "message": f"资产描述长度不能超过{self.FIELD_LIMITS['description']}字符"
            })
        
        return errors
    
    def validate_import_batch(
        self, 
        assets_data: List[Dict[str, Any]],
        check_uniqueness: bool = True
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        批量验证导入数据
        
        对每条数据进行字段级校验，并检查asset_id唯一性。
        
        Args:
            assets_data: 资产数据列表
            check_uniqueness: 是否检查asset_id唯一性
            
        Returns:
            Tuple[有效数据列表, 错误数据列表]
            - 有效数据: 通过校验的数据
            - 错误数据: {"row": 行号, "field": 字段名, "message": 错误原因}
        """
        valid_data = []
        errors = []
        seen_asset_ids = set()
        
        for idx, asset_data in enumerate(assets_data):
            row_num = idx + 1
            
            field_errors = self.validate_import_data(asset_data)
            
            if field_errors:
                for err in field_errors:
                    errors.append({
                        "row": row_num,
                        "field": err["field"],
                        "message": err["message"]
                    })
            else:
                asset_id = asset_data.get("asset_id")
                
                if check_uniqueness:
                    if asset_id in seen_asset_ids:
                        errors.append({
                            "row": row_num,
                            "field": "asset_id",
                            "message": "资产编号重复（同一文件中）"
                        })
                    elif self.exists(asset_id):
                        errors.append({
                            "row": row_num,
                            "field": "asset_id",
                            "message": "资产编号已存在"
                        })
                    else:
                        seen_asset_ids.add(asset_id)
                        valid_data.append(asset_data)
                else:
                    valid_data.append(asset_data)
        
        return valid_data, errors
    
    def count_by_status(self) -> Dict[str, int]:
        """
        按状态统计资产数量
        
        Returns:
            Dict[str, int]: status -> count
        """
        result = self.db.query(
            Asset.status, 
            func.count(Asset.asset_id).label("count")
        ).group_by(Asset.status).all()
        
        return {row.status: row.count for row in result}
    
    def count_by_department(self) -> Dict[str, int]:
        """
        按部门统计资产数量
        
        Returns:
            Dict[str, int]: department -> count
        """
        result = self.db.query(
            Asset.department,
            func.count(Asset.asset_id).label("count")
        ).group_by(Asset.department).all()
        
        return {row.department: row.count for row in result}