"""
资产批量导出 API 端点

【SWARM-2025-Q2-P2-006】资产批量导入导出 - Iteration 2
Phase 2: 数据交换层

功能说明：
    支持用户通过 Excel/CSV 格式批量导出资产数据
    - 支持多格式导出：xlsx / csv
    - 支持按状态、部门、日期范围筛选
    - 支持大文件流式导出
    - 导出字段与导入模板一致

导出字段对照表：
    - asset_id: 资产编号
    - asset_name: 资产名称
    - asset_type: 资产类型 (EQUIPMENT/INSTRUMENT/VEHICLE/OTHER)
    - purchase_date: 采购日期 (YYYY-MM-DD)
    - purchase_amount: 采购金额
    - department: 所属部门
    - status: 资产状态 (ACTIVE/MAINTENANCE/SCRAPPED)
    - location: 存放地点
    - description: 资产描述

性能约束：
    - 单次导出行数上限: 500,000 行
    - 导出响应时间: ≤ 10s
    - 大文件采用流式导出

安全约束：
    - 导出下载链接有效期: 24h
    - 操作日志记录: user_id, timestamp, file_name

参考文献：
    - src/services/export_service.py
    - src/utils/excel_generator.py
    - src/parsers/excel_parser.py
"""

from typing import Optional, List
from datetime import datetime, date
from enum import Enum
import logging
from pathlib import Path

from fastapi import APIRouter, Query, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from src.services.export_service import ExportService
from src.utils.excel_generator import ExcelGenerator
from src.models.asset import AssetStatus, AssetType
from src.repositories.asset_repository import AssetRepository
from src.api.dependencies.db import get_db_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assets", tags=["资产导出"])


class ExportFormat(str, Enum):
    """导出格式枚举"""
    XLSX = "xlsx"
    CSV = "csv"


class AssetExportFilter(BaseModel):
    """
    资产导出筛选条件模型
    
    Attributes:
        status: 按资产状态筛选
        department: 按部门筛选
        date_from: 采购日期起始
        date_to: 采购日期截止
    """
    status: Optional[AssetStatus] = Field(None, description="资产状态筛选")
    department: Optional[str] = Field(None, description="部门筛选")
    date_from: Optional[date] = Field(None, description="采购日期起始 (YYYY-MM-DD)")
    date_to: Optional[date] = Field(None, description="采购日期截止 (YYYY-MM-DD)")


class ExportTaskResponse(BaseModel):
    """
    导出任务响应模型
    
    Attributes:
        task_id: 任务ID
        status: 任务状态
        created_at: 创建时间
        download_url: 下载链接 (24h有效)
        expires_at: 过期时间
    """
    task_id: str
    status: str
    created_at: datetime
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None


class ExportMetadata(BaseModel):
    """
    导出元数据模型
    
    Attributes:
        total_count: 总导出行数
        filters: 应用的筛选条件
        exported_at: 导出时间
        file_size: 文件大小 (bytes)
    """
    total_count: int
    filters: Optional[dict]
    exported_at: datetime
    file_size: int


def _validate_export_params(
    format: ExportFormat,
    max_rows: int = 500000
) -> None:
    """
    验证导出参数
    
    Args:
        format: 导出格式
        max_rows: 最大导出行数限制
        
    Raises:
        HTTPException: 参数验证失败
    """
    if format not in [ExportFormat.XLSX, ExportFormat.CSV]:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的导出格式: {format}. 支持格式: xlsx, csv"
        )
    # 注意：实际行数限制在服务层校验


