"""
资产折旧计算模块 - Schema 定义

本模块定义了折旧计算相关的 Pydantic 模型，用于：
- 折旧计算请求/响应
- 折旧记录数据结构
- 折旧报表模型
- 折旧方法枚举

折旧方法支持:
- straight_line: 直线法 - 年均折旧 = (原值 - 残值) / 使用年限
- double_declining_balance: 双倍余额递减法 - 年折旧率 = 2 / 使用年限 × 100%

Author: SWARM-003
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, computed_field


class DepreciationMethod(str, Enum):
    """
    折旧方法枚举
    
    Attributes:
        STRAIGHT_LINE: 直线法，适合使用寿命均匀磨损的资产
        DOUBLE_DECLINING_BALANCE: 双倍余额递减法，适合前期价值损耗较快的资产
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING_BALANCE = "double_declining_balance"


class AssetDepreciationBase(BaseModel):
    """
    资产折旧基础模型
    
    Attributes:
        asset_id: 资产ID
        original_value: 原值
        salvage_value: 残值
        useful_life_years: 预计使用年限 (1-50年)
        purchase_date: 购置日期
    """
    asset_id: int = Field(..., description="资产ID")
    original_value: Decimal = Field(..., gt=0, description="资产原值，必须大于0")
    salvage_value: Decimal = Field(..., ge=0, description="预计残值，必须大于等于0")
    useful_life_years: int = Field(..., ge=1, le=50, description="预计使用年限，范围1-50年")
    purchase_date: date = Field(..., description="资产购置日期")

    @field_validator('salvage_value')
    @classmethod
    def validate_salvage(cls, v: Decimal, info) -> Decimal:
        """验证残值不超过原值"""
        original = info.data.get('original_value')
        if original is not None and v >= original:
            raise ValueError('残值必须小于原值')
        return round(v, 2)

    @computed_field
    @property
    def depreciable_amount(self) -> Decimal:
        """计算应折旧金额"""
        return round(self.original_value - self.salvage_value, 2)


class DepreciationCalculateRequest(BaseModel):
    """
    折旧计算请求模型
    
    用于发起折旧计算请求，支持单资产或批量计算。
    
    Attributes:
        asset_id: 资产ID
        method: 折旧方法
        calculate_from: 计算起始日期，默认资产购置日期次月
        periods: 计算期间数量，默认按使用年限计算
    """
    asset_id: int = Field(..., description="资产ID")
    method: DepreciationMethod = Field(
        default=DepreciationMethod.STRAIGHT_LINE,
        description="折旧计算方法"
    )
    calculate_from: Optional[date] = Field(
        default=None,
        description="计算起始日期，默认资产购置日期次月首日"
    )
    periods: Optional[int] = Field(
        default=None,
        ge=1,
        description="计算期间数量，默认按使用年限计算"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "asset_id": 1001,
                "method": "straight_line",
                "calculate_from": "2024-02-01",
                "periods": 12
            }
        }
    }


class DepreciationPeriodItem(BaseModel):
    """
    单期折旧明细
    
    Attributes:
        period: 期间序号
        year: 折旧年度
        month: 折旧月份
        depreciation_amount: 本期折旧金额
        accumulated_depreciation: 累计折旧
        book_value: 账面净值
        method: 本期使用的折旧方法
    """
    period: int = Field(..., ge=1, description="期间序号")
    year: int = Field(..., ge=2000, description="折旧年度")
    month: int = Field(..., ge=1, le=12, description="折旧月份")
    depreciation_amount: Decimal = Field(..., ge=0, description="本期折旧金额")
    accumulated_depreciation: Decimal = Field(..., ge=0, description="累计折旧金额")
    book_value: Decimal = Field(..., ge=0, description="期末账面净值")
    method: DepreciationMethod = Field(..., description="本期折旧方法")

    model_config = {
        "json_schema_extra": {
            "example": {
                "period": 1,
                "year": 2024,
                "month": 2,
                "depreciation_amount": "833.33",
                "accumulated_depreciation": "833.33",
                "book_value": "99166.67",
                "method": "straight_line"
            }
        }
    }


