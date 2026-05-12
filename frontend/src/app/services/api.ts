/**
 * Location API — 位置管理通信契约层
 *
 * 封装与后端 LocationController REST API 的交互方法。
 * 严格对齐后端 `/api/locations` 及 `/api/locations/{id}` 路径，
 * 请求体结构仅包含后端 Location 实体的 6 个标准持久化字段。
 *
 * @module services/api
 * @since SWARM-048
 */

import { api } from "../utils/api";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * Location 实体接口 — 严格对齐后端 Location.java 的 6 个标准持久化字段
 *
 * @description 仅包含后端 Location 实体中定义的持久化字段：
 * id, name, locationCode, parentId, sortOrder, description
 * 禁止包含 children 等前端计算属性。
 */
export interface Location {
  /** 位置 ID */
  id: number;
  /** 位置名称（后端字段 location_name） */
  name: string;
  /** 位置编码 */
  locationCode: string;
  /** 父级位置 ID，null 表示顶级位置 */
  parentId: number | null;
  /** 排序号（同级节点按此字段升序排列） */
  sortOrder: number;
  /** 描述 */
  description: string;
}

/**
 * 创建位置时的请求数据类型
 *
 * @description Omit Location 的 id 字段，创建时由后端自动生成
 */
export type LocationCreateData = Omit<Location, "id">;

/**
 * 编辑位置时的请求数据类型
 *
 * @description 允许部分更新，所有字段均可选（id 除外）
 */
export type LocationUpdateData = Partial<Omit<Location, "id">>;

/* ------------------------------------------------------------------ */
/*  API 方法                                                           */
/* ------------------------------------------------------------------ */

/**
 * 获取全部位置列表（扁平平铺）
 *
 * @description 调用 GET /api/locations/list 获取所有位置的平铺列表，
 * 前端需根据 parentId 组装成树形结构。
 *
 * @returns Promise<Location[]>
 */
export function fetchLocationTree(): Promise<Location[]> {
  return api.get<Location[]>("/locations/list");
}

/**
 * 创建新位置
 *
 * @description 调用 POST /api/locations 创建新位置，
 * 请求体仅包含 Location 的非 id 字段。
 *
 * @param data - 创建数据（不含 id）
 * @returns Promise<Location>
 */
export function createLocation(data: LocationCreateData): Promise<Location> {
  return api.post<Location>("/locations", data);
}

/**
 * 更新位置
 *
 * @description 调用 PUT /api/locations/{id} 更新已有位置，
 * 请求体仅包含需要更新的字段。
 *
 * @param id - 位置 ID
 * @param data - 更新数据（部分字段）
 * @returns Promise<Location>
 */
export function updateLocation(
  id: number,
  data: LocationUpdateData,
): Promise<Location> {
  return api.put<Location>(`/locations/${id}`, data);
}

/**
 * 删除位置
 *
 * @description 调用 DELETE /api/locations/{id} 删除指定位置。
 *
 * @param id - 位置 ID
 * @returns Promise<void>
 */
export function deleteLocation(id: number): Promise<void> {
  return api.delete<void>(`/locations/${id}`);
}

/* ================================================================== */
/*  退役申请 API — Retirement Application Communication Layer          */
/* ================================================================== */

/**
 * 退役申请创建参数
 *
 * @description POST /api/retirement/applications 请求体
 */
export interface RetirementCreateParams {
  /** 关联资产 ID */
  assetId: string;
  /** 退役原因 */
  reason: string;
  /** 预期退役日期（ISO 8601） */
  expectedDate?: string;
}

/**
 * 退役申请记录
 *
 * @description 退役申请详情，对齐后端 RetirementApplication 实体
 */
