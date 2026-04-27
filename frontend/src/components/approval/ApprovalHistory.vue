<template>
  <div class="approval-history">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!approvals || approvals.length === 0" class="empty-container">
      <el-icon :size="48"><Document /></el-icon>
      <p>暂无审批记录</p>
    </div>

    <!-- 审批历史时间线 -->
    <el-timeline v-else>
      <el-timeline-item
        v-for="record in approvals"
        :key="record.id"
        :icon="getActionIcon(record.action)"
        :color="getActionColor(record.action)"
        :hollow="false"
      >
        <div class="timeline-content">
          <!-- 审批人信息 -->
          <div class="approver-info">
            <el-avatar
              v-if="record.approverAvatar"
              :src="record.approverAvatar"
              :size="32"
            />
            <el-avatar v-else :size="32">
              {{ getInitials(record.approverName) }}
            </el-avatar>
            <span class="approver-name">{{ record.approverName }}</span>
          </div>

          <!-- 审批结果标签 -->
          <div class="action-badge" :class="getActionClass(record.action)">
            <el-icon :size="16">
              <component :is="getActionIcon(record.action)" />
            </el-icon>
            <span>{{ getActionLabel(record.action) }}</span>
          </div>

          <!-- 审批时间 -->
          <div class="approval-time">
            <el-icon :size="14"><Clock /></el-icon>
            <span>{{ formatTime(record.createdAt) }}</span>
          </div>

          <!-- 审批意见 -->
          <div v-if="record.comment" class="approval-comment">
            <el-icon :size="14"><ChatLineSquare /></el-icon>
            <p class="comment-text">{{ record.comment }}</p>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Loading,
  Document,
  Clock,
  ChatLineSquare,
  CircleCheck,
  CircleClose,
  Warning
} from '@element-plus/icons-vue'

/**
 * 审批记录数据结构
 */
interface ApprovalRecord {
  id: string
  workOrderId: string | number
  action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'
  approverId: string
  approverName: string
  approverAvatar?: string
  comment?: string
  createdAt: string
}

interface Props {
  /** 工单 ID */
  workOrderId: string | number
  /** 审批记录列表 */
  approvals: ApprovalRecord[]
  /** 加载状态，默认 false */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

/** 审批操作类型映射配置 */
const ACTION_CONFIG = {
  APPROVED: {
    label: '已通过',
    icon: CircleCheck,
    color: '#67C23A',
    class: 'action-success'
  },
  REJECTED: {
    label: '已拒绝',
    icon: CircleClose,
    color: '#F56C6C',
    class: 'action-danger'
  },
  REVISION_REQUIRED: {
    label: '需修改',
    icon: Warning,
    color: '#E6A23C',
    class: 'action-warning'
  }
} as const

/**
 * 获取审批操作标签
 * @param action - 审批操作类型
 */
const getActionLabel = (action: ApprovalRecord['action']): string => {
  return ACTION_CONFIG[action]?.label || action
}

/**
 * 获取审批操作图标组件
 * @param action - 审批操作类型
 */
const getActionIcon = (action: ApprovalRecord['action']): unknown => {
  return ACTION_CONFIG[action]?.icon || CircleCheck
}

/**
 * 获取审批操作颜色
 * @param action - 审批操作类型
 */
const getActionColor = (action: ApprovalRecord['action']): string => {
  return ACTION_CONFIG[action]?.color || '#909399'
}

/**
 * 获取审批操作 CSS 类名
 * @param action - 审批操作类型
 */
const getActionClass = (action: ApprovalRecord['action']): string => {
  return ACTION_CONFIG[action]?.class || ''
}

/**
 * 格式化审批时间
 * @param timeString - ISO 时间字符串
 */
const formatTime = (timeString: string): string => {
  if (!timeString) return ''
  try {
    const date = new Date(timeString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return timeString
  }
}

/**
 * 获取姓名首字母缩写
 * @param name - 姓名
 */
const getInitials = (name: string): string => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
</script>

<style scoped>
.approval-history {
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #909399;
}

.loading-container .el-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-container .el-icon {
  color: #dcdfe6;
  margin-bottom: 12px;
}

.empty-container p {
  margin: 0;
  font-size: 14px;
}

.timeline-content {
  padding-bottom: 8px;
}

.approver-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.approver-name {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.action-success {
  background-color: #f0f9eb;
  color: #67c23a;
}

.action-danger {
  background-color: #fef0f0;
  color: #f56c6c;
}

.action-warning {
  background-color: #fdf6ec;
  color: #e6a23c;
}

.approval-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 12px;
  margin-bottom: 8px;
}

.approval-comment {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 10px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.approval-comment .el-icon {
  color: #909399;
  flex-shrink: 0;
  margin-top: 2px;
}

.comment-text {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>