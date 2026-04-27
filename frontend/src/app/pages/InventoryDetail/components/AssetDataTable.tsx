import React, { useMemo, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Select,
  Input,
  InputNumber,
  Typography,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tooltip,
  Popconfirm,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// SPEC: 基础数据模型 — TypeScript Interfaces
// ---------------------------------------------------------------------------

/** 盘点状态枚举 */
export type InventoryStatus = 'UNCOUNTED' | 'MATCHED' | 'SURPLUS' | 'DEFICIT';

/** 资产明细条目 */
export interface IAssetItem {
  id: string;
  assetCode: string;
  name: string;
  category?: string;
  location?: string;
  bookQuantity: number;
  actualQuantity: number;
  status: InventoryStatus;
  remark?: string;
  lastUpdatedBy?: string;
  updatedAt?: string;
}

/** 盘点汇总统计 */
export interface IInventorySummary {
  totalCount: number;
  countedCount: number;
  uncountedCount: number;
  surplusCount: number;
  deficitCount: number;
  progressPercent: number;
}

// ---------------------------------------------------------------------------
// SPEC: 原子组件 — StatusDropdown（高复用性，内部状态高内聚，暴露 onChange）
// ---------------------------------------------------------------------------

/** 状态 → 显示配置 */
const STATUS_CONFIG: Record<InventoryStatus, { color: string; label: string }> = {
  UNCOUNTED: { color: 'default', label: '未盘点' },
  MATCHED: { color: 'success', label: '已盘' },
  SURPLUS: { color: 'warning', label: '盘盈' },
  DEFICIT: { color: 'error', label: '盘亏' },
};

/**
 * 实盘状态下拉选择组件
 *
 * 被封装为独立高复用性原子组件，对外暴露标准 `onChange` 事件。
 */
export const StatusDropdown: React.FC<{
  /** 当前值 */
  value: InventoryStatus;
  /** 值变更回调 */
  onChange: (status: InventoryStatus) => void;
  /** 是否禁用 */
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  return (
    <Select
      value={value}
      style={{ width: 120 }}
      disabled={disabled}
      onChange={onChange}
      options={(Object.entries(STATUS_CONFIG) as [InventoryStatus, typeof STATUS_CONFIG[InventoryStatus]][]).map(
        ([key, cfg]) => ({
          value: key,
          label: (
            <Space size={4}>
              <Tag color={cfg.color} style={{ marginRight: 0 }}>
                {cfg.label}
              </Tag>
            </Space>
          ),
        }),
      )}
    />
  );
};

// ---------------------------------------------------------------------------
// SPEC: 容器组件 — AssetDataTable
// ---------------------------------------------------------------------------

interface AssetDataTableProps {
  /** 资产明细数据 */
  data: IAssetItem[];
  /** 加载态 */
  loading?: boolean;
  /** 单条状态变更回调 */
  onStatusChange: (id: string, status: InventoryStatus) => void;
  /** 单条实盘数量变更回调 */
  onQuantityChange: (id: string, quantity: number) => void;
  /** 单条备注变更回调 */
  onRemarkChange?: (id: string, remark: string) => void;
  /** 批量确认回调（传入选中 id 数组） */
  onBatchConfirm: (ids: string[]) => void;
  /** 提交核准回调 */
  onSubmitApproval: () => Promise<void>;
  /** 外部传入的汇总数据（可选，缺省时由组件自行从 data 计算） */
  summaryData?: IInventorySummary;
}

/**
 * AssetDataTable — 盘点执行详情页中部资产清单表格
 *
 * 支持：逐条状态变更、实盘数量编辑、备注输入、批量确认、差异聚合。
 */
const AssetDataTable: React.FC<AssetDataTableProps> = ({
  data,
  loading = false,
  onStatusChange,
  onQuantityChange,
  onRemarkChange,
  onBatchConfirm,
  onSubmitApproval,
  summaryData,
}) => {
  // ---- 批量选择状态 ----
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ---- SPEC: 前端中间态计算（进度百分比、分类汇总） ----
  const stats: IInventorySummary = useMemo(() => {
    if (summaryData) return summaryData;
    const counted = data.filter((item) => item.status !== 'UNCOUNTED').length;
    const surplus = data.filter((item) => item.status === 'SURPLUS').length;
    const deficit = data.filter((item) => item.status === 'DEFICIT').length;
    const progress = data.length ? Math.round((counted / data.length) * 100) : 0;
    return {
      totalCount: data.length,
      countedCount: counted,
      uncountedCount: data.length - counted,
      surplusCount: surplus,
      deficitCount: deficit,
      progressPercent: progress,
    };
  }, [data, summaryData]);

  // ---- SPEC: 差异明细（盘盈/盘亏） ----
  const diffItems = useMemo(
    () => data.filter((item) => item.status === 'SURPLUS' || item.status === 'DEFICIT'),
    [data],
  );

  // ---- 批量确认 ----
  const handleBatchConfirm = useCallback(() => {
    if (selectedRowKeys.length === 0) return;
    onBatchConfirm(selectedRowKeys as string[]);
    setSelectedRowKeys([]);
  }, [selectedRowKeys, onBatchConfirm]);

  // ---- 提交核准 ----
  const handleSubmitApproval = useCallback(async () => {
    setSubmitting(true);
    try {
      await onSubmitApproval();
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitApproval]);

  // ---- SPEC: 行高亮（已盘=绿、盘盈=黄、盘亏=红） ----
  const rowClassName = useCallback((record: IAssetItem) => {
    switch (record.status) {
      case 'MATCHED':
        return 'inventory-row-counted';
      case 'SURPLUS':
        return 'inventory-row-surplus';
      case 'DEFICIT':
        return 'inventory-row-deficit';
      default:
        return '';
    }
  }, []);

  // ---- 表格列定义 ----
  const columns: ColumnsType<IAssetItem> = [
    {
      title: '资产编号',
      dataIndex: 'assetCode',
      key: 'assetCode',
      width: 140,
      render: (text: string) => <Text copyable={{ tooltips: ['复制', '已复制'] }}>{text}</Text>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: { showTitle: false },
      render: (text: string) => <Tooltip placement="topLeft" title={text}>{text}</Tooltip>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '账面数量',
      dataIndex: 'bookQuantity',
      key: 'bookQuantity',
      width: 100,
      align: 'right',
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: '实盘数量',
      dataIndex: 'actualQuantity',
      key: 'actualQuantity',
      width: 120,
      align: 'right',
      render: (_: number, record: IAssetItem) => (
        <InputNumber
          min={0}
          value={record.actualQuantity}
          onChange={(v) => onQuantityChange(record.id, v ?? 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: '差异',
      key: 'diff',
      width: 80,
      align: 'right',
      render: (_: unknown, record: IAssetItem) => {
        const diff = record.actualQuantity - record.bookQuantity;
        if (diff === 0) return <Tag>0</Tag>;
        return (
          <Tag color={diff > 0 ? 'warning' : 'error'} style={{ fontWeight: 600 }}>
            {diff > 0 ? `+${diff}` : `${diff}`}
          </Tag>
        );
      },
    },
    {
      title: '盘点状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (_: unknown, record: IAssetItem) => (
        <StatusDropdown
          value={record.status}
          onChange={(newStatus) => onStatusChange(record.id, newStatus)}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 160,
      render: (val: string | undefined, record: IAssetItem) => (
        <Input
          placeholder="输入备注..."
          value={val ?? ''}
          onChange={(e) => onRemarkChange?.(record.id, e.target.value)}
          size="small"
          allowClear
        />
      ),
    },
  ];

  // ---- 差异明细子表列 ----
  const diffColumns: ColumnsType<IAssetItem> = [
    { title: '资产编号', dataIndex: 'assetCode', key: 'assetCode', width: 140 },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '账面数量', dataIndex: 'bookQuantity', key: 'bookQuantity', width: 100, align: 'right' },
    { title: '实盘数量', dataIndex: 'actualQuantity', key: 'actualQuantity', width: 100, align: 'right' },
    {
      title: '差异类型',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: InventoryStatus) => (
        <Tag color={STATUS_CONFIG[status].color}>{STATUS_CONFIG[status].label}</Tag>
      ),
    },
    {
      title: '差异量',
      key: 'diffAmount',
      width: 100,
      align: 'right',
      render: (_: unknown, record: IAssetItem) => {
        const diff = record.actualQuantity - record.bookQuantity;
        return (
          <Text style={{ color: diff > 0 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}>
            {diff > 0 ? `+${diff}` : `${diff}`}
          </Text>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 160,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* ------------------------------------------------------------------ */}
      {/* SPEC: 顶部看板 — 5 个核心统计指标 (总资产数/已盘/未盘/盘盈/盘亏)      */}
      {/* ------------------------------------------------------------------ */}
      <Card size="small" style={{ marginBottom: 24 }} styles={{ body: { padding: '16px 24px' } }}>
        <Row gutter={16} align="middle">
          <Col flex="1">
            <Statistic title={<Text type="secondary">总资产数</Text>} value={stats.totalCount} suffix="项" />
          </Col>
          <Col flex="1">
            <Statistic
              title={<Text type="secondary">已盘</Text>}
              value={stats.countedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col flex="1">
            <Statistic
              title={<Text type="secondary">未盘</Text>}
              value={stats.uncountedCount}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Col>
          <Col flex="1">
            <Statistic
              title={<Text type="secondary">盘盈</Text>}
              value={stats.surplusCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ArrowUpOutlined />}
            />
          </Col>
          <Col flex="1">
            <Statistic
              title={<Text type="secondary">盘亏</Text>}
              value={stats.deficitCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ArrowDownOutlined />}
            />
          </Col>
          <Col flex="none" style={{ minWidth: 200 }}>
            <div>
              <Text type="secondary">盘点进度</Text>
              <div style={{ marginTop: 4 }}>
                <Text strong style={{ fontSize: 20, marginRight: 8 }}>
                  {stats.progressPercent}%
                </Text>
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 8,
                  background: '#f0f0f0',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${stats.progressPercent}%`,
                    height: '100%',
                    background: stats.progressPercent === 100 ? '#52c41a' : '#1890ff',
                    transition: 'width 0.3s ease',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 工具栏 — 标题 + 批量确认 + 刷新                                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            资产明细清单
          </Text>
          <Tag color="blue">{stats.totalCount} 条</Tag>
          {stats.uncountedCount > 0 && <Tag color="orange">{stats.uncountedCount} 项待盘点</Tag>}
        </Space>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="确认批量盘点"
              description={`将对选中的 ${selectedRowKeys.length} 条资产标记为"已盘"状态。`}
              onConfirm={handleBatchConfirm}
              okText="确认"
              cancelText="取消"
            >
              <Button type="primary" icon={<ThunderboltOutlined />}>
                批量确认 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新
          </Button>
        </Space>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SPEC: 中部表格 — 可编辑表格，分页加载，支持批量选择                      */}
      {/* ------------------------------------------------------------------ */}
      <Table<IAssetItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="middle"
        bordered
        scroll={{ y: 500 }}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['25', '50', '100', '200'],
          showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        rowClassName={rowClassName}
      />

      {/* ------------------------------------------------------------------ */}
      {/* SPEC: 底部面板 — 盘盈盘亏差异汇总列表 (ATB-05)                         */}
      {/* ------------------------------------------------------------------ */}
      <Card
        size="small"
        style={{ marginTop: 24, backgroundColor: '#fafafa' }}
        title={
          <Space>
            <Text strong>盘盈盘亏差异汇总</Text>
            <Tag color="orange">{diffItems.length} 条差异</Tag>
          </Space>
        }
        styles={{ body: { padding: diffItems.length > 0 ? 12 : 24 } }}
      >
        {diffItems.length === 0 ? (
          <Empty description="暂无差异记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table<IAssetItem>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={diffItems}
            columns={diffColumns}
          />
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* SPEC: 提交核准按钮 (ATB-05: 一键提交核准 → POST /api/inventory/approve) */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Popconfirm
          title="确认提交盘点结果？"
          description={`当前已完成 ${stats.countedCount}/${stats.totalCount} 项盘点，将生成差异报告并进入核准流程。`}
          onConfirm={handleSubmitApproval}
          okText="确定提交"
          cancelText="取消"
        >
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            loading={submitting}
            disabled={stats.countedCount === 0}
          >
            一键提交核准
          </Button>
        </Popconfirm>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 行高亮样式（已盘=绿底 / 盘盈=黄底 / 盘亏=红底）                        */}
      {/* ------------------------------------------------------------------ */}
      <style>{`
        .inventory-row-counted { background-color: #f6ffed !important; }
        .inventory-row-counted:hover > td { background-color: #d9f7be !important; }
        .inventory-row-surplus { background-color: #fffbe6 !important; }
        .inventory-row-surplus:hover > td { background-color: #fff1b8 !important; }
        .inventory-row-deficit { background-color: #fff2f0 !important; }
        .inventory-row-deficit:hover > td { background-color: #ffccc7 !important; }
      `}</style>
    </div>
  );
};

export default AssetDataTable;