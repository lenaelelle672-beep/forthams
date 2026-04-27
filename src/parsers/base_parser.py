"""
资产批量导入导出 - 文件解析器基类

定义 CSV/Excel 文件解析的统一接口规范。
本模块实现 Layer 1 - Foundation 层，作为数据解析的基础抽象层。

支持规格:
- SWARM-2025-Q2-P2-006
- 单次导入上限: 5000 条记录
- 文件大小上限: 10 MB
- 固定 12 个核心字段映射
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union, Tuple
from enum import Enum
import os


class FileSizeExceededError(Exception):
    """
    文件大小超过限制时抛出的异常。
    
    Attributes:
        size: 实际文件大小（字节）
        max_size: 允许的最大文件大小（字节）
    """
    
    def __init__(self, size: int, max_size: int):
        self.size = size
        self.max_size = max_size
        message = f"文件大小 {size} bytes 超过限制 {max_size} bytes (10MB)"
        super().__init__(message)


class ParseError(Exception):
    """
    文件解析过程中发生的一般性错误。
    
    Attributes:
        line_number: 发生错误的行号（如果有）
        detail: 错误详情描述
    """
    
    def __init__(self, message: str, line_number: Optional[int] = None):
        self.line_number = line_number
        self.detail = message
        if line_number:
            super().__init__(f"第 {line_number} 行解析失败: {message}")
        else:
            super().__init__(message)


class EncodingError(Exception):
    """
    文件编码不支持或无法解码时抛出。
    """
    pass


class AssetTypeEnum(str, Enum):
    """
    资产类型枚举值
    对应 asset_type 字段的合法取值
    """
    EQUIPMENT = "EQUIPMENT"       # 设备
    FURNITURE = "FURNITURE"       # 家具
    VEHICLE = "VEHICLE"           # 车辆
    IT_HARDWARE = "IT_HARDWARE"   # IT硬件
    OTHER = "OTHER"               # 其他


class AssetStatusEnum(str, Enum):
    """
    资产状态枚举值
    对应 status 字段的合法取值
    """
    ACTIVE = "ACTIVE"             # 活跃
    INACTIVE = "INACTIVE"         # 停用
    MAINTENANCE = "MAINTENANCE"   # 维护中
    RETIRED = "RETIRED"           # 已报废


class CurrencyEnum(str, Enum):
    """
    币种枚举值
    对应 currency 字段的合法取值，默认 CNY
    """
    CNY = "CNY"                   # 人民币
    USD = "USD"                   # 美元
    EUR = "EUR"                   # 欧元
    JPY = "JPY"                   # 日元
    GBP = "GBP"                   # 英镑


@dataclass
class ParseWarning:
    """
    解析警告信息
    
    Attributes:
        line_number: 警告发生的行号
        field: 相关的字段名（如果有）
        message: 警告详情描述
    """
    line_number: int
    field: Optional[str] = None
    message: str = ""


@dataclass
class FieldError:
    """
    字段级错误信息
    
    Attributes:
        row: 行号（从1开始）
        field: 字段名
        value: 错误值
        reason: 错误原因
    """
    row: int
    field: str
    value: Any
    reason: str
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式，用于生成错误报告"""
        return {
            "row_number": self.row,
            "error_field": self.field,
            "error_value": str(self.value),
            "error_detail": self.reason
        }


@dataclass
class ParseResult:
    """
    文件解析结果
    
    包含解析后的数据行、错误列表、警告列表等统计信息
    
    Attributes:
        data: 解析后的数据行列表，每行为字典
        errors: 字段级错误列表
        warnings: 解析警告列表
        total_rows: 源文件总行数（含空行）
        success_count: 成功解析的行数
        failed_count: 解析失败的行数
        skipped_rows: 跳过的行数（如空行）
    """
    data: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[FieldError] = field(default_factory=list)
    warnings: List[ParseWarning] = field(default_factory=list)
    total_rows: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_rows: int = 0
    
    def has_errors(self) -> bool:
        """是否存在解析错误"""
        return len(self.errors) > 0
    
    def add_warning(self, line_number: int, message: str, field: Optional[str] = None) -> None:
        """添加解析警告"""
        self.warnings.append(ParseWarning(line_number, field, message))
    
    def add_error(self, row: int, field: str, value: Any, reason: str) -> None:
        """添加字段错误"""
        self.errors.append(FieldError(row, field, value, reason))
    
    def to_error_report(self) -> List[Dict[str, Any]]:
        """生成错误报告（用于 CSV 导出）"""
        return [error.to_dict() for error in self.errors]


