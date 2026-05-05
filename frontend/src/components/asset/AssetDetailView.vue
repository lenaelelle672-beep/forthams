<template>
  <div class="asset-detail-view">
    <!-- 页面头部 -->
    <header class="asset-detail-header">
      <div class="header-content">
        <button class="back-button" @click="handleBack" aria-label="返回">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="header-info">
          <h1 class="asset-title">{{ assetData?.name || '资产详情' }}</h1>
          <span class="asset-id">{{ assetId }}</span>
        </div>
        <div class="header-actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </header>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span class="loading-text">正在加载资产数据...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" @click="retryLoad">重试</button>
    </div>

    <!-- 主要内容区域 -->
    <main v-else class="asset-detail-content">
      <!-- 资产信息面板 -->
      <section class="asset-info-panel" aria-labelledby="asset-info-heading">
        <h2 id="asset-info-heading" class="section-title">资产信息</h2>
        <div class="info-grid">
          <div
            v-for="field in displayFields"
            :key="field.key"
            class="info-item"
            :class="{ 'is-auditable': field.isAuditable, 'is-sensitive': field.isSensitive }"
          >
            <dt class="info-label">{{ field.label }}</dt>
            <dd class="info-value">
              <span v-if="field.isSensitive && !hasSensitivePermission" class="masked-value">
                ****
              </span>
              <span v-else>{{ formatFieldValue(field.value, field.type) }}</span>
            </dd>
          </div>
        </div>
      </section>

      <!-- 审计日志时间线 -->
      <section class="audit-log-section" aria-labelledby="audit-log-heading">
        <header class="section-header">
          <h2 id="audit-log-heading" class="section-title">审计日志</h2>
          <div class="audit-filters">
            <select
              v-model="auditFilters.action"
              class="filter-select"
              aria-label="筛选操作类型"
            >
              <option value="">全部操作</option>
              <option value="CREATE">创建</option>
              <option value="UPDATE">更新</option>
              <option value="DELETE">删除</option>
              <option value="VIEW">查看</option>
            </select>
            <input
              v-model="auditFilters.startDate"
              type="date"
              class="filter-date"
              aria-label="起始日期"
            />
            <input
              v-model="auditFilters.endDate"
              type="date"
              class="filter-date"
              aria-label="结束日期"
            />
            <button class="filter-reset-button" @click="resetAuditFilters">
              重置筛选
            </button>
          </div>
        </header>

        <!-- 审计日志加载状态 -->
        <div v-if="auditLogsLoading" class="audit-loading">
          <div class="loading-spinner small"></div>
          <span>加载审计日志...</span>
        </div>

        <!-- 审计日志列表 -->
        <div v-else-if="filteredAuditLogs.length > 0" class="audit-log-timeline">
          <div
            v-for="log in paginatedAuditLogs"
            :key="log.id"
            class="audit-log-item"
            :data-action="log.action"
            :data-id="log.id"
          >
            <div class="log-timeline-marker" :class="`action-${log.action.toLowerCase()}`">
              <span class="marker-dot"></span>
              <span class="marker-line"></span>
            </div>
            <div class="log-content">
              <header class="log-header">
                <span class="log-action" :class="`action-badge-${log.action.toLowerCase()}`">
                  {{ getActionLabel(log.action) }}
                </span>
                <time class="log-timestamp" :datetime="log.timestamp">
                  {{ formatTimestamp(log.timestamp) }}
                </time>
              </header>
              <div class="log-meta">
                <span class="log-actor">
                  <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {{ log.actor }}
                </span>
              </div>
              <!-- 变更详情展开面板 -->
              <div v-if="log.changes && Object.keys(log.changes).length > 0" class="log-changes">
                <button
                  class="changes-toggle"
                  @click="toggleLogDetail(log.id)"
                  :aria-expanded="expandedLogIds.includes(log.id)"
                >
                  <svg
                    class="toggle-icon"
                    :class="{ expanded: expandedLogIds.includes(log.id) }"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  查看变更详情 ({{ Object.keys(log.changes).length }} 项)
                </button>
                <div
                  v-if="expandedLogIds.includes(log.id)"
                  class="changes-detail field-change-diff"
                >
                  <div
                    v-for="(change, fieldName) in log.changes"
                    :key="fieldName"
                    class="field-changed"
                  >
                    <span class="field-name">{{ getFieldLabel(fieldName) }}</span>
                    <div class="field-values">
                      <span class="old-value">
                        <span class="value-label">旧值:</span>
                        <span class="value-text">{{ change.old ?? '空' }}</span>
                      </span>
                      <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      <span class="new-value">
                        <span class="value-label">新值:</span>
                        <span class="value-text">{{ change.new ?? '空' }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="audit-empty">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p class="empty-text">暂无审计日志记录</p>
        </div>

        <!-- 分页控件 -->
        <nav v-if="totalPages > 1" class="audit-pagination" aria-label="审计日志分页">
          <button
            class="page-button"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
            aria-label="上一页"
          >
            上一页
          </button>
          <div class="page-info">
            <span>第 {{ currentPage }} 页</span>
            <span class="page-divider">/</span>
            <span>共 {{ totalPages }} 页</span>
            <span class="page-total">({{ totalAuditLogs }} 条记录)</span>
          </div>
          <button
            class="page-button"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
            aria-label="下一页"
          >
            下一页
          </button>
        </nav>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * AssetDetailView Component
 * @description 资产详情页面主视图组件，负责展示资产完整信息和审计日志时间线
 * @see SWARM-051 Phase 1-3
 * @requires AssetInfoPanel 资产信息面板
 * @requires AuditLogTimeline 审计日志时间线
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useAssetById } from '@/hooks/useAssetById';

