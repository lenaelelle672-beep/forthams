/**
 * @module AssetTable
 * @description 盘点执行详情页 — 中部资产清单可编辑表格组件。
 *
 * 职责：
 * 1. 渲染资产明细列表（编码 / 名称 / 分类 / 位置 / 账面状态 / 实盘状态 / 备注）。
 * 2. 通过 `StatusDropdown` 原子组件实现逐条实盘状态变更。
 * 3. 备注列支持行内编辑。
 * 4. 支持 Checkbox 单选 / 多选，底部批量确认按钮。
 * 5. 状态变更后行高亮反馈（3 s 自动消退）。
 * 6. 分页加载，单页最大 200 条，满足 FPS > 30 性能约束。
 *
 * @example
 * ```tsx
 * <AssetTable
 *   items={assetList}
 *   loading={fetching}
 *   onStatusChange={handleStatusChange}
 *   onRemarkChange={handleRemarkChange}
 *   onBatchConfirm={handleBatchConfirm}
 * />
 * ```
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Button,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { StatusDropdown } from '../StatusDropdown';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** 实盘状态枚举值 */
export type InventoryScanStatus =
  | 'unchecked'   // 未盘
  | 'checked'     // 已盘
  | 'surplus'     // 盘盈
  | 'deficit'     // 盘亏
  | 'abnormal';   // 异常

/**
 * 资产清单行数据模型。
 * 与后端 `InventoryDetailRecordDTO` 对应。
 */
export interface IAssetItem {
  /** 资产唯一标识 */
  id: string;
  /** 资产编码 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 资产分类名称 */
  category: string;
  /** 所在位置 */
  location: string;
  /** 账面状态（如：在用、闲置、报废等） */
  bookStatus: string;
  /** 实盘状态 */
  actualStatus: InventoryScanStatus;
  /** 盘点备注 */
  remark: string;
  /** 最后更新时间（可选，用于展示） */
  updatedAt?: string;
}

/** AssetTable 组件属性 */
export interface AssetTableProps {
  /** 资产清单数据 */
  items: IAssetItem[];
  /** 加载中标识 */
  loading?: boolean;
  /** 单条资产实盘状态变更回调 */
  onStatusChange: (assetId: string, status: InventoryScanStatus) => void;
  /** 单条资产备注变更回调 */
  onRemarkChange: (assetId: string, remark: string) => void;
  /** 批量确认回调（传入选中的资产 ID 列表） */
  onBatchConfirm: (assetIds: string[]) => void;
  /** 只读模式（查看已完成盘点） */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 实盘状态显示配置映射表。
 * 将状态枚举映射为中文标签和 Tag 颜色。
 */
const STATUS_CONFIG: Record<
  InventoryScanStatus,
  { label: string; color: string }
> = {
  unchecked: { label: '未盘', color: 'default' },
  checked:   { label: '已盘', color: 'success' },
  surplus:   { label: '盘盈', color: 'blue' },
  deficit:   { label: '盘亏', color: 'error' },
  abnormal:  { label: '异常', color: 'warning' },
};

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 50;

/** 行高亮动画持续时间（毫秒） */
const HIGHLIGHT_DURATION_MS = 3000;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * 渲染只读状态标签。
 *
 * @param status - 实盘状态枚举值
 * @returns 带颜色的 Ant Design Tag 节点
 */
const renderReadOnlyTag = (status: InventoryScanStatus): React.ReactNode => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unchecked;
  return <Tag color={config.color}>{config.label}</Tag>;
};

/**
 * 渲染只读账面状态标签。
 *
 * @param status - 账面状态文本
 * @returns Ant Design Tag 节点
 */
const renderBookStatusTag = (status: string): React.ReactNode => {
  return <Tag>{status}</Tag>;
};

/**
 * 渲染备注列只读视图。
 *
 * @param remark - 备注文本
 * @returns 文本节点或占位符
 */
