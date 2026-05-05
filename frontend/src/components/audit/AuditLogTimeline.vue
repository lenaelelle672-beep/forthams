<script setup lang="ts">
/**
 * AuditLogTimeline Component
 * 
 * SWARM-051 Phase 2: 审计日志组件集成
 * 
 * 功能说明：
 * - 展示资产变更的审计日志时间线
 * - 支持按操作类型筛选
 * - 支持分页展示
 * - 展示字段变更的 diff 信息
 * 
 * @see {@link https://spec.example.com/SWARM-051|SWARM-051 规格文档}
 * 
 * ATB 覆盖：
 * - ATB-011: 审计日志时间线倒序展示验证
 * - ATB-012: 变更字段高亮展示验证
 * - ATB-013: 操作类型筛选功能验证
 */

import { ref, computed, onMounted, watch } from 'vue';
import type { AuditLogEntry, AuditLogFilter, PaginationInfo } from './types/audit.types';

// Props 定义
interface Props {
  /** 资产 ID */
  assetId: string;
  /** 初始页码 */
  initialPage?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 是否显示筛选器 */
  showFilters?: boolean;
  /** 是否自动加载数据 */
  autoLoad?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  initialPage: 1,
  pageSize: 20,
  showFilters: true,
  autoLoad: true,
});

// Emits 定义
interface Emits {
  /** 加载完成事件 */
  (e: 'loaded', logs: AuditLogEntry[]): void;
  /** 加载错误事件 */
  (e: 'error', error: Error): void;
  /** 分页变化事件 */
  (e: 'page-change', page: number): void;
  /** 筛选变化事件 */
  (e: 'filter-change', filter: AuditLogFilter): void;
}

const emit = defineEmits<Emits>();

// 状态管理
const auditLogs = ref<AuditLogEntry[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const currentPage = ref(props.initialPage);
const totalPages = ref(1);
const totalItems = ref(0);

// 筛选状态
const filters = ref<AuditLogFilter>({
  action: undefined,
  actor: undefined,
  startDate: undefined,
  endDate: undefined,
});

// 操作类型选项
const actionOptions = [
  { value: undefined, label: '全部操作' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
  { value: 'VIEW', label: '查看' },
  { value: 'APPROVE', label: '审批' },
  { value: 'REJECT', label: '拒绝' },
  { value: 'TRANSFER', label: '转移' },
  { value: 'IMPORT', label: '导入' },
  { value: 'EXPORT', label: '导出' },
];

// 计算属性
/**
 * 计算分页信息
 */
const paginationInfo = computed<PaginationInfo>(() => ({
  currentPage: currentPage.value,
  pageSize: props.pageSize,
  total: totalItems.value,
  totalPages: totalPages.value,
}));

/**
 * 计算是否显示分页器
 */
const showPagination = computed(() => totalItems.value > props.pageSize);

/**
 * 计算页码数组
 */
const pageNumbers = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 3) {
      pages.push('...');
    }
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
  }
  
  return pages;
});

/**
 * 格式化时间戳为友好格式
 * @param timestamp - ISO 8601 时间戳
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
};

/**
 * 获取操作类型的显示标签
 * @param action - 操作类型
 */
const getActionLabel = (action: string): string => {
  const option = actionOptions.find(opt => opt.value === action);
  return option?.label || action;
};

/**
 * 获取操作类型的样式类
 * @param action - 操作类型
 */
const getActionClass = (action: string): string => {
  const classMap: Record<string, string> = {
    CREATE: 'action-create',
    UPDATE: 'action-update',
    DELETE: 'action-delete',
    VIEW: 'action-view',
    APPROVE: 'action-approve',
    REJECT: 'action-reject',
    TRANSFER: 'action-transfer',
    IMPORT: 'action-import',
    EXPORT: 'action-export',
  };
  return classMap[action] || 'action-default';
};

/**
 * 获取字段变更的展示信息
 * @param changes - 变更数据
 */
const getChangeDetails = (changes: Record<string, { old: unknown; new: unknown }> | null) => {
  if (!changes) return [];
  
  return Object.entries(changes).map(([field, change]) => ({
    field,
    oldValue: change.old,
    newValue: change.new,
    displayOldValue: formatChangeValue(change.old),
    displayNewValue: formatChangeValue(change.new),
  }));
};

/**
 * 格式化变更值用于展示
 * @param value - 原始值
 */
const formatChangeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '(空)';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * 检查值是否发生变化
 * @param oldVal - 旧值
 * @param newVal - 新值
 */
const hasValueChanged = (oldVal: unknown, newVal: unknown): boolean => {
  return JSON.stringify(oldVal) !== JSON.stringify(newVal);
};

// 方法

/**
 * 加载审计日志数据
 */
