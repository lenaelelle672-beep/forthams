<script setup lang="ts">
/**
 * ApprovalPanel.vue - 工单审批面板组件
 * 
 * 功能说明：
 * - 展示工单审批操作按钮（通过/拒绝/驳回）
 * - 提供审批意见输入弹窗
 * - 展示审批历史记录
 * - 权限控制（仅审批人可见操作按钮）
 * 
 * 状态流转：
 * - PENDING → APPROVED (通过)
 * - PENDING → REJECTED (拒绝)
 * - PENDING → REVISION_REQUIRED (驳回)
 * - 状态不可逆
 * 
 * @version 1.0.0
 * @author GSD Team
 */

import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ActionType } from '@/types/approval'

// 导入类型定义
import type { WorkOrder, ApprovalRecord } from '@/types/workorder.types'
import type { ApprovalAction } from '@/types/approval'

// 导入 API 和服务
import { approveWorkOrder, rejectWorkOrder, reviseWorkOrder } from '@/pages/WorkOrder/api/workOrderApi'

// 导入权限钩子
import { useApprovalPermission } from '@/composables/useApprovalPermission'

// Props 定义
interface Props {
  /** 工单数据 */
  workOrder: WorkOrder
  /** 审批历史记录 */
  approvalHistory: ApprovalRecord[]
  /** 是否加载中 */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits 定义
const emit = defineEmits<{
  /** 审批成功后触发，用于刷新数据 */
  (e: 'approval-success', workOrderId: number): void
  /** 打开审批历史弹窗 */
  (e: 'show-history'): void
}>()

// 状态定义
const dialogVisible = ref(false)
const submitting = ref(false)
const actionType = ref<ActionType | null>(null)
const approvalComment = ref('')

// 权限控制
const { canApprove, isApprover } = useApprovalPermission()

/**
 * 计算工单当前状态
 */
const currentStatus = computed(() => props.workOrder?.status)

/**
 * 判断是否为待审批状态
 */
const isPending = computed(() => currentStatus.value === 'PENDING')

/**
 * 判断是否已审批（不可重复审批）
 */
const isApproved = computed(() => currentStatus.value === 'APPROVED')

/**
 * 判断是否已拒绝
 */
const isRejected = computed(() => currentStatus.value === 'REJECTED')

/**
 * 判断是否需要修改
 */
const isRevisionRequired = computed(() => currentStatus.value === 'REVISION_REQUIRED')

/**
 * 判断当前用户是否有审批权限
 */
const hasApprovalPermission = computed(() => {
  return isPending.value && canApprove(props.workOrder)
})

/**
 * 获取状态显示文本
 */
const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    'PENDING': '待审批',
    'APPROVED': '已通过',
    'REJECTED': '已拒绝',
    'REVISION_REQUIRED': '待修改'
  }
  return statusMap[currentStatus.value] || currentStatus.value
})

/**
 * 获取状态对应的 CSS 类
 */
const statusClass = computed(() => {
  const classMap: Record<string, string> = {
    'PENDING': 'status-pending',
    'APPROVED': 'status-approved',
    'REJECTED': 'status-rejected',
    'REVISION_REQUIRED': 'status-revision'
  }
  return classMap[currentStatus.value] || ''
})

/**
 * 打开审批弹窗
 * @param action - 审批动作类型
 */
const openApprovalDialog = (action: ActionType) => {
  actionType.value = action
  approvalComment.value = ''
  dialogVisible.value = true
}

/**
 * 获取动作对应的提示文本
 */
const actionTitle = computed(() => {
  const titleMap: Record<ActionType, string> = {
    'APPROVE': '通过审批',
    'REJECT': '拒绝申请',
    'REVISE': '驳回修改'
  }
  return titleMap[actionType.value as ActionType] || '审批操作'
})

/**
 * 获取动作对应的按钮文本
 */
const actionButtonText = computed(() => {
  const buttonMap: Record<ActionType, string> = {
    'APPROVE': '确认通过',
    'REJECT': '确认拒绝',
    'REVISE': '确认驳回'
  }
  return buttonMap[actionType.value as ActionType] || '确认'
})

/**
 * 获取动作对应的警告提示
 */
const actionWarning = computed(() => {
  const warningMap: Record<ActionType, string> = {
    'APPROVE': '确认要通过此工单吗？',
    'REJECT': '确认要拒绝此工单吗？此操作不可逆。',
    'REVISE': '确认要驳回此工单吗？申请人需要重新修改。'
  }
  return warningMap[actionType.value as ActionType] || '确认执行此操作？'
})

