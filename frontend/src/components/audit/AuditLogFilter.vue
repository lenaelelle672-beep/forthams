<script setup lang="ts">
/**
 * AuditLogFilter.vue
 * 
 * 审计日志筛选器组件
 * 用于对资产审计日志进行多维度筛选
 * 
 * @description
 * - 支持按操作类型 (CREATE, UPDATE, DELETE, VIEW) 筛选
 * - 支持按时间范围 (起始日期/结束日期) 筛选
 * - 支持按操作人筛选
 * - 提供筛选重置功能
 * 
 * @see {@link https://swarm.atlassian.net/wiki/spaces/SWARM/pages/051} SWARM-051
 * @see {@link https://swarm.atlassian.net/wiki/spaces/SWARM/pages/051#ATB-013} ATB-013
 * 
 * @version 1.0
 * @date 2024
 */

import { ref, computed, watch, emit } from 'vue';

// ==================== 类型定义 ====================

/**
 * 审计日志操作类型枚举
 */
export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | '';

/**
 * 审计日志筛选条件接口
 */
export interface AuditLogFilterCriteria {
  /** 资产ID */
  assetId: string;
  /** 操作类型筛选 */
  action: AuditActionType;
  /** 起始日期 (ISO 8601) */
  startDate: string;
  /** 结束日期 (ISO 8601) */
  endDate: string;
  /** 操作人筛选 */
  actor: string;
}

/**
 * 审计日志筛选器属性接口
 */
export interface AuditLogFilterProps {
  /** 资产ID (必填) */
  assetId: string;
  /** 是否禁用筛选器 */
  disabled?: boolean;
  /** 是否显示操作人筛选 */
  showActorFilter?: boolean;
  /** 是否显示时间范围筛选 */
  showDateRangeFilter?: boolean;
  /** 初始筛选条件 */
  initialCriteria?: Partial<AuditLogFilterCriteria>;
  /** 是否在筛选变化时自动提交 */
  autoSubmit?: boolean;
}

/**
 * 审计日志筛选器事件
 */
export interface AuditLogFilterEvents {
  /** 筛选条件变更事件 */
  (e: 'filter-change', criteria: AuditLogFilterCriteria): void;
  /** 筛选提交事件 */
  (e: 'filter-submit', criteria: AuditLogFilterCriteria): void;
  /** 筛选重置事件 */
  (e: 'filter-reset'): void;
}

// ==================== Props & Emits ====================

const props = withDefaults(defineProps<AuditLogFilterProps>(), {
  disabled: false,
  showActorFilter: true,
  showDateRangeFilter: true,
  autoSubmit: true,
});

const emit = defineEmits<AuditLogFilterEvents>();

// ==================== 常量定义 ====================

/**
 * 操作类型选项配置
 */
const ACTION_OPTIONS = [
  { value: '', label: '全部操作', icon: '📋' },
  { value: 'CREATE', label: '创建', icon: '➕', color: 'text-green-600' },
  { value: 'UPDATE', label: '更新', icon: '✏️', color: 'text-blue-600' },
  { value: 'DELETE', label: '删除', icon: '🗑️', color: 'text-red-600' },
  { value: 'VIEW', label: '查看', icon: '👁️', color: 'text-gray-600' },
] as const;

/**
 * 快捷时间范围选项
 */
const QUICK_DATE_RANGES = [
  { label: '今天', days: 0 },
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
] as const;

// ==================== 响应式状态 ====================

/**
 * 当前筛选条件
 */
const filterCriteria = ref<AuditLogFilterCriteria>({
  assetId: props.assetId,
  action: '',
  startDate: '',
  endDate: '',
  actor: '',
});

/**
 * 是否有未应用的筛选变更
 */
const hasPendingChanges = ref(false);

/**
 * 筛选器展开状态
 */
const isExpanded = ref(true);

/**
 * 加载状态
 */
const isLoading = ref(false);

// ==================== 计算属性 ====================

/**
 * 当前选中的操作类型配置
 */
const selectedActionConfig = computed(() => {
  return ACTION_OPTIONS.find(opt => opt.value === filterCriteria.value.action) || ACTION_OPTIONS[0];
});

/**
 * 是否存在有效的筛选条件
 */
const hasActiveFilters = computed(() => {
  const { action, startDate, endDate, actor } = filterCriteria.value;
  return !!(action || startDate || endDate || actor);
});

/**
 * 活跃筛选条件计数
 */
const activeFilterCount = computed(() => {
  let count = 0;
  if (filterCriteria.value.action) count++;
  if (filterCriteria.value.startDate) count++;
  if (filterCriteria.value.endDate) count++;
  if (filterCriteria.value.actor) count++;
  return count;
});

/**
 * 筛选条件的 API 查询参数
 */
