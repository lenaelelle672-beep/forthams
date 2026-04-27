<template>
  <div class="retirement-history">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">{{ t('retirement.history.title') }}</h1>
      <el-button type="primary" @click="handleApply">
        {{ t('retirement.history.applyNew') }}
      </el-button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item :label="t('retirement.history.filters.assetId')">
          <el-input
            v-model="filterForm.assetId"
            :placeholder="t('retirement.history.filters.assetIdPlaceholder')"
            clearable
            @keyup.enter="handleFilter"
          />
        </el-form-item>
        
        <el-form-item :label="t('retirement.history.filters.status')">
          <el-select
            v-model="filterForm.status"
            :placeholder="t('retirement.history.filters.statusPlaceholder')"
            clearable
          >
            <el-option
              v-for="status in statusOptions"
              :key="status.value"
              :label="status.label"
              :value="status.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item :label="t('retirement.history.filters.dateRange')">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="~"
            :start-placeholder="t('retirement.history.filters.startDate')"
            :end-placeholder="t('retirement.history.filters.endDate')"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        
        <el-form-item :label="t('retirement.history.filters.applicant')">
          <el-input
            v-model="filterForm.applicant"
            :placeholder="t('retirement.history.filters.applicantPlaceholder')"
            clearable
            @keyup.enter="handleFilter"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleFilter">
            {{ t('retirement.history.filters.search') }}
          </el-button>
          <el-button @click="handleReset">
            {{ t('retirement.history.filters.reset') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <el-table
        v-loading="loading"
        :data="retirementList"
        stripe
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column
          prop="retirementId"
          :label="t('retirement.history.columns.retirementId')"
          width="180"
          fixed
        >
          <template #default="{ row }">
            <el-link type="primary" @click="handleViewDetail(row)">
              {{ row.retirementId }}
            </el-link>
          </template>
        </el-table-column>
        
        <el-table-column
          prop="assetId"
          :label="t('retirement.history.columns.assetId')"
          width="150"
        >
          <template #default="{ row }">
            <el-tag size="small">{{ row.assetId }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column
          prop="assetName"
          :label="t('retirement.history.columns.assetName')"
          min-width="150"
          show-overflow-tooltip
        />
        
        <el-table-column
          prop="reason"
          :label="t('retirement.history.columns.reason')"
          min-width="200"
          show-overflow-tooltip
        />
        
        <el-table-column
          prop="residualValue"
          :label="t('retirement.history.columns.residualValue')"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            {{ formatCurrency(row.residualValue) }}
          </template>
        </el-table-column>
        
        <el-table-column
          prop="status"
          :label="t('retirement.history.columns.status')"
          width="120"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column
          prop="applicant"
          :label="t('retirement.history.columns.applicant')"
          width="120"
        />
        
        <el-table-column
          prop="createdAt"
          :label="t('retirement.history.columns.createdAt')"
          width="160"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        
        <el-table-column
          prop="approvedAt"
          :label="t('retirement.history.columns.approvedAt')"
          width="160"
        >
          <template #default="{ row }">
            {{ row.approvedAt ? formatDateTime(row.approvedAt) : '-' }}
          </template>
        </el-table-column>
        
        <el-table-column
          :label="t('retirement.history.columns.actions')"
          width="180"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'DRAFT' || row.status === 'PENDING'"
              type="primary"
              size="small"
              link
              @click="handleViewDetail(row)"
            >
              {{ t('retirement.history.actions.view') }}
            </el-button>
            <el-button
              v-if="row.status === 'APPROVED'"
              type="success"
              size="small"
              link
              @click="handleArchive(row)"
            >
              {{ t('retirement.history.actions.archive') }}
            </el-button>
            <el-button
              type="info"
              size="small"
              link
              @click="handleViewTimeline(row)"
            >
              {{ t('retirement.history.actions.timeline') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.currentPage"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      :title="t('retirement.history.detail.title')"
      size="600px"
      direction="rtl"
    >
      <div v-if="currentRecord" class="detail-content">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('retirement.history.detail.retirementId')">
            {{ currentRecord.retirementId }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.assetId')">
            {{ currentRecord.assetId }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.assetName')">
            {{ currentRecord.assetName }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.reason')">
            {{ currentRecord.reason }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.residualValue')">
            {{ formatCurrency(currentRecord.residualValue) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.status')">
            <el-tag :type="getStatusType(currentRecord.status)">
              {{ getStatusLabel(currentRecord.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.applicant')">
            {{ currentRecord.applicant }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.description')">
            {{ currentRecord.description || '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.createdAt')">
            {{ formatDateTime(currentRecord.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.approvedAt')">
            {{ currentRecord.approvedAt ? formatDateTime(currentRecord.approvedAt) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('retirement.history.detail.approver')">
            {{ currentRecord.approver || '-' }}
          </el-descriptions-item>
        </el-descriptions>
        
        <div v-if="currentRecord.attachments?.length" class="attachments-section">
          <h4>{{ t('retirement.history.detail.attachments') }}</h4>
          <el-upload
            :file-list="currentRecord.attachments"
            disabled
            list-type="text"
          />
        </div>
      </div>
    </el-drawer>

    <!-- 审批时间线抽屉 -->
    <el-drawer
      v-model="timelineDrawerVisible"
      :title="t('retirement.history.timeline.title')"
      size="500px"
      direction="rtl"
    >
      <div v-if="currentRecord" class="timeline-content">
        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in currentRecord.approvalTimeline"
            :key="index"
            :timestamp="formatDateTime(item.actionAt)"
            :type="getTimelineItemType(item.action)"
            :hollow="item.action === 'PENDING'"
          >
            <div class="timeline-item-content">
              <h4>{{ getTimelineActionLabel(item.action) }}</h4>
              <p v-if="item.approver">{{ t('retirement.history.timeline.approver') }}: {{ item.approver }}</p>
              <p v-if="item.comment" class="comment">{{ t('retirement.history.timeline.comment') }}: {{ item.comment }}</p>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { retirementApi } from '@/api/retirementApi'
import type { 
  RetirementRecord, 
  RetirementFilter, 
  RetirementStatus,
  ApprovalTimelineItem 
} from '@/types/retirement.types'

// i18n
const { t } = useI18n()

// 状态
const loading = ref(false)
const retirementList = ref<RetirementRecord[]>([])
const detailDrawerVisible = ref(false)
const timelineDrawerVisible = ref(false)
const currentRecord = ref<RetirementRecord | null>(null)
const selectedRows = ref<RetirementRecord[]>([])

// 筛选表单
const filterForm = reactive<RetirementFilter>({
  assetId: '',
  status: undefined,
  dateRange: [],
  applicant: ''
})

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// 状态选项
const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING_APPROVAL', label: '待审批' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'ARCHIVED', label: '已归档' }
]

// 方法
/**
 * 加载报废历史记录列表
 * @description 从后端API获取报废记录数据，支持分页和筛选
 */
const loadRetirementHistory = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...filterForm
    }
    
    const response = await retirementApi.getRetirementHistory(params)
    
    retirementList.value = response.data.records
    pagination.total = response.data.total
  } catch (error) {
    ElMessage.error(t('retirement.history.messages.loadError'))
    console.error('Failed to load retirement history:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 处理筛选查询
 * @description 重置分页并重新加载数据
 */
const handleFilter = () => {
  pagination.currentPage = 1
  loadRetirementHistory()
}

/**
 * 重置筛选表单
 * @param formRef - 表单实例
 */
const handleReset = (formRef?: FormInstance) => {
  if (formRef) {
    formRef.resetFields()
  }
  filterForm.assetId = ''
  filterForm.status = undefined
  filterForm.dateRange = []
  filterForm.applicant = ''
  handleFilter()
}

/**
 * 处理分页大小变化
 * @param size - 新的分页大小
 */
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadRetirementHistory()
}

/**
 * 处理分页页码变化
 * @param page - 新的页码
 */
const handleCurrentChange = (page: number) => {
  pagination.currentPage = page
  loadRetirementHistory()
}

/**
 * 处理表格选中变化
 * @param selection - 选中的行数据
 */
const handleSelectionChange = (selection: RetirementRecord[]) => {
  selectedRows.value = selection
}

/**
 * 处理查看详情
 * @param row - 报废记录行数据
 */
const handleViewDetail = async (row: RetirementRecord) => {
  try {
    const detail = await retirementApi.getRetirementDetail(row.retirementId)
    currentRecord.value = detail.data
    detailDrawerVisible.value = true
  } catch (error) {
    ElMessage.error(t('retirement.history.messages.loadDetailError'))
  }
}

/**
 * 处理归档操作
 * @param row - 报废记录行数据
 */
const handleArchive = async (row: RetirementRecord) => {
  try {
    await ElMessageBox.confirm(
      t('retirement.history.messages.archiveConfirm'),
      t('retirement.history.messages.warning'),
      {
        confirmButtonText: t('retirement.history.actions.confirm'),
        cancelButtonText: t('retirement.history.actions.cancel'),
        type: 'warning'
      }
    )
    
    await retirementApi.archiveRetirement(row.retirementId)
    ElMessage.success(t('retirement.history.messages.archiveSuccess'))
    loadRetirementHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('retirement.history.messages.archiveError'))
    }
  }
}

/**
 * 处理查看时间线
 * @param row - 报废记录行数据
 */
const handleViewTimeline = async (row: RetirementRecord) => {
  try {
    const timeline = await retirementApi.getApprovalTimeline(row.retirementId)
    currentRecord.value = {
      ...row,
      approvalTimeline: timeline.data
    }
    timelineDrawerVisible.value = true
  } catch (error) {
    ElMessage.error(t('retirement.history.messages.loadTimelineError'))
  }
}

/**
 * 处理新建报废申请
 * @description 跳转到报废申请页面
 */
const handleApply = () => {
  // 跳转到报废申请页面
  window.location.href = '/asset/retirement/apply'
}

/**
 * 获取状态标签类型
 * @param status - 报废状态
 * @returns Element Plus 标签类型
 */
const getStatusType = (status: RetirementStatus): string => {
  const statusMap: Record<RetirementStatus, string> = {
    DRAFT: 'info',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ARCHIVED: ''
  }
  return statusMap[status] || 'info'
}

/**
 * 获取状态标签文本
 * @param status - 报废状态
 * @returns 本地化状态文本
 */
const getStatusLabel = (status: RetirementStatus): string => {
  const labelMap: Record<RetirementStatus, string> = {
    DRAFT: t('retirement.status.draft'),
    PENDING_APPROVAL: t('retirement.status.pendingApproval'),
    APPROVED: t('retirement.status.approved'),
    REJECTED: t('retirement.status.rejected'),
    ARCHIVED: t('retirement.status.archived')
  }
  return labelMap[status] || status
}

/**
 * 获取时间线项目类型
 * @param action - 审批动作
 * @returns Element Plus 时间线项目类型
 */
const getTimelineItemType = (action: string): string => {
  const typeMap: Record<string, string> = {
    SUBMIT: 'primary',
    APPROVE: 'success',
    REJECT: 'danger',
    PENDING: 'warning'
  }
  return typeMap[action] || 'primary'
}

/**
 * 获取时间线动作标签
 * @param action - 审批动作
 * @returns 本地化动作文本
 */
const getTimelineActionLabel = (action: string): string => {
  const labelMap: Record<string, string> = {
    SUBMIT: t('retirement.timeline.submit'),
    APPROVE: t('retirement.timeline.approve'),
    REJECT: t('retirement.timeline.reject'),
    PENDING: t('retirement.timeline.pending')
  }
  return labelMap[action] || action
}

/**
 * 格式化货币
 * @param value - 货币数值
 * @returns 格式化后的货币字符串
 */
const formatCurrency = (value: number): string => {
  if (value == null) return '-'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(value)
}

/**
 * 格式化日期时间
 * @param dateTime - ISO 日期时间字符串
 * @returns 格式化后的日期时间字符串
 */
const formatDateTime = (dateTime: string): string => {
  if (!dateTime) return '-'
  return new Date(dateTime).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  loadRetirementHistory()
})
</script>

<style scoped>
.retirement-history {
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

.filter-bar {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-form {
  margin: 0;
}

.data-table {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.detail-content {
  padding: 0 16px;
}

.attachments-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.attachments-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 16px;
}

.timeline-content {
  padding: 0 16px;
}

.timeline-item-content h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 14px;
}

.timeline-item-content p {
  margin: 4px 0;
  color: #606266;
  font-size: 13px;
}

.timeline-item-content p.comment {
  font-style: italic;
  color: #909399;
}
</style>