"""
资产批量导入任务模型

本模块定义了导入任务的数据模型、状态枚举和校验规则，
用于支持资产批量导入导出功能的迭代2需求。

主要功能：
    - 导入任务状态管理（待处理/处理中/队列中/完成/失败）
    - 导入错误类型枚举
    - 资产字段校验规则定义
    - 异步任务进度追踪

Architecture Constraints:
    - 单次导入文件大小: ≤ 50MB
    - 单次导入行数上限: 100,000 行
    - 单次导出行数上限: 500,000 行
    - 并发导入任务数: ≤ 10

Version: SWARM-2025-Q2-P2-006 Iteration 2
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ImportTaskStatus(str, Enum):
    """
    导入任务状态枚举
    
    状态转换流程:
        PENDING -> QUEUED -> PROCESSING -> COMPLETED/FAILED
    """
    PENDING = "pending"        # 待处理
    QUEUED = "queued"          # 队列中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"    # 已完成
    FAILED = "failed"          # 失败


class ImportMode(str, Enum):
    """
    导入模式枚举
    
    Attributes:
        STRICT: 全量模式，任何错误导致整批失败
        PARTIAL: 部分模式，跳过错误行继续处理
    """
    STRICT = "strict"   # 全量失败模式
    PARTIAL = "partial" # 部分导入模式


class AssetType(str, Enum):
    """
    资产类型枚举
    
    支持的资产分类：
        - EQUIPMENT: 设备
        - INSTRUMENT: 仪器仪表
        - VEHICLE: 车辆
        - OTHER: 其他
    """
    EQUIPMENT = "EQUIPMENT"
    INSTRUMENT = "INSTRUMENT"
    VEHICLE = "VEHICLE"
    OTHER = "OTHER"


class AssetStatus(str, Enum):
    """
    资产状态枚举
    
    资产生命周期状态：
        - ACTIVE: 在用
        - MAINTENANCE: 维保中
        - SCRAPPED: 已报废
    """
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    SCRAPPED = "SCRAPPED"


class ImportErrorType(str, Enum):
    """
    导入错误类型枚举
    
    用于分类导入过程中的错误：
        - VALIDATION_ERROR: 字段校验失败
        - DUPLICATE_KEY: 数据唯一性冲突
        - DATA_TYPE_ERROR: 数据类型错误
        - MISSING_REQUIRED: 必填字段缺失
        - FORMAT_ERROR: 格式错误
        - DATABASE_ERROR: 数据库操作错误
    """
    VALIDATION_ERROR = "validation_error"
    DUPLICATE_KEY = "duplicate_key"
    DATA_TYPE_ERROR = "data_type_error"
    MISSING_REQUIRED = "missing_required"
    FORMAT_ERROR = "format_error"
    DATABASE_ERROR = "database_error"


class ImportError(BaseModel):
    """
    导入错误详情模型
    
    记录单行数据的错误信息，用于生成错误报告。
    """
    row: int = Field(..., ge=1, description="错误所在行号")
    field: str = Field(..., min_length=1, description="错误字段名")
    message: str = Field(..., description="错误描述信息")
    error_type: ImportErrorType = Field(default=ImportErrorType.VALIDATION_ERROR, description="错误类型")
    original_value: Optional[str] = Field(default=None, description="原始错误值")

    class Config:
        """Pydantic模型配置"""
        use_enum_values = True


class AssetImportRow(BaseModel):
    """
    资产导入数据行模型
    
    定义单行资产导入数据的字段结构和校验规则。
    所有必填字段均使用 Pydantic 进行类型和约束校验。
    
    Attributes:
        asset_id: 资产编号（必填，唯一性）
        asset_name: 资产名称（必填）
        asset_type: 资产类型（必填，枚举值）
        purchase_date: 采购日期（必填，YYYY-MM-DD格式）
        purchase_amount: 采购金额（必填，≥0，精度2位）
        department: 所属部门（必填，匹配部门编码）
        status: 资产状态（必填，枚举值）
        location: 存放地点（可选）
        description: 资产描述（可选）
    """
    asset_id: str = Field(..., min_length=1, max_length=64, description="资产编号")
    asset_name: str = Field(..., min_length=1, max_length=128, description="资产名称")
    asset_type: AssetType = Field(..., description="资产类型")
    purchase_date: str = Field(..., description="采购日期 (YYYY-MM-DD)")
    purchase_amount: Decimal = Field(..., ge=Decimal("0"), decimal_places=2, description="采购金额")
    department: str = Field(..., min_length=1, max_length=64, description="所属部门")
    status: AssetStatus = Field(..., description="资产状态")
    location: Optional[str] = Field(default=None, max_length=128, description="存放地点")
    description: Optional[str] = Field(default=None, max_length=512, description="资产描述")

    @field_validator("asset_id")
    @classmethod
    def validate_asset_id(cls, v: str) -> str:
        """
        校验资产编号格式
        
        规则：只允许字母、数字和下划线
        
        Args:
            v: 资产编号
            
        Returns:
            校验通过的资产编号
            
        Raises:
            ValueError: 资产编号包含非法字符
        """
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("资产编号只能包含字母、数字、下划线")
        return v

    @field_validator("purchase_date")
    @classmethod
    def validate_purchase_date(cls, v: str) -> str:
        """
        校验采购日期格式
        
        要求：ISO 8601 格式 YYYY-MM-DD
        
        Args:
            v: 日期字符串
            
        Returns:
            校验通过的日期字符串
            
        Raises:
            ValueError: 日期格式不符合YYYY-MM-DD
        """
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("采购日期格式必须为 YYYY-MM-DD")
        return v

    @field_validator("purchase_amount")
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        """
        校验金额精度
        
        要求：精度为2位小数
        
        Args:
            v: 金额值
            
        Returns:
            保留2位精度的金额值
        """
        return round(v, 2)

    class Config:
        """Pydantic模型配置"""
        use_enum_values = True


class ImportTask(BaseModel):
    """
    资产批量导入任务模型
    
    用于追踪和管理批量导入任务的执行状态、进度和结果。
    支持同步和异步两种处理模式。
    
    Attributes:
        task_id: 任务唯一标识符
        user_id: 操作用户ID
        file_name: 导入文件名
        file_path: 文件存储路径
        file_size: 文件大小（字节）
        status: 任务状态
        mode: 导入模式（strict/partial）
        total_rows: 总行数
        imported_rows: 成功导入行数
        failed_rows: 失败行数
        errors: 错误详情列表
        error_report_path: 错误报告文件路径
        created_at: 任务创建时间
        started_at: 开始处理时间
        completed_at: 任务完成时间
        progress: 处理进度百分比
        overwrite: 是否覆盖已存在资产
    """
    task_id: Optional[str] = Field(default=None, description="任务唯一标识符")
    user_id: str = Field(..., min_length=1, description="操作用户ID")
    file_name: str = Field(..., min_length=1, description="导入文件名")
    file_path: Optional[str] = Field(default=None, description="文件存储路径")
    file_size: Optional[int] = Field(default=None, ge=0, description="文件大小（字节）")
    status: ImportTaskStatus = Field(default=ImportTaskStatus.PENDING, description="任务状态")
    mode: ImportMode = Field(default=ImportMode.PARTIAL, description="导入模式")
    total_rows: int = Field(default=0, ge=0, description="总行数")
    imported_rows: int = Field(default=0, ge=0, description="成功导入行数")
    failed_rows: int = Field(default=0, ge=0, description="失败行数")
    errors: List[ImportError] = Field(default_factory=list, description="错误详情列表")
    error_report_path: Optional[str] = Field(default=None, description="错误报告文件路径")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="任务创建时间")
    started_at: Optional[datetime] = Field(default=None, description="开始处理时间")
    completed_at: Optional[datetime] = Field(default=None, description="任务完成时间")
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="处理进度百分比")
    overwrite: bool = Field(default=False, description="是否覆盖已存在资产")

    def start_processing(self) -> None:
        """
        标记任务开始处理
        
        更新状态为PROCESSING，记录开始时间，重置进度。
        """
        self.status = ImportTaskStatus.PROCESSING
        self.started_at = datetime.utcnow()
        self.progress = 0.0

    def update_progress(self, processed_rows: int) -> None:
        """
        更新任务处理进度
        
        根据已处理的行数计算进度百分比。
        
        Args:
            processed_rows: 已处理的行数
        """
        if self.total_rows > 0:
            self.progress = round((processed_rows / self.total_rows) * 100, 2)

    def add_error(self, row: int, field: str, message: str, 
                  error_type: ImportErrorType = ImportErrorType.VALIDATION_ERROR,
                  original_value: Optional[str] = None) -> None:
        """
        添加导入错误记录
        
        Args:
            row: 错误所在行号
            field: 错误字段名
            message: 错误描述信息
            error_type: 错误类型，默认为校验错误
            original_value: 原始错误值
        """
        error = ImportError(
            row=row,
            field=field,
            message=message,
            error_type=error_type,
            original_value=original_value
        )
        self.errors.append(error)
        self.failed_rows += 1

    def mark_completed(self, imported: int, failed: int) -> None:
        """
        标记任务完成
        
        更新任务状态为COMPLETED，记录完成时间和统计信息。
        
        Args:
            imported: 成功导入的行数
            failed: 失败的行数
        """
        self.status = ImportTaskStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.imported_rows = imported
        self.failed_rows = failed
        self.progress = 100.0

    def mark_failed(self, error_message: Optional[str] = None) -> None:
        """
        标记任务失败
        
        更新任务状态为FAILED，记录完成时间。
        
        Args:
            error_message: 失败原因描述
        """
        self.status = ImportTaskStatus.FAILED
        self.completed_at = datetime.utcnow()
        if error_message:
            self.add_error(
                row=0,
                field="task",
                message=error_message,
                error_type=ImportErrorType.DATABASE_ERROR
            )

    def get_summary(self) -> Dict[str, Any]:
        """
        获取任务执行摘要
        
        Returns:
            包含任务统计信息的字典
        """
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "total_rows": self.total_rows,
            "imported_rows": self.imported_rows,
            "failed_rows": self.failed_rows,
            "success_rate": round((self.imported_rows / self.total_rows * 100) 
                                  if self.total_rows > 0 else 0, 2),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": (
                (self.completed_at - self.started_at).total_seconds()
                if self.completed_at and self.started_at else None
            )
        }

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            任务完整信息的字典表示
        """
        return {
            "task_id": self.task_id,
            "user_id": self.user_id,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "status": self.status.value,
            "mode": self.mode.value,
            "total_rows": self.total_rows,
            "imported_rows": self.imported_rows,
            "failed_rows": self.failed_rows,
            "errors": [e.model_dump() for e in self.errors],
            "error_report_path": self.error_report_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress": self.progress,
            "overwrite": self.overwrite
        }

    class Config:
        """Pydantic模型配置"""
        use_enum_values = True


