/**
 * @file AssetTable.tsx
 * @description 盘点执行详情页 — 资产清单表格组件（P3-010-D）
 *
 * 核心功能：
 * - 分页加载任务下资产清单，支持逐条确认与批量确认
 * - 内联实盘状态下拉 + 备注输入 + 确认按钮（逐条确认）
 * - 批量勾选 + 批量确认弹窗（上限 100 条）
 * - 资产数 > 200 时启用 Ant Design 虚拟滚动（底层 rc-virtual-list）
 * - 只读模式（completed / submitted）禁用所有编辑控件
 * - draft 模式显示"请先将任务状态变更为进行中"提示
 * - 所有写操作按钮含 loading 态防重复提交
 *
 * @see SWARM-P3-010-FE Specification
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';

import type { InventoryAsset, ActualStatus } from '../../types/inventory';
import {
  useInventoryAssets,
  useConfirmAsset,
  useBatchConfirmAssets,
} from '../../hooks/useInventory';
import { useInventoryStore } from '../../stores/useInventoryStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 超过此阈值启用虚拟滚动（SPEC: 200） */
const VIRTUAL_SCROLL_THRESHOLD = 200;

/** 单次批量确认上限（SPEC 约束 #7） */
const BATCH_CONFIRM_LIMIT = 100;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 20;

/** 虚拟滚动容器高度 (px) */
const VIRTUAL_SCROLL_Y = 600;

/** 实盘状态下拉选项（SPEC 数据约束: actualStatus 枚举） */
const ACTUAL_STATUS_OPTIONS: { value: ActualStatus; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'surplus', label: '盘盈' },
  { value: 'deficit', label: '盘亏' },
  { value: 'damaged', label: '损坏' },
  { value: 'other', label: '其他' },
];

/** 实盘状态 → Tag 显示配置 */
const ACTUAL_STATUS_TAG_MAP: Record<
  ActualStatus,
  { color: string; label: string }
> = {
  normal: { color: 'success', label: '正常' },
  surplus: { color: 'green', label: '盘盈' },
  deficit: { color: 'red', label: '盘亏' },
  damaged: { color: 'warning', label: '损坏' },
  other: { color: 'default', label: '其他' },
};

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

/** 逐行编辑状态（未确认资产的临时输入缓存） */
interface RowEditState {
  actualStatus?: ActualStatus;
  remark: string;
}

/**
 * AssetTable 组件属性
 *
 * 与 SPEC "组件 Props 接口摘要" 中 AssetTable 定义对齐，
 * 额外增加 taskStatus 以支持 draft 模式提示。
 */
