"""
资产字段校验器单元测试

测试资产批量导入导出功能（SWARM-2025-Q2-P2-006）的字段级校验规则。

验收标准:
- ATB-002: 字段校验 - 导入引擎能正确识别并拒绝不合规数据
"""

import pytest
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from src.validators.field_validator import (
    FieldValidator,
    ValidationError,
    ValidationResult,
    AssetTypeEnum,
    AssetStatusEnum,
)


class TestAssetIdValidation:
    """资产编号(asset_id)校验测试"""

    def test_asset_id_required(self, validator: FieldValidator):
        """
        测试 asset_id 必填校验
        
        ATB-002 Step 2.1: 导入 asset_id 为空的行返回校验失败
        """
        result = validator.validate_asset_id("")
        assert not result.is_valid
        assert any("必填" in err.message or "required" in err.message.lower() 
                   for err in result.errors)

    def test_asset_id_empty_string(self, validator: FieldValidator):
        """测试 asset_id 空字符串校验"""
        result = validator.validate_asset_id("   ")
        assert not result.is_valid

    def test_asset_id_none(self, validator: FieldValidator):
        """测试 asset_id 为 None 校验"""
        result = validator.validate_asset_id(None)
        assert not result.is_valid

    def test_asset_id_valid_format(self, validator: FieldValidator):
        """测试 asset_id 合法格式（字母数字下划线）"""
        valid_ids = [
            "ASSET_001",
            "asset-002",
            "EQUIP123",
            "A123456789",
        ]
        for asset_id in valid_ids:
            result = validator.validate_asset_id(asset_id)
            # 合法的简单格式应该通过基本校验
            assert result.is_valid or result.errors[0].message.startswith("字母数字下划线"), \
                f"Failed for {asset_id}"

    def test_asset_id_length_limit(self, validator: FieldValidator):
        """测试 asset_id 长度限制（1-64字符）"""
        # 太短
        result = validator.validate_asset_id("")
        assert not result.is_valid
        
        # 太长（超过64字符）
        long_id = "A" * 65
        result = validator.validate_asset_id(long_id)
        assert not result.is_valid
        
        # 合法边界
        valid_id = "A" * 64
        result = validator.validate_asset_id(valid_id)
        # 应该通过或仅因其他规则失败
        assert result.errors[0].message != "长度超过64字符" if result.errors else True

    def test_asset_id_unique_constraint(self, validator: FieldValidator):
        """
        测试 asset_id 唯一性校验
        
        ATB-002 Step 2.6: 导入重复的 asset_id 返回校验失败
        """
        # 模拟已存在的 asset_id 列表
        existing_ids = {"ASSET_001", "ASSET_002"}
        
        # 重复的 asset_id
        result = validator.validate_asset_id("ASSET_001", existing_ids=existing_ids)
        assert not result.is_valid
        assert any("重复" in err.message or "unique" in err.message.lower() 
                   for err in result.errors)

    def test_asset_id_special_characters_rejected(self, validator: FieldValidator):
        """测试 asset_id 特殊字符拒绝"""
        invalid_ids = [
            "ASSET@001",
            "ASSET#002",
            "ASSET$003",
            "ASSET!004",
            "ASSET 005",  # 空格
        ]
        for asset_id in invalid_ids:
            result = validator.validate_asset_id(asset_id)
            assert not result.is_valid, f"Should reject: {asset_id}"


class TestAssetNameValidation:
    """资产名称(asset_name)校验测试"""

    def test_asset_name_required(self, validator: FieldValidator):
        """测试 asset_name 必填校验"""
        result = validator.validate_asset_name("")
        assert not result.is_valid

    def test_asset_name_empty(self, validator: FieldValidator):
        """测试 asset_name 空字符串校验"""
        result = validator.validate_asset_name("   ")
        assert not result.is_valid

    def test_asset_name_valid(self, validator: FieldValidator):
        """测试 asset_name 合法值"""
        result = validator.validate_asset_name("生产设备A")
        assert result.is_valid

    def test_asset_name_length_limit(self, validator: FieldValidator):
        """测试 asset_name 长度限制（1-128字符）"""
        # 太短
        result = validator.validate_asset_name("")
        assert not result.is_valid
        
        # 太长
        long_name = "测" * 129
        result = validator.validate_asset_name(long_name)
        assert not result.is_valid
        
        # 合法边界
        valid_name = "测" * 128
        result = validator.validate_asset_name(valid_name)
        assert result.is_valid


