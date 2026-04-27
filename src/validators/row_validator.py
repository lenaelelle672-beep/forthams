from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal, InvalidOperation
import re


class RowValidationError:
    """单行校验错误详情"""
    
    def __init__(self, row_number: int, field: str, value: Any, reason: str, error_code: Optional[str] = None):
        """
        初始化行校验错误对象
        
        Args:
            row_number: 数据行号
            field: 字段名
            value: 实际值
            reason: 错误原因描述
            error_code: 错误代码（可选）
        """
        self.row_number = row_number
        self.field = field
        self.value = value
        self.reason = reason
        self.error_code = error_code or self._infer_error_code()
    
    def _infer_error_code(self) -> str:
        """根据错误原因推断错误代码"""
        if "required" in self.reason.lower():
            return "MISSING_REQUIRED_FIELD"
        elif "enum" in self.reason.lower():
            return "INVALID_ENUM_VALUE"
        elif "date" in self.reason.lower():
            return "INVALID_DATE_FORMAT"
        elif "price" in self.reason.lower() or "numeric" in self.reason.lower():
            return "INVALID_NUMERIC_VALUE"
        elif "length" in self.reason.lower() or "max" in self.reason.lower():
            return "FIELD_LENGTH_EXCEEDED"
        else:
            return "VALIDATION_ERROR"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "row_number": self.row_number,
            "field": self.field,
            "value": str(self.value) if self.value is not None else "",
            "reason": self.reason,
            "error_code": self.error_code
        }