export interface RetirementApplication {
  /** 申请 ID */
  id: string;
  /** 关联资产 ID */
  assetId: string;
  /** 申请单号 */
  retirementNo: string;
  /** 申请人名称 */
  applicantName?: string;
  /** 退役原因 */
  reason: string;
  /** 详细描述 */
  description?: string;
  /** 当前状态 */
  status: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 分页退役申请列表响应
 */
export interface PaginatedRetirementApplications {
  /** 申请记录列表 */
  items: RetirementApplication[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 退役申请列表查询参数
 */
export interface RetirementListParams {
  /** 资产 ID 过滤 */
  assetId?: string;
  /** 状态过滤 */
  status?: string;
  /** 关键词搜索 */
  keyword?: string;
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 创建退役申请
 *
 * @description 调用 POST /api/retirement/applications 创建退役申请。
 *
 * @param data - 创建参数
 * @returns Promise<RetirementApplication>
 */
export function createRetirementApplication(
  data: RetirementCreateParams
): Promise<RetirementApplication> {
  return api.post<RetirementApplication>('/retirement/applications', data);
}

/**
 * 提交退役申请（发起审批）
 *
 * @description 调用 POST /api/retirement/applications/{id}/submit 提交申请。
 *
 * @param applicationId - 申请 ID
 * @returns Promise<RetirementApplication>
 */
export function submitRetirementApplication(
  applicationId: string
): Promise<RetirementApplication> {
  return api.post<RetirementApplication>(
    `/retirement/applications/${applicationId}/submit`
  );
}

/**
 * 获取退役申请详情
 *
 * @description 调用 GET /api/retirement/applications/{id} 获取申请详情。
 *
 * @param applicationId - 申请 ID
 * @returns Promise<RetirementApplication>
 */
export function getRetirementApplication(
  applicationId: string
): Promise<RetirementApplication> {
  return api.get<RetirementApplication>(
    `/retirement/applications/${applicationId}`
  );
}

/**
 * 获取退役申请列表
 *
 * @description 调用 GET /api/retirement/applications 获取分页列表。
 *
 * @param params - 查询参数
 * @returns Promise<PaginatedRetirementApplications>
 */
export function listRetirementApplications(
  params?: RetirementListParams
): Promise<PaginatedRetirementApplications> {
  return api.get<PaginatedRetirementApplications>(
    '/retirement/applications',
    { params }
  );
}

/**
 * 审批通过退役申请
 *
 * @description 调用 POST /api/retirement/applications/{id}/approve。
 *
 * @param applicationId - 申请 ID
 * @param comment - 审批意见
 * @returns Promise<RetirementApplication>
 */
export function approveRetirementApplication(
  applicationId: string,
  comment?: string
): Promise<RetirementApplication> {
  return api.post<RetirementApplication>(
    `/retirement/applications/${applicationId}/approve`,
    { comment }
  );
}

/**
 * 驳回退役申请
 *
 * @description 调用 POST /api/retirement/applications/{id}/reject。
 *
 * @param applicationId - 申请 ID
 * @param reason - 驳回原因
 * @returns Promise<RetirementApplication>
 */
export function rejectRetirementApplication(
  applicationId: string,
  reason: string
): Promise<RetirementApplication> {
  return api.post<RetirementApplication>(
    `/retirement/applications/${applicationId}/reject`,
    { reason }
  );
}

/**
 * 取消退役申请
 *
 * @description 调用 POST /api/retirement/applications/{id}/cancel。
 *
 * @param applicationId - 申请 ID
 * @returns Promise<RetirementApplication>
 */
export function cancelRetirementApplication(
  applicationId: string
): Promise<RetirementApplication> {
  return api.post<RetirementApplication>(
    `/retirement/applications/${applicationId}/cancel`
  );
}

/**
 * 获取资产退役历史记录
 *
 * @description 调用 GET /api/retirement/assets/{assetId}/state-history。
 *
 * @param assetId - 资产 ID
 * @returns Promise 包含 history 数组的状态变更历史
 */
export function getRetirementHistory(
  assetId: string
): Promise<{
  assetId: string;
  history: Array<{
    fromStatus: string;
    toStatus: string;
    timestamp: string;
    operator: string;
  }>;
}> {
  return api.get(`/retirement/assets/${assetId}/state-history`);
}

/* ================================================================== */
/*  工单管理 API — Work Order Management Communication Layer           */
/* ================================================================== */

/**
 * 工单状态枚举，对齐后端 WorkOrder 实体状态字段
 */
export type WorkOrderApiStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

/**
 * 工单优先级枚举
 */
export type WorkOrderApiPriority = "NORMAL" | "URGENT" | "EMERGENCY";

/**
 * 工单记录接口 — 对齐后端 WorkOrder 实体
 *
 * @description 包含工单的所有标准字段，由 GET /api/workorders 返回
 */
export interface WorkOrderApiRecord {
  /** 工单 ID */
  id: number;
  /** 工单编号 */
  workOrderNo?: string;
  /** 工单标题 */
  title?: string;
  /** 工单描述 */
  description?: string;
  /** 当前状态 */
  status?: WorkOrderApiStatus;
  /** 优先级 */
  priority?: WorkOrderApiPriority;
  /** 关联资产 ID */
  assetId?: number;
  /** 关联资产名称 */
  assetName?: string;
  /** 关联资产编码 */
  assetCode?: string;
  /** 报修人名称 */
  reporterName?: string;
  /** 指派人名称 */
  assigneeName?: string;
  /** 部门名称 */
  deptName?: string;
  /** 计划开始日期 */
  plannedStartDate?: string;
  /** 计划结束日期 */
  plannedEndDate?: string;
  /** 预估费用 */
  estimatedCost?: number;
  /** 实际费用 */
  actualCost?: number;
  /** 完成备注 */
  completionNote?: string;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  [key: string]: unknown;
}

/**
 * 工单创建/更新请求数据
 *
 * @description 对齐后端 WorkOrderDTO
 */
export interface WorkOrderApiDTO {
  id?: number;
  workOrderNo?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assetId?: number;
  assetName?: string;
  assetCode?: string;
  reporterId?: number;
  reporterName?: string;
  assigneeId?: number;
  assigneeName?: string;
  deptId?: number;
  deptName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  completionNote?: string;
}

/**
 * 分页工单列表响应
 *
 * @description 对齐后端分页结果
 */
export interface PaginatedWorkOrders {
  /** 工单记录列表 */
  records: WorkOrderApiRecord[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  current: number;
  /** 每页数量 */
  size: number;
  /** 总页数 */
  pages: number;
}

/**
 * 工单列表查询参数
 */
export interface WorkOrderListParams {
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 状态过滤 */
  status?: string;
  /** 关键词搜索 */
  keyword?: string;
}

/**
 * 查询工单列表（分页）
 *
 * @description 调用 GET /api/workorders 获取分页工单列表。
 *
 * @param params - 查询参数
 * @returns Promise<PaginatedWorkOrders>
 */
export function listWorkOrders(
  params?: WorkOrderListParams
): Promise<PaginatedWorkOrders> {
  return api.get<PaginatedWorkOrders>("/workorders", { params });
}

/**
 * 获取工单详情
 *
 * @description 调用 GET /api/workorders/{id} 获取工单详情。
 *
 * @param id - 工单 ID
 * @returns Promise<WorkOrderApiRecord>
 */
export function getWorkOrder(id: number | string): Promise<WorkOrderApiRecord> {
  return api.get<WorkOrderApiRecord>(`/workorders/${id}`);
}

/**
 * 创建工单
 *
 * @description 调用 POST /api/workorders 创建新工单，初始状态为 DRAFT。
 *
 * @param data - 工单数据
 * @returns Promise<WorkOrderApiRecord>
 */
export function createWorkOrder(
  data: WorkOrderApiDTO
): Promise<WorkOrderApiRecord> {
  return api.post<WorkOrderApiRecord>("/workorders", data);
}

/**
 * 更新工单
 *
 * @description 调用 PUT /api/workorders/{id} 更新已有工单。
 * 仅 DRAFT 或 REJECTED 状态可修改。
 *
 * @param id - 工单 ID
 * @param data - 更新数据
 * @returns Promise<WorkOrderApiRecord>
 */
export function updateWorkOrder(
  id: number | string,
  data: WorkOrderApiDTO
): Promise<WorkOrderApiRecord> {
  return api.put<WorkOrderApiRecord>(`/workorders/${id}`, data);
}

/**
 * 删除工单
 *
 * @description 调用 DELETE /api/workorders/{id} 删除指定工单。
 * 仅 DRAFT、REJECTED 或 CANCELLED 状态可删除。
 *
 * @param id - 工单 ID
 * @returns Promise<void>
 */
export function deleteWorkOrder(id: number | string): Promise<void> {
  return api.delete<void>(`/workorders/${id}`);
}

/**
 * 提交工单审批
 *
 * @description 调用 POST /api/workorders/{id}/submit 提交审批。
 * DRAFT/REJECTED → PENDING
 *
 * @param id - 工单 ID
 * @returns Promise<WorkOrderApiRecord>
 */
export function submitWorkOrder(
  id: number | string
): Promise<WorkOrderApiRecord> {
  return api.post<WorkOrderApiRecord>(`/workorders/${id}/submit`);
}

/**
 * 工单生命周期操作
 *
 * @description 调用 POST /api/workorders/{id}/operate 执行生命周期操作。
 * 支持: approve, reject, start, complete, cancel
 *
 * @param id - 工单 ID
 * @param operation - 操作类型
 * @param comment - 操作备注
 * @returns Promise<WorkOrderApiRecord>
 */
export function operateWorkOrder(
  id: number | string,
  operation: string,
  comment?: string
): Promise<WorkOrderApiRecord> {
  return api.post<WorkOrderApiRecord>(`/workorders/${id}/operate`, {
    operation,
    comment,
  });
}
