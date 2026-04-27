/**
 * AssetTable — 资产盘点数据表格组件
 *
 * 实现盘点执行工作台中部可编辑数据表格及底部盘盈盘亏差异汇总面板。
 * 包含：
 *   - 可编辑的实盘数量、实盘状态、备注列
 *   - StatusDropdown 独立封装组件（标准 onChange 事件）
 *   - 行选择 / 批量确认
 *   - 行级高亮反馈（状态变更后自动消退）
 *   - 底部差异明细列表 + 一键提交核准
 *
 * 性能：分页加载，单页 10-100 条可配，满足 200+ 数据不卡顿要求。
 *
 * @see ATB-04 资产清单逐条与批量确认
 * @see ATB-05 盘盈盘亏汇总与一键提交
 * @module InventoryDetail/components/AssetTable
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Table,
  Tag,
  Input,
  InputNumber,
  Button,
  Space,
  Popconfirm,
  message,
  Tooltip,
  Typography,
  Row,
  Col,
  Statistic,
  Empty,
  Badge,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SendOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ================================================================
//  类型定义
// ================================================================

/** 盘点状态枚举 */
export type InventoryStatus =
  | 'NOT_COUNTED'
  | 'COUNTED'
  | 'SURPLUS'
  | 'DEFICIT';

/** 盘点状态 → 中文标签 / 颜色映射 */
export const INVENTORY_STATUS_MAP: Record<
  InventoryStatus,
  { label: string; color: string }
> = {
  NOT_COUNTED: { label: '未盘点', color: 'default' },
  COUNTED:     { label: '已盘点', color: 'success' },
  SURPLUS:     { label: '盘盈',   color: 'warning' },
  DEFICIT:     { label: '盘亏',   color: 'error' },
};

/** 盘点状态选项列表（供 StatusDropdown / 外部消费） */
export const INVENTORY_STATUS_OPTIONS = (
  Object.entries(INVENTORY_STATUS_MAP) as [InventoryStatus, { label: string; color: string }][]
).map(([value, { label }]) => ({ value, label }));

/** 资产盘点明细项 */
export interface IAssetItem {
  /** 资产主键 */
  id: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 资产分类 */
  categoryName: string;
  /** 存放位置 */
  locationName: string;
  /** 账面数量 */
  systemQuantity: number;
  /** 实盘数量，null 表示尚未录入 */
  actualQuantity: number | null;
  /** 盘点状态 */
  inventoryStatus: InventoryStatus;
  /** 备注信息 */
  remark?: string;
}

/** 盘点汇总统计 */
export interface IInventorySummary {
  totalAssets: number;
  countedCount: number;
  uncountedCount: number;
  surplusCount: number;
  deficitCount: number;
}

/** 差异明细行 */
export interface IDiffItem {
  assetId: string;
  assetCode: string;
  assetName: string;
  type: 'SURPLUS' | 'DEFICIT';
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  remark?: string;
}

// ================================================================
//  AssetTable Props
// ================================================================

export interface AssetTableProps {
  /** 盘点任务 ID */
  taskId: string;
  /** 资产列表（由父组件通过 useAssetList 等 hook 获取） */
  assets: IAssetItem[];
  /** 加载中 */
  loading?: boolean;
  /** 单条盘点状态 / 数量 / 备注变更回调 */
  onStatusChange?: (
    assetId: string,
    status: InventoryStatus,
    actualQuantity: number | null,
    remark?: string,
  ) => void;
  /** 批量确认回调（将选中资产标记为"已盘点"） */
  onBatchConfirm?: (
    selectedIds: string[],
    status: InventoryStatus,
  ) => void | Promise<void>;
  /** 一键提交核准回调 */
  onSubmitApproval?: (taskId: string) => void | Promise<void>;
  /** 是否可编辑（任务完成后为 false） */
  editable?: boolean;
}

// ================================================================
//  StatusDropdown 组件（独立高复用组件）
// ================================================================

