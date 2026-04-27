<template>
  <div class="workorder-list-container">
    <!-- 顶部操作栏 -->
    <div class="list-header">
      <h2 class="page-title">工单列表</h2>
      <div class="header-actions">
        <el-button type="primary" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <el-form :model="filterForm" inline>
        <el-form-item label="工单状态">
          <el-select v-model="filterForm.status" placeholder="请选择状态" clearable>
            <el-option label="草稿" value="draft" />
            <el-option label="待审批" value="pending" />
            <el-option label="审批中" value="approving" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item label="工单类型">
          <el-select v-model="filterForm.type" placeholder="请选择类型" clearable>
            <el-option label="资产报废" value="retirement" />
            <el-option label="资产转移" value="transfer" />
            <el-option label="维保申请" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="提交日期">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 工单列表 -->
    <div class="workorder-table">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        @row-click="handleRowClick"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="workorder_id" label="工单编号" width="150">
          <template #default="{ row }">
            <el-link type="primary" @click.stop="handleViewDetail(row)">
              {{ row.workorder_id }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="工单标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator" label="创建人" width="120" />
        <el-table-column prop="create_time" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.create_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="approver" label="当前审批人" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" type="primary" link @click.stop="handleViewDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="canApprove(row)"
                size="small"
                type="success"
                link
                @click.stop="handleApprove(row)"
              >
                批准
              </el-button>
              <el-button
                v-if="canReject(row)"
                size="small"
                type="danger"
                link
                @click.stop="handleReject(row)"
              >
                驳回
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 审批对话框 -->
    <el-dialog
      v-model="approvalDialogVisible"
      :title="approvalType === 'approve' ? '批准工单' : '驳回工单'"
      width="500px"
    >
      <el-form :model="approvalForm" label-width="100px">
        <el-form-item label="工单编号">
          <span>{{ currentWorkOrder?.workorder_id }}</span>
        </el-form-item>
        <el-form-item label="工单标题">
          <span>{{ currentWorkOrder?.title }}</span>
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="4"
            :placeholder="approvalType === 'reject' ? '请输入驳回原因（必填）' : '请输入审批意见（选填）'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button
          :type="approvalType === 'approve' ? 'success' : 'danger'"
          @click="handleSubmitApproval"
        >
          确认{{ approvalType === 'approve' ? '批准' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 工单详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="工单详情"
      size="600px"
      direction="rtl"
    >
      <div v-if="currentWorkOrder" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单编号">
            {{ currentWorkOrder.workorder_id }}
          </el-descriptions-item>
          <el-descriptions-item label="工单状态">
            <el-tag :type="getStatusTagType(currentWorkOrder.status)">
              {{ getStatusLabel(currentWorkOrder.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="工单标题" :span="2">
            {{ currentWorkOrder.title }}
          </el-descriptions-item>
          <el-descriptions-item label="工单类型">
            {{ getTypeLabel(currentWorkOrder.type) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ currentWorkOrder.creator }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(currentWorkOrder.create_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="当前审批人">
            {{ currentWorkOrder.approver || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="最后更新时间">
            {{ formatDateTime(currentWorkOrder.update_time) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <h4>工单描述</h4>
          <p class="description-text">{{ currentWorkOrder.description || '暂无描述' }}</p>
        </div>

        <!-- 审批历史时间线 -->
        <div class="detail-section">
          <h4>审批历史</h4>
          <el-timeline v-if="approvalHistory.length > 0">
            <el-timeline-item
              v-for="(item, index) in approvalHistory"
              :key="index"
              :timestamp="formatDateTime(item.action_time)"
              :type="getTimelineItemType(item.action)"
            >
              <div class="timeline-content">
                <p class="timeline-title">
                  <strong>{{ item.actor }}</strong>
                  <span class="action-label">{{ getActionLabel(item.action) }}</span>
                </p>
                <p v-if="item.comment" class="timeline-comment">
                  意见：{{ item.comment }}
                </p>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无审批历史" />
        </div>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <el-button
            v-if="canApprove(currentWorkOrder)"
            type="success"
            size="large"
            @click="handleApprove(currentWorkOrder)"
          >
            批准
          </el-button>
          <el-button
            v-if="canReject(currentWorkOrder)"
            type="danger"
            size="large"
            @click="handleReject(currentWorkOrder)"
          >
            驳回
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单列表页面组件
 * 
 * 功能说明：
 * - 展示工单列表，支持筛选、排序、分页
 * - 提供审批操作入口（批准/驳回）
 * - 展示审批历史时间线
 * 
 * 使用说明：
 * - 点击工单行跳转详情
 * - 支持多条件筛选
 * - 审批操作需填写意见
 */
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

// 接口定义
interface WorkOrder {
  workorder_id: string
  title: string
  type: 'retirement' | 'transfer' | 'maintenance'
  status: 'draft' | 'pending' | 'approving' | 'approved' | 'rejected' | 'archived'
  creator: string
  create_time: string
  update_time: string
  approver?: string
  description?: string
}

interface ApprovalHistoryItem {
  action_time: string
  actor: string
  action: 'submit' | 'approve' | 'reject' | 'return'
  comment?: string
}

interface FilterForm {
  status: string
  type: string
  dateRange: [string, string] | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
}

// 状态定义
const loading = ref(false)
const tableData = ref<WorkOrder[]>([])
const filterForm = reactive<FilterForm>({
  status: '',
  type: '',
  dateRange: null
})
const pagination = reactive<Pagination>({
  page: 1,
  pageSize: 20,
  total: 0
})

// 审批对话框状态
const approvalDialogVisible = ref(false)
const approvalType = ref<'approve' | 'reject'>('approve')
const currentWorkOrder = ref<WorkOrder | null>(null)
const approvalForm = reactive({
  comment: ''
})
const approvalHistory = ref<ApprovalHistoryItem[]>([])

// 详情抽屉状态
const detailDrawerVisible = ref(false)

// 状态映射配置
const STATUS_CONFIG: Record<string, { label: string; tagType: string }> = {
  draft: { label: '草稿', tagType: 'info' },
  pending: { label: '待审批', tagType: 'warning' },
  approving: { label: '审批中', tagType: 'primary' },
  approved: { label: '已通过', tagType: 'success' },
  rejected: { label: '已驳回', tagType: 'danger' },
  archived: { label: '已归档', tagType: '' }
}

const TYPE_CONFIG: Record<string, { label: string; tagType: string }> = {
  retirement: { label: '资产报废', tagType: 'danger' },
  transfer: { label: '资产转移', tagType: 'primary' },
  maintenance: { label: '维保申请', tagType: 'success' }
}

const ACTION_CONFIG: Record<string, { label: string; type: string }> = {
  submit: { label: '提交审批', type: 'primary' },
  approve: { label: '审批通过', type: 'success' },
  reject: { label: '审批驳回', type: 'danger' },
  return: { label: '退回修改', type: 'warning' }
}

/**
 * 获取状态标签配置
 */
const getStatusTagType = (status: string): string => {
  return STATUS_CONFIG[status]?.tagType || ''
}

/**
 * 获取状态标签文本
 */
const getStatusLabel = (status: string): string => {
  return STATUS_CONFIG[status]?.label || status
}

/**
 * 获取类型标签配置
 */
const getTypeTagType = (type: string): string => {
  return TYPE_CONFIG[type]?.tagType || ''
}

/**
 * 获取类型标签文本
 */
const getTypeLabel = (type: string): string => {
  return TYPE_CONFIG[type]?.label || type
}

/**
 * 获取操作标签文本
 */
const getActionLabel = (action: string): string => {
  return ACTION_CONFIG[action]?.label || action
}

/**
 * 获取时间线项目类型
 */
const getTimelineItemType = (action: string): string => {
  return ACTION_CONFIG[action]?.type || 'primary'
}

/**
 * 格式化日期时间
 */
const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 判断是否可执行批准操作
 */
const canApprove = (workOrder: WorkOrder): boolean => {
  return ['pending', 'approving'].includes(workOrder.status)
}

/**
 * 判断是否可执行驳回操作
 */
const canReject = (workOrder: WorkOrder): boolean => {
  return ['pending', 'approving'].includes(workOrder.status)
}

/**
 * 加载工单列表数据
 */
const loadWorkOrderList = async (): Promise<void> => {
  loading.value = true
  try {
    // TODO: 调用实际 API 接口获取工单列表
    // 模拟数据
    tableData.value = generateMockData()
    pagination.total = tableData.value.length
  } catch (error) {
    ElMessage.error('加载工单列表失败')
  } finally {
    loading.value = false
  }
}

/**
 * 生成模拟数据（用于开发测试）
 */
const generateMockData = (): WorkOrder[] => {
  return [
    {
      workorder_id: 'WO-2024-001',
      title: '服务器报废申请',
      type: 'retirement',
      status: 'pending',
      creator: '张三',
      create_time: '2024-01-15 10:30:00',
      update_time: '2024-01-15 10:30:00',
      approver: '李四',
      description: '服务器使用年限已到，申请报废处理'
    },
    {
      workorder_id: 'WO-2024-002',
      title: '办公设备转移申请',
      type: 'transfer',
      status: 'approving',
      creator: '王五',
      create_time: '2024-01-14 14:20:00',
      update_time: '2024-01-15 09:00:00',
      approver: '赵六',
      description: '将办公电脑从A部门转移至B部门'
    },
    {
      workorder_id: 'WO-2024-003',
      title: '空调维保申请',
      type: 'maintenance',
      status: 'approved',
      creator: '孙七',
      create_time: '2024-01-10 08:00:00',
      update_time: '2024-01-12 16:30:00',
      approver: '周八',
      description: '中央空调故障申请维修'
    }
  ]
}

/**
 * 加载审批历史
 */
const loadApprovalHistory = async (workorderId: string): Promise<void> => {
  // TODO: 调用实际 API 获取审批历史
  // 模拟数据
  approvalHistory.value = [
    {
      action_time: '2024-01-15 10:30:00',
      actor: '张三',
      action: 'submit',
      comment: '提交审批申请'
    },
    {
      action_time: '2024-01-15 11:00:00',
      actor: '李四',
      action: 'return',
      comment: '请补充设备清单'
    },
    {
      action_time: '2024-01-15 14:00:00',
      actor: '张三',
      action: 'submit',
      comment: '已补充设备清单'
    }
  ]
}

/**
 * 处理筛选查询
 */
const handleFilter = (): void => {
  pagination.page = 1
  loadWorkOrderList()
}

/**
 * 处理筛选重置
 */
const handleReset = (): void => {
  filterForm.status = ''
  filterForm.type = ''
  filterForm.dateRange = null
  handleFilter()
}

/**
 * 处理刷新
 */
const handleRefresh = (): void => {
  loadWorkOrderList()
  ElMessage.success('刷新成功')
}

/**
 * 处理分页大小变化
 */
const handleSizeChange = (size: number): void => {
  pagination.pageSize = size
  pagination.page = 1
  loadWorkOrderList()
}

/**
 * 处理分页页码变化
 */
const handlePageChange = (page: number): void => {
  pagination.page = page
  loadWorkOrderList()
}

/**
 * 处理行点击
 */
const handleRowClick = (row: WorkOrder): void => {
  handleViewDetail(row)
}

/**
 * 查看工单详情
 */
const handleViewDetail = async (row: WorkOrder): Promise<void> => {
  currentWorkOrder.value = row
  detailDrawerVisible.value = true
  await loadApprovalHistory(row.workorder_id)
}

/**
 * 处理批准操作
 */
const handleApprove = (row: WorkOrder): void => {
  currentWorkOrder.value = row
  approvalType.value = 'approve'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

/**
 * 处理驳回操作
 */
const handleReject = (row: WorkOrder): void => {
  currentWorkOrder.value = row
  approvalType.value = 'reject'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

/**
 * 提交审批结果
 */
const handleSubmitApproval = async (): Promise<void> => {
  if (!currentWorkOrder.value) return

  // 驳回时必须填写原因
  if (approvalType.value === 'reject' && !approvalForm.comment.trim()) {
    ElMessage.warning('驳回时必须填写驳回原因')
    return
  }

  try {
    // TODO: 调用实际 API 提交审批结果
    const actionText = approvalType.value === 'approve' ? '批准' : '驳回'
    ElMessage.success(`工单${currentWorkOrder.value.workorder_id}已${actionText}`)
    approvalDialogVisible.value = false
    loadWorkOrderList()
  } catch (error) {
    ElMessage.error('审批操作失败')
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadWorkOrderList()
})
</script>

<style scoped>
.workorder-list-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.filter-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.workorder-table {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.detail-content {
  padding: 0 10px;
}

.detail-section {
  margin-top: 24px;
}

.detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid #409eff;
}

.description-text {
  color: #606266;
  line-height: 1.6;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.timeline-content {
  padding-bottom: 8px;
}

.timeline-title {
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-label {
  color: #909399;
  font-size: 14px;
}

.timeline-comment {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.detail-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>