<template>
  <div data-testid="page-asset-list" class="asset-list-container">
    <h1 class="page-title">资产管理</h1>

    <!-- Search Bar -->
    <div class="search-bar-wrapper">
      <input
        v-model="searchKeyword"
        placeholder="搜索资产编号、名称或部门..."
        data-testid="asset-search-input"
        class="search-input"
        @keyup.enter="handleSearch"
      />
      <button data-testid="btn-search" class="search-btn" @click="handleSearch">搜索</button>
    </div>

    <!-- Data Table -->
    <BaseTable
      :columns="tableColumns"
      :data="pagedAssets"
      row-testid="asset-row"
      @sort="handleSort"
    >
      <template #status="{ row }">
        <span :class="['status-badge', `status-${row.status}`]">{{ statusLabels[row.status] }}</span>
      </template>
      <template #value="{ row }">
        ¥{{ row.value.toLocaleString() }}
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

interface Asset {
  id: number
  assetCode: string
  name: string
  category: string
  status: 'active' | 'maintenance' | 'retired' | 'idle'
  location: string
  department: string
  purchaseDate: string
  value: number
}

const allAssets = ref<Asset[]>([])
const currentPage = ref(1)
const pageSize = 10
const searchKeyword = ref('')
const appliedKeyword = ref('')
const sortField = ref('')
const sortOrder = ref<'asc' | 'desc'>('asc')

const statusLabels: Record<string, string> = {
  active: '使用中',
  maintenance: '维护中',
  retired: '已报废',
  idle: '闲置',
}

const tableColumns = [
  { key: 'assetCode', title: '资产编号', sortable: true },
  { key: 'name', title: '名称', sortable: true },
  { key: 'category', title: '分类' },
  { key: 'status', title: '状态', slot: 'status' },
  { key: 'department', title: '部门' },
  { key: 'location', title: '位置' },
  { key: 'purchaseDate', title: '购买日期' },
  { key: 'value', title: '价值', slot: 'value' },
]

const filteredAssets = computed(() => {
  let result = [...allAssets.value]
  if (appliedKeyword.value) {
    const kw = appliedKeyword.value.toLowerCase()
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(kw) ||
        a.assetCode.toLowerCase().includes(kw) ||
        a.department.toLowerCase().includes(kw),
    )
  }
  if (sortField.value) {
    result.sort((a: any, b: any) => {
      const aVal = a[sortField.value]
      const bVal = b[sortField.value]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder.value === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder.value === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    })
  }
  return result
})

const filteredTotal = computed(() => filteredAssets.value.length)

const pagedAssets = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredAssets.value.slice(start, start + pageSize)
})

const fetchAssets = async () => {
  try {
    const response = await fetch('/api/assets?page=1&size=9999&keyword=')
    const result = await response.json()
    if (result.code === 200) {
      allAssets.value = result.data.data
    }
  } catch (error) {
    console.error('Failed to fetch assets:', error)
    // Fallback mock data
    allAssets.value = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      assetCode: `AST-${String(i + 1).padStart(4, '0')}`,
      name: ['MacBook Pro', 'Dell Monitor', 'Keyboard', 'Mouse', 'Laptop Stand'][i % 5],
      category: ['laptop', 'monitor', 'peripheral', 'accessory', 'device'][i % 5],
      status: ['active', 'maintenance', 'retired', 'idle'][i % 4] as Asset['status'],
      location: ['Office A-101', 'Office B-202', 'Warehouse C', 'Meeting Room D'][i % 4],
      department: ['Engineering', 'Marketing', 'Finance', 'HR'][i % 4],
      purchaseDate: `2023-${String((i % 12) + 1).padStart(2, '0')}-15`,
      value: [5999, 2499, 299, 49, 199][i % 5],
    }))
  }
}

const handleSearch = () => {
  appliedKeyword.value = searchKeyword.value
  currentPage.value = 1
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handleSort = (field: string, order: 'asc' | 'desc') => {
  sortField.value = field
  sortOrder.value = order
}

onMounted(() => {
  fetchAssets()
})
</script>

<style scoped>
.asset-list-container {
  padding: 24px;
  background-color: #fff;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
}

.search-bar-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  min-width: 240px;
}

.search-input:focus {
  outline: none;
  border-color: #1890ff;
}

.search-btn {
  padding: 6px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-btn:hover {
  background-color: #40a9ff;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-active { background-color: #f6ffed; color: #52c41a; }
.status-maintenance { background-color: #fff7e6; color: #fa8c16; }
.status-retired { background-color: #fff1f0; color: #ff4d4f; }
.status-idle { background-color: #e6f7ff; color: #1890ff; }
</style>