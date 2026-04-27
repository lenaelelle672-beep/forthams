"""
资产批量导入导出 API 端点模块。

提供 Excel/CSV 格式的资产数据批量导入导出功能，支持字段级校验、
部分导入模式和异步处理机制。

功能标识: SWARM-2025-Q2-P2-006 (Iteration 2)
Phase: Phase 2 - 数据交换层

主要端点:
    - POST /api/v1/assets/import - 批量导入资产数据
    - GET /api/v1/assets/export - 导出资产数据
    - GET /api/v1/assets/import/template - 生成导入模板
    - GET /api/v1/import/tasks/{task_id} - 查询异步任务状态
    - GET /api/v1/import/tasks/{task_id}/download - 下载错误报告

支持文件格式:
    - .xlsx (Excel 2007+)
    - .xls (Excel 97-2003)
    - .csv (UTF-8 编码)

导入约束:
    - 单文件大小: ≤ 50MB
    - 单次导入行数: ≤ 100,000 行
    - 小文件(<5MB)同步处理，大文件异步处理
"""

import logging
from datetime import datetime
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, BackgroundTasks, Depends
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from src.models.import_task import ImportTask, ImportTaskStatus
from src.services.import_service import ImportService
from src.services.export_service import ExportService
from src.services.validation_service import ValidationService
from src.schemas.asset_schema import AssetImportSchema
from src.parsers.excel_parser import ExcelParser
from src.parsers.csv_parser import CsvParser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["资产批量导入导出"])

# 依赖注入的服务实例
_import_service: Optional[ImportService] = None
_export_service: Optional[ExportService] = None


def get_import_service() -> ImportService:
    """
    获取导入服务实例的依赖注入函数。

    Returns:
        ImportService: 导入服务实例

    Raises:
        RuntimeError: 当服务未初始化时抛出
    """
    global _import_service
    if _import_service is None:
        raise RuntimeError("ImportService not initialized")
    return _import_service


def get_export_service() -> ExportService:
    """
    获取导出服务实例的依赖注入函数。

    Returns:
        ExportService: 导出服务实例

    Raises:
        RuntimeError: 当服务未初始化时抛出
    """
    global _export_service
    if _export_service is None:
        raise RuntimeError("ExportService not initialized")
    return _export_service


# ========================
# 请求/响应模型
# ========================


class ImportRequest(BaseModel):
    """
    资产批量导入请求模型。

    Attributes:
        mode: 导入模式，strict=全量失败，partial=部分导入
        overwrite: 是否覆盖已存在的资产记录
    """
    mode: str = Field(default="partial", description="导入模式: strict(全量失败) / partial(部分导入)")
    overwrite: bool = Field(default=False, description="是否覆盖已存在资产")


class ImportErrorDetail(BaseModel):
    """
    导入错误详情模型。

    Attributes:
        row: 错误行号
        field: 错误字段名
        message: 错误描述
        original_value: 原始值
    """
    row: int = Field(description="错误行号（从1开始）")
    field: str = Field(description="错误字段名")
    message: str = Field(description="错误原因描述")
    original_value: Optional[str] = Field(default=None, description="导致错误的原始值")


class ImportResponse(BaseModel):
    """
    资产批量导入响应模型。

    Attributes:
        success: 是否成功
        imported: 成功导入的行数
        failed: 失败的行数
        errors: 错误详情列表
        task_id: 异步任务ID（用于大文件导入）
        error_report_url: 错误报告下载链接
        total_rows: 总行数
    """
    success: bool = Field(description="导入是否成功")
    imported: int = Field(default=0, description="成功导入的行数")
    failed: int = Field(default=0, description="失败的行数")
    errors: list[ImportErrorDetail] = Field(default_factory=list, description="错误详情列表")
    task_id: Optional[str] = Field(default=None, description="异步任务ID")
    error_report_url: Optional[str] = Field(default=None, description="错误报告下载链接")
    total_rows: int = Field(default=0, description="总处理行数")