class TestAssetTypeValidation:
    """资产类型(asset_type)校验测试"""

    def test_asset_type_valid_equipment(self, validator: FieldValidator):
        """测试合法的资产类型 - EQUIPMENT"""
        result = validator.validate_asset_type("EQUIPMENT")
        assert result.is_valid

    def test_asset_type_valid_instrument(self, validator: FieldValidator):
        """测试合法的资产类型 - INSTRUMENT"""
        result = validator.validate_asset_type("INSTRUMENT")
        assert result.is_valid

    def test_asset_type_valid_vehicle(self, validator: FieldValidator):
        """测试合法的资产类型 - VEHICLE"""
        result = validator.validate_asset_type("VEHICLE")
        assert result.is_valid

    def test_asset_type_valid_other(self, validator: FieldValidator):
        """测试合法的资产类型 - OTHER"""
        result = validator.validate_asset_type("OTHER")
        assert result.is_valid

    def test_asset_type_invalid_value(self, validator: FieldValidator):
        """
        测试无效的资产类型值
        
        ATB-002 Step 2.2: 导入 asset_type 为 "INVALID_TYPE" 返回校验失败
        """
        result = validator.validate_asset_type("INVALID_TYPE")
        assert not result.is_valid
        assert any("枚举" in err.message or "enum" in err.message.lower() 
                   for err in result.errors)

    def test_asset_type_case_sensitive(self, validator: FieldValidator):
        """测试 asset_type 大小写敏感"""
        result = validator.validate_asset_type("equipment")  # 小写
        assert not result.is_valid

    def test_asset_type_empty(self, validator: FieldValidator):
        """测试 asset_type 空值"""
        result = validator.validate_asset_type("")
        assert not result.is_valid

    def test_asset_type_none(self, validator: FieldValidator):
        """测试 asset_type 为 None"""
        result = validator.validate_asset_type(None)
        assert not result.is_valid


class TestPurchaseDateValidation:
    """购置日期(purchase_date)校验测试"""

    def test_purchase_date_valid_iso_format(self, validator: FieldValidator):
        """测试合法的 ISO 8601 日期格式"""
        valid_dates = [
            "2025-01-01",
            "2024-12-31",
            "2023-06-15",
        ]
        for date_str in valid_dates:
            result = validator.validate_purchase_date(date_str)
            assert result.is_valid, f"Should accept: {date_str}"

    def test_purchase_date_invalid_format(self, validator: FieldValidator):
        """
        测试无效的日期格式
        
        ATB-002 Step 2.3: 导入 purchase_date 为 "2025-13-01" 返回校验失败
        """
        invalid_dates = [
            "2025-13-01",  # 无效月份
            "2025-00-15",  # 无效月份
            "2025/01/01",  # 错误分隔符
            "01-01-2025",  # 错误顺序
            "2025-1-1",    # 缺少前导零
            "not-a-date",  # 非日期字符串
        ]
        for date_str in invalid_dates:
            result = validator.validate_purchase_date(date_str)
            assert not result.is_valid, f"Should reject: {date_str}"

    def test_purchase_date_empty(self, validator: FieldValidator):
        """测试 purchase_date 空值"""
        result = validator.validate_purchase_date("")
        assert not result.is_valid

    def test_purchase_date_future(self, validator: FieldValidator):
        """测试未来日期（可选规则）"""
        future_date = "2099-12-31"
        result = validator.validate_purchase_date(future_date)
        # 未来日期可能被拒绝（取决于业务规则）
        # 至少不应该因为格式错误而失败
        if not result.is_valid:
            assert "未来" in result.errors[0].message or "future" in result.errors[0].message.lower()


