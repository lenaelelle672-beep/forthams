/**
 * useInventorySummary — 盘点执行详情页顶部进度看板 & 数据聚合 Hook
 *
 * Phase 3 [SWARM-P3-010-FE] 资产盘点前端交互与业务闭环
 *
 * 职责:
 *   1. 根据 taskId 拉取盘点资产明细 (通过 inventoryDetailApi 服务层)
 *   2. 前端侧实时计算五大统计指标 (总资产/已盘/未盘/盘盈/盘亏) 及完成进度
 *   3. 提供逐条状态变更、批量确认、提交核准等操作方法
 *   4. 导出盘盈盘亏差异明细供底部 DiffSummary 面板消费
 *
 * @module pages/InventoryDetail/hooks/useInventorySummary
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchInventoryAssets,
  submitInventoryApproval,
} from '../services/inventoryDetailApi';
import type {
  IAssetItem,
  IInventorySummary,
  IDiffRecord,
} from '../../../types/inventory.types';

// ---------------------------------------------------------------------------
// 类型定义 (与 shared types 对齐，此处 re-export 方便同模块引用)
// ---------------------------------------------------------------------------

export type { IAssetItem, IInventorySummary, IDiffRecord };

/** 盘点状态枚举 — 实盘点选值 */
export type InventoryCheckStatus = 'unchecked' | 'checked' | 'surplus' | 'deficit';

// ---------------------------------------------------------------------------
// Hook 参数
// ---------------------------------------------------------------------------

export interface UseInventorySummaryOptions {
  /** 当前盘点任务 ID，来自路由参数 */
  taskId: string;
  /** 是否在挂载时自动拉取，默认 true */
  autoFetch?: boolean;
}

// ---------------------------------------------------------------------------
// Hook 返回值
// ---------------------------------------------------------------------------

