<template>
  <div class="approval-page">
    <el-card class="approval-card">
      <template #header>
        <div class="approval-header">
          <h3>工单审批</h3>
          <el-tag :type="stateTagType" data-testid="state-badge">
            {{ stateLabel }}
          </el-tag>
        </div>
      </template>

      <!-- 工单基本信息 -->
      <div class="workorder-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单编号">
            {{ workOrderId }}
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ applicantName }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ createdAt }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            {{ currentState }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 审批操作按钮组 -->
      <div class="approval-actions" v-if="canApprove">
        <el-button
          type="success"
          data-testid="btn-approve"
          @click="handleApprove"
          :loading="loading"
        >
          通过
        </el-button>
        <el-button
          type="danger"
          data-testid="btn-reject"
          @click="handleReject"
          :loading="loading"
        >
          驳回
        </el-button>
        <el-button
          type="warning"
          data-testid="btn-transfer"
          @click="handleTransfer"
          :loading="loading"
        >
          转签
        </el-button>
      </div>

      <!-- 审批通过对话框 -->
      <el-dialog
        v-model="approveDialogVisible"
        title="审批通过"
        width="500px"
      >
        <el-form :model="approveForm" label-width="80px">
          <el-form-item label="审批意见">
            <el-input
              v-model="approveForm.comment"
              type="textarea"
              :rows="3"
              placeholder="请输入审批意见（可选）"
              data-testid="input-comment"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="approveDialogVisible = false">取消</el-button>
          <el-button
            type="success"
            data-testid="btn-confirm"
            @click="confirmApprove"
            :loading="loading"
          >
            确认通过
          </el-button>
        </template>
      </el-dialog>

      <!-- 审批驳回对话框 -->
      <el-dialog
        v-model="rejectDialogVisible"
        title="审批驳回"
        width="500px"
      >
        <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef" label-width="80px">
          <el-form-item label="驳回原因" prop="reason">
            <el-input
              v-model="rejectForm.reason"
              type="textarea"
              :rows="4"
              placeholder="请输入驳回原因（必填）"
              data-testid="input-reason"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="rejectDialogVisible = false">取消</el-button>
          <el-button
            type="danger"
            data-testid="btn-confirm-reject"
            @click="confirmReject"
            :loading="loading"
          >
            确认驳回
          </el-button>
        </template>
      </el-dialog>

      <!-- 转签对话框 -->
      <el-dialog
        v-model="transferDialogVisible"
        title="审批转签"
        width="500px"
      >
        <el-form :model="transferForm" label-width="80px">
          <el-form-item label="目标审批人">
            <el-select
              v-model="transferForm.targetUserId"
              filterable
              placeholder="请选择目标审批人"
              :loading="userLoading"
              @search="searchUsers"
            >
              <el-option
                v-for="user in userOptions"
                :key="user.id"
                :label="user.name"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="转签原因">
            <el-input
              v-model="transferForm.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入转签原因（可选）"
              data-testid="input-transfer-reason"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="transferDialogVisible = false">取消</el-button>
          <el-button
            type="warning"
            data-testid="btn-confirm-transfer"
            @click="confirmTransfer"
            :loading="loading"
            :disabled="!transferForm.targetUserId"
          >
            确认转签
          </el-button>
        </template>
      </el-dialog>

      <!-- 审批历史时间线 -->
      <div class="approval-history">
        <h4>审批历史</h4>
        <el-timeline data-testid="approval-timeline">
          <el-timeline-item
            v-for="(record, index) in approvalHistory"
            :key="index"
            :timestamp="record.createdAt"
            :type="getTimelineItemType(record.action)"
          >
            <div class="timeline-content">
              <span class="action-badge" :class="record.action.toLowerCase()">
                {{ getActionLabel(record.action) }}
              </span>
              <span class="actor-name">{{ record.actorName }}</span>
              <p class="comment" v-if="record.comment">{{ record.comment }}</p>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="approvalHistory.length === 0" description="暂无审批记录" />
      </div>

      <!-- 错误提示 -->
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        class="error-alert"
        data-testid="error-message"
        @close="errorMessage = ''"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { approveWorkOrder, rejectWorkOrder, transferWorkOrder, getApprovalHistory } from '@/services/approvalService'
import { getWorkOrderById } from '@/services/workorderService'
import type { WorkOrder, ApprovalHistoryItem, ApprovalResult } from '@/types/workorder.types'
import type { ApprovalAction } from '@/types/approval'

// Props
const props = defineProps<{
  workOrderId: string
}>()

// Emits
const emit = defineEmits<{
  (e: 'approval-complete', result: ApprovalResult): void
}>()

// State
const loading = ref(false)
const userLoading = ref(false)
const errorMessage = ref('')
const workOrder = ref<WorkOrder | null>(null)
const approvalHistory = ref<ApprovalHistoryItem[]>([])
const currentUser = ref<{ id: string; name: string } | null>(null)

// Dialog visibility
const approveDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const transferDialogVisible = ref(false)

// Form refs
const rejectFormRef = ref<FormInstance>()

// Form data
const approveForm = reactive({
  comment: ''
})

const rejectForm = reactive({
  reason: ''
})

const transferForm = reactive({
  targetUserId: '',
  reason: ''
})

// User options for transfer
const userOptions = ref<Array<{ id: string; name: string }>>([])

// Computed
const canApprove = computed(() => {
  if (!workOrder.value) return false
  if (!currentUser.value) return false
  // 检查当前用户是否是当前审批人
  return workOrder.value.currentApproverId === currentUser.value.id
})

const stateTagType = computed(() => {
  if (!workOrder.value) return 'info'
  const stateMap: Record<string, string> = {
    'PENDING_APPROVAL': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'danger',
    'TRANSFERRED': 'warning',
    'CLOSED': 'info',
    'DRAFT': 'info'
  }
  return stateMap[workOrder.value.state] || 'info'
})

const stateLabel = computed(() => {
  if (!workOrder.value) return ''
  const labelMap: Record<string, string> = {
    'PENDING_APPROVAL': '待审批',
    'APPROVED': '已通过',
    'REJECTED': '已驳回',
    'TRANSFERRED': '已转签',
    'CLOSED': '已关闭',
    'DRAFT': '草稿'
  }
  return labelMap[workOrder.value.state] || workOrder.value.state
})

const applicantName = computed(() => {
  return workOrder.value?.applicantName || '-'
})

const createdAt = computed(() => {
  if (!workOrder.value?.createdAt) return '-'
  return new Date(workOrder.value.createdAt).toLocaleString('zh-CN')
})

const currentState = computed(() => {
  return stateLabel.value
})

// Validation rules
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请输入驳回原因', trigger: 'blur' },
    { min: 2, message: '驳回原因至少2个字符', trigger: 'blur' }
  ]
}

