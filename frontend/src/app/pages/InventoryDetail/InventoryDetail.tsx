import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Progress,
  Statistic,
  Row,
  Col,
  Button,
  Space,
  Popconfirm,
  message,
  Typography,
  Divider,
  Badge,
  Input,
  Select,
  Tooltip,
  Descriptions,
  Spin,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileProtectOutlined,
  WarningOutlined,
  SendOutlined,
  InboxOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import styles from './InventoryDetail.module.css';
import { inventoryService } from '../../services/inventoryService';

const { Title, Text } = Typography;
const { Option } = Select;

// ─── Local Type Definitions ─────────────────────────────────────────────────
// These mirror the project-wide types in types/inventory.types.ts but are kept
// local to this component so the file compiles independently.

/** Possible real-counting status of a single asset line. */
export type AssetCountStatus =
  | 'not_counted'
  | 'matched'
  | 'surplus'
  | 'deficit'
  | 'missing';

/** Task status used by the backend. */
export type InventoryTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected';

/** A single asset row in the inventory detail table. */
export interface IAssetItem {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  bookQuantity: number;
  actualQuantity: number | null;
  status: AssetCountStatus;
  remark: string;
  lastCheckedAt?: string;
}

/** The parent inventory task. */
export interface IInventoryTask {
  id: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  creator: string;
  totalAssets: number;
  countedAssets: number;
  status: InventoryTaskStatus;
  locationScope: string[];
}

/** Computed summary statistics derived from asset list. */
export interface IInventorySummary {
  progress: number;
  totalCount: number;
  matchedCount: number;
  surplusCount: number;
  deficitCount: number;
  missingCount: number;
  notCountedCount: number;
}

/** A single discrepancy record shown in the bottom panel. */
export interface IDiffRecord {
  assetId: string;
  assetCode: string;
  assetName: string;
  type: 'surplus' | 'deficit' | 'missing';
  bookQuantity: number;
  actualQuantity: number | null;
  remark: string;
}

// ─── API calls via inventoryService ─────────────────────────────────────────

// ─── Status Configuration Map ──────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AssetCountStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  matched: { label: '账实相符', color: 'success', icon: <CheckCircleOutlined /> },
  surplus: { label: '盘盈', color: 'processing', icon: <PlusCircleOutlined /> },
  deficit: { label: '盘亏', color: 'warning', icon: <MinusCircleOutlined /> },
  missing: { label: '缺失', color: 'error', icon: <WarningOutlined /> },
  not_counted: { label: '未盘点', color: 'default', icon: <QuestionCircleOutlined /> },
};

const TASK_STATUS_MAP: Record<InventoryTaskStatus, { label: string; color: string }> = {
  pending: { label: '待开始', color: 'default' },
  in_progress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  approved: { label: '已核准', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
};

// ─── Inline Sub-Components ──────────────────────────────────────────────────

/**
 * StatusDropdown — Encapsulated real-count status selector.
 * Exposes `onChange(newStatus)` so the parent can update the store.
 */
const StatusDropdown: React.FC<{
  value: AssetCountStatus;
  onChange: (status: AssetCountStatus) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <Select
    className={styles.statusDropdown}
    value={value}
    onChange={onChange}
    disabled={disabled}
    size="small"
    style={{ minWidth: 110 }}
    popupMatchSelectWidth={false}
  >
    <Option value="not_counted">未盘点</Option>
    <Option value="matched">账实相符</Option>
    <Option value="surplus">盘盈</Option>
    <Option value="deficit">盘亏</Option>
    <Option value="missing">缺失</Option>
  </Select>
);

/** Tag that renders inventory status with colour and icon. */
const StatusTag: React.FC<{ status: AssetCountStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <Tag icon={cfg.icon} color={cfg.color}>
      {cfg.label}
    </Tag>
  );
};

// ─── Progress Dashboard (Top) ──────────────────────────────────────────────

