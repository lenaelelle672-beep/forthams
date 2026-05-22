/**
 * @module useInventory
 * @description 盘点管理 React Query Hooks
 *
 * 封装盘点任务的查询与变更操作，提供统一的 cache invalidation 策略。
 * 确认资产后自动刷新 task detail 和 summary，无需整页重载。
 *
 * 导出 hooks:
 * - useTasks                    盘点任务分页列表
 * - useTaskDetail               任务详情（含统计摘要）
 * - useAssets                   任务下资产清单
 * - useSummary                  盘盈盘亏汇总
 * - useCreateTaskMutation       创建盘点任务
 * - useUpdateTaskStatusMutation 更新任务状态
 * - useConfirmMutation          逐条确认资产
 * - useBatchConfirmMutation     批量确认资产
 * - useSubmitMutation           提交核准
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { message } from 'antd';
import http from '@/utils/http';

// ===========================================================================
// 类型定义（与 SPEC API 契约对齐）
// ===========================================================================

/** 盘点范围类型 */
export type ScopeType = 'location' | 'category' | 'all';

/** 盘点任务状态 */
export type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/** 实盘状态 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

/** 通用分页响应结构 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 盘点任务 */
export interface InventoryTask {
  taskId: string;
  taskName: string;
  scopeType: ScopeType;
  scopeIds: string[];
  status: TaskStatus;
  progress: number;
  totalAssets: number;
  countedAssets: number;
  uncountedAssets: number;
  surplusAssets: number;
  deficitAssets: number;
  createdAt: string;
  updatedAt: string;
}

/** 盘点任务详情（继承基础任务字段，含扩展信息） */
export interface InventoryTaskDetail extends InventoryTask {
  description?: string;
}

/** 盘点资产条目 */
export interface InventoryAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  bookStatus: string;
  actualStatus: ActualStatus | null;
  remark: string;
  confirmed: boolean;
}

/** 盘盈/盘亏明细条目 */
export interface DifferenceItem {
  assetId: string;
  assetCode: string;
  assetName: string;
  reason: string;
}

/** 盘盈盘亏汇总 */
export interface InventorySummary {
  surplusCount: number;
  deficitCount: number;
  surplusItems: DifferenceItem[];
  deficitItems: DifferenceItem[];
}

/** 任务列表筛选参数 */
export interface TaskFilterParams {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  keyword?: string;
}

/** 创建盘点任务参数 */
export interface CreateTaskParams {
  taskName: string;
  scopeType: ScopeType;
  scopeIds?: string[];
}

/** 逐条确认资产参数 */
export interface ConfirmPayload {
  actualStatus: ActualStatus;
  remark?: string;
}

/** 批量确认参数 */
export interface BatchConfirmPayload {
  assetIds: string[];
  actualStatus: ActualStatus;
  remark?: string;
}

/** 资产清单查询参数 */
export interface AssetQueryParams {
  page?: number;
  pageSize?: number;
  confirmed?: boolean;
}

// ===========================================================================
// API 基地址
// ===========================================================================

const API_BASE = '/inventory/tasks';

// ===========================================================================
// API 调用函数（对齐 SPEC API 契约）
// ===========================================================================

/**
 * 获取盘点任务分页列表
 *
 * @param params - 分页与筛选参数
 * @returns 分页响应数据
 */
async function fetchTasks(
  params?: TaskFilterParams,
): Promise<PaginatedResponse<InventoryTask>> {
  const { data } = await http.get<PaginatedResponse<InventoryTask>>(
    API_BASE,
    { params },
  );
  return data;
}

/**
 * 创建新的盘点任务
 *
 * @param payload - 创建任务的请求载荷
 * @returns 新创建的任务对象
 */
async function createTask(payload: CreateTaskParams): Promise<InventoryTask> {
  const { data } = await http.post<InventoryTask>(API_BASE, payload);
  return data;
}

/**
 * 获取盘点任务详情
 *
 * @param taskId - 任务唯一标识
 * @returns 任务详情对象（含统计数据）
 */