// Props 定义
interface Props {
  /** 资产唯一标识 */
  assetId: string;
  /** 是否显示审计日志模块 */
  showAuditLog?: boolean;
  /** 每页审计日志数量 */
  auditPageSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  showAuditLog: true,
  auditPageSize: 20,
});

// Emits 定义
const emit = defineEmits<{
  /** 返回事件 */
  (e: 'back'): void;
  /** 资产数据加载成功 */
  (e: 'asset-loaded', data: AssetDetailData): void;
  /** 审计日志加载成功 */
  (e: 'audit-logs-loaded', logs: AuditLogEntry[]): void;
}>();

// 资产数据相关
interface AssetDetailData {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  purchaseDate?: string;
  location?: string;
  department?: string;
  originalValue?: number;
  currentValue?: number;
  supplier?: string;
  model?: string;
  serialNumber?: string;
  [key: string]: unknown;
}

interface FieldMapping {
  key: string;
  label: string;
  value?: unknown;
  type: 'text' | 'number' | 'date' | 'currency' | 'status';
  isAuditable: boolean;
  isSensitive: boolean;
}

// 审计日志相关类型
interface AuditLogEntry {
  id: string;
  asset_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  actor: string;
  timestamp: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

interface AuditFilters {
  action: string;
  startDate: string;
  endDate: string;
}

// 状态管理
const isLoading = ref(true);
const error = ref<string | null>(null);
const assetData = ref<AssetDetailData | null>(null);
const expandedLogIds = ref<string[]>([]);
const hasSensitivePermission = ref(false);

// 分页状态
const currentPage = ref(1);

// 审计日志筛选器
const auditFilters = ref<AuditFilters>({
  action: '',
  startDate: '',
  endDate: '',
});

// 使用 Hooks
const {
  logs: auditLogs,
  loading: auditLogsLoading,
  total: totalAuditLogs,
  fetchLogs: fetchAuditLogs,
} = useAuditLogs(props.assetId, {
  pageSize: props.auditPageSize,
});

const {
  asset,
  loading: assetLoading,
  error: assetError,
  fetchAsset,
} = useAssetById(props.assetId);

// 字段映射配置
const fieldMappings: Record<string, FieldMapping> = {
  name: { key: 'name', label: '资产名称', type: 'text', isAuditable: false, isSensitive: false },
  code: { key: 'code', label: '资产编号', type: 'text', isAuditable: false, isSensitive: false },
  type: { key: 'type', label: '资产类型', type: 'text', isAuditable: true, isSensitive: false },
  status: { key: 'status', label: '当前状态', type: 'status', isAuditable: true, isSensitive: false },
  purchaseDate: { key: 'purchaseDate', label: '购置日期', type: 'date', isAuditable: true, isSensitive: false },
  location: { key: 'location', label: '存放地点', type: 'text', isAuditable: true, isSensitive: false },
  department: { key: 'department', label: '使用部门', type: 'text', isAuditable: true, isSensitive: false },
  originalValue: { key: 'originalValue', label: '原值', type: 'currency', isAuditable: true, isSensitive: true },
  currentValue: { key: 'currentValue', label: '当前净值', type: 'currency', isAuditable: true, isSensitive: true },
  supplier: { key: 'supplier', label: '供应商', type: 'text', isAuditable: true, isSensitive: false },
  model: { key: 'model', label: '规格型号', type: 'text', isAuditable: false, isSensitive: false },
  serialNumber: { key: 'serialNumber', label: '序列号', type: 'text', isAuditable: false, isSensitive: true },
};

// 计算属性：展示字段
const displayFields = computed<FieldMapping[]>(() => {
  if (!assetData.value) return [];

  return Object.entries(fieldMappings)
    .filter(([key]) => key in assetData.value!)
    .map(([key, mapping]) => ({
      ...mapping,
      value: assetData.value![key],
    }));
});

// 计算属性：筛选后的审计日志
const filteredAuditLogs = computed<AuditLogEntry[]>(() => {
  let logs = [...auditLogs.value];

  // 按操作类型筛选
  if (auditFilters.value.action) {
    logs = logs.filter(log => log.action === auditFilters.value.action);
  }

  // 按日期范围筛选
  if (auditFilters.value.startDate) {
    const startDate = new Date(auditFilters.value.startDate);
    logs = logs.filter(log => new Date(log.timestamp) >= startDate);
  }

  if (auditFilters.value.endDate) {
    const endDate = new Date(auditFilters.value.endDate);
    endDate.setHours(23, 59, 59, 999);
    logs = logs.filter(log => new Date(log.timestamp) <= endDate);
  }

  return logs;
});

// 计算属性：分页后的审计日志
const paginatedAuditLogs = computed<AuditLogEntry[]>(() => {
  const start = (currentPage.value - 1) * props.auditPageSize;
  const end = start + props.auditPageSize;
  return filteredAuditLogs.value.slice(start, end);
});

// 计算属性：总页数
const totalPages = computed(() => {
  return Math.ceil(filteredAuditLogs.value.length / props.auditPageSize) || 1;
});

// 方法：重试加载
const retryLoad = async () => {
  error.value = null;
  await loadAssetData();
};

// 方法：加载资产数据
const loadAssetData = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    await fetchAsset();
    assetData.value = asset.value as AssetDetailData;
    emit('asset-loaded', assetData.value);