class BaseParser(ABC):
    """
    资产导入文件解析器抽象基类
    
    定义 CSV/Excel 文件解析的统一接口。
    子类需实现 parse() 方法以支持特定文件格式。
    
    Class Attributes:
        MAX_FILE_SIZE: 最大文件大小（10 MB = 10 * 1024 * 1024 bytes）
        MAX_ROWS: 单次导入最大行数（5000）
        REQUIRED_FIELDS: 必填字段列表
        OPTIONAL_FIELDS: 可选字段列表
        ENUM_FIELDS: 枚举类型字段及其合法值
    
    Example:
        >>> class CsvParser(BaseParser):
        ...     def parse(self, file_path: str, options: Optional[Dict] = None) -> ParseResult:
        ...         # 实现 CSV 解析逻辑
        ...         pass
    """
    
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10 MB
    MAX_ROWS: int = 5000
    
    REQUIRED_FIELDS: List[str] = [
        "asset_name",
        "asset_type",
        "purchase_date",
        "purchase_price",
        "currency",
        "department",
        "status"
    ]
    
    OPTIONAL_FIELDS: List[str] = [
        "asset_id",
        "serial_number",
        "custodian",
        "location",
        "remarks"
    ]
    
    ENUM_FIELDS: Dict[str, Tuple[str, ...]] = {
        "asset_type": tuple(e.value for e in AssetTypeEnum),
        "status": tuple(e.value for e in AssetStatusEnum),
        "currency": tuple(e.value for e in CurrencyEnum)
    }
    
    def __init__(self):
        """初始化解析器实例"""
        self._validated = False
    
    def validate_file_size(self, file_path: str) -> int:
        """
        验证文件大小是否超过限制
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件大小（字节）
            
        Raises:
            FileSizeExceededError: 文件超过 10 MB 时抛出
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        size = os.path.getsize(file_path)
        if size > self.MAX_FILE_SIZE:
            raise FileSizeExceededError(size, self.MAX_FILE_SIZE)
        return size
    
    def validate_file_size_by_stream(self, stream: Any) -> int:
        """
        通过流式数据验证文件大小
        
        Args:
            stream: 文件流对象（需支持 seek/tell 或已知大小）
            
        Returns:
            文件大小（字节）
            
        Raises:
            FileSizeExceededError: 文件超过 10 MB 时抛出
        """
        # 尝试获取文件大小
        size = 0
        try:
            if hasattr(stream, 'size'):
                size = stream.size
            elif hasattr(stream, 'seek') and hasattr(stream, 'tell'):
                current = stream.tell()
                stream.seek(0, 2)  # 跳到文件末尾
                size = stream.tell()
                stream.seek(current)  # 恢复原位置
            else:
                # 读取所有数据计算大小
                content = stream.read()
                size = len(content)
                if hasattr(stream, 'seek'):
                    stream.seek(0)
        except Exception:
            pass
        
        if size > self.MAX_FILE_SIZE:
            raise FileSizeExceededError(size, self.MAX_FILE_SIZE)
        return size
    
    def validate_row_count(self, row_count: int) -> None:
        """
        验证行数是否超过限制
        
        Args:
            row_count: 要导入的行数
            
        Raises:
            ParseError: 行数超过 5000 时抛出
        """
        if row_count > self.MAX_ROWS:
            raise ParseError(
                f"导入行数 {row_count} 超过单次限制 {self.MAX_ROWS}",
                line_number=None
            )
    
    @abstractmethod
    def parse(
        self,
        source: Union[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        """
        解析文件并返回结构化数据
        
        此方法为抽象方法，子类需实现具体解析逻辑。
        
        Args:
            source: 文件路径或文件流对象
            options: 解析选项（如编码、起始行等）
            
        Returns:
            ParseResult: 包含解析数据、错误和警告的结果对象
            
        Raises:
            FileSizeExceededError: 文件超过 10 MB
            ParseError: 解析过程中发生错误
            EncodingError: 文件编码不支持
        """
        pass
    
    def _create_error_result(
        self,
        message: str,
        line_number: Optional[int] = None
    ) -> ParseResult:
        """
        创建错误结果对象
        
        Args:
            message: 错误消息
            line_number: 发生错误的行号
            
        Returns:
            包含错误的 ParseResult 对象
        """
        result = ParseResult()
        result.add_error(0, "file", None, message)
        return result
    
    def _get_field_value(
        self,
        row: Dict[str, Any],
        field: str,
        default: Any = None
    ) -> Any:
        """
        安全获取字段值
        
        Args:
            row: 数据行字典
            field: 字段名
            default: 默认值
            
        Returns:
            字段值或默认值
        """
        return row.get(field, default)
    
    def _strip_value(self, value: Any) -> Any:
        """
        清理字符串值（去除首尾空白）
        
        Args:
            value: 原始值
            
        Returns:
            清理后的值
        """
        if isinstance(value, str):
            return value.strip()
        return value
    
    def _normalize_date(self, value: str) -> Optional[str]:
        """
        标准化日期格式为 YYYY-MM-DD
        
        Args:
            value: 日期字符串
            
        Returns:
            标准化后的日期字符串，失败返回 None
        """
        import re
        
        if not value:
            return None
        
        # 尝试多种日期格式
        patterns = [
            (r'^(\d{4})-(\d{1,2})-(\d{1,2})$', '%Y-%m-%d'),
            (r'^(\d{4})/(\d{1,2})/(\d{1,2})$', '%Y/%m/%d'),
            (r'^(\d{4})(\d{2})(\d{2})$', '%Y%m%d'),
        ]
        
        for pattern, _ in patterns:
            match = re.match(pattern, value.strip())
            if match:
                try:
                    from datetime import datetime
                    groups = match.groups()
                    if len(groups[1]) == 1:
                        groups = (groups[0], '0' + groups[1], groups[2])
                    if len(groups[2]) == 1:
                        groups = (groups[0], groups[1], '0' + groups[2])
                    normalized = f"{groups[0]}-{groups[1]}-{groups[2]}"
                    # 验证日期有效性
                    datetime.strptime(normalized, '%Y-%m-%d')
                    return normalized
                except ValueError:
                    continue
        
        return None
    
    def _parse_decimal(self, value: Any) -> Optional[float]:
        """
        解析十进制数值
        
        Args:
            value: 数值字符串或数字
            
        Returns:
            解析后的浮点数，失败返回 None
        """
        if value is None or value == '':
            return None
        
        try:
            # 移除货币符号和千分位分隔符
            str_value = str(value).strip()
            str_value = str_value.replace('¥', '').replace('$', '').replace('€', '')
            str_value = str_value.replace(',', '').replace(' ', '')
            return float(str_value)
        except (ValueError, TypeError):
            return None
    
    def get_supported_extensions(self) -> List[str]:
        """
        获取支持的文件扩展名列表
        
        Returns:
            支持的扩展名列表（如 ['.csv']）
        """
        return []
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} max_rows={self.MAX_ROWS} max_size={self.MAX_FILE_SIZE}>"
"""
Base parser module for asset batch import/export functionality.