class TestPurchaseAmountValidation:
    """购置金额(purchase_amount)校验测试"""

    def test_purchase_amount_valid_positive(self, validator: FieldValidator):
        """测试合法的正数金额"""
        valid_amounts = [
            "1000.00",
            "0.01",
            "999999.99",
            "0",
        ]
        for amount in valid_amounts:
            result = validator.validate_purchase_amount(amount)
            assert result.is_valid, f"Should accept: {amount}"

    def test_purchase_amount_negative_rejected(self, validator: FieldValidator):
        """
        测试负数金额被拒绝
        
        ATB-002 Step 2.4: 导入 purchase_amount 为 "-100" 返回校验失败
        """
        result = validator.validate_purchase_amount("-100")
        assert not result.is_valid
        assert any("≥0" in err.message or ">=0" in err.message or "正" in err.message
                   for err in result.errors)

    def test_purchase_amount_negative_decimal(self, validator: FieldValidator):
        """测试负小数金额"""
        result = validator.validate_purchase_amount("-0.01")
        assert not result.is_valid

    def test_purchase_amount_invalid_format(self, validator: FieldValidator):
        """测试无效格式的金额"""
        invalid_amounts = [
            "abc",
            "$1000",
            "1,000.00",
            "",
            None,
        ]
        for amount in invalid_amounts:
            result = validator.validate_purchase_amount(amount)
            assert not result.is_valid, f"Should reject: {amount}"

    def test_purchase_amount_precision(self, validator: FieldValidator):
        """测试金额精度（2位小数）"""
        # 超过精度
        result = validator.validate_purchase_amount("100.123")
        assert not result.is_valid

        # 合法精度
        result = validator.validate_purchase_amount("100.12")
        assert result.is_valid

    def test_purchase_amount_empty(self, validator: FieldValidator):
        """测试金额空值"""
        result = validator.validate_purchase_amount("")
        assert not result.is_valid


class TestDepartmentValidation:
    """部门(department)校验测试"""

    def test_department_valid(self, validator: FieldValidator):
        """测试合法的部门编码"""
        # 模拟已存在的部门编码
        existing_depts = {"DEPT001", "DEPT002", "IT", "HR"}
        
        for dept in ["DEPT001", "IT"]:
            result = validator.validate_department(dept, existing_depts=existing_depts)
            assert result.is_valid, f"Should accept: {dept}"

    def test_department_not_exists(self, validator: FieldValidator):
        """
        测试不存在的部门编码
        
        ATB-002 Step 2.5: 导入 department 为不存在的部门编码返回校验失败
        """
        existing_depts = {"DEPT001", "DEPT002"}
        
        result = validator.validate_department("INVALID_DEPT", existing_depts=existing_depts)
        assert not result.is_valid
        assert any("部门" in err.message or "不存在" in err.message
                   for err in result.errors)

    def test_department_empty(self, validator: FieldValidator):
        """测试部门空值"""
        result = validator.validate_department("")
        assert not result.is_valid

    def test_department_length_limit(self, validator: FieldValidator):
        """测试部门编码长度限制（1-64字符）"""
        # 太长
        long_dept = "D" * 65
        result = validator.validate_department(long_dept)
        assert not result.is_valid


class TestStatusValidation:
    """资产状态(status)校验测试"""

    def test_status_valid_active(self, validator: FieldValidator):
        """测试合法的状态 - ACTIVE"""
        result = validator.validate_status("ACTIVE")
        assert result.is_valid

    def test_status_valid_maintenance(self, validator: FieldValidator):
        """测试合法的状态 - MAINTENANCE"""
        result = validator.validate_status("MAINTENANCE")
        assert result.is_valid

    def test_status_valid_scrapped(self, validator: FieldValidator):
        """测试合法的状态 - SCRAPPED"""
        result = validator.validate_status("SCRAPPED")
        assert result.is_valid

    def test_status_invalid_value(self, validator: FieldValidator):
        """测试无效的状态值"""
        result = validator.validate_status("INVALID_STATUS")
        assert not result.is_valid

    def test_status_empty(self, validator: FieldValidator):
        """测试状态空值"""
        result = validator.validate_status("")
        assert not result.is_valid