class RowValidator:
    """
    资产导入数据行级校验器
    
    负责对单行资产数据进行完整校验，包括：
    - 必填字段检查
    - 枚举值校验
    - 日期格式校验
    - 数值格式校验
    - 字符串长度校验
    """
    
    # 资产类型枚举值
    ASSET_TYPES = ["EQUIPMENT", "FURNITURE", "VEHICLE", "IT_HARDWARE", "OTHER"]
    
    # 资产状态枚举值
    ASSET_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"]
    
    # 支持的币种
    CURRENCIES = ["CNY", "USD", "EUR", "GBP", "JPY"]
    
    # 字段长度限制
    FIELD_MAX_LENGTH = {
        "asset_name": 50,
        "serial_number": 100,
        "custodian": 100,
        "location": 200,
        "remarks": 500
    }
    
    # 必填字段列表
    REQUIRED_FIELDS = ["asset_name", "asset_type", "purchase_date", "purchase_price", "currency", "department", "status"]
    
    def __init__(self, valid_departments: Optional[List[str]] = None):
        """
        初始化行校验器
        
        Args:
            valid_departments: 有效的部门编码列表（可选）
        """
        self.valid_departments = valid_departments or []
    
    def validate_row(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """
        校验单行数据
        
        Args:
            row_data: 行数据字典
            row_number: 行号
            
        Returns:
            错误列表（空列表表示校验通过）
        """
        errors = []
        
        # 1. 必填字段检查
        errors.extend(self._check_required_fields(row_data, row_number))
        
        # 2. 枚举值校验
        errors.extend(self._check_enum_fields(row_data, row_number))
        
        # 3. 日期格式校验
        errors.extend(self._check_date_fields(row_data, row_number))
        
        # 4. 数值格式校验
        errors.extend(self._check_numeric_fields(row_data, row_number))
        
        # 5. 字符串长度校验
        errors.extend(self._check_field_lengths(row_data, row_number))
        
        # 6. 部门编码校验
        if self.valid_departments:
            errors.extend(self._check_department(row_data, row_number))
        
        return errors
    
    def _check_required_fields(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查必填字段"""
        errors = []
        for field in self.REQUIRED_FIELDS:
            value = row_data.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                errors.append(RowValidationError(
                    row_number=row_number,
                    field=field,
                    value=value,
                    reason=f"Required field '{field}' is missing or empty",
                    error_code="MISSING_REQUIRED_FIELD"
                ))
        return errors
    
    def _check_enum_fields(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查枚举字段"""
        errors = []
        
        # 资产类型检查
        asset_type = row_data.get("asset_type")
        if asset_type and asset_type not in self.ASSET_TYPES:
            errors.append(RowValidationError(
                row_number=row_number,
                field="asset_type",
                value=asset_type,
                reason=f"Invalid enum value for 'asset_type'. Expected one of: {', '.join(self.ASSET_TYPES)}",
                error_code="INVALID_ENUM_VALUE"
            ))
        
        # 资产状态检查
        status = row_data.get("status")
        if status and status not in self.ASSET_STATUSES:
            errors.append(RowValidationError(
                row_number=row_number,
                field="status",
                value=status,
                reason=f"Invalid enum value for 'status'. Expected one of: {', '.join(self.ASSET_STATUSES)}",
                error_code="INVALID_ENUM_VALUE"
            ))
        
        # 币种检查
        currency = row_data.get("currency")
        if currency and currency not in self.CURRENCIES:
            errors.append(RowValidationError(
                row_number=row_number,
                field="currency",
                value=currency,
                reason=f"Invalid enum value for 'currency'. Expected one of: {', '.join(self.CURRENCIES)}",
                error_code="INVALID_ENUM_VALUE"
            ))
        
        return errors
    
    def _check_date_fields(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查日期字段格式"""
        errors = []
        
        date_field = "purchase_date"
        date_value = row_data.get(date_field)
        
        if date_value:
            # 尝试解析 YYYY-MM-DD 格式
            if isinstance(date_value, str):
                try:
                    datetime.strptime(date_value.strip(), "%Y-%m-%d")
                except ValueError:
                    errors.append(RowValidationError(
                        row_number=row_number,
                        field=date_field,
                        value=date_value,
                        reason="Invalid date format. Expected YYYY-MM-DD",
                        error_code="INVALID_DATE_FORMAT"
                    ))
            elif not isinstance(date_value, datetime):
                errors.append(RowValidationError(
                    row_number=row_number,
                    field=date_field,
                    value=date_value,
                    reason="Invalid date format. Expected YYYY-MM-DD",
                    error_code="INVALID_DATE_FORMAT"
                ))
        
        return errors
    
    def _check_numeric_fields(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查数值字段"""
        errors = []
        
        price_field = "purchase_price"
        price_value = row_data.get(price_field)
        
        if price_value is not None:
            try:
                # 转换为 Decimal 进行精度检查
                if isinstance(price_value, str):
                    price_value = price_value.strip()
                
                price = Decimal(str(price_value))
                
                # 检查是否大于 0
                if price <= 0:
                    errors.append(RowValidationError(
                        row_number=row_number,
                        field=price_field,
                        value=price_value,
                        reason="Purchase price must be greater than 0",
                        error_code="INVALID_NUMERIC_VALUE"
                    ))
                
                # 检查小数位数
                decimal_places = abs(price.as_tuple().exponent)
                if decimal_places > 2:
                    errors.append(RowValidationError(
                        row_number=row_number,
                        field=price_field,
                        value=price_value,
                        reason="Purchase price can have at most 2 decimal places",
                        error_code="INVALID_NUMERIC_VALUE"
                    ))
                    
            except (InvalidOperation, ValueError, TypeError):
                errors.append(RowValidationError(
                    row_number=row_number,
                    field=price_field,
                    value=price_value,
                    reason="Purchase price must be a valid numeric value",
                    error_code="INVALID_NUMERIC_VALUE"
                ))
        
        return errors
    
    def _check_field_lengths(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查字段长度"""
        errors = []
        
        for field, max_length in self.FIELD_MAX_LENGTH.items():
            value = row_data.get(field)
            if value and isinstance(value, str):
                if len(value) > max_length:
                    errors.append(RowValidationError(
                        row_number=row_number,
                        field=field,
                        value=value,
                        reason=f"Field '{field}' exceeds maximum length of {max_length} characters",
                        error_code="FIELD_LENGTH_EXCEEDED"
                    ))
        
        return errors
    
    def _check_department(self, row_data: Dict[str, Any], row_number: int) -> List[RowValidationError]:
        """检查部门编码有效性"""
        errors = []
        
        department = row_data.get("department")
        if department and self.valid_departments:
            if department.strip() not in self.valid_departments:
                errors.append(RowValidationError(
                    row_number=row_number,
                    field="department",
                    value=department,
                    reason=f"Department code '{department}' does not match any existing department",
                    error_code="INVALID_DEPARTMENT_CODE"
                ))
        
        return errors
    
    def validate_rows(self, rows_data: List[Dict[str, Any]], start_row: int = 1) -> Dict[str, Any]:
        """
        批量校验多行数据
        
        Args:
            rows_data: 行数据列表
            start_row: 起始行号（默认1）
            
        Returns:
            校验结果字典，包含:
            - valid_rows: 有效行数据列表
            - errors: 所有错误列表
            - error_summary: 按行号分组的错误摘要
            - total_rows: 总行数
            - valid_count: 有效行数
            - error_count: 错误行数
        """
        all_errors = []
        valid_rows = []
        error_rows = set()
        
        for idx, row_data in enumerate(rows_data):
            row_number = start_row + idx
            row_errors = self.validate_row(row_data, row_number)
            
            if row_errors:
                all_errors.extend(row_errors)
                error_rows.add(row_number)
            else:
                valid_rows.append((row_number, row_data))
        
        # 按行号分组错误
        error_summary = {}
        for error in all_errors:
            if error.row_number not in error_summary:
                error_summary[error.row_number] = []
            error_summary[error.row_number].append(error.to_dict())
        
        return {
            "valid_rows": valid_rows,
            "errors": [e.to_dict() for e in all_errors],
            "error_summary": error_summary,
            "total_rows": len(rows_data),
            "valid_count": len(valid_rows),
            "error_count": len(error_rows)
        }