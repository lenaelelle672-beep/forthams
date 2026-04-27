/**
 * ProgressBoard 组件 — 盘点执行详情页顶部进度看板
 *
 * 根据资产盘点数据计算并渲染进度条与五个核心统计指标
 * （总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏），同时提供资产明细表格
 * （支持分页与批量确认）以及底部差异汇总面板。
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Alert,
  Badge,
  Popconfirm,
  message,
  Select,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  FileSearchOutlined,
  WarningFilled,
  PlusCircleOutlined,
  MinusCircleOutlined,
  StockOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ───────────────────────────── 数据模型 ─────────────────────────────

/** 资产盘点项数据模型 */
export interface IAssetItem {
  /** 资产唯一标识 */
  id: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  name: string;
  /** 资产分类 */
  category: string;
  /** 存放位置 */
  location: string;
  /** 账面数量 */
  bookQuantity: number;
  /** 实盘数量 */
  actualQuantity: number;
  /** 盘点状态：未盘 / 盘点中 / 已盘 */
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COUNTED';
  /** 备注 */
  remark?: string;
  /** 最后更新时间 */
  lastUpdated?: string;
}

/** 盘点汇总统计数据模型 */
export interface IInventorySummary {
  /** 总资产数 */
  totalCount: number;
  /** 已盘点数 */
  countedCount: number;
  /** 未盘点数 */
  uncountedCount: number;
  /** 盘盈数（实 > 账） */
  surplusCount: number;
  /** 盘亏数（实 < 账） */
  deficitCount: number;
}

/** ProgressBoard 组件属性接口 */
interface ProgressBoardProps {
  /** 当前盘点任务 ID */
  taskId?: string;
  /** 资产明细初始数据 */
  initialData?: IAssetItem[];
  /** 单条资产状态变更回调 */
  onStatusChange?: (
    id: string,
    status: IAssetItem['status'],
    actualQty: number,
    remark?: string,
  ) => Promise<void>;
  /** 批量确认回调 */
  onBatchConfirm?: (ids: string[]) => Promise<void>;
  /** 提交核准回调 */
  onSubmitApproval?: () => Promise<void>;
  /** 刷新数据回调 */
  onRefresh?: () => void;
  /** 是否正在加载 */
  loading?: boolean;
}

// ───────────────────────── 原子组件 ─────────────────────────

/**
 * 实盘状态下拉选择组件（高复用性独立组件）
 *
 * 内部维护选项列表，对外暴露标准 `onChange` 事件，
 * 满足 SPEC 组件化约束第 4 条。
 */
export const StatusDropdown: React.FC<{
  /** 当前选中值 */
  value?: IAssetItem['status'];
  /** 状态变更回调 */
  onChange?: (value: IAssetItem['status']) => void;
  /** 是否禁用 */
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  /** 状态选项配置 */
  const statusOptions: Array<{
    value: IAssetItem['status'];
    label: string;
    color: string;
  }> = [
    { value: 'NOT_STARTED', label: '未盘', color: 'default' },
    { value: 'IN_PROGRESS', label: '盘点中', color: 'processing' },
    { value: 'COUNTED', label: '已盘', color: 'success' },
  ];

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      size="small"
      style={{ minWidth: 100 }}
      options={statusOptions.map((opt) => ({
        value: opt.value,
        label: (
          <Tag color={opt.color} style={{ margin: 0 }}>
            {opt.label}
          </Tag>
        ),
      }))}
    />
  );
};

// ───────────────────────── 主组件 ─────────────────────────

/**
 * 盘点进度看板组件
 *
 * 职责：
 * 1. 根据资产列表实时计算进度百分比与五项统计指标；
 * 2. 渲染可编辑资产明细表格（支持分页 & 批量确认）；
 * 3. 渲染底部盘盈盘亏差异汇总面板；
 * 4. 提供"提交核准"入口。
 */