const apiQueryParams = computed(() => {
  const params: Record<string, string> = {};
  
  if (filterCriteria.value.action) {
    params.action = filterCriteria.value.action;
  }
  if (filterCriteria.value.startDate) {
    params.startDate = filterCriteria.value.startDate;
  }
  if (filterCriteria.value.endDate) {
    params.endDate = filterCriteria.value.endDate;
  }
  if (filterCriteria.value.actor) {
    params.actor = filterCriteria.value.actor.trim();
  }
  
  return params;
});

// ==================== 方法定义 ====================

/**
 * 初始化筛选条件
 * 
 * @description
 * 根据初始筛选条件或默认值为筛选器设置初始值
 */
const initializeFilters = (): void => {
  filterCriteria.value = {
    assetId: props.assetId,
    action: props.initialCriteria?.action || '',
    startDate: props.initialCriteria?.startDate || '',
    endDate: props.initialCriteria?.endDate || '',
    actor: props.initialCriteria?.actor || '',
  };
};

/**
 * 处理操作类型变更
 * 
 * @param event - 变更事件
 */
const handleActionChange = (event: Event): void => {
  const target = event.target as HTMLSelectElement;
  filterCriteria.value.action = target.value as AuditActionType;
  markPendingChanges();
};

/**
 * 处理起始日期变更
 * 
 * @param event - 变更事件
 */
const handleStartDateChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  filterCriteria.value.startDate = target.value;
  markPendingChanges();
};

/**
 * 处理结束日期变更
 * 
 * @param event - 变更事件
 */
const handleEndDateChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  filterCriteria.value.endDate = target.value;
  markPendingChanges();
};

/**
 * 处理操作人输入变更
 * 
 * @param event - 变更事件
 */
const handleActorChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  filterCriteria.value.actor = target.value;
  markPendingChanges();
};

/**
 * 标记存在未应用的变更
 */
const markPendingChanges = (): void => {
  hasPendingChanges.value = true;
};

/**
 * 应用筛选条件
 * 
 * @description
 * 触发筛选变更事件，并将变更状态重置
 */
const applyFilters = (): void => {
  hasPendingChanges.value = false;
  
  // 验证日期范围
  if (filterCriteria.value.startDate && filterCriteria.value.endDate) {
    const start = new Date(filterCriteria.value.startDate);
    const end = new Date(filterCriteria.value.endDate);
    
    if (start > end) {
      console.warn('[AuditLogFilter] 起始日期不能晚于结束日期');
      return;
    }
  }
  
  emit('filter-change', { ...filterCriteria.value });
  
  if (props.autoSubmit) {
    emit('filter-submit', { ...filterCriteria.value });
  }
};

/**
 * 重置筛选条件
 * 
 * @description
 * 将所有筛选条件恢复为默认值，并触发重置事件
 */
const resetFilters = (): void => {
  filterCriteria.value = {
    assetId: props.assetId,
    action: '',
    startDate: '',
    endDate: '',
    actor: '',
  };
  
  hasPendingChanges.value = false;
  emit('filter-reset');
};

/**
 * 应用快捷时间范围
 * 
 * @param days - 天数 (0 表示今天)
 */
const applyQuickDateRange = (days: number): void => {
  const now = new Date();
  const end = new Date(now);
  
  if (days === 0) {
    // 今天
    filterCriteria.value.startDate = formatDateToInput(now);
    filterCriteria.value.endDate = formatDateToInput(end);
  } else {
    // 最近 N 天
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    filterCriteria.value.startDate = formatDateToInput(start);
    filterCriteria.value.endDate = formatDateToInput(end);
  }
  
  markPendingChanges();
};

/**
 * 将日期格式化为输入框值 (YYYY-MM-DD)
 * 
 * @param date - 日期对象
 * @returns 格式化后的日期字符串
 */
const formatDateToInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 清除日期范围
 */
const clearDateRange = (): void => {
  filterCriteria.value.startDate = '';
  filterCriteria.value.endDate = '';
  markPendingChanges();
};

/**
 * 切换筛选器展开/收起状态
 */
const toggleExpanded = (): void => {
  isExpanded.value = !isExpanded.value;
};

// ==================== 监听器 ====================

/**
 * 监听资产ID变更
 */
watch(
  () => props.assetId,
  (newAssetId) => {
    filterCriteria.value.assetId = newAssetId;
  }
);

/**
 * 监听初始筛选条件变更
 */
watch(
  () => props.initialCriteria,
  (newCriteria) => {
    if (newCriteria) {
      initializeFilters();
    }
  },
  { deep: true }
);

// ==================== 生命周期 ====================

/**
 * 组件挂载时初始化
 */
initializeFilters();

// ==================== 暴露方法 ====================

/**
 * 暴露给父组件的方法
 */
