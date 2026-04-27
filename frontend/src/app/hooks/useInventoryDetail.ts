/**
 * useInventoryDetail — 盘点执行详情页核心 Hook
 *
 * 职责：
 * 1. 按 taskId 拉取盘点任务详情与关联资产清单（分页）
 * 2. 前端计算汇总指标（进度百分比、已盘/未盘/盘盈/盘亏）
 * 3. 生成盘盈盘亏差异明细列表
 * 4. 提供单条/批量确认、备注编辑、提交核准等操作方法
 *
 * 依赖：React Hooks + TypeScript + Ant Design (message)
 * 数据约束：提交核准与任务创建必须走后端 API，前端不持久化业务主数据
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { apiClient } from '../utils/api';

// ────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────

/** 盘点任务状态 */
export type InventoryTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

/** 单条资产的实盘状态 */
export type AssetScanStatus =
  | 'NOT_SCANNED'
  | 'SCANNED_MATCH'
  | 'SCANNED_SURPLUS'
  | 'SCANNED_SHORTAGE';

/** 盘点任务模型 */
export interface ITask {
  id: string;
  taskCode: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  status: InventoryTaskStatus;
  createdBy: string;
  scopeType: 'LOCATION' | 'CATEGORY';
  locationScope?: string[];
  categoryScope?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 资产明细条目 */
export interface IAssetItem {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  location: string;
  bookQuantity: number;
  actualQuantity: number | null;
  scanStatus: AssetScanStatus;
  remarks: string;
  lastScannedAt?: string;
}

/** 盘点进度与差异汇总 */
export interface IInventorySummary {
  totalAssets: number;
  scannedCount: number;
  unscannedCount: number;
  surplusCount: number;
  shortageCount: number;
  progressPercentage: number;
}

/** 盘盈/盘亏差异明细条目 */
export interface IDiffItem {
  assetId: string;
  assetCode: string;
  assetName: string;
  diffType: 'SURPLUS' | 'SHORTAGE';
  bookQuantity: number;
  actualQuantity: number;
  diff: number;
}

/** 分页参数 */
export interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

/** Hook 返回值 */
export interface UseInventoryDetailReturn {
  /** 当前盘点任务 */
  task: ITask | null;
  /** 当前页资产列表 */
  assets: IAssetItem[];
  /** 汇总统计 */
  summary: IInventorySummary;
  /** 盘盈盘亏差异明细 */
  diffItems: IDiffItem[];
  /** 全量资产（用于前端跨页汇总计算） */
  allAssets: IAssetItem[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在提交核准 */
  submitting: boolean;
  /** 错误信息 */
  error: string | null;
  /** 分页状态 */
  pagination: PaginationState;

  /** 刷新任务详情与资产列表 */
  refreshData: () => Promise<void>;
  /** 翻页加载资产 */
  fetchAssets: (page?: number, pageSize?: number) => Promise<void>;
  /** 单条资产：更新实盘状态（乐观更新） */
  updateAssetScanStatus: (
    assetId: string,
    status: AssetScanStatus,
    actualQuantity?: number,
  ) => void;
  /** 单条资产：更新备注（乐观更新） */
  updateAssetRemarks: (assetId: string, remarks: string) => void;
  /** 批量确认已盘 */
  batchConfirmAssets: (assetIds: string[]) => Promise<void>;
  /** 提交核准 */
  submitForApproval: () => Promise<boolean>;
}

// ────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────

/**
 * 根据 bookQuantity / actualQuantity 推断盘盈盘亏类型
 */
const inferScanStatus = (
  bookQuantity: number,
  actualQuantity: number | null,
): AssetScanStatus => {
  if (actualQuantity === null || actualQuantity === undefined) {
    return 'NOT_SCANNED';
  }
  if (actualQuantity > bookQuantity) return 'SCANNED_SURPLUS';
  if (actualQuantity < bookQuantity) return 'SCANNED_SHORTAGE';
  return 'SCANNED_MATCH';
};

// ────────────────────────────────────────────
// Hook 实现
// ────────────────────────────────────────────

export const useInventoryDetail = (
  taskId: string,
): UseInventoryDetailReturn => {
  // ---- state ----
  const [task, setTask] = useState<ITask | null>(null);
  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [allAssets, setAllAssets] = useState<IAssetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // ---- fetch task detail ----

  /** 拉取盘点任务基本信息 */
  const fetchTaskDetail = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ITask }>(
        `/api/inventory/tasks/${taskId}`,
      );
      setTask(res.data?.data ?? res.data);
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch task detail';
      setError(msg);
      message.error(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ---- fetch assets (paginated) ----

  /** 拉取当前页资产列表，同时拉取全量数据用于汇总计算 */
  const fetchAssets = useCallback(
    async (page?: number, pageSize?: number) => {
      const p = page ?? pagination.current;
      const ps = pageSize ?? pagination.pageSize;

      try {
        // 并行：当前页数据 + 全量汇总数据
        const [pageRes, allRes] = await Promise.all([
          apiClient.get<{
            data: IAssetItem[];
            total?: number;
          }>(`/api/inventory/tasks/${taskId}/assets`, {
            params: { page: p, pageSize: ps },
          }),
          apiClient.get<{ data: IAssetItem[] }>(
            `/api/inventory/tasks/${taskId}/assets`,
            { params: { pageSize: 9999 } },
          ),
        ]);

        const pageData = pageRes.data?.data ?? pageRes.data;
        const allData = allRes.data?.data ?? allRes.data;
        const total =
          pageRes.data?.total ?? allData.length;

        setAssets(Array.isArray(pageData) ? pageData : []);
        setAllAssets(Array.isArray(allData) ? allData : []);
        setPagination((prev) => ({ ...prev, current: p, pageSize: ps, total }));
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to load asset list';
        setError(msg);
        message.error(msg);
      }
    },
    [taskId, pagination.current, pagination.pageSize],
  );

  // ---- combined refresh ----

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTaskDetail(), fetchAssets(1, pagination.pageSize)]);
    } finally {
      setLoading(false);
    }
  }, [fetchTaskDetail, fetchAssets, pagination.pageSize]);

  // initial load
  useEffect(() => {
    if (taskId) {
      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ---- derived: summary ----

  const summary = useMemo<IInventorySummary>(() => {
    const totalAssets = allAssets.length;
    if (totalAssets === 0) {
      return {
        totalAssets: 0,
        scannedCount: 0,
        unscannedCount: 0,
        surplusCount: 0,
        shortageCount: 0,
        progressPercentage: 0,
      };
    }

    const scanned = allAssets.filter(
      (a) => a.scanStatus !== 'NOT_SCANNED',
    );
    const scannedCount = scanned.length;
    const unscannedCount = totalAssets - scannedCount;

    let surplusCount = 0;
    let shortageCount = 0;

    scanned.forEach((asset) => {
      const qty = asset.actualQuantity ?? 0;
      if (qty > asset.bookQuantity) {
        surplusCount += qty - asset.bookQuantity;
      } else if (qty < asset.bookQuantity) {
        shortageCount += asset.bookQuantity - qty;
      }
    });

    const progressPercentage = Math.round((scannedCount / totalAssets) * 100);

    return {
      totalAssets,
      scannedCount,
      unscannedCount,
      surplusCount,
      shortageCount,
      progressPercentage,
    };
  }, [allAssets]);

  // ---- derived: diff items ----

  const diffItems = useMemo<IDiffItem[]>(() => {
    return allAssets
      .filter(
        (a) =>
          a.scanStatus === 'SCANNED_SURPLUS' ||
          a.scanStatus === 'SCANNED_SHORTAGE',
      )
      .map((a) => {
        const actual = a.actualQuantity ?? 0;
        const book = a.bookQuantity;
        const diff = Math.abs(actual - book);
        return {
          assetId: a.id,
          assetCode: a.assetCode,
          assetName: a.assetName,
          diffType:
            actual > book
              ? ('SURPLUS' as const)
              : ('SHORTAGE' as const),
          bookQuantity: book,
          actualQuantity: actual,
          diff,
        };
      });
  }, [allAssets]);

  // ---- actions ----

  /** 更新单条资产的实盘状态（乐观更新本地状态） */
  const updateAssetScanStatus = useCallback(
    (assetId: string, status: AssetScanStatus, actualQuantity?: number) => {
      const patch = (list: IAssetItem[]) =>
        list.map((a) => {
          if (a.id !== assetId) return a;
          const qty = actualQuantity ?? a.actualQuantity;
          const inferredStatus =
            status === 'NOT_SCANNED'
              ? 'NOT_SCANNED'
              : inferScanStatus(a.bookQuantity, qty ?? null);
          return {
            ...a,
            scanStatus: inferredStatus,
            actualQuantity: qty,
            lastScannedAt:
              inferredStatus !== 'NOT_SCANNED'
                ? new Date().toISOString()
                : a.lastScannedAt,
          };
        });

      setAssets((prev) => patch(prev));
      setAllAssets((prev) => patch(prev));
    },
    [],
  );

  /** 更新单条资产备注（乐观更新） */
  const updateAssetRemarks = useCallback(
    (assetId: string, remarks: string) => {
      const patch = (list: IAssetItem[]) =>
        list.map((a) => (a.id === assetId ? { ...a, remarks } : a));

      setAssets((prev) => patch(prev));
      setAllAssets((prev) => patch(prev));
    },
    [],
  );

  /** 批量确认资产（调用后端 API 后更新本地状态） */
  const batchConfirmAssets = useCallback(
    async (assetIds: string[]) => {
      if (assetIds.length === 0) return;
      try {
        await apiClient.post(
          `/api/inventory/tasks/${taskId}/assets/batch-confirm`,
          { assetIds },
        );

        const confirm = (list: IAssetItem[]) =>
          list.map((a) => {
            if (!assetIds.includes(a.id)) return a;
            const qty = a.actualQuantity ?? a.bookQuantity;
            return {
              ...a,
              scanStatus: inferScanStatus(a.bookQuantity, qty),
              actualQuantity: qty,
              lastScannedAt: new Date().toISOString(),
            };
          });

        setAssets((prev) => confirm(prev));
        setAllAssets((prev) => confirm(prev));
        message.success(`已确认 ${assetIds.length} 项资产`);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Batch confirmation failed';
        message.error(msg);
      }
    },
    [taskId],
  );

  /** 提交核准（POST /api/inventory/approve） */
  const submitForApproval = useCallback(async (): Promise<boolean> => {
    if (!task) return false;
    if (task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED') {
      message.warning('当前任务状态不允许提交核准');
      return false;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/inventory/approve', {
        taskId: task.id,
        summary: {
          totalAssets: summary.totalAssets,
          scannedCount: summary.scannedCount,
          surplusCount: summary.surplusCount,
          shortageCount: summary.shortageCount,
        },
      });
      setTask((prev) =>
        prev ? { ...prev, status: 'SUBMITTED' as InventoryTaskStatus } : prev,
      );
      message.success('盘点结果已提交核准');
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Submission failed';
      message.error(msg);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [task, summary]);

  // ---- return ----

  return {
    task,
    assets,
    allAssets,
    summary,
    diffItems,
    loading,
    submitting,
    error,
    pagination,

    refreshData,
    fetchAssets,
    updateAssetScanStatus,
    updateAssetRemarks,
    batchConfirmAssets,
    submitForApproval,
  };
};

export default useInventoryDetail;