async function fetchTaskDetail(taskId: string): Promise<InventoryTaskDetail> {
  const { data } = await http.get<InventoryTaskDetail>(`${API_BASE}/${taskId}`);
  return data;
}

/**
 * 更新盘点任务状态
 *
 * @param taskId - 任务唯一标识
 * @param status - 目标状态
 * @returns 更新后的任务对象
 */
async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<InventoryTask> {
  const { data } = await http.patch<InventoryTask>(
    `${API_BASE}/${taskId}/status`,
    { status },
  );
  return data;
}

/**
 * 获取盘点任务下的资产清单（分页）
 *
 * @param taskId - 任务唯一标识
 * @param params - 分页与筛选参数
 * @returns 资产清单分页数据
 */
async function fetchTaskAssets(
  taskId: string,
  params?: AssetQueryParams,
): Promise<PaginatedResponse<InventoryAsset>> {
  const { data } = await http.get<PaginatedResponse<InventoryAsset>>(
    `${API_BASE}/${taskId}/assets`,
    { params },
  );
  return data;
}

/**
 * 逐条确认资产实盘状态
 *
 * 对应 SPEC: PATCH /api/inventory/tasks/:taskId/assets/:assetId/confirm
 *
 * @param taskId  - 任务唯一标识
 * @param assetId - 资产唯一标识
 * @param payload - 确认载荷（实盘状态 + 备注）
 */
async function confirmAsset(
  taskId: string,
  assetId: string,
  payload: ConfirmPayload,
): Promise<void> {
  await http.patch(
    `${API_BASE}/${taskId}/assets/${assetId}/confirm`,
    payload,
  );
}

/**
 * 批量确认资产实盘状态
 *
 * 对应 SPEC: POST /api/inventory/tasks/:taskId/assets/batch-confirm
 *
 * @param taskId  - 任务唯一标识
 * @param payload - 批量确认载荷（assetIds + 实盘状态 + 备注）
 */
async function batchConfirmAssets(
  taskId: string,
  payload: BatchConfirmPayload,
): Promise<void> {
  await http.post(`${API_BASE}/${taskId}/assets/batch-confirm`, payload);
}

/**
 * 获取盘盈盘亏汇总数据
 *
 * @param taskId - 任务唯一标识
 * @returns 盘盈盘亏汇总对象
 */
async function fetchTaskSummary(taskId: string): Promise<InventorySummary> {
  const { data } = await http.get<InventorySummary>(
    `${API_BASE}/${taskId}/summary`,
  );
  return data;
}

/**
 * 提交盘点结果核准（不可逆操作）
 *
 * @param taskId - 任务唯一标识
 */
async function submitTask(taskId: string): Promise<void> {
  await http.post(`${API_BASE}/${taskId}/submit`);
}

// ===========================================================================
// Query Key 工厂 — 提供统一的 queryKey 生成器，确保 cache invalidation 精确匹配
// ===========================================================================

/**
 * 盘点模块 React Query 键工厂
 *
 * 使用方式:
 * ```ts
 * queryClient.invalidateQueries({ queryKey: inventoryKeys.task(taskId) });
 * queryClient.invalidateQueries({ queryKey: inventoryKeys.tasks() });
 * ```
 */
export const inventoryKeys = {
  /** 所有盘点相关查询的根键 */
  all: ['inventory'] as const,

  /** 盘点任务列表相关 */
  tasks: () => [...inventoryKeys.all, 'tasks'] as const,

  /** 带筛选参数的任务列表 */
  taskList: (params?: TaskFilterParams) =>
    [...inventoryKeys.tasks(), params] as const,

  /** 单个任务详情 */
  task: (taskId: string) =>
    [...inventoryKeys.all, 'task', taskId] as const,

  /** 任务下的资产清单 */
  taskAssets: (taskId: string, params?: AssetQueryParams) =>
    [...inventoryKeys.task(taskId), 'assets', params] as const,

  /** 任务盘盈盘亏汇总 */
  taskSummary: (taskId: string) =>
    [...inventoryKeys.task(taskId), 'summary'] as const,
};