class ExportRequest(BaseModel):
    """
    资产批量导出请求模型。

    Attributes:
        format: 导出格式，xlsx 或 csv
        status: 按状态筛选
        department: 按部门筛选
        date_from: 采购日期起始
        date_to: 采购日期截止
    """
    format: str = Field(description="导出格式: xlsx / csv")
    status: Optional[str] = Field(default=None, description="按状态筛选")
    department: Optional[str] = Field(default=None, description="按部门筛选")
    date_from: Optional[str] = Field(default=None, description="采购日期起始 (YYYY-MM-DD)")
    date_to: Optional[str] = Field(default=None, description="采购日期截止 (YYYY-MM-DD)")


class TemplateResponse(BaseModel):
    """
    导入模板生成响应模型。

    Attributes:
        template_url: 模板文件下载链接
        format: 模板格式
        fields: 包含的字段列表
        required_fields: 必填字段列表
    """
    template_url: str = Field(description="模板文件下载链接")
    format: str = Field(description="模板格式")
    fields: list[str] = Field(description="包含的所有字段")
    required_fields: list[str] = Field(description="必填字段列表")


class TaskStatusResponse(BaseModel):
    """
    异步任务状态查询响应模型。

    Attributes:
        task_id: 任务ID
        status: 当前状态
        progress: 进度百分比
        total_rows: 总行数
        processed_rows: 已处理行数
        imported: 已成功导入行数
        failed: 失败行数
        error_message: 错误信息（如有）
        created_at: 任务创建时间
        completed_at: 任务完成时间
    """
    task_id: str = Field(description="任务ID")
    status: str = Field(description="任务状态: PENDING / PROCESSING / QUEUED / COMPLETED / FAILED")
    progress: int = Field(default=0, description="进度百分比 0-100")
    total_rows: int = Field(default=0, description="总行数")
    processed_rows: int = Field(default=0, description="已处理行数")
    imported: int = Field(default=0, description="成功导入行数")
    failed: int = Field(default=0, description="失败行数")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    created_at: datetime = Field(description="任务创建时间")
    completed_at: Optional[datetime] = Field(default=None, description="任务完成时间")


# ========================
# 导入端点
# ========================


@router.post("/assets/import", response_model=ImportResponse)
async def import_assets(
    file: UploadFile = File(..., description="要导入的 Excel/CSV 文件"),
    mode: str = Query(default="partial", description="导入模式: strict / partial"),
    overwrite: bool = Query(default=False, description="是否覆盖已存在资产"),
    background_tasks: BackgroundTasks = None,
    import_service: ImportService = Depends(get_import_service)
) -> ImportResponse:
    """
    批量导入资产数据。

    支持 Excel (.xlsx/.xls) 和 CSV (.csv) 格式的文件。
    小文件（<5MB）同步处理，大文件（5-50MB）异步处理。

    字段约束:
        - asset_id: 必填，唯一性校验，1-64字符
        - asset_name: 必填，1-128字符
        - asset_type: 必填，枚举值：EQUIPMENT/INSTRUMENT/VEHICLE/OTHER
        - purchase_date: 必填，YYYY-MM-DD 格式
        - purchase_amount: 必填，≥0，精度2位
        - department: 必填，需匹配已存在部门
        - status: 必填，枚举值：ACTIVE/MAINTENANCE/SCRAPPED
        - location: 可选，1-128字符
        - description: 可选，0-512字符

    Args:
        file: 上传的 Excel/CSV 文件
        mode: 导入模式，strict=全量失败，partial=部分导入
        overwrite: 是否覆盖已存在的资产记录
        background_tasks: FastAPI 后台任务
        import_service: 导入服务实例

    Returns:
        ImportResponse: 导入结果响应

    Raises:
        HTTPException 400: 文件格式不支持
        HTTPException 413: 文件大小超出限制（50MB）
        HTTPException 422: 文件解析失败
    """
    logger.info(f"Received import request: file={file.filename}, mode={mode}")

    # 校验文件格式
    allowed_extensions = {".xlsx", ".xls", ".csv"}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {file_ext}，支持的格式: {', '.join(allowed_extensions)}"
        )

    # 读取文件内容
    file_content = await file.read()
    file_size = len(file_content)

    # 校验文件大小 (50MB 限制)
    max_size = 50 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超出限制: {file_size / (1024*1024):.2f}MB，最大允许 50MB"
        )

    try:
        # 根据文件格式选择解析器
        if file_ext in {".xlsx", ".xls"}:
            parser = ExcelParser()
        else:
            parser = CsvParser()

        # 解析文件获取数据行
        rows = parser.parse(file_content)
        total_rows = len(rows)

        # 小文件同步处理 (< 5MB)
        small_file_threshold = 5 * 1024 * 1024
        if file_size < small_file_threshold:
            result = import_service.process_import(
                rows=rows,
                mode=mode,
                overwrite=overwrite
            )
            return ImportResponse(
                success=result["imported"] > 0,
                imported=result["imported"],
                failed=result["failed"],
                errors=[
                    ImportErrorDetail(
                        row=err["row"],
                        field=err["field"],
                        message=err["message"],
                        original_value=err.get("original_value")
                    ) for err in result.get("errors", [])
                ],
                total_rows=total_rows
            )
        else:
            # 大文件异步处理
            task_id = import_service.create_async_task(
                file_content=file_content,
                file_name=file.filename,
                file_format=file_ext,
                mode=mode,
                overwrite=overwrite
            )

            return ImportResponse(
                success=True,
                imported=0,
                failed=0,
                errors=[],
                task_id=task_id,
                total_rows=total_rows
            )

    except Exception as e:
        logger.error(f"Import failed: {str(e)}")
        raise HTTPException(status_code=422, detail=f"文件解析失败: {str(e)}")


