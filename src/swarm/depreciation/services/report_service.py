# 计算器抽象
class DepreciationCalculator(Protocol):
    def calculate(self, asset: Asset, period: Period) -> DepreciationResult: ...

# 结果对象
@dataclass
class DepreciationResult:
    asset_id: str
    period: str  # YYYY-MM
    method: str  # 'STRAIGHT_LINE' | 'DECLINING_BALANCE'
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal