/**
 * useTaskList - 盘点任务列表管理 Hook
 *
 * Phase 3 [SWARM-P3-010-FE] 资产盘点管理前端模块
 *
 * 提供盘点任务列表的完整数据管理能力：
 * - 分页拉取任务列表（ATB-01）
 * - 按状态/关键字筛选
 * - 新建任务后自动刷新列表（ATB-02）
 * - 进度百分比计算与聚合展示
 * - 错误处理与降级提示
 *
 * @module InventoryTasks/hooks/useTaskList
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AxiosResponse } from 'axios';
import http from '@/utils/http';

// ---------------------------------------------------------------------------
// 1. 类型定义 — Phase 3.1 基础数据模型
// ---------------------------------------------------------------------------

/** 盘点任务状态枚举 */
export type InventoryTaskStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'cancelled';

/** 盘点任务数据接口 (ITask) */
export interface IInventoryTask {
  /** 任务唯一标识 */
  id: string;
  /** 任务编号（自动生成） */
  taskCode: string;
  /** 任务名称 */
  title: string;
  /** 当前状态 */
  status: InventoryTaskStatus;
  /** 盘点范围 — 位置 ID 列表 */
  locationIds: string[];
  /** 盘点范围 — 位置名称列表（用于表格展示） */
  locationNames?: string[];
  /** 盘点范围 — 分类 ID 列表 */
  categoryIds?: string[];
  /** 包含资产总数 */
  assetCount: number;
  /** 已盘点资产数 */
  completedCount: number;
  /** 盘盈数量 */
  surplusCount: number;
  /** 盘亏数量 */
  deficitCount: number;
  /** 完成进度百分比 (0-100)，可由前端根据 assetCount/completedCount 计算 */
  progress: number;
  /** 计划开始时间 */
  startTime?: string;
  /** 计划结束时间 */
  endTime?: string;
  /** 创建人 ID */
  creatorId: string;
  /** 创建人姓名 */
  creatorName: string;
  /** 创建时间 */
  createTime: string;
  /** 最后更新时间 */
  updateTime?: string;
}

/** 创建盘点任务请求参数 */
export interface ICreateTaskParams {
  /** 任务名称 */
  title: string;
  /** 盘点范围类型 */
  scopeType: 'location' | 'category';
  /** 位置 ID 列表（scopeType 为 location 时必填） */
  locationIds?: string[];
  /** 分类 ID 列表（scopeType 为 category 时必填） */
  categoryIds?: string[];
  /** 计划开始时间 */
  startTime?: string;
  /** 计划结束时间 */
  endTime?: string;
}

/** 任务列表查询参数 */
export interface ITaskListQuery {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 按状态筛选 */
  status?: InventoryTaskStatus;
  /** 关键字搜索（任务名称 / 任务编号） */
  keyword?: string;
}

/** 通用分页响应结构 */
export interface IPaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** Hook 返回值类型 */
export interface IUseTaskListReturn {
  /** 任务列表数据 */
  tasks: IInventoryTask[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 总记录数（分页用） */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 手动刷新列表 */
  refresh: () => Promise<void>;
  /** 切换页码 */
  changePage: (page: number) => void;
  /** 切换每页条数 */
  changePageSize: (size: number) => void;
  /** 更新筛选状态 */
  setFilterStatus: (status: InventoryTaskStatus | undefined) => void;
  /** 更新搜索关键字 */
  setKeyword: (keyword: string) => void;
  /** 创建新盘点任务（含自动刷新） */
  createTask: (params: ICreateTaskParams) => Promise<boolean>;
  /** 当前筛选状态 */
  filterStatus: InventoryTaskStatus | undefined;
  /** 当前搜索关键字 */
  keyword: string;
}

// ---------------------------------------------------------------------------
// 2. API 请求函数 — Phase 3.1 API 对接层
// ---------------------------------------------------------------------------

const API_BASE = '/api/inventory/tasks';

/**
 * 从后端获取盘点任务分页列表
 *
 * @param query - 分页与筛选参数
 * @returns 分页响应数据
 */
async function fetchTaskList(
  query: ITaskListQuery,
): Promise<IPaginatedResponse<IInventoryTask>> {
  const response: AxiosResponse<IPaginatedResponse<IInventoryTask>> =
    await http.get(API_BASE, { params: query });
  return response.data;
}

/**
 * 调用后端接口创建新的盘点任务
 *
 * @param params - 创建任务的请求参数
 * @returns 新创建的任务对象
 */
async function createTaskApi(
  params: ICreateTaskParams,
): Promise<IInventoryTask> {
  const response: AxiosResponse<IInventoryTask> = await http.post(
    API_BASE,
    params,
  );
  return response.data;
}

/**
 * 根据已盘点数和总数计算进度百分比
 *
 * @param completed - 已完成数量
 * @param total - 总数量
 * @returns 0 ~ 100 的整数百分比
 */
export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.round((completed / total) * 100), 100);
}

// ---------------------------------------------------------------------------
// 3. 主 Hook — Phase 3.3 容器视图：盘点任务列表页
// ---------------------------------------------------------------------------

/**
 * useTaskList
 *
 * 盘点任务列表的核心数据管理 Hook，负责拉取、分页、筛选与创建任务。
 * 满足 ATB-01（任务列表渲染）与 ATB-02（新建任务后刷新列表）。
 *
 * @example
 * ```tsx
 * const {
 *   tasks, loading, total, page, pageSize,
 *   refresh, changePage, changePageSize,
 *   filterStatus, setFilterStatus,
 *   keyword, setKeyword,
 *   createTask,
 * } = useTaskList();
 * ```
 */
export function useTaskList(): IUseTaskListReturn {
  // ---- state ----
  const [tasks, setTasks] = useState<IInventoryTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState<
    InventoryTaskStatus | undefined
  >(undefined);
  const [keyword, setKeyword] = useState('');

  // ---- 获取任务列表 ----

  /**
   * 从 API 拉取任务列表并更新本地 state
   *
   * 内部处理分页参数拼接、错误捕获与 loading 状态管理。
   */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: ITaskListQuery = {
        page,
        pageSize,
        status: filterStatus,
        keyword: keyword || undefined,
      };
      const result = await fetchTaskList(query);

      // 前端二次计算进度（防御后端未返回 progress 字段）
      const enriched: IInventoryTask[] = (result.data || []).map((task) => ({
        ...task,
        progress:
          task.progress ??
          calculateProgress(task.completedCount, task.assetCount),
      }));

      setTasks(enriched);
      setTotal(result.total ?? 0);
    } catch (err: unknown) {
      const wrapped =
        err instanceof Error
          ? err
          : new Error('获取盘点任务列表失败，请稍后重试');
      setError(wrapped);
      console.error('[useTaskList] fetchTasks failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, keyword]);

  // 自动拉取：依赖变化时触发
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ---- 手动刷新 ----

  /** 手动触发列表刷新 */
  const refresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // ---- 分页控制 ----

  /** 切换到指定页码 */
  const changePage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /** 修改每页条数并重置到第一页 */
  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // ---- 筛选控制 ----

  /** 设置状态筛选（传 undefined 清除筛选） */
  const handleSetFilterStatus = useCallback(
    (status: InventoryTaskStatus | undefined) => {
      setFilterStatus(status);
      setPage(1); // 切换筛选时重置到第一页
    },
    [],
  );

  /** 设置搜索关键字 */
  const handleSetKeyword = useCallback((kw: string) => {
    setKeyword(kw);
    setPage(1);
  }, []);

  // ---- 创建任务 ----

  /**
   * 创建新的盘点任务并在成功后刷新列表
   *
   * @param params - 创建参数（含 scopeType / locationIds / categoryIds）
   * @returns 是否创建成功
   */
  const createTask = useCallback(
    async (params: ICreateTaskParams): Promise<boolean> => {
      try {
        await createTaskApi(params);
        // 创建成功后重置到第一页并刷新，确保新任务可见
        setPage(1);
        await fetchTasks();
        return true;
      } catch (err: unknown) {
        console.error('[useTaskList] createTask failed:', err);
        // 将错误抛给调用方处理 UI 提示
        throw err instanceof Error
          ? err
          : new Error('创建盘点任务失败，请稍后重试');
      }
    },
    [fetchTasks],
  );

  // ---- memo 化返回值 ----

  return useMemo<IUseTaskListReturn>(
    () => ({
      tasks,
      loading,
      error,
      total,
      page,
      pageSize,
      refresh,
      changePage,
      changePageSize,
      setFilterStatus: handleSetFilterStatus,
      setKeyword: handleSetKeyword,
      createTask,
      filterStatus,
      keyword,
    }),
    [
      tasks,
      loading,
      error,
      total,
      page,
      pageSize,
      refresh,
      changePage,
      changePageSize,
      handleSetFilterStatus,
      handleSetKeyword,
      createTask,
      filterStatus,
      keyword,
    ],
  );
}

export default useTaskList;