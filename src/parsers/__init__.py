"""
资产批量导入导出 - 解析器模块

提供 CSV 和 Excel 格式文件的解析能力，支持批量资产数据的导入与导出。

主要功能:
    - CSV 文件解析 (csv_parser)
    - Excel 文件解析 (excel_parser)
    - 基础解析器抽象基类 (base_parser)

支持的文件格式:
    - CSV (.csv): UTF-8、UTF-8-BOM、GBK 编码
    - Excel (.xlsx): 首个活动工作表

使用示例:
    >>> from src.parsers import CSVParser, ExcelParser
    >>> parser = CSVParser()
    >>> data = parser.parse('assets.csv')
"""

from src.parsers.base_parser import BaseParser
from src.parsers.csv_parser import CSVParser
from src.parsers.excel_parser import ExcelParser

__all__ = [
    "BaseParser",
    "CSVParser",
    "ExcelParser",
]