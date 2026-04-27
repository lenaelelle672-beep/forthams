<template>
  <div class="approval-page">
    <el-card class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold">工单审批</span>
          <el-tag :type="stateTagType" data-testid="state-badge">
            {{ stateLabel }}
          </el-tag>
        </div>
      </template>

      <!-- 工单基本信息 -->
      <div class="work-order-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单编号">
            {{ workOrder?.id || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="工单类型">
            {{ workOrder?.type || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ workOrder?.applicant || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="申请时间">
            {{ formatDate(workOrder?.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="当前审批人" :span="2">
            {{ workOrder?.currentApprover || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="工单描述" :span="2">
            {{ workOrder?.description || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- 审批操作区域 -->
    <el-card v-if="canApprove" class="mb-4">
      <template #header>
        <span>审批操作</span>
      </template>

      <div class="approval-actions">
        <el-button 
          type="success" 
          @click="handleApprove"
          data-testid="btn-approve"
        >
          通过
        </el-button>
        <el-button 
          type="danger" 
          @click="handleReject"
          data-testid="btn-reject"
        >
          驳回
        </el-button>
        <el-button 
          type="warning" 
          @click="handleTransfer"
          data-testid="btn-transfer"
        >
          转签
        </el-button>
      </div>

      <!-- 审批意见 -->
      <div class="approval-comment mt-4">
        <el-input
          v-model="approvalComment"
          type="textarea"
          :rows="3"
          placeholder="请输入审批意见（驳回时必填）"
          data-testid="input-comment"
        />
      </div>

      <!-- 驳回原因（必填） -->
      <div v-if="showRejectForm" class="reject-form mt-4">
        <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef">
          <el-form-item 
            label="驳回原因" 
            prop="reason"
            data-testid="input-reason"
          >
            <el-input
              v-model="rejectForm.reason"
              type="textarea"
              :rows="2"
              placeholder="请填写驳回原因（必填）"
            />
          </el-form-item>
        </el-form>
        <div v-if="rejectReasonError" class="text-red-500 text-sm" data-testid="error-reason">
          驳回原因不能为空
        </div>
      </div>

      <!-- 转签弹窗 -->
      <el-dialog
        v-model="transferDialogVisible"
        title="转签审批"
        width="500px"
      >
        <el-form :model="transferForm" :rules="transferRules" ref="transferFormRef">
          <el-form-item label="目标审批人" prop="targetUserId">
            <el-select 
              v-model="transferForm.targetUserId" 
              placeholder="请选择目标审批人"
              filterable
              class="w-full"
            >
              <el-option
                v-for="user in availableApprovers"
                :key="user.id"
                :label="user.name"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="转签原因" prop="reason">
            <el-input
              v-model="transferForm.reason"
              type="textarea"
              :rows="2"
              placeholder="请填写转签原因（选填）"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="transferDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmTransfer" data-testid="btn-confirm-transfer">
            确认转签
          </el-button>
        </template>
      </el-dialog>

      <!-- 确认操作弹窗 -->
      <el-dialog
        v-model="confirmDialogVisible"
        :title="confirmDialogTitle"
        width="400px"
      >
        <p>{{ confirmDialogMessage }}</p>
        <template #footer>
          <el-button @click="confirmDialogVisible = false">取消</el-button>
          <el-button 
            :type="confirmDialogType" 
            @click="confirmAction"
            data-testid="btn-confirm"
          >
            确认
          </el-button>
        </template>
      </el-dialog>
    </el-card>

    <!-- 审批历史时间线 -->
    <el-card>
      <template #header>
        <span>审批历史</span>
      </template>

      <el-timeline v-if="approvalHistory.length > 0" data-testid="approval-timeline">
        <el-timeline-item
          v-for="(record, index) in approvalHistory"
          :key="index"
          :timestamp="formatDate(record.createdAt)"
          :type="getTimelineItemType(record.action)"
        >
          <div class="timeline-content">
            <p class="font-medium">
              {{ getActionLabel(record.action) }} - {{ record.actorName }}
            </p>
            <p v-if="record.comment" class="text-gray-600 text-sm">
              意见：{{ record.comment }}
            </p>
            <p v-if="record.fromState && record.toState" class="text-gray-500 text-xs">
              {{ record.fromState }} → {{ record.toState }}
            </p>
          </div>
        </el-timeline-item>
      </el-timeline>

      <el-empty v-else description="暂无审批记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单审批页面组件
 * 
 * 功能说明：
 * - 提供工单审批操作界面（通过/驳回/转签）
 * - 展示审批历史时间线
 * - 状态机驱动工单状态流转
 * 
 * ATB 覆盖：
 * - ATB-6: 前端审批页面 E2E 测试
 * - ATB-7: 权限校验端到端测试
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useApprovalPermission } from '@/composables/useApprovalPermission'
import { useApprovalBinding } from '@/composables/useApprovalBinding'
import { approvalService } from '@/services/approvalService'

// Props
interface Props {
  workOrderId: string
}

const props = defineProps<Props>()

// 响应式状态
const workOrder = ref<Record<string, any>>({})
const approvalHistory = ref<Array<Record<string, any>>>([])
const approvalComment = ref('')
const isLoading = ref(false)

// 驳回表单
const showRejectForm = ref(false)
const rejectForm = ref({
  reason: ''
})
const rejectFormRef = ref<FormInstance>()
const rejectReasonError = ref(false)

// 转签表单
const transferDialogVisible = ref(false)
const transferForm = ref({
  targetUserId: '',
  reason: ''
})
const transferFormRef = ref<FormInstance>()
const availableApprovers = ref<Array<{ id: string; name: string }>>([])

// 确认弹窗
const confirmDialogVisible = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogType = ref<'success' | 'danger'>('success')
const pendingAction = ref<'approve' | 'reject' | null>(null)

// 权限校验
const { canApprove, currentUserId } = useApprovalPermission()
const { loadApprovalHistory, submitApproval } = useApprovalBinding()

// 计算属性
const stateTagType = computed(() => {
  const stateMap: Record<string, string> = {
    DRAFT: 'info',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TRANSFERRED: 'warning',
    CLOSED: 'info'
  }
  return stateMap[workOrder.value?.state] || 'info'
})

const stateLabel = computed(() => {
  const labelMap: Record<string, string> = {
    DRAFT: '草稿',
    PENDING_APPROVAL: '待审批',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    TRANSFERRED: '已转签',
    CLOSED: '已关闭'
  }
  return labelMap[workOrder.value?.state] || '-'
})

// 驳回表单校验规则
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请填写驳回原因', trigger: 'blur' }
  ]
}

// 转签表单校验规则
const transferRules: FormRules = {
  targetUserId: [
    { required: true, message: '请选择目标审批人', trigger: 'change' }
  ]
}

// 生命周期
onMounted(async () => {
  await loadWorkOrderData()
  await loadApprovalHistoryData()
})

/**
 * 加载工单数据
 */
async function loadWorkOrderData() {
  try {
    isLoading.value = true
    // 从 approvalService 获取工单详情
    const response = await approvalService.getWorkOrder(props.workOrderId)
    workOrder.value = response.data
  } catch (error) {
    ElMessage.error('加载工单信息失败')
  } finally {
    isLoading.value = false
  }
}

/**
 * 加载审批历史数据
 */
async function loadApprovalHistoryData() {
  try {
    const response = await loadApprovalHistory(props.workOrderId)
    approvalHistory.value = response || []
  } catch (error) {
    ElMessage.error('加载审批历史失败')
  }
}

/**
 * 处理审批通过
 */
function handleApprove() {
  pendingAction.value = 'approve'
  confirmDialogTitle.value = '确认通过'
  confirmDialogMessage.value = '确定要通过该工单吗？'
  confirmDialogType.value = 'success'
  confirmDialogVisible.value = true
}

/**
 * 处理驳回
 */
function handleReject() {
  pendingAction.value = 'reject'
  showRejectForm.value = true
  rejectForm.value.reason = ''
  rejectReasonError.value = false
  confirmDialogTitle.value = '确认驳回'
  confirmDialogMessage.value = '确定要驳回该工单吗？'
  confirmDialogType.value = 'danger'
  confirmDialogVisible.value = true
}

/**
 * 处理转签
 */
function handleTransfer() {
  transferDialogVisible.value = true
  loadAvailableApprovers()
}

/**
 * 加载可选审批人列表
 */
async function loadAvailableApprovers() {
  try {
    const response = await approvalService.getAvailableApprovers()
    availableApprovers.value = response.data || []
  } catch (error) {
    ElMessage.error('加载审批人列表失败')
  }
}

/**
 * 确认转签
 */
async function confirmTransfer() {
  if (!transferFormRef.value) return
  
  await transferFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    try {
      isLoading.value = true
      await submitApproval(props.workOrderId, {
        action: 'TRANSFERRED',
        targetUserId: transferForm.value.targetUserId,
        comment: transferForm.value.reason
      })
      ElMessage.success('转签成功')
      transferDialogVisible.value = false
      await refreshData()
    } catch (error: any) {
      ElMessage.error(error.message || '转签失败')
    } finally {
      isLoading.value = false
    }
  })
}

/**
 * 确认操作
 */
async function confirmAction() {
  // 驳回时校验原因必填
  if (pendingAction.value === 'reject') {
    if (!rejectForm.value.reason.trim()) {
      rejectReasonError.value = true
      return
    }
    rejectReasonError.value = false
  }

  try {
    isLoading.value = true
    
    const actionMap = {
      approve: 'APPROVED',
      reject: 'REJECTED'
    }
    
    await submitApproval(props.workOrderId, {
      action: actionMap[pendingAction.value!],
      comment: approvalComment.value,
      reason: pendingAction.value === 'reject' ? rejectForm.value.reason : undefined
    })
    
    ElMessage.success(pendingAction.value === 'approve' ? '审批通过' : '审批驳回')
    confirmDialogVisible.value = false
    showRejectForm.value = false
    await refreshData()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    isLoading.value = false
  }
}

/**
 * 刷新数据
 */
async function refreshData() {
  await loadWorkOrderData()
  await loadApprovalHistoryData()
}

/**
 * 格式化日期
 */
function formatDate(date: string | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

/**
 * 获取时间线项目类型
 */
function getTimelineItemType(action: string): string {
  const typeMap: Record<string, string> = {
    APPROVED: 'success',
    REJECTED: 'danger',
    TRANSFERRED: 'warning',
    SUBMITTED: 'primary'
  }
  return typeMap[action] || 'primary'
}

/**
 * 获取操作标签
 */
function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    APPROVED: '通过',
    REJECTED: '驳回',
    TRANSFERRED: '转签',
    SUBMITTED: '提交'
  }
  return labelMap[action] || action
}
</script>

<style scoped>
.approval-page {
  padding: 16px;
}

.mb-4 {
  margin-bottom: 16px;
}

.mt-4 {
  margin-top: 16px;
}

.flex {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.text-lg {
  font-size: 18px;
}

.font-semibold {
  font-weight: 600;
}

.text-gray-600 {
  color: #666;
}

.text-gray-500 {
  color: #999;
}

.text-sm {
  font-size: 14px;
}

.text-xs {
  font-size: 12px;
}

.text-red-500 {
  color: #f56c6c;
}

.approval-actions {
  display: flex;
  gap: 12px;
}

.work-order-info {
  margin-bottom: 16px;
}

.w-full {
  width: 100%;
}

.timeline-content {
  padding: 4px 0;
}
</style>