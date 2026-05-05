import React, { memo, useCallback } from 'react';
import { Badge, Progress, Tag, Typography } from 'antd';
import {
  EnvironmentOutlined,
  AppstoreOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Type Definitions (aligned with spec data constraints)
// ---------------------------------------------------------------------------

/** Scope type for inventory task range selection */
type ScopeType = 'location' | 'category' | 'all';

/** Task status lifecycle values */
type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/** Inventory task data matching the spec data constraints table */
interface InventoryTask {
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
}

/** Props for the TaskListItem component */
interface TaskListItemProps {
  /** The inventory task data to render */
  task: InventoryTask;
  /** Whether this item is currently selected in the list */
  isSelected?: boolean;
  /** Callback fired when the user clicks this task item */
  onClick: (taskId: string) => void;
}

// ---------------------------------------------------------------------------
// Configuration Maps
// ---------------------------------------------------------------------------

/**
 * Maps task status values to Ant Design Badge status and Chinese display labels.
 * Covers all four spec-defined statuses: draft, in_progress, completed, submitted.
 */
const STATUS_CONFIG: Record<
  TaskStatus,
  { badgeStatus: 'default' | 'processing' | 'success' | 'warning'; label: string }
> = {
  draft: { badgeStatus: 'default', label: '草稿' },
  in_progress: { badgeStatus: 'processing', label: '进行中' },
  completed: { badgeStatus: 'success', label: '已完成' },
  submitted: { badgeStatus: 'warning', label: '已提交' },
};

/**
 * Maps scope type values to display icons and Chinese labels for the scope tag.
 * Covers all three spec-defined scope types: location, category, all.
 */
const SCOPE_CONFIG: Record<ScopeType, { icon: React.ReactNode; label: string }> = {
  location: { icon: <EnvironmentOutlined />, label: '按位置' },
  category: { icon: <AppstoreOutlined />, label: '按分类' },
  all: { icon: <GlobalOutlined />, label: '全部资产' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TaskListItem — Renders a single inventory task row in the left panel list.
 *
 * Each row displays:
 * - Task name (ellipsis with tooltip if overflow)
 * - Scope type tag (按位置 / 按分类 / 全部资产)
 * - Status Badge (草稿 / 进行中 / 已完成 / 已提交)
 * - Creation time in YYYY-MM-DD HH:mm format
 * - Progress bar + percentage text (1 decimal place, e.g. "60.0%")
 *
 * Supports visual selection highlighting (blue left border + background)
 * and full keyboard navigation (Enter / Space to activate).
 *
 * @param props - Component props
 * @param props.task - The inventory task data to display
 * @param props.isSelected - Whether this item is the currently selected task
 * @param props.onClick - Callback invoked with the task ID when clicked
 * @returns Memoized React element for a single task list item
 */
const TaskListItem: React.FC<TaskListItemProps> = memo(
  ({ task, isSelected = false, onClick }) => {
    /** Status display configuration for the current task */
    const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.draft;
    /** Scope type display configuration for the scope tag */
    const scopeCfg = SCOPE_CONFIG[task.scopeType] ?? SCOPE_CONFIG.all;
    /**
     * Progress formatted to 1 decimal place per spec constraint
     * (e.g. 60 → "60.0"). The progress field is already 0-100.
     */
    const progressText = task.progress.toFixed(1);
    /** Creation time formatted as YYYY-MM-DD HH:mm per ATB-001 step 3 */
    const formattedTime = dayjs(task.createdAt).format('YYYY-MM-DD HH:mm');

    /**
     * Click handler — propagates the task's unique ID to the parent callback.
     */
    const handleClick = useCallback(() => {
      onClick(task.taskId);
    }, [onClick, task.taskId]);

    /**
     * Keyboard handler for accessibility — activates the item on Enter or Space.
     * Prevents default scroll behavior for Space key.
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick],
    );

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`盘点任务: ${task.taskName}, 状态: ${statusCfg.label}, 进度: ${progressText}%`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          borderLeft: isSelected ? '3px solid #1677ff' : '3px solid transparent',
          backgroundColor: isSelected ? '#e6f4ff' : 'transparent',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {/* Row 1: Task name (left) + Status badge (right) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Text
            strong
            ellipsis={{ tooltip: task.taskName }}
            style={{ flex: 1, marginRight: 8, fontSize: 14 }}
          >
            {task.taskName}
          </Text>
          <Badge status={statusCfg.badgeStatus} text={statusCfg.label} />
        </div>

        {/* Row 2: Scope type tag (left) + Creation time (right) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Tag icon={scopeCfg.icon} color="blue">
            {scopeCfg.label}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formattedTime}
          </Text>
        </div>

        {/* Row 3: Progress bar (left, fills) + Percentage text (right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={task.progress}
            size="small"
            showInfo={false}
            strokeColor={task.progress >= 100 ? '#52c41a' : '#1677ff'}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Text
            style={{
              fontSize: 12,
              whiteSpace: 'nowrap',
              minWidth: 42,
              textAlign: 'right',
            }}
          >
            {progressText}%
          </Text>
        </div>
      </div>
    );
  },
);

TaskListItem.displayName = 'TaskListItem';

export default TaskListItem;
export type { TaskListItemProps, InventoryTask, ScopeType, TaskStatus };