"""
Depreciation API Schemas Module

本模块定义了折旧计算核心模块 Iteration 2 所需的 Pydantic 数据模型，
包括直线法与双倍余额递减法的计算参数、折旧记录响应模型、
报表查询请求/响应模型、以及定时任务配置模型。

@author: SWARM-2026-Q2-003 Team
@since: 2026-Q2
@version: 2.0.0
"""
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DepreciationMethodEnum(str, Enum):
    """
    折旧方法枚举
    
    定义系统支持的两种折旧计算方法：
    - straight_line: 直线法（平均年限法）
    - double_declining: 双倍余额递减法（加速折旧法）
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


class StraightLineDepreciationParams(BaseModel):
    """
    直线法折旧计算参数模型
    
    直线法公式：月折旧额 = (原值 - 残值) / 预计使用寿命（月）
    
    @example:
        acquisition_cost: 100000.00
        useful_life_months: 60
        salvage_value: 5000.00
        -> monthly_depreciation = 1583.33
    """
    asset_id: UUID = Field(..., description="资产ID，必须关联已存在的资产记录")
    acquisition_cost: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=2,
        description="资产原值，精度至小数点后2位"
    )
    useful_life_months: int = Field(
        ...,
        ge=1,
        description="预计使用寿命，最小值为1个月"
    )
    salvage_value: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=2,
        description="预计残值，不得大于 acquisition_cost"
    )
    acquisition_date: datetime = Field(..., description="资产购置日期，不得晚于当前日期")
    
    @field_validator("salvage_value")
    @classmethod
    def validate_salvage_not_exceed_cost(cls, v: Decimal, info) -> Decimal:
        """
        验证残值不得超过原值
        
        @param v: 残值字段值
        @param info: Pydantic 验证信息上下文
        @raises ValueError: 当残值大于原值时
        """
        acquisition_cost = info.data.get("acquisition_cost")
        if acquisition_cost is not None and v > acquisition_cost:
            raise ValueError("残值不得大于资产原值")
        return v


class DoubleDecliningDepreciationParams(BaseModel):
    """
    双倍余额递减法折旧计算参数模型
    
    双倍余额递减法公式：
    - 年折旧率 = 2 / 预计使用年限
    - 首年月折旧额 = (原值 × 年折旧率) / 12
    - 当某年直线法计算的折旧额 > 双倍余额递减额时，应切换至直线法
    - 账面价值永远不得低于残值
    
    @example:
        acquisition_cost: 100000.00
        useful_life_months: 60
        salvage_value: 5000.00
        -> 年折旧率 = 2/5 = 40%
    """
    asset_id: UUID = Field(..., description="资产ID，必须关联已存在的资产记录")
    acquisition_cost: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=2,
        description="资产原值，精度至小数点后2位"
    )
    useful_life_months: int = Field(
        ...,
        ge=1,
        description="预计使用寿命，最小值为1个月"
    )
    salvage_value: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=2,
        description="预计残值，不得大于 acquisition_cost"
    )
    acquisition_date: datetime = Field(..., description="资产购置日期，不得晚于当前日期")
    current_book_value: Optional[Decimal] = Field(
        default=None,
        description="当前账面价值，用于计算当期折旧"
    )
    current_period: Optional[int] = Field(
        default=None,
        ge=0,
        description="当前期间（月份），从0开始计数"
    )
    
    @field_validator("salvage_value")
    @classmethod
    def validate_salvage_not_exceed_cost(cls, v: Decimal, info) -> Decimal:
        """
        验证残值不得超过原值
        
        @param v: 残值字段值
        @param info: Pydantic 验证信息上下文
        @raises ValueError: 当残值大于原值时
        """
        acquisition_cost = info.data.get("acquisition_cost")
        if acquisition_cost is not None and v > acquisition_cost:
            raise ValueError("残值不得大于资产原值")
        return v


class DepreciationCalculationResult(BaseModel):
    """
    折旧计算结果响应模型
    
    统一记录直线法与双倍余额递减法的计算结果
    """
    asset_id: UUID = Field(..., description="资产ID")
    method: DepreciationMethodEnum = Field(..., description="折旧方法")
    period: str = Field(..., description="折旧期间，格式: YYYY-MM")
    monthly_depreciation: Decimal = Field(
        ...,
        decimal_places=4,
        description="月折旧额，精度至小数点后4位，四舍五入"
    )
    accumulated_depreciation: Decimal = Field(
        ...,
        description="累计折旧额，不得大于 (原值 - 残值)"
    )
    book_value: Decimal = Field(
        ...,
        description="账面价值 = 原值 - 累计折旧额"
    )
    useful_life_remaining: int = Field(..., description="剩余使用寿命（月）")
    calculated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="计算时间"
    )


class DepreciationRecordResponse(BaseModel):
    """
    折旧明细记录响应模型
    
    用于展示单条折旧明细记录
    """
    record_id: UUID = Field(..., description="折旧记录ID")
    asset_id: UUID = Field(..., description="资产ID")
    asset_name: Optional[str] = Field(default=None, description="资产名称")
    period: str = Field(..., description="折旧期间，格式: YYYY-MM")
    depreciation_method: DepreciationMethodEnum = Field(..., description="折旧方法")
    monthly_depreciation: Decimal = Field(
        ...,
        decimal_places=4,
        description="月折旧额"
    )
    accumulated_depreciation: Decimal = Field(..., description="累计折旧额")
    book_value: Decimal = Field(..., description="账面价值")
    created_at: datetime = Field(..., description="记录创建时间")


class DepreciationDetailQuery(BaseModel):
    """
    折旧明细查询请求模型
    
    支持按资产ID和时间范围查询折旧明细
    """
    asset_id: UUID = Field(..., description="资产ID")
    start_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="起始月份，格式: YYYY-MM"
    )
    end_date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="结束月份，格式: YYYY-MM"
    )
    
    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, v: str, info) -> str:
        """
        验证时间范围不超过36个月
        
        @param v: 结束月份
        @param info: Pydantic 验证信息上下文
        @raises ValueError: 当时间范围超过36个月时
        """
        start_date = info.data.get("start_date")
        if start_date:
            start_year, start_month = map(int, start_date.split("-"))
            end_year, end_month = map(int, v.split("-"))
            months_diff = (end_year - start_year) * 12 + (end_month - start_month)
            if months_diff > 36:
                raise ValueError("查询时间范围不得超过36个月")
        return v


class DepreciationDetailResponse(BaseModel):
    """
    折旧明细响应模型
    
    返回折旧明细报表数据
    """
    asset_id: UUID = Field(..., description="资产ID")
    asset_name: str = Field(..., description="资产名称")
    records: List[DepreciationRecordResponse] = Field(
        ...,
        description="折旧明细记录列表"
    )
    total_monthly_depreciation: Decimal = Field(
        ...,
        description="期间内月折旧额总计"
    )
    total_accumulated_depreciation: Decimal = Field(
        ...,
        description="期末累计折旧总额"
    )
    current_book_value: Decimal = Field(..., description="期末账面价值")
    record_count: int = Field(..., description="记录条数")


class DepreciationAggregateQuery(BaseModel):
    """
    折旧汇总查询请求模型
    
    按期间查询所有资产的折旧汇总数据
    """
    period: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="查询月份，格式: YYYY-MM"
    )
    method: Optional[DepreciationMethodEnum] = Field(
        default=None,
        description="折旧方法筛选（可选）"
    )
    department_id: Optional[UUID] = Field(
        default=None,
        description="部门ID筛选（可选）"
    )


class DepreciationAggregateResponse(BaseModel):
    """
    折旧汇总响应模型
    
    返回指定期间所有资产的折旧汇总
    """
    period: str = Field(..., description="折旧期间")
    total_assets: int = Field(..., description="资产总数")
    total_monthly_depreciation: Decimal = Field(
        ...,
        description="该月所有资产折旧总额"
    )
    total_accumulated_depreciation: Decimal = Field(
        ...,
        description="所有资产累计折旧总额"
    )
    total_current_book_value: Decimal = Field(
        ...,
        description="所有资产当前账面价值总额"
    )
    by_method: Optional[dict] = Field(
        default=None,
        description="按折旧方法分类的汇总"
    )
    by_department: Optional[dict] = Field(
        default=None,
        description="按部门分类的汇总"
    )


class ExportFormatEnum(str, Enum):
    """
    导出格式枚举
    """
    CSV = "csv"
    EXCEL = "excel"


class DepreciationExportRequest(BaseModel):
    """
    折旧报表导出请求模型
    """
    period: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="导出月份，格式: YYYY-MM"
    )
    export_format: ExportFormatEnum = Field(
        default=ExportFormatEnum.CSV,
        description="导出格式，支持 CSV 和 Excel"
    )
    include_details: bool = Field(
        default=False,
        description="是否包含明细数据"
    )


class SchedulerCronConfig(BaseModel):
    """
    定时任务 Cron 配置模型
    
    @example: 每月末日 00:00 执行 -> cron_expression = "0 0 28-31 * *"
    """
    cron_expression: str = Field(
        ...,
        description="Cron 表达式"
    )
    timezone: str = Field(
        default="Asia/Shanghai",
        description="时区配置"
    )
    max_retry_attempts: int = Field(
        default=3,
        ge=0,
        le=5,
        description="失败最大重试次数"
    )
    retry_interval_minutes: int = Field(
        default=2,
        ge=1,
        description="重试间隔（分钟）"
    )


class ManualAccrueRequest(BaseModel):
    """
    手动触发折旧计提请求模型
    """
    target_period: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="目标计提月份，格式: YYYY-MM"
    )
    asset_ids: Optional[List[UUID]] = Field(
        default=None,
        description="指定资产ID列表（为空则处理所有适用资产）"
    )
    force_recalculate: bool = Field(
        default=False,
        description="是否强制重新计算（忽略已存在记录）"
    )


class ManualAccrueResponse(BaseModel):
    """
    手动触发折旧计提响应模型
    """
    job_id: str = Field(..., description="任务执行ID")
    target_period: str = Field(..., description="目标计提月份")
    status: str = Field(..., description="执行状态: pending/processing/completed/failed")
    total_assets_processed: int = Field(..., description="已处理资产数量")
    total_amount: Decimal = Field(..., description="计提总金额")
    started_at: datetime = Field(..., description="任务开始时间")
    completed_at: Optional[datetime] = Field(
        default=None,
        description="任务完成时间"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="错误信息（如有）"
    )


class JobExecutionLog(BaseModel):
    """
    任务执行日志模型
    """
    job_id: str = Field(..., description="任务执行ID")
    job_name: str = Field(..., description="任务名称")
    executed_at: datetime = Field(..., description="执行时间")
    status: str = Field(..., description="执行状态: success/failed/retry")
    processed_count: int = Field(..., description="处理资产数量")
    total_amount: Decimal = Field(..., description="计提总金额")
    duration_seconds: float = Field(..., description="执行耗时（秒）")
    retry_count: int = Field(default=0, description="重试次数")
    error_details: Optional[str] = Field(
        default=None,
        description="错误详情（如有）"
    )


class DepreciationRecordCreate(BaseModel):
    """
    折旧记录创建模型
    
    用于批量创建折旧记录或单笔录入
    """
    asset_id: UUID = Field(..., description="资产ID")
    period: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="折旧期间，格式: YYYY-MM"
    )
    depreciation_method: DepreciationMethodEnum = Field(
        ...,
        description="折旧方法"
    )
    monthly_depreciation: Decimal = Field(
        ...,
        decimal_places=4,
        ge=Decimal("0"),
        description="月折旧额"
    )
    accumulated_depreciation: Decimal = Field(
        ...,
        ge=Decimal("0"),
        description="累计折旧额"
    )
    book_value: Decimal = Field(..., description="账面价值")


class DepreciationRecordBatchCreate(BaseModel):
    """
    折旧记录批量创建模型
    """
    records: List[DepreciationRecordCreate] = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="折旧记录列表，最多1000条"
    )
    idempotency_key: Optional[str] = Field(
        default=None,
        description="幂等键，用于防止重复提交"
    )


class DepreciationConsistencyCheck(BaseModel):
    """
    数据一致性校验模型
    """
    asset_id: UUID = Field(..., description="资产ID")
    expected_accumulated: Decimal = Field(..., description="理论累计折旧额上限")
    actual_accumulated: Decimal = Field(..., description="实际累计折旧额")
    is_valid: bool = Field(..., description="是否通过校验")
    deviation: Decimal = Field(..., description="偏差值")