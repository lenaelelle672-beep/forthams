# -*- coding: utf-8 -*-
"""
资产批量导入导出模块 - 数据校验层

本模块提供资产批量导入时的字段级和行级数据校验能力：
- 单字段校验器（必填、枚举、格式校验）
- 行级校验器（整行数据校验与错误收集）
- 校验错误报告生成

支持的导入格式：
- CSV (.csv)
- Excel (.xlsx)

字段校验规格（12个核心字段）：
- asset_id        (String, 可选，导入时为空则自动生成)
- asset_name      (String, 必填, 最大50字符)
- asset_type      (Enum, 必填, 枚举值: EQUIPMENT/FURNITURE/VEHICLE/IT_HARDWARE/OTHER)
- serial_number   (String, 可选, 最大100字符)
- purchase_date   (Date, 必填, YYYY-MM-DD 格式)
- purchase_price  (Decimal, 必填, >0, 最多2位小数)
- currency        (Enum, 必填, 默认CNY)
- department      (String, 必填, 需匹配已存在的部门编码)
- custodian       (String, 可选, 最大100字符)
- status          (Enum, 必填, 枚举值: ACTIVE/INACTIVE/MAINTENANCE/RETIRED)
- location        (String, 可选, 最大200字符)
- remarks         (String, 可选, 最大500字符)

技术约束：
- 单次导入上限: 5000 条记录
- 文件大小上限: 10 MB

使用示例：
    >>> from src.validators import FieldValidator, RowValidator
    >>> field_validator = FieldValidator()
    >>> row_validator = RowValidator(field_validator)
    >>> errors = row_validator.validate_row(data, row_number=1)
    >>> if errors:
    ...     print(f"Row {errors[0]['row']}: {errors[0]['errors']}")

版本: v1.0
制定日期: 2025-Q2-Sprint-2
所属规格: SWARM-2025-Q2-P2-006
"""

from typing import List, Dict, Any, Optional

# 导出单字段校验器
from src.validators.field_validator import (
    FieldValidator,
    ValidationError,
    ValidationResult,
    REQUIRED_FIELDS,
    OPTIONAL_FIELDS,
    ENUM_VALUES,
)

# 导出行级校验器
from src.validators.row_validator import (
    RowValidator,
    RowValidationResult,
    ValidationErrorDetail,
)

# 定义模块公开 API
__all__ = [
    # 字段校验器
    "FieldValidator",
    "ValidationError",
    "ValidationResult",
    "RowValidator",
    "RowValidationResult",
    "ValidationErrorDetail",
    # 常量
    "REQUIRED_FIELDS",
    "OPTIONAL_FIELDS",
    "ENUM_VALUES",
    # 枚举值定义
    "AssetTypeEnum",
    "CurrencyEnum",
    "AssetStatusEnum",
]

# 枚举值定义（供外部导入使用）
class AssetTypeEnum:
    """资产类型枚举"""
    EQUIPMENT = "EQUIPMENT"
    FURNITURE = "FURNITURE"
    VEHICLE = "VEHICLE"
    IT_HARDWARE = "IT_HARDWARE"
    OTHER = "OTHER"
    
    @classmethod
    def values(cls) -> List[str]:
        return [cls.EQUIPMENT, cls.FURNITURE, cls.VEHICLE, cls.IT_HARDWARE, cls.OTHER]


class CurrencyEnum:
    """币种枚举"""
    CNY = "CNY"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    
    @classmethod
    def values(cls) -> List[str]:
        return [cls.CNY, cls.USD, cls.EUR, cls.GBP, cls.JPY]
    
    @classmethod
    def default(cls) -> str:
        return cls.CNY


class AssetStatusEnum:
    """资产状态枚举"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"
    
    @classmethod
    def values(cls) -> List[str]:
        return [cls.ACTIVE, cls.INACTIVE, cls.MAINTENANCE, cls.RETIRED]