class ImportTemplateConfig(BaseModel):
    """
    导入模板配置模型
    
    定义导入模板的生成规则和字段映射关系。
    
    Attributes:
        format: 模板格式（xlsx/csv）
        include_sample: 是否包含示例数据
        required_fields: 必填字段列表
        optional_fields: 可选字段列表
        field_order: 字段导出顺序
    """
    format: str = Field(default="xlsx", pattern="^(xlsx|csv)$", description="模板格式")
    include_sample: bool = Field(default=True, description="是否包含示例数据")
    required_fields: List[str] = Field(
        default=[
            "asset_id", "asset_name", "asset_type", "purchase_date",
            "purchase_amount", "department", "status"
        ],
        description="必填字段列表"
    )
    optional_fields: List[str] = Field(
        default=["location", "description"],
        description="可选字段列表"
    )
    field_order: List[str] = Field(
        default=[
            "asset_id", "asset_name", "asset_type", "purchase_date",
            "purchase_amount", "department", "status", "location", "description"
        ],
        description="字段导出顺序"
    )

    def get_all_fields(self) -> List[str]:
        """
        获取所有字段列表
        
        Returns:
            包含必填和可选字段的完整列表
        """
        return self.required_fields + self.optional_fields

    def is_required(self, field_name: str) -> bool:
        """
        检查字段是否为必填
        
        Args:
            field_name: 字段名称
            
        Returns:
            如果字段为必填返回True
        """
        return field_name in self.required_fields


