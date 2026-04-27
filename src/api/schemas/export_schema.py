"""
导出相关 Pydantic Schema 定义

提供资产批量导出功能的请求/响应数据模型定义，包括：
- 导出格式枚举（CSV/Excel）
- 资产类型/状态枚举
- 导出请求参数模型（含筛选条件、分页）
- 导出任务状态响应模型
- 导出资产数据模型
- 导出结果汇总模型

Author: SWARM-2025-Q2-P2-006
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class ExportFormat(str, Enum):
    """
    支持导出的文件格式枚举
    
    Attributes:
        CSV: CSV 逗号分隔值格式，UTF-8 编码
        EXCEL: Microsoft Excel .xlsx 格式
    """
    CSV = "csv"
    EXCEL = "excel"


class AssetTypeEnum(str, Enum):
    """
    资产类型枚举（12 字段映射表定义）
    
    定义系统支持的资产分类类型
    """
    EQUIPMENT = "EQUIPMENT"       # 设备
    FURNITURE = "FURNITURE"       # 家具
    VEHICLE = "VEHICLE"           # 车辆
    IT_HARDWARE = "IT_HARDWARE"   # IT硬件
    OTHER = "OTHER"               # 其他


class AssetStatusEnum(str, Enum):
    """
    资产状态枚举（12 字段映射表定义）
    
    定义资产的当前运行状态
    """
    ACTIVE = "ACTIVE"             # 正常
    INACTIVE = "INACTIVE"         # 停用
    MAINTENANCE = "MAINTENANCE"   # 维护中
    RETIRED = "RETIRED"           # 已退役


class ExportRequest(BaseModel):
    """
    资产导出请求参数模型
    
    支持按资产类型、状态、部门、时间范围进行筛选导出，
    并可指定导出格式与分页参数。
    
    Attributes:
        asset_types: 资产类型筛选列表（可多选）
        status_list: 资产状态筛选列表（可多选）
        department: 部门编码筛选（需匹配已存在的部门）
        start_date: 采购日期开始时间（YYYY-MM-DD）
        end_date: 采购日期结束时间（YYYY-MM-DD）
        format: 导出文件格式，默认 CSV
        page: 页码，从 1 开始
        page_size: 每页记录数，默认 100，最大 10000
    """
    asset_types: Optional[List[AssetTypeEnum]] = Field(
        None,
        description="资产类型筛选（可多选）"
    )
    status_list: Optional[List[AssetStatusEnum]] = Field(
        None,
        description="资产状态筛选（可多选）"
    )
    department: Optional[str] = Field(
        None,
        description="部门编码筛选"
    )
    start_date: Optional[datetime] = Field(
        None,
        description="采购日期开始时间（YYYY-MM-DD）"
    )
    end_date: Optional[datetime] = Field(
        None,
        description="采购日期结束时间（YYYY-MM-DD）"
    )
    format: ExportFormat = Field(
        ExportFormat.CSV,
        description="导出文件格式：csv 或 excel"
    )
    page: int = Field(
        1,
        ge=1,
        description="页码，从 1 开始"
    )
    page_size: int = Field(
        100,
        ge=1,
        le=10000,
        description="每页记录数，最大 10000"
    )


class ExportTaskResponse(BaseModel):
    """
    导出任务状态响应模型
    
    用于查询异步导出任务的当前状态与进度。
    
    Attributes:
        task_id: 任务唯一标识符
        status: 任务状态（PENDING/PROCESSING/COMPLETED/FAILED）
        progress: 完成进度百分比（0-100）
        file_url: 任务完成后可下载的文件地址
        created_at: 任务创建时间
        completed_at: 任务完成时间
        error_message: 失败时的错误详情
    """
    task_id: str = Field(
        ...,
        description="任务唯一标识符"
    )
    status: str = Field(
        ...,
        description="任务状态：PENDING/PROCESSING/COMPLETED/FAILED"
    )
    progress: int = Field(
        default=0,
        ge=0,
        le=100,
        description="完成进度百分比（0-100）"
    )
    file_url: Optional[str] = Field(
        None,
        description="任务完成后可下载的文件地址"
    )
    created_at: datetime = Field(
        ...,
        description="任务创建时间"
    )
    completed_at: Optional[datetime] = Field(
        None,
        description="任务完成时间"
    )
    error_message: Optional[str] = Field(
        None,
        description="失败时的错误详情"
    )


class ExportAssetData(BaseModel):
    """
    单条导出资产数据模型（12 字段映射表定义）
    
    对应导入字段清单中的 12 个核心字段，
    用于结构化导出数据或预览。
    
    Attributes:
        asset_id: 资产编号（导入时为空则自动生成）
        asset_name: 资产名称（必填，最大50字符）
        asset_type: 资产类型枚举值
        serial_number: 序列号（最大100字符）
        purchase_date: 购买日期（YYYY-MM-DD）
        purchase_price: 购买价格（>0，最多2位小数）
        currency: 币种（默认 CNY）
        department: 所属部门编码（必填）
        custodian: 保管人（最大100字符）
        status: 资产状态枚举值
        location: 存放地点（最大200字符）
        remarks: 备注（最大500字符）
    """
    asset_id: Optional[str] = Field(
        None,
        description="资产编号（导入时为空则自动生成）"
    )
    asset_name: str = Field(
        ...,
        description="资产名称（必填，最大50字符）"
    )
    asset_type: AssetTypeEnum = Field(
        ...,
        description="资产类型：EQUIPMENT/FURNITURE/VEHICLE/IT_HARDWARE/OTHER"
    )
    serial_number: Optional[str] = Field(
        None,
        description="序列号（最大100字符）"
    )
    purchase_date: datetime = Field(
        ...,
        description="购买日期（YYYY-MM-DD）"
    )
    purchase_price: float = Field(
        ...,
        description="购买价格（>0，最多2位小数）"
    )
    currency: str = Field(
        default="CNY",
        description="币种（默认 CNY）"
    )
    department: str = Field(
        ...,
        description="所属部门编码（需匹配已存在的部门）"
    )
    custodian: Optional[str] = Field(
        None,
        description="保管人（最大100字符）"
    )
    status: AssetStatusEnum = Field(
        ...,
        description="资产状态：ACTIVE/INACTIVE/MAINTENANCE/RETIRED"
    )
    location: Optional[str] = Field(
        None,
        description="存放地点（最大200字符）"
    )
    remarks: Optional[str] = Field(
        None,
        description="备注（最大500字符）"
    )


class ExportResult(BaseModel):
    """
    导出结果汇总模型
    
    记录导出操作的统计信息与文件位置。
    
    Attributes:
        total_count: 符合条件的总记录数
        exported_count: 实际导出的记录数
        format: 使用的导出文件格式
        file_url: 生成的可下载文件地址
        generated_at: 文件生成时间
        filters: 应用的所有筛选条件（用于回溯）
    """
    total_count: int = Field(
        ...,
        description="符合条件的总记录数"
    )
    exported_count: int = Field(
        ...,
        description="实际导出的记录数"
    )
    format: ExportFormat = Field(
        ...,
        description="使用的导出文件格式：csv 或 excel"
    )
    file_url: Optional[str] = Field(
        None,
        description="生成的可下载文件地址"
    )
    generated_at: datetime = Field(
        ...,
        description="文件生成时间"
    )
    filters: Optional[ExportRequest] = Field(
        None,
        description="应用的所有筛选条件"
    )