// ===========================================================================
// 工具函数
// ===========================================================================

/**
 * 计算盘点进度百分比（精确到小数点后 1 位）
 *
 * 公式: 已盘数 / 总资产数 × 100%，结果保留 1 位小数。
 *
 * @param counted - 已盘数量
 * @param total   - 总资产数量
 * @returns 0.0 ~ 100.0 的百分比
 */
export function calculateProgress(counted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.round((counted / total) * 1000) / 10, 100);
}

/**
 * 判断盘点任务是否处于只读状态
 *
 * 「已完成」和「已提交」状态下禁止编辑操作。
 *
 * @param status - 任务状态
 * @returns 是否为只读
 */
export function isReadOnlyStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'submitted';
}

// ===========================================================================
// 查询 Hooks (Queries)
// ===========================================================================

/**
 * 获取盘点任务分页列表
 *
 * 支持按状态筛选（draft / in_progress / completed / submitted）和分页。
 * 默认按创建时间倒序，每页 20 条。staleTime 30s 避免频繁请求。
 *
 * @param params - 筛选与分页参数
 * @returns React Query 结果对象
 */
export function useTasks(params?: TaskFilterParams) {
  return useQuery({
    queryKey: inventoryKeys.taskList(params),
    queryFn: () => fetchTasks(params),
    staleTime: 30_000,
  });
}

/**
 * 获取盘点任务详情（含统计数据）
 *
 * 包含进度百分比、已盘/未盘/盘盈/盘亏数量等统计字段。
 * taskId 为空时自动禁用查询（enabled: false）。
 *
 * @param taskId - 任务唯一标识
 * @returns React Query 结果对象
 */
export function useTaskDetail(taskId: string) {
  return useQuery({
    queryKey: inventoryKeys.task(taskId),
    queryFn: () => fetchTaskDetail(taskId),
    enabled: !!taskId,
    staleTime: 15_000,
  });
}

/**
 * 获取盘点任务下的资产清单（分页）
 *
 * 支持按确认状态筛选。资产数 > 200 时由组件层启用 react-window 虚拟滚动。
 * taskId 为空时自动禁用查询。
 *
 * @param taskId - 任务唯一标识
 * @param params - 分页与筛选参数
 * @returns React Query 结果对象
 */
export function useAssets(taskId: string, params?: AssetQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.taskAssets(taskId, params),
    queryFn: () => fetchTaskAssets(taskId, params),
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

/**
 * 获取盘盈盘亏汇总数据
 *
 * 返回盘盈/盘亏明细列表及计数，用于 DifferenceSummaryPanel 组件渲染。
 * taskId 为空时自动禁用查询。
 *
 * @param taskId - 任务唯一标识
 * @returns React Query 结果对象
 */
export function useSummary(taskId: string) {
  return useQuery({
    queryKey: inventoryKeys.taskSummary(taskId),
    queryFn: () => fetchTaskSummary(taskId),
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

// ===========================================================================
// 变更 Hooks (Mutations)
// ===========================================================================

/**
 * 创建盘点任务 Mutation
 *
 * 成功后自动刷新任务列表。
 * 调用方需确保:
 * - taskName 为 1-50 字符、必填
 * - scopeType 非 'all' 时 scopeIds 至少 1 项
 * - 按钮 loading 防重复提交
 *
 * @returns React Mutation 对象（mutate(payload)）
 */
export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTaskParams) => createTask(payload),
    onSuccess: () => {
      /** 刷新任务列表，确保新增行可见 */
      queryClient.invalidateQueries({ queryKey: inventoryKeys.tasks() });
      message.success('盘点任务创建成功');
    },
    onError: (error: Error) => {
      message.error(error.message || '创建盘点任务失败');
    },
  });
}

/**
 * 更新盘点任务状态 Mutation
 *
 * 用于将任务从「草稿」变更为「进行中」等状态变更操作。
 * 成功后自动刷新对应任务详情和任务列表。
 *
 * @returns React Mutation 对象（mutate({ taskId, status })）
 */