    if (props.showAuditLog) {
      await fetchAuditLogs({
        assetId: props.assetId,
        page: currentPage.value,
        pageSize: props.auditPageSize,
        ...auditFilters.value,
      });
      emit('audit-logs-loaded', auditLogs.value);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载资产数据失败';
  } finally {
    isLoading.value = false;
  }
};

// 方法：返回上一页
const handleBack = () => {
  emit('back');
};

// 方法：切换日志详情展开状态
const toggleLogDetail = (logId: string) => {
  const index = expandedLogIds.value.indexOf(logId);
  if (index > -1) {
    expandedLogIds.value.splice(index, 1);
  } else {
    expandedLogIds.value.push(logId);
  }
};

// 方法：重置审计日志筛选器
const resetAuditFilters = () => {
  auditFilters.value = {
    action: '',
    startDate: '',
    endDate: '',
  };
  currentPage.value = 1;
};

// 方法：跳转分页
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

// 方法：格式化字段值
const formatFieldValue = (value: unknown, type: string): string => {
  if (value === null || value === undefined) return '-';

  switch (type) {
    case 'currency':
      return typeof value === 'number' ? `¥${value.toLocaleString('zh-CN')}` : String(value);
    case 'date':
      return value instanceof Date
        ? value.toLocaleDateString('zh-CN')
        : String(value);
    case 'status':
      return getStatusLabel(String(value));
    default:
      return String(value);
  }
};

// 方法：获取状态标签
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    ACTIVE: '在用',
    IDLE: '闲置',
    MAINTENANCE: '维修中',
    SCRAPPED: '已报废',
    TRANSFERRED: '已调拨',
    PENDING: '待审批',
  };
  return statusMap[status] || status;
};

// 方法：获取操作标签
const getActionLabel = (action: string): string => {
  const actionMap: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    VIEW: '查看',
  };
  return actionMap[action] || action;
};

// 方法：获取字段标签
const getFieldLabel = (fieldName: string): string => {
  const field = fieldMappings[fieldName];
  return field?.label || fieldName;
};

// 方法：格式化时间戳
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 监听审计日志筛选变化
watch(auditFilters, () => {
  currentPage.value = 1;
}, { deep: true });

// 监听资产 ID 变化
watch(() => props.assetId, async (newId) => {
  if (newId) {
    await loadAssetData();
  }
});

// 生命周期：组件挂载
onMounted(async () => {
  // 模拟权限检查
  hasSensitivePermission.value = await checkSensitivePermission();
  await loadAssetData();
});

// 模拟权限检查方法
const checkSensitivePermission = async (): Promise<boolean> => {
  // 实际应调用权限服务检查用户是否具有 ROLE_AUDITOR 或 ROLE_ADMIN 权限
  // 此处简化处理
  return true;
};
</script>

<style scoped>
/**
 * AssetDetailView 样式
 * 遵循 SPEC 中的技术约束和性能要求
 */

