<template>
  <div class="approval-pending-page">
    <header class="page-header">
      <h1 class="page-title">审批待办</h1>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索资产名称/编号"
          class="search-input"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :loading="refreshLoading" @click="refreshTasks">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </header>

    <div class="filter-bar">
      <el-select v-model="filterType" placeholder="审批类型" clearable @change="handleFilterChange">
        <el-option label="全部" value="" />
        <el-option label="报废申请" value="retirement" />
        <el-option label="工单申请" value="workorder" />
        <el-option label="资产转移" value="transfer" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable @change="handleFilterChange">
        <el-option label="全部" value="" />
        <el-option label="待审批" value="pending" />
        <el-option label="审批中" value="processing" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        @change="handleDateRangeChange"
      />
    </div>

    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="error" class="error-container">
      <el-result
        icon="error"
        title="加载失败"
        :sub-title="errorMessage"
      >
        <template #extra>
          <el-button type="primary" @click="refreshTasks">重试</el-button>
        </template>
      </el-result>
    </div>

    <div v-else-if="pendingTasks.length === 0" class="empty-container">
      <el-empty description="暂无待审批任务">
        <el-button type="primary" @click="refreshTasks">刷新列表</el-button>
      </el-empty>
    </div>

    <div v-else class="task-list">
      <TransitionGroup name="task-list">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="task-card"
          :class="{ 'is-urgent': task.priority === 'urgent' }"
        >
          <div class="task-header">
            <div class="task-type">
              <el-tag :type="getTypeTagColor(task.type)" size="small">
                {{ getTypeLabel(task.type) }}
              </el-tag>
              <span v-if="task.priority === 'urgent'" class="urgent-badge">紧急</span>
            </div>
            <div class="task-level">
              <span class="level-label">第 {{ task.currentLevel }}/{{ task.totalLevels }} 级审批</span>
              <el-progress
                :percentage="(task.currentLevel / task.totalLevels) * 100"
                :show-text="false"
                :stroke-width="4"
                :width="60"
                type="circle"
              />
            </div>
          </div>

          <div class="task-body">
            <h3 class="task-title">{{ task.assetName || task.title }}</h3>
            <div class="task-info">
              <div class="info-item">
                <span class="label">资产编号：</span>
                <span class="value">{{ task.assetCode || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">申请人：</span>
                <span class="value">{{ task.applicantName }}</span>
              </div>
              <div class="info-item">
                <span class="label">申请时间：</span>
                <span class="value">{{ formatDate(task.applyTime) }}</span>
              </div>
              <div class="info-item">
                <span class="label">待处理：</span>
                <span class="value" :class="{ 'overdue': isOverdue(task) }">
                  {{ getTimeRemaining(task) }}
                </span>
              </div>
            </div>
            <div v-if="task.reason" class="task-reason">
              <span class="reason-label">申请理由：</span>
              <p class="reason-content">{{ task.reason }}</p>
            </div>
          </div>

          <div class="task-footer">
            <div class="action-buttons">
              <el-button
                type="success"
                size="default"
                :loading="task.approving"
                :disabled="task.processing"
                @click="handleApprove(task)"
              >
                <el-icon><Check /></el-icon>
                通过
              </el-button>
              <el-button
                type="danger"
                size="default"
                :loading="task.rejecting"
                :disabled="task.processing"
                @click="handleReject(task)"
              >
                <el-icon><Close /></el-icon>
                驳回
              </el-button>
              <el-dropdown trigger="click" @command="handleMoreAction($event, task)">
                <el-button size="default">
                  更多
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="transfer">转交</el-dropdown-item>
                    <el-dropdown-item command="delegate">委托</el-dropdown-item>
                    <el-dropdown-item command="history">查看历史</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="task-meta">
              <el-tooltip content="查看资产详情">
                <el-button link @click="goToAssetDetail(task)">
                  <el-icon><Document /></el-icon>
                  资产详情
                </el-button>
              </el-tooltip>
            </div>
          </div>

          <!-- 审批链可视化 -->
          <div class="approval-chain">
            <div class="chain-header">审批流程</div>
            <div class="chain-nodes">
              <div
                v-for="(node, index) in task.approvalChain"
                :key="index"
                class="chain-node"
                :class="{
                  'is-approved': node.status === 'approved',
                  'is-rejected': node.status === 'rejected',
                  'is-current': node.status === 'pending' && index + 1 === task.currentLevel,
                  'is-waiting': node.status === 'pending' && index + 1 > task.currentLevel
                }"
              >
                <div class="node-icon">
                  <el-icon v-if="node.status === 'approved'"><Check /></el-icon>
                  <el-icon v-else-if="node.status === 'rejected'"><Close /></el-icon>
                  <el-icon v-else-if="index + 1 === task.currentLevel"><User /></el-icon>
                  <el-icon v-else><Clock /></el-icon>
                </div>
                <div class="node-info">
                  <span class="node-name">{{ node.approverName }}</span>
                  <span class="node-time">{{ node.approvedAt ? formatDate(node.approvedAt) : '待审批' }}</span>
                </div>
                <div v-if="index < task.approvalChain.length - 1" class="node-arrow">
                  <el-icon><Right /></el-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="totalCount"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 驳回对话框 -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="驳回申请"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="rejectFormRef" :model="rejectForm" :rules="rejectRules" label-width="100px">
        <el-form-item label="驳回原因" prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回原因（必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="驳回类型" prop="type">
          <el-radio-group v-model="rejectForm.type">
            <el-radio label="revision">退回修改</el-radio>
            <el-radio label="reject">直接拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="rejectDialogVisible = false">取消</el-button>
          <el-button type="danger" :loading="rejectSubmitting" @click="submitReject">
            确认驳回
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 转交对话框 -->
    <el-dialog
      v-model="transferDialogVisible"
      title="转交审批"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="transferFormRef" :model="transferForm" :rules="transferRules" label-width="100px">
        <el-form-item label="转交给" prop="targetUserId">
          <el-select
            v-model="transferForm.targetUserId"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="搜索用户"
            style="width: 100%"
          >
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
            >
              <span>{{ user.name }}</span>
              <span class="user-dept">{{ user.department }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="转交原因" prop="reason">
          <el-input
            v-model="transferForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入转交原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="transferDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="transferSubmitting" @click="submitTransfer">
            确认转交
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog
      v-model="historyDialogVisible"
      title="审批历史"
      width="700px"
    >
      <div class="history-timeline">
        <el-timeline>
          <el-timeline-item
            v-for="(event, index) in historyEvents"
            :key="index"
            :timestamp="formatDate(event.timestamp)"
            :type="getHistoryType(event.action)"
            :hollow="event.action === 'apply'"
          >
            <div class="history-item">
              <h4>{{ getActionLabel(event.action) }}</h4>
              <p v-if="event.actor">操作人：{{ event.actor }}</p>
              <p v-if="event.comment">备注：{{ event.comment }}</p>
              <p v-if="event.assets">涉及资产：{{ event.assets }}</p>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>

    <!-- 生命周期时间轴对话框 -->
    <el-dialog
      v-model="lifecycleDialogVisible"
      title="资产生命周期"
      width="800px"
    >
      <div class="lifecycle-timeline">
        <el-timeline>
          <el-timeline-item
            v-for="(event, index) in lifecycleEvents"
            :key="index"
            :timestamp="formatDate(event.timestamp)"
            :type="getLifecycleType(event.status)"
            :hollow="event.type === 'purchase'"
          >
            <div class="lifecycle-item">
              <h4>{{ event.event }}</h4>
              <p v-if="event.operator">操作人：{{ event.operator }}</p>
              <p v-if="event.description">{{ event.description }}</p>
              <el-tag
                v-if="event.status"
                :type="getStatusTagType(event.status)"
                size="small"
              >
                {{ event.status }}
              </el-tag>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>

    <!-- 操作结果提示 -->
    <el-dialog
      v-model="resultDialogVisible"
      :title="resultDialogType === 'success' ? '操作成功' : '操作失败'"
      width="400px"
      center
    >
      <div class="result-content">
        <el-icon v-if="resultDialogType === 'success'" size="60" color="#67c23a">
          <CircleCheckFilled />
        </el-icon>
        <el-icon v-else size="60" color="#f56c6c">
          <CircleCloseFilled />
        </el-icon>
        <p class="result-message">{{ resultMessage }}</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="resultDialogVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalPending.vue - 审批待办页面组件
 * 
 * 功能说明：
 * - 展示当前用户待审批的任务列表
 * - 支持审批操作（通过/驳回/转交）
 * - 显示审批链可视化与状态流转
 * - 集成资产生命周期历史查询
 * 
 * 对应 SPEC：
 * - SWARM-2026-Q2-002: 资产报废退役流程与审批链集成
 * - Phase 4: 审批链执行与历史追溯
 * 
 * @version 1.0.0
 * @since 2026-04-20
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import {
  Search,
  Refresh,
  Check,
  Close,
  ArrowDown,
  Document,
  Right,
  Clock,
  User,
  CircleCheckFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue'
import { useApprovalStore } from '@/store/approvalStore'
import { approvalService } from '@/services/approvalService'
import type { ApprovalTask, ApprovalChainNode, HistoryEvent, LifecycleEvent } from '@/types/approval'

// Router
const router = useRouter()
const approvalStore = useApprovalStore()

// 状态定义
const loading = ref(false)
const refreshLoading = ref(false)
const error = ref(false)
const errorMessage = ref('')
const pendingTasks = ref<ApprovalTask[]>([])

// 筛选与搜索
const searchKeyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const dateRange = ref<[Date, Date] | null>(null)

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)

// 驳回对话框
const rejectDialogVisible = ref(false)
const rejectFormRef = ref<FormInstance>()
const rejectSubmitting = ref(false)
const currentRejectTask = ref<ApprovalTask | null>(null)
const rejectForm = ref({
  reason: '',
  type: 'revision'
})
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请输入驳回原因', trigger: 'blur' },
    { min: 5, max: 500, message: '原因长度在 5 到 500 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择驳回类型', trigger: 'change' }
  ]
}