export interface AssetTableProps {
  /** 盘点任务唯一标识 */
  taskId: string;
  /** 是否只读（completed / submitted 时为 true） */
  readOnly: boolean;
  /** 当前任务状态，用于 draft 模式下显示操作提示 */
  taskStatus?: 'draft' | 'in_progress' | 'completed' | 'submitted';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetTable — 盘点执行详情页的资产清单表格
 *
 * 当任务处于「进行中」时，允许逐条/批量确认操作；
 * 「已完成」「已提交」时切换为只读；
 * 「草稿」时显示提示文案。
 *
 * @param props.taskId     - 盘点任务 ID
 * @param props.readOnly   - 是否只读模式
 * @param props.taskStatus - 任务状态（可选，用于 draft 提示）
 * @returns 资产清单表格 React 节点
 */
const AssetTable: React.FC<AssetTableProps> = ({
  taskId,
  readOnly,
  taskStatus,
}) => {
  // =========================================================================
  // Local state
  // =========================================================================

  /** 当前分页参数 */
  const [pagination, setPagination] = useState<{
    current: number;
    pageSize: number;
  }>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  /** 逐行编辑临时状态 */
  const [rowEdits, setRowEdits] = useState<Record<string, RowEditState>>({});

  /** 正在执行逐条确认的资产 ID（用于单行 loading 指示） */
  const [confirmingAssetId, setConfirmingAssetId] = useState<string | null>(
    null,
  );

  /** 批量确认弹窗是否可见 */
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  /** 批量确认弹窗中的统一实盘状态 */
  const [batchActualStatus, setBatchActualStatus] = useState<
    ActualStatus | undefined
  >(undefined);

  /** 批量确认弹窗中的统一备注 */
  const [batchRemark, setBatchRemark] = useState('');

  // =========================================================================
  // Zustand store — 批量选中集合
  // =========================================================================

  const selectedAssetKeys = useInventoryStore((s) => s.selectedAssetKeys);
  const setSelectedAssetKeys = useInventoryStore(
    (s) => s.setSelectedAssetKeys,
  );
  const clearSelection = useInventoryStore((s) => s.clearSelection);

  // =========================================================================
  // React Query — 数据获取与变更
  // =========================================================================

  /** 获取任务下资产清单（分页） */
  const { data: assetsResponse, isLoading } = useInventoryAssets(taskId, {
    page: pagination.current,
    pageSize: pagination.pageSize,
  });

  /** 逐条确认 mutation */
  const confirmMutation = useConfirmAsset();

  /** 批量确认 mutation */
  const batchConfirmMutation = useBatchConfirmAssets();

  // =========================================================================
  // Derived state
  // =========================================================================

  /** 当前页资产列表 */
  const assets: InventoryAsset[] = useMemo(
    () => assetsResponse?.items ?? [],
    [assetsResponse],
  );

  /** 资产总数（跨页） */
  const total: number = assetsResponse?.total ?? 0;

  /** 是否启用虚拟滚动 */
  const enableVirtual = assets.length > VIRTUAL_SCROLL_THRESHOLD;

  /** 已选中的 key 数组 */
  const selectedKeysArray = selectedAssetKeys;

  /** 是否为 draft 状态 */
  const isDraft = taskStatus === 'draft';

  // =========================================================================
  // Row edit helpers
  // =========================================================================

  /**
   * 获取指定行的编辑状态，若不存在则返回默认值
   * @param assetId - 资产 ID
   * @returns 该行的编辑状态
   */
  const getRowEdit = useCallback(
    (assetId: string): RowEditState =>
      rowEdits[assetId] ?? { remark: '' },
    [rowEdits],
  );

  /**
   * 局部更新指定行的编辑状态
   * @param assetId - 资产 ID
   * @param patch - 要合并的部分字段
   */
  const updateRowEdit = useCallback(
    (assetId: string, patch: Partial<RowEditState>) => {
      setRowEdits((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? { remark: '' }),
          ...patch,
        },
      }));
    },
    [],
  );

  // =========================================================================
  // Individual confirm handler
  // =========================================================================

  /**
   * 逐条确认资产 — 触发 PATCH .../assets/:assetId/confirm
   *
   * 含 loading 防重复：确认中按钮置灰，直到 mutation 完成。
   *
   * @param asset - 待确认的资产对象
   */
  const handleConfirm = useCallback(
    (asset: InventoryAsset) => {
      const assetKey = asset.id ?? asset.assetId;
      const edit = getRowEdit(assetKey);

      if (!edit.actualStatus) {
        message.warning('请先选择实盘状态');
        return;
      }

      setConfirmingAssetId(assetKey);

      confirmMutation.mutate(
        {
          taskId,
          assetId: assetKey,
          payload: {
            actualStatus: edit.actualStatus,
            remark: edit.remark,
          },
        },
        {
          onSuccess: () => {
            message.success('资产确认成功');
            // 清除该行临时编辑状态
            setRowEdits((prev) => {
              const next = { ...prev };
              delete next[assetKey];
              return next;
            });
          },
          onError: () => {
            message.error('确认失败，请重试');
          },
          onSettled: () => {
            setConfirmingAssetId(null);
          },
        },
      );
    },
    [taskId, getRowEdit, confirmMutation],
  );

  // =========================================================================
  // Batch confirm handlers
  // =========================================================================

  /**
   * 打开批量确认弹窗
   *
   * 超过 BATCH_CONFIRM_LIMIT(100) 条时自动截断并提示。
   */
  const handleOpenBatchModal = useCallback(() => {
    if (selectedKeysArray.length === 0) return;

    if (selectedKeysArray.length > BATCH_CONFIRM_LIMIT) {
      message.warning(
        `单次批量确认上限 ${BATCH_CONFIRM_LIMIT} 条，已自动截断多余选择`,
      );
      setSelectedAssetKeys(
        selectedKeysArray.slice(0, BATCH_CONFIRM_LIMIT),
      );
    }

    setBatchActualStatus(undefined);
    setBatchRemark('');
    setBatchModalVisible(true);
  }, [selectedKeysArray, setSelectedAssetKeys]);

  /**
   * 执行批量确认 — 触发 POST .../assets/batch-confirm
   *
   * 成功后清空选中状态并关闭弹窗。
   */
  const handleBatchConfirm = useCallback(() => {
    if (!batchActualStatus) {
      message.warning('请选择统一实盘状态');
      return;
    }

    const assetIds = selectedKeysArray.slice(0, BATCH_CONFIRM_LIMIT);

    batchConfirmMutation.mutate(
      {
        taskId,
        assetIds,
        actualStatus: batchActualStatus,
        remark: batchRemark,
      },
      {
        onSuccess: () => {
          message.success(`已批量确认 ${assetIds.length} 条资产`);
          clearSelection();
          setBatchModalVisible(false);
        },
        onError: () => {
          message.error('批量确认失败，请重试');
        },
      },
    );
  }, [
    taskId,
    batchActualStatus,
    batchRemark,
    selectedKeysArray,
    batchConfirmMutation,
    clearSelection,
  ]);

  // =========================================================================
  // Row selection config（批量勾选）
  // =========================================================================

  const rowSelection: TableRowSelection<InventoryAsset> | undefined =
    readOnly
      ? undefined
      : {
          selectedRowKeys: selectedKeysArray,
          onChange: (keys: React.Key[]) => {
            setSelectedAssetKeys(keys as string[]);
          },
          /** 已确认的行不可勾选 */
          getCheckboxProps: (record: InventoryAsset) => ({
            disabled: record.confirmed === true,
          }),
        };

  // =========================================================================
  // Column definitions
  // =========================================================================

  /**
   * 表格列定义
   *
   * 列顺序与 ATB-003 对齐：资产编号 | 资产名称 | 账面状态 | 实盘状态 | 备注 | 操作
   */
  const columns: ColumnsType<InventoryAsset> = useMemo(
    () => [
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 150,
        fixed: 'left' as const,
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 180,
        ellipsis: true,
      },
      {
        title: '账面状态',
        dataIndex: 'bookStatus',
        key: 'bookStatus',
        width: 100,
        render: (status: string) => <Tag>{status || '-'}</Tag>,
      },
      {
        title: '实盘状态',
        key: 'actualStatus',
        width: 150,
        render: (_: unknown, record: InventoryAsset) => {
          // ---- 已确认：只读 Tag ----
          if (record.confirmed && record.actualStatus) {
            const cfg = ACTUAL_STATUS_TAG_MAP[record.actualStatus];
            return cfg ? (
              <Tag color={cfg.color}>{cfg.label}</Tag>
            ) : (
              <span>{record.actualStatus}</span>
            );
          }

          // ---- 只读模式（completed / submitted）：占位 ----
          if (readOnly) {
            return <span style={{ color: '#aaa' }}>—</span>;
          }

          // ---- 可编辑：下拉选择 ----
          const recordKey = record.id ?? record.assetId;
          const edit = getRowEdit(recordKey);
          return (
            <Select
              placeholder="请选择"
              size="small"
              style={{ width: '100%' }}
              options={ACTUAL_STATUS_OPTIONS}
              value={edit.actualStatus}
              onChange={(val: ActualStatus) =>
                updateRowEdit(recordKey, { actualStatus: val })
              }
              aria-label={`实盘状态选择-${record.assetCode}`}
            />
          );
        },
      },
      {
        title: '备注',
        key: 'remark',
        width: 200,
        render: (_: unknown, record: InventoryAsset) => {
          // ---- 已确认：只读文本 ----
          if (record.confirmed) {
            return <span>{record.remark || '-'}</span>;
          }

          // ---- 只读模式：占位 ----
          if (readOnly) {
            return <span style={{ color: '#aaa' }}>—</span>;
          }

          // ---- 可编辑：输入框（0-200 字符） ----
          const recordKey = record.id ?? record.assetId;
          const edit = getRowEdit(recordKey);
          return (
            <Input
              size="small"
              placeholder="可选备注"
              maxLength={200}
              value={edit.remark}
              onChange={(e) =>
                updateRowEdit(recordKey, { remark: e.target.value })
              }
              aria-label={`备注输入-${record.assetCode}`}
            />
          );
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_: unknown, record: InventoryAsset) => {
          // 已确认 或 只读模式：不渲染操作按钮
          if (record.confirmed || readOnly) {
            return null;
          }

          const recordKey = record.id ?? record.assetId;
          const isConfirming = confirmingAssetId === recordKey;

          return (
            <Button
              type="link"
              size="small"
              loading={isConfirming}
              disabled={isConfirming}
              onClick={() => handleConfirm(record)}
              aria-label={`确认资产-${record.assetCode}`}
            >
              确认
            </Button>
          );
        },
      },
    ],
    [
      readOnly,
      rowEdits,
      confirmingAssetId,
      getRowEdit,
      updateRowEdit,
      handleConfirm,
    ],
  );

  // =========================================================================
  // Pagination handler
  // =========================================================================

  /**
   * 表格分页变化回调
   * @param pag - Ant Design 分页配置
   */
  const handleTableChange = useCallback(
    (pag: TablePaginationConfig) => {
      setPagination({
        current: pag.current ?? 1,
        pageSize: pag.pageSize ?? DEFAULT_PAGE_SIZE,
      });
    },
    [],
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      className="asset-table-container"
      role="region"
      aria-label="盘点资产清单"
    >
      {/* ---- Draft 模式提示（ATB-007 Step 3）---- */}
      {isDraft && !readOnly && (
        <Alert
          message="请先将任务状态变更为「进行中」后再进行盘点操作"
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      {/* ---- 批量操作工具栏（ATB-005）---- */}
      {!readOnly && (
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>
            {selectedKeysArray.length > 0
              ? `已选 ${selectedKeysArray.length} 项`
              : '未选择资产'}
          </span>
          <Button
            type="primary"
            disabled={selectedKeysArray.length === 0}
            loading={batchConfirmMutation.isPending}
            onClick={handleOpenBatchModal}
            aria-label="批量确认选中资产"
          >
            批量确认
          </Button>
          {selectedKeysArray.length > 0 && (
            <Button size="small" onClick={clearSelection}>
              清除选择
            </Button>
          )}
        </div>
      )}

      {/* ---- 资产清单表格 ---- */}
      <Table<InventoryAsset>
        columns={columns}
        dataSource={assets}
        rowKey={(record) => record.id ?? record.assetId}
        loading={isLoading}
        rowSelection={rowSelection}
        scroll={
          enableVirtual
            ? { y: VIRTUAL_SCROLL_Y, x: 900 }
            : { x: 900 }
        }
        virtual={enableVirtual}
        pagination={
          enableVirtual
            ? false
            : {
                current: pagination.current,
                pageSize: pagination.pageSize,
                total,
                showSizeChanger: false,
                showTotal: (t: number) => `共 ${t} 条`,
              }
        }
        onChange={handleTableChange}
        size="middle"
        bordered
      />

      {/* ---- 批量确认弹窗（ATB-005 Step 4）---- */}
      <Modal
        title="批量确认"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchConfirm}
        confirmLoading={batchConfirmMutation.isPending}
        okText="确认"
        cancelText="取消"
        aria-label="批量确认弹窗"
      >
        <p style={{ marginBottom: 16 }}>
          将对{' '}
          <strong>{selectedKeysArray.length}</strong>{' '}
          条资产统一设置实盘状态
        </p>

        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>
            实盘状态 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择统一实盘状态"
            options={ACTUAL_STATUS_OPTIONS}
            value={batchActualStatus}
            onChange={(val: ActualStatus) => setBatchActualStatus(val)}
            aria-label="批量确认-统一实盘状态"
          />
        </div>

        <div>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>
            备注（可选）
          </div>
          <Input.TextArea
            maxLength={200}
            rows={3}
            placeholder="统一备注，0-200 字符"
            value={batchRemark}
            onChange={(e) => setBatchRemark(e.target.value)}
            aria-label="批量确认-统一备注"
          />
        </div>
      </Modal>
    </div>
  );
};

export default AssetTable;