/* 变量定义 */
.asset-detail-view {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #06b6d4;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: var(--color-text-primary);
  background-color: var(--color-bg-secondary);
  min-height: 100vh;
}

/* 头部样式 */
.asset-detail-header {
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 1280px;
  margin: 0 auto;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-md);
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: var(--color-bg-tertiary);
}

.back-button .icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-text-secondary);
}

.header-info {
  flex: 1;
}

.asset-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.5;
}

.asset-id {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1rem;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.small {
  width: 1.25rem;
  height: 1.25rem;
  border-width: 2px;
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误状态 */
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1rem;
  padding: 2rem;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: var(--color-danger);
}

.error-message {
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}

.retry-button {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: #2563eb;
}

/* 主要内容区域 */
.asset-detail-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 资产信息面板 */
.asset-info-panel {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.25rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border-light);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-item.is-auditable .info-label::after {
  content: '';
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background-color: var(--color-info);
  margin-left: 0.25rem;
  vertical-align: middle;
}

.info-item.is-sensitive .info-value {
  color: var(--color-text-secondary);
  font-family: monospace;
}

.info-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin: 0;
}

.info-value {
  font-size: 0.9375rem;
  color: var(--color-text-primary);
  margin: 0;
}

.masked-value {
  color: var(--color-text-secondary);
  font-style: italic;
}

/* 审计日志区域 */
.audit-log-section {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border-light);
}

.section-header .section-title {
  margin: 0;
  padding: 0;
  border: none;
}

.audit-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-select,
.filter-date {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-select:hover,
.filter-date:hover {
  border-color: var(--color-primary);
}

.filter-select:focus,
.filter-date:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.filter-reset-button {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: transparent;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-reset-button:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* 审计日志加载状态 */
.audit-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

/* 审计日志时间线 */
.audit-log-timeline {
  display: flex;
  flex-direction: column;
}

.audit-log-item {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  position: relative;
}

.audit-log-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

.log-timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 1rem;
  flex-shrink: 0;
}

.marker-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background-color: var(--color-text-secondary);
  z-index: 1;
}

.marker-line {
  flex: 1;
  width: 2px;
  background-color: var(--color-border);
  margin-top: 0.25rem;
}

.action-create .marker-dot {
  background-color: var(--color-success);
}

.action-update .marker-dot {
  background-color: var(--color-warning);
}

.action-delete .marker-dot {
  background-color: var(--color-danger);
}

.action-view .marker-dot {
  background-color: var(--color-info);
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.log-action {
  display: inline-flex;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.action-badge-create {
  background-color: rgb(16 185 129 / 0.1);
  color: var(--color-success);
}

.action-badge-update {
  background-color: rgb(245 158 11 / 0.1);
  color: var(--color-warning);
}

.action-badge-delete {
  background-color: rgb(239 68 68 / 0.1);
  color: var(--color-danger);
}

.action-badge-view {
  background-color: rgb(6 182 212 / 0.1);
  color: var(--color-info);
}

.log-timestamp {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.log-actor {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.meta-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* 变更详情 */
.log-changes {
  margin-top: 0.75rem;
}

.changes-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-tertiary);
  color: var(--color-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.changes-toggle:hover {
  background-color: var(--color-border);
}

.toggle-icon {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.changes-detail {
  margin-top: 0.75rem;
  padding: 1rem;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.field-changed {
  padding: 0.75rem;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
}

.field-changed:last-child {
  margin-bottom: 0;
}

.field-name {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.5rem;
}

.field-values {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.old-value,
.new-value {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

.old-value {
  background-color: rgb(239 68 68 / 0.1);
  color: var(--color-danger);
}

.new-value {
  background-color: rgb(16 185 129 / 0.1);
  color: var(--color-success);
}

.value-label {
  font-size: 0.6875rem;
  opacity: 0.75;
}

.value-text {
  font-family: monospace;
}

.arrow-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

/* 空状态 */
.audit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  color: var(--color-text-secondary);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  margin: 0;
  font-size: 0.875rem;
}

/* 分页控件 */
.audit-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-light);
}

.page-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.page-button:hover:not(:disabled) {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-primary);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.page-divider {
  margin: 0 0.25rem;
}

.page-total {
  margin-left: 0.5rem;
}

/* 响应式布局 */
@media (max-width: 1279px) {
  .header-content {
    max-width: 100%;
  }

  .asset-detail-content {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .audit-filters {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .filter-select,
  .filter-date,
  .filter-reset-button {
    width: 100%;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .field-values {
    flex-direction: column;
    align-items: flex-start;
  }

  .arrow-icon {
    transform: rotate(90deg);
  }
}
</style>