// 转交对话框
const transferDialogVisible = ref(false)
const transferFormRef = ref<FormInstance>()
const transferSubmitting = ref(false)
const currentTransferTask = ref<ApprovalTask | null>(null)
const transferForm = ref({
  targetUserId: '',
  reason: ''
})
const transferRules: FormRules = {
  targetUserId: [
    { required: true, message: '请选择转交对象', trigger: 'change' }
  ]
}
const userList = ref<Array<{ id: string; name: string; department: string }>>([])

// 历史记录对话框
const historyDialogVisible = ref(false)
const historyEvents = ref<HistoryEvent[]>([])

// 生命周期对话框
const lifecycleDialogVisible = ref(false)
const lifecycleEvents = ref<LifecycleEvent[]>([])

// 结果对话框
const resultDialogVisible = ref(false)
const resultDialogType = ref<'success' | 'error'>('success')
const resultMessage = ref('')

// 计算属性
const filteredTasks = computed(() => {
  let tasks = pendingTasks.value
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    tasks = tasks.filter(task => 
      task.assetName?.toLowerCase().includes(keyword) ||
      task.assetCode?.toLowerCase().includes(keyword) ||
      task.title?.toLowerCase().includes(keyword)
    )
  }
  
  if (filterType.value) {
    tasks = tasks.filter(task => task.type === filterType.value)
  }
  
  if (filterStatus.value) {
    tasks = tasks.filter(task => task.status === filterStatus.value)
  }
  
  if (dateRange.value) {
    const [start, end] = dateRange.value
    tasks = tasks.filter(task => {
      const applyTime = new Date(task.applyTime)
      return applyTime >= start && applyTime <= end
    })
  }
  
  return tasks
})