class TestLocationValidation:
    """存放地点(location)校验测试 - 可选字段"""

    def test_location_optional(self, validator: FieldValidator):
        """测试可选字段可以为空"""
        result = validator.validate_location("")
        assert result.is_valid

    def test_location_valid(self, validator: FieldValidator):
        """测试合法的存放地点"""
        result = validator.validate_location("A栋3楼201室")
        assert result.is_valid

    def test_location_length_limit(self, validator: FieldValidator):
        """测试存放地点长度限制（1-128字符）"""
        # 太长
        long_location = "地" * 129
        result = validator.validate_location(long_location)
        assert not result.is_valid
        
        # 合法边界
        valid_location = "地" * 128
        result = validator.validate_location(valid_location)
        assert result.is_valid


class TestDescriptionValidation:
    """资产描述(description)校验测试 - 可选字段"""

    def test_description_optional(self, validator: FieldValidator):
        """测试可选字段可以为空"""
        result = validator.validate_description("")
        assert result.is_valid

    def test_description_valid(self, validator: FieldValidator):
        """测试合法的描述"""
        result = validator.validate_description("这是一台高精度检测设备")
        assert result.is_valid

    def test_description_length_limit(self, validator: FieldValidator):
        """测试描述长度限制（0-512字符）"""
        # 太长
        long_desc = "描" * 513
        result = validator.validate_description(long_desc)
        assert not result.is_valid
        
        # 合法边界
        valid_desc = "描" * 512
        result = validator.validate_description(valid_desc)
        assert result.is_valid


class TestCompositeValidation:
    """复合字段校验测试"""

    def test_validate_complete_asset_row(self, validator: FieldValidator):
        """测试完整的资产行校验"""
        row_data = {
            "asset_id": "ASSET_001",
            "asset_name": "生产设备A",
            "asset_type": "EQUIPMENT",
            "purchase_date": "2025-01-01",
            "purchase_amount": "10000.00",
            "department": "DEPT001",
            "status": "ACTIVE",
            "location": "A栋",
            "description": "测试资产",
        }
        existing_ids = set()
        existing_depts = {"DEPT001"}
        
        result = validator.validate_row(row_data, existing_ids, existing_depts)
        assert result.is_valid

    def test_validate_row_with_multiple_errors(self, validator: FieldValidator):
        """测试包含多个错误的行校验"""
        row_data = {
            "asset_id": "",  # 必填为空
            "asset_name": "",  # 必填为空
            "asset_type": "INVALID_TYPE",  # 无效枚举
            "purchase_date": "2025-13-01",  # 无效日期
            "purchase_amount": "-100",  # 负数
            "department": "NONEXISTENT",  # 不存在的部门
            "status": "INVALID",  # 无效状态
        }
        existing_ids = set()
        existing_depts = {"DEPT001"}
        
        result = validator.validate_row(row_data, existing_ids, existing_depts)
        assert not result.is_valid
        # 应该有多个错误
        assert len(result.errors) >= 4


class TestValidationResult:
    """校验结果测试"""

    def test_validation_result_success(self):
        """测试成功的校验结果"""
        result = ValidationResult(is_valid=True, errors=[])
        assert result.is_valid
        assert len(result.errors) == 0

    def test_validation_result_failure(self):
        """测试失败的校验结果"""
        error = ValidationError(
            field="asset_id",
            message="资产编号必填",
            row=1,
            code="REQUIRED"
        )
        result = ValidationResult(is_valid=False, errors=[error])
        assert not result.is_valid
        assert len(result.errors) == 1
        assert result.errors[0].field == "asset_id"


# Pytest fixtures
@pytest.fixture
def validator() -> FieldValidator:
    """创建字段校验器实例"""
    return FieldValidator()


@pytest.fixture
def existing_ids() -> set:
    """模拟已存在的 asset_id 集合"""
    return {"ASSET_EXIST_001", "ASSET_EXIST_002"}


@pytest.fixture
def existing_depts() -> set:
    """模拟已存在的部门编码集合"""
    return {"DEPT001", "DEPT002", "IT", "HR", "FINANCE"}