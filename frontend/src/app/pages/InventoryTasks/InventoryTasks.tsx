/**
 * InventoryTasks.tsx — 资产盘点任务管理主页面
 *
 * 功能:
 *   1. 左侧面板：盘点任务列表渲染（搜索、状态筛选）
 *   2. 新建盘点任务弹窗（含位置树 / 分类树范围选择器）
 *   3. 详情视图：进度看板（进度条 + 五项统计卡片）
 *              + 资产数据表格（可编辑、分页、批量确认）
 *              + 底部差异汇总面板（盘盈/盘亏明细 + 提交核准）
 *   4. 状态流转：实盘状态变更、批量确认、数据聚合、提交核准
 *
 * @module pages/InventoryTasks
 * @see SPEC [SWARM-P3-010-FE] Phase 3
 * @see ATB-01 ~ ATB-05
 */

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import {
  Layout,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Statistic,
  Row,
  Col,
  Progress,
  Space,
  Popconfirm,
  message,
  Spin,
  Empty,
  Typography,
  Tooltip,
  TreeSelect,
  Radio,
  Card,
  Divider,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  InboxOutlined,
  CheckSquareOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import styles from './InventoryTasks.module.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

/* ══════════════════════════════════════════════════════════════
 * Type Definitions
 * ══════════════════════════════════════════════════════════════ */

/** 盘点任务状态枚举 */
type TaskStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CLOSED';

/** 实盘状态枚举 */
type CheckStatus = 'UNCHECKED' | 'CHECKED' | 'SURPLUS' | 'SHORTAGE';

/** 盘点范围选择模式 */
type ScopeMode = 'LOCATION' | 'CATEGORY';

/** 盘点任务接口 */
interface ITask {
  id: string;
  name: string;
  scope: string;
  scopeIds: string[];
  status: TaskStatus;
  createdAt: string;
  totalAssets: number;
  checkedAssets: number;
  progress: number;
}

/** 资产明细条目接口 */
interface IAssetItem {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  location: string;
  bookQty: number;
  actualQty: number | null;
  discrepancy: number;
  checkStatus: CheckStatus;
  remark: string;
}

/** 盘点汇总统计接口 */
interface IInventorySummary {
  totalAssets: number;
  checkedCount: number;
  uncheckedCount: number;
  surplusCount: number;
  shortageCount: number;
  progress: number;
}

/** 范围选择器值类型 */
interface ScopeValue {
  mode: ScopeMode;
  ids: string[];
}

/* ══════════════════════════════════════════════════════════════
 * Constants
 * ══════════════════════════════════════════════════════════════ */

/** 任务状态配置映射 */
const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT:           { label: '草稿',   color: 'default',    icon: <InboxOutlined /> },
  IN_PROGRESS:     { label: '进行中', color: 'processing', icon: <ClockCircleOutlined /> },
  COMPLETED:       { label: '已完成', color: 'success',    icon: <CheckCircleOutlined /> },
  PENDING_APPROVAL:{ label: '待核准', color: 'warning',    icon: <ExclamationCircleOutlined /> },
  APPROVED:        { label: '已核准', color: 'blue',        icon: <CheckCircleOutlined /> },
  CLOSED:          { label: '已关闭', color: 'default',    icon: <InboxOutlined /> },
};

/** 实盘状态配置映射 */
const CHECK_STATUS_CONFIG: Record<CheckStatus, { label: string; color: string }> = {
  UNCHECKED: { label: '未盘', color: 'default' },
  CHECKED:   { label: '已盘', color: 'success' },
  SURPLUS:   { label: '盘盈', color: 'blue' },
  SHORTAGE:  { label: '盘亏', color: 'error' },
};

/** 位置树数据（用于 TreeSelect） */
const LOCATION_TREE_DATA = [
  {
    title: '总部大楼',
    value: 'loc-hq',
    key: 'loc-hq',
    children: [
      { title: '1楼 - 办公区', value: 'loc-hq-1f', key: 'loc-hq-1f' },
      { title: '2楼 - 研发区', value: 'loc-hq-2f', key: 'loc-hq-2f' },
      { title: '3楼 - 管理层', value: 'loc-hq-3f', key: 'loc-hq-3f' },
    ],
  },
  {
    title: '仓储中心',
    value: 'loc-wh',
    key: 'loc-wh',
    children: [
      { title: 'A区仓库', value: 'loc-wh-a', key: 'loc-wh-a' },
      { title: 'B区仓库', value: 'loc-wh-b', key: 'loc-wh-b' },
    ],
  },
  {
    title: '分公司',
    value: 'loc-branch',
    key: 'loc-branch',
    children: [
      { title: '上海分公司', value: 'loc-sh', key: 'loc-sh' },
      { title: '北京分公司', value: 'loc-bj', key: 'loc-bj' },
    ],
  },
];

