/**
 * TaskList — 盘点任务列表组件（左侧面板）
 *
 * 对应 SPEC: P3-010-A
 * 验收基准: ATB-001 盘点任务列表渲染
 *
 * 功能：
 * - 分页展示盘点任务（每页 20 条，默认按创建时间倒序）
 * - 支持按状态筛选（下拉选择：草稿/进行中/已完成/已提交）
 * - 支持按任务名称搜索
 * - 空状态显示占位图 + "暂无盘点任务" 文案
 * - 点击任务行触发 onTaskSelect 回调
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Input,
  Progress,
  Typography,
  Empty,
  Spin,
  Space,
  Select,
  Pagination,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  SendOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

/* ================================================================== */
/*  Types — aligned with SPEC Data Constraints                        */
/*  In production these would be imported from @/types/inventory       */
/* ================================================================== */

/** 盘点范围类型 */
export type ScopeType = 'location' | 'category' | 'all';

/** 盘点任务状态 — 对齐 SPEC 数据约束 */
export type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/** 盘点任务实体 — 对齐 SPEC 数据约束全部字段 */
export interface InventoryTask {
  taskId: string;
  taskName: string;
  scopeType: ScopeType;
  scopeIds: string[];
  status: TaskStatus;
  progress: number;
  totalAssets: number;
  countedAssets: number;
  uncountedAssets: number;
  surplusAssets: number;
  deficitAssets: number;
  createdAt: string;
  updatedAt: string;
}

/** 分页请求参数 */
interface TaskListQuery {
  page: number;
  pageSize: number;
  status?: TaskStatus;
  keyword?: string;
}

/** 分页响应泛型 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** TaskList 组件 Props — 对齐 SPEC Props 接口摘要 */
export interface TaskListProps {
  /** 点击任务行时触发 */
  onTaskSelect: (taskId: string) => void;
  /** 当前选中的任务 ID */
  selectedTaskId?: string;
  /** 点击「新建盘点任务」按钮回调 */
  onCreateNew?: () => void;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

/** 每页条数 — 对齐 SPEC 交互约束 1（每页 20 条） */
const PAGE_SIZE = 20;

/** 状态配置映射 */
const STATUS_MAP: Record<
  TaskStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: '草稿',
    color: 'default',
    icon: <ClockCircleOutlined />,
  },
  in_progress: {
    label: '进行中',
    color: 'processing',
    icon: <SyncOutlined spin />,
  },
  completed: {
    label: '已完成',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  submitted: {
    label: '已提交',
    color: 'purple',
    icon: <SendOutlined />,
  },
};

/** 盘点范围标签 — 对齐 ATB-001 行 3 "盘点范围标签" */
const SCOPE_CONFIG: Record<
  ScopeType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  location: { label: '按位置', icon: <EnvironmentOutlined />, color: 'blue' },
  category: { label: '按分类', icon: <AppstoreOutlined />, color: 'geekblue' },
  all: { label: '全部资产', icon: <GlobalOutlined />, color: 'cyan' },
};

/** 状态筛选下拉选项 */
const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'submitted', label: '已提交' },
];

/* ================================================================== */
/*  API client                                                         */
/*  In production imported from @/api/inventory                        */
/* ================================================================== */

/**
 * 获取盘点任务分页列表
 *
 * 调用 GET /api/v1/inventory/tasks，传递分页与筛选参数。
 * 后端默认按创建时间倒序排列。
 *
 * @param query - 分页与筛选参数
 * @returns 分页响应数据
 * @throws 网络错误或后端业务异常
 */
async function fetchTaskList(
  query: TaskListQuery,
): Promise<PaginatedResponse<InventoryTask>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.keyword) {
    params.set('keyword', query.keyword);
  }

  const response = await fetch(`/api/v1/inventory/tasks?${params}`);

  if (!response.ok) {
    throw new Error(`获取盘点任务列表失败 (HTTP ${response.status})`);
  }

  return response.json() as Promise<PaginatedResponse<InventoryTask>>;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/**
 * 将 ISO 日期字符串格式化为 YYYY-MM-DD HH:mm
 *
 * @param isoStr - ISO 8601 格式的日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 格式化进度百分比，精确到小数点后 1 位
 *
 * 对齐 SPEC 交互约束 8：进度百分比精确到小数点后 1 位。
 *
 * @param value - 0-100 的进度值
 * @returns 格式化后的百分比字符串，如 "60.0"
 */
function formatProgress(value: number): string {
  return value.toFixed(1);
}

/* ================================================================== */
/*  TaskListItem — 单条任务行子组件                                    */
/* ================================================================== */

interface TaskListItemProps {
  /** 任务数据 */
  task: InventoryTask;
  /** 是否为当前选中 */
  isSelected: boolean;
  /** 点击选择回调 */
  onSelect: (taskId: string) => void;
}

/**
 * 盘点任务列表单行组件
 *
 * 每行展示：任务名称、盘点范围标签、状态 Badge、创建时间（YYYY-MM-DD HH:mm）、进度条 + 百分比文字。
 * 对齐 ATB-001 步骤 3 的期待结果。
 *
 * @param props - TaskListItemProps
 */