// Methods
const loadWorkOrder = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    const result = await getWorkOrderById(props.workOrderId)
    workOrder.value = result
  } catch (error: any) {
    errorMessage.value = error.message || '加载工单信息失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

const loadApprovalHistory = async () => {
  try {
    const result = await getApprovalHistory(props.workOrderId)
    approvalHistory.value = result
  } catch (error: any) {
    console.error('加载审批历史失败:', error)
  }
}

const loadCurrentUser = async () => {
  // 从 localStorage 或 store 获取当前用户信息
  const userStr = localStorage.getItem('currentUser')
  if (userStr) {
    currentUser.value = JSON.parse(userStr)
  }
}

const handleApprove = () => {
  approveForm.comment = ''
  approveDialogVisible.value = true
}

const handleReject = () => {
  rejectForm.reason = ''
  rejectDialogVisible.value = true
}

const handleTransfer = () => {
  transferForm.targetUserId = ''
  transferForm.reason = ''
  transferDialogVisible.value = true
}

const confirmApprove = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    const result = await approveWorkOrder(props.workOrderId, approveForm.comment)
    ElMessage.success('审批通过成功')
    approveDialogVisible.value = false
    emit('approval-complete', result)
    // 刷新数据
    await loadWorkOrder()
    await loadApprovalHistory()
  } catch (error: any) {
    errorMessage.value = error.message || '审批通过失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

const confirmReject = async () => {
  if (!rejectFormRef.value) return
  
  try {
    await rejectFormRef.value.validate()
  } catch {
    // 表单验证失败
    ElMessage.error('请填写驳回原因')
    return
  }

  if (!rejectForm.reason.trim()) {
    ElMessage.error('请填写驳回原因')
    return
  }

  try {
    loading.value = true
    errorMessage.value = ''
    const result = await rejectWorkOrder(props.workOrderId, rejectForm.reason)
    ElMessage.success('审批驳回成功')
    rejectDialogVisible.value = false
    emit('approval-complete', result)
    // 刷新数据
    await loadWorkOrder()
    await loadApprovalHistory()
  } catch (error: any) {
    errorMessage.value = error.message || '审批驳回失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

const confirmTransfer = async () => {
  if (!transferForm.targetUserId) {
    ElMessage.error('请选择目标审批人')
    return
  }

  try {
    loading.value = true
    errorMessage.value = ''
    const result = await transferWorkOrder(
      props.workOrderId,
      transferForm.targetUserId,
      transferForm.reason
    )
    ElMessage.success('审批转签成功')
    transferDialogVisible.value = false
    emit('approval-complete', result)
    // 刷新数据
    await loadWorkOrder()
    await loadApprovalHistory()
  } catch (error: any) {
    errorMessage.value = error.message || '审批转签失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

const searchUsers = async (query: string) => {
  if (!query) {
    userOptions.value = []
    return
  }

  try {
    userLoading.value = true
    // TODO: 调用用户搜索接口
    // const result = await searchUsers(query)
    // userOptions.value = result
    userOptions.value = []
  } catch (error) {
    console.error('搜索用户失败:', error)
  } finally {
    userLoading.value = false
  }
}

const getActionLabel = (action: string) => {
  const labelMap: Record<string, string> = {
    'APPROVED': '通过',
    'REJECTED': '驳回',
    'TRANSFERRED': '转签',
    'SUBMITTED': '提交'
  }
  return labelMap[action] || action
}

const getTimelineItemType = (action: string) => {
  const typeMap: Record<string, string> = {
    'APPROVED': 'success',
    'REJECTED': 'danger',
    'TRANSFERRED': 'warning',
    'SUBMITTED': 'primary'
  }
  return typeMap[action] || 'info'
}

// Lifecycle
onMounted(async () => {
  await loadCurrentUser()
  await loadWorkOrder()
  await loadApprovalHistory()
})
</script>

<style scoped lang="scss">
.approval-page {
  padding: 20px;
}

.approval-card {
  max-width: 900px;
  margin: 0 auto;
}

.approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
  }
}

.workorder-info {
  margin-bottom: 24px;
}

.approval-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.approval-history {
  margin-top: 24px;

  h4 {
    margin: 0 0 16px 0;
  }
}

.timeline-content {
  .action-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 8px;

    &.approved {
      background-color: var(--el-color-success-light-9);
      color: var(--el-color-success);
    }

    &.rejected {
      background-color: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
    }

    &.transferred {
      background-color: var(--el-color-warning-light-9);
      color: var(--el-color-warning);
    }

    &.submitted {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  .actor-name {
    font-weight: 500;
  }

  .comment {
    margin: 8px 0 0 0;
    color: var(--el-text-color-regular);
    font-size: 14px;
  }
}

.error-alert {
  margin-top: 16px;
}

:deep(.el-descriptions__label) {
  width: 120px;
}
</style>