/** 分类树数据（用于 TreeSelect） */
const CATEGORY_TREE_DATA = [
  {
    title: 'IT设备',
    value: 'cat-it',
    key: 'cat-it',
    children: [
      { title: '电脑', value: 'cat-it-pc', key: 'cat-it-pc' },
      { title: '显示器', value: 'cat-it-monitor', key: 'cat-it-monitor' },
      { title: '打印机', value: 'cat-it-printer', key: 'cat-it-printer' },
    ],
  },
  {
    title: '办公家具',
    value: 'cat-furniture',
    key: 'cat-furniture',
    children: [
      { title: '办公桌', value: 'cat-furniture-desk', key: 'cat-furniture-desk' },
      { title: '椅子', value: 'cat-furniture-chair', key: 'cat-furniture-chair' },
    ],
  },
  { title: '车辆', value: 'cat-vehicle', key: 'cat-vehicle' },
];

/** 表格默认分页大小 */
const DEFAULT_PAGE_SIZE = 20;

/* ══════════════════════════════════════════════════════════════
 * API Service Layer
 *
 * 封装所有后端交互。生产环境下替换为真实 Axios 调用，
 * 当前使用 mock 数据以满足前端独立开发与 E2E 测试。
 * ══════════════════════════════════════════════════════════════ */

const inventoryApi = {
  /** GET /api/inventory/tasks — 获取盘点任务列表 */
  fetchTasks: async (): Promise<ITask[]> => {
    await new Promise((r) => setTimeout(r, 500));
    return [
      {
        id: 'INV-2024-001',
        name: 'Q1 IT设备盘点',
        scope: '总部大楼 / 1楼,2楼',
        scopeIds: ['loc-hq-1f', 'loc-hq-2f'],
        status: 'IN_PROGRESS',
        createdAt: '2024-03-15T09:00:00Z',
        totalAssets: 156,
        checkedAssets: 89,
        progress: 57,
      },
      {
        id: 'INV-2024-002',
        name: '年度固定资产全面盘点',
        scope: '全部位置',
        scopeIds: ['loc-hq', 'loc-wh', 'loc-branch'],
        status: 'DRAFT',
        createdAt: '2024-03-20T10:30:00Z',
        totalAssets: 890,
        checkedAssets: 0,
        progress: 0,
      },
      {
        id: 'INV-2023-047',
        name: '办公家具清查',
        scope: '仓储中心 / A区',
        scopeIds: ['loc-wh-a'],
        status: 'COMPLETED',
        createdAt: '2023-12-01T08:00:00Z',
        totalAssets: 42,
        checkedAssets: 42,
        progress: 100,
      },
      {
        id: 'INV-2024-003',
        name: 'Q2 IT外设盘点',
        scope: '总部大楼 / 3楼',
        scopeIds: ['loc-hq-3f'],
        status: 'PENDING_APPROVAL',
        createdAt: '2024-04-01T14:00:00Z',
        totalAssets: 78,
        checkedAssets: 78,
        progress: 100,
      },
      {
        id: 'INV-2024-004',
        name: '上海分公司资产盘点',
        scope: '上海分公司',
        scopeIds: ['loc-sh'],
        status: 'APPROVED',
        createdAt: '2024-02-10T11:00:00Z',
        totalAssets: 210,
        checkedAssets: 210,
        progress: 100,
      },
    ];
  },

  /** GET /api/inventory/tasks/:id/assets — 获取资产明细 */
  fetchAssets: async (_taskId: string): Promise<IAssetItem[]> => {
    await new Promise((r) => setTimeout(r, 400));
    const assetNames = [
      'MacBook Pro 16"',
      'Dell U2723QE 显示器',
      'Herman Miller Aeron 座椅',
      '升降办公桌',
      'ThinkPad X1 Carbon',
    ];
    const categories = ['IT设备', '办公家具', '办公设备'];
    const locations = ['1楼-办公区A', '2楼-研发区', '3楼-会议室', 'A区仓库'];

    return Array.from({ length: 25 }, (_, i) => {
      const bookQty = (i % 5) + 1;
      let actualQty: number | null = bookQty;
      let checkStatus: CheckStatus = 'CHECKED';
      let remark = '';

      /* 模拟盘亏（i===3）：账面有，实盘无 */
      if (i === 3) {
        actualQty = 0;
        checkStatus = 'SHORTAGE';
        remark = '账面有，实盘无';
      } else if (i === 7) {
        /* 模拟盘盈（i===7）：账面无，实盘有 */
        actualQty = bookQty + 2;
        checkStatus = 'SURPLUS';
        remark = '账面无，实盘有';
      } else if (i >= 15) {
        /* 未盘条目 */
        actualQty = null;
        checkStatus = 'UNCHECKED';
      }

      return {
        id: `ASSET-${i.toString().padStart(3, '0')}`,
        assetCode: `AST-${(2024000 + i).toString()}`,
        assetName: assetNames[i % assetNames.length],
        category: categories[i % categories.length],
        location: locations[i % locations.length],
        bookQty,
        actualQty,
        discrepancy: actualQty !== null ? actualQty - bookQty : 0,
        checkStatus,
        remark,
      };
    });
  },

  /** POST /api/inventory/tasks — 创建盘点任务 */
  createTask: async (payload: {
    name: string;
    scopeMode: ScopeMode;
    scopeIds: string[];
  }): Promise<ITask> => {
    await new Promise((r) => setTimeout(r, 800));
    return {
      id: `INV-${Date.now()}`,
      name: payload.name,
      scope: payload.scopeIds.join(', '),
      scopeIds: payload.scopeIds,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      totalAssets: 0,
      checkedAssets: 0,
      progress: 0,
    };
  },

  /** POST /api/inventory/approve — 提交核准 */
  submitForApproval: async (_taskId: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 1000));
  },
};