const TaskListItem: React.FC<TaskListItemProps> = ({
  task,
  isSelected,
  onSelect,
}) => {
  const statusCfg = STATUS_MAP[task.status];
  const scopeCfg = SCOPE_CONFIG[task.scopeType];

  return (
    <List.Item
      onClick={() => onSelect(task.taskId)}
      style={{
        cursor: 'pointer',
        padding: '12px 16px',
        background: isSelected ? '#e6f4ff' : '#ffffff',
        borderLeft: isSelected
          ? '3px solid #1677ff'
          : '3px solid transparent',
        borderRadius: 6,
        marginBottom: 8,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
      aria-label={`盘点任务: ${task.taskName}, 状态: ${statusCfg.label}`}
    >
      {/* ── 第一行：任务名称 + 状态 Badge ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Tooltip title={task.taskName}>
          <Typography.Text
            strong
            ellipsis
            style={{ maxWidth: '60%', fontSize: 14 }}
          >
            {task.taskName}
          </Typography.Text>
        </Tooltip>
        <Tag
          color={statusCfg.color}
          icon={statusCfg.icon}
          style={{ margin: 0, borderRadius: 12 }}
        >
          {statusCfg.label}
        </Tag>
      </div>

      {/* ── 第二行：盘点范围标签 + 创建时间 ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: 12,
          color: '#8c8c8c',
        }}
      >
        <Tag
          color={scopeCfg.color}
          icon={scopeCfg.icon}
          style={{ fontSize: 11, margin: 0, lineHeight: '18px' }}
        >
          {scopeCfg.label}
        </Tag>
        <span>{formatDateTime(task.createdAt)}</span>
      </div>

      {/* ── 第三行：进度条 + 百分比文字 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress
          percent={task.progress}
          size="small"
          showInfo={false}
          style={{ flex: 1, marginBottom: 0 }}
          strokeColor={task.progress >= 100 ? '#52c41a' : '#1677ff'}
        />
        <Typography.Text
          type={task.progress >= 100 ? 'success' : 'secondary'}
          style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}
        >
          {formatProgress(task.progress)}%
        </Typography.Text>
      </div>
    </List.Item>
  );
};

/* ================================================================== */
/*  TaskList 主组件                                                    */
/* ================================================================== */

/**
 * 盘点任务列表组件 — 左侧面板
 *
 * 对应 SPEC P3-010-A，验收基准 ATB-001。
 *
 * 功能：
 * - 分页展示盘点任务（每页 20 条，默认按创建时间倒序）
 * - 支持按状态筛选（下拉选择：草稿/进行中/已完成/已提交）
 * - 支持按任务名称搜索
 * - 空状态显示占位图 + "暂无盘点任务" 文案
 * - 点击任务行触发 onTaskSelect 回调
 *
 * @param props - TaskListProps
 */
export const TaskList: React.FC<TaskListProps> = ({
  onTaskSelect,
  selectedTaskId,
  onCreateNew,
}) => {
  /* ── 本地 UI 状态 ── */
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(
    undefined,
  );
  const [keyword, setKeyword] = useState('');

  /* ── 数据获取（React Query） ── */
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-tasks', page, statusFilter, keyword],
    queryFn: () =>
      fetchTaskList({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter,
        keyword: keyword || undefined,
      }),
    staleTime: 30_000,
  });

  /** 搜索处理 — 同时重置页码 */
  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    setPage(1);
  }, []);

  /** 状态筛选变更 — 同时重置页码 */
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value === 'all' ? undefined : (value as TaskStatus));
    setPage(1);
  }, []);

  /** 分页变更 */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /* ── 派生数据 ── */
  const tasks = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        borderRight: '1px solid #f0f0f0',
      }}
      aria-label="盘点任务列表面板"
    >
      {/* ─── 顶部：标题 + 新建按钮 ─── */}
      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space align="center">
          <Typography.Title level={5} style={{ margin: 0 }}>
            盘点任务
          </Typography.Title>
          {!isLoading && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共 {total} 条
            </Typography.Text>
          )}
        </Space>
        {onCreateNew && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={onCreateNew}
            aria-label="新建盘点任务"
          >
            新建任务
          </Button>
        )}
      </div>

      {/* ─── 搜索 + 状态筛选下拉 ─── */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Input.Search
          placeholder="搜索任务名称..."
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={handleSearch}
          onChange={(e) => {
            if (!e.target.value) {
              handleSearch('');
            }
          }}
          aria-label="搜索盘点任务"
        />
        <Select
          value={statusFilter ?? 'all'}
          onChange={handleStatusChange}
          options={STATUS_OPTIONS}
          style={{ width: '100%' }}
          aria-label="按状态筛选"
        />
      </div>

      {/* ─── 任务列表区域 ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {isLoading ? (
          /* 加载状态 */
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin tip="加载中..." />
          </div>
        ) : isError ? (
          /* 错误状态 — 带重试按钮 */
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Empty
              description="加载失败"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                重试
              </Button>
            </Empty>
          </div>
        ) : tasks.length === 0 ? (
          /* 空状态 — 对齐 ATB-001 步骤 2 */
          <Empty
            description="暂无盘点任务"
            style={{ marginTop: 48 }}
            aria-label="暂无盘点任务"
          />
        ) : (
          /* 任务列表 — 对齐 ATB-001 步骤 3 */
          <List
            dataSource={tasks}
            split={false}
            renderItem={(task) => (
              <TaskListItem
                key={task.taskId}
                task={task}
                isSelected={task.taskId === selectedTaskId}
                onSelect={onTaskSelect}
              />
            )}
          />
        )}
      </div>

      {/* ─── 底部分页器 — 对齐 ATB-001 步骤 5 ─── */}
      {total > PAGE_SIZE && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={handlePageChange}
            size="small"
            showTotal={(t) => `共 ${t} 条`}
            aria-label="任务列表分页"
          />
        </div>
      )}
    </div>
  );
};

export default TaskList;