// 方法定义

/**

 * 刷新待审批任务列表
 * @description 从后端拉取最新的审批任务数据
 */
const refreshTasks = async () => {
  refreshLoading.value = true
  try {
    const response = await approvalStore.fetchPendingApprovals()
    pendingTasks.value = response.data || []
    totalCount.value = response.total || pendingTasks.value.length
    error.value = false
    ElMessage.success('刷新成功')
  } catch (err) {
    error.value = true
    errorMessage.value = '加载审批任务失败，请稍后重试'
    ElMessage.error('刷新失败')
  } finally {
    refreshLoading.value = false
  }
}

/**
 * 加载审批任务列表
 * @description 分页加载待审批任务
 */
const loadTasks = async () => {
  loading.value = true
  error.value = false
  
  try {
    const response = await approvalService.getPendingApprovals({
      page: currentPage.value,
      pageSize: pageSize.value,
      type: filterType.value || undefined,
      keyword: searchKeyword.value || undefined
    })
    
    pendingTasks.value = response.items || []
    totalCount.value = response.total || 0
  } catch (err) {
    error.value = true
    errorMessage.value = '加载审批任务失败，请稍后重试'
    console.error('Failed to load approval tasks:', err)
  } finally {
    loading.value = false
  }
}

/**
 * 处理搜索
 * @description 根据关键字搜索审批任务
 */
