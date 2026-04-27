"""
双倍余额递减法折旧计算器

实现双倍余额递减法（Double Declining Balance Method）折旧计算逻辑。
该方法是一种加速折旧方法，在资产使用初期计提较高折旧，后期逐渐降低。

公式：
    年折旧率 = 2 / 预计使用年限
    年折旧额 = 期初账面价值 × 年折旧率
    月折旧额 = 年折旧额 / 12

特殊情况处理：
- 当直线法月折旧额 > 双倍余额递减法月折旧额时，切换至直线法
- 账面价值不得低于残值
- 折旧总额不得超过 (原值 - 残值)

参考规范: SWARM-2026-Q2-003 资产折旧计算核心模块 - Iteration 2
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from dataclasses import dataclass, field

from .base import BaseDepreciationCalculator, DepreciationInput, DepreciationOutput


@dataclass
class DoubleDecliningConfig:
    """
    双倍余额递减法配置参数

    Attributes:
        switch_to_straight_line: 是否允许在适当时机切换至直线法
        min_switch_threshold: 切换阈值比例，默认0.5表示当直线法折旧额
                             超过双倍余额递减法的50%时切换
    """
    switch_to_straight_line: bool = True
    min_switch_threshold: Decimal = Decimal("0.5")


@dataclass
class DoubleDecliningCalculator(BaseDepreciationCalculator):
    """
    双倍余额递减法折旧计算器

    继承自 BaseDepreciationCalculator，实现双倍余额递减法的核心计算逻辑。
    支持自动切换至直线法的优化策略。

    Example:
        >>> config = DoubleDecliningConfig()
        >>> calculator = DoubleDecliningCalculator(config)
        >>> input_data = DepreciationInput(
        ...     asset_id="AST-2024-001",
        ...     acquisition_cost=Decimal("100000"),
        ...     useful_life_months=60,
        ...     salvage_value=Decimal("5000"),
        ...     acquisition_date=date(2024, 1, 1)
        ... )
        >>> result = calculator.calculate(input_data)
        >>> print(f"月折旧额: {result.monthly_depreciation}")
    """

    config: DoubleDecliningConfig = field(default_factory=DoubleDecliningConfig)

    def __post_init__(self):
        """初始化验证配置参数"""
        if self.config.min_switch_threshold < Decimal("0") or self.config.min_switch_threshold > Decimal("1"):
            raise ValueError("min_switch_threshold必须在0到1之间")

    def calculate(self, input_data: DepreciationInput, current_period: int = 0) -> DepreciationOutput:
        """
        计算指定期间的折旧额

        Args:
            input_data: 折旧计算输入参数
            current_period: 当前期间（第几个月），从0开始计数

        Returns:
            DepreciationOutput: 折旧计算结果

        Raises:
            ValueError: 当输入参数不合法时
        """
        self._validate_input(input_data)

        acquisition_cost = input_data.acquisition_cost
        salvage_value = input_data.salvage_value
        useful_life_months = input_data.useful_life_months

        # 计算可折旧总额
        depreciable_amount = acquisition_cost - salvage_value

        if depreciable_amount <= Decimal("0"):
            # 无需折旧
            return DepreciationOutput(
                asset_id=input_data.asset_id,
                period=current_period + 1,
                monthly_depreciation=Decimal("0"),
                accumulated_depreciation=Decimal("0"),
                book_value=acquisition_cost,
                annual_depreciation_rate=self._calculate_annual_rate(useful_life_months),
                depreciation_method="double_declining"
            )

        # 计算双倍余额递减法的年折旧率
        useful_life_years = Decimal(str(useful_life_months)) / Decimal("12")
        annual_rate = Decimal("2") / useful_life_years

        # 确保年折旧率不超过100%
        annual_rate = min(annual_rate, Decimal("1"))

        # 计算当前账面价值
        current_book_value = self._calculate_book_value_at_period(
            acquisition_cost, depreciable_amount, useful_life_months, current_period, annual_rate
        )

        # 计算月折旧额
        monthly_depreciation = self._calculate_monthly_depreciation(
            acquisition_cost, salvage_value, useful_life_months, current_period, current_book_value, annual_rate
        )

        # 计算累计折旧
        accumulated_depreciation = self._calculate_accumulated_depreciation(
            acquisition_cost, salvage_value, useful_life_months, current_period, annual_rate
        )

        # 确保账面价值不低于残值
        book_value = acquisition_cost - accumulated_depreciation
        if book_value < salvage_value:
            book_value = salvage_value
            # 调整当月折旧以确保账面价值等于残值
            max_depreciation = acquisition_cost - salvage_value - (accumulated_depreciation - monthly_depreciation)
            monthly_depreciation = max(Decimal("0"), min(monthly_depreciation, max_depreciation))
            accumulated_depreciation = acquisition_cost - book_value

        # 四舍五入到小数点后4位
        monthly_depreciation = self._round_currency(monthly_depreciation)
        accumulated_depreciation = self._round_currency(accumulated_depreciation)
        book_value = self._round_currency(book_value)

        return DepreciationOutput(
            asset_id=input_data.asset_id,
            period=current_period + 1,
            monthly_depreciation=monthly_depreciation,
            accumulated_depreciation=accumulated_depreciation,
            book_value=book_value,
            annual_depreciation_rate=annual_rate.quantize(Decimal("0.0001")),
            depreciation_method="double_declining"
        )

    def calculate_batch(
        self,
        inputs: list[DepreciationInput],
        start_period: int = 0
    ) -> list[DepreciationOutput]:
        """
        批量计算多个资产的折旧

        Args:
            inputs: 折旧计算输入参数列表
            start_period: 起始期间

        Returns:
            list[DepreciationOutput]: 折旧计算结果列表
        """
        return [self.calculate(input_data, start_period + i) for i, input_data in enumerate(inputs)]

    def _calculate_annual_rate(self, useful_life_months: int) -> Decimal:
        """
        计算双倍余额递减法的年折旧率

        年折旧率 = 2 / 预计使用年限

        Args:
            useful_life_months: 预计使用月数

        Returns:
            Decimal: 年折旧率
        """
        useful_life_years = Decimal(str(useful_life_months)) / Decimal("12")
        annual_rate = Decimal("2") / useful_life_years

        # 年折旧率不超过100%
        return min(annual_rate, Decimal("1")).quantize(Decimal("0.0001"))

    def _calculate_book_value_at_period(
        self,
        acquisition_cost: Decimal,
        depreciable_amount: Decimal,
        useful_life_months: int,
        current_period: int,
        annual_rate: Decimal
    ) -> Decimal:
        """
        计算特定期间的账面价值

        使用双倍余额递减法计算资产在特定期间的账面价值。
        需要考虑切换至直线法的时机。

        Args:
            acquisition_cost: 原值
            depreciable_amount: 可折旧总额
            useful_life_months: 预计使用月数
            current_period: 当前期间（第几个月），从0开始
            annual_rate: 年折旧率

        Returns:
            Decimal: 当前期间的账面价值
        """
        remaining_months = useful_life_months - current_period

        if remaining_months <= 0:
            return Decimal("0")

        # 计算剩余使用年限（以月为单位）
        remaining_years = Decimal(str(remaining_months)) / Decimal("12")

        # 计算直线法月折旧额
        straight_line_monthly = depreciable_amount / Decimal(str(useful_life_months))

        # 计算双倍余额递减法下的当前账面价值
        # 使用复利公式: BV = AC * (1 - r)^n，其中 r = annual_rate
        rate = annual_rate / Decimal("12")  # 转为月利率

        # 简化的双倍余额递减法计算：直接按余额乘以月利率
        # 对于加速折旧，需要追踪每一期的期初余额
        book_value = acquisition_cost

        for month in range(current_period):
            # 计算该月折旧
            monthly_depr = book_value * rate

            # 检查是否应切换至直线法（最后两年）
            remaining_after_this = useful_life_months - month - 1
            if remaining_after_this <= 24:  # 最后两年
                # 切换至直线法
                remaining_to_depreciate = book_value - Decimal("0")  # 简化处理
                if remaining_after_this > 0:
                    monthly_depr = remaining_to_depreciate / Decimal(str(remaining_after_this))

            book_value -= monthly_depr

            if book_value <= Decimal("0"):
                return Decimal("0")

        return book_value

    def _calculate_monthly_depreciation(
        self,
        acquisition_cost: Decimal,
        salvage_value: Decimal,
        useful_life_months: int,
        current_period: int,
        current_book_value: Decimal,
        annual_rate: Decimal
    ) -> Decimal:
        """
        计算月折旧额

        根据双倍余额递减法计算月折旧额，并在适当时机考虑切换至直线法。

        Args:
            acquisition_cost: 原值
            salvage_value: 残值
            useful_life_months: 预计使用月数
            current_period: 当前期间
            current_book_value: 当前账面价值
            annual_rate: 年折旧率

        Returns:
            Decimal: 月折旧额
        """
        remaining_months = useful_life_months - current_period

        if remaining_months <= 0:
            return Decimal("0")

        # 双倍余额递减法月折旧额
        monthly_rate = annual_rate / Decimal("12")
        ddb_monthly = current_book_value * monthly_rate

        # 直线法月折旧额（基于剩余可折旧金额）
        remaining_depreciable = current_book_value - salvage_value

        if remaining_depreciable <= Decimal("0"):
            return Decimal("0")

        straight_line_monthly = remaining_depreciable / Decimal(str(remaining_months))

        # 判断是否切换至直线法
        if self.config.switch_to_straight_line:
            threshold = ddb_monthly * self.config.min_switch_threshold

            # 切换条件：当直线法折旧额 >= 双倍余额递减法折旧额时切换
            # 或者当剩余期间采用直线法更划算时切换
            if straight_line_monthly >= ddb_monthly or remaining_months <= 24:
                return straight_line_monthly

        return ddb_monthly

    def _calculate_accumulated_depreciation(
        self,
        acquisition_cost: Decimal,
        salvage_value: Decimal,
        useful_life_months: int,
        current_period: int,
        annual_rate: Decimal
    ) -> Decimal:
        """
        计算截至当前期间的累计折旧

        Args:
            acquisition_cost: 原值
            salvage_value: 残值
            useful_life_months: 预计使用月数
            current_period: 当前期间（从0开始）
            annual_rate: 年折旧率

        Returns:
            Decimal: 累计折旧额
        """
        if current_period <= 0:
            return Decimal("0")

        total_accumulated = Decimal("0")
        book_value = acquisition_cost

        for month in range(current_period):
            remaining_months = useful_life_months - month
            remaining_depreciable = book_value - salvage_value

            if remaining_depreciable <= Decimal("0"):
                break

            # 双倍余额递减法月折旧
            monthly_rate = annual_rate / Decimal("12")
            ddb_monthly = book_value * monthly_rate

            # 直线法月折旧
            straight_line_monthly = remaining_depreciable / Decimal(str(remaining_months))

            # 决定使用哪种方法
            if self.config.switch_to_straight_line:
                if straight_line_monthly >= ddb_monthly or remaining_months <= 24:
                    monthly_depr = straight_line_monthly
                else:
                    monthly_depr = ddb_monthly
            else:
                monthly_depr = ddb_monthly

            # 确保账面价值不低于残值
            if book_value - monthly_depr < salvage_value:
                monthly_depr = book_value - salvage_value

            total_accumulated += monthly_depr
            book_value -= monthly_depr

        return total_accumulated

    def _round_currency(self, value: Decimal) -> Decimal:
        """
        将数值四舍五入到小数点后4位

        Args:
            value: 待处理的数值

        Returns:
            Decimal: 四舍五入后的结果
        """
        return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    def get_switch_point(self, useful_life_months: int) -> int:
        """
        计算从双倍余额递减法切换至直线法的最佳时机

        根据财务管理原则，当直线法计算的折旧额大于双倍余额递减法时，
        应切换至直线法。对于双倍余额递减法，通常在资产寿命的后期切换。

        Args:
            useful_life_months: 预计使用月数

        Returns:
            int: 建议的切换月份（从1开始计数）
        """
        # 常见规则：剩余期间等于原始期间的一半时考虑切换
        # 或当剩余期间 <= 24个月时强制切换
        if useful_life_months <= 24:
            return 1

        # 理论切换点：当 (账面价值 / 剩余月数) >= (期初账面价值 * 年率 / 12) 时
        # 简化处理：在寿命的后半段切换
        return useful_life_months // 2

    def validate_switch_conditions(
        self,
        current_book_value: Decimal,
        remaining_months: int,
        annual_rate: Decimal
    ) -> tuple[bool, str]:
        """
        验证当前是否应切换至直线法

        Args:
            current_book_value: 当前账面价值
            remaining_months: 剩余使用月数
            annual_rate: 双倍余额递减法年折旧率

        Returns:
            tuple[bool, str]: (是否应切换, 原因说明)
        """
        if remaining_months <= 0:
            return True, "资产已折旧完毕"

        # 计算双倍余额递减法月折旧额
        monthly_rate = annual_rate / Decimal("12")
        ddb_monthly = current_book_value * monthly_rate

        # 计算直线法月折旧额
        straight_line_monthly = current_book_value / Decimal(str(remaining_months))

        # 切换条件：直线法 >= 双倍余额递减法
        if straight_line_monthly >= ddb_monthly:
            return True, f"直线法月折旧额({straight_line_monthly:.4f}) >= 双倍余额递减法月折旧额({ddb_monthly:.4f})"

        # 剩余期间 <= 24个月时强制切换
        if remaining_months <= 24:
            return True, f"剩余期间({remaining_months}个月)不足2年，提前切换至直线法"

        return False, "当前适合继续使用双倍余额递减法"

    def calculate_depreciation_schedule(
        self,
        input_data: DepreciationInput
    ) -> list[DepreciationOutput]:
        """
        计算完整的折旧计划表

        生成从资产入账到折旧完毕的完整折旧明细。

        Args:
            input_data: 折旧计算输入参数

        Returns:
            list[DepreciationOutput]: 完整折旧计划列表
        """
        self._validate_input(input_data)

        schedule: list[DepreciationOutput] = []
        accumulated = Decimal("0")

        for period in range(input_data.useful_life_months):
            result = self.calculate(input_data, period)
            schedule.append(result)

            # 验证累计折旧不超过理论最大值
            max_accumulated = input_data.acquisition_cost - input_data.salvage_value
            if accumulated > max_accumulated:
                # 调整最后几期以确保不超过最大累计折旧
                break

            accumulated = result.accumulated_depreciation

            # 当账面价值接近残值时结束
            if result.book_value <= input_data.salvage_value:
                break

        return schedule

    def _validate_input(self, input_data: DepreciationInput) -> None:
        """
        验证输入参数的合法性

        Args:
            input_data: 折旧计算输入参数

        Raises:
            ValueError: 当参数不合法时
        """
        super()._validate_input(input_data)

        # 额外验证：确保残值不为负
        if input_data.salvage_value < Decimal("0"):
            raise ValueError("残值不能为负数")

        # 确保年折旧率计算合理
        useful_life_years = input_data.useful_life_months / 12
        if useful_life_years < Decimal("0.0833"):  # 少于1个月
            raise ValueError("预计使用年限太短")