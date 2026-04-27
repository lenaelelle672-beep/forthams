"""
资产批量导出服务

提供 Excel/CSV 格式的资产数据批量导出功能，支持按状态、部门、日期等条件筛选。
支持大文件流式导出（CSV 可达 100MB+），确保内存占用可控。

功能特性：
    - Excel/CSV 双格式支持
    - 字段级筛选与排序
    - 大文件流式导出
    - 下载链接有效期控制

约束条件：
    - 单次导出行数上限: 500,000 行
    - 导出不压缩: CSV 支持大于 100MB
    - 下载链接有效期: 24h

版本: 2.0 (Iteration 2)
功能标识: SWARM-2025-Q2-P2-006
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import BinaryIO, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from src.models.asset import Asset
from src.repositories.asset_repository import AssetRepository
from src.schemas.asset_schema import AssetSchema
from src.utils.excel_generator import ExcelGenerator
from src.utils.csv_generator import CsvGenerator

logger = logging.getLogger(__name__)


class ExportFormat:
    """导出格式枚举"""
    XLSX = "xlsx"
    CSV = "csv"
    
    @classmethod
    def validate(cls, format_str: str) -> bool:
        """校验导出格式是否支持"""
        return format_str.lower() in [cls.XLSX, cls.CSV]


class ExportStatus:
    """资产状态枚举（导出筛选用）"""
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    SCRAPPED = "SCRAPPED"
    
    @classmethod
    def all_values(cls) -> List[str]:
        """返回所有有效状态值"""
        return [cls.ACTIVE, cls.MAINTENANCE, cls.SCRAPPED]


class DownloadLinkManager:
    """导出文件下载链接管理器
    
    管理导出文件的下载链接，支持有效期控制。
    链接格式: /api/v1/assets/export/download/{token}
    默认有效期: 24小时
    """
    
    # 内存存储（生产环境应使用 Redis）
    _links: Dict[str, Dict] = {}
    DEFAULT_EXPIRY_HOURS = 24
    
    @classmethod
    def create_link(cls, file_path: str, filename: str) -> str:
        """创建下载链接
        
        Args:
            file_path: 文件绝对路径
            filename: 下载显示的文件名
            
        Returns:
            下载链接 token
        """
        token = str(uuid.uuid4())
        expiry_time = datetime.now() + timedelta(hours=cls.DEFAULT_EXPIRY_HOURS)
        
        cls._links[token] = {
            "file_path": file_path,
            "filename": filename,
            "created_at": datetime.now(),
            "expires_at": expiry_time,
            "download_count": 0
        }
        
        logger.info(f"Created download link: {token}, expires at {expiry_time}")
        return token
    
    @classmethod
    def get_link_info(cls, token: str) -> Optional[Dict]:
        """获取链接信息
        
        Args:
            token: 下载链接 token
            
        Returns:
            链接信息字典，包含 file_path, filename 等
            如果链接不存在或已过期返回 None
        """
        link_info = cls._links.get(token)
        if not link_info:
            logger.warning(f"Download link not found: {token}")
            return None
        
        if datetime.now() > link_info["expires_at"]:
            logger.warning(f"Download link expired: {token}")
            del cls._links[token]
            return None
        
        # 增加下载计数
        link_info["download_count"] += 1
        return link_info
    
    @classmethod
    def cleanup_expired(cls) -> int:
        """清理过期链接
        
        Returns:
            清理的链接数量
        """
        now = datetime.now()
        expired_tokens = [
            token for token, info in cls._links.items()
            if now > info["expires_at"]
        ]
        
        for token in expired_tokens:
            del cls._links[token]
        
        if expired_tokens:
            logger.info(f"Cleaned up {len(expired_tokens)} expired download links")
        
        return len(expired_tokens)


class ExportService:
    """资产批量导出服务
    
    提供资产数据的批量导出功能，支持 Excel 和 CSV 格式。
    支持大文件流式导出，确保内存占用可控。
    
    Attributes:
        db: 数据库会话
        asset_repository: 资产数据访问层
        excel_generator: Excel 生成器
        csv_generator: CSV 生成器
        export_dir: 导出文件存储目录
        max_export_rows: 最大导出行数限制
    """
    
    # 导出行数上限
    MAX_EXPORT_ROWS = 500_000
    # 文件保留期限（天）
    FILE_RETENTION_DAYS = 30
    
    def __init__(
        self,
        db: Session,
        export_dir: Optional[str] = None
    ):
        """
        初始化导出服务
        
        Args:
            db: 数据库会话
            export_dir: 导出文件存储目录，默认为 ./exports
        """
        self.db = db
        self.asset_repository = AssetRepository(db)
        self.excel_generator = ExcelGenerator()
        self.csv_generator = CsvGenerator()
        
        # 设置导出目录
        if export_dir:
            self.export_dir = Path(export_dir)
        else:
            self.export_dir = Path("./exports")
        
        # 确保目录存在
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"ExportService initialized with export_dir: {self.export_dir}")
    
    def export_assets(
        self,
        format: str = "xlsx",
        status: Optional[str] = None,
        department: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        include_fields: Optional[List[str]] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc"
    ) -> Tuple[str, str, int]:
        """
        导出资产数据
        
        支持按状态、部门、日期范围筛选，支持指定导出字段。
        大文件自动使用流式导出确保内存可控。
        
        Args:
            format: 导出格式，支持 'xlsx' 或 'csv'
            status: 按资产状态筛选（ACTIVE/MAINTENANCE/SCRAPPED）
            department: 按部门编码筛选
            date_from: 采购日期起始（YYYY-MM-DD）
            date_to: 采购日期截止（YYYY-MM-DD）
            include_fields: 指定导出的字段列表，None 表示全部字段
            sort_by: 排序字段，默认为 asset_id
            sort_order: 排序方向，'asc' 或 'desc'
            
        Returns:
            Tuple[download_token, filename, total_rows]:
                - download_token: 下载链接 token
                - filename: 导出文件名
                - total_rows: 导出行数
                
        Raises:
            ValueError: 格式不支持或参数验证失败
            RuntimeError: 导出过程失败
        """
        # 参数校验
        if not ExportFormat.validate(format):
            raise ValueError(f"Unsupported export format: {format}. Supported: xlsx, csv")
        
        if status and status not in ExportStatus.all_values():
            raise ValueError(f"Invalid status: {status}. Valid values: {ExportStatus.all_values()}")
        
        if include_fields is None:
            include_fields = self._get_default_export_fields()
        
        # 构建查询条件
        query_filters = self._build_query_filters(
            status=status,
            department=department,
            date_from=date_from,
            date_to=date_to
        )
        
        # 执行查询
        assets = self.asset_repository.query_assets(
            filters=query_filters,
            include_fields=include_fields,
            sort_by=sort_by or "asset_id",
            sort_order=sort_order,
            limit=self.MAX_EXPORT_ROWS
        )
        
        total_rows = len(assets)
        logger.info(f"Export query returned {total_rows} rows")
        
        if total_rows == 0:
            raise ValueError("No assets matched the export criteria")
        
        if total_rows > self.MAX_EXPORT_ROWS:
            raise ValueError(
                f"Export row count {total_rows} exceeds limit {self.MAX_EXPORT_ROWS}. "
                f"Please apply more restrictive filters."
            )
        
        # 生成导出文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"assets_export_{timestamp}.{format}"
        file_path = self.export_dir / filename
        
        try:
            if format.lower() == ExportFormat.XLSX:
                self._export_to_excel(assets, file_path, include_fields)
            else:
                self._export_to_csv(assets, file_path, include_fields)
            
            logger.info(f"Export file generated: {file_path}")
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            # 清理已生成的部分文件
            if file_path.exists():
                file_path.unlink()
            raise RuntimeError(f"Export failed: {str(e)}")
        
        # 创建下载链接
        download_token = DownloadLinkManager.create_link(
            file_path=str(file_path),
            filename=filename
        )
        
        return download_token, filename, total_rows
    
    def _get_default_export_fields(self) -> List[str]:
        """获取默认导出字段列表
        
        基于 SPEC 的字段约束定义：
            - asset_id: string, 必填, 1-64
            - asset_name: string, 必填, 1-128
            - asset_type: enum, 必填
            - purchase_date: date, 必填
            - purchase_amount: decimal, 必填
            - department: string, 必填
            - status: enum, 必填
            - location: string, 可选
            - description: string, 可选
        """
        return [
            "asset_id",
            "asset_name",
            "asset_type",
            "purchase_date",
            "purchase_amount",
            "department",
            "status",
            "location",
            "description"
        ]
    
    def _build_query_filters(
        self,
        status: Optional[str] = None,
        department: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict:
        """构建查询过滤器
        
        Args:
            status: 状态筛选
            department: 部门筛选
            date_from: 日期起始
            date_to: 日期截止
            
        Returns:
            过滤器字典
        """
        filters = {}
        
        if status:
            filters["status"] = status
        
        if department:
            filters["department"] = department
        
        if date_from:
            filters["date_from"] = date_from
        
        if date_to:
            filters["date_to"] = date_to
        
        return filters
    
    def _export_to_excel(
        self,
        assets: List[Asset],
        file_path: Path,
        include_fields: List[str]
    ) -> None:
        """导出为 Excel 格式
        
        使用 openpyxl 库生成 .xlsx 文件。
        适用于中小规模数据（<100MB）。
        
        Args:
            assets: 资产数据列表
            file_path: 输出文件路径
            include_fields: 包含的字段列表
        """
        # 转换资产为字典
        asset_dicts = [self._asset_to_dict(asset, include_fields) for asset in assets]
        
        # 生成 Excel
        self.excel_generator.generate(
            data=asset_dicts,
            file_path=str(file_path),
            sheet_name="Assets",
            include_headers=True
        )
        
        logger.info(f"Excel export completed: {len(assets)} rows")
    
    def _export_to_csv(
        self,
        assets: List[Asset],
        file_path: Path,
        include_fields: List[str]
    ) -> None:
        """导出为 CSV 格式
        
        使用流式写入支持大文件（可达 100MB+）。
        编码: UTF-8 BOM
        
        Args:
            assets: 资产数据列表
            file_path: 输出文件路径
            include_fields: 包含的字段列表
        """
        # 转换资产为字典
        asset_dicts = [self._asset_to_dict(asset, include_fields) for asset in assets]
        
        # 生成 CSV（流式）
        self.csv_generator.generate(
            data=asset_dicts,
            file_path=str(file_path),
            encoding="utf-8-sig",  # UTF-8 BOM
            include_headers=True
        )
        
        logger.info(f"CSV export completed: {len(assets)} rows")
    
    def _asset_to_dict(
        self,
        asset: Asset,
        include_fields: List[str]
    ) -> Dict:
        """将资产对象转换为字典
        
        Args:
            asset: 资产对象
            include_fields: 需要包含的字段
            
        Returns:
            资产字典
        """
        result = {}
        
        for field in include_fields:
            value = getattr(asset, field, None)
            
            # 日期格式化
            if field == "purchase_date" and value:
                if isinstance(value, datetime):
                    value = value.strftime("%Y-%m-%d")
                elif isinstance(value, str):
                    # 已经是字符串格式
                    pass
            
            # 金额格式化（保留2位小数）
            if field == "purchase_amount" and value is not None:
                value = round(float(value), 2)
            
            result[field] = value
        
        return result
    
    def get_download_stream(
        self,
        token: str
    ) -> Tuple[Optional[BinaryIO], Optional[str], Optional[str]]:
        """获取下载流
        
        通过下载 token 获取文件流，用于 HTTP 响应。
        
        Args:
            token: 下载链接 token
            
        Returns:
            Tuple[file_stream, filename, content_type]:
                - file_stream: 文件二进制流
                - filename: 下载文件名
                - content_type: MIME 类型
            如果 token 无效或已过期返回 (None, None, None)
        """
        link_info = DownloadLinkManager.get_link_info(token)
        
        if not link_info:
            return None, None, None
        
        file_path = Path(link_info["file_path"])
        
        if not file_path.exists():
            logger.error(f"Export file not found: {file_path}")
            return None, None, None
        
        # 确定 MIME 类型
        filename = link_info["filename"]
        if filename.endswith(".xlsx"):
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif filename.endswith(".csv"):
            content_type = "text/csv; charset=utf-8-sig"
        else:
            content_type = "application/octet-stream"
        
        # 打开文件流
        file_stream = open(file_path, "rb")
        
        logger.info(f"Download stream opened for token: {token}")
        return file_stream, filename, content_type
    
    def cleanup_old_exports(self, retention_days: Optional[int] = None) -> int:
        """清理过期的导出文件
        
        Args:
            retention_days: 保留天数，默认使用 FILE_RETENTION_DAYS
            
        Returns:
            清理的文件数量
        """
        if retention_days is None:
            retention_days = self.FILE_RETENTION_DAYS
        
        cutoff_time = datetime.now() - timedelta(days=retention_days)
        cleaned_count = 0
        
        if not self.export_dir.exists():
            return 0
        
        for file_path in self.export_dir.iterdir():
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff_time:
                    try:
                        file_path.unlink()
                        cleaned_count += 1
                        logger.info(f"Cleaned old export file: {file_path}")
                    except OSError as e:
                        logger.error(f"Failed to clean file {file_path}: {e}")
        
        # 同时清理过期链接
        DownloadLinkManager.cleanup_expired()
        
        return cleaned_count
    
    def get_export_statistics(self) -> Dict:
        """获取导出统计信息
        
        Returns:
            包含导出统计的字典
        """
        total_files = 0
        total_size = 0
        active_links = len(DownloadLinkManager._links)
        
        if self.export_dir.exists():
            for file_path in self.export_dir.iterdir():
                if file_path.is_file():
                    total_files += 1
                    total_size += file_path.stat().st_size
        
        return {
            "total_exported_files": total_files,
            "total_size_bytes": total_size,
            "active_download_links": active_links,
            "export_dir": str(self.export_dir),
            "max_export_rows": self.MAX_EXPORT_ROWS,
            "link_expiry_hours": DownloadLinkManager.DEFAULT_EXPIRY_HOURS
        }