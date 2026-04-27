<template>
  <div class="asset-table-container">
    <div class="table-header">
      <h3 class="table-title">{{ title }}</h3>
      <div class="table-actions">
        <slot name="actions" />
      </div>
    </div>
    
    <div class="table-wrapper">
      <table class="asset-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="['th-cell', { 'sortable': column.sortable }]"
              :style="{ width: column.width, textAlign: column.align || 'left' }"
              @click="column.sortable ? handleSort(column.key) : null"
            >
              <div class="th-content">
                <span class="th-label">{{ column.label }}</span>
                <span
                  v-if="column.sortable"
                  class="sort-indicator"
                  :class="{ 'active': sortKey === column.key, 'desc': sortOrder === 'desc' }"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 3L9 7H3L6 3Z" :opacity="sortKey === column.key && sortOrder === 'asc' ? 1 : 0.3" />
                    <path d="M6 9L3 5H9L6 9Z" :opacity="sortKey === column.key && sortOrder === 'desc' ? 1 : 0.3" />
                  </svg>
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in paginatedData"
            :key="row.id || index"
            class="table-row"
            @click="handleRowClick(row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="td-cell"
              :style="{ textAlign: column.align || 'left' }"
            >
              <slot :name="`cell-${column.key}`" :row="row" :column="column">
                <span class="cell-text">{{ formatCell(row[column.key], column) }}</span>
              </slot>
            </td>
          </tr>
          <tr v-if="paginatedData.length === 0" class="empty-row">
            <td :colspan="columns.length" class="empty-cell">
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="empty-icon">
                  <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2" fill="none" />
                  <path d="M16 20H32M16 28H28" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span class="empty-text">{{ emptyText }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showPagination && totalCount > 0" class="pagination-bar">
      <div class="pagination-info">
        <span class="info-text">
          显示 {{ startIndex + 1 }}-{{ endIndex }} 条，共 {{ totalCount }} 条
        </span>
        <select
          v-model="localPageSize"
          class="page-size-select"
          @change="handlePageSizeChange"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }} 条/页
          </option>
        </select>
      </div>
      <div class="pagination-controls">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(1)"
        >
          首页
        </button>
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          上一页
        </button>
        <div class="page-numbers">
          <template v-for="pageNum in displayedPages" :key="pageNum">
            <button
              v-if="pageNum !== '...'"
              class="page-number"
              :class="{ 'active': pageNum === currentPage }"
              @click="goToPage(pageNum)"
            >
              {{ pageNum }}
            </button>
            <span v-else class="page-ellipsis">...</span>
          </template>
        </div>
        <button
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
        <button
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(totalPages)"
        >
          末页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

/**
 * Asset Table Component
 * 
 * Provides a comprehensive data table for asset statistics dashboard with:
 * - Customizable columns with slot support
 * - Server-side and client-side sorting
 * - Pagination with configurable page sizes
 * - Empty state handling
 * - Row click event handling
 * 
 * @example
 * ```vue
 * <AssetTable
 *   :data="assetList"
 *   :columns="columns"
 *   title="资产明细"
 *   :show-pagination="true"
 *   :page-size="20"
 *   @row-click="handleRowClick"
 * />
 * ```
 */

export interface TableColumn {
  /** Unique key for the column */
  key: string;
  /** Display label for the column header */
  label: string;
  /** Column width (e.g., '120px', '20%') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom formatter function */
  formatter?: (value: any, row: Record<string, any>) => string;
  /** Data type for default formatting */
  type?: 'text' | 'number' | 'currency' | 'date' | 'status' | 'progress';
}

export interface AssetTableProps {
  /** Table title displayed in header */
  title?: string;
  /** Column definitions */
  columns: TableColumn[];
  /** Table data array */
  data: Record<string, any>[];
  /** Enable pagination */
  showPagination?: boolean;
  /** Current page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Total count for pagination */
  totalCount?: number;
  /** Empty state text */
  emptyText?: string;
  /** Loading state */
  loading?: boolean;
  /** Enable row hover effect */
  rowHoverable?: boolean;
}

const props = withDefaults(defineProps<AssetTableProps>(), {
  title: '资产明细',
  showPagination: true,
  page: 1,
  pageSize: 10,
  pageSizeOptions: () => [10, 20, 50, 100],
  totalCount: 0,
  emptyText: '暂无数据',
  loading: false,
  rowHoverable: true,
});

const emit = defineEmits<{
  /** Emitted when page changes */
  (e: 'page-change', page: number): void;
  /** Emitted when page size changes */
  (e: 'page-size-change', size: number): void;
  /** Emitted when sort order changes */
  (e: 'sort-change', payload: { key: string; order: 'asc' | 'desc' }): void;
  /** Emitted when a row is clicked */
  (e: 'row-click', row: Record<string, any>): void;
  /** Emitted when data changes */
  (e: 'update:data', data: Record<string, any>[]): void;
}>();

// Local state
const currentPage = ref(props.page);
const localPageSize = ref(props.pageSize);
const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');