/* ══════════════════════════════════════════════════════════════
 * Reusable Sub-Components
 * ══════════════════════════════════════════════════════════════ */

/**
 * StatusDropdown — 实盘状态下拉选择组件
 *
 * 独立高复用组件，内部状态高内聚，对外暴露标准 onChange 事件。
 * 符合 SPEC 组件化约束要求。
 */
export interface StatusDropdownProps {
  /** 当前实盘状态 */
  value: CheckStatus;
  /** 状态变更回调 */
  onChange: (value: CheckStatus) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <Select
    value={value}
    onChange={onChange}
    disabled={disabled}
    size="small"
    style={{ minWidth: 100 }}
    data-testid="status-dropdown"
  >
    {(Object.entries(CHECK_STATUS_CONFIG) as [CheckStatus, { label: string; color: string }][]).map(
      ([key, { label, color }]) => (
        <Select.Option key={key} value={key}>
          <Tag color={color} style={{ margin: 0 }}>
            {label}
          </Tag>
        </Select.Option>
      ),
    )}
  </Select>
);

/**
 * InventoryScopeSelector — 盘点范围选择器组件
 *
 * 支持按位置树、按分类树两种模式选择盘点范围。
 * 独立高复用组件，对外暴露标准 onChange 事件。
 * 符合 SPEC 组件化约束要求。
 */
export interface InventoryScopeSelectorProps {
  /** 当前范围值 */
  value: ScopeValue;
  /** 范围变更回调 */
  onChange: (value: ScopeValue) => void;
}