const renderReadOnlyRemark = (remark: string): React.ReactNode => {
  return <span>{remark || '—'}</span>;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * AssetTable — 盘点资产清单表格。
 *
 * 核心交互：
 * - 每行「实盘状态」列嵌入 `StatusDropdown`，变更后行背景高亮。
 * - 每行「备注」列嵌入 `Input`，支持行内编辑。
 * - 顶部工具栏显示已选数量 & 批量确认按钮（Popconfirm 二次确认）。
 * - 底部分页器，支持切换每页条数（20 / 50 / 100 / 200）。
 *
 * @param props - AssetTableProps
 * @returns React JSX 元素
 */
const AssetTable: React.FC<AssetTableProps> = ({
  items,
  loading = false,
  onStatusChange,
  onRemarkChange,
  onBatchConfirm,
  readOnly = false,
}) => {
  /** 当前选中行的 key 集合 */
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /** 需要高亮显示的行 ID 集合（状态变更后触发） */
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(
    new Set(),
  );

  /** 高亮计时器引用，用于清理 */
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // -----------------------------------------------------------------------
  // Event Handlers
  // -----------------------------------------------------------------------

  /**
   * 处理单条资产实盘状态变更。
   * 触发父组件回调，并设置该行高亮效果。
   *
   * @param assetId - 资产 ID
   * @param status  - 新的实盘状态
   */
  const handleStatusChange = useCallback(
    (assetId: string, status: InventoryScanStatus) => {
      onStatusChange(assetId, status);

      // 设置行高亮
      setHighlightedRows((prev) => {
        const next = new Set(prev);
        next.add(assetId);
        return next;
      });

      // 清除旧计时器
      const oldTimer = highlightTimers.current.get(assetId);
      if (oldTimer) {
        clearTimeout(oldTimer);
      }

      // 设置新计时器：到期后移除高亮
      const timer = setTimeout(() => {
        setHighlightedRows((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
        highlightTimers.current.delete(assetId);
      }, HIGHLIGHT_DURATION_MS);

      highlightTimers.current.set(assetId, timer);
    },
    [onStatusChange],
  );

  /**
   * 处理备注输入变更。
   *
   * @param assetId - 资产 ID
   * @param e       - 输入事件
   */
  const handleRemarkChange = useCallback(
    (assetId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      onRemarkChange(assetId, e.target.value);
    },
    [onRemarkChange],
  );

  /**
   * 批量确认已选中行。
   * 仅在至少选中一行时触发回调。
   */
  const handleBatchConfirm = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一条资产记录');
      return;
    }
    onBatchConfirm(selectedRowKeys as string[]);
    setSelectedRowKeys([]);
  }, [selectedRowKeys, onBatchConfirm]);

  // 组件卸载时清理所有高亮计时器
  React.useEffect(() => {
    const timersRef = highlightTimers.current;
    return () => {
      timersRef.forEach((timer) => clearTimeout(timer));
      timersRef.clear();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Column Definitions
  // -----------------------------------------------------------------------

  /**
   * 表格列配置（useMemo 避免不必要的重渲染）。
   */
  const columns: ColumnsType<IAssetItem> = useMemo(() => {
    const cols: ColumnsType<IAssetItem> = [
      {
        title: '资产编码',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 150,
        fixed: 'left',
        ellipsis: true,
        sorter: (a, b) => a.assetCode.localeCompare(b.assetCode),
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 200,
        ellipsis: true,
        sorter: (a, b) => a.assetName.localeCompare(b.assetName),
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: 120,
        ellipsis: true,
        filters: Array.from(new Set(items.map((i) => i.category))).map(
          (c) => ({ text: c, value: c }),
        ),
        onFilter: (value, record) => record.category === value,
      },
      {
        title: '位置',
        dataIndex: 'location',
        key: 'location',
        width: 160,
        ellipsis: true,
      },
      {
        title: '账面状态',
        dataIndex: 'bookStatus',
        key: 'bookStatus',
        width: 100,
        align: 'center',
        render: renderBookStatusTag,
      },
      {
        title: '实盘状态',
        dataIndex: 'actualStatus',
        key: 'actualStatus',
        width: 150,
        align: 'center',
        render: (status: InventoryScanStatus, record: IAssetItem) => {
          if (readOnly) {
            return renderReadOnlyTag(status);
          }
          return (
            <StatusDropdown
              value={status}
              onChange={(newStatus: InventoryScanStatus) =>
                handleStatusChange(record.id, newStatus)
              }
            />
          );
        },
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        width: 220,
        render: (remark: string, record: IAssetItem) => {
          if (readOnly) {
            return renderReadOnlyRemark(remark);
          }
          return (
            <Input
              value={remark}
              placeholder="输入备注…"
              onChange={(e) => handleRemarkChange(record.id, e)}
              size="small"
              allowClear
              maxLength={200}
            />
          );
        },
      },
    ];

    return cols;
  }, [readOnly, items, handleStatusChange, handleRemarkChange]);

  // -----------------------------------------------------------------------
  // Row Selection
  // -----------------------------------------------------------------------

  /** 多选配置 */
  const rowSelection = readOnly
    ? undefined
    : {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
        getCheckboxProps: () => ({ disabled: false }),
      };

  // -----------------------------------------------------------------------
  // Row Class Name (highlight)
  // -----------------------------------------------------------------------

  /**
   * 根据行数据返回 CSS 类名。
   * 状态变更的行会获得高亮类名。
   *
   * @param record - 行数据
   * @returns CSS 类名字符串
   */
  const getRowClassName = useCallback(
    (record: IAssetItem): string => {
      if (highlightedRows.has(record.id)) {
        return 'asset-table-row--highlighted';
      }
      return '';
    },
    [highlightedRows],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="asset-table" data-testid="asset-table">
      {/* ---- Toolbar ---- */}
      {!readOnly && (
        <div className="asset-table__toolbar">
          <Space size="middle">
            <span className="asset-table__selection-info">
              {selectedRowKeys.length > 0
                ? `已选择 ${selectedRowKeys.length} 条记录`
                : '请勾选需要操作的资产'}
            </span>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title="批量确认盘点"
                description={`确认将选中的 ${selectedRowKeys.length} 条资产标记为"已盘"？`}
                onConfirm={handleBatchConfirm}
                okText="确认"
                cancelText="取消"
              >
                <Button type="primary" icon={<CheckCircleOutlined />}>
                  批量确认（{selectedRowKeys.length}）
                </Button>
              </Popconfirm>
            )}
          </Space>
          <Tooltip title="勾选资产后可进行批量确认操作">
            <ExclamationCircleOutlined style={{ color: '#999', fontSize: 14 }} />
          </Tooltip>
        </div>
      )}

      {/* ---- Table ---- */}
      <Table<IAssetItem>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        rowSelection={rowSelection}
        rowClassName={getRowClassName}
        pagination={{
          defaultPageSize: DEFAULT_PAGE_SIZE,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['20', '50', '100', '200'],
          showTotal: (total: number) => `共 ${total} 条资产`,
          size: 'default',
        }}
        scroll={{ x: 1100, y: 'calc(100vh - 400px)' }}
        size="middle"
        bordered
        tableLayout="fixed"
      />

      {/* ---- Row Highlight Styles (scoped via class) ---- */}
      <style>{`
        .asset-table-row--highlighted {
          background-color: #e6f7ff !important;
          transition: background-color 0.3s ease;
        }
        .asset-table-row--highlighted > td {
          background-color: #e6f7ff !important;
        }
        .asset-table__toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 8px 12px;
          background: #fafafa;
          border-radius: 6px;
          border: 1px solid #f0f0f0;
        }
        .asset-table__selection-info {
          color: #666;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

export default AssetTable;