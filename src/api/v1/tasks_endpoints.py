"""
资产批量导入导出 - 异步任务端点模块

本模块提供异步导入任务的查询和管理接口，支持:
- 任务状态查询
- 任务进度跟踪
- 错误报告获取
- 任务结果下载

Iteration: 2 (Phase 2: 数据交换层)
Feature: SWARM-2025-Q2-P2-006
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# ============================================================================
# 数据模型定义
# ============================================================================

class TaskStatus(str, Enum):
    """导入任务状态枚举"""
    PENDING = "PENDING"       # 等待处理
    QUEUED = "QUEUED"         # 已加入队列
    PROCESSING = "PROCESSING" # 处理中
    COMPLETED = "COMPLETED"   # 已完成
    FAILED = "FAILED"         # 失败
    CANCELLED = "CANCELLED"   # 已取消


class ImportMode(str, Enum):
    """导入模式枚举"""
    STRICT = "strict"         # 全量失败模式
    PARTIAL = "partial"       # 部分导入模式


class TaskProgress(BaseModel):
    """任务进度响应模型
    
    Attributes:
        task_id: 任务唯一标识
        status: 当前状态
        progress: 进度百分比 (0-100)
        total_rows: 总行数
        processed_rows: 已处理行数
        imported_rows: 成功导入行数
        failed_rows: 失败行数
        created_at: 任务创建时间
        updated_at: 最后更新时间
        error_message: 错误信息(如果任务失败)
    """
    task_id: str
    status: TaskStatus
    progress: int = Field(ge=0, le=100)
    total_rows: int = 0
    processed_rows: int = 0
    imported_rows: int = 0
    failed_rows: int = 0
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None


class ImportErrorDetail(BaseModel):
    """导入错误详情模型
    
    Attributes:
        row: 错误发生的行号
        field: 出错的字段名
        message: 错误描述信息
        original_value: 原始值
    """
    row: int
    field: str
    message: str
    original_value: Optional[str] = None


class TaskErrorReport(BaseModel):
    """任务错误报告模型
    
    Attributes:
        task_id: 任务唯一标识
        total_errors: 总错误数
        errors: 错误列表详情
        report_url: 错误报告下载链接
        expires_at: 报告过期时间
    """
    task_id: str
    total_errors: int
    errors: List[ImportErrorDetail]
    report_url: Optional[str] = None
    expires_at: Optional[datetime] = None


class TaskQueryParams(BaseModel):
    """任务查询参数模型
    
    Attributes:
        task_id: 任务ID
        status: 按状态筛选
        user_id: 按用户筛选
        date_from: 创建时间起始
        date_to: 创建时间截止
    """
    task_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    user_id: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


# ============================================================================
# 路由实例化
# ============================================================================

router = APIRouter(prefix="/api/v1/tasks", tags=["异步任务管理"])


# ============================================================================
# 依赖项
# ============================================================================

def get_current_user_id() -> str:
    """获取当前用户ID的依赖项
    
    Returns:
        当前登录用户的ID字符串
        
    Note:
        实际实现应从JWT token或session中获取
    """
    # TODO: 从认证上下文获取实际用户ID
    return "current_user_id"


def get_task_service():
    """获取任务服务的依赖项
    
    Returns:
        TaskService 实例，用于操作任务数据
        
    Note:
        实际实现应从DI容器获取带事务管理的高内聚Service
    """
    # TODO: 注入实际的任务服务实例
    from src.services.import_service import ImportService
    return ImportService()


# ============================================================================
# 端点实现
# ============================================================================

@router.get(
    "/import/{task_id}",
    response_model=TaskProgress,
    summary="查询导入任务进度",
    description="根据任务ID查询异步导入任务的当前进度和状态"
)
async def get_import_task_progress(
    task_id: str,
    user_id: str = Depends(get_current_user_id)
) -> TaskProgress:
    """获取指定导入任务的进度信息
    
    Args:
        task_id: 导入任务的唯一标识
        user_id: 当前操作用户ID，用于权限校验
        
    Returns:
        TaskProgress: 包含任务进度详情的响应对象
        
    Raises:
        HTTPException: 404 - 任务不存在
        HTTPException: 403 - 无权访问该任务
        HTTPException: 500 - 服务器内部错误
        
    Example:
        >>> GET /api/v1/tasks/import/task_123456
        >>> Response: {
        >>>     "task_id": "task_123456",
        >>>     "status": "PROCESSING",
        >>>     "progress": 45,
        >>>     "total_rows": 10000,
        >>>     "processed_rows": 4500,
        >>>     "imported_rows": 4400,
        >>>     "failed_rows": 100
        >>> }
    """
    service = get_task_service()
    
    try:
        task = service.get_task_by_id(task_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    except PermissionError:
        raise HTTPException(status_code=403, detail="无权访问该任务")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")
    
    return TaskProgress(
        task_id=task.task_id,
        status=TaskStatus(task.status),
        progress=task.progress,
        total_rows=task.total_rows,
        processed_rows=task.processed_rows,
        imported_rows=task.imported_rows,
        failed_rows=task.failed_rows,
        created_at=task.created_at,
        updated_at=task.updated_at,
        error_message=task.error_message
    )


@router.get(
    "/import/{task_id}/errors",
    response_model=TaskErrorReport,
    summary="获取导入任务错误报告",
    description="获取导入任务执行过程中产生的错误详情列表"
)
async def get_import_task_errors(
    task_id: str,
    user_id: str = Depends(get_current_user_id)
) -> TaskErrorReport:
    """获取导入任务的错误详情报告
    
    Args:
        task_id: 导入任务的唯一标识
        user_id: 当前操作用户ID，用于权限校验
        
    Returns:
        TaskErrorReport: 包含所有错误详情的报告对象
        
    Raises:
        HTTPException: 404 - 任务不存在
        HTTPException: 403 - 无权访问该任务
        
    Note:
        错误报告下载链接有效期为24小时，超时后需重新生成
    """
    service = get_task_service()
    
    try:
        errors = service.get_task_errors(task_id, user_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    except PermissionError:
        raise HTTPException(status_code=403, detail="无权访问该任务")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取错误报告失败: {str(e)}")
    
    error_details = [
        ImportErrorDetail(
            row=err.row,
            field=err.field,
            message=err.message,
            original_value=err.original_value
        )
        for err in errors
    ]
    
    report_url = f"/api/v1/tasks/import/{task_id}/errors/download"
    expires_at = datetime.now() + timedelta(hours=24)
    
    return TaskErrorReport(
        task_id=task_id,
        total_errors=len(error_details),
        errors=error_details,
        report_url=report_url,
        expires_at=expires_at
    )


@router.get(
    "/import/{task_id}/errors/download",
    summary="下载导入错误报告文件",
    description="下载任务错误报告的Excel格式文件"
)
async def download_import_error_report(
    task_id: str,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    user_id: str = Depends(get_current_user_id)
) -> FileResponse:
    """下载导入任务的错误报告文件
    
    Args:
        task_id: 导入任务的唯一标识
        format: 报告格式，支持 xlsx 和 csv
        user_id: 当前操作用户ID，用于权限校验
        
    Returns:
        FileResponse: 错误报告文件流
        
    Raises:
        HTTPException: 404 - 任务不存在或报告已过期
        HTTPException: 403 - 无权访问
        
    Note:
        - 下载链接有效期24小时
        - CSV格式使用UTF-8 BOM编码以支持Excel正确显示中文
    """
    service = get_task_service()
    
    try:
        file_path = service.generate_error_report(task_id, format)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在或报告已过期")
    except PermissionError:
        raise HTTPException(status_code=403, detail="无权访问该报告")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成报告失败: {str(e)}")
    
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if format == "csv":
        content_type = "text/csv; charset=utf-8-sig"
    
    return FileResponse(
        path=file_path,
        filename=f"import_error_report_{task_id}.{format}",
        media_type=content_type
    )


@router.get(
    "/import",
    response_model=List[TaskProgress],
    summary="查询用户导入任务列表",
    description="获取当前用户的导入任务历史记录列表"
)
async def list_user_import_tasks(
    status: Optional[TaskStatus] = Query(None, description="按状态筛选"),
    limit: int = Query(20, ge=1, le=100, description="返回记录数"),
    offset: int = Query(0, ge=0, description="分页偏移量"),
    user_id: str = Depends(get_current_user_id)
) -> List[TaskProgress]:
    """获取当前用户的导入任务列表
    
    Args:
        status: 可选的状态过滤条件
        limit: 每页返回的记录数，默认20，最大100
        offset: 分页偏移量
        user_id: 当前操作用户ID
        
    Returns:
        List[TaskProgress]: 任务进度对象列表，按创建时间倒序排列
        
    Example:
        >>> GET /api/v1/tasks/import?status=COMPLETED&limit=10
        >>> Response: [TaskProgress(...), TaskProgress(...)]
    """
    service = get_task_service()
    
    try:
        tasks = service.list_user_tasks(
            user_id=user_id,
            status=status.value if status else None,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询任务列表失败: {str(e)}")
    
    return [
        TaskProgress(
            task_id=task.task_id,
            status=TaskStatus(task.status),
            progress=task.progress,
            total_rows=task.total_rows,
            processed_rows=task.processed_rows,
            imported_rows=task.imported_rows,
            failed_rows=task.failed_rows,
            created_at=task.created_at,
            updated_at=task.updated_at,
            error_message=task.error_message
        )
        for task in tasks
    ]


@router.post(
    "/import/{task_id}/cancel",
    summary="取消导入任务",
    description="取消正在排队或处理中的导入任务"
)
async def cancel_import_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """取消指定的导入任务
    
    Args:
        task_id: 需要取消的任务ID
        user_id: 当前操作用户ID
        
    Returns:
        Dict: 包含取消结果的字典
        
    Raises:
        HTTPException: 404 - 任务不存在
        HTTPException: 400 - 任务已结束无法取消
        HTTPException: 403 - 无权操作
        
    Note:
        - 仅 PENDING/QUEUED/PROCESSING 状态的任务可被取消
        - 已完成或失败的任务无法取消
    """
    service = get_task_service()
    
    try:
        success = service.cancel_task(task_id, user_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="无权取消该任务")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")
    
    return {
        "success": success,
        "task_id": task_id,
        "message": "任务已成功取消" if success else "任务取消失败"
    }


@router.post(
    "/import/{task_id}/retry",
    response_model=TaskProgress,
    summary="重试失败的导入任务",
    description="重新执行之前失败的导入任务"
)
async def retry_import_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id)
) -> TaskProgress:
    """重试之前失败的导入任务
    
    Args:
        task_id: 需要重试的任务ID
        user_id: 当前操作用户ID
        
    Returns:
        TaskProgress: 新创建的重试任务进度信息
        
    Raises:
        HTTPException: 404 - 原任务不存在
        HTTPException: 400 - 原任务状态不允许重试
        HTTPException: 403 - 无权操作
        
    Note:
        - 仅 FAILED 状态的任务可以重试
        - 重试会创建新的任务ID
    """
    service = get_task_service()
    
    try:
        new_task = service.retry_task(task_id, user_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="无权重试该任务")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重试任务失败: {str(e)}")
    
    return TaskProgress(
        task_id=new_task.task_id,
        status=TaskStatus(new_task.status),
        progress=new_task.progress,
        total_rows=new_task.total_rows,
        processed_rows=new_task.processed_rows,
        imported_rows=new_task.imported_rows,
        failed_rows=new_task.failed_rows,
        created_at=new_task.created_at,
        updated_at=new_task.updated_at,
        error_message=new_task.error_message
    )


@router.get(
    "/import/active/count",
    summary="获取用户活跃任务数",
    description="获取当前用户正在进行的导入任务数量"
)
async def get_active_task_count(
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """获取当前用户的活跃导入任务数量
    
    Args:
        user_id: 当前操作用户ID
        
    Returns:
        Dict: 包含活跃任务数量的字典
        
    Note:
        - 活跃状态包括: PENDING, QUEUED, PROCESSING
        - 最多同时进行10个导入任务
    """
    service = get_task_service()
    
    try:
        count = service.get_user_active_task_count(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")
    
    return {
        "active_count": count,
        "max_allowed": 10,
        "can_create_new": count < 10
    }