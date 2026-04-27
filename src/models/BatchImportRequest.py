"""
资产批量导入请求模型

本模块定义了批量导入资产数据时使用的请求数据模型，包括：
- 导入任务状态枚举
- 批量导入请求数据结构
- 导入结果与错误详情
- 导入进度跟踪

适用场景：
    - 用户上传 Excel/CSV 文件批量导入资产
    - 系统异步处理大批量导入任务
    - 生成导入错误报告供用户修正

Author: SWARM-2025-Q2-P2-006 Team
Version: 1.0.0
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ImportTaskStatus(str, Enum):
    """
    导入任务状态枚举
    
    定义了批量导入任务从创建到完成的完整生命周期状态。
    
    状态流转:
        PENDING -> PROCESSING -> COMPLETED/FAILED
        PROCESSING -> PARTIAL_SUCCESS (部分成功时)
    """
    
    PENDING = "PENDING"
    """任务已创建，等待处理"""
    
    PROCESSING = "PROCESSING"
    """任务正在处理中"""
    
    COMPLETED = "COMPLETED"
    """任务已完成，全部记录导入成功"""
    
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    """任务完成，但存在部分失败记录"""
    
    FAILED = "FAILED"
    """任务失败，全部回滚"""
    
    CANCELLED = "CANCELLED"
    """任务被用户取消"""


class ImportFileFormat(str, Enum):
    """
    支持的导入文件格式枚举
    """
    
    CSV = "csv"
    """CSV 格式文件"""
    
    XLSX = "xlsx"
    """Excel 2007+ 格式文件"""
    
    XLS = "xls"
    """Excel 97-2003 格式文件（兼容性支持）"""


class ImportTriggerType(str, Enum):
    """
    导入触发类型枚举
    """
    
    MANUAL = "MANUAL"
    """手动触发"""
    
    SCHEDULED = "SCHEDULED"
    """定时任务触发"""
    
    API = "API"
    """API 调用触发"""


@dataclass
class ImportFieldMapping:
    """
    导入字段映射配置
    
    定义了源文件列与目标资产字段的映射关系。
    
    Attributes:
        source_column: 源文件中的列名或列索引
        target_field: 目标资产模型字段名
        is_required: 该字段是否为必填
        default_value: 默认值（当源数据为空时使用）
        validator: 自定义校验器函数路径
    """
    
    source_column: str | int
    target_field: str
    is_required: bool = True
    default_value: Optional[Any] = None
    validator: Optional[str] = None
    
    def __post_init__(self) -> None:
        """
        验证映射配置的合法性
        
        Raises:
            ValueError: 当必填字段缺少默认值且无校验器时
        """
        if self.is_required and self.default_value is None and self.validator is None:
            raise ValueError(
                f"Required field '{self.target_field}' must have either "
                f"default_value or validator defined"
            )


@dataclass
class ImportErrorDetail:
    """
    单条导入错误详情
    
    记录每一条导入失败记录的详细信息。
    
    Attributes:
        row_number: 源文件中的行号（从1开始）
        field_name: 出错的字段名
        original_value: 原始值
        error_code: 错误代码
        error_message: 人类可读的错误描述
        timestamp: 错误记录时间
    """
    
    row_number: int
    field_name: str
    original_value: Any
    error_code: str
    error_message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict[str, Any]:
        """
        将错误详情转换为字典格式
        
        Returns:
            包含所有错误字段的字典
        """
        return {
            "row_number": self.row_number,
            "field_name": self.field_name,
            "original_value": str(self.original_value) if self.original_value is not None else "",
            "error_code": self.error_code,
            "error_message": self.error_message,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class BatchImportRequest:
    """
    批量导入请求模型
    
    完整定义了资产批量导入任务的所有参数和状态。
    
    Attributes:
        request_id: 请求唯一标识
        user_id: 操作用户ID
        file_name: 上传文件名
        file_format: 文件格式
        total_rows: 总记录数
        status: 当前任务状态
        trigger_type: 触发类型
        created_at: 创建时间
        updated_at: 更新时间
        started_at: 开始处理时间
        completed_at: 完成时间
        error_details: 错误详情列表
        field_mappings: 字段映射配置
        options: 导入选项
        
    Example:
        >>> request = BatchImportRequest(
        ...     user_id="user_123",
        ...     file_name="assets_2025.csv",
        ...     file_format=ImportFileFormat.CSV,
        ...     total_rows=1500
        ... )
        >>> print(request.request_id)
        'req_abc123...'
    """
    
    # 核心标识
    request_id: str = field(default_factory=lambda: f"req_{uuid.uuid4().hex[:12]}")
    """请求唯一标识，格式: req_{12位十六进制}"""
    
    user_id: str = ""
    """操作用户ID"""
    
    # 文件信息
    file_name: str = ""
    """上传文件名"""
    
    file_format: ImportFileFormat = ImportFileFormat.CSV
    """文件格式"""
    
    file_size: int = 0
    """文件大小（字节）"""
    
    total_rows: int = 0
    """源文件总记录数（不含表头）"""
    
    # 状态管理
    status: ImportTaskStatus = ImportTaskStatus.PENDING
    """当前任务状态"""
    
    trigger_type: ImportTriggerType = ImportTriggerType.MANUAL
    """触发类型"""
    
    # 时间戳
    created_at: datetime = field(default_factory=datetime.utcnow)
    """任务创建时间"""
    
    updated_at: datetime = field(default_factory=datetime.utcnow)
    """最后更新时间"""
    
    started_at: Optional[datetime] = None
    """开始处理时间"""
    
    completed_at: Optional[datetime] = None
    """任务完成时间"""
    
    # 结果追踪
    processed_rows: int = 0
    """已处理记录数"""
    
    success_rows: int = 0
    """成功导入记录数"""
    
    failed_rows: int = 0
    """失败记录数"""
    
    error_details: list[ImportErrorDetail] = field(default_factory=list)
    """错误详情列表"""
    
    # 配置
    field_mappings: list[ImportFieldMapping] = field(default_factory=list)
    """字段映射配置"""
    
    options: dict[str, Any] = field(default_factory=dict)
    """导入选项（如 skip_duplicate, update_existing 等）"""
    
    # 错误信息
    error_message: Optional[str] = None
    """任务级错误信息（整体失败时）"""
    
    def __post_init__(self) -> None:
        """
        初始化后验证
        
        检查文件大小是否超限、记录数是否合规等。
        
        Raises:
            ValueError: 当参数不符合约束时
        """
        # 文件大小限制：10MB
        max_file_size = 10 * 1024 * 1024
        if self.file_size > max_file_size:
            raise ValueError(
                f"File size {self.file_size} bytes exceeds maximum "
                f"allowed size of {max_file_size} bytes (10MB)"
            )
        
        # 记录数限制：5000条/次
        max_rows = 5000
        if self.total_rows > max_rows:
            raise ValueError(
                f"Total rows {self.total_rows} exceeds maximum "
                f"allowed count of {max_rows}"
            )
    
    def mark_processing(self) -> None:
        """
        标记任务为处理中状态
        
        更新状态为 PROCESSING，并记录开始时间。
        """
        self.status = ImportTaskStatus.PROCESSING
        self.started_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def add_error(self, error: ImportErrorDetail) -> None:
        """
        添加一条错误详情
        
        Args:
            error: 错误详情对象
        """
        self.error_details.append(error)
        self.failed_rows += 1
        self.updated_at = datetime.utcnow()
    
    def increment_success(self, count: int = 1) -> None:
        """
        增加成功记录计数
        
        Args:
            count: 成功记录增量，默认为1
        """
        self.success_rows += count
        self.processed_rows += count
        self.updated_at = datetime.utcnow()
    
    def mark_completed(self) -> None:
        """
        标记任务完成
        
        根据成功/失败数量确定最终状态。
        """
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        
        if self.failed_rows == 0:
            self.status = ImportTaskStatus.COMPLETED
        elif self.success_rows > 0:
            self.status = ImportTaskStatus.PARTIAL_SUCCESS
        else:
            self.status = ImportTaskStatus.FAILED
    
    def mark_failed(self, error_message: str) -> None:
        """
        标记任务失败
        
        Args:
            error_message: 失败原因描述
        """
        self.status = ImportTaskStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def get_progress_percentage(self) -> float:
        """
        获取任务进度百分比
        
        Returns:
            0.0 到 100.0 之间的浮点数
        """
        if self.total_rows == 0:
            return 0.0
        return round((self.processed_rows / self.total_rows) * 100, 2)
    
    def is_finished(self) -> bool:
        """
        判断任务是否已结束
        
        Returns:
            True 表示任务已完成/失败/取消，False 表示仍在进行中
        """
        return self.status in (
            ImportTaskStatus.COMPLETED,
            ImportTaskStatus.PARTIAL_SUCCESS,
            ImportTaskStatus.FAILED,
            ImportTaskStatus.CANCELLED
        )
    
    def is_large_import(self) -> bool:
        """
        判断是否为大批量导入（需要异步处理）
        
        Returns:
            True 表示需要异步处理（>1000条）
        """
        return self.total_rows > 1000
    
    def to_summary_dict(self) -> dict[str, Any]:
        """
        生成任务摘要字典
        
        用于 API 响应和列表展示。
        
        Returns:
            包含核心字段的字典
        """
        return {
            "request_id": self.request_id,
            "user_id": self.user_id,
            "file_name": self.file_name,
            "file_format": self.file_format.value,
            "total_rows": self.total_rows,
            "status": self.status.value,
            "progress": self.get_progress_percentage(),
            "success_rows": self.success_rows,
            "failed_rows": self.failed_rows,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
    
    def to_full_report_dict(self) -> dict[str, Any]:
        """
        生成完整报告字典
        
        包含所有错误详情，用于错误报告下载。
        
        Returns:
            包含完整错误列表的字典
        """
        return {
            **self.to_summary_dict(),
            "errors": [error.to_dict() for error in self.error_details],
            "error_message": self.error_message
        }


def create_import_request(
    user_id: str,
    file_name: str,
    file_format: str,
    total_rows: int,
    file_size: int = 0,
    **options: Any
) -> BatchImportRequest:
    """
    工厂函数：创建批量导入请求
    
    简化 BatchImportRequest 实例的创建过程。
    
    Args:
        user_id: 操作用户ID
        file_name: 文件名
        file_format: 文件格式（csv/xlsx/xls）
        total_rows: 总记录数
        file_size: 文件大小（字节）
        **options: 其他导入选项
        
    Returns:
        新创建的 BatchImportRequest 实例
        
    Raises:
        ValueError: 当参数验证失败时
        
    Example:
        >>> request = create_import_request(
        ...     user_id="admin_01",
        ...     file_name="inventory.csv",
        ...     file_format="csv",
        ...     total_rows=2500,
        ...     file_size=102400
        ... )
    """
    # 解析文件格式
    try:
        fmt = ImportFileFormat(file_format.lower())
    except ValueError:
        raise ValueError(f"Unsupported file format: {file_format}")
    
    # 确定触发类型
    trigger_type = ImportTriggerType.API if options.get("is_api", False) else ImportTriggerType.MANUAL
    
    return BatchImportRequest(
        user_id=user_id,
        file_name=file_name,
        file_format=fmt,
        file_size=file_size,
        total_rows=total_rows,
        trigger_type=trigger_type,
        options=options
    )