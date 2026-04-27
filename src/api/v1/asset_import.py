"""
资产批量导入 API 模块。

本模块提供资产数据的批量导入功能，支持 CSV 和 Excel 格式。
主要功能包括：
    - CSV/Excel 文件上传与解析
    - 字段级数据校验（必填、格式、枚举值）
    - 同步/异步导入处理（>1000条触发异步）
    - 导入任务状态跟踪
    - 错误报告生成与下载

相关规格: SWARM-2025-Q2-P2-006
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
import io
import csv
import uuid
from enum import Enum

from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

# 导入相关服务层
from services.import_service import ImportService
from services.export_service import ExportService
from services.validation_service import ValidationService
from parsers.csv_parser import CSVParser
from parsers.excel_parser import ExcelParser
from models.import_task import ImportTask, ImportTaskStatus, ImportError
from api.dependencies.db import get_db

# ============== 枚举定义 ==============

class AssetTypeEnum(str, Enum):
    """资产类型枚举"""
    EQUIPMENT = "EQUIPMENT"
    FURNITURE = "FURNITURE"
    VEHICLE = "VEHICLE"
    IT_HARDWARE = "IT_HARDWARE"
    OTHER = "OTHER"


class CurrencyEnum(str, Enum):
    """货币类型枚举"""
    CNY = "CNY"
    USD = "USD"
    EUR = "EUR"
    JPY = "JPY"
    GBP = "GBP"


class AssetStatusEnum(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"


# ============== 请求/响应模型 ==============

class ImportUploadResponse(BaseModel):
    """导入上传响应模型"""
    task_id: str = Field(..., description="导入任务ID")
    total_rows: int = Field(..., description="总行数")
    status: ImportTaskStatus = Field(..., description="任务状态")
    message: str = Field(..., description="处理信息")
    is_async: bool = Field(..., description="是否异步处理")


class ImportTaskResponse(BaseModel):
    """导入任务状态响应模型"""
    task_id: str
    status: ImportTaskStatus
    total_rows: int
    processed_rows: int = 0
    success_rows: int = 0
    failed_rows: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class ImportTaskListResponse(BaseModel):
    """导入任务列表响应模型"""
    tasks: List[ImportTaskResponse]
    total: int
    page: int
    page_size: int


class ImportFieldSchema(BaseModel):
    """导入字段定义模型"""
    asset_id: Optional[str] = Field(None, description="资产ID（可选，导入时为空则自动生成）")
    asset_name: str = Field(..., max_length=50, description="资产名称（必填）")
    asset_type: AssetTypeEnum = Field(..., description="资产类型（必填）")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号（可选）")
    purchase_date: str = Field(..., description="购买日期（必填，YYYY-MM-DD格式）")
    purchase_price: float = Field(..., gt=0, description="购买价格（必填，>0）")
    currency: CurrencyEnum = Field(CurrencyEnum.CNY, description="货币类型")
    department: str = Field(..., description="所属部门（必填，需匹配已存在的部门编码）")
    custodian: Optional[str] = Field(None, max_length=100, description="保管人（可选）")
    status: AssetStatusEnum = Field(..., description="资产状态（必填）")
    location: Optional[str] = Field(None, max_length=200, description="存放位置（可选）")
    remarks: Optional[str] = Field(None, max_length=500, description="备注（可选）")

    @validator('purchase_date')
    def validate_purchase_date(cls, v):
        """验证日期格式是否为 YYYY-MM-DD"""
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError('purchase_date must be in YYYY-MM-DD format')
        return v


# ============== API 路由定义 ==============

router = APIRouter(prefix="/api/v1/assets/import", tags=["资产导入"])

# 服务实例（依赖注入）
import_service = ImportService()
validation_service = ValidationService()
csv_parser = CSVParser()
excel_parser = ExcelParser()


@router.post("/upload", response_model=ImportUploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Query(None, description="用户ID")
):
    """
    上传文件触发导入任务。

    处理逻辑：
    1. 验证文件格式（仅支持 CSV 和 XLSX）
    2. 验证文件大小（不超过 10MB）
    3. 验证文件行数（不超过 5000 行）
    4. 解析文件内容
    5. 校验数据字段
    6. 根据数据量决定同步/异步处理
       - ≤1000 条：同步处理
       - >1000 条：异步处理

    Args:
        background_tasks: FastAPI 后台任务
        file: 上传的文件
        db: 数据库会话
        user_id: 用户ID

    Returns:
        ImportUploadResponse: 包含任务ID和处理信息

    Raises:
        HTTPException: 文件验证失败时抛出
    """
    # 1. 验证文件格式
    allowed_extensions = {'.csv', '.xlsx'}
    file_ext = '.' + file.filename.split('.')[-1].lower() if file.filename else ''
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed formats: {', '.join(allowed_extensions)}"
        )

    # 2. 读取文件内容并验证大小
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    
    if file_size_mb > 10:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds 10MB limit"
        )

    # 3. 解析文件内容
    try:
        if file_ext == '.csv':
            rows = csv_parser.parse(io.BytesIO(contents))
        else:
            rows = excel_parser.parse(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"File parsing failed: {str(e)}"
        )

    # 4. 验证行数
    total_rows = len(rows)
    if total_rows > 5000:
        raise HTTPException(
            status_code=413,
            detail="Row count exceeds 5000 limit"
        )

    # 5. 创建导入任务
    task_id = str(uuid.uuid4())
    task = ImportTask(
        task_id=task_id,
        user_id=user_id,
        file_name=file.filename,
        total_rows=total_rows,
        status=ImportTaskStatus.PENDING,
        created_at=datetime.now()
    )

    # 6. 校验数据
    validation_result = validation_service.validate_rows(rows)
    
    if not validation_result.is_valid:
        # 更新任务状态为校验失败
        task.status = ImportTaskStatus.VALIDATION_FAILED
        task.error_message = f"Validation failed: {len(validation_result.errors)} errors"
        import_service.save_task(task)
        
        return ImportUploadResponse(
            task_id=task_id,
            total_rows=total_rows,
            status=ImportTaskStatus.VALIDATION_FAILED,
            message=f"Validation failed: {len(validation_result.errors)} errors",
            is_async=False
        )

    # 7. 根据数据量决定处理方式
    is_async = total_rows > 1000
    task.status = ImportTaskStatus.PROCESSING

    if is_async:
        # 异步处理
        background_tasks.add_task(
            import_service.process_async_import,
            task_id=task_id,
            rows=rows,
            user_id=user_id,
            db_session=db
        )
        message = f"Import task started asynchronously. Task ID: {task_id}"
    else:
        # 同步处理
        result = import_service.process_sync_import(
            task_id=task_id,
            rows=rows,
            user_id=user_id,
            db_session=db
        )
        task.processed_rows = result.get('processed_rows', total_rows)
        task.success_rows = result.get('success_rows', 0)
        task.failed_rows = result.get('failed_rows', 0)
        task.status = ImportTaskStatus.COMPLETED if result.get('success_rows', 0) > 0 else ImportTaskStatus.FAILED
        task.completed_at = datetime.now()
        message = f"Import completed. Success: {task.success_rows}, Failed: {task.failed_rows}"

    import_service.save_task(task)

    return ImportUploadResponse(
        task_id=task_id,
        total_rows=total_rows,
        status=task.status,
        message=message,
        is_async=is_async
    )


@router.get("/tasks", response_model=ImportTaskListResponse)
async def list_import_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_id: str = Query(None, description="用户ID"),
    db: Session = Depends(get_db)
):
    """
    列出当前用户的导入任务。

    Args:
        page: 页码
        page_size: 每页数量
        user_id: 用户ID
        db: 数据库会话

    Returns:
        ImportTaskListResponse: 任务列表响应
    """
    tasks, total = import_service.list_tasks(
        user_id=user_id,
        page=page,
        page_size=page_size
    )
    
    return ImportTaskListResponse(
        tasks=[
            ImportTaskResponse(
                task_id=task.task_id,
                status=task.status,
                total_rows=task.total_rows,
                processed_rows=task.processed_rows,
                success_rows=task.success_rows,
                failed_rows=task.failed_rows,
                created_at=task.created_at,
                completed_at=task.completed_at,
                error_message=task.error_message
            )
            for task in tasks
        ],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/tasks/{task_id}", response_model=ImportTaskResponse)
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    查询导入任务状态。

    Args:
        task_id: 任务ID
        db: 数据库会话

    Returns:
        ImportTaskResponse: 任务状态响应

    Raises:
        HTTPException: 任务不存在时抛出
    """
    task = import_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail=f"Task not found: {task_id}"
        )
    
    return ImportTaskResponse(
        task_id=task.task_id,
        status=task.status,
        total_rows=task.total_rows,
        processed_rows=task.processed_rows,
        success_rows=task.success_rows,
        failed_rows=task.failed_rows,
        created_at=task.created_at,
        completed_at=task.completed_at,
        error_message=task.error_message
    )