defineExpose({
  /** 获取当前筛选条件 */
  getCriteria: () => ({ ...filterCriteria.value }),
  /** 获取 API 查询参数 */
  getQueryParams: () => ({ ...apiQueryParams.value }),
  /** 是否存在活跃筛选 */
  hasActiveFilters,
  /** 重置筛选条件 */
  reset: resetFilters,
  /** 应用筛选条件 */
  apply: applyFilters,
});
</script>

<template>
  <div
    class="audit-log-filter"
    :class="{
      'audit-log-filter--disabled': disabled,
      'audit-log-filter--expanded': isExpanded,
    }"
    data-testid="audit-log-filter"
  >
    <!-- 筛选器头部 -->
    <div class="audit-log-filter__header" @click="toggleExpanded">
      <div class="audit-log-filter__title">
        <span class="audit-log-filter__icon">🔍</span>
        <span class="audit-log-filter__label">审计日志筛选</span>
        <span
          v-if="activeFilterCount > 0"
          class="audit-log-filter__badge"
          data-testid="filter-count-badge"
        >
          {{ activeFilterCount }}
        </span>
      </div>
      <button
        type="button"
        class="audit-log-filter__toggle"
        :aria-expanded="isExpanded"
        aria-label="切换筛选器展开状态"
      >
        <span :class="['audit-log-filter__chevron', { 'audit-log-filter__chevron--up': isExpanded }]">
          ▼
        </span>
      </button>
    </div>

    <!-- 筛选器内容 -->
    <div
      v-show="isExpanded"
      class="audit-log-filter__content"
    >
      <div class="audit-log-filter__grid">
        <!-- 操作类型筛选 -->
        <div class="audit-log-filter__field">
          <label
            for="filter-action-type"
            class="audit-log-filter__label"
          >
            操作类型
          </label>
          <div class="audit-log-filter__select-wrapper">
            <select
              id="filter-action-type"
              v-model="filterCriteria.action"
              class="audit-log-filter__select filter-action-type"
              :disabled="disabled"
              data-testid="filter-action-type"
              @change="handleActionChange"
            >
              <option
                v-for="option in ACTION_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.icon }} {{ option.label }}
              </option>
            </select>
            <span
              v-if="filterCriteria.action"
              class="audit-log-filter__action-indicator"
              :class="selectedActionConfig.color"
            >
              {{ selectedActionConfig.icon }}
            </span>
          </div>
        </div>

        <!-- 时间范围筛选 -->
        <div
          v-if="showDateRangeFilter"
          class="audit-log-filter__field audit-log-filter__field--date-range"
        >
          <label class="audit-log-filter__label">时间范围</label>
          <div class="audit-log-filter__date-group">
            <input
              type="date"
              v-model="filterCriteria.startDate"
              class="audit-log-filter__date-input"
              :disabled="disabled"
              data-testid="filter-start-date"
              @change="handleStartDateChange"
            />
            <span class="audit-log-filter__date-separator">至</span>
            <input
              type="date"
              v-model="filterCriteria.endDate"
              class="audit-log-filter__date-input"
              :disabled="disabled"
              data-testid="filter-end-date"
              @change="handleEndDateChange"
            />
            <button
              v-if="filterCriteria.startDate || filterCriteria.endDate"
              type="button"
              class="audit-log-filter__clear-date"
              @click="clearDateRange"
              aria-label="清除日期范围"
            >
              ✕
            </button>
          </div>
          
          <!-- 快捷时间范围按钮 -->
          <div class="audit-log-filter__quick-dates">
            <button
              v-for="range in QUICK_DATE_RANGES"
              :key="range.days"
              type="button"
              class="audit-log-filter__quick-date-btn"
              :class="{
                'audit-log-filter__quick-date-btn--active':
                  range.days === 0 &&
                  filterCriteria.startDate === formatDateToInput(new Date()) &&
                  filterCriteria.endDate === formatDateToInput(new Date())
              }"
              @click="applyQuickDateRange(range.days)"
              :disabled="disabled"
            >
              {{ range.label }}
            </button>
          </div>
        </div>

        <!-- 操作人筛选 -->
        <div
          v-if="showActorFilter"
          class="audit-log-filter__field"
        >
          <label
            for="filter-actor"
            class="audit-log-filter__label"
          >
            操作人
          </label>
          <input
            type="text"
            id="filter-actor"
            v-model="filterCriteria.actor"
            class="audit-log-filter__input"
            :disabled="disabled"
            placeholder="请输入操作人名称"
            data-testid="filter-actor"
            @input="handleActorChange"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="audit-log-filter__actions">
        <button
          type="button"
          class="audit-log-filter__btn audit-log-filter__btn--reset"
          :disabled="disabled || !hasActiveFilters"
          @click="resetFilters"
          data-testid="filter-reset-btn"
        >
          <span>🔄</span>
          重置
        </button>
        <button
          type="button"
          class="audit-log-filter__btn audit-log-filter__btn--submit"
          :disabled="disabled"
          :class="{ 'audit-log-filter__btn--pending': hasPendingChanges }"
          @click="applyFilters"
          data-testid="filter-submit-btn"
        >
          <span v-if="isLoading">⏳</span>
          <span v-else>✅</span>
          应用筛选
        </button>
      </div>
    </div>

    <!-- 筛选状态提示 -->
    <div
      v-if="hasPendingChanges"
      class="audit-log-filter__pending"
      data-testid="filter-pending-indicator"
    >
      您有未应用的筛选变更
    </div>
  </div>
