<script setup lang="ts">
/**
 * 工单审批操作组件
 * 
 * 提供工单审批操作界面，支持通过、拒绝、驳回三种审批操作
 * 
 * @module ApprovalActions
 * @requires approvalService - 审批服务
 * @requires useApprovalPermission - 审批权限钩子
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { WorkOrder, ApprovalAction, ApprovalResult } from '@/types/workorder.types'
import { approvalService } from '@/services/approvalService'
import { useApprovalPermission } from '@/composables/useApprovalPermission'

/** Props 定义 */
interface Props {
  /** 工单信息 */
  workOrder: WorkOrder
  /** 是否显示加载状态 */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

/** Emits 定义 */
const emit = defineEmits<{
  /** 审批操作完成 */
  (e: 'approved', result: ApprovalResult): void
  /** 审批操作失败 */
  (e: 'error', error: Error): void
  /** 状态变更 */
  (e: 'status-changed', newStatus: string): void
}>()

/** 组件状态 */
const isSubmitting = ref(false)
const actionType = ref<ApprovalAction | null>(null)

/** 审批意见 */
const approvalComment = ref('')

/** 弹窗可见性 */
const commentDialogVisible = ref(false)

/** 权限钩子 */
const { canApprove, canReject, canRequestRevision } = useApprovalPermission(
  computed(() => props.workOrder)
)

/**
 * 打开审批意见输入弹窗
 * @param action - 审批操作类型
 */
const openCommentDialog = (action: ApprovalAction) => {
  actionType.value = action
  approvalComment.value = ''
  commentDialogVisible.value = true
}

/**
 * 确认审批操作
 * 
 * 根据 actionType 执行对应的审批操作：
 * - approve: 通过审批
 * - reject: 拒绝审批
 * - request_revision: 驳回并要求修改
 */
const confirmApproval = async () => {
  if (!actionType.value) return
  
  isSubmitting.value = true
  
  try {
    let result: ApprovalResult
    
    switch (actionType.value) {
      case 'approve':
        result = await approvalService.approve(props.workOrder.id, approvalComment.value)
        ElMessage.success('审批通过')
        break
        
      case 'reject':
        result = await approvalService.reject(props.workOrder.id, approvalComment.value)
        ElMessage.success('已拒绝')
        break
        
      case 'request_revision':
        result = await approvalService.requestRevision(props.workOrder.id, approvalComment.value)
        ElMessage.success('已驳回，请修改')
        break
        
      default:
        throw new Error('无效的审批操作')
    }
    
    commentDialogVisible.value = false
    emit('approved', result)
    emit('status-changed', result.newStatus)
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error('审批操作失败')
    ElMessage.error(err.message)
    emit('error', err)
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 取消审批操作
 */
const cancelApproval = () => {
  commentDialogVisible.value = false
  actionType.value = null
  approvalComment.value = ''
}

/**
 * 获取操作按钮配置
 * 
 * 根据权限状态返回可用的审批操作按钮列表
 */
const actionButtons = computed(() => {
  const buttons = []
  
  if (canApprove.value) {
    buttons.push({
      action: 'approve' as ApprovalAction,
      label: '通过',
      type: 'success',
      icon: 'Check'
    })
  }
  
  if (canReject.value) {
    buttons.push({
      action: 'reject' as ApprovalAction,
      label: '拒绝',
      type: 'danger',
      icon: 'Close'
    })
  }
  
  if (canRequestRevision.value) {
    buttons.push({
      action: 'request_revision' as ApprovalAction,
      label: '驳回',
      type: 'warning',
      icon: 'RefreshLeft'
    })
  }
  
  return buttons
})

/**
 * 获取弹窗标题
 */
const dialogTitle = computed(() => {
  switch (actionType.value) {
    case 'approve':
      return '确认通过审批'
    case 'reject':
      return '确认拒绝审批'
    case 'request_revision':
      return '驳回并要求修改'
    default:
      return '审批操作'
  }
})
</script>

<template>
  <div class="approval-actions">
    <div class="action-buttons">
      <el-button
        v-for="btn in actionButtons"
        :key="btn.action"
        :type="btn.type"
        :loading="isSubmitting"
        :disabled="loading"
        @click="openCommentDialog(btn.action)"
      >
        {{ btn.label }}
      </el-button>
    </div>

    <!-- 审批意见输入弹窗 -->
    <el-dialog
      v-model="commentDialogVisible"
      :title="dialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form>
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalComment"
            type="textarea"
            :rows="4"
            :placeholder="actionType === 'request_revision' ? '请输入驳回原因...' : '请输入审批意见（可选）'"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cancelApproval">取消</el-button>
        <el-button
          type="primary"
          :loading="isSubmitting"
          @click="confirmApproval"
        >
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.approval-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>