const ProgressBoard: React.FC<ProgressBoardProps> = ({
  taskId,
  initialData = [],
  onStatusChange,
  onBatchConfirm,
  onSubmitApproval,
  onRefresh,
  loading = false,
}) => {
  const [assets, setAssets] = useState<IAssetItem[]>(initialData);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /** 当外部 initialData 变更时同步到本地状态 */
  useEffect(() => {
    setAssets(initialData);
  }, [initialData]);

  /**
   * 聚合计算盘点汇总统计（SPEC 数据流转约束：前端负责中间态计算）
   */
  const summary = useMemo<IInventorySummary>(() => {
    const totalCount = assets.length;
    const countedCount = assets.filter((a) => a.status === 'COUNTED').length;
    const uncountedCount = totalCount - countedCount;
    const surplusCount = assets.filter((a) => a.actualQuantity > a.bookQuantity).length;
    const deficitCount = assets.filter((a) => a.actualQuantity < a.bookQuantity).length;
    return { totalCount, countedCount, uncountedCount, surplusCount, deficitCount };
  }, [assets]);

  /** 盘点进度百分比 */
  const progressPercent =
    summary.totalCount > 0
      ? Math.round((summary.countedCount / summary.totalCount) * 100)
      : 0;

  /** 差异明细列表（账实不符项） */
  const discrepancyList = useMemo(
    () => assets.filter((a) => a.actualQuantity !== a.bookQuantity),
    [assets],
  );

  /**
   * 处理单条资产实盘状态变更
   */
  const handleStatusUpdate = useCallback(
    async (id: string, status: IAssetItem['status']) => {
      if (!onStatusChange) return;
      try {
        const target = assets.find((a) => a.id === id);
        const actualQty =
          status === 'COUNTED'
            ? target?.actualQuantity ?? target?.bookQuantity ?? 0
            : target?.actualQuantity ?? 0;
        await onStatusChange(id, status, actualQty);
        setAssets((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a)),
        );
        message.success('状态更新成功');
      } catch {
        message.error('更新盘点状态失败');
      }
    },
    [onStatusChange, assets],
  );

  /**
   * 处理批量确认已盘点
   */
  const handleBatchConfirm = useCallback(async () => {
    if (!onBatchConfirm || selectedRowKeys.length === 0) return;
    try {
      await onBatchConfirm(selectedRowKeys as string[]);
      setAssets((prev) =>
        prev.map((a) =>
          selectedRowKeys.includes(a.id)
            ? {
                ...a,
                status: 'COUNTED' as const,
                actualQuantity: a.actualQuantity || a.bookQuantity,
              }
            : a,
        ),
      );
      setSelectedRowKeys([]);
      message.success(`已批量确认 ${selectedRowKeys.length} 项资产`);
    } catch {
      message.error('批量确认失败');
    }
  }, [onBatchConfirm, selectedRowKeys]);

  /**
   * 处理提交核准（与后端 API 交互，前端不持久化主数据）
   */
  const handleSubmitApproval = useCallback(async () => {
    if (!onSubmitApproval) return;
    try {
      setSubmitting(true);
      await onSubmitApproval();
      message.success('盘点结果已提交核准');
    } catch {
      message.error('提交核准失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitApproval]);

  /**
   * 根据资产记录返回差异类型标签
   */
  const getDiffTag = useCallback((record: IAssetItem) => {
    const diff = record.actualQuantity - record.bookQuantity;
    if (diff > 0) {
      return (
        <Tag color="green" icon={<PlusCircleOutlined />}>
          盘盈 (+{diff})
        </Tag>
      );
    }
    if (diff < 0) {
      return (
        <Tag color="red" icon={<MinusCircleOutlined />}>
          盘亏 ({diff})
        </Tag>
      );
    }
    return <Tag>无差异</Tag>;
  }, []);

  /** 资产明细表格列定义 */
  const columns = [
    {
      title: '资产编号',
      dataIndex: 'assetCode',
      key: 'assetCode',
      width: 140,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '分类 / 位置',
      key: 'categoryLocation',
      width: 160,
      render: (_: unknown, record: IAssetItem) => (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.category}
          </Text>
          <div style={{ fontSize: 13 }}>{record.location}</div>
        </div>
      ),
    },
    {
      title: '账面数量',
      dataIndex: 'bookQuantity',
      key: 'bookQuantity',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '实盘数量',
      dataIndex: 'actualQuantity',
      key: 'actualQuantity',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: IAssetItem) => {
        const diff = val - record.bookQuantity;
        if (diff > 0) return <Text type="success" strong>{val} (+{diff})</Text>;
        if (diff < 0) return <Text type="danger" strong>{val} ({diff})</Text>;
        return <Text>{val}</Text>;
      },
    },
    {
      title: '实盘状态',
      key: 'status',
      width: 140,
      render: (_: unknown, record: IAssetItem) => (
        <StatusDropdown
          value={record.status}
          onChange={(val) => handleStatusUpdate(record.id, val)}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">-</Text>,
    },
  ];

  // ─────────────────────────── 渲染 ───────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* ── 顶部标题栏 ── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            盘点执行工作台
          </Title>
          {taskId && <Text type="secondary">任务 ID: {taskId}</Text>}
        </Col>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
          <Popconfirm
            title="确认提交盘点结果？"
            description={`已盘 ${summary.countedCount} 项，差异 ${
              summary.surplusCount + summary.deficitCount
            } 项。提交后将进入核准流程。`}
            onConfirm={handleSubmitApproval}
            okText="确认提交"
            cancelText="取消"
          >
            <Button
              type="primary"
              loading={submitting}
              disabled={summary.countedCount === 0}
              icon={<FileSearchOutlined />}
            >
              提交盘点核准
            </Button>
          </Popconfirm>
        </Space>
      </Row>

      {/* ── 进度条 ── */}
      <Card bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <Progress
          percent={progressPercent}
          status={progressPercent === 100 ? 'success' : 'active'}
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
      </Card>

      {/* ── 五个核心统计卡片（ATB-03 验收要求） ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card bordered={false} hoverable size="small">
            <Statistic
              title="总资产数"
              value={summary.totalCount}
              prefix={<StockOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card bordered={false} hoverable size="small">
            <Statistic
              title="已盘"
              value={summary.countedCount}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card bordered={false} hoverable size="small">
            <Statistic
              title="未盘"
              value={summary.uncountedCount}
              valueStyle={{
                color: summary.uncountedCount > 0 ? '#faad14' : undefined,
              }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card bordered={false} hoverable size="small">
            <Statistic
              title="盘盈"
              value={summary.surplusCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PlusCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card bordered={false} hoverable size="small">
            <Statistic
              title="盘亏"
              value={summary.deficitCount}
              valueStyle={{ color: '#cf1322' }}
              prefix={<MinusCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* ── 资产明细表格（分页加载，满足性能约束） ── */}
      <Card
        title={
          <span>
            资产明细清单
            <Badge count={assets.length} style={{ marginLeft: 8 }} />
          </span>
        }
        extra={
          selectedRowKeys.length > 0 && (
            <Popconfirm
              title={`确认将选中的 ${selectedRowKeys.length} 项标记为"已盘"？`}
              onConfirm={handleBatchConfirm}
            >
              <Button type="primary" ghost>
                批量确认 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )
        }
        style={{ marginBottom: 24, borderRadius: 8 }}
      >
        <Table
          dataSource={assets}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ y: 450 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          locale={{ emptyText: <Empty description="暂无盘点数据" /> }}
        />
      </Card>

      {/* ── 底部差异汇总面板（ATB-05 验收要求） ── */}
      <Card
        title={
          <Space>
            <WarningFilled style={{ color: '#faad14' }} />
            <span>盘点差异汇总</span>
            {discrepancyList.length > 0 && (
              <Tag color="error">{discrepancyList.length} 项差异</Tag>
            )}
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        {discrepancyList.length > 0 ? (
          <>
            <Alert
              message={`检测到 ${discrepancyList.length} 项资产账实不符，请核对后提交核准`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              dataSource={discrepancyList}
              columns={[
                {
                  title: '资产编号',
                  dataIndex: 'assetCode',
                  key: 'assetCode',
                  width: 140,
                },
                {
                  title: '资产名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 180,
                },
                {
                  title: '账面数量',
                  dataIndex: 'bookQuantity',
                  key: 'bookQuantity',
                  width: 100,
                  align: 'right' as const,
                },
                {
                  title: '实盘数量',
                  dataIndex: 'actualQuantity',
                  key: 'actualQuantity',
                  width: 100,
                  align: 'right' as const,
                  render: (val: number) => <Text strong>{val}</Text>,
                },
                {
                  title: '差异类型',
                  key: 'diffType',
                  width: 140,
                  render: (_: unknown, record: IAssetItem) => getDiffTag(record),
                },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </>
        ) : (
          <Alert
            message="当前盘点数据账实完全一致"
            description="所有已盘资产的实盘数量与账面数量一致，可直接提交核准。"
            type="success"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};

export default ProgressBoard;