const handleSearch = () => {
  currentPage.value = 1
  loadTasks()
}

/**
 * 处理筛选变化
 * @description 根据筛选条件重新加载数据
 */
const handleFilterChange = () => {
  currentPage.value = 1
  loadTasks()
}

/**
 * 处理日期范围变化
 * @description 根据日期范围筛选审批任务
 */
const handleDateRangeChange = () => {
  currentPage.value = 1
  loadTasks()
}

/**
 * 处理分页大小变化
 * @param size 新的分页大小
 */
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  loadTasks()
}

/**
 * 处理页码变化
 * @param page 新的页码
 */
const handlePageChange = (page: number) => {
  currentPage.value = page
  loadTasks()
}

/**
 * 处理审批通过
 * @param task 审批任务对象
 */
const handleApprove = async (task: ApprovalTask) => {
  try {
    await ElMessageBox.confirm(
      `确认通过「${task.assetName || task.title}」的申请？`,
      '审批确认',
      {
        confirmButtonText: '确认通过',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    
    task.approving = true
    
    await approvalService.approve({
      taskId: task.id,
      comment: '',
      decision: 'approve'
    })
    
    ElMessage.success('审批通过操作已提交')
    await refreshTasks()
    
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('审批操作失败')
      console.error('Approval failed:', err)
    }
  } finally {
    task.approving = false
  }
}

/**
 * 处理审批驳回
 * @param task 审批任务对象
 */
const handleReject = async (task: ApprovalTask) => {
  currentRejectTask.value = task
  rejectForm.value = {
    reason: '',
    type: 'revision'
  }
  rejectDialogVisible.value = true
}

/**
 * 提交驳回
 * @description 验证并提交驳回操作
 */
const submitReject = async () => {
  if (!rejectFormRef.value) return
  
  try {
    await rejectFormRef.value.validate()
    
    rejectSubmitting.value = true
    
    await approvalService.reject({
      taskId: currentRejectTask.value!.id,
      reason: rejectForm.value.reason,
      type: rejectForm.value.type as 'revision' | 'reject'
    })
    
    ElMessage.success('驳回操作已提交')
    rejectDialogVisible.value = false
    await refreshTasks()
    
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('驳回操作失败')
      console.error('Reject failed:', err)
    }
  } finally {
    rejectSubmitting.value = false
  }
}

/**
 * 处理更多操作
 * @param command 操作命令
 * @param task 审批任务对象
 */
const handleMoreAction = async (command: string, task: ApprovalTask) => {
  switch (command) {
    case 'transfer':
      currentTransferTask.value = task
      transferForm.value = {
        targetUserId: '',
        reason: ''
      }
      transferDialogVisible.value = true
      break
      
    case 'delegate':
      await handleDelegate(task)
      break
      
    case 'history':
      await loadHistory(task)
      break
  }
}

/**
 * 处理转交审批
 * @param task 审批任务对象
 */
