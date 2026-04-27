"""
折旧明细报表处理器模块

提供折旧明细报表的查询、汇总和导出功能，支持：
- 按资产 ID 查询折旧明细
- 按期间范围查询汇总数据
- CSV/Excel 格式导出

依赖模块：
- depreciation.domain.schemas: 折旧领域模型
- depreciation.domain.repositories: 数据访问层
- calculation.engine: 折旧计算引擎
"""

import csv
import io
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from enum import Enum

from fastapi import APIRouter, HTTPException, Query, Depends, Header
from fastapi.responses import StreamingResponse

# 折旧领域模型
try:
    from src.swarm_003.depreciation.domain.schemas import (
        DepreciationMethod,
        DepreciationRecordSchema,
        DepreciationReportQuery,
        DepreciationAggregateReport,
        DepreciationPeriod,
    )
except ImportError:
    # 备选导入路径
    from depreciation.domain.schemas import (
        DepreciationMethod,
        DepreciationRecordSchema,
        DepreciationReportQuery,
        DepreciationAggregateReport,
        DepreciationPeriod,
    )

# 数据访问层
try:
    from src.swarm_003.depreciation.domain.repositories import DepreciationRepository
except ImportError:
    from depreciation.domain.repositories import DepreciationRepository

# 计算引擎
try:
    from src.swarm_003.depreciation.engine.factory import DepreciationCalculatorFactory
except ImportError:
    from depreciation.engine.factory import DepreciationCalculatorFactory


# 最大查询时间范围（月）
MAX_QUERY_MONTHS = 36


class ExportFormat(str, Enum):
    """导出格式枚举"""
    CSV = "csv"
    EXCEL = "excel"


# 路由实例
router = APIRouter(prefix="/depreciation", tags=["折旧报表"])


def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """
    获取当前用户ID的依赖注入函数
    
    Args:
        x_user_id: 请求头中的用户ID
        
    Returns:
        str: 用户ID
        
    Raises:
        HTTPException: 用户未认证时抛出 401 错误
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User authentication required")
    return x_user_id


async def get_repository() -> DepreciationRepository:
    """
    获取折旧记录仓储的依赖注入函数
    
    Returns:
        DepreciationRepository: 折旧记录仓储实例
    """
    return DepreciationRepository()


def validate_period_range(start_date: str, end_date: str) -> tuple[datetime, datetime]:
    """
    验证查询时间范围的有效性
    
    Args:
        start_date: 起始日期 (YYYY-MM)
        end_date: 结束日期 (YYYY-MM)
        
    Returns:
        tuple[datetime, datetime]: 验证后的起止日期
        
    Raises:
        HTTPException: 时间范围超过36个月或格式无效时抛出 400 错误
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m")
        end = datetime.strptime(end_date, "%Y-%m")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_DATE_FORMAT",
                "message": "Date format must be YYYY-MM"
            }
        )
    
    if start > end:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_DATE_RANGE",
                "message": "start_date cannot be after end_date"
            }
        )
    
    # 计算月份差
    months_diff = (end.year - start.year) * 12 + (end.month - start.month)
    if months_diff > MAX_QUERY_MONTHS:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "PERIOD_EXCEEDS_LIMIT",
                "message": f"Query period exceeds maximum of {MAX_QUERY_MONTHS} months"
            }
        )
    
    return start, end


@router.get(
    "/assets/{asset_id}/depreciation-detail",
    response_model=List[DepreciationRecordSchema],
    summary="查询资产折旧明细",
    description="根据资产ID查询指定期间的折旧明细记录"
)
async def get_asset_depreciation_detail(
    asset_id: str,
    start_date: str = Query(..., description="起始月份 YYYY-MM"),
    end_date: str = Query(..., description="结束月份 YYYY-MM"),
    repository: DepreciationRepository = Depends(get_repository),
) -> List[DepreciationRecordSchema]:
    """
    查询指定资产的折旧明细记录
    
    Args:
        asset_id: 资产ID (UUID v4)
        start_date: 起始月份
        end_date: 结束月份
        repository: 折旧记录仓储
        
    Returns:
        List[DepreciationRecordSchema]: 折旧明细记录列表
        
    Raises:
        HTTPException: 资产不存在或查询失败时抛出相应错误
    """
    start, end = validate_period_range(start_date, end_date)
    
    # 验证资产存在性
    asset = await repository.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "ASSET_NOT_FOUND",
                "message": f"Asset with id '{asset_id}' not found"
            }
        )
    
    # 查询折旧明细记录
    records = await repository.get_depreciation_records_by_asset(
        asset_id=asset_id,
        start_period=start,
        end_period=end,
    )
    
    return records


@router.get(
    "/report",
    response_model=DepreciationAggregateReport,
    summary="查询折旧汇总报表",
    description="查询指定期间的折旧汇总数据"
)
async def get_depreciation_report(
    period: str = Query(..., description="查询月份 YYYY-MM"),
    department_id: Optional[str] = Query(None, description="部门ID筛选"),
    category_id: Optional[str] = Query(None, description="资产类别ID筛选"),
    repository: DepreciationRepository = Depends(get_repository),
    user_id: str = Depends(get_current_user_id),
) -> DepreciationAggregateReport:
    """
    查询折旧汇总报表
    
    Args:
        period: 查询月份
        department_id: 可选的部门筛选
        category_id: 可选的资产类别筛选
        repository: 折旧记录仓储
        user_id: 当前用户ID
        
    Returns:
        DepreciationAggregateReport: 折旧汇总报表数据
    """
    try:
        query_date = datetime.strptime(period, "%Y-%m")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_DATE_FORMAT",
                "message": "Date format must be YYYY-MM"
            }
        )
    
    # 构建查询条件
    query_filter = {
        "period": query_date,
        "department_id": department_id,
        "category_id": category_id,
    }
    
    # 获取汇总数据
    aggregate = await repository.get_aggregate_depreciation_report(query_filter)
    
    return aggregate


