<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { workOrderApi, type WorkOrderDetail, type ApprovalAction } from '@/pages/WorkOrder/api/workOrderApi'

interface WorkOrder {
  id: number
  title: string
  status: string
  description: string
  applicant: string
  createdAt: string
  type: string
  currentApprover?: string
  version?: number
}

const props = defineProps<{
  workOrderId: number
}>()

const workOrder = ref<WorkOrder | null>(null)
const loading = ref(false)
const actionLoading = ref(false)
const showRejectDialog = ref(false)
const showTransferDialog = ref(false)
const rejectReason = ref('')
const transferTo = ref<number | null>(null)
const transferReason = ref('')
const comment = ref('')

const statusMap: Record<string, { type: string; label: string }> = {
  DRAFT: { type: 'info', label: '草稿' },
  PENDING_APPROVAL: { type: 'warning', label: '待审批' },
  APPROVING: { type: 'primary', label: '审批中' },
  APPROVED: { type: 'success', label: '已通过' },
  REJECTED: { type: 'danger', label: '已驳回' },
  ARCHIVED: { type: 'info', label: '已归档' }
}

const statusTagType = computed(() => {
  const status = workOrder.value?.status
  return statusMap[status]?.type || 'info'
})

const statusText = computed(() => {
  const status = workOrder.value?.status
  return statusMap[status]?.label || status
})

const canApprove = computed(() => {
  return workOrder.value?.status === 'PENDING_APPROVAL' || workOrder.value?.status === 'APPROVING'
})

const isActionDisabled = computed(() => {
  return !canApprove.value
})

onMounted(async () => {
  await loadWorkOrder()
})

async function loadWorkOrder() {
  loading.value = true
  try {
    const response = await workOrderApi.getWorkOrderDetail(props.workOrderId)
    workOrder.value = response.data
  } catch (error) {
    ElMessage.error('加载工单信息失败')
    console.error('Failed to load work order:', error)
  } finally {
    loading.value = false
  }
}

async function handleApprove() {
  if (!workOrder.value) return
  
  if (!canApprove.value) {
    ElMessage.warning('工单当前状态不允许审批操作')
    return
  }

  try {
    actionLoading.value = true
    await workOrderApi.approveWorkOrder(props.workOrderId, {
      action: 'APPROVED',
      comment: comment.value
    })
    ElMessage.success('审批通过成功')
    await loadWorkOrder()
  } catch (error: any) {
    if (error.response?.status === 409) {
      ElMessage.error('工单已被其他用户操作，请刷新后重试')
    } else {
      ElMessage.error('审批操作失败')
    }
    console.error('Approve failed:', error)
  } finally {
    actionLoading.value = false
  }
}

async function handleReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  
  if (rejectReason.value.length > 500) {
    ElMessage.warning('驳回原因不能超过500个字符')
    return
  }

  try {
    actionLoading.value = true
    await workOrderApi.rejectWorkOrder(props.workOrderId, {
      action: 'REJECTED',
      reason: rejectReason.value
    })
    ElMessage.success('驳回成功')
    showRejectDialog.value = false
    rejectReason.value = ''
    await loadWorkOrder()
  } catch (error: any) {
    if (error.response?.status === 409) {
      ElMessage.error('工单已被其他用户操作，请刷新后重试')
    } else if (error.response?.status === 422) {
      ElMessage.error(error.response.data?.detail || '驳回必须填写原因')
    } else {
      ElMessage.error('驳回操作失败')
    }
    console.error('Reject failed:', error)
  } finally {
    actionLoading.value = false
  }
}

function openRejectDialog() {
  if (!canApprove.value) {
    ElMessage.warning('工单当前状态不允许审批操作')
    return
  }
  showRejectDialog.value = true
  rejectReason.value = ''
}

function openTransferDialog() {
  if (!canApprove.value) {
    ElMessage.warning('工单当前状态不允许审批操作')
    return
  }
  showTransferDialog.value = true
  transferTo.value = null
  transferReason.value = ''
}

async function handleTransfer() {
  if (!transferTo.value) {
    ElMessage.warning('请选择转交审批人')
    return
  }
  
  if (!transferReason.value.trim()) {
    ElMessage.warning('请填写转交原因')
    return
  }
  
  if (transferReason.value.length > 500) {
    ElMessage.warning('转交原因不能超过500个字符')
    return
  }

  try {
    actionLoading.value = true
    await workOrderApi.transferWorkOrder(props.workOrderId, {
      action: 'TRANSFERRED',
      transferTo: transferTo.value,
      reason: transferReason.value
    })
    ElMessage.success('工单已转交给新的审批人')
    showTransferDialog.value = false
    await loadWorkOrder()
  } catch (error: any) {
    if (error.response?.status === 409) {
      ElMessage.error('工单已被其他用户操作，请刷新后重试')
    } else {
      ElMessage.error('转交操作失败')
    }
    console.error('Transfer failed:', error)
  } finally {
    actionLoading.value = false
  }
}