export interface StatusDropdownProps {
  /** 当前值 */
  value?: InventoryStatus;
  /** 值变更回调 */
  onChange?: (status: InventoryStatus) => void;
  /** 禁用态 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'small' | 'middle';
}

/**
 * 实盘状态下拉选择组件
 *
 * 封装盘点状态的渲染与选择逻辑，内部状态高内聚，
 * 对外暴露标准 onChange(status: InventoryStatus) 事件。
 * 可在盘点列表、详情面板等多处复用。
 */
export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'small',
}) => {
  return (
    <select
      value={value ?? 'NOT_COUNTED'}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value as InventoryStatus)}
      data-testid="status-dropdown"
      aria-label="实盘状态"
      style={{
        padding: size === 'small' ? '2px 6px' : '4px 8px',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        fontSize: size === 'small' ? 12 : 14,
        lineHeight: 1.5,
        width: '100%',
        background: disabled ? '#f5f5f5' : '#fff',
        color: '#333',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'border-color 0.2s',
      }}
      onFocus={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = '#1677ff';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#d9d9d9';
      }}
    >
      {INVENTORY_STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

// ================================================================
//  内部辅助：状态标签
// ================================================================

const StatusTag: React.FC<{ status: InventoryStatus }> = React.memo(({ status }) => {
  const { label, color } = INVENTORY_STATUS_MAP[status];
  const iconMap: Record<InventoryStatus, React.ReactNode> = {
    NOT_COUNTED: <MinusCircleOutlined />,
    COUNTED:     <CheckCircleOutlined />,
    SURPLUS:     <ArrowUpOutlined />,
    DEFICIT:     <ArrowDownOutlined />,
  };
  return (
    <Tag color={color} icon={iconMap[status]} style={{ margin: 0 }}>
      {label}
    </Tag>
  );
});
StatusTag.displayName = 'StatusTag';

// ================================================================
//  内部辅助：差异汇总列定义
// ================================================================

const diffColumns: ColumnsType<IDiffItem> = [
  {
    title: '资产编号',
    dataIndex: 'assetCode',
    key: 'diffAssetCode',
    width: 130,
    render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
  },
  {
    title: '资产名称',
    dataIndex: 'assetName',
    key: 'diffAssetName',
    width: 180,
    ellipsis: true,
  },
  {
    title: '差异类型',
    dataIndex: 'type',
    key: 'diffType',
    width: 100,
    align: 'center',
    render: (type: 'SURPLUS' | 'DEFICIT') => (
      <Tag
        color={type === 'SURPLUS' ? 'warning' : 'error'}
        icon={type === 'SURPLUS' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      >
        {type === 'SURPLUS' ? '盘盈' : '盘亏'}
      </Tag>
    ),
  },
  {
    title: '账面数量',
    dataIndex: 'systemQuantity',
    key: 'diffSystemQty',
    width: 100,
    align: 'center',
  },
  {
    title: '实盘数量',
    dataIndex: 'actualQuantity',
    key: 'diffActualQty',
    width: 100,
    align: 'center',
  },
  {
    title: '差异数量',
    dataIndex: 'difference',
    key: 'diffValue',
    width: 100,
    align: 'center',
    render: (val: number) => (
      <Text strong style={{ color: val > 0 ? '#faad14' : '#ff4d4f' }}>
        {val > 0 ? `+${val}` : String(val)}
      </Text>
    ),
  },
  {
    title: '备注',
    dataIndex: 'remark',
    key: 'diffRemark',
    ellipsis: true,
    render: (v: string) => v || '-',
  },
];

// ================================================================
//  AssetTable 主组件
// ================================================================

const AssetTable: React.FC<AssetTableProps> = ({
  taskId,
  assets,
  loading = false,
  onStatusChange,
  onBatchConfirm,
  onSubmitApproval,
  editable = true,
}) => {
  // ---- 本地编辑状态 ----
  const [localAssets, setLocalAssets] = useState<IAssetItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  /** 最近变更的行 ID 集合，用于高亮反馈 */
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // 同步外部 assets → 本地副本（仅在首次或外部数据引用变化时覆盖）
  useEffect(() => {
    setLocalAssets((prev) => {
      // 若外部数据长度或 id 集合发生变化，视为全量刷新
      if (
        prev.length !== assets.length ||
        prev.some((a, i) => a.id !== assets[i]?.id)
      ) {
        return [...assets];
      }
      return prev;
    });
  }, [assets]);

  // 高亮自动消退（3 秒后清除）
  useEffect(() => {
    if (highlightedIds.size === 0) return;
    const timer = setTimeout(() => setHighlightedIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [highlightedIds]);

  // ---- 聚合计算 ----

  /** 盘点汇总统计 */
  const summary: IInventorySummary = useMemo(() => {
    const totalAssets = localAssets.length;
    const countedCount = localAssets.filter(
      (a) =>
        a.inventoryStatus === 'COUNTED' ||
        a.inventoryStatus === 'SURPLUS' ||
        a.inventoryStatus === 'DEFICIT',
    ).length;
    const surplusCount = localAssets.filter((a) => a.inventoryStatus === 'SURPLUS').length;
    const deficitCount = localAssets.filter((a) => a.inventoryStatus === 'DEFICIT').length;
    return {
      totalAssets,
      countedCount,
      uncountedCount: totalAssets - countedCount,
      surplusCount,
      deficitCount,
    };
  }, [localAssets]);

  /** 盘盈盘亏差异明细列表 */
  const diffItems: IDiffItem[] = useMemo(() => {
    return localAssets
      .filter((a) => a.inventoryStatus === 'SURPLUS' || a.inventoryStatus === 'DEFICIT')
      .map((a) => ({
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.assetName,
        type: a.inventoryStatus as 'SURPLUS' | 'DEFICIT',
        systemQuantity: a.systemQuantity,
        actualQuantity: a.actualQuantity ?? 0,
        difference: (a.actualQuantity ?? 0) - a.systemQuantity,
        remark: a.remark,
      }));
  }, [localAssets]);

  // ---- 数据操作 ----

  /** 更新本地某条资产的部分字段 */
  const updateLocalAsset = useCallback(
    (assetId: string, patch: Partial<IAssetItem>) => {
      setLocalAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  /** 单条状态变更处理 */
  const handleStatusChange = useCallback(
    (assetId: string, status: InventoryStatus) => {
      const asset = localAssets.find((a) => a.id === assetId);
      if (!asset) return;

      // 选择"已盘点"时，自动将实盘数量设为账面数量
      let actualQuantity: number | null = asset.actualQuantity;
      if (status === 'COUNTED') {
        actualQuantity = asset.systemQuantity;
      }

      // 更新本地状态
      updateLocalAsset(assetId, { inventoryStatus: status, actualQuantity });

      // 高亮该行
      setHighlightedIds((prev) => new Set(prev).add(assetId));

      // 通知父组件
      onStatusChange?.(assetId, status, actualQuantity, asset.remark);
    },
    [localAssets, updateLocalAsset, onStatusChange],
  );

  /** 单条实盘数量变更 */
  const handleQuantityChange = useCallback(
    (assetId: string, value: number | null) => {
      const asset = localAssets.find((a) => a.id === assetId);
      if (!asset) return;

      updateLocalAsset(assetId, { actualQuantity: value });

      // 若已输入了实盘数量，根据差值自动推断状态（未盘点 → 盈/亏/一致）
      if (value !== null && asset.inventoryStatus === 'NOT_COUNTED') {
        let inferred: InventoryStatus = 'NOT_COUNTED';
        if (value === asset.systemQuantity) inferred = 'COUNTED';
        else if (value > asset.systemQuantity) inferred = 'SURPLUS';
        else if (value < asset.systemQuantity) inferred = 'DEFICIT';

        if (inferred !== 'NOT_COUNTED') {
          updateLocalAsset(assetId, { inventoryStatus: inferred });
          onStatusChange?.(assetId, inferred, value, asset.remark);
          return;
        }
      }

      onStatusChange?.(assetId, asset.inventoryStatus, value, asset.remark);
    },
    [localAssets, updateLocalAsset, onStatusChange],
  );

  /** 单条备注变更 */
  const handleRemarkChange = useCallback(
    (assetId: string, remark: string) => {
      const asset = localAssets.find((a) => a.id === assetId);
      if (!asset) return;

      updateLocalAsset(assetId, { remark });
      onStatusChange?.(assetId, asset.inventoryStatus, asset.actualQuantity, remark);
    },
    [localAssets, updateLocalAsset, onStatusChange],
  );

  /** 批量确认：将选中资产标记为"已盘点" */
  const handleBatchConfirm = useCallback(async () => {
    if (!onBatchConfirm || selectedRowKeys.length === 0) return;
    setConfirmLoading(true);
    try {
      await onBatchConfirm(selectedRowKeys as string[], 'COUNTED');

      // 同步本地状态
      setLocalAssets((prev) =>
        prev.map((a) =>
          selectedRowKeys.includes(a.id)
            ? { ...a, inventoryStatus: 'COUNTED' as InventoryStatus, actualQuantity: a.systemQuantity }
            : a,
        ),
      );

      // 批量高亮
      setHighlightedIds(new Set(selectedRowKeys as string[]));
      setSelectedRowKeys([]);
      message.success(`已批量确认 ${selectedRowKeys.length} 条资产`);
    } catch {
      message.error('批量确认失败，请重试');
    } finally {
      setConfirmLoading(false);
    }
  }, [onBatchConfirm, selectedRowKeys]);

  /** 一键提交核准 */
  const handleSubmitApproval = useCallback(async () => {
    if (!onSubmitApproval) return;
    setSubmitLoading(true);
    try {
      await onSubmitApproval(taskId);
      message.success('已成功提交核准');
    } catch {
      message.error('提交核准失败，请重试');
    } finally {
      setSubmitLoading(false);
    }
  }, [onSubmitApproval, taskId]);

  // ---- 行样式（高亮 + 差异底色） ----

  const getRowClassName = useCallback(
    (record: IAssetItem): string => {
      const cls: string[] = [];
      if (highlightedIds.has(record.id)) cls.push('inventory-row-highlighted');
      if (record.inventoryStatus === 'SURPLUS') cls.push('inventory-row-surplus');
      if (record.inventoryStatus === 'DEFICIT') cls.push('inventory-row-deficit');
      return cls.join(' ');
    },
    [highlightedIds],
  );

  // ---- 列定义 ----

  const columns: ColumnsType<IAssetItem> = useMemo(
    () => [
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 130,
        fixed: 'left',
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <Text copyable style={{ fontSize: 13 }}>
              {text}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 180,
        fixed: 'left',
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <Text strong>{text}</Text>
          </Tooltip>
        ),
      },
      {
        title: '分类',
        dataIndex: 'categoryName',
        key: 'categoryName',
        width: 120,
        ellipsis: true,
        render: (text: string) => <Text type="secondary">{text}</Text>,
      },
      {
        title: '存放位置',
        dataIndex: 'locationName',
        key: 'locationName',
        width: 140,
        ellipsis: true,
      },
      {
        title: '账面数量',
        dataIndex: 'systemQuantity',
        key: 'systemQuantity',
        width: 100,
        align: 'center',
        render: (val: number) => <Text>{val}</Text>,
      },
      {
        title: '实盘数量',
        key: 'actualQuantity',
        width: 130,
        align: 'center',
        render: (_: unknown, record: IAssetItem) => (
          <InputNumber
            min={0}
            max={99999}
            value={record.actualQuantity}
            disabled={!editable || record.inventoryStatus === 'COUNTED'}
            placeholder="请输入"
            size="small"
            style={{ width: '100%' }}
            data-testid={`qty-input-${record.id}`}
            onChange={(val) => handleQuantityChange(record.id, val)}
          />
        ),
      },
      {
        title: '差异',
        key: 'difference',
        width: 80,
        align: 'center',
        render: (_: unknown, record: IAssetItem) => {
          if (record.actualQuantity === null || record.actualQuantity === undefined) {
            return <Text type="secondary">-</Text>;
          }
          const diff = record.actualQuantity - record.systemQuantity;
          if (diff === 0) return <Text type="success">0</Text>;
          return (
            <Text strong style={{ color: diff > 0 ? '#faad14' : '#ff4d4f' }}>
              {diff > 0 ? `+${diff}` : String(diff)}
            </Text>
          );
        },
      },
      {
        title: '实盘状态',
        key: 'inventoryStatus',
        width: 140,
        render: (_: unknown, record: IAssetItem) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDropdown
              value={record.inventoryStatus}
              onChange={(status) => handleStatusChange(record.id, status)}
              disabled={!editable}
              size="small"
            />
            <StatusTag status={record.inventoryStatus} />
          </div>
        ),
      },
      {
        title: '备注',
        key: 'remark',
        width: 180,
        render: (_: unknown, record: IAssetItem) => (
          <Input
            value={record.remark ?? ''}
            disabled={!editable}
            placeholder="输入备注"
            size="small"
            maxLength={200}
            data-testid={`remark-input-${record.id}`}
            onChange={(e) => handleRemarkChange(record.id, e.target.value)}
            allowClear
          />
        ),
      },
    ],
    [editable, handleQuantityChange, handleStatusChange, handleRemarkChange],
  );

  // ---- 分页配置（性能保障：200+ 数据分页渲染） ----

  const paginationConfig = {
    defaultPageSize: 20,
    pageSizeOptions: ['10', '20', '50', '100'],
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
  };

  // ================================================================
  //  渲染
  // ================================================================

  return (
    <div data-testid="asset-table-container">
      {/* 行高亮 & 差异底色的内联样式注入 */}
      <style>{`
        .inventory-row-highlighted td {
          background-color: #e6f7ff !important;
          transition: background-color 0.6s ease;
        }
        .inventory-row-surplus td {
          background-color: #fffbe6 !important;
        }
        .inventory-row-deficit td {
          background-color: #fff2f0 !important;
        }
      `}</style>

      {/* ========== 顶部：核心统计指标 ========== */}
      <Row gutter={16} style={{ marginBottom: 16 }} data-testid="summary-stats">
        <Col span={4}>
          <Statistic
            title="总资产数"
            value={summary.totalAssets}
            valueStyle={{ fontSize: 22 }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="已盘"
            value={summary.countedCount}
            valueStyle={{ color: '#52c41a', fontSize: 22 }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="未盘"
            value={summary.uncountedCount}
            valueStyle={{ color: '#8c8c8c', fontSize: 22 }}
            prefix={<MinusCircleOutlined />}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="盘盈"
            value={summary.surplusCount}
            valueStyle={{ color: '#faad14', fontSize: 22 }}
            prefix={<ArrowUpOutlined />}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="盘亏"
            value={summary.deficitCount}
            valueStyle={{ color: '#ff4d4f', fontSize: 22 }}
            prefix={<ArrowDownOutlined />}
          />
        </Col>
        <Col
          span={4}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
        >
          {selectedRowKeys.length > 0 && (
            <Space data-testid="batch-action-bar">
              <Text type="secondary">已选 {selectedRowKeys.length} 项</Text>
              <Popconfirm
                title={`确认将 ${selectedRowKeys.length} 项资产标记为"已盘点"？`}
                description="实盘数量将自动设为账面数量"
                onConfirm={handleBatchConfirm}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={confirmLoading}
                  data-testid="batch-confirm-btn"
                >
                  批量确认
                </Button>
              </Popconfirm>
            </Space>
          )}
        </Col>
      </Row>

      {/* ========== 中部：资产清单表格 ========== */}
      <Table<IAssetItem>
        rowKey="id"
        columns={columns}
        dataSource={localAssets}
        loading={loading}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
          getCheckboxProps: (record) => ({
            disabled: !editable,
          }),
        }}
        rowClassName={getRowClassName}
        scroll={{ x: 1300 }}
        pagination={paginationConfig}
        size="small"
        data-testid="asset-data-table"
        locale={{
          emptyText: <Empty description="暂无盘点资产数据" />,
        }}
      />

      {/* ========== 底部：差异汇总面板 ========== */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>差异汇总</span>
            <Badge
              count={diffItems.length}
              style={{ backgroundColor: diffItems.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Space>
        }
        size="small"
        style={{ marginTop: 16 }}
        data-testid="diff-summary-panel"
      >
        {diffItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无差异记录，账实一致"
          />
        ) : (
          <>
            <Table<IDiffItem>
              rowKey="assetId"
              dataSource={diffItems}
              columns={diffColumns}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              data-testid="diff-detail-table"
            />

            <Row justify="end" style={{ marginTop: 16 }}>
              <Col>
                <Popconfirm
                  title="确认提交核准？"
                  description={`将提交 ${diffItems.length} 条差异记录进行核准审批，提交后不可撤回`}
                  onConfirm={handleSubmitApproval}
                  okText="提交"
                  cancelText="取消"
                >
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={submitLoading}
                    data-testid="submit-approval-btn"
                  >
                    一键提交核准
                  </Button>
                </Popconfirm>
              </Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  );
};

export default AssetTable;