export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) => updateTaskStatus(taskId, status),
    onSuccess: (_data, variables) => {
      /** 刷新任务详情 */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.task(variables.taskId),
      });
      /** 刷新任务列表（状态列更新） */
      queryClient.invalidateQueries({ queryKey: inventoryKeys.tasks() });
    },
    onError: (error: Error) => {
      message.error(error.message || '状态更新失败');
    },
  });
}

/**
 * 逐条确认资产 Mutation
 *
 * 对应 SPEC: PATCH /api/inventory/tasks/:taskId/assets/:assetId/confirm
 *
 * 成功后自动刷新（无需整页重载）:
 * 1. 任务详情 — 进度百分比 + 统计摘要（已盘数 +1、未盘数 -1）
 * 2. 资产清单 — 该行状态更新为已确认
 * 3. 盘盈盘亏汇总 — 差异可能变化
 *
 * @returns React Mutation 对象（mutate({ taskId, assetId, payload })）
 */
export function useConfirmMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      assetId,
      payload,
    }: {
      taskId: string;
      assetId: string;
      payload: ConfirmPayload;
    }) => confirmAsset(taskId, assetId, payload),
    onSuccess: (_data, variables) => {
      const { taskId } = variables;

      /** 刷新任务详情（进度/统计摘要） */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.task(taskId),
      });

      /** 刷新资产清单（行状态更新） */
      queryClient.invalidateQueries({
        queryKey: [...inventoryKeys.task(taskId), 'assets'],
      });

      /** 刷新盘盈盘亏汇总 */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.taskSummary(taskId),
      });
    },
    onError: (error: Error) => {
      message.error(error.message || '资产确认失败');
    },
  });
}

/**
 * 批量确认资产 Mutation
 *
 * 对应 SPEC: POST /api/inventory/tasks/:taskId/assets/batch-confirm
 *
 * 前端截断：单次批量确认上限 100 条，超出部分丢弃。
 * 成功后自动刷新任务详情、资产清单和盘盈盘亏汇总。
 *
 * @returns React Mutation 对象（mutate({ taskId, payload })）
 */
export function useBatchConfirmMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: BatchConfirmPayload;
    }) => {
      /** 前端截断：单次批量确认上限 100 条 */
      const cappedIds = payload.assetIds.slice(0, 100);
      return batchConfirmAssets(taskId, { ...payload, assetIds: cappedIds });
    },
    onSuccess: (_data, variables) => {
      const { taskId } = variables;

      /** 刷新任务详情（进度/统计摘要） */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.task(taskId),
      });

      /** 刷新资产清单（多行状态更新） */
      queryClient.invalidateQueries({
        queryKey: [...inventoryKeys.task(taskId), 'assets'],
      });

      /** 刷新盘盈盘亏汇总 */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.taskSummary(taskId),
      });
    },
    onError: (error: Error) => {
      message.error(error.message || '批量确认失败');
    },
  });
}

/**
 * 提交盘点结果核准 Mutation
 *
 * 对应 SPEC: POST /api/inventory/tasks/:taskId/submit
 *
 * **提交为不可逆操作**，调用方需在 UI 层实现二次确认弹窗：
 * "确认提交核准？提交后不可修改。"
 *
 * 成功后:
 * 1. 刷新任务详情 — 状态变更为 submitted
 * 2. 刷新任务列表
 * 3. 刷新盘盈盘亏汇总
 *
 * @returns React Mutation 对象（mutate(taskId)）
 */
export function useSubmitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => submitTask(taskId),
    onSuccess: (_data, taskId) => {
      /** 刷新任务详情（状态变更） */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.task(taskId),
      });

      /** 刷新任务列表 */
      queryClient.invalidateQueries({ queryKey: inventoryKeys.tasks() });

      /** 刷新盘盈盘亏汇总 */
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.taskSummary(taskId),
      });

      message.success('盘点结果已提交核准');
    },
    onError: (error: Error) => {
      message.error(error.message || '提交核准失败');
    },
  });
}