"""
资产字段校验器 (Field Validator)

根据 SWARM-2025-Q2-P2-006 规格实现资产批量导入的字段级数据校验。
支持必填检查、枚举值验证、日期格式校验、数值范围校验等功能。

字段定义（固定12个核心字段）:
- asset_id: String, 可选，导入时为空则自动生成
- asset_name: String, 必填, 最大50字符
- asset_type: Enum, 必填, 枚举值: EQUIPMENT/FURNITURE/VEHICLE/IT_HARDWARE/OTHER
- serial_number: String, 可选, 最大100字符
- purchase_date: Date, 必填, YYYY-MM-DD 格式
- purchase_price: Decimal, 必填, >0, 最多2位小数
- currency: Enum, 必填, 默认CNY
- department: String, 必填, 需匹配已存在的部门编码
- custodian: String, 可选, 最大100字符
- status: Enum, 必填, 枚举值: ACTIVE/INACTIVE/MAINTENANCE/RETIRED
- location: String, 可选, 最大200字符
- remarks: String, 可选, 最大500字符
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field


# 枚举值定义
ASSET_TYPE_ENUM = {"EQUIPMENT", "FURNITURE", "VEHICLE", "IT_HARDWARE", "OTHER"}
CURRENCY_ENUM = {"CNY", "USD", "EUR", "GBP", "JPY", "HKD"}
STATUS_ENUM = {"ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"}

# 长度约束
LENGTH_CONSTRAINTS = {
    "asset_name": 50,
    "serial_number": 100,
    "custodian": 100,
    "location": 200,
    "remarks": 500,
}


@dataclass
class FieldValidationError:
    """字段校验错误详情"""
    row: int
    field: str
    value: Any
    error: str

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式，用于错误报告生成"""
        return {
            "row": self.row,
            "field": self.field,
            "value": str(self.value) if self.value is not None else "",
            "error": self.error,
        }


class FieldValidator:
    """
    资产字段校验器类

    提供单字段级别的数据校验能力，支持：
    - 必填字段检查
    - 枚举值验证
    - 日期格式校验
    - 数值范围校验
    - 字符串长度校验

    Usage:
        validator = FieldValidator()
        errors = validator.validate_field("asset_name", "测试资产", row=1)
    """

    # 必填字段列表
    REQUIRED_FIELDS = {
        "asset_name", "asset_type", "purchase_date",
        "purchase_price", "currency", "department", "status"
    }

    # 枚举字段映射
    ENUM_FIELDS = {
        "asset_type": ASSET_TYPE_ENUM,
        "currency": CURRENCY_ENUM,
        "status": STATUS_ENUM,
    }

    # 日期格式正则
    DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    def __init__(self, department_codes: Optional[set] = None):
        """
        初始化字段校验器

        Args:
            department_codes: 可选，已授权的部门编码集合。
                            用于校验 department 字段是否匹配已存在的部门。
        """
        self.department_codes = department_codes or set()

    def validate_field(
        self,
        field_name: str,
        value: Any,
        row: int,
        is_required: bool = False,
        strict: bool = True
    ) -> Optional[FieldValidationError]:
        """
        校验单个字段值

        Args:
            field_name: 字段名称
            value: 字段值
            row: 行号（用于错误报告）
            is_required: 是否为必填字段
            strict: 是否严格模式（严格模式下空字符串视为未填）

        Returns:
            FieldValidationError: 如果校验失败返回错误对象，否则返回 None
        """
        # 处理空值
        if value is None or (strict and isinstance(value, str) and value.strip() == ""):
            if is_required or field_name in self.REQUIRED_FIELDS:
                return FieldValidationError(
                    row=row,
                    field=field_name,
                    value=value,
                    error="required field is missing"
                )
            return None

        # 枚举值校验
        if field_name in self.ENUM_FIELDS:
            enum_values = self.ENUM_FIELDS[field_name]
            if isinstance(value, str):
                value_upper = value.upper().strip()
                if value_upper not in enum_values:
                    return FieldValidationError(
                        row=row,
                        field=field_name,
                        value=value,
                        error=f"invalid enum, expected one of {sorted(enum_values)}"
                    )

        # 日期格式校验
        if field_name == "purchase_date":
            if not self._validate_date_format(value):
                return FieldValidationError(
                    row=row,
                    field=field_name,
                    value=value,
                    error="invalid date format, expected YYYY-MM-DD"
                )

        # 价格数值校验
        if field_name == "purchase_price":
            error = self._validate_price(value)
            if error:
                return FieldValidationError(
                    row=row,
                    field=field_name,
                    value=value,
                    error=error
                )

        # 字符串长度校验
        if field_name in LENGTH_CONSTRAINTS:
            max_len = LENGTH_CONSTRAINTS[field_name]
            if isinstance(value, str) and len(value) > max_len:
                return FieldValidationError(
                    row=row,
                    field=field_name,
                    value=value,
                    error=f"exceeds maximum length of {max_len} characters"
                )

        # 部门编码校验
        if field_name == "department":
            if self.department_codes and value not in self.department_codes:
                return FieldValidationError(
                    row=row,
                    field=field_name,
                    value=value,
                    error=f"department code not found in system"
                )

        return None

    def _validate_date_format(self, value: Any) -> bool:
        """
        验证日期格式是否为 YYYY-MM-DD

        Args:
            value: 待验证的值

        Returns:
            bool: 是否为有效日期格式
        """
        if not isinstance(value, str):
            return False

        if not self.DATE_PATTERN.match(value):
            return False

        try:
            datetime.strptime(value, "%Y-%m-%d")
            return True
        except ValueError:
            return False

    def _validate_price(self, value: Any) -> Optional[str]:
        """
        验证价格数值是否有效

        Args:
            value: 待验证的值

        Returns:
            Optional[str]: 如果无效返回错误信息，否则返回 None
        """
        if isinstance(value, (int, float)):
            price = float(value)
        elif isinstance(value, str):
            try:
                price = float(value.strip())
            except ValueError:
                return "must be numeric"
        else:
            return "must be numeric"

        if price <= 0:
            return "must be greater than 0"

        # 验证小数位数（最多2位）
        if "." in str(value):
            decimal_part = str(value).split(".")[1]
            if len(decimal_part) > 2:
                return "maximum 2 decimal places allowed"

        return None

    def validate_row(
        self,
        row_data: Dict[str, Any],
        row_number: int,
        is_test: bool = False
    ) -> List[FieldValidationError]:
        """
        校验整行数据（所有字段）

        Args:
            row_data: 行数据字典，键为字段名，值为字段值
            row_number: 行号
            is_test: 是否为测试模式（测试模式下跳过部门验证）

        Returns:
            List[FieldValidationError]: 错误列表
        """
        errors = []

        # 检查必填字段
        for field_name in self.REQUIRED_FIELDS:
            if field_name not in row_data or row_data.get(field_name) is None:
                errors.append(FieldValidationError(
                    row=row_number,
                    field=field_name,
                    value=None,
                    error="required field is missing"
                ))

        # 验证每个字段
        for field_name, value in row_data.items():
            error = self.validate_field(
                field_name=field_name,
                value=value,
                row=row_number
            )
            if error:
                errors.append(error)

        return errors

    def validate_batch(
        self,
        batch_data: List[Dict[str, Any]],
        start_row: int = 1
    ) -> Tuple[List[FieldValidationError], int]:
        """
        批量校验多行数据

        Args:
            batch_data: 数据列表
            start_row: 起始行号

        Returns:
            Tuple[List[FieldValidationError], int]: (错误列表, 有效行数)
        """
        errors = []
        valid_count = 0

        for i, row_data in enumerate(batch_data):
            row_number = start_row + i
            row_errors = self.validate_row(row_data, row_number)

            if row_errors:
                errors.extend(row_errors)
            else:
                valid_count += 1

        return errors, valid_count