interface ProgressDashboardProps {
  summary: IInventorySummary;
  task: IInventoryTask;
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ summary, task }) => {
  const taskStatusCfg = TASK_STATUS_MAP[task.status];
  return (
    <div className={styles.dashboardSection}>
      {/* Task meta row */}
      <Descriptions
        size="small"
        bordered
        column={4}
        className={styles.taskMeta}
      >
        <Descriptions.Item label="任务名称">{task.taskName}</Descriptions.Item>
        <Descriptions.Item label="任务状态">
          <Tag color={taskStatusCfg.color}>{taskStatusCfg.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建人">{task.creator}</Descriptions.Item>
        <Descriptions.Item label="盘点范围">
          {task.locationScope.join('、')}
        </Descriptions.Item>
      </Descriptions>

      <Divider style={{ margin: '12px 0 16px' }} />

      {/* Five KPI cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card size="small" className={styles.kpiCard}>
            <Statistic
              title="总资产数"
              value={summary.totalCount}
              prefix={<FileProtectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card size="small" className={styles.kpiCard}>
            <Statistic
              title="已盘"
              value={summary.totalCount - summary.notCountedCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
            <Progress
              percent={summary.progress}
              status={summary.progress === 100 ? 'success' : 'active'}
              strokeColor="#1890ff"
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card size="small" className={styles.kpiCard}>
            <Statistic
              title="未盘"
              value={summary.notCountedCount}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Card size="small" className={styles.kpiCard}>
            <Statistic
              title="盘盈"
              value={summary.surplusCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<PlusCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Card size="small" className={styles.kpiCard}>
            <Statistic
              title="盘亏 / 缺失"
              value={summary.deficitCount + summary.missingCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<MinusCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ─── Difference Summary Panel (Bottom) ─────────────────────────────────────

interface DiffPanelProps {
  diffRecords: IDiffRecord[];
  loading: boolean;
  onBatchConfirm: (ids: string[]) => void;
  onSubmitApproval: () => void;
  canSubmit: boolean;
  submitting: boolean;
}

const DiffSummaryPanel: React.FC<DiffPanelProps> = ({
  diffRecords,
  loading,
  onBatchConfirm,
  onSubmitApproval,
  canSubmit,
  submitting,
}) => {
  const diffColumns: ColumnsType<IDiffRecord> = [
    { title: '资产编号', dataIndex: 'assetCode', key: 'assetCode', width: 160 },
    { title: '资产名称', dataIndex: 'assetName', key: 'assetName', ellipsis: true },
    {
      title: '差异类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        if (type === 'surplus') return <Tag color="processing">盘盈</Tag>;
        if (type === 'deficit') return <Tag color="warning">盘亏</Tag>;
        return <Tag color="error">缺失</Tag>;
      },
    },
    {
      title: '账面数量',
      dataIndex: 'bookQuantity',
      key: 'bookQuantity',
      width: 100,
      align: 'center',
    },
    {
      title: '实盘数量',
      dataIndex: 'actualQuantity',
      key: 'actualQuantity',
      width: 100,
      align: 'center',
      render: (val: number | null) => (val ?? '-'),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  ];

  const surplusCount = diffRecords.filter((r) => r.type === 'surplus').length;
  const deficitCount = diffRecords.filter((r) => r.type === 'deficit').length;
  const missingCount = diffRecords.filter((r) => r.type === 'missing').length;

  return (
    <Card
      className={styles.diffPanel}
      title={
        <Space>
          <span>差异汇总</span>
          <Badge count={diffRecords.length} style={{ backgroundColor: '#ff4d4f' }} />
          <Tag color="processing">盘盈 {surplusCount}</Tag>
          <Tag color="warning">盘亏 {deficitCount}</Tag>
          <Tag color="error">缺失 {missingCount}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Popconfirm
            title="确认批量确认所有差异项？"
            onConfirm={() =>
              onBatchConfirm(diffRecords.map((r) => r.assetId))
            }
            disabled={diffRecords.length === 0}
          >
            <Button disabled={diffRecords.length === 0}>
              批量确认异常项
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认提交盘盈盘亏数据至审批流？"
            onConfirm={onSubmitApproval}
            disabled={!canSubmit || submitting}
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={!canSubmit}
            >
              一键提交核准
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {diffRecords.length === 0 ? (
        <Empty description="暂无差异记录" />
      ) : (
        <Table
          rowKey="assetId"
          columns={diffColumns}
          dataSource={diffRecords}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ y: 280 }}
          rowClassName={(record) => {
            if (record.type === 'surplus') return styles.rowSurplus;
            if (record.type === 'deficit') return styles.rowDeficit;
            if (record.type === 'missing') return styles.rowMissing;
            return '';
          }}
        />
      )}
    </Card>
  );
};

// ─── Main Page Component ───────────────────────────────────────────────────

/**
 * InventoryDetail — 盘点执行详情页容器视图。
 *
 * Renders three visual sections:
 * 1. **Top**: Task metadata + progress dashboard with 5 KPI cards.
 * 2. **Middle**: Paginated asset table with inline StatusDropdown & remark editing.
 * 3. **Bottom**: Difference summary panel listing surplus / deficit / missing items,
 *    with batch-confirm and submit-approval actions.
 *
 * Route: `/inventory/tasks/:id`
 */
const InventoryDetail: React.FC = () => {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── Local state ────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);
  const [task, setTask] = useState<IInventoryTask | null>(null);
  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AssetCountStatus | 'all'>('all');
  const [remarkEditing, setRemarkEditing] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!taskId) return;
    setPageLoading(true);
    try {
      const [taskData, assetsData] = await Promise.all([
        inventoryService.getTask(taskId) as Promise<IInventoryTask>,
        inventoryService.getTaskDetails(taskId) as Promise<IAssetItem[]>,
      ]);
      setTask(taskData);
      setAssets(Array.isArray(assetsData) ? assetsData : []);
    } catch {
      message.error('加载盘点详情失败，请稍后重试');
    } finally {
      setPageLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Computed summary ───────────────────────────────────────────────────
  const summary: IInventorySummary = useMemo(() => {
    if (!task || assets.length === 0) {
      return {
        progress: 0,
        totalCount: 0,
        matchedCount: 0,
        surplusCount: 0,
        deficitCount: 0,
        missingCount: 0,
        notCountedCount: 0,
      };
    }
    const matchedCount = assets.filter((a) => a.status === 'matched').length;
    const surplusCount = assets.filter((a) => a.status === 'surplus').length;
    const deficitCount = assets.filter((a) => a.status === 'deficit').length;
    const missingCount = assets.filter((a) => a.status === 'missing').length;
    const notCountedCount = assets.filter((a) => a.status === 'not_counted').length;
    const countedCount = assets.length - notCountedCount;
    const totalCount = Math.max(task.totalAssets, assets.length);
    const progress = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;

    return {
      progress,
      totalCount,
      matchedCount,
      surplusCount,
      deficitCount,
      missingCount,
      notCountedCount,
    };
  }, [task, assets]);

  // ── Difference records for bottom panel ────────────────────────────────
  const diffRecords: IDiffRecord[] = useMemo(() =>
    assets
      .filter((a) => ['surplus', 'deficit', 'missing'].includes(a.status))
      .map((a) => ({
        assetId: a.id,
        assetCode: a.assetCode,
        assetName: a.name,
        type: a.status as 'surplus' | 'deficit' | 'missing',
        bookQuantity: a.bookQuantity,
        actualQuantity: a.actualQuantity,
        remark: a.remark,
      })),
    [assets],
  );

  // ── Filtered + searched asset list for the table ───────────────────────
  const filteredAssets = useMemo(() => {
    let list = assets;
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.assetCode.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [assets, statusFilter, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────

  /** Update a single asset's real-count status. */
  const handleStatusChange = useCallback(
    async (record: IAssetItem, newStatus: AssetCountStatus) => {
      // Derive actualQuantity from status
      const actualQuantity =
        newStatus === 'surplus'
          ? record.bookQuantity + 1
          : newStatus === 'deficit'
            ? Math.max(0, record.bookQuantity - 1)
            : newStatus === 'missing'
              ? 0
              : record.bookQuantity;

      try {
        await inventoryService.addScanResult(taskId!, { assetId: record.id, status: newStatus, actualQuantity, remark: record.remark });
        setAssets((prev) =>
          prev.map((a) =>
            a.id === record.id
              ? { ...a, status: newStatus, actualQuantity }
              : a,
          ),
        );
        message.success(`已更新「${record.assetCode}」为${STATUS_CONFIG[newStatus].label}`);
      } catch {
        message.error('状态更新失败，请重试');
      }
    },
    [],
  );

  /** Save inline remark for a specific asset row. */
  const handleRemarkSave = useCallback(
    async (record: IAssetItem) => {
      try {
        await inventoryService.addScanResult(taskId!, { assetId: record.id, status: record.status, actualQuantity: record.actualQuantity, remark: remarkDraft });
        setAssets((prev) =>
          prev.map((a) => (a.id === record.id ? { ...a, remark: remarkDraft } : a)),
        );
        setRemarkEditing(null);
        message.success('备注已保存');
      } catch {
        message.error('保存备注失败');
      }
    },
    [remarkDraft],
  );

  /** Batch confirm selected rows to "matched". */
  const handleBatchConfirm = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择需要确认的资产');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all((selectedRowKeys as string[]).map(id => inventoryService.addScanResult(taskId!, { assetId: id, status: 'matched', actualQuantity: null })));
      setAssets((prev) =>
        prev.map((a) =>
          selectedRowKeys.includes(a.id)
            ? { ...a, status: 'matched' as AssetCountStatus, actualQuantity: a.bookQuantity }
            : a,
        ),
      );
      message.success(`已批量确认 ${selectedRowKeys.length} 项资产`);
      setSelectedRowKeys([]);
    } catch {
      message.error('批量确认失败');
    } finally {
      setSubmitting(false);
    }
  }, [selectedRowKeys]);

  /** Batch confirm diff records via bottom panel. */
  const handleDiffBatchConfirm = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setSubmitting(true);
      try {
        await Promise.all(ids.map(id => inventoryService.addScanResult(taskId!, { assetId: id, status: 'matched', actualQuantity: null })));
        setAssets((prev) =>
          prev.map((a) =>
            ids.includes(a.id)
              ? { ...a, status: 'matched' as AssetCountStatus, actualQuantity: a.bookQuantity }
              : a,
          ),
        );
        message.success(`已批量确认 ${ids.length} 项差异资产`);
      } catch {
        message.error('批量确认失败');
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  /** Submit the entire inventory result for approval. */
  const handleSubmitApproval = useCallback(async () => {
    if (!taskId || !task) return;
    setSubmittingApproval(true);
    try {
      await inventoryService.updateTaskStatus(taskId, 'submitted');
      message.success('盘点结果已提交核准');
      // Navigate back to task list on success
      navigate('/inventory/tasks');
    } catch {
      message.error('提交核准失败，请检查网络后重试');
    } finally {
      setSubmittingApproval(false);
    }
  }, [taskId, task, navigate]);

  // ── Table column definitions ───────────────────────────────────────────
  const columns: ColumnsType<IAssetItem> = useMemo(
    () => [
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 160,
        fixed: 'left',
        render: (code: string) => <Text strong>{code}</Text>,
      },
      {
        title: '资产名称',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: 100,
      },
      {
        title: '存放地点',
        dataIndex: 'location',
        key: 'location',
        width: 120,
      },
      {
        title: '账面数量',
        dataIndex: 'bookQuantity',
        key: 'bookQuantity',
        width: 90,
        align: 'center',
        render: (val: number) => <Text strong>{val}</Text>,
      },
      {
        title: '实盘数量',
        dataIndex: 'actualQuantity',
        key: 'actualQuantity',
        width: 100,
        align: 'center',
        render: (val: number | null, record) => {
          const discrepancy = val != null ? val - record.bookQuantity : null;
          const hasDiscrepancy = discrepancy !== null && discrepancy !== 0;
          return (
            <Tooltip title={hasDiscrepancy ? `差异: ${discrepancy > 0 ? '+' : ''}${discrepancy}` : undefined}>
              <Text
                strong={hasDiscrepancy}
                type={
                  record.status === 'missing'
                    ? 'danger'
                    : hasDiscrepancy
                      ? 'warning'
                      : undefined
                }
              >
                {val ?? '-'}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        title: '实盘状态',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        filters: [
          { text: '未盘点', value: 'not_counted' },
          { text: '账实相符', value: 'matched' },
          { text: '盘盈', value: 'surplus' },
          { text: '盘亏', value: 'deficit' },
          { text: '缺失', value: 'missing' },
        ],
        onFilter: (value, record) => record.status === value,
        render: (status: AssetCountStatus, record) => (
          <StatusDropdown
            value={status}
            onChange={(newStatus) => handleStatusChange(record, newStatus)}
            disabled={task?.status === 'completed' || task?.status === 'approved'}
          />
        ),
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        width: 180,
        render: (remark: string, record) => {
          const isEditing = remarkEditing === record.id;
          if (isEditing) {
            return (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  size="small"
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  onPressEnter={() => handleRemarkSave(record)}
                  placeholder="输入备注"
                  autoFocus
                />
                <Button
                  size="small"
                  type="primary"
                  onClick={() => handleRemarkSave(record)}
                >
                  保存
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setRemarkEditing(null);
                    setRemarkDraft('');
                  }}
                >
                  取消
                </Button>
              </Space.Compact>
            );
          }
          return (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setRemarkEditing(record.id);
                setRemarkDraft(remark || '');
              }}
            >
              {remark || '添加备注'}
            </Button>
          );
        },
      },
    ],
    [task?.status, remarkEditing, remarkDraft, handleStatusChange, handleRemarkSave],
  );

  // ── Can submit?  Task must be in_progress and all assets must be counted ─
  const canSubmitApproval = useMemo(() => {
    if (!task || task.status !== 'in_progress') return false;
    return summary.notCountedCount === 0;
  }, [task, summary]);

  // ── Row class name for background highlight ────────────────────────────
  const getRowClassName = useCallback((record: IAssetItem) => {
    switch (record.status) {
      case 'matched':
        return styles.rowMatched;
      case 'surplus':
        return styles.rowSurplus;
      case 'deficit':
        return styles.rowDeficit;
      case 'missing':
        return styles.rowMissing;
      default:
        return '';
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  if (!taskId) {
    return (
      <div className={styles.emptyState}>
        <Empty description="缺少任务 ID" />
        <Button type="link" onClick={() => navigate('/inventory/tasks')}>
          返回任务列表
        </Button>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spin size="large" tip="加载盘点详情中…" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.emptyState}>
        <Empty description="未找到对应的盘点任务" />
        <Button type="link" onClick={() => navigate('/inventory/tasks')}>
          返回任务列表
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/inventory/tasks')}
          className={styles.backBtn}
        >
          返回列表
        </Button>
        <Title level={3} className={styles.pageTitle}>
          盘点工作台
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </div>

      {/* ── Top: Progress Dashboard ────────────────────────────────────── */}
      <ProgressDashboard summary={summary} task={task} />

      <Divider style={{ margin: '16px 0' }} />

      {/* ── Middle: Asset Table ────────────────────────────────────────── */}
      <Card
        className={styles.tableCard}
        title="资产清单"
        extra={
          <Space>
            <Input
              placeholder="搜索资产编号/名称/地点"
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 130 }}
              allowClear
            >
              <Option value="all">全部状态</Option>
              <Option value="not_counted">未盘点</Option>
              <Option value="matched">账实相符</Option>
              <Option value="surplus">盘盈</Option>
              <Option value="deficit">盘亏</Option>
              <Option value="missing">缺失</Option>
            </Select>
            <Popconfirm
              title={`确认将选中的 ${selectedRowKeys.length} 项资产标记为"账实相符"？`}
              onConfirm={handleBatchConfirm}
              disabled={selectedRowKeys.length === 0 || submitting}
            >
              <Button
                type="primary"
                disabled={selectedRowKeys.length === 0}
                loading={submitting}
              >
                批量确认（{selectedRowKeys.length}）
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Table<IAssetItem>
          rowKey="id"
          columns={columns}
          dataSource={filteredAssets}
          loading={pageLoading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled: record.status === 'matched',
            }),
          }}
          rowClassName={getRowClassName}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
            defaultCurrent: 1,
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* ── Bottom: Difference Summary Panel ───────────────────────────── */}
      <Divider style={{ margin: '16px 0' }} />
      <DiffSummaryPanel
        diffRecords={diffRecords}
        loading={pageLoading}
        onBatchConfirm={handleDiffBatchConfirm}
        onSubmitApproval={handleSubmitApproval}
        canSubmit={canSubmitApproval}
        submitting={submittingApproval}
      />
    </div>
  );
};

export default InventoryDetail;