const handleDelegate = async (task: ApprovalTask) => {
  try {
    await ElMessageBox.confirm(
      '确定要转交此审批任务吗？',
      '转交确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    ElMessage.info('请在弹出的对话框中选择转交对象')
    
  } catch (err) {
    console.log('Delegate cancelled')
  }
}

/**
 * 搜索用户
 * @param query 搜索关键字
 */
const searchUsers = async (query: string) => {
  if (!query) {
    userList.value = []
    return
  }
  
  try {
    const users = await approvalService.searchUsers(query)
    userList.value = users
  } catch (err) {
    console.error('Failed to search users:', err)
  }
}

/**
 * 提交转交
 * @description 验证并提交转交操作
 */
const submitTransfer = async () => {
  if (!transferFormRef.value) return
  
  try {
    await transferFormRef.value.validate()
    
    transferSubmitting.value = true
    
    await approvalService.transfer({
      taskId: currentTransferTask.value!.id,
      targetUserId: transferForm.value.targetUserId,
      reason: transferForm.value.reason
    })
    
    ElMessage.success('转交成功')
    transferDialogVisible.value = false
    await refreshTasks()
    
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('转交失败')
      console.error('Transfer failed:', err)
    }
  } finally {
    transferSubmitting.value = false
  }
}

/**
 * 加载历史记录
 * @param task 审批任务对象
 */
const loadHistory = async (task: ApprovalTask) => {
  try {
    const history = await approvalService.getApprovalHistory(task.id)
    historyEvents.value = history
    historyDialogVisible.value = true
  } catch (err) {
    ElMessage.error('加载历史记录失败')
    console.error('Failed to load history:', err)
  }
}

/**
 * 跳转到资产详情页
 * @param task 审批任务对象
 */
const goToAssetDetail = async (task: ApprovalTask) => {
  if (task.assetId) {
    // 加载资产生命周期
    try {
      const lifecycle = await approvalService.getAssetLifecycle(task.assetId)
      lifecycleEvents.value = lifecycle
      lifecycleDialogVisible.value = true
    } catch (err) {
      // 如果生命周期接口不可用，直接跳转
      router.push(`/assets/${task.assetId}`)
    }
  } else {
    ElMessage.warning('资产ID不存在')
  }
}

// 辅助方法

/**
 * 获取类型标签颜色
 * @param type 任务类型
 * @returns 颜色类型
 */
const getTypeTagColor = (type: string): '' | 'success' | 'warning' | 'danger' | 'info' => {
  const colorMap: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    retirement: 'danger',
    workorder: 'warning',
    transfer: 'success'
  }
  return colorMap[type] || 'info'
}

/**
 * 获取类型标签文本
 * @param type 任务类型
 * @returns 类型标签文本
 */
const getTypeLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
    retirement: '报废申请',
    workorder: '工单申请',
    transfer: '资产转移'
  }
  return labelMap[type] || '其他'
}

/**
 * 格式化日期
 * @param dateStr 日期字符串
 * @returns 格式化后的日期
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 计算剩余时间
 * @param task 审批任务对象
 * @returns 剩余时间文本
 */