@router.get(
    "/report/export",
    summary="导出折旧报表",
    description="导出指定期间折旧数据的CSV文件"
)
async def export_depreciation_report(
    period: str = Query(..., description="查询月份 YYYY-MM"),
    format: ExportFormat = Query(ExportFormat.CSV, description="导出格式"),
    start_date: Optional[str] = Query(None, description="起始月份 YYYY-MM (可选)"),
    end_date: Optional[str] = Query(None, description="结束月份 YYYY-MM (可选)"),
    repository: DepreciationRepository = Depends(get_repository),
    user_id: str = Depends(get_current_user_id),
) -> StreamingResponse:
    """
    导出折旧报表为CSV格式
    
    Args:
        period: 查询月份
        format: 导出格式 (目前仅支持CSV)
        start_date: 可选的起始月份 (用于明细导出)
        end_date: 可选的结束月份 (用于明细导出)
        repository: 折旧记录仓储
        user_id: 当前用户ID
        
    Returns:
        StreamingResponse: CSV文件的流式响应
    """
    # 解析查询期间
    if start_date and end_date:
        start, end = validate_period_range(start_date, end_date)
        query_date = None
    else:
        try:
            query_date = datetime.strptime(period, "%Y-%m")
            start = None
            end = None
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "INVALID_DATE_FORMAT",
                    "message": "Date format must be YYYY-MM"
                }
            )
    
    # 获取导出数据
    if start and end:
        records = await repository.get_depreciation_records_for_export(
            start_period=start,
            end_period=end,
        )
    else:
        records = await repository.get_depreciation_records_for_export(
            period=query_date,
        )
    
    # 生成CSV内容
    output = io.StringIO()
    writer = csv.writer(output)
    
    # 写入表头
    headers = [
        "资产ID",
        "资产名称",
        "资产类别",
        "所属部门",
        "期间",
        "月折旧额",
        "累计折旧",
        "账面价值",
        "折旧方法",
    ]
    writer.writerow(headers)
    
    # 写入数据行
    for record in records:
        writer.writerow([
            record.asset_id,
            record.asset_name,
            record.category_name,
            record.department_name,
            record.period.strftime("%Y-%m"),
            str(record.monthly_depreciation),
            str(record.accumulated_depreciation),
            str(record.book_value),
            record.depreciation_method.value if record.depreciation_method else "直线法",
        ])
    
    # 重置游标
    output.seek(0)
    
    # 生成文件名
    if start and end:
        filename = f"depreciation_{start.strftime('%Y%m')}_{end.strftime('%Y%m')}.csv"
    else:
        filename = f"depreciation_{query_date.strftime('%Y%m')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post(
    "/accrue",
    summary="手动触发折旧计提",
    description="手动执行单次折旧计提任务，返回执行结果"
)
async def trigger_depreciation_accrual(
    period: Optional[str] = Query(None, description="指定月份 YYYY-MM (默认当前月份)"),
    force: bool = Query(False, description="是否强制重新计算已计提的记录"),
    repository: DepreciationRepository = Depends(get_repository),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """
    手动触发折旧计提任务
    
    Args:
        period: 指定月份，默认为当前月份
        force: 是否强制重新计算
        repository: 折旧记录仓储
        user_id: 当前用户ID
        
    Returns:
        dict: 任务执行结果，包含处理数量和总金额
    """
    if period:
        try:
            query_date = datetime.strptime(period, "%Y-%m")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "INVALID_DATE_FORMAT",
                    "message": "Date format must be YYYY-MM"
                }
            )
    else:
        # 默认当前月份
        now = datetime.now()
        query_date = datetime(now.year, now.month, 1)
    
    # 获取所有需要计提折旧的资产
    assets = await repository.get_depreciable_assets(
        as_of_date=query_date,
        force=force,
    )
    
    # 创建计算器工厂
    calculator_factory = DepreciationCalculatorFactory()
    
    total_processed = 0
    total_amount = Decimal("0")
    errors = []
    
    for asset in assets:
        try:
            # 获取折旧方法
            method = asset.depreciation_method or DepreciationMethod.STRAIGHT_LINE
            
            # 获取计算器
            calculator = calculator_factory.get_calculator(method)
            
            # 计算折旧
            result = calculator.calculate(
                acquisition_cost=asset.acquisition_cost,
                useful_life_months=asset.useful_life_months,
                salvage_value=asset.salvage_value,
                current_book_value=asset.current_book_value,
                elapsed_months=asset.elapsed_months,
            )
            
            # 创建折旧记录
            record = await repository.create_depreciation_record(
                asset_id=asset.id,
                period=query_date,
                monthly_depreciation=result.monthly_depreciation,
                accumulated_depreciation=result.accumulated_depreciation,
                book_value=result.book_value,
                depreciation_method=method,
            )
            
            total_processed += 1
            total_amount += result.monthly_depreciation
            
        except Exception as e:
            errors.append({
                "asset_id": asset.id,
                "error": str(e),
            })
    
    # 记录任务执行日志
    job_log = await repository.create_job_log(
        job_type="manual_accrual",
        executed_by=user_id,
        period=query_date,
        total_processed=total_processed,
        total_amount=total_amount,
        status="completed" if not errors else "completed_with_errors",
        errors=errors if errors else None,
    )
    
    return {
        "status": "success",
        "job_id": job_log.id,
        "period": query_date.strftime("%Y-%m"),
        "total_assets_processed": total_processed,
        "total_amount": str(total_amount),
        "errors_count": len(errors),
        "errors": errors if errors else None,
    }