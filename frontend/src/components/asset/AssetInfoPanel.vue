<template>
  <div class="asset-info-panel" :class="{ 'is-loading': loading, 'has-error': !!error }">
    <!-- Loading State -->
    <div v-if="loading" class="asset-info-panel__loading">
      <div class="loading-skeleton">
        <div v-for="i in 6" :key="i" class="skeleton-item">
          <div class="skeleton-label"></div>
          <div class="skeleton-value"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="asset-info-panel__error">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" @click="$emit('retry')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="retry-icon">
          <path d="M1 4v6h6M23 20v-6h-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ t('common.retry') || '重试' }}
      </button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Header Section -->
      <div class="asset-info-panel__header">
        <div class="header-main">
          <h2 class="asset-name">{{ assetData.name || '-' }}</h2>
          <div class="asset-badges">
            <span v-if="assetData.status" class="badge" :class="`badge--${getStatusType(assetData.status)}`">
              {{ getStatusLabel(assetData.status) }}
            </span>
            <span v-if="assetData.category" class="badge badge--category">
              {{ assetData.category }}
            </span>
          </div>
        </div>
        <div class="header-meta">
          <span class="meta-item">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
            </svg>
            <span>{{ t('asset.creationDate') || '创建日期' }}: {{ formatDate(assetData.createdAt) }}</span>
          </span>
          <span class="meta-item">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
            <span>{{ t('asset.lastModifier') || '最后修改人' }}: {{ assetData.updatedBy || '-' }}</span>
          </span>
        </div>
      </div>

      <!-- Basic Info Section -->
      <div class="asset-info-panel__section">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="16" y1="13" x2="8" y2="13" stroke-width="2" stroke-linecap="round"/>
            <line x1="16" y1="17" x2="8" y2="17" stroke-width="2" stroke-linecap="round"/>
            <polyline points="10,9 9,9 8,9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('asset.basicInfo') || '基本信息' }}
        </h3>
        <div class="info-grid">
          <div class="info-item" v-for="field in basicFields" :key="field.key">
            <dt class="info-label">{{ field.label }}</dt>
            <dd class="info-value" :class="{ 'is-empty': !assetData[field.key] }">
              {{ formatFieldValue(assetData[field.key], field.type) }}
            </dd>
          </div>
        </div>
      </div>

      <!-- Financial Info Section -->
      <div class="asset-info-panel__section">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="1" x2="12" y2="23" stroke-width="2" stroke-linecap="round"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('asset.financialInfo') || '财务信息' }}
        </h3>
        <div class="info-grid">
          <div class="info-item" v-for="field in financialFields" :key="field.key">
            <dt class="info-label">
              {{ field.label }}
              <span v-if="field.sensitive" class="sensitive-indicator" :title="t('asset.sensitiveField') || '敏感字段'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </dt>
            <dd class="info-value" :class="{ 'is-empty': !assetData[field.key] }">
              <template v-if="field.sensitive && !canViewSensitive">
                <span class="masked-value">{{ t('asset.fieldMasked') || '******' }}</span>
              </template>
              <template v-else>
                {{ formatFieldValue(assetData[field.key], field.type) }}
              </template>
            </dd>
          </div>
        </div>
      </div>

      <!-- Location Info Section -->
      <div class="asset-info-panel__section">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="10" r="3" stroke-width="2"/>
          </svg>
          {{ t('asset.locationInfo') || '位置信息' }}
        </h3>
        <div class="info-grid">
          <div class="info-item" v-for="field in locationFields" :key="field.key">
            <dt class="info-label">{{ field.label }}</dt>
            <dd class="info-value" :class="{ 'is-empty': !assetData[field.key] }">
              {{ formatFieldValue(assetData[field.key], field.type) }}
            </dd>
          </div>
        </div>
      </div>

      <!-- @Auditable Field Changes Section -->
      <div v-if="auditableChanges && auditableChanges.length > 0" class="asset-info-panel__section">
        <h3 class="section-title section-title--highlighted">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="23,4 23,10 17,10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="1,20 1,14 7,14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('asset.auditableChanges') || '字段变更记录' }}
          <span class="change-count">({{ auditableChanges.length }})</span>
        </h3>
        <div class="changes-list">
          <div 
            v-for="(change, index) in auditableChanges" 
            :key="index" 
            class="change-item field-changed"
            :data-field="change.field"
          >
            <div class="change-header">
              <span class="change-field-name">{{ getFieldLabel(change.field) }}</span>
              <span class="change-timestamp">{{ formatDate(change.timestamp) }}</span>
            </div>
            <div class="change-values">
              <div class="change-old">
                <span class="value-label">{{ t('asset.oldValue') || '旧值' }}:</span>
                <span class="value-content">{{ formatFieldValue(change.oldValue, change.type) }}</span>
              </div>
              <svg class="change-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="5" y1="12" x2="19" y2="12" stroke-width="2" stroke-linecap="round"/>
                <polyline points="12,5 19,12 12,19" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="change-new">
                <span class="value-label">{{ t('asset.newValue') || '新值' }}:</span>
                <span class="value-content">{{ formatFieldValue(change.newValue, change.type) }}</span>
              </div>
            </div>
            <div class="change-actor">
              <svg class="actor-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke-width="2"/>
              </svg>
              <span>{{ change.actor || t('asset.unknownActor') || '未知操作人' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Audit Logs Quick View -->
      <div v-if="showAuditPreview && recentAuditLogs.length > 0" class="asset-info-panel__section">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <polyline points="12,6 12,12 16,14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('asset.recentAuditLogs') || '最近审计日志' }}
          <a href="#" class="view-more-link" @click.prevent="$emit('view-all-logs')">
            {{ t('asset.viewAll') || '查看全部' }} →
          </a>
        </h3>
        <ul class="audit-preview-list">
          <li 
            v-for="log in recentAuditLogs" 
            :key="log.id" 
            class="audit-preview-item"
            :data-action="log.action"
          >
            <div class="audit-preview-main">
              <span class="audit-action-badge" :class="`action--${log.action.toLowerCase()}`">
                {{ log.action }}
              </span>
              <span class="audit-actor">{{ log.actor }}</span>
            </div>
            <span class="audit-timestamp">{{ formatDate(log.timestamp) }}</span>
          </li>
        </ul>
      </div>

      <!-- Empty State -->
      <div v-if="isEmpty && !loading" class="asset-info-panel__empty">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="13,2 13,9 20,9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>{{ t('asset.noData') || '暂无资产数据' }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * AssetInfoPanel Component
 * 
 * 资产详情页面 - 资产信息展示面板
 * 
 * 功能特性:
 * - 资产完整字段可视化渲染 (Phase 1)
 * - @Auditable 字段变更高亮展示 (Phase 3)
 * - 审计日志快速预览
 * - 敏感字段脱敏展示
 * - 响应式布局适配
 * 
 * @author SWARM-051 Team
 * @version Iteration 4
 * @see {@link https://spec.example.com/SWARM-051|SWARM-051 规格文档}
 * @requires AssetDetailForGraphify
 * @requires AuditLogEntry
 */

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// Types
interface AuditableChange {
  field: string;
  oldValue: any;
  newValue: any;
  type?: string;
  timestamp?: string;
  actor?: string;
}

interface AuditLogEntry {
  id: string;
  assetId?: string;
  action: string;
  actor: string;
  timestamp: string;
  changes?: Record<string, { old: any; new: any }>;
}

interface AssetFieldMapping {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'currency' | 'status' | 'select';
  sensitive?: boolean;
  section?: 'basic' | 'financial' | 'location';
}

// Props definition
interface Props {
  /** 资产完整数据 */
  assetData: Record<string, any>;
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string;
  /** @Auditable 字段变更记录 */
  auditableChanges?: AuditableChange[];
  /** 关联审计日志 (快速预览) */
  recentAuditLogs?: AuditLogEntry[];
  /** 是否显示审计预览区域 */
  showAuditPreview?: boolean;
  /** 用户权限 - 是否可查看敏感字段 */
  canViewSensitive?: boolean;
  /** 字段映射配置 (支持自定义覆盖) */
  fieldMapping?: AssetFieldMapping[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  auditableChanges: () => [],
  recentAuditLogs: () => [],
  showAuditPreview: true,
  canViewSensitive: false,
  fieldMapping: () => [],
});

// Emits definition
const emit = defineEmits<{
  /** 重试加载 */
  retry: [];
  /** 查看全部审计日志 */
  'view-all-logs': [];
}>();

// i18n
const { t } = useI18n();

// Default field mapping configuration
const defaultFieldMapping: AssetFieldMapping[] = [
  // Basic Info Fields
  { key: 'assetNumber', label: 'asset.fields.assetNumber', type: 'text', section: 'basic' },
  { key: 'name', label: 'asset.fields.name', type: 'text', section: 'basic' },
  { key: 'category', label: 'asset.fields.category', type: 'select', section: 'basic' },
  { key: 'type', label: 'asset.fields.type', type: 'select', section: 'basic' },
  { key: 'model', label: 'asset.fields.model', type: 'text', section: 'basic' },
  { key: 'serialNumber', label: 'asset.fields.serialNumber', type: 'text', section: 'basic' },
  // Financial Info Fields
  { key: 'purchaseDate', label: 'asset.fields.purchaseDate', type: 'date', section: 'financial' },
  { key: 'purchasePrice', label: 'asset.fields.purchasePrice', type: 'currency', sensitive: true, section: 'financial' },
  { key: 'currentValue', label: 'asset.fields.currentValue', type: 'currency', sensitive: true, section: 'financial' },
  { key: 'depreciation', label: 'asset.fields.depreciation', type: 'currency', sensitive: true, section: 'financial' },
  { key: 'warrantyPeriod', label: 'asset.fields.warrantyPeriod', type: 'text', section: 'financial' },
  { key: 'supplier', label: 'asset.fields.supplier', type: 'text', section: 'financial' },
  // Location Info Fields
  { key: 'location', label: 'asset.fields.location', type: 'text', section: 'location' },
  { key: 'department', label: 'asset.fields.department', type: 'select', section: 'location' },
  { key: 'custodian', label: 'asset.fields.custodian', type: 'text', section: 'location' },
  { key: 'status', label: 'asset.fields.status', type: 'status', section: 'basic' },
];

// Merge default and custom field mapping
const mergedFieldMapping = computed(() => {
  const mapping = [...defaultFieldMapping];
  if (props.fieldMapping.length > 0) {
    props.fieldMapping.forEach(custom => {
      const index = mapping.findIndex(m => m.key === custom.key);
      if (index >= 0) {
        mapping[index] = { ...mapping[index], ...custom };
      } else {
        mapping.push(custom);
      }
    });
  }
  return mapping;
});

// Group fields by section
const basicFields = computed(() => 
  mergedFieldMapping.value.filter(f => f.section === 'basic')
);

const financialFields = computed(() => 
  mergedFieldMapping.value.filter(f => f.section === 'financial')
);

const locationFields = computed(() => 
  mergedFieldMapping.value.filter(f => f.section === 'location')
);

// Check if data is empty
const isEmpty = computed(() => {
  return !props.assetData || Object.keys(props.assetData).length === 0;
});

// Status type mapping for badges
const getStatusType = (status: string): string => {
  const statusMap: Record<string, string> = {
    'ACTIVE': 'success',
    'IN_USE': 'success',
    'IDLE': 'warning',
    'MAINTENANCE': 'info',
    'SCRAPPED': 'danger',
    'TRANSFERRED': 'secondary',
    'PENDING': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'danger',
  };
  return statusMap[status?.toUpperCase()] || 'default';
};

// Get localized status label
const getStatusLabel = (status: string): string => {
  const statusKey = `asset.status.${status.toLowerCase()}`;
  const localized = t(statusKey);
  return localized !== statusKey ? localized : status;
};

// Get field label with i18n support
const getFieldLabel = (fieldKey: string): string => {
  const field = mergedFieldMapping.value.find(f => f.key === fieldKey);
  if (field) {
    const localized = t(field.label);
    return localized !== field.label ? localized : field.label;
  }
  return fieldKey;
};

// Format field value based on type
const formatFieldValue = (value: any, type?: string): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  switch (type) {
    case 'date':
      return formatDate(value);
    case 'currency':
      return formatCurrency(value);
    case 'number':
      return formatNumber(value);
    default:
      return String(value);
  }
};

// Format date to localized string
const formatDate = (dateValue: string | Date | undefined): string => {
  if (!dateValue) return '-';
  
  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateValue);
  }
};