Defines the abstract base class for file parsers (CSV, Excel, etc.)
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BaseParser(ABC):
    """
    Abstract base class for file parsers.

    All concrete parser implementations (CSV, Excel, etc.) must inherit
    from this class and implement the parse() method.
    """

    def __init__(self, file_path: Optional[str] = None):
        """
        Initialize the base parser.

        Args:
            file_path: Optional path to the file to be parsed.
        """
        self.file_path = file_path
        self._rows: List[Dict[str, Any]] = []
        self._errors: List[Dict[str, Any]] = []

    @abstractmethod
    def parse(self, file_content: bytes) -> List[Dict[str, Any]]:
        """
        Parse the file content and return a list of row dictionaries.

        Args:
            file_content: Raw file bytes to be parsed.

        Returns:
            List of dictionaries representing parsed rows.

        Raises:
            FileSizeExceededError: If file exceeds 10MB limit.
            ParseError: If file content cannot be parsed.
        """
        pass

    def get_errors(self) -> List[Dict[str, Any]]:
        """
        Get the list of parsing errors encountered during processing.

        Returns:
            List of error dictionaries with row_number, field, and error_detail.
        """
        return self._errors

    def get_row_count(self) -> int:
        """
        Get the number of successfully parsed rows.

        Returns:
            Integer count of parsed rows.
        """
        return len(self._rows)

    def validate_file_size(self, file_size: int, max_size_mb: int = 10) -> bool:
        """
        Validate that the file size does not exceed the maximum allowed.

        Args:
            file_size: Size of the file in bytes.
            max_size_mb: Maximum allowed file size in megabytes.

        Returns:
            True if file size is within limit.

        Raises:
            FileSizeExceededError: If file exceeds size limit.
        """
        max_bytes = max_size_mb * 1024 * 1024
        if file_size > max_bytes:
            raise FileSizeExceededError(
                f"File size {file_size} bytes exceeds maximum allowed {max_bytes} bytes"
            )
        return True


class FileSizeExceededError(Exception):
    """
    Exception raised when file size exceeds the allowed limit.
    """
    pass


class ParseError(Exception):
    """
    Exception raised when file content cannot be parsed correctly.
    """
    pass