const loadAuditLogs = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    // 模拟 API 调用（实际项目中替换为真实 API）
    // const response = await auditService.getAuditLogsByAssetId(props.assetId, {
    //   page: currentPage.value,
    //   size: props.pageSize,
    //   ...filters.value,
    // });
    
    // 模拟数据响应
    const mockLogs: AuditLogEntry[] = generateMockLogs();
    
    // ATB-011: 验证时间倒序排列
    auditLogs.value = mockLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    totalItems.value = 156; // 模拟总数
    totalPages.value = Math.ceil(totalItems.value / props.pageSize);
    
    emit('loaded', auditLogs.value);
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error('加载审计日志失败');
    error.value = errorObj.message;
    emit('error', errorObj);
  } finally {
    isLoading.value = false;
  }
};

/**
 * 生成模拟日志数据（开发阶段使用）
 */
const generateMockLogs = (): AuditLogEntry[] => {
  const actions = ['CREATE', 'UPDATE', 'VIEW', 'APPROVE'];
  const actors = ['admin@example.com', 'user1@example.com', 'user2@example.com'];
  const fields = ['status', 'location', 'custodian', 'remarks'];
  
  return Array.from({ length: props.pageSize }, (_, index) => {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const timestamp = new Date(Date.now() - index * 3600000);
    
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (action === 'UPDATE') {
      const fieldCount = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < fieldCount; i++) {
        const field = fields[Math.floor(Math.random() * fields.length)];
        changes[field] = {
          old: `旧值-${field}-${index}`,
          new: `新值-${field}-${index}`,
        };
      }
    }
    
    return {
      id: `AUD-${timestamp.toISOString().slice(0, 10).replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
      assetId: props.assetId,
      action,
      actor: actors[Math.floor(Math.random() * actors.length)],
      timestamp: timestamp.toISOString(),
      changes: Object.keys(changes).length > 0 ? changes : null,
      metadata: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
    };
  });
};

/**
 * 处理页码变化
 * @param page - 目标页码
 */
const handlePageChange = (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  emit('page-change', page);
  loadAuditLogs();
};

/**
 * 处理筛选条件变化
 */
const handleFilterChange = () => {
  currentPage.value = 1;
  emit('filter-change', filters.value);
  loadAuditLogs();
};

/**
 * 重置筛选条件
 */
const resetFilters = () => {
  filters.value = {
    action: undefined,
    actor: undefined,
    startDate: undefined,
    endDate: undefined,
  };
  handleFilterChange();
};

/**
 * 展开/收起日志详情
 * @param logId - 日志 ID
 */
const toggleLogDetail = (logId: string) => {
  const log = auditLogs.value.find(l => l.id === logId);
  if (log) {
    log._expanded = !log._expanded;
  }
};

// 展开状态标记
interface AuditLogEntryWithMeta extends AuditLogEntry {
  _expanded?: boolean;
}

// 生命周期
onMounted(() => {
  if (props.autoLoad) {
    loadAuditLogs();
  }
});

// 监听 assetId 变化
watch(() => props.assetId, () => {
  currentPage.value = props.initialPage;
  loadAuditLogs();
});

// 监听筛选条件变化
watch(filters, () => {
  if (props.autoLoad) {
    handleFilterChange();
  }
}, { deep: true });

// 暴露方法给父组件
defineExpose({
  loadAuditLogs,
  resetFilters,
  currentPage,
  filters,
});
</script>

<template>
  <div class="audit-log-timeline" data-testid="audit-log-timeline">
    <!-- 筛选器区域 -->
    <div v-if="showFilters" class="audit-log-filters">
      <div class="filter-row">
        <!-- 操作类型筛选 -->
        <div class="filter-item">
          <label class="filter-label">操作类型</label>
          <select 
            v-model="filters.action"
            class="filter-select"
            data-testid="filter-action-type"
          >
            <option 
              v-for="option in actionOptions" 
              :key="String(option.value)" 
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
        
        <!-- 操作人筛选 -->
        <div class="filter-item">
          <label class="filter-label">操作人</label>
          <input 
            v-model="filters.actor"
            type="text"
            class="filter-input"
            placeholder="输入操作人邮箱"
          />
        </div>
        
        <!-- 时间范围筛选 -->
        <div class="filter-item">
          <label class="filter-label">开始日期</label>
          <input 
            v-model="filters.startDate"
            type="date"
            class="filter-input"
          />
        </div>
        
        <div class="filter-item">
          <label class="filter-label">结束日期</label>
          <input 
            v-model="filters.endDate"
            type="date"
            class="filter-input"
          />
        </div>
        
        <!-- 重置按钮 -->
        <button 
          class="filter-reset-btn"
          @click="resetFilters"
          type="button"
        >
          重置
        </button>
      </div>
    </div>
    
    <!-- 日志统计 -->
    <div class="audit-log-stats">
      <span class="stats-text">
        共 {{ totalItems }} 条记录，第 {{ currentPage }}/{{ totalPages }} 页
      </span>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="audit-log-loading" data-testid="audit-log-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="audit-log-error" data-testid="audit-log-error">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{{ error }}</span>
      <button class="retry-btn" @click="loadAuditLogs">重试</button>
    </div>
    
    <!-- 空状态 -->
    <div 
      v-else-if="auditLogs.length === 0" 
      class="audit-log-empty" 
      data-testid="audit-log-empty"
    >
      <span class="empty-icon">📋</span>
      <span class="empty-message">暂无审计日志记录</span>
    </div>
    
    <!-- 时间线列表 -->
    <div v-else class="audit-log-list" data-testid="audit-log-list">
      <div 
        v-for="(log, index) in auditLogs" 
        :key="log.id"
        :data-action="log.action"
        class="audit-log-item"
        :class="{ 'is-expanded': (log as AuditLogEntryWithMeta)._expanded }"
        data-testid="audit-log-item"
      >
        <!-- 时间线连接线 -->
        <div class="timeline-connector">
          <div class="timeline-dot" :class="getActionClass(log.action)"></div>
          <div v-if="index < auditLogs.length - 1" class="timeline-line"></div>
        </div>
        
        <!-- 日志内容 -->
        <div class="timeline-content">
          <!-- 头部信息 -->
          <div class="log-header">
            <div class="log-info">
              <span class="log-action" :class="getActionClass(log.action)">
                {{ getActionLabel(log.action) }}
              </span>
              <span class="log-actor">{{ log.actor }}</span>
              <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
            </div>
            
            <button 
              v-if="log.changes && Object.keys(log.changes).length > 0"
              class="expand-btn"
              @click="toggleLogDetail(log.id)"
              type="button"
              :aria-expanded="(log as AuditLogEntryWithMeta)._expanded"
            >
              {{ (log as AuditLogEntryWithMeta)._expanded ? '收起' : '查看详情' }}
            </button>
          </div>
          
          <!-- 变更详情 (ATB-012) -->
          <div 
            v-if="log.changes && Object.keys(log.changes).length > 0" 
            class="log-changes"
            :class="{ 'is-expanded': (log as AuditLogEntryWithMeta)._expanded }"
          >
            <div class="changes-header">
              <span class="changes-title">字段变更</span>
              <span class="changes-count">{{ Object.keys(log.changes).length }} 项</span>
            </div>
            
            <div class="changes-list">
              <div 
                v-for="change in getChangeDetails(log.changes)" 
                :key="change.field"
                class="change-item field-changed"
              >
                <div class="change-field">
                  <span class="field-label">{{ change.field }}</span>
                </div>
                <div class="change-values">
                  <div class="value-old">
                    <span class="value-label">旧值:</span>
                    <span class="value-text">{{ change.displayOldValue }}</span>
                  </div>
                  <div class="value-arrow">→</div>
                  <div class="value-new">
                    <span class="value-label">新值:</span>
                    <span class="value-text">{{ change.displayNewValue }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 元信息 -->
          <div v-if="log.metadata" class="log-metadata">
            <span v-if="log.metadata.ipAddress" class="metadata-item">
              IP: {{ log.metadata.ipAddress }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 分页器 -->
    <div v-if="showPagination && !isLoading && !error" class="audit-log-pagination">
      <!-- 上一页 -->
      <button 
        class="pagination-btn"
        :disabled="currentPage === 1"
        @click="handlePageChange(currentPage - 1)"
        type="button"
        data-testid="pagination-prev"
      >
        上一页
      </button>
      
      <!-- 页码 -->
      <template v-for="pageNum in pageNumbers" :key="pageNum">
        <span v-if="pageNum === '...'" class="pagination-ellipsis">...</span>
        <button 
          v-else
          class="pagination-btn"
          :class="{ 'is-active': pageNum === currentPage }"
          @click="handlePageChange(pageNum as number)"
          type="button"
          :data-testid="`pagination-page-${pageNum}`"
        >
          {{ pageNum }}
        </button>
      </template>
      
      <!-- 下一页 -->
      <button 
        class="pagination-btn"
        :disabled="currentPage === totalPages"
        @click="handlePageChange(currentPage + 1)"
        type="button"
        data-testid="pagination-next"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
/**
 * AuditLogTimeline Component Styles
 * 
 * 设计规范：
 * - 响应式布局，支持 Desktop (≥1280px) 和 Tablet (768-1279px)
 * - 时间线使用垂直布局，左侧为连接线
 * - 操作类型使用颜色编码区分
 * - 变更字段使用高亮样式标记 (ATB-012)
 */

.audit-log-timeline {
  --timeline-color: #e5e7eb;
  --timeline-dot-size: 12px;
  --transition-duration: 0.2s;
  
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
}

/* 筛选器样式 */
.audit-log-filters {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.filter-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.filter-select,
.filter-input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  background: #ffffff;
  transition: border-color var(--transition-duration);
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.filter-reset-btn {
  height: 36px;
  padding: 0 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all var(--transition-duration);
}

.filter-reset-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 统计信息 */
.audit-log-stats {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--timeline-color);
}

.stats-text {
  font-size: 13px;
  color: #6b7280;
}

/* 加载状态 */
.audit-log-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态 */
.audit-log-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  background: #fef2f2;
  border-radius: 6px;
  color: #dc2626;
}

.error-message {
  flex: 1;
}

.retry-btn {
  padding: 6px 16px;
  background: #dc2626;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background var(--transition-duration);
}

.retry-btn:hover {
  background: #b91c1c;
}

/* 空状态 */
.audit-log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 32px;
}

/* 时间线列表 */
.audit-log-list {
  display: flex;
  flex-direction: column;
}

.audit-log-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}

/* 时间线连接器 */
.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
}

.timeline-dot {
  width: var(--timeline-dot-size);
  height: var(--timeline-dot-size);
  border-radius: 50%;
  background: #d1d5db;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 2px #d1d5db;
  z-index: 1;
}

.timeline-dot.action-create {
  background: #10b981;
  box-shadow: 0 0 0 2px #10b981;
}

.timeline-dot.action-update {
  background: #f59e0b;
  box-shadow: 0 0 0 2px #f59e0b;
}

.timeline-dot.action-delete {
  background: #ef4444;
  box-shadow: 0 0 0 2px #ef4444;
}

.timeline-dot.action-view {
  background: #6b7280;
  box-shadow: 0 0 0 2px #6b7280;
}

.timeline-dot.action-approve {
  background: #10b981;
  box-shadow: 0 0 0 2px #10b981;
}

.timeline-dot.action-reject {
  background: #ef4444;
  box-shadow: 0 0 0 2px #ef4444;
}

.timeline-dot.action-transfer {
  background: #3b82f6;
  box-shadow: 0 0 0 2px #3b82f6;
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--timeline-color);
  margin-top: 4px;
}

/* 日志内容 */
.timeline-content {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.log-action {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #e5e7eb;
  color: #374151;
}

.log-action.action-create {
  background: #d1fae5;
  color: #065f46;
}

.log-action.action-update {
  background: #fef3c7;
  color: #92400e;
}

.log-action.action-delete {
  background: #fee2e2;
  color: #991b1b;
}

.log-action.action-view {
  background: #f3f4f6;
  color: #4b5563;
}

.log-action.action-approve {
  background: #d1fae5;
  color: #065f46;
}

.log-action.action-reject {
  background: #fee2e2;
  color: #991b1b;
}

.log-action.action-transfer {
  background: #dbeafe;
  color: #1e40af;
}

.log-actor {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.log-timestamp {
  font-size: 13px;
  color: #9ca3af;
}

.expand-btn {
  padding: 4px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all var(--transition-duration);
}

.expand-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 变更详情 */
.log-changes {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
  display: none;
}

.log-changes.is-expanded {
  display: block;
}

.changes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.changes-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.changes-count {
  font-size: 12px;
  color: #6b7280;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.change-item {
  background: #ffffff;
  border-radius: 4px;
  padding: 8px 12px;
  border-left: 3px solid #f59e0b;
}

/* ATB-012: 变更字段高亮样式 */
.change-item.field-changed {
  background: #fffbeb;
  border-left-color: #f59e0b;
}

.change-field {
  margin-bottom: 4px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
}

.change-values {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.value-old,
.value-new {
  display: flex;
  align-items: center;
  gap: 4px;
}

.value-label {
  font-size: 12px;
  color: #9ca3af;
}

.value-text {
  font-size: 13px;
  color: #374151;
}

.value-old .value-text {
  text-decoration: line-through;
  color: #9ca3af;
}

.value-arrow {
  color: #6b7280;
}

/* 元信息 */
.log-metadata {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.metadata-item {
  font-size: 12px;
  color: #9ca3af;
}

/* 分页器 */
.audit-log-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--timeline-color);
}

.pagination-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all var(--transition-duration);
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.is-active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.pagination-ellipsis {
  padding: 0 8px;
  color: #9ca3af;
}

/* 响应式适配 */
@media (max-width: 1279px) {
  .audit-log-timeline {
    padding: 12px;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-item {
    min-width: 100%;
  }
  
  .log-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .log-info {
    flex-wrap: wrap;
  }
  
  .change-values {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .value-arrow {
    transform: rotate(90deg);
  }
}
</style>