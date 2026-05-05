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

/** 盘点任务数据模型 */
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
/*  Mock data (开发阶段占位，后续由 inventoryService 替换)               */
/* ------------------------------------------------------------------ */

const MOCK_LOCATION_TREE = [
  {
    title: '总部大楼',
    value: 'loc-hq',
    key: 'loc-hq',
    children: [
      { title: '1F 大厅', value: 'loc-hq-1f', key: 'loc-hq-1f' },
      { title: '2F 办公区', value: 'loc-hq-2f', key: 'loc-hq-2f' },
      { title: '3F 机房', value: 'loc-hq-3f', key: 'loc-hq-3f' },
    ],
  },
  {
    title: '研发中心',
    value: 'loc-rd',
    key: 'loc-rd',
    children: [
      { title: 'A栋实验室', value: 'loc-rd-a', key: 'loc-rd-a' },
      { title: 'B栋测试区', value: 'loc-rd-b', key: 'loc-rd-b' },
    ],
  },
  {
    title: '仓库',
    value: 'loc-wh',
    key: 'loc-wh',
    children: [
      { title: '耗材仓', value: 'loc-wh-1', key: 'loc-wh-1' },
      { title: '备件仓', value: 'loc-wh-2', key: 'loc-wh-2' },
    ],
  },
];

const MOCK_CATEGORY_TREE = [
  {
    title: '电子设备',
    value: 'cat-elec',
    key: 'cat-elec',
    children: [
      { title: '笔记本电脑', value: 'cat-elec-laptop', key: 'cat-elec-laptop' },
      { title: '台式机', value: 'cat-elec-desktop', key: 'cat-elec-desktop' },
      { title: '服务器', value: 'cat-elec-server', key: 'cat-elec-server' },
    ],
  },
  {
    title: '办公家具',
    value: 'cat-furniture',
    key: 'cat-furniture',
    children: [
      { title: '办公桌', value: 'cat-furn-desk', key: 'cat-furn-desk' },
      { title: '办公椅', value: 'cat-furn-chair', key: 'cat-furn-chair' },
    ],
  },
  {
    title: '交通工具',
    value: 'cat-vehicle',
    key: 'cat-vehicle',
  },
];

const MOCK_TASKS: IInventoryTask[] = [
  {
    id: '1',
    taskName: '2024年第一季度固定资产盘点',
    scopeType: 'location',
    locationIds: ['loc-hq'],
    categoryIds: [],
    startTime: '2024-03-01T09:00:00Z',
    endTime: '2024-03-15T18:00:00Z',
    status: 'IN_PROGRESS',
    creatorId: 'u001',
    creatorName: '张三',
    totalAssetsCount: 1250,
    countedAssetsCount: 850,
    surplusCount: 5,
    shortageCount: 3,
    createdAt: '2024-02-15T10:00:00Z',
  },
  {
    id: '2',
    taskName: 'IT设备专项盘点',
    scopeType: 'category',
    locationIds: [],
    categoryIds: ['cat-elec'],
    startTime: '2024-03-20T09:00:00Z',
    endTime: '2024-03-21T18:00:00Z',
    status: 'PLANNED',
    creatorId: 'u002',
    creatorName: '李四',
    totalAssetsCount: 45,
    countedAssetsCount: 0,
    surplusCount: 0,
    shortageCount: 0,
    createdAt: '2024-03-10T14:30:00Z',
  },
  {
    id: '3',
    taskName: '仓库耗材盘点',
    scopeType: 'location',
    locationIds: ['loc-wh'],
    categoryIds: [],
    startTime: '2024-02-01T09:00:00Z',
    endTime: '2024-02-05T18:00:00Z',
    status: 'COMPLETED',
    creatorId: 'u003',
    creatorName: '王五',
    totalAssetsCount: 320,
    countedAssetsCount: 320,
    surplusCount: 0,
    shortageCount: 0,
    createdAt: '2024-01-15T09:00:00Z',
  },
  {
    id: '4',
    taskName: '研发中心资产盘点',
    scopeType: 'all',
    locationIds: [],
    categoryIds: [],
    startTime: '2024-03-05T09:00:00Z',
    endTime: '2024-03-10T18:00:00Z',
    status: 'PENDING_APPROVAL',
    creatorId: 'u001',
    creatorName: '张三',
    totalAssetsCount: 56,
    countedAssetsCount: 56,
    surplusCount: 1,
    shortageCount: 2,
    createdAt: '2024-03-01T11:00:00Z',
  },
  {
    id: '5',
    taskName: '办公家具全量盘点',
    scopeType: 'category',
    locationIds: [],
    categoryIds: ['cat-furniture'],
    startTime: '2024-04-01T09:00:00Z',
    endTime: '2024-04-05T18:00:00Z',
    status: 'DRAFT',
    creatorId: 'u002',
    creatorName: '李四',
    totalAssetsCount: 180,
    countedAssetsCount: 0,
    surplusCount: 0,
    shortageCount: 0,
    createdAt: '2024-03-20T08:00:00Z',
  },
];

/* ------------------------------------------------------------------ */
/*  API placeholder                                                    */
/* ------------------------------------------------------------------ */

/** 任务列表请求参数 */
interface FetchTasksParams {
  status?: InventoryTaskStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * API 适配层。
 * 后续接入 inventoryService 后替换为真实请求。
 */
const api = {
  /** 拉取盘点任务分页列表 */
  fetchTasks: async (
    _params: FetchTasksParams,
  ): Promise<{ list: IInventoryTask[]; total: number }> => {
    // TODO: 替换为 inventoryService.getTaskList(params)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ list: MOCK_TASKS, total: MOCK_TASKS.length });
      }, 400);
    });
  },

  /** 创建盘点任务 */
  createTask: async (
    data: Omit<ICreateTaskFormValues, 'timeRange'> & {
      startTime: string;
      endTime: string;
    },
  ): Promise<IInventoryTask> => {
    // TODO: 替换为 inventoryService.createTask(data)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ...MOCK_TASKS[0],
          id: 'new-' + Date.now(),
          taskName: data.taskName,
          createdAt: new Date().toISOString(),
        });
      }, 600);
    });
  },

  /** 删除盘点任务 */
  deleteTask: async (_id: string): Promise<void> => {
    // TODO: 替换为 inventoryService.deleteTask(id)
    return new Promise((resolve) => setTimeout(resolve, 300));
  },
};

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

  /* ---- data loading ---- */

  /** 加载任务列表 */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.fetchTasks({
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      setTasks(result.list);
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

      const [startTime, endTime] = values.timeRange;
      const payload = {
        taskName: values.taskName,
        scopeType: values.scopeType,
        locationIds: values.scopeType === 'location' ? (values.locationIds ?? []) : [],
        categoryIds: values.scopeType === 'category' ? (values.categoryIds ?? []) : [],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        remark: values.remark,
      };

      await api.createTask(payload);
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

  /** 删除任务 */
  const handleDelete = async (id: string) => {
    try {
      await api.deleteTask(id);
      message.success('删除成功');
      await loadTasks();
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
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
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
                treeData={MOCK_LOCATION_TREE}
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
                treeData={MOCK_CATEGORY_TREE}
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