class DepreciationScheduleResponse(BaseModel):
    """
    折旧计划表响应
    
    包含资产的完整折旧计划明细。
    
    Attributes:
        asset_id: 资产ID
        asset_name: 资产名称
        original_value: 原值
        salvage_value: 残值
        useful_life_years: 使用年限
        depreciation_method: 折旧方法
        total_depreciation: 折旧总额
        schedule: 各期折旧明细
        created_at: 计算时间
    """
    asset_id: int = Field(..., description="资产ID")
    asset_name: Optional[str] = Field(None, description="资产名称")
    original_value: Decimal = Field(..., description="资产原值")
    salvage_value: Decimal = Field(..., description="预计残值")
    useful_life_years: int = Field(..., description="预计使用年限")
    depreciation_method: DepreciationMethod = Field(..., description="折旧方法")
    total_depreciation: Decimal = Field(..., description="折旧总额")
    schedule: List[DepreciationPeriodItem] = Field(..., description="折旧计划明细")
    created_at: datetime = Field(default_factory=datetime.now, description="计算时间")

    @computed_field
    @property
    def schedule_complete(self) -> bool:
        """检查折旧计划是否完成"""
        if not self.schedule:
            return False
        last_period = self.schedule[-1]
        return last_period.book_value <= self.salvage_value


class DepreciationRecord(BaseModel):
    """
    折旧记录持久化模型
    
    对应数据库 depreciation_records 表结构。
    
    Attributes:
        id: 记录ID
        asset_id: 资产ID
        period_year: 折旧年度
        period_month: 折旧月份
        depreciation_amount: 本期折旧金额
        accumulated_depreciation: 累计折旧
        book_value: 期末净值
        method: 折旧方法
        created_at: 创建时间
    """
    id: Optional[int] = Field(None, description="记录ID")
    asset_id: int = Field(..., description="资产ID")
    period_year: int = Field(..., ge=2000, description="折旧年度")
    period_month: int = Field(..., ge=1, le=12, description="折旧月份")
    depreciation_amount: Decimal = Field(..., description="本期折旧金额")
    accumulated_depreciation: Decimal = Field(..., description="累计折旧金额")
    book_value: Decimal = Field(..., description="期末账面净值")
    method: DepreciationMethod = Field(..., description="折旧方法")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

    model_config = {
        "from_attributes": True
    }


class DepreciationReportItem(BaseModel):
    """
    折旧报表单项
    
    按资产或按类别聚合的折旧数据。
    
    Attributes:
        asset_id: 资产ID
        asset_name: 资产名称
        category: 资产类别
        original_value: 原值
        current_depreciation: 本期折旧
        accumulated_depreciation: 累计折旧
        book_value: 账面净值
    """
    asset_id: int = Field(..., description="资产ID")
    asset_name: str = Field(..., description="资产名称")
    category: Optional[str] = Field(None, description="资产类别")
    original_value: Decimal = Field(..., description="资产原值")
    current_depreciation: Decimal = Field(..., ge=0, description="本期折旧金额")
    accumulated_depreciation: Decimal = Field(..., ge=0, description="累计折旧")
    book_value: Decimal = Field(..., description="账面净值")

    model_config = {
        "json_schema_extra": {
            "example": {
                "asset_id": 1001,
                "asset_name": "办公设备-A",
                "category": "电子设备",
                "original_value": "100000.00",
                "current_depreciation": "1666.67",
                "accumulated_depreciation": "19999.96",
                "book_value": "80000.04"
            }
        }
    }


class DepreciationReportResponse(BaseModel):
    """
    折旧报表响应
    
    包含折旧汇总数据及明细列表。
    
    Attributes:
        report_type: 报表类型 (monthly/annual)
        period_year: 报表年度
        period_month: 报表月份
        total_assets: 资产总数
        total_original_value: 原值总额
        total_current_depreciation: 本期折旧总额
        total_accumulated_depreciation: 累计折旧总额
        total_book_value: 净值总额
        items: 折旧明细列表
        generated_at: 生成时间
    """
    report_type: str = Field(..., description="报表类型: monthly/annual")
    period_year: int = Field(..., ge=2000, description="报表年度")
    period_month: Optional[int] = Field(None, ge=1, le=12, description="报表月份，月度报表必填")
    total_assets: int = Field(..., ge=0, description="资产总数")
    total_original_value: Decimal = Field(..., description="原值总额")
    total_current_depreciation: Decimal = Field(..., description="本期折旧总额")
    total_accumulated_depreciation: Decimal = Field(..., description="累计折旧总额")
    total_book_value: Decimal = Field(..., description="账面净值总额")
    items: List[DepreciationReportItem] = Field(..., description="折旧明细")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")

    @computed_field
    @property
    def depreciation_rate(self) -> Decimal:
        """计算平均折旧率"""
        if self.total_original_value == 0:
            return Decimal("0")
        rate = self.total_current_depreciation / self.total_original_value * 100
        return round(rate, 2)


