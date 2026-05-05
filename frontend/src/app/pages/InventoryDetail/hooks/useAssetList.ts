/**
 * useAssetList — 盘点执行详情页资产清单管理 Hook
 *
 * 负责盘点任务下资产明细的获取、分页、逐条/批量实盘状态变更、
 * 备注编辑及盘盈盘亏数据提取，为中部可编辑表格提供完整数据与操作接口。
 *
 * @module InventoryDetail/hooks/useAssetList
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import type {
  IAssetItem,
  InventoryCheckStatus,
} from '../../../../types/inventory.types';
import {
  fetchTaskAssets,
  updateAssetCheckStatus,
  batchConfirmAssets,
} from '../services/inventoryDetailApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 分页状态 */
interface PaginationState {
  /** 当前页码（从 1 开始） */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 服务端返回的总条数 */
  total: number;
}

/** Hook 入参 */
interface UseAssetListOptions {
  /** 当前盘点任务 ID */
  taskId: string;
  /** 每页条数，默认 50（满足 200+ 资产时仍可流畅渲染） */
  pageSize?: number;
}

/** Hook 返回值 */
export interface UseAssetListReturn {
  /** 当前页资产列表 */
  assets: IAssetItem[];
  /** 加载态 */
  loading: boolean;
  /** 分页信息 */
  pagination: PaginationState;
  /** 当前选中行的 key 列表 */
  selectedRowKeys: string[];

  /** 已盘数量（仅当前页） */
  checkedCount: number;
  /** 未盘数量（仅当前页） */
  uncheckedCount: number;
  /** 盘盈条目 */
  surplusItems: IAssetItem[];
  /** 盘亏条目 */
  deficitItems: IAssetItem[];

  /** 单条资产实盘状态变更 */
  handleStatusChange: (
    assetId: string,
    status: InventoryCheckStatus,
    remark?: string,
  ) => Promise<void>;
  /** 单条资产备注修改（乐观更新，由调用方负责持久化） */
  handleRemarkChange: (assetId: string, remark: string) => void;
  /** 批量确认已选中资产 */
  handleBatchConfirm: (status?: InventoryCheckStatus) => Promise<void>;
  /** 切换页码 */
  setPage: (page: number) => void;
  /** 更新选中行 */
  selectRows: (keys: string[]) => void;
  /** 手动刷新资产列表 */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Default page size — 保持在 200 条以内单次渲染，避免卡顿 (FPS > 30)
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 管理盘点详情页中部的资产清单表格数据与交互逻辑。
 *
 * - 通过分页加载资产明细（性能约束：单次渲染 ≤ pageSize 条）
 * - 支持逐条实盘状态变更与备注编辑（对接 StatusDropdown 组件）
 * - 支持多选批量确认（对接 Checkbox + 批量确认按钮）
 * - 导出盘盈 / 盘亏子集供底部差异汇总面板使用
 *
 * @param options - Hook 配置，必须包含 taskId
 * @returns 资产列表数据、分页信息及操作方法
 */
export function useAssetList({
  taskId,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseAssetListOptions): UseAssetListReturn {
  // ---- state ----
  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize,
    total: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // ---- fetch ----

  /** 从服务端拉取当前页资产列表 */
  const fetchAssets = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const result = await fetchTaskAssets(taskId, {
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setAssets(result.items ?? []);
      setPagination((prev) => ({ ...prev, total: result.total ?? 0 }));
    } catch (error: unknown) {
      message.error('获取资产清单失败，请稍后重试');
      console.error('[useAssetList] fetchAssets error:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, pagination.current, pagination.pageSize]);

  // ---- single row status ----

  /** 更新单条资产的实盘状态（含可选备注） */
  const handleStatusChange = useCallback(
    async (
      assetId: string,
      status: InventoryCheckStatus,
      remark?: string,
    ) => {
      // 乐观更新：先改本地状态，失败后回滚
      const prevAssets = assets;
      setAssets((draft) =>
        draft.map((item) =>
          item.id === assetId
            ? { ...item, checkStatus: status, remark: remark ?? item.remark }
            : item,
        ),
      );

      try {
        await updateAssetCheckStatus(taskId, assetId, { status, remark });
      } catch (error: unknown) {
        // 回滚
        setAssets(prevAssets);
        message.error('更新实盘状态失败');
        console.error('[useAssetList] handleStatusChange error:', error);
      }
    },
    [taskId, assets],
  );

  // ---- single row remark ----

  /** 本地更新备注（轻量操作，不做网络请求，由调用方按需持久化） */
  const handleRemarkChange = useCallback(
    (assetId: string, remark: string) => {
      setAssets((draft) =>
        draft.map((item) =>
          item.id === assetId ? { ...item, remark } : item,
        ),
      );
    },
    [],
  );

  // ---- batch confirm ----

  /** 批量将选中资产标记为指定实盘状态，默认 'checked' */
  const handleBatchConfirm = useCallback(
    async (status: InventoryCheckStatus = 'checked') => {
      if (selectedRowKeys.length === 0) {
        message.warning('请先选择需要确认的资产');
        return;
      }

      const prevAssets = assets;
      const count = selectedRowKeys.length;

      // 乐观更新
      setAssets((draft) =>
        draft.map((item) =>
          selectedRowKeys.includes(item.id)
            ? { ...item, checkStatus: status }
            : item,
        ),
      );
      setSelectedRowKeys([]);

      try {
        await batchConfirmAssets(taskId, selectedRowKeys, status);
        message.success(`已批量确认 ${count} 条资产`);
      } catch (error: unknown) {
        setAssets(prevAssets);
        message.error('批量确认失败');
        console.error('[useAssetList] handleBatchConfirm error:', error);
      }
    },
    [taskId, selectedRowKeys, assets],
  );

  // ---- pagination ----

  /** 切换到指定页码 */
  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, current: page }));
  }, []);

  // ---- selection ----

  /** 设置当前选中行 keys */
  const selectRows = useCallback((keys: string[]) => {
    setSelectedRowKeys(keys);
  }, []);

  // ---- computed ----

  /** 已盘数量 */
  const checkedCount = useMemo(
    () => assets.filter((a) => a.checkStatus === 'checked').length,
    [assets],
  );

  /** 未盘数量 */
  const uncheckedCount = useMemo(
    () => assets.filter((a) => a.checkStatus === 'unchecked').length,
    [assets],
  );

  /** 盘盈条目（账面无、实盘有） */
  const surplusItems = useMemo(
    () => assets.filter((a) => a.checkStatus === 'surplus'),
    [assets],
  );

  /** 盘亏条目（账面有、实盘无） */
  const deficitItems = useMemo(
    () => assets.filter((a) => a.checkStatus === 'deficit'),
    [assets],
  );

  // ---- return ----
  return {
    assets,
    loading,
    pagination,
    selectedRowKeys,
    checkedCount,
    uncheckedCount,
    surplusItems,
    deficitItems,
    handleStatusChange,
    handleRemarkChange,
    handleBatchConfirm,
    setPage,
    selectRows,
    refresh: fetchAssets,
  };
}

export default useAssetList;