@router.get("/assets/import/template")
async def generate_import_template(
    format: str = Query(default="xlsx", description="模板格式: xlsx / csv"),
    import_service: ImportService = Depends(get_import_service)
) -> TemplateResponse:
    """
    生成资产导入模板文件。

    生成包含所有资产字段的 Excel/CSV 模板文件，
    必填字段有颜色/符号标记。

    模板字段（9个）:
        1. asset_id (必填) - 资产编号
        2. asset_name (必填) - 资产名称
        3. asset_type (必填) - 资产类型
        4. purchase_date (必填) - 采购日期
        5. purchase_amount (必填) - 采购金额
        6. department (必填) - 所属部门
        7. status (必填) - 资产状态
        8. location (可选) - 存放位置
        9. description (可选) - 资产描述

    Args:
        format: 模板格式，xlsx 或 csv
        import_service: 导入服务实例

    Returns:
        TemplateResponse: 模板响应，包含下载链接

    Raises:
        HTTPException 400: 不支持的模板格式
    """
    logger.info(f"Generating import template: format={format}")

    allowed_formats = {"xlsx", "csv"}
    if format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的模板格式: {format}，支持的格式: {', '.join(allowed_formats)}"
        )

    # 定义模板字段
    fields = [
        "asset_id", "asset_name", "asset_type", "purchase_date",
        "purchase_amount", "department", "status", "location", "description"
    ]
    required_fields = [
        "asset_id", "asset_name", "asset_type", "purchase_date",
        "purchase_amount", "department", "status"
    ]

    # 生成模板文件
    template_path = import_service.generate_template(format=format)

    return TemplateResponse(
        template_url=f"/api/v1/assets/import/template/download?format={format}",
        format=format,
        fields=fields,
        required_fields=required_fields
    )


# ========================
# 导出端点
# ========================


