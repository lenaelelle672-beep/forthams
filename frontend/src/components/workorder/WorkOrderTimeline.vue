<template>
  <div class="workorder-timeline" data-testid="workorder-timeline">
    <div class="timeline-header">
      <h4 class="timeline-title">审批流程</h4>
      <span class="timeline-count">{{ timelineNodes.length }} 个节点</span>
    </div>
    
    <el-timeline class="timeline-content" v-if="timelineNodes.length > 0">
      <el-timeline-item
        v-for="(node, index) in timelineNodes"
        :key="index"
        :color="getNodeColor(node.status)"
        :type="getNodeType(node.status)"
        :hollow="isCurrentNode(node.status)"
        :timestamp="formatDate(node.operatedAt)"
        placement="top"
      >
        <div class="timeline-node-content">
          <div class="node-header">
            <el-tag
              :type="getStatusTagType(node.status)"
              :effect="isCurrentNode(node.status) ? 'dark' : 'light'"
              size="small"
              class="status-tag"
            >
              {{ getStatusLabel(node.status) }}
            </el-tag>
            <span class="node-operator">{{ node.operator }}</span>
          </div>
          <div v-if="node.comment" class="node-comment">
            <span class="comment-label">意见：</span>
            <span class="comment-text">{{ node.comment }}</span>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
    
    <el-empty
      v-else
      description="暂无审批记录"
      :image-size="80"
      class="timeline-empty"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * WorkOrderTimeline Component
 * 
 * 展示工单审批状态流转的时间轴组件。
 * 用于实时追踪工单审批历史，包括每个审批节点的状态、操作人和意见。
 * 
 * @component
 * @example
 * ```vue
 * <WorkOrderTimeline
 *   :timeline-nodes="workOrderHistory"
 *   :current-status="WorkOrderStatus.APPROVING"
 * />
 * ```
 */

import { computed } from 'vue';
import { ElTimeline, ElTimelineItem, ElTag, ElEmpty } from 'element-plus';
import type { WorkOrderStatus } from '@/types/workorder.types';

// ============================================================
// Types / Interfaces
// ============================================================

/**
 * 时间轴节点接口
 * @interface TimelineNode
 * @description 表示审批流程中的一个节点
 */
export interface TimelineNode {
  /** 审批状态 */
  status: WorkOrderStatus;
  /** 操作人 */
  operator: string;
  /** 操作时间 */
  operatedAt: string;
  /** 审批意见（可选） */
  comment?: string;
}

// ============================================================
// Props Definition
// ============================================================

interface Props {
  /** 时间轴节点列表 */
  timelineNodes: TimelineNode[];
  /** 当前工单状态 */
  currentStatus?: WorkOrderStatus;
}

const props = withDefaults(defineProps<Props>(), {
  timelineNodes: () => [],
  currentStatus: undefined,
});

// ============================================================
// Constants / Mappings
// ============================================================

/**
 * 工单状态标签映射
 */
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CANCELLED: '已撤回',
  CLOSED: '已关闭',
};

/**
 * 状态配色映射 - 用于时间轴节点颜色
 */
const STATUS_COLOR_MAP: Record<WorkOrderStatus, string> = {
  DRAFT: '#909399',
  PENDING: '#909399',
  APPROVING: '#E6A23C',
  APPROVED: '#67C23A',
  REJECTED: '#F56C6C',
  CANCELLED: '#909399',
  CLOSED: '#409EFF',
};

/**
 * Element Plus Tag 类型映射
 */
const STATUS_TAG_TYPE_MAP: Record<WorkOrderStatus, string> = {
  DRAFT: 'info',
  PENDING: 'info',
  APPROVING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'info',
  CLOSED: 'primary',
};

/**
 * Element Plus Timeline Item 类型映射
 */
const STATUS_TIMELINE_TYPE_MAP: Record<WorkOrderStatus, string> = {
  DRAFT: 'primary',
  PENDING: 'info',
  APPROVING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'info',
  CLOSED: 'primary',
};

// ============================================================
// Methods
// ============================================================

/**
 * 获取状态标签文本
 * @param status - 工单状态
 * @returns 状态中文标签
 */
function getStatusLabel(status: WorkOrderStatus): string {
  return STATUS_LABELS[status] || status;
}

/**
 * 获取时间轴节点颜色
 * @param status - 工单状态
 * @returns 颜色值
 */
function getNodeColor(status: WorkOrderStatus): string {
  return STATUS_COLOR_MAP[status] || '#909399';
}

/**
 * 获取时间轴节点类型
 * @param status - 工单状态
 * @returns Element Plus timeline item type
 */
function getNodeType(status: WorkOrderStatus): string {
  return STATUS_TIMELINE_TYPE_MAP[status] || 'primary';
}

/**
 * 获取状态标签类型
 * @param status - 工单状态
 * @returns Element Plus tag type
 */
function getStatusTagType(status: WorkOrderStatus): string {
  return STATUS_TAG_TYPE_MAP[status] || 'info';
}

/**
 * 判断是否为当前节点（高亮显示）
 * @param status - 工单状态
 * @returns 是否为当前节点
 */
function isCurrentNode(status: WorkOrderStatus): boolean {
  if (props.currentStatus) {
    return status === props.currentStatus;
  }
  // 如果没有指定当前状态，默认最后一个节点为当前节点
  const lastNode = timelineNodes.value[timelineNodes.value.length - 1];
  return lastNode?.status === status;
}

/**
 * 格式化日期时间
 * @param dateString - ISO 日期字符串
 * @returns 格式化后的日期时间字符串
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

// ============================================================
// Computed
// ============================================================

/**
 * 时间轴节点列表（反向排列，最新的在前）
 */
const timelineNodes = computed(() => {
  return [...props.timelineNodes].reverse();
});

/**
 * 是否有审批记录
 */
const hasRecords = computed(() => props.timelineNodes.length > 0);
</script>

<style scoped lang="scss">
.workorder-timeline {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
    
    .timeline-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
    
    .timeline-count {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .timeline-content {
    padding-left: 4px;
    
    :deep(.el-timeline-item__node) {
      background-color: v-bind('STATUS_COLOR_MAP[props.currentStatus || "DRAFT"]');
    }
    
    :deep(.el-timeline-item__tail) {
      border-left-color: #e4e7ed;
    }
  }
  
  .timeline-node-content {
    .node-header {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .status-tag {
        font-size: 12px;
      }
      
      .node-operator {
        font-size: 14px;
        color: #606266;
        font-weight: 500;
      }
    }
    
    .node-comment {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
      
      .comment-label {
        color: #909399;
        margin-right: 4px;
      }
      
      .comment-text {
        color: #606266;
      }
    }
  }
  
  .timeline-empty {
    padding: 32px 0;
  }
}

// ============================================================
// Responsive Design
// ============================================================

@media screen and (max-width: 768px) {
  .workorder-timeline {
    padding: 12px;
    
    .timeline-header {
      .timeline-title {
        font-size: 14px;
      }
    }
    
    .timeline-node-content {
      .node-header {
        flex-wrap: wrap;
        
        .node-operator {
          font-size: 13px;
        }
      }
      
      .node-comment {
        font-size: 12px;
      }
    }
  }
}
</style>