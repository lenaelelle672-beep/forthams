"""
CSV 解析器模块

提供 CSV 文件的解析功能，支持多种编码格式（UTF-8、UTF-8-BOM、GBK），
用于资产批量导入场景。

支持特性：
- 多编码自动检测
- 空行自动跳过
- 文件大小校验（最大10MB）
- 大文件流式处理（>1000行）

ATB 对应：
- ATB-1.1 CSV 文件解析验证
"""

import csv
import io
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Generator, Dict, Any
from datetime import datetime
from decimal import Decimal, InvalidOperation

# 尝试导入chardet进行编码检测（可选）
try:
    import chardet
    CHARDET_AVAILABLE = True
except ImportError:
    CHARDET_AVAILABLE = False

from .base_parser import BaseParser, ParseResult, ParseError

logger = logging.getLogger(__name__)

# 文件大小限制：10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# 支持的编码列表（按优先级排序）
SUPPORTED_ENCODINGS = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030']

# 必需字段列表
REQUIRED_FIELDS = [
    'asset_name',
    'asset_type',
    'purchase_date',
    'purchase_price',
    'currency',
    'department',
    'status'
]

# 可选字段列表
OPTIONAL_FIELDS = [
    'asset_id',
    'serial_number',
    'custodian',
    'location',
    'remarks'
]

# 所有字段列表
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

# 字段最大长度限制
FIELD_MAX_LENGTH = {
    'asset_name': 50,
    'serial_number': 100,
    'custodian': 100,
    'location': 200,
    'remarks': 500
}


class FileSizeExceededError(Exception):
    """文件大小超过限制时抛出"""
    def __init__(self, size: int, max_size: int = MAX_FILE_SIZE):
        self.size = size
        self.max_size = max_size
        super().__init__(
            f"File size {size} bytes exceeds maximum allowed size {max_size} bytes"
        )


class CSVParseError(ParseError):
    """CSV 解析错误"""
    pass


@dataclass
class CSVParseResult(ParseResult):
    """CSV 解析结果"""
    total_rows: int = 0
    skipped_rows: int = 0
    warnings: List[str] = field(default_factory=list)
    encoding_used: str = 'utf-8'