/**
 * 执行审批操作
 */
const handleSubmitApproval = async () => {
  if (!props.workOrder?.id) {
    ElMessage.error('工单数据不完整')
    return
  }

  // 确认操作
  try {
    await ElMessageBox.confirm(
      actionWarning.value,
      actionTitle.value,
      {
        confirmButtonText: actionButtonText.value,
        cancelButtonText: '取消',
        type: actionType.value === 'APPROVE' ? 'success' : 'warning'
      }
    )
  } catch {
    // 用户取消
    return
  }

  submitting.value = true

  try {
    const workOrderId = props.workOrder.id
    const comment = approvalComment.value.trim()

    // 根据动作类型调用对应 API
    switch (actionType.value) {
      case 'APPROVE':
        await approveWorkOrder(workOrderId, { comment })
        ElMessage.success('审批通过')
        break
      case 'REJECT':
        await rejectWorkOrder(workOrderId, { comment })
        ElMessage.success('已拒绝')
        break
      case 'REVISE':
        await reviseWorkOrder(workOrderId, { comment })
        ElMessage.success('已驳回，请申请人修改')
        break
      default:
        throw new Error('未知审批动作')
    }

    // 关闭弹窗
    dialogVisible.value = false
    approvalComment.value = ''

    // 触发成功事件，刷新数据
    emit('approval-success', workOrderId)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '审批操作失败'
    ElMessage.error(errorMessage)
  } finally {
    submitting.value = false
  }
}

/**
 * 取消审批操作
 */
const handleCancel = () => {
  dialogVisible.value = false
  approvalComment.value = ''
}

/**
 * 查看审批历史
 */
const handleShowHistory = () => {
  emit('show-history')
}

/**
 * 格式化时间
 */
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 获取审批动作文本
 */
const getActionText = (action: string): string => {
  const actionMap: Record<string, string> = {
    'APPROVE': '通过',
    'REJECT': '拒绝',
    'REVISE': '驳回',
    'SUBMIT': '提交',
    'UPDATE': '修改'
  }
  return actionMap[action] || action
}

/**
 * 获取审批动作对应的类型标签
 */
const getActionType = (action: string): string => {
  const typeMap: Record<string, string> = {
    'APPROVE': 'success',
    'REJECT': 'danger',
    'REVISE': 'warning',
    'SUBMIT': 'info',
    'UPDATE': ''
  }
  return typeMap[action] || 'info'
}
</script>