const getTimeRemaining = (task: ApprovalTask): string => {
  if (!task.deadline) return '无期限'
  
  const deadline = new Date(task.deadline)
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  
  if (diff < 0) {
    const absDiff = Math.abs(diff)
    const hours = Math.floor(absDiff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    return `已逾期 ${days > 0 ? `${days}天` : `${hours}小时`}`
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天`
  if (hours > 0) return `${hours}小时`
  return '即将到期'
}

/**
 * 判断是否已逾期
 * @param task 审批任务对象
 * @returns 是否逾期
 */
const isOverdue = (task: ApprovalTask): boolean => {
  if (!task.deadline) return false
  return new Date(task.deadline) < new Date()
}

/**
 * 获取历史操作类型对应的颜色
 * @param action 操作类型
 * @returns Element Plus 图标类型
 */
const getHistoryType = (action: string): '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' => {
  const typeMap: Record<string, '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
    apply: 'info',
    approve: 'success',
    reject: 'danger',
    transfer: 'warning',
    modify: 'primary'
  }
  return typeMap[action] || 'info'
}

/**
 * 获取历史操作标签文本
 * @param action 操作类型
 * @returns 操作标签文本
 */
const getActionLabel = (action: string): string => {
  const labelMap: Record<string, string> = {
    apply: '提交申请',
    approve: '审批通过',
    reject: '审批驳回',
    transfer: '任务转交',
    modify: '修改申请'
  }
  return labelMap[action] || action
}

/**
 * 获取生命周期状态对应的颜色
 * @param status 状态
 * @returns Element Plus 图标类型
 */
const getLifecycleType = (status: string): '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' => {
  const typeMap: Record<string, '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
    采购入库: 'success',
    领用: 'primary',
    维修: 'warning',
    报废申请: 'danger',
    已报废: 'gray',
    已退役: 'gray'
  }
  return typeMap[status] || 'info'
}

/**
 * 获取状态标签类型
 * @param status 状态
 * @returns Element Plus 标签类型
 */
const getStatusTagType = (status: string): '' | 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    可用: 'success',
    维修中: 'warning',
    审批中: 'warning',
    已报废: 'danger',
    已退役: 'info'
  }
  return typeMap[status] || 'info'
}

// 生命周期钩子

onMounted(() => {
  loadTasks()
  
  // 定时刷新
  const refreshInterval = setInterval(() => {
    if (!loading.value && !rejectDialogVisible.value && !transferDialogVisible.value) {
      refreshTasks()
    }
  }, 60000) // 每分钟刷新一次
  
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})

// 暴露给父组件
defineExpose({
  refreshTasks
})
</script>

<style scoped>
.approval-pending-page {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 280px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.loading-container,
.error-container,
.empty-container {
  background-color: #fff;
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.task-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.task-card.is-urgent {
  border-left: 4px solid #f56c6c;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.task-type {
  display: flex;
  align-items: center;
  gap: 8px;
}

.urgent-badge {
  background-color: #f56c6c;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.task-level {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-label {
  font-size: 14px;
  color: #909399;
}

.task-body {
  margin-bottom: 16px;
}

.task-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.task-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.info-item {
  display: flex;
  align-items: center;
}

.info-item .label {
  color: #909399;
  font-size: 14px;
  min-width: 80px;
}

.info-item .value {
  color: #303133;
  font-size: 14px;
}

.info-item .value.overdue {
  color: #f56c6c;
  font-weight: 500;
}

.task-reason {
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-top: 12px;
}

.reason-label {
  font-size: 14px;
  color: #909399;
}

.reason-content {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.task-meta {
  display: flex;
  gap: 8px;
}

.approval-chain {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.chain-header {
  font-size: 14px;
  color: #909399;
  margin-bottom: 12px;
}

.chain-nodes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chain-node {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #f5f7fa;
  position: relative;
}

.chain-node.is-approved {
  background-color: #f0f9eb;
  color: #67c23a;
}

.chain-node.is-rejected {
  background-color: #fef0f0;
  color: #f56c6c;
}

.chain-node.is-current {
  background-color: #ecf5ff;
  color: #409eff;
  border: 1px solid #409eff;
}

.chain-node.is-waiting {
  color: #c0c4cc;
}

.node-icon {
  margin-right: 8px;
}

.node-info {
  display: flex;
  flex-direction: column;
}

.node-name {
  font-size: 14px;
  font-weight: 500;
}

.node-time {
  font-size: 12px;
  color: #909399;
}

.node-arrow {
  position: absolute;
  right: -20px;
  color: #c0c4cc;
}

.pagination-container {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.result-content {
  text-align: center;
  padding: 24px 0;
}

.result-message {
  margin-top: 16px;
  font-size: 16px;
  color: #606266;
}

.history-timeline,
.lifecycle-timeline {
  max-height: 500px;
  overflow-y: auto;
}

.history-item h4,
.lifecycle-item h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.history-item p,
.lifecycle-item p {
  margin: 4px 0;
  font-size: 14px;
  color: #606266;
}

.user-dept {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

/* 列表过渡动画 */
.task-list-enter-active,
.task-list-leave-active {
  transition: all 0.5s ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.task-list-move {
  transition: transform 0.5s ease;
}
</style>