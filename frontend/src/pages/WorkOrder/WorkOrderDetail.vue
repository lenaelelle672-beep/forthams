<template>
  <div class="work-order-detail">
    <el-card class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="title">工单详情</span>
          <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
        </div>
      </template>

      <!-- 工单基本信息 -->
      <el-descriptions :column="2" border>
        <el-descriptions-item label="工单编号">
          {{ workOrder?.workOrderNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(workOrder?.createTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="申请人">
          {{ workOrder?.applicantName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="所属部门">
          {{ workOrder?.deptName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="资产名称" :span="2">
          {{ workOrder?.assetName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="工单描述" :span="2">
          {{ workOrder?.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 审批操作面板 -->
      <div v-if="canApprove" class="approval-panel">
        <el-divider content-position="left">审批操作</el-divider>
        
        <div class="approval-actions">
          <el-input
            v-model="approvalComment"
            type="textarea"
            :rows="3"
            placeholder="请输入审批意见（选填）"
            class="comment-input"
          />
          
          <div class="action-buttons">
            <el-button 
              type="success" 
              :loading="approving"
              @click="handleApprove"
            >
              批准
            </el-button>
            <el-button 
              type="danger" 
              :loading="rejecting"
              @click="showRejectDialog = true"
            >
              驳回
            </el-button>
          </div>
        </div>
      </div>

      <!-- 审批历史时间线 -->
      <div class="approval-history">
        <el-divider content-position="left">审批历史</el-divider>
        
        <el-timeline>
          <el-timeline-item
            v-for="(record, index) in approvalHistory"
            :key="index"
            :timestamp="formatDate(record.createTime)"
            :type="getTimelineItemType(record.action)"
            :hollow="index === 0"
          >
            <el-card shadow="hover" class="history-card">
              <div class="history-content">
                <div class="history-header">
                  <el-tag :type="getActionTagType(record.action)" size="small">
                    {{ getActionLabel(record.action) }}
                  </el-tag>
                  <span class="approver-name">{{ record.approverName }}</span>
                </div>
                <p v-if="record.comment" class="history-comment">
                  {{ record.comment }}
                </p>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>

        <el-empty 
          v-if="approvalHistory.length === 0" 
          description="暂无审批记录"
        />
      </div>
    </el-card>

    <!-- 驳回原因对话框 -->
    <el-dialog
      v-model="showRejectDialog"
      title="驳回工单"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef">
        <el-form-item label="驳回原因" prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回原因（必填）"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRejectDialog = false">取消</el-button>
        <el-button 
          type="danger" 
          :loading="rejecting"
          @click="handleReject"
        >
          确认驳回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkOrderDetail.vue
 * 
 * 工单详情页面组件
 * 
 * 功能说明:
 * - 展示工单完整信息
 * - 支持审批操作（批准/驳回）
 * - 展示审批历史时间线
 * 
 * 依赖服务:
 * - workOrderApi: 工单API调用
 * - approvalStore: 审批状态管理
 * 
 * 作者: SWARM-S5-001 Iteration 1
 * 版本: v1.0
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { workOrderApi } from '../api/workOrderApi'
import { useApprovalStore } from '@/stores/approvalStore'

// ==================== 类型定义 ====================

/** 工单详情响应结构 */
interface WorkOrderDetail {
  workOrderId: string
  workOrderNo: string
  assetName: string
  applicantName: string
  deptName: string
  description: string
  status: WorkOrderStatus
  createTime: string
  updateTime?: string
}

/** 工单状态枚举 */
enum WorkOrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVING = 'approving',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived'
}

/** 审批记录结构 */
interface ApprovalRecord {
  recordId: string
  workOrderId: string
  action: ApprovalAction
  approverId: string
  approverName: string
  comment?: string
  createTime: string
}

/** 审批操作枚举 */
enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  RETURN = 'return'
}

// ==================== Props & Emits ====================

interface Props {
  /** 工单ID - 从路由参数获取 */
  workOrderId?: string
}

const props = withDefaults(defineProps<Props>(), {
  workOrderId: ''
})

const emit = defineEmits<{
  /** 审批完成事件 */
  (e: 'approval-completed', data: { workOrderId: string; action: ApprovalAction }): void
  /** 状态变更事件 */
  (e: 'status-changed', data: { workOrderId: string; newStatus: WorkOrderStatus }): void
}>()

// ==================== 路由与状态 ====================

const route = useRoute()
const router = useRouter()
const approvalStore = useApprovalStore()

// ==================== 数据状态 ====================

/** 工单详情数据 */
const workOrder = ref<WorkOrderDetail | null>(null)

/** 审批历史记录列表 */
const approvalHistory = ref<ApprovalRecord[]>([])

/** 加载状态 */
const loading = ref(false)

/** 批准操作加载状态 */
const approving = ref(false)

/** 驳回操作加载状态 */
const rejecting = ref(false)

// ==================== 表单状态 ====================

/** 审批意见 */
const approvalComment = ref('')

/** 驳回对话框显示状态 */
const showRejectDialog = ref(false)

/** 驳回表单引用 */
const rejectFormRef = ref<FormInstance>()

/** 驳回表单数据 */
const rejectForm = ref({
  reason: ''
})

/** 驳回表单校验规则 */
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请输入驳回原因', trigger: 'blur' },
    { min: 2, max: 500, message: '驳回原因长度应在 2-500 个字符之间', trigger: 'blur' }
  ]
}

// ==================== 计算属性 ====================

/**
 * 获取当前工单ID
 * 优先级：props > route params > query
 */
const currentWorkOrderId = computed(() => {
  return props.workOrderId || 
         (route.params.id as string) || 
         (route.query.id as string) || ''
})

/**
 * 判断当前用户是否可以执行审批操作
 */
const canApprove = computed(() => {
  if (!workOrder.value) return false
  
  const currentUser = approvalStore.currentUser
  if (!currentUser) return false

  // 仅在审批中状态允许审批
  const approvableStatuses = [WorkOrderStatus.PENDING, WorkOrderStatus.APPROVING]
  if (!approvableStatuses.includes(workOrder.value.status)) {
    return false
  }

  // 检查用户是否有审批权限
  return approvalStore.hasApprovalPermission(workOrder.value.workOrderId)
})

/**
 * 状态标签类型映射
 */
const statusTagType = computed(() => {
  if (!workOrder.value) return 'info'
  
  const statusMap: Record<WorkOrderStatus, string> = {
    [WorkOrderStatus.DRAFT]: 'info',
    [WorkOrderStatus.PENDING]: 'warning',
    [WorkOrderStatus.APPROVING]: 'primary',
    [WorkOrderStatus.APPROVED]: 'success',
    [WorkOrderStatus.REJECTED]: 'danger',
    [WorkOrderStatus.ARCHIVED]: 'success'
  }
  
  return statusMap[workOrder.value.status] || 'info'
})

/**
 * 状态标签文本映射
 */
const statusLabel = computed(() => {
  if (!workOrder.value) return '-'
  
  const labelMap: Record<WorkOrderStatus, string> = {
    [WorkOrderStatus.DRAFT]: '草稿',
    [WorkOrderStatus.PENDING]: '待审批',
    [WorkOrderStatus.APPROVING]: '审批中',
    [WorkOrderStatus.APPROVED]: '已通过',
    [WorkOrderStatus.REJECTED]: '已驳回',
    [WorkOrderStatus.ARCHIVED]: '已归档'
  }
  
  return labelMap[workOrder.value.status] || '未知'
})

// ==================== 方法 ====================

/**
 * 加载工单详情数据
 * 
 * @returns {Promise<void>}
 */
async function loadWorkOrderDetail(): Promise<void> {
  if (!currentWorkOrderId.value) {
    ElMessage.warning('工单ID不能为空')
    return
  }

  loading.value = true
  
  try {
    const response = await workOrderApi.getWorkOrderDetail(currentWorkOrderId.value)
    
    if (response.code === 200 || response.code === 0) {
      workOrder.value = response.data
      
      // 加载审批历史
      await loadApprovalHistory()
    } else {
      ElMessage.error(response.message || '加载工单详情失败')
    }
  } catch (error) {
    console.error('加载工单详情失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

/**
 * 加载审批历史记录
 * 
 * @returns {Promise<void>}
 */
async function loadApprovalHistory(): Promise<void> {
  if (!currentWorkOrderId.value) return

  try {
    const response = await workOrderApi.getApprovalHistory(currentWorkOrderId.value)
    
    if (response.code === 200 || response.code === 0) {
      approvalHistory.value = response.data || []
    }
  } catch (error) {
    console.error('加载审批历史失败:', error)
  }
}

/**
 * 处理批准操作
 * 
 * @returns {Promise<void>}
 */
async function handleApprove(): Promise<void> {
  if (!workOrder.value) return

  try {
    await ElMessageBox.confirm(
      `确认批准工单 "${workOrder.value.workOrderNo}" 吗？`,
      '审批确认',
      {
        confirmButtonText: '确认批准',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
  } catch {
    // 用户取消操作
    return
  }

  approving.value = true

  try {
    const response = await workOrderApi.approveWorkOrder(currentWorkOrderId.value, {
      comment: approvalComment.value || undefined
    })

    if (response.code === 200 || response.code === 0) {
      ElMessage.success('审批通过成功')
      
      // 触发事件
      emit('approval-completed', {
        workOrderId: currentWorkOrderId.value,
        action: ApprovalAction.APPROVE
      })
      
      // 刷新数据
      await loadWorkOrderDetail()
    } else {
      ElMessage.error(response.message || '审批失败')
    }
  } catch (error) {
    console.error('审批操作失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    approving.value = false
  }
}

/**
 * 处理驳回操作
 * 
 * @returns {Promise<void>}
 */
async function handleReject(): Promise<void> {
  if (!rejectFormRef.value) return

  await rejectFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      await ElMessageBox.confirm(
        '确认驳回此工单吗？驳回后申请人可以修改后重新提交。',
        '驳回确认',
        {
          confirmButtonText: '确认驳回',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      // 用户取消操作
      return
    }

    rejecting.value = true

    try {
      const response = await workOrderApi.rejectWorkOrder(currentWorkOrderId.value, {
        reason: rejectForm.value.reason
      })

      if (response.code === 200 || response.code === 0) {
        ElMessage.success('工单已驳回')
        
        // 关闭对话框
        showRejectDialog.value = false
        rejectForm.value.reason = ''
        
        // 触发事件
        emit('approval-completed', {
          workOrderId: currentWorkOrderId.value,
          action: ApprovalAction.REJECT
        })
        
        // 刷新数据
        await loadWorkOrderDetail()
      } else {
        ElMessage.error(response.message || '驳回失败')
      }
    } catch (error) {
      console.error('驳回操作失败:', error)
      ElMessage.error('网络错误，请稍后重试')
    } finally {
      rejecting.value = false
    }
  })
}

/**
 * 格式化日期显示
 * 
 * @param {string | undefined} dateStr - ISO日期字符串
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

/**
 * 获取时间线项目类型
 * 
 * @param {ApprovalAction} action - 审批操作
 * @returns {string} Timeline item type
 */
function getTimelineItemType(action: ApprovalAction): string {
  const typeMap: Record<ApprovalAction, string> = {
    [ApprovalAction.SUBMIT]: 'primary',
    [ApprovalAction.APPROVE]: 'success',
    [ApprovalAction.REJECT]: 'danger',
    [ApprovalAction.RETURN]: 'warning'
  }
  return typeMap[action] || 'info'
}

/**
 * 获取操作标签类型
 * 
 * @param {ApprovalAction} action - 审批操作
 * @returns {string} Element Plus tag type
 */
function getActionTagType(action: ApprovalAction): string {
  const typeMap: Record<ApprovalAction, string> = {
    [ApprovalAction.SUBMIT]: '',
    [ApprovalAction.APPROVE]: 'success',
    [ApprovalAction.REJECT]: 'danger',
    [ApprovalAction.RETURN]: 'warning'
  }
  return typeMap[action] || 'info'
}

/**
 * 获取操作标签文本
 * 
 * @param {ApprovalAction} action - 审批操作
 * @returns {string} 操作标签文本
 */
function getActionLabel(action: ApprovalAction): string {
  const labelMap: Record<ApprovalAction, string> = {
    [ApprovalAction.SUBMIT]: '提交',
    [ApprovalAction.APPROVE]: '批准',
    [ApprovalAction.REJECT]: '驳回',
    [ApprovalAction.RETURN]: '退回'
  }
  return labelMap[action] || '未知'
}

// ==================== 生命周期 ====================

/**
 * 组件挂载时加载数据
 */
onMounted(async () => {
  await loadWorkOrderDetail()
})

/**
 * 监听工单ID变化，重新加载数据
 */
watch(() => currentWorkOrderId.value, async (newId) => {
  if (newId) {
    await loadWorkOrderDetail()
  }
})
</script>

<style scoped lang="scss">
.work-order-detail {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100%;
}

.detail-card {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.approval-panel {
  margin-top: 24px;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.approval-actions {
  .comment-input {
    margin-bottom: 16px;
  }
  
  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

.approval-history {
  margin-top: 24px;
  
  .history-card {
    .history-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      
      .approver-name {
        font-weight: 500;
        color: #303133;
      }
    }
    
    .history-comment {
      margin: 8px 0 0 0;
      color: #606266;
      font-size: 14px;
      line-height: 1.5;
    }
  }
}

:deep(.el-timeline-item__node) {
  background-color: var(--el-color-primary);
}

:deep(.el-timeline-item__wrapper) {
  padding-left: 20px;
}
</style>