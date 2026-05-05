<template>
  <div class="approval-filter" data-testid="approval-filter">
    <div class="filter-container">
      <!-- 搜索输入框 -->
      <el-input
        v-model="searchKeyword"
        class="filter-search"
        placeholder="搜索审批标题/申请人"
        :prefix-icon="SearchIcon"
        clearable
        @input="handleSearchChange"
        data-testid="filter-search-input"
      />

      <!-- 状态筛选 -->
      <el-select
        v-model="selectedStatus"
        class="filter-status"
        placeholder="审批状态"
        clearable
        @change="handleStatusChange"
        data-testid="filter-status-select"
      >
        <el-option
          v-for="status in approvalStatusOptions"
          :key="status.value"
          :label="status.label"
          :value="status.value"
        />
      </el-select>

      <!-- 类型筛选 -->
      <el-select
        v-model="selectedType"
        class="filter-type"
        placeholder="审批类型"
        clearable
        @change="handleTypeChange"
        data-testid="filter-type-select"
      >
        <el-option
          v-for="type in approvalTypeOptions"
          :key="type.value"
          :label="type.label"
          :value="type.value"
        />
      </el-select>

      <!-- 日期范围筛选 -->
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        class="filter-date"
        @change="handleDateChange"
        data-testid="filter-date-picker"
      />

      <!-- 重置按钮 -->
      <el-button
        :icon="RefreshIcon"
        @click="handleReset"
        data-testid="filter-reset-btn"
      >
        重置
      </el-button>
    </div>

    <!-- 活跃筛选标签 -->
    <div v-if="hasActiveFilters" class="filter-tags">
      <span class="filter-tags-label">当前筛选:</span>
      <el-tag
        v-if="searchKeyword"
        closable
        @close="handleRemoveTag('search')"
        data-testid="filter-tag-search"
      >
        关键词: {{ searchKeyword }}
      </el-tag>
      <el-tag
        v-if="selectedStatus"
        closable
        type="info"
        @close="handleRemoveTag('status')"
        data-testid="filter-tag-status"
      >
        状态: {{ getStatusLabel(selectedStatus) }}
      </el-tag>
      <el-tag
        v-if="selectedType"
        closable
        type="warning"
        @close="handleRemoveTag('type')"
        data-testid="filter-tag-type"
      >
        类型: {{ getTypeLabel(selectedType) }}
      </el-tag>
      <el-tag
        v-if="dateRange && dateRange.length === 2"
        closable
        type="success"
        @close="handleRemoveTag('date')"
        data-testid="filter-tag-date"
      >
        日期: {{ formatDateRange }}
      </el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalFilter Component
 * 审批筛选组件 - 提供审批列表的多维度筛选功能
 * 
 * 功能特性:
 * - 关键词搜索（标题/申请人）
 * - 审批状态筛选
 * - 审批类型筛选
 * - 日期范围筛选
 * - 筛选标签可视化
 * 
 * 双向绑定:
 * - 与 approvalStore 的 filterParams 状态同步
 * - 筛选变更自动触发 store 更新
 * - 支持 URL 参数同步（可选）
 * 
 * @component
 * @example
 * <ApprovalFilter @filter-change="handleFilterChange" />
 */
import { ref, computed, watch } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useApprovalStore } from '@/stores/approvalStore';

// Icons
const SearchIcon = Search;
const RefreshIcon = Refresh;

// Store
const approvalStore = useApprovalStore();

// Props & Emits
interface FilterChangePayload {
  keyword?: string;
  status?: string;
  type?: string;
  dateRange?: [Date, Date] | null;
}

const emit = defineEmits<{
  (e: 'filter-change', payload: FilterChangePayload): void;
}>();

// 审批状态选项
const approvalStatusOptions = [
  { value: 'PENDING', label: '待审批' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'CANCELLED', label: '已撤回' },
];

// 审批类型选项
const approvalTypeOptions = [
  { value: 'ASSET_TRANSFER', label: '资产调拨' },
  { value: 'ASSET_SCRAP', label: '资产报废' },
  { value: 'ASSET_CLEARANCE', label: '资产清理' },
  { value: 'ASSET_COMPENSATION', label: '资产赔偿' },
  { value: 'MAINTENANCE', label: '维护申请' },
  { value: 'PURCHASE', label: '采购申请' },
];

// 筛选状态
const searchKeyword = ref<string>('');
const selectedStatus = ref<string>('');
const selectedType = ref<string>('');
const dateRange = ref<[Date, Date] | null>(null);

// 防抖定时器
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// 计算属性：是否有活跃筛选
const hasActiveFilters = computed(() => {
  return !!(
    searchKeyword.value ||
    selectedStatus.value ||
    selectedType.value ||
    (dateRange.value && dateRange.value.length === 2)
  );
});

