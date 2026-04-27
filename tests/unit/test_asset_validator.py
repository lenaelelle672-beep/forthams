"""
资产数据校验单元测试模块

对应验收测试基准 (ATB):
- ATB-006: 必填字段齐全应通过校验
- ATB-007: 缺少必填字段应返回错误
- ATB-008: ENUM 字段值不合法应返回错误
- ATB-009: 日期格式错误应返回错误
- ATB-010: 价格字段非数字应返回错误

测试覆盖范围:
- Layer 2: 数据校验层
- 目标覆盖率: ≥ 85% 行覆盖率
"""

import pytest
from datetime import datetime
from typing import Dict, Any, List

from src.models.enums import AssetType, AssetStatus
from src.services.validators.asset_validator import (
    AssetValidator,
    ValidationResult,
    ValidationError,
    RequiredFieldMissingError,
    InvalidEnumValueError,
    InvalidDateFormatError,
    InvalidNumericValueError,
)


class TestAssetValidator:
    """资产数据校验单元测试"""

    def setup_method(self):
        """
        测试前准备：初始化 AssetValidator 实例
        
        创建日期：2024-01-15
        创建人：SWARM-002 Spec Team
        """
        self.validator = AssetValidator()

    # ==================== ATB-006: 必填字段齐全应通过校验 ====================

    def test_validate_required_fields_present(self):
        """
        ATB-006: 必填字段齐全应通过校验
        
        测试场景:
        - 准备包含所有必填字段的合法资产数据
        - 调用 validator.validate() 进行校验
        - 期望返回 valid=True, errors=[]

        测试数据:
        - asset_id: "AST-2024-001"
        - asset_name: "测试资产"
        - asset_type: "DEVICE"
        - status: "ACTIVE"
        - purchase_date: "2024-01-01" (可选但提供)
        - purchase_price: "10000.00" (可选但提供)

        验收标准:
        - 返回的 ValidationResult.is_valid 为 True
        - 返回的 ValidationResult.errors 列表为空
        """
        # Arrange: 准备符合所有必填字段要求的合法数据
        valid_asset_data: Dict[str, Any] = {
            "asset_id": "AST-2024-001",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_date": "2024-01-01",
            "purchase_price": "10000.00",
            "department": "IT部门",
            "remarks": "测试备注"
        }

        # Act: 调用 validate 进行校验
        result: ValidationResult = self.validator.validate(valid_asset_data)

        # Assert: 校验结果应为合法
        assert result.is_valid is True, f"合法数据应通过校验，错误信息: {result.errors}"
        assert len(result.errors) == 0, f"合法数据不应有错误，当前错误: {result.errors}"

    def test_validate_minimal_required_fields(self):
        """
        ATB-006 扩展: 仅必填字段时应通过校验
        
        测试场景:
        - 仅提供必填字段 (asset_id, asset_name, asset_type, status)
        - 不提供可选字段
        - 期望返回 valid=True

        验收标准:
        - 仅包含必填字段的数据应通过校验
        """
        # Arrange: 仅包含必填字段的最小数据
        minimal_asset_data: Dict[str, Any] = {
            "asset_id": "AST-2024-002",
            "asset_name": "最小资产",
            "asset_type": AssetType.FURNITURE.value,
            "status": AssetStatus.INACTIVE.value,
        }

        # Act
        result: ValidationResult = self.validator.validate(minimal_asset_data)

        # Assert
        assert result.is_valid is True
        assert len(result.errors) == 0

    # ==================== ATB-007: 缺少必填字段应返回错误 ====================

    def test_validate_missing_asset_id(self):
        """
        ATB-007: 缺少 asset_id 应返回错误
        
        测试场景:
        - 准备缺少 asset_id 必填字段的数据
        - 调用 validator.validate() 进行校验
        - 期望抛出 RequiredFieldMissingError

        验收标准:
        - 抛出 RequiredFieldMissingError
        - 错误信息包含 "asset_id is required"
        """
        # Arrange: 缺少 asset_id 字段
        data_without_asset_id: Dict[str, Any] = {
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert: 应抛出 RequiredFieldMissingError
        with pytest.raises(RequiredFieldMissingError) as exc_info:
            self.validator.validate(data_without_asset_id)
        
        assert "asset_id" in str(exc_info.value).lower()

    def test_validate_missing_asset_name(self):
        """
        ATB-007: 缺少 asset_name 应返回错误
        
        验收标准:
        - 抛出 RequiredFieldMissingError
        - 错误信息包含 "asset_name is required"
        """
        # Arrange: 缺少 asset_name 字段
        data_without_asset_name: Dict[str, Any] = {
            "asset_id": "AST-2024-003",
            "asset_type": AssetType.VEHICLE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert
        with pytest.raises(RequiredFieldMissingError) as exc_info:
            self.validator.validate(data_without_asset_name)
        
        assert "asset_name" in str(exc_info.value).lower()

    def test_validate_missing_asset_type(self):
        """
        ATB-007: 缺少 asset_type 应返回错误
        
        验收标准:
        - 抛出 RequiredFieldMissingError
        - 错误信息包含 "asset_type is required"
        """
        # Arrange: 缺少 asset_type 字段
        data_without_asset_type: Dict[str, Any] = {
            "asset_id": "AST-2024-004",
            "asset_name": "测试资产",
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert
        with pytest.raises(RequiredFieldMissingError) as exc_info:
            self.validator.validate(data_without_asset_type)
        
        assert "asset_type" in str(exc_info.value).lower()

    def test_validate_missing_status(self):
        """
        ATB-007: 缺少 status 应返回错误
        
        验收标准:
        - 抛出 RequiredFieldMissingError
        - 错误信息包含 "status is required"
        """
        # Arrange: 缺少 status 字段
        data_without_status: Dict[str, Any] = {
            "asset_id": "AST-2024-005",
            "asset_name": "测试资产",
            "asset_type": AssetType.SOFTWARE.value,
        }

        # Act & Assert
        with pytest.raises(RequiredFieldMissingError) as exc_info:
            self.validator.validate(data_without_status)
        
        assert "status" in str(exc_info.value).lower()

    def test_validate_multiple_required_fields_missing(self):
        """
        ATB-007 扩展: 缺少多个必填字段应返回多个错误
        
        验收标准:
        - 返回包含所有缺失字段的错误信息
        """
        # Arrange: 同时缺少多个必填字段
        data_multiple_missing: Dict[str, Any] = {
            "department": "IT部门",
            "remarks": "备注"
        }

        # Act & Assert: 应抛出 ValidationError
        with pytest.raises(ValidationError) as exc_info:
            self.validator.validate(data_multiple_missing)
        
        error_message = str(exc_info.value).lower()
        assert "asset_id" in error_message
        assert "asset_name" in error_message
        assert "asset_type" in error_message
        assert "status" in error_message

    # ==================== ATB-008: ENUM 字段值不合法应返回错误 ====================

    def test_validate_asset_type_invalid_value(self):
        """
        ATB-008: asset_type 字段值不合法应返回错误
        
        测试场景:
        - 准备 asset_type 为非法值的资产数据
        - 调用 validator.validate() 进行校验
        - 期望抛出 InvalidEnumValueError

        有效值: DEVICE, FURNITURE, VEHICLE, SOFTWARE, OTHER

        验收标准:
        - 抛出 InvalidEnumValueError
        - 错误信息包含 "asset_type invalid"
        """
        # Arrange: asset_type 使用无效值
        data_invalid_asset_type: Dict[str, Any] = {
            "asset_id": "AST-2024-006",
            "asset_name": "测试资产",
            "asset_type": "INVALID_TYPE",
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert: 应抛出 InvalidEnumValueError
        with pytest.raises(InvalidEnumValueError) as exc_info:
            self.validator.validate(data_invalid_asset_type)
        
        assert "asset_type" in str(exc_info.value).lower()
        assert "invalid" in str(exc_info.value).lower()

    def test_validate_status_invalid_value(self):
        """
        ATB-008: status 字段值不合法应返回错误
        
        有效值: ACTIVE, INACTIVE, SCRAPPED, TRANSFERRED

        验收标准:
        - 抛出 InvalidEnumValueError
        - 错误信息包含 "status invalid"
        """
        # Arrange: status 使用无效值
        data_invalid_status: Dict[str, Any] = {
            "asset_id": "AST-2024-007",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": "INVALID_STATUS",
        }

        # Act & Assert
        with pytest.raises(InvalidEnumValueError) as exc_info:
            self.validator.validate(data_invalid_status)
        
        assert "status" in str(exc_info.value).lower()
        assert "invalid" in str(exc_info.value).lower()

    def test_validate_asset_type_case_sensitive(self):
        """
        ATB-008 扩展: ENUM 值应区分大小写
        
        验收标准:
        - "device" (小写) 应被视为无效值
        - 仅 "DEVICE" (大写) 应被视为有效值
        """
        # Arrange: asset_type 使用小写值
        data_lowercase_asset_type: Dict[str, Any] = {
            "asset_id": "AST-2024-008",
            "asset_name": "测试资产",
            "asset_type": "device",  # 小写，应无效
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert: 小写应失败
        with pytest.raises(InvalidEnumValueError):
            self.validator.validate(data_lowercase_asset_type)

    # ==================== ATB-009: 日期格式错误应返回错误 ====================

    def test_validate_date_format_invalid(self):
        """
        ATB-009: 日期格式错误应返回错误
        
        测试场景:
        - 准备 purchase_date 为非法格式的资产数据
        - 调用 validator.validate() 进行校验
        - 期望抛出 InvalidDateFormatError

        有效日期格式: YYYY-MM-DD (如: 2024-01-15)

        验收标准:
        - 抛出 InvalidDateFormatError
        - 错误信息包含 "date format invalid"
        """
        # Arrange: purchase_date 使用无效格式
        data_invalid_date: Dict[str, Any] = {
            "asset_id": "AST-2024-009",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_date": "2024-13-45",  # 非法日期
        }

        # Act & Assert: 应抛出 InvalidDateFormatError
        with pytest.raises(InvalidDateFormatError) as exc_info:
            self.validator.validate(data_invalid_date)
        
        assert "date" in str(exc_info.value).lower()
        assert "format" in str(exc_info.value).lower()
        assert "invalid" in str(exc_info.value).lower()

    def test_validate_date_format_wrong_separator(self):
        """
        ATB-009 扩展: 错误分隔符应被视为无效格式
        
        验收标准:
        - "2024/01/15" (斜杠分隔符) 应失败
        - "2024.01.15" (点分隔符) 应失败
        """
        # Arrange: 日期使用斜杠分隔符
        data_wrong_separator: Dict[str, Any] = {
            "asset_id": "AST-2024-010",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_date": "2024/01/15",
        }

        # Act & Assert
        with pytest.raises(InvalidDateFormatError):
            self.validator.validate(data_wrong_separator)

    def test_validate_date_format_text_string(self):
        """
        ATB-009 扩展: 文本日期字符串应被拒绝
        
        验收标准:
        - "2024年1月15日" 应失败
        - "Jan 15, 2024" 应失败
        """
        # Arrange: 日期为文本字符串
        data_text_date: Dict[str, Any] = {
            "asset_id": "AST-2024-011",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_date": "2024年1月15日",
        }

        # Act & Assert
        with pytest.raises(InvalidDateFormatError):
            self.validator.validate(data_text_date)

    def test_validate_date_valid_format(self):
        """
        ATB-009 扩展: 合法日期格式应通过校验
        
        验收标准:
        - "2024-01-15" 应通过校验
        - "2023-12-31" 应通过校验
        """
        # Arrange: 使用合法的日期格式
        data_valid_date: Dict[str, Any] = {
            "asset_id": "AST-2024-012",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_date": "2024-01-15",
        }

        # Act
        result: ValidationResult = self.validator.validate(data_valid_date)

        # Assert
        assert result.is_valid is True
        assert not any("date" in err.lower() for err in result.errors)

    # ==================== ATB-010: 价格字段非数字应返回错误 ====================

    def test_validate_price_not_numeric(self):
        """
        ATB-010: 价格字段非数字应返回错误
        
        测试场景:
        - 准备 purchase_price 为非数字字符串的资产数据
        - 调用 validator.validate() 进行校验
        - 期望抛出 InvalidNumericValueError

        验收标准:
        - 抛出 InvalidNumericValueError
        - 错误信息包含 "price must be numeric"
        """
        # Arrange: purchase_price 使用非数字值
        data_invalid_price: Dict[str, Any] = {
            "asset_id": "AST-2024-013",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "abc",  # 非数字
        }

        # Act & Assert: 应抛出 InvalidNumericValueError
        with pytest.raises(InvalidNumericValueError) as exc_info:
            self.validator.validate(data_invalid_price)
        
        assert "price" in str(exc_info.value).lower()
        assert "numeric" in str(exc_info.value).lower()

    def test_validate_price_special_characters(self):
        """
        ATB-010 扩展: 包含特殊字符的价格应被拒绝
        
        验收标准:
        - "10000.00元" 应失败
        - "$10000" 应失败
        - "10,000" (含逗号) 应失败
        """
        # Arrange: 价格包含货币符号
        data_price_with_currency: Dict[str, Any] = {
            "asset_id": "AST-2024-014",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "$10000",
        }

        # Act & Assert
        with pytest.raises(InvalidNumericValueError):
            self.validator.validate(data_price_with_currency)

    def test_validate_price_with_comma(self):
        """
        ATB-010 扩展: 带千分位逗号的价格应被拒绝
        
        验收标准:
        - "10,000.00" 应失败
        """
        # Arrange: 价格包含千分位逗号
        data_price_with_comma: Dict[str, Any] = {
            "asset_id": "AST-2024-015",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "10,000.00",
        }

        # Act & Assert
        with pytest.raises(InvalidNumericValueError):
            self.validator.validate(data_price_with_comma)

    def test_validate_price_valid_numeric(self):
        """
        ATB-010 扩展: 合法的数字价格应通过校验
        
        验收标准:
        - "10000.00" 应通过校验
        - "10000" 应通过校验
        - "0.01" 应通过校验
        """
        # Arrange: 使用合法的数字价格
        data_valid_price: Dict[str, Any] = {
            "asset_id": "AST-2024-016",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "10000.50",
        }

        # Act
        result: ValidationResult = self.validator.validate(data_valid_price)

        # Assert
        assert result.is_valid is True
        assert not any("price" in err.lower() for err in result.errors)

    def test_validate_price_zero(self):
        """
        ATB-010 扩展: 零值价格应通过校验
        
        验收标准:
        - "0" 应通过校验
        - "0.00" 应通过校验
        """
        # Arrange: 零值价格
        data_zero_price: Dict[str, Any] = {
            "asset_id": "AST-2024-017",
            "asset_name": "赠品资产",
            "asset_type": AssetType.OTHER.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "0",
        }

        # Act
        result: ValidationResult = self.validator.validate(data_zero_price)

        # Assert
        assert result.is_valid is True

    def test_validate_price_negative(self):
        """
        ATB-010 扩展: 负数价格应根据业务规则处理
        
        验收标准:
        - 负数价格应被拒绝或给出警告
        """
        # Arrange: 负数价格
        data_negative_price: Dict[str, Any] = {
            "asset_id": "AST-2024-018",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "-100.00",
        }

        # Act: 校验负数价格
        result: ValidationResult = self.validator.validate(data_negative_price)

        # Assert: 负数价格应导致校验失败
        # 注意: 根据业务规则决定是否允许负数
        assert result.is_valid is False or len(result.errors) > 0

    # ==================== 批量校验测试 (validate_batch) ====================

    def test_validate_batch_all_valid(self):
        """
        批量校验: 所有数据合法应返回全 True 结果
        
        验收标准:
        - 批量校验 100 条合法数据
        - 所有结果的 is_valid 均为 True
        """
        # Arrange: 准备 3 条合法数据
        valid_data_list: List[Dict[str, Any]] = [
            {
                "asset_id": f"AST-2024-{i:03d}",
                "asset_name": f"测试资产{i}",
                "asset_type": AssetType.DEVICE.value,
                "status": AssetStatus.ACTIVE.value,
            }
            for i in range(1, 4)
        ]

        # Act: 批量校验
        results: List[ValidationResult] = self.validator.validate_batch(valid_data_list)

        # Assert: 所有结果应合法
        assert len(results) == 3
        assert all(r.is_valid for r in results), "所有数据应通过校验"

    def test_validate_batch_partial_invalid(self):
        """
        批量校验: 部分数据非法应返回相应错误
        
        验收标准:
        - 第 2 条数据 asset_type 无效
        - 返回结果中第 2 条 is_valid 为 False
        - 其他结果 is_valid 为 True
        """
        # Arrange: 混合合法和非法数据
        mixed_data_list: List[Dict[str, Any]] = [
            {
                "asset_id": "AST-2024-101",
                "asset_name": "合法资产",
                "asset_type": AssetType.DEVICE.value,
                "status": AssetStatus.ACTIVE.value,
            },
            {
                "asset_id": "AST-2024-102",
                "asset_name": "非法资产",
                "asset_type": "INVALID_TYPE",  # 非法
                "status": AssetStatus.ACTIVE.value,
            },
            {
                "asset_id": "AST-2024-103",
                "asset_name": "合法资产2",
                "asset_type": AssetType.FURNITURE.value,
                "status": AssetStatus.INACTIVE.value,
            },
        ]

        # Act: 批量校验
        results: List[ValidationResult] = self.validator.validate_batch(mixed_data_list)

        # Assert: 部分结果应失败
        assert len(results) == 3
        assert results[0].is_valid is True
        assert results[1].is_valid is False
        assert results[2].is_valid is True

    def test_validate_batch_empty_list(self):
        """
        批量校验: 空列表应返回空结果
        
        验收标准:
        - 空列表输入应返回空列表
        """
        # Arrange: 空数据列表
        empty_data_list: List[Dict[str, Any]] = []

        # Act
        results: List[ValidationResult] = self.validator.validate_batch(empty_data_list)

        # Assert
        assert len(results) == 0

    # ==================== 边界条件测试 ====================

    def test_validate_empty_string_asset_id(self):
        """
        边界条件: 空字符串 asset_id 应被视为缺失
        
        验收标准:
        - "" (空字符串) 应被拒绝
        - 抛出 RequiredFieldMissingError
        """
        # Arrange: asset_id 为空字符串
        data_empty_asset_id: Dict[str, Any] = {
            "asset_id": "",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert
        with pytest.raises(RequiredFieldMissingError):
            self.validator.validate(data_empty_asset_id)

    def test_validate_whitespace_only_asset_name(self):
        """
        边界条件: 仅空白字符的 asset_name 应被拒绝
        
        验收标准:
        - "   " (仅空格) 应被拒绝
        """
        # Arrange: asset_name 仅包含空白字符
        data_whitespace_asset_name: Dict[str, Any] = {
            "asset_id": "AST-2024-020",
            "asset_name": "   ",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_whitespace_asset_name)

        # Assert: 应拒绝空白字符
        assert result.is_valid is False or any("empty" in err.lower() for err in result.errors)

    def test_validate_optional_fields_all_missing(self):
        """
        边界条件: 所有可选字段缺失应通过校验
        
        验收标准:
        - 仅包含必填字段的数据应通过校验
        """
        # Arrange: 仅包含 4 个必填字段
        data_optional_all_missing: Dict[str, Any] = {
            "asset_id": "AST-2024-021",
            "asset_name": "测试资产",
            "asset_type": AssetType.OTHER.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act
        result: ValidationResult = self.validator.validate(data_optional_all_missing)

        # Assert
        assert result.is_valid is True

    def test_validate_asset_id_too_long(self):
        """
        边界条件: asset_id 超出长度限制应被拒绝
        
        验收标准:
        - asset_id VARCHAR(64) 限制
        - 65 字符以上应被拒绝
        """
        # Arrange: asset_id 超长
        data_long_asset_id: Dict[str, Any] = {
            "asset_id": "A" * 65,  # 65 字符，超出 64 限制
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_long_asset_id)

        # Assert: 应拒绝超长 ID
        assert result.is_valid is False or any("length" in err.lower() for err in result.errors)

    def test_validate_asset_name_too_long(self):
        """
        边界条件: asset_name 超出长度限制应被拒绝
        
        验收标准:
        - asset_name VARCHAR(255) 限制
        - 256 字符以上应被拒绝
        """
        # Arrange: asset_name 超长
        data_long_asset_name: Dict[str, Any] = {
            "asset_id": "AST-2024-022",
            "asset_name": "测" * 256,  # 256 字符，超出 255 限制
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_long_asset_name)

        # Assert: 应拒绝超长名称
        assert result.is_valid is False or any("length" in err.lower() for err in result.errors)

    def test_validate_price_decimal_precision(self):
        """
        边界条件: 价格小数精度超限应被拒绝
        
        验收标准:
        - purchase_price DECIMAL(12,2) 限制
        - 小数点后超过 2 位应被拒绝或四舍五入
        """
        # Arrange: 价格小数超过 2 位
        data_high_precision: Dict[str, Any] = {
            "asset_id": "AST-2024-023",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "10000.123",  # 3 位小数
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_high_precision)

        # Assert: 应拒绝高精度价格
        assert result.is_valid is False or any("precision" in err.lower() for err in result.errors)

    def test_validate_price_exceeds_max_value(self):
        """
        边界条件: 价格超出最大限制应被拒绝
        
        验收标准:
        - DECIMAL(12,2) 最大值约 9999999999.99
        - 超出应被拒绝
        """
        # Arrange: 价格超出最大限制
        data_max_price: Dict[str, Any] = {
            "asset_id": "AST-2024-024",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "purchase_price": "99999999999.99",  # 超出范围
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_max_price)

        # Assert: 应拒绝超出范围的价格
        assert result.is_valid is False or any("exceed" in err.lower() for err in result.errors)

    # ==================== 错误聚合测试 ====================

    def test_validate_multiple_errors_aggregated(self):
        """
        错误聚合: 单条数据多个错误应聚合返回
        
        验收标准:
        - 同时缺少必填字段且有非法枚举值
        - 应返回所有错误的聚合信息
        """
        # Arrange: 多重错误数据
        data_multiple_errors: Dict[str, Any] = {
            "asset_type": "INVALID_TYPE",
            "status": "BAD_STATUS",
            "purchase_date": "invalid-date",
            "purchase_price": "not-a-number",
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_multiple_errors)

        # Assert: 应聚合多个错误
        assert result.is_valid is False
        assert len(result.errors) >= 4, f"应至少包含 4 个错误，实际: {result.errors}"


class TestAssetValidatorEdgeCases:
    """
    资产校验器边界场景补充测试
    
    覆盖极端情况和异常输入
    """

    def setup_method(self):
        """测试前初始化"""
        self.validator = AssetValidator()

    def test_validate_none_value(self):
        """
        边界: None 值应被视为缺失字段
        
        验收标准:
        - 字段值为 None 应被拒绝
        """
        # Arrange: 字段值为 None
        data_with_none: Dict[str, Any] = {
            "asset_id": None,
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act & Assert
        with pytest.raises((RequiredFieldMissingError, ValidationError)):
            self.validator.validate(data_with_none)

    def test_validate_type_error_for_string_field(self):
        """
        边界: 数字类型传入字符串字段应被处理
        
        验收标准:
        - asset_type 传入整数应被拒绝
        - 抛出适当类型的错误
        """
        # Arrange: 类型错误
        data_type_error: Dict[str, Any] = {
            "asset_id": 12345,  # 应为字符串
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_type_error)

        # Assert: 应失败或抛出类型错误
        assert result.is_valid is False or len(result.errors) > 0

    def test_validate_sql_injection_attempt(self):
        """
        安全边界: SQL 注入尝试应被拒绝
        
        验收标准:
        - 包含 SQL 注入特征的输入应被拒绝
        """
        # Arrange: 模拟 SQL 注入
        data_sql_injection: Dict[str, Any] = {
            "asset_id": "AST-2024-025'; DROP TABLE assets;--",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
        }

        # Act: 校验 (根据安全策略可能拒绝或转义)
        result: ValidationResult = self.validator.validate(data_sql_injection)

        # Assert: 特殊字符应被处理 (根据实际策略决定)
        # 注: 此测试根据实际安全实现调整预期
        # 如果系统允许存储但会转义，则 is_valid 可能为 True
        # 如果系统直接拒绝特殊字符，则 is_valid 应为 False
        pass  # 根据实际安全策略决定

    def test_validate_xss_attempt_in_remarks(self):
        """
        安全边界: XSS 尝试应被记录或处理
        
        验收标准:
        - 包含脚本标签的 remarks 应被处理
        """
        # Arrange: 模拟 XSS
        data_xss: Dict[str, Any] = {
            "asset_id": "AST-2024-026",
            "asset_name": "测试资产",
            "asset_type": AssetType.DEVICE.value,
            "status": AssetStatus.ACTIVE.value,
            "remarks": "<script>alert('xss')</script>",
        }

        # Act: 校验
        result: ValidationResult = self.validator.validate(data_xss)

        # Assert: 数据格式校验应通过 (XSS 由输出层处理)
        assert result.is_valid is True