<template>
  <div class="approval-panel">
    <!-- 状态展示区 -->
    <div class="status-section">
      <div class="status-label">审批状态</div>
      <div class="status-value">
        <el-tag :class="statusClass" :type="isApproved ? 'success' : isRejected ? 'danger' : isRevisionRequired ? 'warning' : 'info'">
          {{ statusText }}
        </el-tag>
      </div>
    </div>

    <!-- 审批操作按钮区 -->
    <div v-if="hasApprovalPermission" class="action-section">
      <div class="action-label">审批操作</div>
      <div class="action-buttons">
        <el-button 
          type="success" 
          size="large"
          @click="openApprovalDialog('APPROVE')"
          :loading="submitting"
        >
          <el-icon class="el-icon--left"><Check /></el-icon>
          通过
        </el-button>
        
        <el-button 
          type="danger" 
          size="large"
          @click="openApprovalDialog('REJECT')"
          :loading="submitting"
        >
          <el-icon class="el-icon--left"><Close /></el-icon>
          拒绝
        </el-button>
        
        <el-button 
          type="warning" 
          size="large"
          @click="openApprovalDialog('REVISE')"
          :loading="submitting"
        >
          <el-icon class="el-icon--left"><Edit /></el-icon>
          驳回修改
        </el-button>
      </div>
    </div>

    <!-- 已审批状态提示 -->
    <div v-else-if="!isPending" class="completed-notice">
      <el-alert
        :title="`此工单已${statusText}`"
        :type="isApproved ? 'success' : isRejected ? 'error' : 'warning'"
        :closable="false"
        show-icon
      />
    </div>

    <!-- 审批历史记录区 -->
    <div class="history-section">
      <div class="section-header">
        <span class="section-title">审批历史</span>
        <el-button 
          v-if="approvalHistory.length > 0" 
          type="primary" 
          link 
          @click="handleShowHistory"
        >
          查看全部
        </el-button>
      </div>
      
      <div v-if="approvalHistory.length === 0" class="empty-history">
        <el-empty description="暂无审批记录" :image-size="60" />
      </div>
      
      <div v-else class="history-list">
        <el-timeline>
          <el-timeline-item
            v-for="(record, index) in approvalHistory.slice(0, 3)"
            :key="record.id || index"
            :type="getActionType(record.action)"
            :timestamp="formatDateTime(record.created_at)"
            placement="top"
          >
            <div class="history-item">
              <div class="history-header">
                <el-tag :type="getActionType(record.action)" size="small">
                  {{ getActionText(record.action) }}
                </el-tag>
                <span class="approver-name">{{ record.approver_name || record.approver_id }}</span>
              </div>
              <div v-if="record.comment" class="history-comment">
                {{ record.comment }}
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <!-- 审批意见输入弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="actionTitle"
      width="500px"
      :close-on-click-modal="false"
      @close="handleCancel"
    >
      <el-form label-width="80px">
        <el-form-item :label="actionType === 'REVISE' ? '驳回原因' : '审批意见'">
          <el-input
            v-model="approvalComment"
            type="textarea"
            :rows="4"
            :placeholder="actionType === 'APPROVE' ? '请输入审批意见（可选）' : '请输入审批意见（必填）'"
            :maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item v-if="actionType === 'REVISE'" class="revision-tip">
          <el-alert
            title="驳回后将通知申请人重新修改工单"
            type="info"
            :closable="false"
            show-icon
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleCancel">取消</el-button>
          <el-button 
            :type="actionType === 'APPROVE' ? 'success' : actionType === 'REJECT' ? 'danger' : 'warning'"
            :loading="submitting"
            @click="handleSubmitApproval"
          >
            {{ actionButtonText }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.approval-panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  
  .status-section {
    display: flex;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;
    margin-bottom: 16px;
    
    .status-label {
      font-size: 14px;
      color: #606266;
      margin-right: 12px;
    }
    
    .status-value {
      :deep(.el-tag) {
        font-size: 14px;
        padding: 0 12px;
        height: 28px;
        line-height: 26px;
      }
      
      .status-pending {
        background-color: #ecf5ff;
        border-color: #d9ecff;
        color: #409eff;
      }
      
      .status-approved {
        background-color: #f0f9eb;
        border-color: #e1f3d8;
        color: #67c23a;
      }
      
      .status-rejected {
        background-color: #fef0f0;
        border-color: #ffe1e1;
        color: #f56c6c;
      }
      
      .status-revision {
        background-color: #fdf6ec;
        border-color: #faecd8;
        color: #e6a23c;
      }
    }
  }
  
  .action-section {
    padding: 16px 0;
    
    .action-label {
      font-size: 14px;
      color: #606266;
      margin-bottom: 12px;
    }
    
    .action-buttons {
      display: flex;
      gap: 12px;
      
      .el-button {
        flex: 1;
        height: 40px;
        font-size: 14px;
      }
    }
  }
  
  .completed-notice {
    padding: 12px 0;
    
    :deep(.el-alert) {
      padding: 8px 16px;
    }
  }
  
  .history-section {
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      .section-title {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }
    }
    
    .empty-history {
      padding: 20px 0;
      
      :deep(.el-empty__description) {
        font-size: 14px;
        color: #909399;
      }
    }
    
    .history-list {
      :deep(.el-timeline) {
        padding-left: 0;
        
        .el-timeline-item {
          padding-bottom: 16px;
          
          &:last-child {
            padding-bottom: 0;
          }
        }
        
        .el-timeline-item__node {
          background-color: #409eff;
        }
        
        .el-timeline-item__wrapper {
          padding-left: 24px;
        }
      }
      
      .history-item {
        .history-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          
          .approver-name {
            font-size: 13px;
            color: #606266;
          }
        }
        
        .history-comment {
          font-size: 13px;
          color: #606266;
          line-height: 1.5;
          padding: 8px 12px;
          background-color: #f5f7fa;
          border-radius: 4px;
          margin-top: 4px;
        }
      }
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  
  :deep(.el-dialog__body) {
    padding: 20px 24px;
    
    .revision-tip {
      margin-bottom: 0;
      
      .el-alert {
        padding: 8px 12px;
        
        .el-alert__title {
          font-size: 13px;
        }
      }
    }
  }
}
</style>