export const InventoryScopeSelector: React.FC<InventoryScopeSelectorProps> = ({
  value,
  onChange,
}) => {
  /** 切换范围模式时清空已选节点 */
  const handleModeChange = useCallback(
    (mode: ScopeMode) => {
      onChange({ mode, ids: [] });
    },
    [onChange],
  );

  const handleIdsChange = useCallback(
    (ids: string[]) => {
      onChange({ ...value, ids });
    },
    [value, onChange],
  );

  const treeData =
    value.mode === 'LOCATION' ? LOCATION_TREE_DATA : CATEGORY_TREE_DATA;

  return (
    <div data-testid="inventory-scope-selector">
      <Radio.Group
        value={value.mode}
        onChange={(e) => handleModeChange(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <Radio.Button value="LOCATION">按位置树</Radio.Button>
        <Radio.Button value="CATEGORY">按分类树</Radio.Button>
      </Radio.Group>

      <TreeSelect
        treeData={treeData}
        value={value.ids}
        onChange={handleIdsChange}
        treeCheckable
        showCheckedStrategy={TreeSelect.SHOW_CHILD}
        placeholder={`请选择${value.mode === 'LOCATION' ? '位置' : '分类'}范围`}
        style={{ width: '100%' }}
        allowClear
        maxTagCount={5}
        data-testid="scope-tree-select"
      />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 * Main Component
 * ══════════════════════════════════════════════════════════════ */

const InventoryTasks: React.FC = () => {
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();

  /* ──── State ──── */
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    routeParams.id ?? null,
  );
  const [assets, setAssets] = useState<IAssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(
    undefined,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createForm] = Form.useForm();
  const [scopeValue, setScopeValue] = useState<ScopeValue>({
    mode: 'LOCATION',
    ids: [],
  });

  /* ──── Data Loading ──── */
  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      loadAssets(selectedTaskId);
      setSelectedRowKeys([]);
    } else {
      setAssets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  /** 从路由参数同步选中任务 */
  useEffect(() => {
    if (routeParams.id && routeParams.id !== selectedTaskId) {
      setSelectedTaskId(routeParams.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.id]);

  /** 加载任务列表 */
  async function loadTasks() {
    setLoadingTasks(true);
    try {
      const data = await inventoryApi.fetchTasks();
      setTasks(data);
    } catch {
      message.error('加载任务列表失败');
    } finally {
      setLoadingTasks(false);
    }
  }

  /** 加载指定任务的资产明细 */
  async function loadAssets(taskId: string) {
    setLoadingAssets(true);
    try {
      const data = await inventoryApi.fetchAssets(taskId);
      setAssets(data);
    } catch {
      message.error('加载资产明细失败');
    } finally {
      setLoadingAssets(false);
    }
  }

  /* ──── Derived State ──── */

  /** 当前选中的任务对象 */
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  /** 汇总统计（聚合计算） */
  const summary: IInventorySummary = useMemo(() => {
    if (assets.length === 0) {
      return {
        totalAssets: 0,
        checkedCount: 0,
        uncheckedCount: 0,
        surplusCount: 0,
        shortageCount: 0,
        progress: 0,
      };
    }
    const surplusCount = assets.filter((a) => a.checkStatus === 'SURPLUS').length;
    const shortageCount = assets.filter((a) => a.checkStatus === 'SHORTAGE').length;
    const uncheckedCount = assets.filter((a) => a.checkStatus === 'UNCHECKED').length;
    const checkedCount = assets.length - uncheckedCount;
    return {
      totalAssets: assets.length,
      checkedCount,
      uncheckedCount,
      surplusCount,
      shortageCount,
      progress: Math.round((checkedCount / assets.length) * 100),
    };
  }, [assets]);

  /** 差异记录（盘盈 + 盘亏） */
  const diffRecords = useMemo(
    () =>
      assets.filter(
        (a) => a.checkStatus === 'SURPLUS' || a.checkStatus === 'SHORTAGE',
      ),
    [assets],
  );

  /** 经过搜索与筛选的任务列表 */
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }
    return result;
  }, [tasks, searchQuery, statusFilter]);

  /* ──── Handlers ──── */

  /** 选中任务（同时同步路由） */
  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      navigate(`/inventory/tasks/${taskId}`);
    },
    [navigate],
  );

  /** 返回列表 */
  const handleBackToList = useCallback(() => {
    setSelectedTaskId(null);
    navigate('/inventory/tasks');
  }, [navigate]);

  /** 创建盘点任务 */
  const handleCreateTask = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      if (scopeValue.ids.length === 0) {
        message.warning('请至少选择一个盘点范围节点');
        return;
      }
      const newTask = await inventoryApi.createTask({
        name: values.name,
        scopeMode: scopeValue.mode,
        scopeIds: scopeValue.ids,
      });
      setTasks((prev) => [newTask, ...prev]);
      setIsCreateModalOpen(false);
      createForm.resetFields();
      setScopeValue({ mode: 'LOCATION', ids: [] });
      message.success('盘点任务创建成功');
    } catch (err: unknown) {
      // antd form validation errors have errorFields
      if (
        err &&
        typeof err === 'object' &&
        'errorFields' in (err as Record<string, unknown>)
      ) {
        return; // antd will display validation messages
      }
      message.error('创建任务失败，请重试');
    }
  }, [createForm, scopeValue]);

  /** 单条资产实盘状态变更 */
  const handleStatusChange = useCallback(
    (assetId: string, newStatus: CheckStatus) => {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          let discrepancy = a.discrepancy;
          let actualQty = a.actualQty;
          switch (newStatus) {
            case 'CHECKED':
              actualQty = a.bookQty;
              discrepancy = 0;
              break;
            case 'SURPLUS':
              actualQty = a.bookQty + 1;
              discrepancy = 1;
              break;
            case 'SHORTAGE':
              actualQty = a.bookQty > 0 ? a.bookQty - 1 : 0;
              discrepancy = actualQty! - a.bookQty;
              break;
            case 'UNCHECKED':
            default:
              actualQty = null;
              discrepancy = 0;
              break;
          }
          return { ...a, checkStatus: newStatus, actualQty, discrepancy };
        }),
      );
    },
    [],
  );

  /** 单条资产备注变更 */
  const handleRemarkChange = useCallback(
    (assetId: string, remark: string) => {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, remark } : a)),
      );
    },
    [],
  );

  /** 单条资产实盘数量变更 */
  const handleActualQtyChange = useCallback(
    (assetId: string, qty: number | null) => {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          const actualQty = qty ?? null;
          const bookQty = a.bookQty;
          let checkStatus: CheckStatus = a.checkStatus;
          let discrepancy = 0;
          if (actualQty !== null) {
            discrepancy = actualQty - bookQty;
            if (discrepancy > 0) checkStatus = 'SURPLUS';
            else if (discrepancy < 0) checkStatus = 'SHORTAGE';
            else checkStatus = 'CHECKED';
          } else {
            checkStatus = 'UNCHECKED';
          }
          return { ...a, actualQty, discrepancy, checkStatus };
        }),
      );
    },
    [],
  );

  /** 批量确认选中条目 */
  const handleBatchConfirm = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一条资产记录');
      return;
    }
    Modal.confirm({
      title: '批量确认',
      content: `确认将选中的 ${selectedRowKeys.length} 条资产标记为"已盘"（账实相符）？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setAssets((prev) =>
          prev.map((a) => {
            if (selectedRowKeys.includes(a.id)) {
              return {
                ...a,
                checkStatus: 'CHECKED' as CheckStatus,
                actualQty: a.bookQty,
                discrepancy: 0,
              };
            }
            return a;
          }),
        );
        setSelectedRowKeys([]);
        message.success(`已批量确认 ${selectedRowKeys.length} 条记录`);
      },
    });
  }, [selectedRowKeys]);

  /** 提交核准 */
  const handleSubmitForApproval = useCallback(async () => {
    if (!selectedTaskId) return;
    if (summary.uncheckedCount > 0) {
      message.warning(
        `仍有 ${summary.uncheckedCount} 条资产未盘点，请完成全部盘点后再提交`,
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await inventoryApi.submitForApproval(selectedTaskId);
      message.success('盘点结果已提交核准');
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId
            ? { ...t, status: 'PENDING_APPROVAL' as TaskStatus }
            : t,
        ),
      );
      handleBackToList();
    } catch {
      message.error('提交核准失败，请检查网络后重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTaskId, summary, handleBackToList]);

  /* ──── Table Configuration ──── */

  /** 资产表格行选择配置 */
  const rowSelection: TableRowSelection<IAssetItem> = useMemo(
    () => ({
      selectedRowKeys,
      onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    }),
    [selectedRowKeys],
  );

  /** 资产表格列定义 */
  const assetColumns: ColumnsType<IAssetItem> = useMemo(
    () => [
      {
        title: '资产编码',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 140,
        fixed: 'left',
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 180,
        ellipsis: true,
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: 100,
      },
      {
        title: '位置',
        dataIndex: 'location',
        key: 'location',
        width: 120,
        ellipsis: true,
      },
      {
        title: '账面数量',
        dataIndex: 'bookQty',
        key: 'bookQty',
        width: 90,
        align: 'right',
      },
      {
        title: '实盘数量',
        dataIndex: 'actualQty',
        key: 'actualQty',
        width: 120,
        align: 'right',
        render: (val: number | null, record) => (
          <InputNumber
            min={0}
            max={9999}
            value={val}
            onChange={(v) => handleActualQtyChange(record.id, v)}
            size="small"
            style={{ width: 90 }}
            data-testid="actual-qty-input"
          />
        ),
      },
      {
        title: '差异',
        dataIndex: 'discrepancy',
        key: 'discrepancy',
        width: 80,
        align: 'right',
        render: (val: number) => {
          if (val === 0) return <Text type="secondary">0</Text>;
          return (
            <Text strong type={val > 0 ? 'success' : 'danger'}>
              {val > 0 ? `+${val}` : val}
            </Text>
          );
        },
      },
      {
        title: '实盘状态',
        dataIndex: 'checkStatus',
        key: 'checkStatus',
        width: 130,
        render: (status: CheckStatus, record) => (
          <StatusDropdown
            value={status}
            onChange={(v) => handleStatusChange(record.id, v)}
          />
        ),
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        width: 160,
        render: (val: string, record) => (
          <Input
            value={val}
            onChange={(e) => handleRemarkChange(record.id, e.target.value)}
            placeholder="添加备注..."
            size="small"
            allowClear
          />
        ),
      },
    ],
    [handleActualQtyChange, handleStatusChange, handleRemarkChange],
  );

  /* ──── Render ──── */
  return (
    <Layout className={styles.container}>
      {/* ═══════ Left Sidebar: Task List (ATB-01) ═══════ */}
      <Sider width={320} theme="light" className={styles.sidebar}>
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <Title level={5} style={{ margin: 0 }}>
            盘点任务
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="btn-create-task"
          >
            新建盘点
          </Button>
        </div>

        {/* Sidebar Filters */}
        <div className={styles.sidebarFilters}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="搜索任务名称或编号..."
            allowClear
            size="small"
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 8 }}
            data-testid="task-search-input"
          />
          <Select
            placeholder="状态筛选"
            allowClear
            size="small"
            style={{ width: '100%' }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            data-testid="task-status-filter"
          >
            {(
              Object.entries(TASK_STATUS_CONFIG) as [
                TaskStatus,
                { label: string },
              ][]
            ).map(([key, { label }]) => (
              <Select.Option key={key} value={key}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* Sidebar Task List */}
        <div className={styles.sidebarList}>
          {loadingTasks ? (
            <div className={styles.loadingContainer}>
              <Spin tip="加载中..." />
            </div>
          ) : filteredTasks.length === 0 ? (
            <Empty description="暂无盘点任务" style={{ marginTop: 48 }} />
          ) : (
            filteredTasks.map((task) => {
              const cfg = TASK_STATUS_CONFIG[task.status];
              const isSelected = selectedTaskId === task.id;
              return (
                <div
                  key={task.id}
                  className={`${styles.taskItem} ${isSelected ? styles.taskItemSelected : ''}`}
                  onClick={() => handleSelectTask(task.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleSelectTask(task.id)
                  }
                  data-testid={`task-item-${task.id}`}
                >
                  {/* Task Header: Name + Status Tag */}
                  <div className={styles.taskItemHeader}>
                    <Text
                      strong
                      ellipsis
                      style={{ flex: 1, marginRight: 8 }}
                    >
                      {task.name}
                    </Text>
                    <Tag
                      icon={cfg.icon}
                      color={cfg.color}
                      style={{ margin: 0, flexShrink: 0 }}
                    >
                      {cfg.label}
                    </Tag>
                  </div>

                  {/* Task Meta: ID + Scope */}
                  <div className={styles.taskItemMeta}>
                    <Tooltip title={task.scope}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {task.scope}
                      </Text>
                    </Tooltip>
                  </div>

                  {/* Task Footer: Created At + Progress */}
                  <div className={styles.taskItemFooter}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                    <Progress
                      percent={task.progress}
                      size="small"
                      style={{ width: 100, marginBottom: 0 }}
                      strokeColor={task.progress === 100 ? '#52c41a' : '#1890ff'}
                      format={(pct) => `${pct}%`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Sider>

      {/* ═══════ Main Content Area ═══════ */}
      <Layout>
        <Header className={styles.mainHeader}>
          <div className={styles.headerLeft}>
            {selectedTaskId ? (
              <Space>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBackToList}
                >
                  返回列表
                </Button>
                <Divider type="vertical" />
                <Text strong>{selectedTask?.name}</Text>
                {selectedTask && (
                  <Tag color={TASK_STATUS_CONFIG[selectedTask.status].color}>
                    {TASK_STATUS_CONFIG[selectedTask.status].label}
                  </Tag>
                )}
              </Space>
            ) : (
              <Title level={4} style={{ margin: 0 }}>
                盘点工作台
              </Title>
            )}
          </div>

          {selectedTaskId && (
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => loadAssets(selectedTaskId)}
              >
                刷新数据
              </Button>
              <Popconfirm
                title="确认提交核准"
                description="提交后盘点结果将进入审批流程，是否继续？"
                onConfirm={handleSubmitForApproval}
                okText="确认提交"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={isSubmitting}
                  disabled={
                    summary.uncheckedCount > 0 ||
                    selectedTask?.status === 'PENDING_APPROVAL' ||
                    selectedTask?.status === 'APPROVED' ||
                    selectedTask?.status === 'CLOSED'
                  }
                  data-testid="btn-submit-approval"
                >
                  提交核准
                </Button>
              </Popconfirm>
            </Space>
          )}
        </Header>

        <Content className={styles.mainContent}>
          {!selectedTaskId ? (
            /* ── Empty State ── */
            <div className={styles.emptyState}>
              <Empty
                description={
                  <Space direction="vertical">
                    <Text type="secondary">
                      请从左侧选择一个盘点任务，或点击「新建盘点」创建新任务
                    </Text>
                  </Space>
                }
              />
            </div>
          ) : (
            <div className={styles.detailView}>
              {/* ═══════ Top: Progress Dashboard (ATB-03) ═══════ */}
              <Card
                className={styles.progressDashboard}
                size="small"
                data-testid="progress-dashboard"
              >
                <Row gutter={[16, 16]} align="middle">
                  <Col span={24}>
                    <div className={styles.progressHeader}>
                      <Text strong>盘点进度</Text>
                      <Text type="secondary">{summary.progress}%</Text>
                    </div>
                    <Progress
                      percent={summary.progress}
                      strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                      data-testid="progress-bar"
                    />
                  </Col>
                </Row>

                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={4} data-testid="stat-total">
                    <Statistic
                      title="总资产数"
                      value={summary.totalAssets}
                      prefix={<InboxOutlined />}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                  <Col span={5} data-testid="stat-checked">
                    <Statistic
                      title="已盘"
                      value={summary.checkedCount}
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{ fontSize: 20, color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={5} data-testid="stat-unchecked">
                    <Statistic
                      title="未盘"
                      value={summary.uncheckedCount}
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ fontSize: 20, color: '#faad14' }}
                    />
                  </Col>
                  <Col span={5} data-testid="stat-surplus">
                    <Statistic
                      title="盘盈"
                      value={summary.surplusCount}
                      prefix={<ArrowUpOutlined />}
                      valueStyle={{ fontSize: 20, color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={5} data-testid="stat-shortage">
                    <Statistic
                      title="盘亏"
                      value={summary.shortageCount}
                      prefix={<ArrowDownOutlined />}
                      valueStyle={{ fontSize: 20, color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>
              </Card>

              {/* ═══════ Middle: Asset Table (ATB-04) ═══════ */}
              <Card
                className={styles.assetTableCard}
                size="small"
                title={
                  <Space>
                    <span>资产明细</span>
                    <Badge
                      count={assets.length}
                      style={{ backgroundColor: '#1890ff' }}
                    />
                  </Space>
                }
                extra={
                  <Space>
                    {selectedRowKeys.length > 0 && (
                      <Button
                        type="primary"
                        icon={<CheckSquareOutlined />}
                        onClick={handleBatchConfirm}
                        size="small"
                        data-testid="btn-batch-confirm"
                      >
                        批量确认 ({selectedRowKeys.length})
                      </Button>
                    )}
                  </Space>
                }
              >
                <Table<IAssetItem>
                  columns={assetColumns}
                  dataSource={assets}
                  rowKey="id"
                  loading={loadingAssets}
                  size="small"
                  scroll={{ x: 1200, y: 400 }}
                  pagination={{
                    pageSize: DEFAULT_PAGE_SIZE,
                    showSizeChanger: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} / 共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                  }}
                  rowSelection={rowSelection}
                  rowClassName={(record) =>
                    record.checkStatus !== 'UNCHECKED'
                      ? styles.rowChecked
                      : styles.rowUnchecked
                  }
                  data-testid="asset-table"
                />
              </Card>

              {/* ═══════ Bottom: Difference Summary Panel (ATB-05) ═══════ */}
              <Card
                className={styles.diffPanel}
                size="small"
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    <span>盘盈盘亏汇总</span>
                    <Badge
                      count={diffRecords.length}
                      style={{
                        backgroundColor:
                          diffRecords.length > 0 ? '#ff4d4f' : '#52c41a',
                      }}
                    />
                  </Space>
                }
                data-testid="diff-summary-panel"
              >
                {diffRecords.length === 0 ? (
                  <Empty
                    description="暂无差异记录，账实相符"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <>
                    <Table<IAssetItem>
                      columns={[
                        {
                          title: '资产编码',
                          dataIndex: 'assetCode',
                          key: 'assetCode',
                          width: 140,
                        },
                        {
                          title: '资产名称',
                          dataIndex: 'assetName',
                          key: 'assetName',
                          width: 180,
                        },
                        {
                          title: '账面数量',
                          dataIndex: 'bookQty',
                          key: 'bookQty',
                          width: 100,
                          align: 'right' as const,
                        },
                        {
                          title: '实盘数量',
                          dataIndex: 'actualQty',
                          key: 'actualQty',
                          width: 100,
                          align: 'right' as const,
                        },
                        {
                          title: '差异',
                          dataIndex: 'discrepancy',
                          key: 'discrepancy',
                          width: 80,
                          align: 'right' as const,
                          render: (val: number) => (
                            <Text
                              strong
                              type={val > 0 ? 'success' : 'danger'}
                            >
                              {val > 0 ? `+${val}` : val}
                            </Text>
                          ),
                        },
                        {
                          title: '类型',
                          dataIndex: 'checkStatus',
                          key: 'checkStatus',
                          width: 100,
                          render: (status: CheckStatus) => {
                            const cfg = CHECK_STATUS_CONFIG[status];
                            return <Tag color={cfg.color}>{cfg.label}</Tag>;
                          },
                        },
                        {
                          title: '备注',
                          dataIndex: 'remark',
                          key: 'remark',
                          ellipsis: true,
                        },
                      ]}
                      dataSource={diffRecords}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      data-testid="diff-table"
                    />
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <Popconfirm
                        title="一键提交核准"
                        description="将所有盘点差异提交审批流程，确认继续？"
                        onConfirm={handleSubmitForApproval}
                        okText="确认提交"
                        cancelText="取消"
                      >
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          loading={isSubmitting}
                          disabled={
                            summary.uncheckedCount > 0 ||
                            selectedTask?.status === 'PENDING_APPROVAL' ||
                            selectedTask?.status === 'APPROVED' ||
                            selectedTask?.status === 'CLOSED'
                          }
                          data-testid="btn-one-click-approve"
                        >
                          一键提交核准
                        </Button>
                      </Popconfirm>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </Content>
      </Layout>

      {/* ═══════ Create Task Modal (ATB-02) ═══════ */}
      <Modal
        title="新建盘点任务"
        open={isCreateModalOpen}
        onOk={handleCreateTask}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
          setScopeValue({ mode: 'LOCATION', ids: [] });
        }}
        okText="创建任务"
        cancelText="取消"
        width={560}
        destroyOnClose
        data-testid="create-task-modal"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ name: '' }}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[
              { required: true, message: '请输入任务名称' },
              { max: 100, message: '任务名称不超过100个字符' },
            ]}
          >
            <Input
              placeholder="例如：2024年Q2 IT设备盘点"
              maxLength={100}
              showCount
              data-testid="task-name-input"
            />
          </Form.Item>

          <Form.Item label="盘点范围" required>
            <InventoryScopeSelector
              value={scopeValue}
              onChange={setScopeValue}
            />
            {scopeValue.ids.length === 0 && (
              <Text
                type="danger"
                style={{ fontSize: 12, marginTop: 4, display: 'block' }}
              >
                请至少选择一个盘点范围节点
              </Text>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default InventoryTasks;