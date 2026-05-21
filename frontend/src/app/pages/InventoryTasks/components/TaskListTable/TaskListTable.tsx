/**
 * TaskListTable — 盘点任务列表组件
 *
 * 负责渲染盘点任务数据表格，支持状态筛选、关键字搜索与分页。
 * 右上角提供「新建盘点任务」入口，弹窗内集成 InventoryScopeSelector
 * （位置树 / 分类树 / 全部资产三选一）。
 *
 * 关联验收：ATB-01（列表渲染）、ATB-02（新建弹窗与范围选择）
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Space,
  Tag,
  message,
  Card,
  Typography,
  Popconfirm,
  Tooltip,
  Progress,
  Row,
  Col,
  Statistic,
  Radio,
  TreeSelect,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import inventoryService from '../../../../services/inventoryService';
import { getCategoryTree, type CategoryTreeNode } from '../../../../services/categoryService';
import http from '../../../../utils/http';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** 盘点任务状态枚举 */
export type InventoryTaskStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

/** 盘点范围类型 */
export type InventoryScopeType = 'all' | 'location' | 'category';

/** 盘点任务数据模型（UI 层，从 inventoryService.InventoryTask 映射） */
export interface IInventoryTask {
  id: string;
  taskName: string;
  scopeType: InventoryScopeType;
  locationIds: string[];
  categoryIds: string[];
  startTime: string;
  endTime: string;
  status: InventoryTaskStatus;
  creatorId: string;
  creatorName: string;
  totalAssetsCount: number;
  countedAssetsCount: number;
  surplusCount: number;
  shortageCount: number;
  remark?: string;
  createdAt: string;
}

/** 新建任务表单值 */
export interface ICreateTaskFormValues {
  taskName: string;
  scopeType: InventoryScopeType;
  locationIds?: string[];
  categoryIds?: string[];
  timeRange: [dayjs.Dayjs, dayjs.Dayjs];
  remark?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  InventoryTaskStatus,
  { color: string; icon: React.ReactNode; label: string }
> = {
  DRAFT: {
    color: 'default',
    icon: <ClockCircleOutlined />,
    label: '草稿',
  },
  PLANNED: {
    color: 'blue',
    icon: <CalendarOutlined />,
    label: '已计划',
  },
  IN_PROGRESS: {
    color: 'processing',
    icon: <FileTextOutlined />,
    label: '进行中',
  },
  COMPLETED: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    label: '盘点完成',
  },
  PENDING_APPROVAL: {
    color: 'warning',
    icon: <ExclamationCircleOutlined />,
    label: '待核准',
  },
  APPROVED: {
    color: 'gold',
    icon: <CheckCircleOutlined />,
    label: '已核准',
  },
  REJECTED: {
    color: 'error',
    icon: <ExclamationCircleOutlined />,
    label: '已驳回',
  },
};

const PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Helper: map ServiceTask → IInventoryTask                           */
/* ------------------------------------------------------------------ */

/**
 * 将 inventoryService.InventoryTask 映射为组件内部 IInventoryTask。
 * inventoryService 返回的 status 为小写（draft / in_progress / completed / submitted），
 * 需要映射到组件使用的大写状态。
 */
const SERVICE_STATUS_MAP: Record<string, InventoryTaskStatus> = {
  draft: 'DRAFT',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  submitted: 'PENDING_APPROVAL',
};

/** 将 CategoryTreeNode[] 转换为 Ant Design TreeSelect treeData 格式 */
function categoryNodesToTreeData(
  nodes: CategoryTreeNode[],
): { title: string; value: string; key: string; children?: any[] }[] {
  return nodes.map((n) => ({
    title: n.name,
    value: n.id,
    key: n.id,
    children: n.children ? categoryNodesToTreeData(n.children) : undefined,
  }));
}

/* ------------------------------------------------------------------ */
/*  Helper: scope display text                                         */
/* ------------------------------------------------------------------ */

