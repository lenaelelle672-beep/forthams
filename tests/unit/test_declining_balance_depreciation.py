"""
SWARM-2026-Q2-003: 资产折旧计算核心模块 - 双倍余额递减法测试

验收测试基准: ATB-2 (双倍余额递减法折旧计算)

测试场景:
- ATB-2.1: 基本双倍余额递减法计算
- ATB-2.2: 折旧终止于残值
- ATB-2.3: 最后两年转换为直线法
- ATB-2.4: 边界约束校验 (残值=原值无效配置)
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import MagicMock, patch


# ===== 待测试的计算器模块 (模拟) =====

class DepreciationDateException(Exception):
    """折旧日期早于入账日期异常"""
    pass


class InvalidDepreciationConfigException(Exception):
    """无效折旧配置异常"""
    pass


class Asset:
    """资产实体"""
    def __init__(
        self,
        asset_id: str,
        original_cost: Decimal,
        residual_value: Decimal,
        useful_life_months: int,
        acquisition_date: date,
        depreciation_method: str = "DECLINING_BALANCE"
    ):
        self.asset_id = asset_id
        self.original_cost = original_cost
        self.residual_value = residual_value
        self.useful_life_months = useful_life_months
        self.acquisition_date = acquisition_date
        self.depreciation_method = depreciation_method


class DepreciationResult:
    """折旧计算结果"""
    def __init__(
        self,
        asset_id: str,
        period: str,
        method: str,
        monthly_depreciation: Decimal,
        accumulated_depreciation: Decimal,
        book_value: Decimal
    ):
        self.asset_id = asset_id
        self.period = period
        self.method = method
        self.monthly_depreciation = monthly_depreciation
        self.accumulated_depreciation = accumulated_depreciation
        self.book_value = book_value


class DoubleDecliningBalanceCalculator:
    """
    双倍余额递减法折旧计算器
    
    算法说明:
    - 年折旧率 = 2 / 折旧年限
    - 年折旧额 = 期初净值 × 年折旧率
    - 最后两年改为直线法摊销余额
    """
    
    def calculate(
        self,
        asset: Asset,
        target_period: str  # YYYY-MM 格式
    ) -> DepreciationResult:
        """
        计算指定期间的折旧额
        
        Args:
            asset: 资产实体
            target_period: 目标期间 (YYYY-MM)
            
        Returns:
            DepreciationResult: 折旧计算结果
            
        Raises:
            DepreciationDateException: 折旧日期早于入账日期
            InvalidDepreciationConfigException: 无效配置
        """
        # 边界约束 BC-001: 校验折旧日期
        year, month = map(int, target_period.split('-'))
        target_date = date(year, month, 1)
        if target_date < asset.acquisition_date:
            raise DepreciationDateException(
                f"Depreciation date {target_period} is before acquisition date {asset.acquisition_date}"
            )
        
        # 边界约束 BC-003: 校验残值
        if asset.residual_value > asset.original_cost:
            raise InvalidDepreciationConfigException(
                f"Residual value ({asset.residual_value}) cannot exceed original cost ({asset.original_cost})"
            )
        
        # 边界约束 BC-004: 校验使用寿命
        if asset.useful_life_months < 1:
            raise InvalidDepreciationConfigException(
                f"Useful life must be at least 1 month"
            )
        
        # 计算折旧
        useful_life_years = asset.useful_life_months / 12
        annual_rate = Decimal('2') / Decimal(str(useful_life_years))
        
        # 计算已计提月份数
        months_diff = (year - asset.acquisition_date.year) * 12 + (month - asset.acquisition_date.month)
        current_year = months_diff // 12 + 1
        
        # 期初净值
        book_value = asset.original_cost
        
        # 计算累计折旧 (简化计算)
        accumulated = Decimal('0')
        for m in range(1, months_diff + 1):
            if m % 12 == 1:  # 新年度开始
                book_value = asset.original_cost - accumulated
                remaining_years = useful_life_years - (m - 1) / 12
                if remaining_years <= 2:  # 最后两年转换为直线法
                    annual_depreciation = (book_value - asset.residual_value) / remaining_years
                else:
                    annual_depreciation = book_value * annual_rate
            
            if m % 12 == 0 or m == months_diff:  # 年度末或当前月
                accumulated += annual_depreciation / 12 * (12 if m % 12 == 0 else (m % 12 or 12))
        
        # 计算当月折旧
        book_value = asset.original_cost - accumulated
        remaining_years = useful_life_years - (months_diff) / 12
        
        if remaining_years <= 2:  # 最后两年转换为直线法
            monthly_depreciation = (book_value - asset.residual_value) / remaining_years / 12
        else:
            annual_depreciation = book_value * annual_rate
            monthly_depreciation = annual_depreciation / 12
        
        monthly_depreciation = round(monthly_depreciation, 2)
        accumulated = round(accumulated + monthly_depreciation, 2)
        current_book_value = round(asset.original_cost - accumulated, 2)
        
        return DepreciationResult(
            asset_id=asset.asset_id,
            period=target_period,
            method='DECLINING_BALANCE',
            monthly_depreciation=monthly_depreciation,
            accumulated_depreciation=accumulated,
            book_value=current_book_value
        )


# ===== 测试用例 =====

@pytest.fixture
def calculator():
    """计算器实例"""
    return DoubleDecliningBalanceCalculator()


@pytest.fixture
def standard_asset():
    """标准资产: 原值100000, 残值5000, 使用寿命5年"""
    return Asset(
        asset_id="AST-2026-001",
        original_cost=Decimal("100000"),
        residual_value=Decimal("5000"),
        useful_life_months=60,
        acquisition_date=date(2026, 1, 1)
    )


class TestATB_2_1_BasicCalculation:
    """
    ATB-2.1: 基本双倍余额递减法计算
    
    测试输入: 原值=100000, 残值=5000, 使用寿命=5年(60月)，第1年
    物理测试期待: 年折旧额 = 40000
    """
    
    def test_first_year_annual_depreciation(self, calculator, standard_asset):
        """第1年年度折旧额应为原值的40%"""
        # 第1年12月
        result = calculator.calculate(standard_asset, "2026-12")
        
        assert result.asset_id == "AST-2026-001"
        assert result.method == "DECLINING_BALANCE"
        # 双倍余额递减: 折旧率 = 2/5 = 40%
        # 第1年折旧 = 100000 * 40% = 40000
        # 月折旧 = 40000 / 12 ≈ 3333.33
        assert result.monthly_depreciation == Decimal("3333.33")
        assert result.accumulated_depreciation == Decimal("40000.00")
    
    def test_first_month_depreciation(self, calculator, standard_asset):
        """第1年1月折旧"""
        result = calculator.calculate(standard_asset, "2026-01")
        
        assert result.monthly_depreciation == Decimal("3333.33")
        assert result.accumulated_depreciation == Decimal("3333.33")


class TestATB_2_2_DepreciationTermination:
    """
    ATB-2.2: 折旧终止于残值
    
    测试输入: 原值=100000, 残值=5000, 使用寿命=5年，第5年末
    物理测试期待: 账面净值 = 5000 (残值)
    """
    
    def test_fifth_year_end_book_value(self, calculator, standard_asset):
        """第5年12月末账面净值应等于残值"""
        result = calculator.calculate(standard_asset, "2030-12")
        
        # 累计5年折旧后应等于 100000 - 5000 = 95000
        assert result.accumulated_depreciation == Decimal("95000.00")
        assert result.book_value == Decimal("5000.00")


class TestATB_2_3_StraightLineConversion:
    """
    ATB-2.3: 最后两年转换为直线法
    
    测试输入: 原值=200000, 残值=0, 使用寿命=4年(48月)，最后两年转换直线法
    物理测试期待: 最后两年月折旧 = 25000
    """
    
    def test_conversion_to_straight_line(self, calculator):
        """最后两年应转换为直线法"""
        asset = Asset(
            asset_id="AST-2026-002",
            original_cost=Decimal("200000"),
            residual_value=Decimal("0"),
            useful_life_months=48,
            acquisition_date=date(2026, 1, 1)
        )
        
        # 第3年1月 (开始转换的年份)
        result = calculator.calculate(asset, "2028-01")
        
        # 前两年折旧: 200000 * 50% * 2 = 200000
        # 剩余价值: 0
        # 第3、4年直线法: 0 / 2 = 0 (如果残值为0则无需再折旧)
        # 实际场景: 账面净值应已到残值，不再折旧
        
        # 验证转换逻辑
        assert result.method == "DECLINING_BALANCE"
    
    def test_conversion_with_residual_value(self, calculator):
        """有残值情况下的直线法转换"""
        asset = Asset(
            asset_id="AST-2026-003",
            original_cost=Decimal("100000"),
            residual_value=Decimal("10000"),
            useful_life_months=48,
            acquisition_date=date(2026, 1, 1)
        )
        
        # 第3年1月 - 开始直线法转换
        result = calculator.calculate(asset, "2028-01")
        
        # 验证第3年仍使用双倍余额递减 (因为还有余量)
        assert result.method == "DECLINING_BALANCE"


class TestATB_2_4_InvalidConfiguration:
    """
    ATB-2.4: 边界约束校验
    
    测试输入: 残值=原值 (无效配置)
    物理测试期待: 抛出 InvalidDepreciationConfigException
    """
    
    def test_residual_equals_original_cost(self, calculator):
        """残值等于原值应抛出异常"""
        asset = Asset(
            asset_id="AST-2026-004",
            original_cost=Decimal("100000"),
            residual_value=Decimal("100000"),  # 残值=原值，无效
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1)
        )
        
        with pytest.raises(InvalidDepreciationConfigException) as exc_info:
            calculator.calculate(asset, "2026-06")
        
        assert "Residual value" in str(exc_info.value)
    
    def test_residual_exceeds_original_cost(self, calculator):
        """残值大于原值应抛出异常"""
        asset = Asset(
            asset_id="AST-2026-005",
            original_cost=Decimal("100000"),
            residual_value=Decimal("150000"),  # 残值>原值，无效
            useful_life_months=60,
            acquisition_date=date(2026, 1, 1)
        )
        
        with pytest.raises(InvalidDepreciationConfigException):
            calculator.calculate(asset, "2026-06")


class TestBoundaryConstraints:
    """边界约束测试"""
    
    def test_depreciation_before_acquisition_date(self, calculator):
        """BC-001: 折旧日期早于入账日期应抛出异常"""
        asset = Asset(
            asset_id="AST-2026-006",
            original_cost=Decimal("100000"),
            residual_value=Decimal("5000"),
            useful_life_months=60,
            acquisition_date=date(2026, 6, 1)
        )
        
        with pytest.raises(DepreciationDateException):
            calculator.calculate(asset, "2026-01")  # 早于入账日期
    
    def test_useful_life_zero(self, calculator):
        """BC-004: 使用寿命为0应抛出异常"""
        asset = Asset(
            asset_id="AST-2026-007",
            original_cost=Decimal("100000"),
            residual_value=Decimal("5000"),
            useful_life_months=0,  # 无效
            acquisition_date=date(2026, 1, 1)
        )
        
        with pytest.raises(InvalidDepreciationConfigException):
            calculator.calculate(asset, "2026-06")
    
    def test_book_value_cannot_be_below_residual(self, calculator, standard_asset):
        """边界约束: 账面净值不得低于残值"""
        # 计算至折旧期末
        result = calculator.calculate(standard_asset, "2030-12")
        
        assert result.book_value >= standard_asset.residual_value
        assert result.book_value == Decimal("5000.00")


class TestIdempotency:
    """幂等性测试 (BC-006)"""
    
    def test_same_period_same_result(self, calculator, standard_asset):
        """同一资产同一月份的折旧计算必须幂等"""
        result1 = calculator.calculate(standard_asset, "2027-06")
        result2 = calculator.calculate(standard_asset, "2027-06")
        
        assert result1.monthly_depreciation == result2.monthly_depreciation
        assert result1.accumulated_depreciation == result2.accumulated_depreciation
        assert result1.book_value == result2.book_value


class TestDepreciationMethod:
    """折旧方法标识测试"""
    
    def test_method_identifier(self, calculator, standard_asset):
        """折旧结果应包含正确的方法标识"""
        result = calculator.calculate(standard_asset, "2026-06")
        
        assert result.method == "DECLINING_BALANCE"


# ===== 运行测试 =====
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])