def _get_export_headers(format: ExportFormat) -> dict:
    """
    获取导出响应头
    
    Args:
        format: 导出格式
        
    Returns:
        dict: HTTP 响应头
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if format == ExportFormat.XLSX:
        return {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": f'attachment; filename="assets_export_{timestamp}.xlsx"',
        }
    else:  # CSV with UTF-8 BOM
        return {
            "Content-Type": "text/csv; charset=utf-8-sig",
            "Content-Disposition": f'attachment; filename="assets_export_{timestamp}.csv"',
        }


@router.get(
    "/export",
    summary="批量导出资产",
    description="""
    批量导出资产数据为 Excel/CSV 格式
    
    **筛选条件**:
    - status: 按资产状态筛选 (ACTIVE/MAINTENANCE/SCRAPPED)
    - department: 按部门编码筛选
    - date_from/date_to: 按采购日期范围筛选
    
    **导出字段** (与导入模板一致):
    - asset_id, asset_name, asset_type, purchase_date
    - purchase_amount, department, status, location, description
    
    **限制**:
    - 最大导出行数: 500,000 行
    - 超过限制自动分卷导出
    
    **响应**:
    - 小文件: 直接返回文件流
    - 大文件: 返回异步任务ID，查询任务状态获取结果
    """,
    responses={
        200: {
            "description": "导出成功，返回文件流",
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {},
                "text/csv": {}
            }
        },
        400: {"description": "参数错误"},
        401: {"description": "未认证"},
        403: {"description": "无导出权限"},
        500: {"description": "服务器错误"}
    }
)
async def export_assets(
    format: ExportFormat = Query(
        default=ExportFormat.XLSX,
        description="导出格式: xlsx 或 csv"
    ),
    status: Optional[AssetStatus] = Query(
        default=None,
        description="按资产状态筛选: ACTIVE, MAINTENANCE, SCRAPPED"
    ),
    department: Optional[str] = Query(
        default=None,
        description="按部门编码筛选"
    ),
    date_from: Optional[date] = Query(
        default=None,
        description="采购日期起始 (YYYY-MM-DD)"
    ),
    date_to: Optional[date] = Query(
        default=None,
        description="采购日期截止 (YYYY-MM-DD)"
    ),
    x_user_id: str = Header(default=None, alias="X-User-ID", description="用户ID"),
    x_user_ip: str = Header(default=None, alias="X-User-IP", description="用户IP"),
    db_session = Depends(get_db_session)
) -> StreamingResponse:
    """
    批量导出资产数据
    
    **参数说明**:
    - format: 导出格式 (xlsx/csv)
    - status: 状态筛选
    - department: 部门筛选
    - date_from/date_to: 日期范围筛选
    
    **返回值**:
    - StreamingResponse: 文件流
    
    **日志记录**:
    - 操作人: x_user_id
    - 操作IP: x_user_ip
    - 筛选条件: 全部参数
    """
    logger.info(
        f"[EXPORT] User {x_user_id} initiated asset export. "
        f"Format={format}, Status={status}, Dept={department}, "
        f"DateRange={date_from}~{date_to}, IP={x_user_ip}"
    )
    
    # 参数验证
    try:
        _validate_export_params(format)
    except HTTPException:
        raise
    
    # 构建筛选条件
    filters = AssetExportFilter(
        status=status,
        department=department,
        date_from=date_from,
        date_to=date_to
    )
    
    try:
        # 初始化服务
        export_service = ExportService(db_session=db_session)
        asset_repo = AssetRepository(db_session=db_session)
        
        # 获取资产数据
        assets_data = await export_service.get_assets_for_export(filters=filters)
        total_count = len(assets_data)
        
        logger.info(f"[EXPORT] Retrieved {total_count} assets for export")
        
        # 检查行数限制
        MAX_EXPORT_ROWS = 500000
        if total_count > MAX_EXPORT_ROWS:
            logger.warning(
                f"[EXPORT] Export exceeds max rows ({total_count} > {MAX_EXPORT_ROWS}). "
                f"Will create split files."
            )
            # 触发分卷导出
            return await _create_split_export(
                assets_data=assets_data,
                format=format,
                max_rows=MAX_EXPORT_ROWS,
                x_user_id=x_user_id,
                x_user_ip=x_user_ip
            )
        
        # 生成导出文件
        if format == ExportFormat.XLSX:
            file_stream, content_length = await _generate_xlsx_export(assets_data)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"assets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        else:
            file_stream, content_length = await _generate_csv_export(assets_data)
            content_type = "text/csv; charset=utf-8-sig"
            filename = f"assets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # 记录审计日志
        await _log_export_operation(
            user_id=x_user_id,
            user_ip=x_user_ip,
            format=format,
            total_count=total_count,
            file_size=content_length,
            filters=filters.model_dump()
        )
        
        logger.info(
            f"[EXPORT] Export completed. User={x_user_id}, "
            f"Count={total_count}, Size={content_length} bytes"
        )
        
        return StreamingResponse(
            iter([file_stream]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Total-Count": str(total_count),
                "X-Export-At": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"[EXPORT] Export failed. Error={str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"导出失败: {str(e)}"
        )


async def _generate_xlsx_export(assets_data: List[dict]) -> tuple:
    """
    生成 Excel 导出文件
    
    Args:
        assets_data: 资产数据列表
        
    Returns:
        tuple: (文件字节流, 文件大小)
    """
    excel_gen = ExcelGenerator()
    return await excel_gen.generate_asset_export(assets_data)


async def _generate_csv_export(assets_data: List[dict]) -> tuple:
    """
    生成 CSV 导出文件
    
    Args:
        assets_data: 资产数据列表
        
    Returns:
        tuple: (文件内容字符串, 文件大小)
    """
    import io
    
    output = io.StringIO()
    
    # 表头 (与导入模板一致)
    headers = [
        "asset_id", "asset_name", "asset_type", "purchase_date",
        "purchase_amount", "department", "status", "location", "description"
    ]
    output.write("\ufeff")  # UTF-8 BOM
    output.write(",".join(headers) + "\n")
    
    # 数据行
    for asset in assets_data:
        row = [
            _escape_csv_field(str(asset.get("asset_id", ""))),
            _escape_csv_field(str(asset.get("asset_name", ""))),
            _escape_csv_field(str(asset.get("asset_type", ""))),
            _escape_csv_field(str(asset.get("purchase_date", ""))),
            _escape_csv_field(str(asset.get("purchase_amount", ""))),
            _escape_csv_field(str(asset.get("department", ""))),
            _escape_csv_field(str(asset.get("status", ""))),
            _escape_csv_field(str(asset.get("location", ""))),
            _escape_csv_field(str(asset.get("description", "")))
        ]
        output.write(",".join(row) + "\n")
    
    content = output.getvalue()
    return content.encode("utf-8-sig"), len(content)


def _escape_csv_field(value: str) -> str:
    """
    CSV 字段转义
    
    Args:
        value: 原始字段值
        
    Returns:
        str: 转义后的字段值
    """
    if not value:
        return ""
    
    # 需要引号包围的情况: 包含逗号、引号、换行
    if any(char in value for char in [",", '"', "\n", "\r"]):
        # 双引号转义
        value = value.replace('"', '""')
        return f'"{value}"'
    
    return value


async def _create_split_export(
    assets_data: List[dict],
    format: ExportFormat,
    max_rows: int,
    x_user_id: str,
    x_user_ip: str
) -> JSONResponse:
    """
    创建分卷导出 (超过最大行数限制)
    
    Args:
        assets_data: 资产数据列表
        format: 导出格式
        max_rows: 每卷最大行数
        x_user_id: 用户ID
        x_user_ip: 用户IP
        
    Returns:
        JSONResponse: 包含分卷文件信息
    """
    logger.info(f"[EXPORT] Creating split export. Total={len(assets_data)}, MaxPerFile={max_rows}")
    
    # 计算分卷数量
    total_count = len(assets_data)
    num_splits = (total_count + max_rows - 1) // max_rows
    
    split_files = []
    export_service = ExportService()
    
    for i in range(num_splits):
        start_idx = i * max_rows
        end_idx = min((i + 1) * max_rows, total_count)
        chunk_data = assets_data[start_idx:end_idx]
        
        # 生成卷文件
        if format == ExportFormat.XLSX:
            file_stream, _ = await _generate_xlsx_export(chunk_data)
            filename = f"assets_export_part{i+1}_{num_splits}.xlsx"
        else:
            file_stream, _ = await _generate_csv_export(chunk_data)
            filename = f"assets_export_part{i+1}_{num_splits}.csv"
        
        # 保存到临时存储 (24h有效期)
        file_url = await export_service.save_temp_export_file(
            file_data=file_stream,
            filename=filename,
            user_id=x_user_id,
            ttl_hours=24
        )
        
        split_files.append({
            "part": i + 1,
            "total_parts": num_splits,
            "filename": filename,
            "record_count": len(chunk_data),
            "download_url": file_url,
            "expires_at": (datetime.now().timestamp() + 86400)
        })
    
    logger.info(f"[EXPORT] Split export completed. Total files={num_splits}")
    
    return JSONResponse(content={
        "success": True,
        "message": f"数据量 {total_count} 超过单次导出限制，已自动分 {num_splits} 卷导出",
        "total_records": total_count,
        "split_files": split_files
    })


async def _log_export_operation(
    user_id: str,
    user_ip: str,
    format: ExportFormat,
    total_count: int,
    file_size: int,
    filters: dict
) -> None:
    """
    记录导出操作审计日志
    
    Args:
        user_id: 用户ID
        user_ip: 用户IP
        format: 导出格式
        total_count: 导出记录数
        file_size: 文件大小
        filters: 筛选条件
    """
    try:
        from src.services.audit_service import AuditService
        audit_service = AuditService()
        
        await audit_service.log_operation(
            operation_type="ASSET_EXPORT",
            user_id=user_id,
            user_ip=user_ip,
            details={
                "format": format.value,
                "record_count": total_count,
                "file_size": file_size,
                "filters": filters
            }
        )
    except Exception as e:
        logger.warning(f"[EXPORT] Failed to log audit: {str(e)}")


@router.get(
    "/export/template",
    summary="下载导出模板",
    description="""
    下载资产数据导出模板
    
    返回包含所有导出字段的表头模板，
    用于参考导出格式或作为导入模板。
    
    **模板字段**:
    - asset_id, asset_name, asset_type, purchase_date
    - purchase_amount, department, status, location, description
    
    **用途**:
    - 了解导出字段格式
    - 作为批量导入的参考模板
    """,
    responses={
        200: {"description": "模板文件下载"},
        500: {"description": "服务器错误"}
    }
)
async def download_export_template(
    format: ExportFormat = Query(
        default=ExportFormat.XLSX,
        description="模板格式: xlsx 或 csv"
    )
) -> StreamingResponse:
    """
    下载导出模板文件
    
    **参数**:
    - format: 模板格式 (xlsx/csv)
    
    **返回值**:
    - StreamingResponse: 模板文件流
    """
    logger.info(f"[EXPORT] Downloading export template. Format={format}")
    
    try:
        # 模板表头
        headers = [
            "asset_id", "asset_name", "asset_type", "purchase_date",
            "purchase_amount", "department", "status", "location", "description"
        ]
        
        # 示例数据行 (用于展示格式)
        sample_rows = [
            ["ASM-001", "办公电脑 Dell OptiPlex 7090", "EQUIPMENT", "2024-01-15", 
             "5999.00", "IT-DEPT", "ACTIVE", "A栋3层", "2024年采购"],
            ["ASM-002", "精密测量仪 TRIMBLE R12", "INSTRUMENT", "2024-02-20",
             "158000.00", "R&D-DEPT", "ACTIVE", "B栋实验室", "高精度GPS设备"],
            ["ASM-003", "公务用车 Toyota Camry 2.0", "VEHICLE", "2023-06-10",
             "220000.00", "ADMIN-DEPT", "MAINTENANCE", "地下车库", "定期保养中"]
        ]
        
        if format == ExportFormat.XLSX:
            excel_gen = ExcelGenerator()
            file_stream, _ = await excel_gen.generate_template(headers, sample_rows)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "asset_export_template.xlsx"
        else:
            import io
            output = io.StringIO()
            output.write("\ufeff")
            output.write(",".join(headers) + "\n")
            for row in sample_rows:
                output.write(",".join(row) + "\n")
            file_stream = output.getvalue().encode("utf-8-sig")
            content_type = "text/csv; charset=utf-8-sig"
            filename = "asset_export_template.csv"
        
        return StreamingResponse(
            iter([file_stream]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"[EXPORT] Template generation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"模板生成失败: {str(e)}"
        )


@router.get(
    "/export/fields",
    summary="获取导出字段列表",
    description="""
    获取资产导出的完整字段列表及其说明
    
    **返回字段**:
    - field_name: 字段名
    - field_type: 数据类型
    - description: 字段说明
    - example: 示例值
    """,
    responses={
        200: {"description": "导出字段列表"}
    }
)
async def get_export_fields() -> JSONResponse:
    """
    获取导出字段定义
    
    **返回值**:
    - JSONResponse: 字段定义列表
    """
    fields = [
        {
            "field_name": "asset_id",
            "field_type": "string",
            "description": "资产编号 (唯一标识)",
            "example": "ASM-2024-001",
            "nullable": False
        },
        {
            "field_name": "asset_name",
            "field_type": "string",
            "description": "资产名称",
            "example": "办公电脑 Dell OptiPlex 7090",
            "nullable": False
        },
        {
            "field_name": "asset_type",
            "field_type": "enum",
            "description": "资产类型: EQUIPMENT/INSTRUMENT/VEHICLE/OTHER",
            "example": "EQUIPMENT",
            "nullable": False,
            "allowed_values": ["EQUIPMENT", "INSTRUMENT", "VEHICLE", "OTHER"]
        },
        {
            "field_name": "purchase_date",
            "field_type": "date",
            "description": "采购日期 (ISO 8601)",
            "example": "2024-01-15",
            "nullable": False,
            "format": "YYYY-MM-DD"
        },
        {
            "field_name": "purchase_amount",
            "field_type": "decimal",
            "description": "采购金额 (精度2位)",
            "example": "5999.00",
            "nullable": False,
            "min_value": 0
        },
        {
            "field_name": "department",
            "field_type": "string",
            "description": "所属部门编码",
            "example": "IT-DEPT",
            "nullable": False
        },
        {
            "field_name": "status",
            "field_type": "enum",
            "description": "资产状态: ACTIVE/MAINTENANCE/SCRAPPED",
            "example": "ACTIVE",
            "nullable": False,
            "allowed_values": ["ACTIVE", "MAINTENANCE", "SCRAPPED"]
        },
        {
            "field_name": "location",
            "field_type": "string",
            "description": "存放地点",
            "example": "A栋3层",
            "nullable": True
        },
        {
            "field_name": "description",
            "field_type": "string",
            "description": "资产描述备注",
            "example": "2024年采购，性能良好",
            "nullable": True,
            "max_length": 512
        }
    ]
    
    return JSONResponse(content={
        "success": True,
        "total_fields": len(fields),
        "fields": fields
    })


# 导出格式兼容性说明
EXPORT_FORMAT_COMPATIBILITY = """
# 版本兼容性说明

## 当前版本 (v2.0)
- 导出格式: xlsx / csv
- 导出字段: 9个字段

## 历史版本 (v1.x)
- 导出格式: csv only
- 导出字段: 6个字段 (不包含 location, description)

## 向后兼容策略
- 读取 v1.x CSV 格式时自动适配字段映射
- 导出时默认使用 v2.0 格式
- 提供格式版本降级选项: ?version=1
"""