@router.get("/assets/export")
async def export_assets(
    format: str = Query(default="xlsx", description="导出格式: xlsx / csv"),
    status: Optional[str] = Query(default=None, description="按状态筛选"),
    department: Optional[str] = Query(default=None, description="按部门筛选"),
    date_from: Optional[str] = Query(default=None, description="采购日期起始 YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="采购日期截止 YYYY-MM-DD"),
    export_service: ExportService = Depends(get_export_service)
) -> StreamingResponse:
    """
    批量导出资产数据。

    支持按状态、部门、日期范围筛选导出的资产。
    导出格式为 Excel (.xlsx) 或 CSV (.csv)。

    导出字段与导入模板字段一致。

    Args:
        format: 导出格式，xlsx 或 csv
        status: 按资产状态筛选 (ACTIVE/MAINTENANCE/SCRAPPED)
        department: 按部门筛选
        date_from: 采购日期起始 (YYYY-MM-DD)
        date_to: 采购日期截止 (YYYY-MM-DD)
        export_service: 导出服务实例

    Returns:
        StreamingResponse: 文件流响应

    Raises:
        HTTPException 400: 不支持的导出格式
        HTTPException 404: 无匹配数据
    """
    logger.info(
        f"Export request: format={format}, status={status}, "
        f"department={department}, date_from={date_from}, date_to={date_to}"
    )

    allowed_formats = {"xlsx", "csv"}
    if format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的导出格式: {format}，支持的格式: {', '.join(allowed_formats)}"
        )

    # 构建筛选条件
    filters = {}
    if status:
        filters["status"] = status
    if department:
        filters["department"] = department
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to

    try:
        # 生成导出文件
        file_stream, filename = export_service.export_assets(
            format=format,
            filters=filters
        )

        # 设置响应头
        if format == "xlsx":
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            media_type = "text/csv; charset=utf-8"

        return StreamingResponse(
            file_stream,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


# ========================
# 异步任务管理端点
# ========================


@router.get("/import/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_import_task_status(
    task_id: str,
    import_service: ImportService = Depends(get_import_service)
) -> TaskStatusResponse:
    """
    查询异步导入任务状态。

    用于查询大文件导入任务的处理进度和结果。

    Args:
        task_id: 任务ID
        import_service: 导入服务实例

    Returns:
        TaskStatusResponse: 任务状态响应

    Raises:
        HTTPException 404: 任务不存在
    """
    logger.info(f"Querying task status: task_id={task_id}")

    task = import_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    # 计算进度百分比
    progress = 0
    if task.total_rows > 0:
        progress = int((task.processed_rows / task.total_rows) * 100)

    return TaskStatusResponse(
        task_id=task.task_id,
        status=task.status.value,
        progress=progress,
        total_rows=task.total_rows,
        processed_rows=task.processed_rows,
        imported=task.imported,
        failed=task.failed,
        error_message=task.error_message,
        created_at=task.created_at,
        completed_at=task.completed_at
    )


@router.get("/import/tasks/{task_id}/download")
async def download_import_error_report(
    task_id: str,
    format: str = Query(default="xlsx", description="报告格式: xlsx / csv"),
    import_service: ImportService = Depends(get_import_service)
) -> FileResponse:
    """
    下载导入错误报告。

    下载指定任务的错误详情报告，支持 Excel 和 CSV 格式。

    Args:
        task_id: 任务ID
        format: 报告格式，xlsx 或 csv
        import_service: 导入服务实例

    Returns:
        FileResponse: 错误报告文件

    Raises:
        HTTPException 404: 任务不存在或报告不存在
        HTTPException 400: 不支持的格式
    """
    logger.info(f"Downloading error report: task_id={task_id}, format={format}")

    allowed_formats = {"xlsx", "csv"}
    if format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的报告格式: {format}"
        )

    report_path = import_service.get_error_report_path(task_id, format=format)
    if not report_path or not Path(report_path).exists():
        raise HTTPException(status_code=404, detail="错误报告不存在或已过期")

    if format == "xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        media_type = "text/csv; charset=utf-8"

    filename = f"import_error_report_{task_id}.{format}"
    return FileResponse(
        path=report_path,
        media_type=media_type,
        filename=filename
    )


# ========================
# 辅助端点
# ========================


@router.get("/import/tasks/active-count")
async def get_user_active_task_count(
    user_id: str = Query(..., description="用户ID"),
    import_service: ImportService = Depends(get_import_service)
) -> dict:
    """
    获取用户当前活跃的导入任务数。

    用于前端显示用户正在处理的导入任务数量。

    Args:
        user_id: 用户ID
        import_service: 导入服务实例

    Returns:
        dict: 包含活跃任务数的字典

    Raises:
        HTTPException 400: 用户ID参数缺失
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id 参数不能为空")

    count = import_service.get_user_active_task_count(user_id)
    return {"active_count": count, "max_concurrent": 10}


# ========================
# 服务初始化
# ========================


def init_import_endpoints(
    import_svc: ImportService,
    export_svc: ExportService
) -> None:
    """
    初始化导入导出端点的服务依赖。

    Args:
        import_svc: 导入服务实例
        export_svc: 导出服务实例
    """
    global _import_service, _export_service
    _import_service = import_svc
    _export_service = export_svc
    logger.info("Import endpoints services initialized")