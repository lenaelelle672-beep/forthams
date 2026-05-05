<template>
  <div class="approval-timeline">
    <el-timeline>
      <el-timeline-item
        v-for="(record, index) in timelineRecords"
        :key="record.id || index"
        :timestamp="formatTimestamp(record.createdAt)"
        :type="getTimelineItemType(record.action)"
        :hollow="record.action === 'REJECT'"
        placement="top"
      >
        <el-card class="timeline-card" :class="{ 'is-reject': record.action === 'REJECT' }">
          <div class="timeline-header">
            <el-tag :type="getActionTagType(record.action)" size="small">
              {{ getActionLabel(record.action) }}
            </el-tag>
            <span class="operator-name">{{ record.operatorName || record.operatorId }}</span>
          </div>
          <div v-if="record.comment" class="timeline-comment">
            <el-icon><Comment /></el-icon>
            <span>{{ record.comment }}</span>
          </div>
          <div v-if="record.reason" class="timeline-reason">
            <el-icon><Warning /></el-icon>
            <span>{{ record.reason }}</span>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>

    <el-empty v-if="!timelineRecords || timelineRecords.length === 0" description="暂无审批记录" />
  </div>
</template>

<script setup lang="ts">
/**
 * 工单审批历史时间线组件
 *
 * 功能说明：
 * - 展示工单的所有审批历史记录
 * - 支持审批/驳回两种操作类型的时间线展示
 * - 显示审批人、操作时间、意见/驳回原因等信息
 *
 * @example
 * ```vue
 * <ApprovalTimeline :records="approvalHistory" />
 * ```
 */

import { computed } from 'vue';
import { Comment, Warning } from '@element-plus/icons-vue';
import type { ApprovalAction, ApprovalRecord } from '@/types/approval';

// Props 定义
interface Props {
  /** 审批记录列表 */
  records?: ApprovalRecord[];
  /** 最大显示记录数，默认50 */
  maxRecords?: number;
}

const props = withDefaults(defineProps<Props>(), {
  records: () => [],
  maxRecords: 50,
});

// 截断后的时间线记录
const timelineRecords = computed(() => {
  if (props.records.length <= props.maxRecords) {
    return props.records;
  }
  return props.records.slice(0, props.maxRecords);
});

/**
 * 格式化时间戳
 * @param timestamp - ISO 格式时间戳
 * @returns 格式化后的日期字符串
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * 获取时间线节点类型
 * @param action - 审批动作
 * @returns Element Plus Timeline item type
 */
function getTimelineItemType(action: ApprovalAction | string): '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Record<string, '' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    APPROVE: 'success',
    REJECT: 'danger',
    SUBMIT: 'primary',
    CANCEL: 'warning',
  };
  return typeMap[action] || 'info';
}

/**
 * 获取操作标签类型
 * @param action - 审批动作
 * @returns Element Plus Tag type
 */
function getActionTagType(action: ApprovalAction | string): '' | 'success' | 'warning' | 'info' | 'danger' | '' {
  const typeMap: Record<string, '' | 'success' | 'warning' | 'info' | 'danger' | ''> = {
    APPROVE: 'success',
    REJECT: 'danger',
    SUBMIT: 'primary',
    CANCEL: 'info',
  };
  return typeMap[action] || '';
}

/**
 * 获取操作标签文本
 * @param action - 审批动作
 * @returns 操作标签文本
 */
function getActionLabel(action: ApprovalAction | string): string {
  const labelMap: Record<string, string> = {
    APPROVE: '审批通过',
    REJECT: '驳回',
    SUBMIT: '提交审批',
    CANCEL: '取消',
  };
  return labelMap[action] || action;
}
</script>

<style scoped lang="scss">
.approval-timeline {
  padding: 16px;

  :deep(.el-timeline) {
    padding-left: 8px;
  }

  :deep(.el-timeline-item__node) {
    background-color: var(--el-color-primary);
  }

  .timeline-card {
    margin-bottom: 4px;

    &.is-reject {
      border-left: 3px solid var(--el-color-danger);
    }
  }

  .timeline-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .operator-name {
      font-weight: 500;
      color: var(--el-text-color-primary);
    }
  }

  .timeline-comment {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: var(--el-text-color-regular);
    font-size: 14px;
    line-height: 1.5;
    margin-top: 8px;

    .el-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  .timeline-reason {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: var(--el-color-warning);
    font-size: 14px;
    line-height: 1.5;
    margin-top: 8px;
    padding: 8px;
    background-color: var(--el-color-warning-light-9);
    border-radius: 4px;

    .el-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }
}
</style>