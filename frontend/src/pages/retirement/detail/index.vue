<template>
  <div class="retirement-detail-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">资产报废详情</h1>
      <div class="header-actions">
        <el-button @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 详情内容 -->
    <div v-else-if="retirementDetail" class="detail-content">
      <!-- 基本信息卡片 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>报废申请信息</span>
            <el-tag :type="statusType">{{ statusLabel }}</el-tag>
          </div>
        </template>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="报废单号">
            {{ retirementDetail.retirement_id }}
          </el-descriptions-item>
          <el-descriptions-item label="申请日期">
            {{ formatDate(retirementDetail.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="资产编号">
            {{ retirementDetail.asset_id }}
          </el-descriptions-item>
          <el-descriptions-item label="资产名称">
            {{ retirementDetail.asset_name }}
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ retirementDetail.applicant_name }}
          </el-descriptions-item>
          <el-descriptions-item label="所属部门">
            {{ retirementDetail.department }}
          </el-descriptions-item>
          <el-descriptions-item label="报废原因" :span="2">
            {{ retirementDetail.reason }}
          </el-descriptions-item>
          <el-descriptions-item label="残值预估">
            ¥{{ retirementDetail.residual_value.toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="详细说明" :span="2">
            {{ retirementDetail.description || '无' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 审批流程时间线 -->
      <el-card class="timeline-card">
        <template #header>
          <div class="card-header">
            <span>审批流程</span>
          </div>
        </template>
        
        <el-timeline>
          <el-timeline-item
            v-for="(step, index) in approvalSteps"
            :key="index"
            :type="step.iconType"
            :hollow="step.hollow"
            :timestamp="formatDate(step.action_at)"
            :color="step.color"
          >
            <div class="timeline-content">
              <h4>{{ step.title }}</h4>
              <p>{{ step.description }}</p>
              <div v-if="step.approver" class="approver-info">
                <el-icon><User /></el-icon>
                {{ step.approver }}
              </div>
              <div v-if="step.comment" class="comment-info">
                <el-icon><Comment /></el-icon>
                {{ step.comment }}
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </el-card>

      <!-- 历史记录卡片 -->
      <el-card class="history-card">
        <template #header>
          <div class="card-header">
            <span>报废历史记录</span>
            <el-button type="primary" link @click="loadHistory">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </template>
        
        <el-table :data="historyRecords" stripe>
          <el-table-column prop="retirement_id" label="报废单号" width="180" />
          <el-table-column prop="asset_id" label="资产编号" width="120" />
          <el-table-column prop="reason" label="报废原因" min-width="150" />
          <el-table-column prop="residual_value" label="残值" width="100">
            <template #default="{ row }">
              ¥{{ row.residual_value?.toFixed(2) || '0.00' }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="申请时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="viewDetail(row)">
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pagination.currentPage"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>

      <!-- 操作区域 -->
      <div v-if="showActions" class="action-area">
        <el-space>
          <el-button
            v-if="canSubmit"
            type="primary"
            @click="handleSubmit"
          >
            提交审批
          </el-button>
          <el-button
            v-if="canApprove"
            type="success"
            @click="handleApprove"
          >
            审批通过
          </el-button>
          <el-button
            v-if="canReject"
            type="danger"
            @click="handleReject"
          >
            审批驳回
          </el-button>
          <el-button @click="handleCancel">
            取消
          </el-button>
        </el-space>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-else description="未找到报废记录" />

    <!-- 审批对话框 -->
    <el-dialog
      v-model="approvalDialogVisible"
      :title="approvalDialogTitle"
      width="500px"
    >
      <el-form ref="approvalFormRef" :model="approvalForm" label-width="80px">
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入审批意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmApproval">确认</el-button>
      </template>
    </el-dialog>

    <!-- 驳回对话框 -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="审批驳回"
      width="500px"
    >
      <el-form ref="rejectFormRef" :model="rejectForm" label-width="80px">
        <el-form-item label="驳回原因" prop="comment" :rules="[{ required: true, message: '请输入驳回原因', trigger: 'blur' }]">
          <el-input
            v-model="rejectForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 资产报废详情页组件
 * 
 * 功能说明：
 * - 展示报废申请详细信息
 * - 显示审批流程时间线
 * - 提供报废历史记录查询
 * - 支持审批操作（提交、通过、驳回）
 * 
 * @author SWARM-WO-002 Team
 * @version 1.0.0
 */
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Loading,
  User,
  Comment,
  Refresh
} from '@element-plus/icons-vue'

// 导入类型定义
import type {
  RetirementDetail,
  ApprovalStep,
  RetirementHistoryRecord,
  ApprovalAction
} from '../types/retirement.types'

// 导入 API 服务
import {
  getRetirementDetail,
  getRetirementHistory,
  submitRetirement,
  approveRetirement,
  rejectRetirement
} from '@/api/retirementApi'

/**
 * 路由和状态管理
 */
const route = useRoute()
const router = useRouter()

/**
 * 状态定义
 */
const loading = ref(false)
const retirementDetail = ref<RetirementDetail | null>(null)
const approvalSteps = ref<ApprovalStep[]>([])
const historyRecords = ref<RetirementHistoryRecord[]>([])
const approvalDialogVisible = ref(false)
const rejectDialogVisible = ref(false)

/**
 * 审批表单数据
 */
const approvalFormRef = ref()
const rejectFormRef = ref()
const approvalForm = reactive({
  comment: ''
})
const rejectForm = reactive({
  comment: ''
})

/**
 * 分页配置
 */
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

/**
 * 计算属性：审批对话框标题
 */
const approvalDialogTitle = computed(() => {
  return '审批通过'
})

/**
 * 计算属性：当前状态对应的标签类型
 */
const statusType = computed(() => {
  if (!retirementDetail.value) return 'info'
  const statusMap: Record<string, string> = {
    DRAFT: 'info',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ARCHIVED: 'info'
  }
  return statusMap[retirementDetail.value.status] || 'info'
})

/**
 * 计算属性：状态标签文本
 */
const statusLabel = computed(() => {
  if (!retirementDetail.value) return ''
  return getStatusLabel(retirementDetail.value.status)
})

/**
 * 计算属性：是否显示操作按钮区域
 */
const showActions = computed(() => {
  if (!retirementDetail.value) return false
  return ['DRAFT', 'PENDING_APPROVAL'].includes(retirementDetail.value.status)
})

/**
 * 计算属性：是否可以提交审批
 */
const canSubmit = computed(() => {
  return retirementDetail.value?.status === 'DRAFT'
})

/**
 * 计算属性：是否可以审批通过
 */
const canApprove = computed(() => {
  return retirementDetail.value?.status === 'PENDING_APPROVAL'
})

/**
 * 计算属性：是否可以审批驳回
 */
const canReject = computed(() => {
  return retirementDetail.value?.status === 'PENDING_APPROVAL'
})

/**
 * 获取状态标签文本
 * 
 * @param status - 状态码
 * @returns 状态标签文本
 */
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: '草稿',
    PENDING_APPROVAL: '待审批',
    APPROVED: '已批准',
    REJECTED: '已驳回',
    ARCHIVED: '已归档'
  }
  return statusMap[status] || status
}

/**
 * 获取状态标签颜色
 * 
 * @param status - 状态码
 * @returns Element Plus 标签类型
 */
function getStatusTagType(status: string): string {
  const typeMap: Record<string, string> = {
    DRAFT: 'info',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ARCHIVED: 'info'
  }
  return typeMap[status] || 'info'
}

/**
 * 格式化日期
 * 
 * @param date - 日期字符串或 Date 对象
 * @returns 格式化的日期字符串
 */
function formatDate(date: string | Date | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 加载报废详情
 * 
 * @description 获取报废单详细信息并构建审批时间线
 */
async function loadDetail(): Promise<void> {
  const retirementId = route.params.id as string
  if (!retirementId) {
    ElMessage.error('缺少报废单ID')
    return
  }

  loading.value = true
  try {
    const data = await getRetirementDetail(retirementId)
    retirementDetail.value = data
    buildApprovalSteps(data)
  } catch (error) {
    console.error('加载报废详情失败:', error)
    ElMessage.error('加载报废详情失败')
  } finally {
    loading.value = false
  }
}

/**
 * 构建审批时间线
 * 
 * @param data - 报废详情数据
 */
function buildApprovalSteps(data: RetirementDetail): void {
  const steps: ApprovalStep[] = []

  // 添加申请步骤
  steps.push({
    title: '提交申请',
    description: '资产管理员提交报废申请',
    action_at: data.created_at,
    iconType: 'primary',
    hollow: false,
    color: '#409EFF'
  })

  // 如果有审批记录，添加审批步骤
  if (data.approval_records && data.approval_records.length > 0) {
    data.approval_records.forEach((record, index) => {
      const isApproved = record.action === 'APPROVE'
      steps.push({
        title: isApproved ? '审批通过' : '审批驳回',
        description: isApproved ? '审批人审核通过' : '审批人驳回申请',
        approver: record.approver_name,
        comment: record.comment,
        action_at: record.action_at,
        iconType: isApproved ? 'success' : 'danger',
        hollow: false,
        color: isApproved ? '#67C23A' : '#F56C6C'
      })
    })
  } else if (data.status === 'PENDING_APPROVAL') {
    // 待审批状态
    steps.push({
      title: '待审批',
      description: '等待审批人处理',
      action_at: undefined,
      iconType: 'warning',
      hollow: true,
      color: '#E6A23C'
    })
  }

  // 添加归档步骤（如果已批准）
  if (data.status === 'APPROVED' || data.status === 'ARCHIVED') {
    steps.push({
      title: '已完成',
      description: '报废流程已完成',
      action_at: data.approved_at,
      iconType: 'success',
      hollow: false,
      color: '#67C23A'
    })
  }

  approvalSteps.value = steps
}

/**
 * 加载报废历史记录
 * 
 * @description 分页查询报废历史记录
 */
async function loadHistory(): Promise<void> {
  try {
    const params = {
      page: pagination.currentPage,
      page_size: pagination.pageSize,
      asset_id: retirementDetail.value?.asset_id
    }
    const response = await getRetirementHistory(params)
    historyRecords.value = response.records
    pagination.total = response.total
  } catch (error) {
    console.error('加载历史记录失败:', error)
    ElMessage.error('加载历史记录失败')
  }
}

/**
 * 跳页处理
 * 
 * @param page - 目标页码
 */
function handleCurrentChange(page: number): void {
  pagination.currentPage = page
  loadHistory()
}

/**
 * 每页条数变更处理
 * 
 * @param size - 新的每页条数
 */
function handleSizeChange(size: number): void {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadHistory()
}

/**
 * 返回列表页
 */
function handleBack(): void {
  router.push('/asset/retirement/list')
}

/**
 * 查看详情
 * 
 * @param row - 历史记录行数据
 */
function viewDetail(row: RetirementHistoryRecord): void {
  router.push(`/asset/retirement/detail/${row.retirement_id}`)
}

/**
 * 提交审批
 * 
 * @description 将草稿状态的报废申请提交审批
 */
async function handleSubmit(): Promise<void> {
  if (!retirementDetail.value) return

  try {
    await ElMessageBox.confirm(
      '确定要提交此报废申请进行审批吗？',
      '提交确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await submitRetirement(retirementDetail.value.retirement_id)
    ElMessage.success('提交成功')
    loadDetail()
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'cancel') {
      console.error('提交失败:', error)
      ElMessage.error('提交失败')
    }
  }
}

/**
 * 审批通过
 * 
 * @description 打开审批通过对话框
 */
function handleApprove(): void {
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

/**
 * 确认审批通过
 * 
 * @description 执行审批通过操作
 */
async function confirmApproval(): Promise<void> {
  if (!retirementDetail.value) return

  try {
    const action: ApprovalAction = {
      retirement_id: retirementDetail.value.retirement_id,
      action: 'APPROVE',
      comment: approvalForm.comment
    }
    await approveRetirement(action)
    ElMessage.success('审批通过')
    approvalDialogVisible.value = false
    loadDetail()
  } catch (error) {
    console.error('审批失败:', error)
    ElMessage.error('审批失败')
  }
}

/**
 * 审批驳回
 * 
 * @description 打开驳回对话框
 */
function handleReject(): void {
  rejectForm.comment = ''
  rejectDialogVisible.value = true
}

/**
 * 确认驳回
 * 
 * @description 执行审批驳回操作
 */
async function confirmReject(): Promise<void> {
  if (!retirementDetail.value) return

  if (!rejectForm.comment.trim()) {
    ElMessage.error('请输入驳回原因')
    return
  }

  try {
    const action: ApprovalAction = {
      retirement_id: retirementDetail.value.retirement_id,
      action: 'REJECT',
      comment: rejectForm.comment
    }
    await rejectRetirement(action)
    ElMessage.success('已驳回')
    rejectDialogVisible.value = false
    loadDetail()
  } catch (error) {
    console.error('驳回失败:', error)
    ElMessage.error('驳回失败')
  }
}

/**
 * 取消操作
 */
function handleCancel(): void {
  handleBack()
}

/**
 * 组件挂载时加载数据
 */
onMounted(() => {
  loadDetail()
  loadHistory()
})
</script>

<style scoped>
.retirement-detail-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.loading-container .el-icon {
  font-size: 32px;
  margin-bottom: 16px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card,
.timeline-card,
.history-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.timeline-content {
  padding: 4px 0;
}

.timeline-content h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.timeline-content p {
  margin: 0 0 8px;
  font-size: 13px;
  color: #606266;
}

.approver-info,
.comment-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.action-area {
  display: flex;
  justify-content: center;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
  margin-top: 10px;
}

:deep(.el-descriptions__label) {
  background-color: #fafafa;
}

:deep(.el-timeline-item__node) {
  background-color: inherit;
}
</style>