@router.get("/tasks/{task_id}/report")
async def download_error_report(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    下载导入错误报告。

    生成 CSV 格式的错误报告，包含：
    - row_number: 行号
    - error_field: 错误字段
    - error_detail: 错误详情

    Args:
        task_id: 任务ID
        db: 数据库会话

    Returns:
        StreamingResponse: CSV 文件下载流

    Raises:
        HTTPException: 任务不存在或报告不存在时抛出
    """
    task = import_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail=f"Task not found: {task_id}"
        )
    
    # 获取错误列表
    errors = import_service.get_task_errors(task_id)
    
    if not errors:
        raise HTTPException(
            status_code=404,
            detail="No errors found for this task"
        )
    
    # 生成 CSV 报告
    output = io.StringIO()
    writer = csv.writer(output)
    
    # 写入表头
    writer.writerow(['row_number', 'error_field', 'error_detail'])
    
    # 写入错误数据
    for error in errors:
        writer.writerow([
            error.get('row_number', ''),
            error.get('field', ''),
            error.get('message', '')
        ])
    
    # 准备响应
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=import_error_report_{task_id}.csv'
        }
    )
    
    return response


@router.delete("/tasks/{task_id}")
async def cancel_import_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    取消导入任务（仅允许取消进行中的任务）。

    Args:
        task_id: 任务ID
        db: 数据库会话

    Returns:
        dict: 取消结果

    Raises:
        HTTPException: 任务不存在或无法取消时抛出
    """
    task = import_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail=f"Task not found: {task_id}"
        )
    
    if task.status not in [ImportTaskStatus.PENDING, ImportTaskStatus.PROCESSING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status: {task.status}"
        )
    
    # 取消任务
    import_service.cancel_task(task_id)
    
    return {"message": "Task cancelled successfully", "task_id": task_id}