// 计算属性：格式化日期范围显示
const formatDateRange = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) return '';
  const [start, end] = dateRange.value;
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return `${formatDate(start)} 至 ${formatDate(end)}`;
});

/**
 * 获取状态标签文本
 * @param status - 状态值
 * @returns 状态标签
 */
const getStatusLabel = (status: string): string => {
  const option = approvalStatusOptions.find(opt => opt.value === status);
  return option?.label ?? status;
};

/**
 * 获取类型标签文本
 * @param type - 类型值
 * @returns 类型标签
 */
const getTypeLabel = (type: string): string => {
  const option = approvalTypeOptions.find(opt => opt.value === type);
  return option?.label ?? type;
};

/**
 * 构建筛选参数对象
 * @returns 筛选参数
 */
const buildFilterParams = (): FilterChangePayload => {
  const params: FilterChangePayload = {};
  
  if (searchKeyword.value) {
    params.keyword = searchKeyword.value;
  }
  if (selectedStatus.value) {
    params.status = selectedStatus.value;
  }
  if (selectedType.value) {
    params.type = selectedType.value;
  }
  if (dateRange.value && dateRange.value.length === 2) {
    params.dateRange = dateRange.value;
  }
  
  return params;
};

/**
 * 触发筛选变更
 * @param immediate - 是否立即触发（用于重置场景）
 */
const triggerFilterChange = (immediate = false) => {
  const payload = buildFilterParams();
  
  if (immediate) {
    emit('filter-change', payload);
    // 同时更新 store
    syncToStore(payload);
  } else {
    emit('filter-change', payload);
  }
};

/**
 * 同步筛选参数到 Store
 * @param params - 筛选参数
 */
const syncToStore = (params: FilterChangePayload) => {
  // 通过 store action 更新筛选参数
  approvalStore.updateFilterParams({
    keyword: params.keyword ?? null,
    status: params.status ?? null,
    type: params.type ?? null,
    startDate: params.dateRange?.[0] ?? null,
    endDate: params.dateRange?.[1] ?? null,
  });
};

/**
 * 处理搜索输入变更（带防抖）
 */
const handleSearchChange = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    triggerFilterChange();
    syncToStore(buildFilterParams());
  }, 300);
};

/**
 * 处理状态筛选变更
 */
const handleStatusChange = () => {
  triggerFilterChange(true);
};

/**
 * 处理类型筛选变更
 */
const handleTypeChange = () => {
  triggerFilterChange(true);
};

/**
 * 处理日期范围变更
 */
const handleDateChange = () => {
  triggerFilterChange(true);
};

/**
 * 处理重置按钮点击
 */
const handleReset = () => {
  searchKeyword.value = '';
  selectedStatus.value = '';
  selectedType.value = '';
  dateRange.value = null;
  
  // 清空 store 筛选参数
  approvalStore.clearFilterParams();
  
  triggerFilterChange(true);
  
  ElMessage({
    message: '筛选条件已重置',
    type: 'info',
    duration: 2000,
  });
};

/**
 * 处理移除筛选标签
 * @param tagType - 标签类型
 */
const handleRemoveTag = (tagType: 'search' | 'status' | 'type' | 'date') => {
  switch (tagType) {
    case 'search':
      searchKeyword.value = '';
      break;
    case 'status':
      selectedStatus.value = '';
      break;
    case 'type':
      selectedType.value = '';
      break;
    case 'date':
      dateRange.value = null;
      break;
  }
  
  triggerFilterChange(true);
};

/**
 * 从外部同步筛选参数（用于 URL 参数恢复等场景）
 * @param params - 外部筛选参数
 */
const syncFromExternal = (params: FilterChangePayload) => {
  if (params.keyword !== undefined) {
    searchKeyword.value = params.keyword;
  }
  if (params.status !== undefined) {
    selectedStatus.value = params.status;
  }
  if (params.type !== undefined) {
    selectedType.value = params.type;
  }
  if (params.dateRange !== undefined) {
    dateRange.value = params.dateRange;
  }
};

// 暴露方法供父组件调用
defineExpose({
  syncFromExternal,
  reset: handleReset,
});
</script>

<style scoped>
.approval-filter {
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.filter-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filter-search {
  width: 240px;
}

.filter-status,
.filter-type {
  width: 160px;
}

.filter-date {
  width: 280px;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.filter-tags-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}

.filter-tags .el-tag {
  margin-right: 0;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .filter-container {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-search,
  .filter-status,
  .filter-type,
  .filter-date {
    width: 100%;
  }
  
  .filter-date {
    width: 100%;
  }
}
</style>