export interface UseInventorySummaryReturn {
  /** 资产明细列表 */
  assets: IAssetItem[];
  /** 聚合统计指标 */
  summary: IInventorySummary;
  /** 盘盈盘亏差异明细 (供底部面板消费) */
  diffRecords: IDiffRecord[];
  /** 全局 loading */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 修改单条资产实盘状态 */
  updateAssetStatus: (assetId: string, status: InventoryCheckStatus) => void;
  /** 修改单条资产备注 */
  updateAssetRemark: (assetId: string, remark: string) => void;
  /** 修改单条资产实盘数量 */
  updateAssetActualQuantity: (assetId: string, quantity: number) => void;
  /** 批量确认选中资产 (将状态置为 checked) */
  bulkConfirmSelected: (selectedIds: string[]) => void;
  /** 一键提交核准 — POST /api/inventory/approve (ATB-05) */
  submitApproval: () => Promise<void>;
  /** 手动刷新资产列表 */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// 默认空汇总
// ---------------------------------------------------------------------------

const EMPTY_SUMMARY: IInventorySummary = {
  totalAssets: 0,
  checkedAssets: 0,
  uncheckedAssets: 0,
  surplusCount: 0,
  deficitCount: 0,
  progress: 0,
};

// ---------------------------------------------------------------------------
// Hook 实现
// ---------------------------------------------------------------------------

/**
 * 盘点摘要计算 Hook
 *
 * 根据传入的 taskId 拉取资产明细列表，并实时在前端侧完成:
 * - 进度百分比计算 (已盘 / 总资产 × 100)
 * - 盘盈 (actualQuantity > bookQuantity) / 盘亏 (actualQuantity < bookQuantity) 统计
 * - 差异明细列表生成
 *
 * @param options - Hook 配置项，必须包含 taskId
 * @returns 盘点摘要状态与操作方法
 */
export function useInventorySummary(
  options: UseInventorySummaryOptions,
): UseInventorySummaryReturn {
  const { taskId, autoFetch = true } = options;

  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ---- 数据拉取 ----------------------------------------------------------

  /**
   * 从服务层拉取指定任务的资产明细列表
   */
  const fetchAssets = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInventoryAssets(id);
        setAssets(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : '获取盘点资产明细失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** 手动刷新 */
  const refresh = useCallback(async () => {
    if (taskId) {
      await fetchAssets(taskId);
    }
  }, [taskId, fetchAssets]);

  /** 挂载时自动拉取 */
  useEffect(() => {
    if (autoFetch && taskId) {
      fetchAssets(taskId);
    }
  }, [autoFetch, taskId, fetchAssets]);

  // ---- 单条资产操作 -------------------------------------------------------

  /** 更新单条资产的实盘状态 */
  const updateAssetStatus = useCallback(
    (assetId: string, status: InventoryCheckStatus) => {
      setAssets((prev) =>
        prev.map((item) =>
          item.id === assetId ? { ...item, checkStatus: status } : item,
        ),
      );
    },
    [],
  );

  /** 更新单条资产的备注 */
  const updateAssetRemark = useCallback(
    (assetId: string, remark: string) => {
      setAssets((prev) =>
        prev.map((item) =>
          item.id === assetId ? { ...item, remark } : item,
        ),
      );
    },
    [],
  );

  /** 更新单条资产的实盘数量 */
  const updateAssetActualQuantity = useCallback(
    (assetId: string, quantity: number) => {
      setAssets((prev) =>
        prev.map((item) =>
          item.id === assetId ? { ...item, actualQuantity: quantity } : item,
        ),
      );
    },
    [],
  );

  // ---- 批量操作 -----------------------------------------------------------

  /**
   * 批量确认选中资产 — 将指定 ID 列表对应资产的 checkStatus 置为 'checked'
   * 对应 ATB-04 批量确认场景
   */
  const bulkConfirmSelected = useCallback(
    (selectedIds: string[]) => {
      const idSet = new Set(selectedIds);
      setAssets((prev) =>
        prev.map((item) =>
          idSet.has(item.id)
            ? { ...item, checkStatus: 'checked' as InventoryCheckStatus }
            : item,
        ),
      );
    },
    [],
  );

  // ---- 聚合计算 -----------------------------------------------------------

  /**
   * 五大统计指标实时计算
   *
   * 总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏 / 进度%
   * 对应 ATB-03 验收标准
   */
  const summary = useMemo<IInventorySummary>(() => {
    const totalAssets = assets.length;
    if (totalAssets === 0) {
      return { ...EMPTY_SUMMARY };
    }

    const checkedAssets = assets.filter(
      (a) => a.checkStatus === 'checked',
    ).length;

    const uncheckedAssets = assets.filter(
      (a) => a.checkStatus === 'unchecked' || !a.checkStatus,
    ).length;

    // 盘盈: 实盘数量 > 账面数量 (账面无，实盘有)
    const surplusCount = assets.filter(
      (a) => a.actualQuantity > a.bookQuantity,
    ).length;

    // 盘亏: 实盘数量 < 账面数量 (账面有，实盘无)
    const deficitCount = assets.filter(
      (a) => a.actualQuantity < a.bookQuantity,
    ).length;

    const progress = Math.round((checkedAssets / totalAssets) * 100);

    return {
      totalAssets,
      checkedAssets,
      uncheckedAssets,
      surplusCount,
      deficitCount,
      progress,
    };
  }, [assets]);

  /**
   * 盘盈盘亏差异明细 — 供底部 DiffSummary 面板消费
   *
   * 对应 ATB-05: 注入"账面有实盘无"(盘亏) 和 "账面无实盘有"(盘盈) 记录
   */
  const diffRecords = useMemo<IDiffRecord[]>(() => {
    return assets
      .filter(
        (a) =>
          a.actualQuantity !== a.bookQuantity,
      )
      .map((a) => ({
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.name,
        bookQuantity: a.bookQuantity,
        actualQuantity: a.actualQuantity,
        diffType:
          a.actualQuantity > a.bookQuantity
            ? ('surplus' as const)
            : ('deficit' as const),
        diffQuantity: Math.abs(a.actualQuantity - a.bookQuantity),
        category: a.category,
        location: a.location,
      }));
  }, [assets]);

  // ---- 提交核准 -----------------------------------------------------------

  /**
   * 一键提交核准
   *
   * 对应 ATB-05: 触发 POST /api/inventory/approve 接口
   * 提交当前所有资产状态及差异汇总，成功后由调用方决定页面跳转
   */
  const submitApproval = useCallback(async () => {
    if (!taskId) {
      throw new Error('缺少任务 ID，无法提交核准');
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        taskId,
        diffRecords: diffRecords.map((r) => ({
          assetId: r.assetId,
          diffType: r.diffType,
          diffQuantity: r.diffQuantity,
        })),
        summary: {
          totalAssets: summary.totalAssets,
          checkedAssets: summary.checkedAssets,
          surplusCount: summary.surplusCount,
          deficitCount: summary.deficitCount,
        },
      };

      await submitInventoryApproval(payload);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '提交核准失败，请稍后重试';
      setError(message);
      throw err; // re-throw 让 UI 层处理降级提示
    } finally {
      setLoading(false);
    }
  }, [taskId, diffRecords, summary]);

  // ---- 返回值 -------------------------------------------------------------

  return {
    assets,
    summary,
    diffRecords,
    loading,
    error,
    updateAssetStatus,
    updateAssetRemark,
    updateAssetActualQuantity,
    bulkConfirmSelected,
    submitApproval,
    refresh,
  };
}

export default useInventorySummary;