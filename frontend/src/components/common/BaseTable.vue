<template>
  <div data-testid="base-table" class="base-table-container">
    <table class="base-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" @click="handleSort(column)">
            {{ column.title }}
            <span v-if="currentSortField === column.key" class="sort-icon">
              {{ currentSortOrder === 'asc' ? '↑' : '↓' }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in sortedData" :key="index" data-testid="table-row">
          <td v-for="column in columns" :key="column.key">
            <slot :name="column.slot || column.key" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
        <tr v-if="sortedData.length === 0">
          <td :colspan="columns.length" class="empty-row">暂无数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Column {
  key: string
  title: string
  slot?: string
  sortable?: boolean
}

const props = defineProps<{
  columns: Column[]
  data: Record<string, any>[]
}>()

const emit = defineEmits<{
  (e: 'sort', field: string, order: 'asc' | 'desc'): void
}>()

const currentSortField = ref('')
const currentSortOrder = ref<'asc' | 'desc'>('asc')

const sortedData = computed(() => {
  if (!currentSortField.value) return props.data
  return [...props.data].sort((a, b) => {
    const aVal = a[currentSortField.value]
    const bVal = b[currentSortField.value]
    if (currentSortOrder.value === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    }
    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
  })
})

const handleSort = (column: Column) => {
  if (currentSortField.value === column.key) {
    currentSortOrder.value = currentSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    currentSortField.value = column.key
    currentSortOrder.value = 'asc'
  }
  emit('sort', currentSortField.value, currentSortOrder.value)
}
</script>

<style scoped>
.base-table-container {
  overflow-x: auto;
  width: 100%;
}

.base-table {
  width: 100%;
  border-collapse: collapse;
}

.base-table th,
.base-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #e8e8e8;
}

.base-table th {
  background-color: #fafafa;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.base-table th:hover {
  background-color: #f0f0f0;
}

.sort-icon {
  margin-left: 4px;
  font-size: 12px;
}

.empty-row {
  text-align: center;
  color: #999;
  padding: 32px 0;
}
</style>