class CSVParser(BaseParser):
    """
    CSV 文件解析器
    
    提供企业级 CSV 文件解析能力，支持多编码、大文件流式处理。
    
    使用示例：
        parser = CSVParser()
        result = parser.parse(file_content, filename="assets.csv")
        for row in result.data:
            print(row)
    
    ATB 测试用例对应：
        - TC-1.1.1 正常 CSV 解析
        - TC-1.1.2 UTF-8-BOM 编码支持
        - TC-1.1.3 GBK 编码兼容
        - TC-1.1.4 异常行处理
        - TC-1.1.5 超大文件拒绝
    """
    
    def __init__(
        self,
        max_file_size: int = MAX_FILE_SIZE,
        skip_empty_rows: bool = True,
        encoding: Optional[str] = None
    ):
        """
        初始化 CSV 解析器
        
        Args:
            max_file_size: 最大文件大小（字节），默认 10MB
            skip_empty_rows: 是否跳过空行，默认 True
            encoding: 指定编码，如果为 None 则自动检测
        """
        self.max_file_size = max_file_size
        self.skip_empty_rows = skip_empty_rows
        self.encoding = encoding
        self._supported_encodings = SUPPORTED_ENCODINGS
    
    def parse(
        self,
        content: bytes,
        filename: Optional[str] = None
    ) -> CSVParseResult:
        """
        解析 CSV 内容
        
        Args:
            content: CSV 文件的字节内容
            filename: 文件名（可选，用于日志和错误报告）
        
        Returns:
            CSVParseResult: 解析结果对象
        
        Raises:
            FileSizeExceededError: 文件超过大小限制
            CSVParseError: CSV 解析错误
        """
        # 1. 文件大小校验
        file_size = len(content)
        if file_size > self.max_file_size:
            logger.warning(
                f"File size {file_size} exceeds limit {self.max_file_size}",
                extra={"filename": filename}
            )
            raise FileSizeExceededError(file_size, self.max_file_size)
        
        # 2. 自动检测编码
        detected_encoding = self._detect_encoding(content)
        
        # 3. 解码内容
        try:
            decoded_content = content.decode(detected_encoding)
        except UnicodeDecodeError as e:
            raise CSVParseError(
                f"Failed to decode file with encoding {detected_encoding}: {e}",
                filename=filename
            )
        
        # 4. 解析 CSV
        return self._parse_csv_content(decoded_content, detected_encoding, filename)
    
    def _detect_encoding(self, content: bytes) -> str:
        """
        检测文件编码
        
        优先使用 chardet 库进行精确检测，如果不可用则按优先级尝试
        常见的 UTF-8、UTF-8-BOM、GBK 等编码。
        
        Args:
            content: 原始字节内容
        
        Returns:
            str: 检测到的编码名称
        """
        if self.encoding:
            return self.encoding
        
        if CHARDET_AVAILABLE:
            result = chardet.detect(content)
            if result and result.get('encoding'):
                return result['encoding'].lower()
        
        # 尝试顺序检测
        for encoding in self._supported_encodings:
            try:
                content[:4096].decode(encoding)
                logger.debug(f"Detected encoding: {encoding}")
                return encoding
            except (UnicodeDecodeError, UnicodeError):
                continue
        
        # 默认 UTF-8
        logger.warning("Could not detect encoding, defaulting to utf-8")
        return 'utf-8'
    
    def _parse_csv_content(
        self,
        content: str,
        encoding: str,
        filename: Optional[str] = None
    ) -> CSVParseResult:
        """
        解析 CSV 字符串内容
        
        Args:
            content: 已解码的 CSV 内容
            encoding: 使用的编码
            filename: 文件名
        
        Returns:
            CSVParseResult: 解析结果
        """
        result = CSVParseResult(
            success=True,
            encoding_used=encoding
        )
        
        # 使用 StringIO 转换为文件对象
        csv_file = io.StringIO(content)
        
        try:
            reader = csv.DictReader(csv_file)
            
            # 检查是否有 header
            if not reader.fieldnames:
                result.success = False
                result.errors.append("CSV file has no header row")
                return result
            
            # 标准化 header（去除空格、转小写）
            result.fieldnames = [self._normalize_field_name(f) for f in reader.fieldnames]
            
            # 验证必需字段
            missing_fields = self._validate_headers(result.fieldnames)
            if missing_fields:
                result.success = False
                for field in missing_fields:
                    result.errors.append(f"Missing required field: {field}")
                return result
            
            # 解析数据行
            for row_num, row in enumerate(reader, start=2):  # 从2开始（1是header）
                if self._is_empty_row(row):
                    if self.skip_empty_rows:
                        result.skipped_rows += 1
                        if result.skipped_rows <= 10:  # 只记录前10个空行
                            result.warnings.append(f"Row {row_num}: Empty row skipped")
                        continue
                
                # 标准化行数据
                normalized_row = self._normalize_row(row, row_num, result)
                
                if normalized_row:
                    result.data.append(normalized_row)
                    result.total_rows += 1
                
                # 流式处理限制：每1000行刷新一次
                if result.total_rows % 1000 == 0:
                    logger.debug(f"Parsed {result.total_rows} rows...")
            
            logger.info(
                f"CSV parsing completed: {result.total_rows} valid rows, "
                f"{result.skipped_rows} skipped, encoding={encoding}",
                extra={"filename": filename}
            )
            
        except csv.Error as e:
            result.success = False
            result.errors.append(f"CSV parsing error: {e}")
            logger.error(f"CSV parse error: {e}", extra={"filename": filename})
        except Exception as e:
            result.success = False
            result.errors.append(f"Unexpected error: {e}")
            logger.error(f"Unexpected error during CSV parse: {e}", extra={"filename": filename})
        finally:
            csv_file.close()
        
        return result
    
    def _normalize_field_name(self, field: str) -> str:
        """
        标准化字段名称
        
        - 去除首尾空格
        - 转为小写
        - 将空格替换为下划线
        
        Args:
            field: 原始字段名
        
        Returns:
            str: 标准化后的字段名
        """
        return field.strip().lower().replace(' ', '_')
    
    def _is_empty_row(self, row: Dict[str, str]) -> bool:
        """
        检查行是否为空
        
        Args:
            row: CSV 行数据
        
        Returns:
            bool: 如果所有非空字段都为空则返回 True
        """
        return all(
            value.strip() == '' 
            for value in row.values()
        )
    
    def _normalize_row(
        self,
        row: Dict[str, str],
        row_num: int,
        result: CSVParseResult
    ) -> Optional[Dict[str, Any]]:
        """
        标准化单行数据
        
        Args:
            row: 原始行数据
            row_num: 行号
            result: 解析结果（用于收集警告）
        
        Returns:
            Optional[Dict[str, Any]]: 标准化后的行数据，如果行为空则返回 None
        """
        normalized = {}
        
        for field, value in row.items():
            normalized_field = self._normalize_field_name(field)
            
            if normalized_field in ALL_FIELDS:
                normalized[normalized_field] = value.strip()
        
        # 检查字段长度
        for field, max_len in FIELD_MAX_LENGTH.items():
            if field in normalized and len(normalized[field]) > max_len:
                normalized[field] = normalized[field][:max_len]
                result.warnings.append(
                    f"Row {row_num}: Field '{field}' truncated to {max_len} chars"
                )
        
        return normalized if normalized else None
    
    def _validate_headers(self, fieldnames: List[str]) -> List[str]:
        """
        验证必需字段是否存在
        
        Args:
            fieldnames: 字段名列表
        
        Returns:
            List[str]: 缺失的必需字段列表
        """
        missing = []
        for required in REQUIRED_FIELDS:
            if required not in fieldnames:
                missing.append(required)
        return missing
    
    def parse_streaming(
        self,
        content: bytes,
        filename: Optional[str] = None,
        chunk_size: int = 1000
    ) -> Generator[List[Dict[str, Any]], None, None]:
        """
        流式解析 CSV（用于大文件）
        
        Args:
            content: CSV 文件字节内容
            filename: 文件名
            chunk_size: 每次返回的行数
        
        Yields:
            List[Dict[str, Any]]: 数据块
        """
        if len(content) > self.max_file_size:
            raise FileSizeExceededError(len(content), self.max_file_size)
        
        detected_encoding = self._detect_encoding(content)
        
        try:
            decoded_content = content.decode(detected_encoding)
            csv_file = io.StringIO(decoded_content)
            reader = csv.DictReader(csv_file)
            
            if not reader.fieldnames:
                return
            
            fieldnames = [self._normalize_field_name(f) for f in reader.fieldnames]
            
            chunk = []
            for row in reader:
                if not self._is_empty_row(row):
                    normalized = self._normalize_row(row, 0, None)
                    if normalized:
                        chunk.append(normalized)
                
                if len(chunk) >= chunk_size:
                    yield chunk
                    chunk = []
            
            if chunk:
                yield chunk
                
        finally:
            csv_file.close()
    
    def validate_row_data(
        self,
        row: Dict[str, Any],
        row_num: int
    ) -> List[Dict[str, Any]]:
        """
        验证单行数据的格式和约束
        
        Args:
            row: 行数据
            row_num: 行号
        
        Returns:
            List[Dict[str, Any]]: 错误列表，每个错误包含 field、value、error 信息
        """
        errors = []
        
        # 验证必填字段
        for field in REQUIRED_FIELDS:
            if field not in row or not row[field]:
                errors.append({
                    'row': row_num,
                    'field': field,
                    'value': row.get(field, ''),
                    'error': 'required field is empty'
                })
        
        # 验证 asset_type 枚举值
        valid_asset_types = ['EQUIPMENT', 'FURNITURE', 'VEHICLE', 'IT_HARDWARE', 'OTHER']
        if 'asset_type' in row and row['asset_type']:
            if row['asset_type'] not in valid_asset_types:
                errors.append({
                    'row': row_num,
                    'field': 'asset_type',
                    'value': row['asset_type'],
                    'error': f'invalid enum, expected one of {valid_asset_types}'
                })
        
        # 验证 status 枚举值
        valid_statuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']
        if 'status' in row and row['status']:
            if row['status'] not in valid_statuses:
                errors.append({
                    'row': row_num,
                    'field': 'status',
                    'value': row['status'],
                    'error': f'invalid enum, expected one of {valid_statuses}'
                })
        
        # 验证 currency 枚举值
        valid_currencies = ['CNY', 'USD', 'EUR', 'JPY', 'GBP']
        if 'currency' in row and row['currency']:
            if row['currency'] not in valid_currencies:
                errors.append({
                    'row': row_num,
                    'field': 'currency',
                    'value': row['currency'],
                    'error': f'invalid enum, expected one of {valid_currencies}'
                })
        
        # 验证日期格式 (YYYY-MM-DD)
        if 'purchase_date' in row and row['purchase_date']:
            if not self._validate_date_format(row['purchase_date']):
                errors.append({
                    'row': row_num,
                    'field': 'purchase_date',
                    'value': row['purchase_date'],
                    'error': 'must be in YYYY-MM-DD format'
                })
        
        # 验证价格格式
        if 'purchase_price' in row and row['purchase_price']:
            try:
                price = Decimal(row['purchase_price'])
                if price <= 0:
                    errors.append({
                        'row': row_num,
                        'field': 'purchase_price',
                        'value': row['purchase_price'],
                        'error': 'must be greater than 0'
                    })
                # 检查小数位数
                decimal_places = abs(price.as_tuple().exponent)
                if decimal_places > 2:
                    errors.append({
                        'row': row_num,
                        'field': 'purchase_price',
                        'value': row['purchase_price'],
                        'error': 'must have at most 2 decimal places'
                    })
            except InvalidOperation:
                errors.append({
                    'row': row_num,
                    'field': 'purchase_price',
                    'value': row['purchase_price'],
                    'error': 'must be numeric'
                })
        
        return errors
    
    def _validate_date_format(self, date_str: str) -> bool:
        """
        验证日期格式是否正确
        
        Args:
            date_str: 日期字符串
        
        Returns:
            bool: 是否为正确的 YYYY-MM-DD 格式
        """
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return True
        except ValueError:
            return False
    
    def generate_error_report(
        self,
        rows: List[Dict[str, Any]]
    ) -> str:
        """
        生成错误报告 CSV
        
        Args:
            rows: 包含错误信息的行数据列表
        
        Returns:
            str: CSV 格式的错误报告
        """
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=['row_number', 'error_field', 'error_detail', 'original_value']
        )
        writer.writeheader()
        
        for row_errors in rows:
            for error in row_errors.get('errors', []):
                writer.writerow({
                    'row_number': error.get('row', ''),
                    'error_field': error.get('field', ''),
                    'error_detail': error.get('error', ''),
                    'original_value': error.get('value', '')
                })
        
        return output.getvalue()