</template>

<style scoped>
/**
 * 审计日志筛选器样式
 * 
 * 设计规范:
 * - 使用 CSS Grid 布局实现响应式筛选区域
 * - 支持展开/收起动画
 * - 提供视觉反馈指示器
 */

.audit-log-filter {
  --filter-primary-color: #3b82f6;
  --filter-success-color: #22c55e;
  --filter-warning-color: #f59e0b;
  --filter-danger-color: #ef4444;
  --filter-gray-color: #6b7280;
  
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
}

.audit-log-filter:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.audit-log-filter--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* 头部样式 */
.audit-log-filter__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(to right, #f9fafb, #ffffff);
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  user-select: none;
}

.audit-log-filter__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audit-log-filter__icon {
  font-size: 1.125rem;
}

.audit-log-filter__label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9375rem;
}

.audit-log-filter__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  background: var(--filter-primary-color);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 9999px;
}

.audit-log-filter__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: var(--filter-gray-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.audit-log-filter__toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.audit-log-filter__chevron {
  font-size: 0.75rem;
  transition: transform 0.2s ease;
}

.audit-log-filter__chevron--up {
  transform: rotate(180deg);
}

/* 内容区域样式 */
.audit-log-filter__content {
  padding: 1.25rem;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.audit-log-filter__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

/* 字段样式 */
.audit-log-filter__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.audit-log-filter__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
}

.audit-log-filter__select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.audit-log-filter__select {
  flex: 1;
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  transition: all 0.15s ease;
}

.audit-log-filter__select:hover {
  border-color: #9ca3af;
}

.audit-log-filter__select:focus {
  outline: none;
  border-color: var(--filter-primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.audit-log-filter__action-indicator {
  position: absolute;
  right: 0.75rem;
  pointer-events: none;
  font-size: 1rem;
}

/* 日期范围样式 */
.audit-log-filter__date-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audit-log-filter__date-input {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.audit-log-filter__date-input:hover {
  border-color: #9ca3af;
}

.audit-log-filter__date-input:focus {
  outline: none;
  border-color: var(--filter-primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.audit-log-filter__date-separator {
  color: var(--filter-gray-color);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.audit-log-filter__clear-date {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: #f3f4f6;
  border: none;
  border-radius: 0.375rem;
  color: var(--filter-gray-color);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.audit-log-filter__clear-date:hover {
  background: #fee2e2;
  color: var(--filter-danger-color);
}

/* 快捷日期按钮 */
.audit-log-filter__quick-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.audit-log-filter__quick-date-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  color: var(--filter-gray-color);
  background: #f3f4f6;
  border: 1px solid transparent;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.audit-log-filter__quick-date-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.audit-log-filter__quick-date-btn--active {
  background: var(--filter-primary-color);
  color: white;
}

/* 输入框样式 */
.audit-log-filter__input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.audit-log-filter__input:hover {
  border-color: #9ca3af;
}

.audit-log-filter__input:focus {
  outline: none;
  border-color: var(--filter-primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.audit-log-filter__input::placeholder {
  color: #9ca3af;
}

/* 操作按钮样式 */
.audit-log-filter__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #f3f4f6;
}

.audit-log-filter__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.audit-log-filter__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.audit-log-filter__btn--reset {
  color: #6b7280;
  background: #f3f4f6;
}

.audit-log-filter__btn--reset:hover:not(:disabled) {
  background: #e5e7eb;
  color: #374151;
}

.audit-log-filter__btn--submit {
  color: white;
  background: var(--filter-primary-color);
}

.audit-log-filter__btn--submit:hover:not(:disabled) {
  background: #2563eb;
}

.audit-log-filter__btn--pending {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 待应用状态提示 */
.audit-log-filter__pending {
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--filter-warning-color);
  background: #fef3c7;
  border-top: 1px solid #fde68a;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .audit-log-filter__grid {
    grid-template-columns: 1fr;
  }
  
  .audit-log-filter__date-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .audit-log-filter__date-separator {
    text-align: center;
    padding: 0.25rem 0;
  }
  
  .audit-log-filter__actions {
    flex-direction: column;
  }
  
  .audit-log-filter__btn {
    width: 100%;
    justify-content: center;
  }
}
</style>