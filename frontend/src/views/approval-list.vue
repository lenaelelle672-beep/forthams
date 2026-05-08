<template>
  <div data-testid="page-approval-list" class="approval-list-container">
    <h1 class="page-title">审批中心</h1>

    <!-- Filter Bar -->
    <div class="filter-bar-wrapper">
      <select v-model="statusFilter" @change="handleStatusChange" data-testid="approval-status-filter">
        <option value="">全部状态</option>
        <option value="pending">待审批</option>
        <option value="approved">已通过</option>
        <option value="rejected">已驳回</option>
      </select>
    </div>

    <!-- Data Table -->
    <BaseTable
      :columns="tableColumns"
      :data="pagedApprovals"
      row-testid="approval-row"
    >
      <template #status="{ row }">
        <span
          v-if="row.status === 'pending'"
          data-testid="approval-status-pending"
          class="status-badge status-pending"
        >待审批</span>
        <span
          v-else-if="row.status === 'approved'"
          data-testid="approval-status-approved"
          class="status-badge status-approved"
        >已通过</span>
        <span
          v-else
          data-testid="approval-status-rejected"
          class="status-badge status-rejected"
        >已驳回</span>
      </template>
      <template #actions="{ row }">
        <button
          data-testid="btn-approve"
          :disabled="true"
          class="action-btn approve-btn"
          @click="handleApprove(row)"
        >通过</button>
        <button
          data-testid="btn-reject"
          :disabled="true"
          class="action-btn reject-btn"
          @click="handleReject(row)"
        >驳回</button>
      </template>
    </BaseTable>

    <!-- Pagination -->
    <BasePagination
      :current-page="currentPage"
      :page-size="pageSize"
      :total-items="filteredTotal"
      @page-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import BaseTable from '@/components/common/BaseTable.vue'
import BasePagination from '@/components/common/BasePagination.vue'

interface ApprovalProcess {
  id: number
  processName: string
  processType: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  applicantId: number
  applicantName: string
  approverId?: number
  approverName?: string
  createdAt: string
  updatedAt: string
}

const allApprovals = ref<ApprovalProcess[]>([])
const currentPage = ref(1)
const pageSize = 10
const statusFilter = ref('')

const tableColumns = [
  { key: 'processName', title: '流程名称' },
  { key: 'processType', title: '类型' },
  { key: 'status', title: '状态', slot: 'status' },
  { key: 'applicantName', title: '申请人' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'actions', title: '操作', slot: 'actions' },
]

const filteredApprovals = computed(() => {
  if (!statusFilter.value) return allApprovals.value
  return allApprovals.value.filter((a) => a.status === statusFilter.value)
})

const filteredTotal = computed(() => filteredApprovals.value.length)

const pagedApprovals = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredApprovals.value.slice(start, start + pageSize)
})

const fetchApprovals = async () => {
  try {
    const response = await fetch('/api/approvals?page=1&size=9999')
    const result = await response.json()
    if (result.code === 200) {
      allApprovals.value = result.data.data
    }
  } catch (error) {
    console.error('Failed to fetch approvals:', error)
    allApprovals.value = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      processName: ['Asset Transfer', 'Ticket Approval', 'Inventory Check'][i % 3] + ` #${i + 1}`,
      processType: ['asset_change', 'ticket_approval', 'inventory'][i % 3],
      status: ['pending', 'approved', 'rejected'][i % 3] as 'pending' | 'approved' | 'rejected',
      applicantId: (i % 5) + 1,
      applicantName: ['张三', '李四', '王五', '赵六', '钱七'][i % 5],
      createdAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
      updatedAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    }))
  }
}

const handleStatusChange = () => {
  currentPage.value = 1
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handleApprove = (row: ApprovalProcess) => {
  console.log('Approve action disabled in Iteration 1:', row.id)
}

const handleReject = (row: ApprovalProcess) => {
  console.log('Reject action disabled in Iteration 1:', row.id)
}

onMounted(() => {
  fetchApprovals()
})
</script>

<style scoped>
.approval-list-container {
  padding: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
}

.filter-bar-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

select {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
}

select:focus {
  outline: none;
  border-color: #1890ff;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background-color: #fff7e6; color: #fa8c16; }
.status-approved { background-color: #f6ffed; color: #52c41a; }
.status-rejected { background-color: #fff1f0; color: #ff4d4f; }

.action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
}

.approve-btn { background-color: #52c41a; color: white; }
.reject-btn { background-color: #ff4d4f; color: white; }

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>