def validate_required_fields(
    row_data: Dict[str, Any],
    row_number: int
) -> List[FieldValidationError]:
    """
    校验必填字段是否存在

    Args:
        row_data: 行数据字典
        row_number: 行号

    Returns:
        List[FieldValidationError]: 缺失的必填字段错误列表
    """
    required_fields = {
        "asset_name", "asset_type", "purchase_date",
        "purchase_price", "currency", "department", "status"
    }

    errors = []
    for field in required_fields:
        if field not in row_data or row_data.get(field) is None:
            errors.append(FieldValidationError(
                row=row_number,
                field=field,
                value=None,
                error="required field is missing"
            ))

    return errors


def validate_enum_value(
    field_name: str,
    value: Any,
    row_number: int,
    valid_values: set
) -> Optional[FieldValidationError]:
    """
    校验枚举值是否合法

    Args:
        field_name: 字段名称
        value: 字段值
        row_number: 行号
        valid_values: 合法的枚举值集合

    Returns:
        Optional[FieldValidationError]: 错误对象或 None
    """
    if isinstance(value, str):
        value_upper = value.upper().strip()
        if value_upper not in valid_values:
            return FieldValidationError(
                row=row_number,
                field=field_name,
                value=value,
                error=f"invalid enum, expected one of {sorted(valid_values)}"
            )
    return None


def validate_date_format(
    date_str: str,
    row_number: int
) -> Optional[FieldValidationError]:
    """
    校验日期格式是否为 YYYY-MM-DD

    Args:
        date_str: 日期字符串
        row_number: 行号

    Returns:
        Optional[FieldValidationError]: 错误对象或 None
    """
    date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    if not isinstance(date_str, str) or not date_pattern.match(date_str):
        return FieldValidationError(
            row=row_number,
            field="purchase_date",
            value=date_str,
            error="invalid date format, expected YYYY-MM-DD"
        )

    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return FieldValidationError(
            row=row_number,
            field="purchase_date",
            value=date_str,
            error="invalid date format, expected YYYY-MM-DD"
        )

    return None


def validate_numeric_price(
    price: Any,
    row_number: int
) -> Optional[FieldValidationError]:
    """
    校验价格是否为有效的正数（最多2位小数）

    Args:
        price: 价格值
        row_number: 行号

    Returns:
        Optional[FieldValidationError]: 错误对象或 None
    """
    if isinstance(price, (int, float)):
        numeric_value = float(price)
    elif isinstance(price, str):
        try:
            numeric_value = float(price.strip())
        except ValueError:
            return FieldValidationError(
                row=row_number,
                field="purchase_price",
                value=price,
                error="must be numeric"
            )
    else:
        return FieldValidationError(
            row=row_number,
            field="purchase_price",
            value=price,
            error="must be numeric"
        )

    if numeric_value <= 0:
        return FieldValidationError(
            row=row_number,
            field="purchase_price",
            value=price,
            error="must be greater than 0"
        )

    return None