function formatDate(dateString: string): string {
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
</script>

<template>
  <div class="workorder-approve-container">
    <el-card class="header-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>工单审批详情</span>
          <el-tag :type="statusTagType" size="large">{{ statusText }}</el-tag>
        </div>
      </template>

      <div v-if="workOrder" class="workorder-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单ID">
            {{ workOrder.id }}
          </el-descriptions-item>
          <el-descriptions-item label="工单状态">
            <el-tag :type="statusTagType">{{ statusText }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="工单标题" :span="2">
            {{ workOrder.title }}
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ workOrder.applicant }}
          </el-descriptions-item>
          <el-descriptions-item label="申请时间">
            {{ formatDate(workOrder.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="工单类型">
            {{ workOrder.type }}
          </el-descriptions-item>
          <el-descriptions-item label="当前审批人" v-if="workOrder.currentApprover">
            {{ workOrder.currentApprover }}
          </el-descriptions-item>
          <el-descriptions-item label="工单描述" :span="2">
            <div class="description-content">{{ workOrder.description }}</div>
          </el-descriptions-item>
        </el-descriptions>

        <div class="action-section">
          <h4 class="section-title">审批意见</h4>
          <el-input
            v-model="comment"
            type="textarea"
            :rows="3"
            placeholder="请输入审批意见（可选）"
            maxlength="500"
            show-word-limit
          />
        </div>

        <div class="action-buttons">
          <el-button 
            type="success" 
            size="large"
            @click="handleApprove"
            :loading="actionLoading"
            :disabled="isActionDisabled"
          >
            通过
          </el-button>
          <el-button 
            type="danger" 
            size="large"
            @click="openRejectDialog"
            :disabled="isActionDisabled"
          >
            驳回
          </el-button>
          <el-button 
            type="warning" 
            size="large"
            @click="openTransferDialog"
            :disabled="isActionDisabled"
          >
            转交
          </el-button>
          <el-button size="large" @click="$router.back()">
            返回
          </el-button>
        </div>
      </div>

      <el-empty v-else description="未找到工单信息" />
    </el-card>

    <!-- 驳回对话框 -->
    <el-dialog
      v-model="showRejectDialog"
      title="驳回工单"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="reject-dialog-content">
        <p class="dialog-tip">请填写驳回原因，该信息将通知给申请人</p>
        <el-input
          v-model="rejectReason"
          type="textarea"
          :rows="4"
          placeholder="请输入驳回原因（必填）"
          maxlength="500"
          show-word-limit
        />
        <div class="reason-hint">
          <span :class="{ 'warning-text': rejectReason.length > 450 }">
            {{ rejectReason.length }}/500
          </span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showRejectDialog = false">取消</el-button>
        <el-button 
          type="danger" 
          @click="handleReject"
          :loading="actionLoading"
        >
          确认驳回
        </el-button>
      </template>
    </el-dialog>

    <!-- 转交对话框 -->
    <el-dialog
      v-model="showTransferDialog"
      title="转交工单"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="transfer-dialog-content">
        <el-form label-width="100px">
          <el-form-item label="选择审批人">
            <el-select
              v-model="transferTo"
              placeholder="请选择新的审批人"
              style="width: 100%"
              filterable
            >
              <el-option label="张三" :value="1" />
              <el-option label="李四" :value="2" />
              <el-option label="王五" :value="3" />
            </el-select>
          </el-form-item>
          <el-form-item label="转交原因">
            <el-input
              v-model="transferReason"
              type="textarea"
              :rows="3"
              placeholder="请输入转交原因（必填）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showTransferDialog = false">取消</el-button>
        <el-button 
          type="warning" 
          @click="handleTransfer"
          :loading="actionLoading"
        >
          确认转交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.workorder-approve-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
}

.workorder-info {
  padding: 10px 0;
}

.description-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.action-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular, #606266);
}

.action-buttons {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.reject-dialog-content,
.transfer-dialog-content {
  padding: 10px 0;
}

.dialog-tip {
  margin: 0 0 16px 0;
  color: var(--el-text-color-secondary, #909399);
  font-size: 14px;
}

.reason-hint {
  text-align: right;
  margin-top: 8px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.warning-text {
  color: var(--el-color-warning, #e6a23c);
}
</style>