class ExportRequest(BaseModel):
    """
    资产批量导出请求模型
    
    定义导出请求的参数和筛选条件。
    
    Attributes:
        format: 导出格式（xlsx/csv）
        status: 按状态筛选
        department: 按部门筛选
        date_from: 采购日期起始
        date_to: 采购日期截止
        include_fields: 指定导出的字段列表
    """
    format: str = Field(default="xlsx", pattern="^(xlsx|csv)$", description="导出格式")
    status: Optional[AssetStatus] = Field(default=None, description="按状态筛选")
    department: Optional[str] = Field(default=None, max_length=64, description="按部门筛选")
    date_from: Optional[str] = Field(default=None, description="采购日期起始 (YYYY-MM-DD)")
    date_to: Optional[str] = Field(default=None, description="采购日期截止 (YYYY-MM-DD)")
    include_fields: Optional[List[str]] = Field(default=None, description="指定导出字段")

    @field_validator("date_from", "date_to")
    @classmethod
    def validate_date_format(cls, v: Optional[str]) -> Optional[str]:
        """
        校验日期格式
        
        Args:
            v: 日期字符串
            
        Returns:
            校验通过的日期字符串
        """
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("日期格式必须为 YYYY-MM-DD")
        return v

    class Config:
        """Pydantic模型配置"""
        use_enum_values = True


# 架构约束常量
IMPORT_CONSTRAINTS = {
    "max_file_size_mb": 50,
    "max_import_rows": 100000,
    "max_export_rows": 500000,
    "max_concurrent_tasks": 10,
    "file_retention_days": 30,
    "download_link_expiry_hours": 24,
    "supported_formats": [".xlsx", ".xls", ".csv"],
    "encoding": "utf-8"
}

# 资产字段长度约束
FIELD_LENGTH_CONSTRAINTS = {
    "asset_id": {"min": 1, "max": 64},
    "asset_name": {"min": 1, "max": 128},
    "department": {"min": 1, "max": 64},
    "location": {"min": 0, "max": 128},
    "description": {"min": 0, "max": 512}
}

# 性能约束
PERFORMANCE_THRESHOLDS = {
    "small_file_size_mb": 5,
    "small_file_sync_timeout_sec": 5,
    "medium_file_sync_timeout_sec": 30,
    "export_timeout_sec": 10
}