// Format currency value
const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

// Format number value
const formatNumber = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  return new Intl.NumberFormat('zh-CN').format(numValue);
};
</script>

<style scoped>
/**
 * AssetInfoPanel Styles
 * 
 * Responsive breakpoints:
 * - Desktop: >= 1280px
 * - Tablet: 768px - 1279px
 * - Mobile: < 768px
 */

.asset-info-panel {
  --panel-bg: #ffffff;
  --section-bg: #fafbfc;
  --border-color: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --accent-color: #3b82f6;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --info-color: #6366f1;
  --skeleton-base: #f3f4f6;
  --skeleton-shine: #e5e7eb;
  
  background: var(--panel-bg);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* Loading State */
.asset-info-panel__loading {
  padding: 24px;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-label {
  width: 80px;
  height: 14px;
  background: var(--skeleton-base);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-value {
  width: 60%;
  height: 20px;
  background: var(--skeleton-base);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Error State */
.asset-info-panel__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: var(--danger-color);
  margin-bottom: 16px;
}

.error-message {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 20px;
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background: #2563eb;
}

.retry-icon {
  width: 16px;
  height: 16px;
}

/* Header Section */
.asset-info-panel__header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(to bottom, var(--section-bg), var(--panel-bg));
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.asset-name {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.asset-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge--success {
  background: #d1fae5;
  color: #065f46;
}

.badge--warning {
  background: #fef3c7;
  color: #92400e;
}

.badge--danger {
  background: #fee2e2;
  color: #991b1b;
}

.badge--info {
  background: #e0e7ff;
  color: #3730a3;
}

.badge--secondary {
  background: #f3f4f6;
  color: #374151;
}

.badge--category {
  background: #dbeafe;
  color: #1e40af;
}

.header-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

/* Section Styles */
.asset-info-panel__section {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.asset-info-panel__section:last-child {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.section-title--highlighted {
  color: var(--accent-color);
}

.section-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.change-count {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sensitive-indicator {
  display: inline-flex;
  cursor: help;
}

.sensitive-indicator svg {
  width: 14px;
  height: 14px;
  color: var(--warning-color);
}

.info-value {
  font-size: 15px;
  color: var(--text-primary);
  word-break: break-word;
}

.info-value.is-empty {
  color: var(--text-muted);
  font-style: italic;
}

.masked-value {
  background: var(--skeleton-base);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 2px;
}

/* Changes List */
.changes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.change-item {
  padding: 16px;
  background: var(--section-bg);
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
  transition: box-shadow 0.2s ease;
}

.change-item:hover {
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.change-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.change-field-name {
  font-weight: 600;
  color: var(--text-primary);
}

.change-timestamp {
  font-size: 12px;
  color: var(--text-muted);
}

.change-values {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.change-old,
.change-new {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 150px;
}

.value-label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.value-content {
  padding: 4px 8px;
  background: var(--panel-bg);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}

.change-arrow {
  width: 20px;
  height: 20px;
  color: var(--accent-color);
  flex-shrink: 0;
}

.change-actor {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.actor-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

/* Audit Preview */
.audit-preview-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audit-preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--section-bg);
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.audit-preview-item:hover {
  background: var(--skeleton-shine);
}

.audit-preview-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audit-action-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.action--create {
  background: #d1fae5;
  color: #065f46;
}

.action--update {
  background: #dbeafe;
  color: #1e40af;
}

.action--delete {
  background: #fee2e2;
  color: #991b1b;
}

.action--view {
  background: #f3f4f6;
  color: #374151;
}

.audit-actor {
  font-size: 13px;
  color: var(--text-secondary);
}

.audit-timestamp {
  font-size: 12px;
  color: var(--text-muted);
}

.view-more-link {
  margin-left: auto;
  font-size: 13px;
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.view-more-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* Empty State */
.asset-info-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: var(--text-muted);
  margin-bottom: 16px;
  opacity: 0.5;
}

.asset-info-panel__empty p {
  color: var(--text-secondary);
  font-size: 14px;
}

/* Responsive Design */
@media (max-width: 1279px) {
  .info-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
  
  .asset-name {
    font-size: 20px;
  }
  
  .header-main {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 767px) {
  .asset-info-panel__header,
  .asset-info-panel__section {
    padding: 16px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .header-meta {
    flex-direction: column;
    gap: 8px;
  }
  
  .change-values {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .change-arrow {
    transform: rotate(90deg);
  }
  
  .asset-badges {
    width: 100%;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .asset-info-panel {
    border: 2px solid var(--text-primary);
  }
  
  .change-item {
    border-left-width: 6px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .skeleton-item > *,
  .retry-button,
  .audit-preview-item,
  .change-item {
    animation: none;
    transition: none;
  }
}
</style>