class AssetDepreciationScheduleItem(BaseModel):
    """
    资产折旧计划条目 (简化版)
    
    用于列表展示的折旧计划摘要。
    
    Attributes:
        asset_id: 资产ID
        asset_name: 资产名称
        original_value: 原值
        useful_life_years: 使用年限
        method: 折旧方法
        annual_depreciation: 年折旧额
        remaining_book_value: 当前账面净值
    """
    asset_id: int = Field(..., description="资产ID")
    asset_name: str = Field(..., description="资产名称")
    original_value: Decimal = Field(..., description="资产原值")
    useful_life_years: int = Field(..., description="预计使用年限")
    method: DepreciationMethod = Field(..., description="折旧方法")
    annual_depreciation: Decimal = Field(..., description="年均折旧额")
    remaining_book_value: Decimal = Field(..., description="当前账面净值")


class AssetDepreciationScheduleData(BaseModel):
    """
    资产折旧计划数据容器
    
    包含一组资产的折旧计划信息。
    
    Attributes:
        total_count: 资产总数
        total_depreciation: 折旧总额
        schedules: 折旧计划列表
    """
    total_count: int = Field(..., ge=0, description="资产总数")
    total_depreciation: Decimal = Field(..., description="折旧总额")
    schedules: List[AssetDepreciationScheduleItem] = Field(..., description="折旧计划列表")


class AssetDepreciationScheduleResponse(BaseModel):
    """
    资产折旧计划响应
    
    API 响应包装器。
    
    Attributes:
        code: 响应码
        message: 响应消息
        data: 折旧计划数据
    """
    code: int = Field(default=200, description="响应码")
    message: str = Field(default="success", description="响应消息")
    data: AssetDepreciationScheduleData = Field(..., description="折旧计划数据")


class DepreciationTriggerRequest(BaseModel):
    """
    折旧计提触发请求
    
    用于批量触发折旧计算任务。
    
    Attributes:
        asset_ids: 资产ID列表
        trigger_date: 触发日期
        force_recaculate: 是否强制重算
    """
    asset_ids: List[int] = Field(..., min_length=1, description="资产ID列表")
    trigger_date: date = Field(..., description="触发日期")
    force_recaculate: bool = Field(default=False, description="是否强制重新计算")


class DepreciationTriggerResultItem(BaseModel):
    """
    折旧触发结果条目
    
    Attributes:
        asset_id: 资产ID
        success: 是否成功
        records_created: 创建的记录数
        error_message: 错误信息（如果失败）
    """
    asset_id: int = Field(..., description="资产ID")
    success: bool = Field(..., description="是否成功")
    records_created: int = Field(default=0, ge=0, description="创建的记录数")
    error_message: Optional[str] = Field(None, description="错误信息")


class DepreciationTriggerResultData(BaseModel):
    """
    折旧触发结果数据
    
    Attributes:
        total_count: 处理总数
        success_count: 成功数
        failure_count: 失败数
        results: 各资产处理结果
    """
    total_count: int = Field(..., description="处理总数")
    success_count: int = Field(..., description="成功数")
    failure_count: int = Field(..., description="失败数")
    results: List[DepreciationTriggerResultItem] = Field(..., description="处理结果列表")


class DepreciationTriggerResponse(BaseModel):
    """
    折旧触发响应
    
    API 响应包装器。
    
    Attributes:
        code: 响应码
        message: 响应消息
        data: 触发结果数据
    """
    code: int = Field(default=200, description="响应码")
    message: str = Field(default="success", description="响应消息")
    data: DepreciationTriggerResultData = Field(..., description="触发结果数据")