// Computed properties
const sortedData = computed(() => {
  if (!sortKey.value) return props.data;
  
  return [...props.data].sort((a, b) => {
    const aVal = a[sortKey.value];
    const bVal = b[sortKey.value];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

const totalPages = computed(() => {
  return Math.ceil(props.totalCount / localPageSize.value) || 1;
});

const startIndex = computed(() => {
  return (currentPage.value - 1) * localPageSize.value;
});

const endIndex = computed(() => {
  return Math.min(startIndex.value + localPageSize.value, props.totalCount);
});

const paginatedData = computed(() => {
  if (!props.showPagination) return sortedData.value;
  return sortedData.value.slice(startIndex.value, endIndex.value);
});

const displayedPages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    
    for (let i = start; i <= end; i++) pages.push(i);
    
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  
  return pages;
});

// Methods
/**
 * Handles column header click for sorting
 * @param key - Column key to sort by
 */
const handleSort = (key: string) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
  emit('sort-change', { key: sortKey.value, order: sortOrder.value });
};

/**
 * Navigates to a specific page
 * @param page - Target page number
 */
const goToPage = (page: number) => {
  const validPage = Math.max(1, Math.min(page, totalPages.value));
  if (validPage !== currentPage.value) {
    currentPage.value = validPage;
    emit('page-change', currentPage.value);
  }
};

/**
 * Handles page size change
 */
const handlePageSizeChange = () => {
  currentPage.value = 1;
  emit('page-size-change', localPageSize.value);
  emit('page-change', currentPage.value);
};

/**
 * Handles row click event
 * @param row - Clicked row data
 */
const handleRowClick = (row: Record<string, any>) => {
  emit('row-click', row);
};

/**
 * Formats cell value based on column type
 * @param value - Raw cell value
 * @param column - Column configuration
 * @returns Formatted display value
 */
const formatCell = (value: any, column: TableColumn): string => {
  if (column.formatter) {
    return column.formatter(value, {});
  }
  
  if (value === null || value === undefined) {
    return '-';
  }
  
  switch (column.type) {
    case 'currency':
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
      }).format(value);
    
    case 'number':
      return new Intl.NumberFormat('zh-CN').format(value);
    
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('zh-CN');
      }
      return String(value);
    
    case 'progress':
      return `${value}%`;
    
    case 'status':
      return String(value);
    
    default:
      return String(value);
  }
};

// Watchers
watch(() => props.page, (newPage) => {
  currentPage.value = newPage;
});

watch(() => props.pageSize, (newSize) => {
  localPageSize.value = newSize;
});
</script>

<style scoped>
.asset-table-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.table-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.table-wrapper {
  overflow-x: auto;
}

.asset-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.th-cell {
  padding: 12px 16px;
  background: #fafafa;
  font-weight: 600;
  color: #595959;
  border-bottom: 1px solid #e8e8e8;
  white-space: nowrap;
  user-select: none;
}

.th-cell.sortable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.th-cell.sortable:hover {
  background: #f0f0f0;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-indicator {
  color: #bfbfbf;
  transition: color 0.2s;
}

.sort-indicator.active {
  color: #1890ff;
}

.table-row {
  transition: background-color 0.15s;
}

.table-row:hover {
  background: #fafafa;
}

.td-cell {
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  color: #262626;
  vertical-align: middle;
}

.cell-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-row {
  background: #fafafa;
}

.empty-cell {
  padding: 48px 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  color: #d9d9d9;
}

.empty-text {
  color: #8c8c8c;
  font-size: 14px;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e8e8e8;
  background: #fafafa;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-text {
  color: #595959;
  font-size: 14px;
}

.page-size-select {
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.page-size-select:hover {
  border-color: #1890ff;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #595959;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  color: #1890ff;
  border-color: #1890ff;
}

.page-btn:disabled {
  color: #d9d9d9;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-number {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #595959;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-number:hover {
  color: #1890ff;
  border-color: #1890ff;
}

.page-number.active {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}

.page-ellipsis {
  color: #8c8c8c;
  padding: 0 4px;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .asset-table-container {
    background: #1f1f1f;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .table-header {
    border-bottom-color: #303030;
  }
  
  .table-title {
    color: #e8e8e8;
  }
  
  .th-cell {
    background: #262626;
    color: #a6a6a6;
    border-bottom-color: #303030;
  }
  
  .th-cell.sortable:hover {
    background: #303030;
  }
  
  .table-row:hover {
    background: #262626;
  }
  
  .td-cell {
    border-bottom-color: #303030;
    color: #e8e8e8;
  }
  
  .empty-row {
    background: #262626;
  }
  
  .empty-icon {
    color: #595959;
  }
  
  .empty-text {
    color: #8c8c8c;
  }
  
  .pagination-bar {
    border-top-color: #303030;
    background: #262626;
  }
  
  .info-text {
    color: #a6a6a6;
  }
  
  .page-btn,
  .page-number {
    background: #303030;
    border-color: #434343;
    color: #a6a6a6;
  }
  
  .page-btn:hover:not(:disabled),
  .page-number:hover {
    border-color: #177ddc;
    color: #177ddc;
  }
  
  .page-btn:disabled {
    color: #434343;
  }
}

/* Responsive styles */
@media (max-width: 768px) {
  .pagination-bar {
    flex-direction: column;
    gap: 12px;
  }
  
  .pagination-info,
  .pagination-controls {
    width: 100%;
    justify-content: center;
  }
  
  .page-numbers {
    display: none;
  }
}
</style>