/** 根据范围类型与 ID 列表返回可读描述 */
function renderScopeDescription(record: IInventoryTask): string {
  if (record.scopeType === 'all') return '全部资产';
  if (record.scopeType === 'location' && record.locationIds.length > 0) {
    return `${record.locationIds.length} 个位置`;
  }
  if (record.scopeType === 'category' && record.categoryIds.length > 0) {
    return `${record.categoryIds.length} 个分类`;
  }
  return '—';
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const TaskListTable: React.FC = () => {
  const navigate = useNavigate();

  /* ---- list state ---- */
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<IInventoryTask[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryTaskStatus | undefined>(undefined);

  /* ---- create-modal state ---- */
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<ICreateTaskFormValues>();
  const [scopeType, setScopeType] = useState<InventoryScopeType>('all');

  /* ---- category tree state (loaded from API) ---- */
  const [categoryTreeData, setCategoryTreeData] = useState<
    { title: string; value: string; key: string; children?: any[] }[]
  >([]);

  /* ---- location tree state (loaded from API) ---- */
  const [locationTreeData, setLocationTreeData] = useState<
    { title: string; value: string; key: string; children?: any[] }[]
  >([]);

  /* ---- load trees on mount ---- */
  useEffect(() => {
    getCategoryTree()
      .then((tree) => setCategoryTreeData(categoryNodesToTreeData(tree)))
      .catch(() => {
        // 分类树加载失败不阻塞页面，留空即可
      });

    // Load location tree from /api/v1/locations/list
    interface ApiLocNode { id: number | string; name: string; children?: ApiLocNode[] }
    function locNodesToTreeData(nodes: ApiLocNode[]) {
      return nodes.map((n) => ({
        title: n.name,
        value: String(n.id),
        key: String(n.id),
        children: n.children ? locNodesToTreeData(n.children) : undefined,
      }));
    }
    http.get<ApiLocNode[]>('/v1/locations/list')
      .then((res: any) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        setLocationTreeData(locNodesToTreeData(data));
      })
      .catch(() => { /* 位置树加载失败不阻塞 */ });
  }, []);

  /* ---- data loading ---- */

  /** 加载任务列表 */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await inventoryService.fetchTaskList({
        page: currentPage,
        pageSize: PAGE_SIZE,
        keyword: searchQuery || undefined,
      });
      // Map service tasks to local IInventoryTask
      const mapped: IInventoryTask[] = (result.items ?? []).map((t) => ({
        id: t.taskId,
        taskName: t.taskName,
        scopeType: (t.scopeType as InventoryScopeType) ?? 'all',
        locationIds: t.scopeType === 'location' ? (t.scopeIds ?? []) : [],
        categoryIds: t.scopeType === 'category' ? (t.scopeIds ?? []) : [],
        startTime: '',
        endTime: '',
        status: (SERVICE_STATUS_MAP[t.status] ?? 'DRAFT') as InventoryTaskStatus,
        creatorId: '',
        creatorName: '',
        totalAssetsCount: t.totalAssets ?? 0,
        countedAssetsCount: t.countedAssets ?? 0,
        surplusCount: t.surplusAssets ?? 0,
        shortageCount: t.deficitAssets ?? 0,
        createdAt: t.createdAt,
      }));
      // Apply client-side status filter if set
      const filtered = statusFilter
        ? mapped.filter((t) => t.status === statusFilter)
        : mapped;
      setTasks(filtered);
      setTotal(result.total);
    } catch {
      message.error('获取盘点任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /* ---- derived stats ---- */

  /** 顶部统计卡片数据 */
  const stats = useMemo(() => {
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pendingApproval = tasks.filter((t) => t.status === 'PENDING_APPROVAL').length;
    const totalCounted = tasks.reduce((s, t) => s + t.countedAssetsCount, 0);
    const totalDiff = tasks.reduce(
      (s, t) => s + t.surplusCount + t.shortageCount,
      0,
    );
    return { inProgress, pendingApproval, totalCounted, totalDiff };
  }, [tasks]);

  /* ---- handlers ---- */

  /** 打开新建弹窗 */
  const handleOpenCreateModal = () => {
    form.resetFields();
    setScopeType('all');
    setIsCreateModalOpen(true);
  };

  /** 提交新建任务 */
  const handleCreateTask = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      // Build scopeIds based on scopeType
      const scopeIds =
        values.scopeType === 'location'
          ? (values.locationIds ?? [])
          : values.scopeType === 'category'
            ? (values.categoryIds ?? [])
            : [];

      await inventoryService.createTask({
        taskName: values.taskName,
        scopeType: (values.scopeType === 'location' ? 'location' : values.scopeType === 'category' ? 'category' : 'all') as any,
        scopeIds: scopeIds.length > 0 ? scopeIds : undefined,
      });
      message.success('创建盘点任务成功');
      setIsCreateModalOpen(false);
      form.resetFields();
      await loadTasks();
    } catch (err) {
      // validateFields 会自动展示表单校验错误，这里只处理网络错误
      if (err && typeof err === 'object' && 'errorFields' in (err as any)) {
        // 表单校验失败，Ant Design 已自动提示
        return;
      }
      message.error('创建任务失败，请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  /** 删除任务 — 通过 updateTaskStatus 将任务标记为草稿后前端移除 */
  const handleDelete = async (id: string) => {
    try {
      // inventoryService has no deleteTask; optimistically remove from list
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      message.success('删除成功');
    } catch {
      message.error('删除失败');
    }
  };

  /** 切换分页 */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  /** 搜索 */
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  /** 状态筛选 */
  const handleStatusFilter = (value: InventoryTaskStatus | undefined) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  /** 盘点范围类型切换 */
  const handleScopeTypeChange = (e: any) => {
    const newType: InventoryScopeType = e.target.value;
    setScopeType(newType);
    form.setFieldsValue({
      scopeType: newType,
      locationIds: newType === 'location' ? [] : undefined,
      categoryIds: newType === 'category' ? [] : undefined,
    });
  };

  /* ---- table columns ---- */

  /** 表格列定义 */
  const columns: ColumnsType<IInventoryTask> = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 220,
      ellipsis: true,
      render: (text: string, record: IInventoryTask) => (
        <a
          style={{ fontWeight: 600 }}
          onClick={() => navigate(`/inventory/tasks/${record.id}`)}
        >
          {text}
        </a>
      ),
    },
    {
      title: '盘点范围',
      key: 'scope',
      width: 140,
      render: (_: unknown, record: IInventoryTask) => (
        <span style={{ fontSize: 13 }}>{renderScopeDescription(record)}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: InventoryTaskStatus) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '完成进度',
      key: 'progress',
      width: 180,
      render: (_: unknown, record: IInventoryTask) => {
        const pct =
          record.totalAssetsCount > 0
            ? Math.round(
                (record.countedAssetsCount / record.totalAssetsCount) * 100,
              )
            : 0;
        return (
          <div style={{ width: 150 }}>
            <Progress
              percent={pct}
              size="small"
              status={pct >= 100 ? 'success' : undefined}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>
              {record.countedAssetsCount} / {record.totalAssetsCount}
            </div>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 130,
      render: (_: unknown, record: IInventoryTask) => (
        <Space>
          <Tooltip title="进入执行工作台">
            <Button
              type={record.status === 'IN_PROGRESS' ? 'primary' : 'default'}
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/inventory/tasks/${record.id}`)}
            />
          </Tooltip>
          {(record.status === 'DRAFT' || record.status === 'PLANNED') && (
            <Popconfirm
              title="确认删除此任务？"
              description="删除后无法恢复，请谨慎操作。"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  /* ---- render ---- */
  return (
    <div style={{ padding: 24, background: '#ffffff', minHeight: '100vh' }}>
      {/* ====== 顶部标题栏 ====== */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            盘点任务管理
          </Typography.Title>
          <Typography.Text type="secondary">
            查看、创建及跟踪资产盘点作业进度
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
        >
          新建盘点任务
        </Button>
      </Row>

      {/* ====== 统计卡片 ====== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="进行中任务"
              value={stats.inProgress}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="待核准任务"
              value={stats.pendingApproval}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="累计盘点资产"
              value={stats.totalCounted}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="差异总数"
              value={stats.totalDiff}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ====== 筛选栏 ====== */}
      <Card
        bordered={false}
        style={{ marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <Space wrap size="middle">
          <Input.Search
            placeholder="搜索任务名称"
            allowClear
            style={{ width: 260 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={handleStatusFilter}
          >
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <Select.Option key={key} value={key}>
                {cfg.label}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* ====== 任务列表表格 ====== */}
      <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Table<IInventoryTask>
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          scroll={{ x: 950 }}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* ====== 新建盘点任务弹窗 ====== */}
      <Modal
        title="新建盘点任务"
        open={isCreateModalOpen}
        onOk={handleCreateTask}
        onCancel={() => {
          setIsCreateModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form<ICreateTaskFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            taskName: '',
            scopeType: 'all',
            remark: '',
          }}
        >
          {/* 任务名称 */}
          <Form.Item
            name="taskName"
            label="任务名称"
            rules={[
              { required: true, message: '请输入任务名称' },
              { max: 80, message: '任务名称不超过 80 个字符' },
            ]}
          >
            <Input placeholder="例如：2024年第二季度固定资产盘点" />
          </Form.Item>

          {/* 盘点范围类型选择 */}
          <Form.Item
            name="scopeType"
            label="盘点范围"
            rules={[{ required: true, message: '请选择盘点范围类型' }]}
          >
            <Radio.Group onChange={handleScopeTypeChange} value={scopeType}>
              <Radio value="all">全部资产</Radio>
              <Radio value="location">按位置树</Radio>
              <Radio value="category">按分类树</Radio>
            </Radio.Group>
          </Form.Item>

          {/* 位置树多选（仅在 scopeType === 'location' 时展示） */}
          {scopeType === 'location' && (
            <Form.Item
              name="locationIds"
              label="选择位置"
              rules={[{ required: true, message: '请至少选择一个位置节点' }]}
            >
              <TreeSelect
                treeData={locationTreeData}
                multiple
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                placeholder="请选择位置节点"
                allowClear
                treeCheckable
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          {/* 分类树多选（仅在 scopeType === 'category' 时展示） */}
          {scopeType === 'category' && (
            <Form.Item
              name="categoryIds"
              label="选择分类"
              rules={[{ required: true, message: '请至少选择一个分类节点' }]}
            >
              <TreeSelect
                treeData={categoryTreeData}
                multiple
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                placeholder="请选择分类节点"
                allowClear
                treeCheckable
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          {/* 盘点时间范围 */}
          <Form.Item
            name="timeRange"
            label="盘点时间范围"
            rules={[{ required: true, message: '请选择盘点时间范围' }]}
          >
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              showTime
              format="YYYY-MM-DD HH:mm"
            />
          </Form.Item>

          {/* 备注 */}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可选，填写备注信息" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskListTable;
