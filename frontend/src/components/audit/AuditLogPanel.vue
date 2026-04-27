<template>
  <div class="audit-log-panel" data-testid="audit-log-panel">
    <div class="audit-log-header">
      <h3 class="audit-log-title">
        <svg class="audit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {{ $t('audit.logPanel.title', '审计日志') }}
      </h3>
      <span class="audit-log-count" v-if="logs.length > 0">
        {{ $t('audit.logPanel.recordCount', { count: logs.length }) }}
      </span>
    </div>

    <div v-if="loading" class="audit-log-loading" data-testid="audit-loading">
      <div class="loading-spinner"></div>
      <span>{{ $t('audit.logPanel.loading', '加载审计日志...') }}</span>
    </div>

    <div v-else-if="error" class="audit-log-error" data-testid="audit-error">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ errorMessage }}</span>
      <button @click="$emit('retry')" class="retry-button">
        {{ $t('audit.logPanel.retry', '重试') }}
      </button>
    </div>

    <div v-else-if="logs.length === 0" class="audit-log-empty" data-testid="audit-empty">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <span>{{ $t('audit.logPanel.empty', '暂无审计记录') }}</span>
      <p class="empty-hint">{{ $t('audit.logPanel.emptyHint', '该资产暂无任何变更记录') }}</p>
    </div>

    <div v-else class="audit-log-list" data-testid="audit-log-list">
      <div
        v-for="(log, index) in logs"
        :key="log.id"
        class="audit-log-item"
        :class="{ 'expanded': expandedItems.includes(log.id) }"
        :data-testid="`audit-log-item-${index}`"
        @click="toggleExpand(log.id)"
      >
        <div class="audit-log-main">
          <div class="audit-log-timestamp" :data-testid="`audit-log-timestamp-${index}`">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="audit-log-content">
            <div class="audit-log-operation">
              <span class="operation-badge" :class="getOperationClass(log.operation)">
                {{ getOperationText(log.operation) }}
              </span>
              <span class="audit-field" :data-testid="`audit-log-field-${index}`">
                {{ log.field }}
              </span>
            </div>
            <div class="audit-log-meta">
              <span class="audit-operator" v-if="log.operator">
                {{ $t('audit.logPanel.operator', '操作人') }}: {{ log.operator }}
              </span>
              <span class="audit-ip" v-if="log.ipAddress">
                IP: {{ maskIpAddress(log.ipAddress) }}
              </span>
            </div>
          </div>
          <button class="expand-toggle" :aria-expanded="expandedItems.includes(log.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" :class="{ 'rotated': expandedItems.includes(log.id) }">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div v-if="expandedItems.includes(log.id)" class="audit-log-details" :data-testid="`audit-log-details-${index}`">
          <div class="audit-diff" v-if="log.oldValue !== undefined || log.newValue !== undefined">
            <div class="diff-row">
              <span class="diff-label">{{ $t('audit.logPanel.oldValue', '变更前') }}:</span>
              <span class="diff-value old-value" :class="{ 'null-value': log.oldValue === null }" :data-testid="`audit-log-old-value-${index}`">
                {{ formatValue(log.oldValue) }}
              </span>
            </div>
            <div class="diff-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div class="diff-row">
              <span class="diff-label">{{ $t('audit.logPanel.newValue', '变更后') }}:</span>
              <span class="diff-value new-value" :class="{ 'null-value': log.newValue === null }" :data-testid="`audit-log-new-value-${index}`">
                {{ formatValue(log.newValue) }}
              </span>
            </div>
          </div>
          <div class="audit-summary" v-if="log.summary">
            <span class="summary-label">{{ $t('audit.logPanel.summary', '变更说明') }}:</span>
            <span class="summary-text">{{ log.summary }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasMore && !loading" class="audit-log-footer">
      <button @click="$emit('loadMore')" class="load-more-button" :disabled="loadingMore">
        {{ loadingMore ? $t('audit.logPanel.loadingMore', '加载中...') : $t('audit.logPanel.loadMore', '加载更多') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AuditLogPanel Component
 * 
 * 资产详情页面审计日志展示面板组件
 * 用于展示资产的所有变更历史记录，支持展开查看详细变更内容
 * 
 * @component
 * @example
 * <AuditLogPanel
 *   :logs="auditLogs"
 *   :loading="isLoading"
 *   :error="errorMessage"
 *   :has-more="hasMoreLogs"
 *   @expand="handleExpand"
 *   @loadMore="handleLoadMore"
 *   @retry="handleRetry"
 * />
 */

import { ref, computed, watch } from 'vue';
import type { AuditLog } from '@/types/audit.types';
import { formatRelativeTime, maskIpAddress } from '@/types/audit.types';

/**
 * 组件属性接口
 */
export interface AuditLogPanelProps {
  /** 审计日志列表 */
  logs: AuditLog[];
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 是否正在加载更多 */
  loadingMore?: boolean;
}

const props = withDefaults(defineProps<AuditLogPanelProps>(), {
  logs: () => [],
  loading: false,
  error: null,
  hasMore: false,
  loadingMore: false,
});

const emit = defineEmits<{
  /** 展开/收起日志详情 */
  expand: [logId: string];
  /** 加载更多日志 */
  loadMore: [];
  /** 重试加载 */
  retry: [];
}>();

/**
 * 已展开的日志项 ID 列表
 */
const expandedItems = ref<string[]>([]);

/**
 * 错误消息计算属性
 */
const errorMessage = computed(() => {
  if (!props.error) return '';
  if (props.error.includes('network') || props.error.includes('Network')) {
    return '网络连接失败，请检查网络后重试';
  }
  if (props.error.includes('timeout')) {
    return '请求超时，请稍后重试';
  }
  if (props.error.includes('500') || props.error.includes('500')) {
    return '服务器错误，请稍后重试';
  }
  return props.error || '加载失败';
});

/**
 * 切换日志项展开状态
 * @param logId - 日志 ID
 */
function toggleExpand(logId: string): void {
  const index = expandedItems.value.indexOf(logId);
  if (index > -1) {
    expandedItems.value.splice(index, 1);
  } else {
    expandedItems.value.push(logId);
  }
  emit('expand', logId);
}

/**
 * 格式化时间戳
 * @param timestamp - ISO 时间戳字符串
 * @returns 格式化后的时间字符串
 */
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化值显示
 * @param value - 值
 * @returns 格式化后的字符串
 */
function formatValue(value: any): string {
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
}

/**
 * 获取操作类型对应的样式类
 * @param operation - 操作类型
 * @returns CSS 类名
 */
function getOperationClass(operation: string): string {
  const operationMap: Record<string, string> = {
    'CREATE': 'operation-create',
    'UPDATE': 'operation-update',
    'DELETE': 'operation-delete',
    'VIEW': 'operation-view',
    'EXPORT': 'operation-export',
  };
  return operationMap[operation.toUpperCase()] || 'operation-default';
}

/**
 * 获取操作类型对应的中文文本
 * @param operation - 操作类型
 * @returns 操作描述文本
 */
function getOperationText(operation: string): string {
  const textMap: Record<string, string> = {
    'CREATE': '创建',
    'UPDATE': '更新',
    'DELETE': '删除',
    'VIEW': '查看',
    'EXPORT': '导出',
  };
  return textMap[operation.toUpperCase()] || operation;
}

/**
 * 监听日志变化，自动收起不存在的展开项
 */
watch(() => props.logs, (newLogs) => {
  const logIds = new Set(newLogs.map(log => log.id));
  expandedItems.value = expandedItems.value.filter(id => logIds.has(id));
}, { deep: true });
</script>

<style scoped>
.audit-log-panel {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.audit-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.audit-log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.audit-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.audit-log-count {
  font-size: 13px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 4px 10px;
  border-radius: 12px;
}

.audit-log-loading,
.audit-log-error,
.audit-log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon,
.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: #9ca3af;
}

.audit-log-error {
  color: #dc2626;
}

.retry-button {
  margin-top: 12px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: #2563eb;
}

.empty-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 8px 0 0 0;
}

.audit-log-list {
  max-height: 600px;
  overflow-y: auto;
}

.audit-log-item {
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.15s;
}

.audit-log-item:last-child {
  border-bottom: none;
}

.audit-log-item:hover {
  background: #f9fafb;
}

.audit-log-item.expanded {
  background: #f0f9ff;
}

.audit-log-main {
  display: flex;
  align-items: flex-start;
  padding: 16px 20px;
  gap: 12px;
}

.audit-log-timestamp {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  min-width: 140px;
}

.audit-log-content {
  flex: 1;
  min-width: 0;
}

.audit-log-operation {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.operation-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.operation-create {
  background: #d1fae5;
  color: #065f46;
}

.operation-update {
  background: #dbeafe;
  color: #1e40af;
}

.operation-delete {
  background: #fee2e2;
  color: #991b1b;
}

.operation-view {
  background: #f3f4f6;
  color: #4b5563;
}

.operation-export {
  background: #e0e7ff;
  color: #3730a3;
}

.operation-default {
  background: #f3f4f6;
  color: #4b5563;
}

.audit-field {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.audit-log-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

.expand-toggle {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.15s;
}

.expand-toggle:hover {
  color: #6b7280;
}

.expand-toggle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.expand-toggle svg.rotated {
  transform: rotate(180deg);
}

.audit-log-details {
  padding: 0 20px 16px 172px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.audit-diff {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.diff-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.diff-label {
  font-size: 12px;
  color: #6b7280;
  min-width: 60px;
}

.diff-value {
  font-size: 13px;
  color: #111827;
  font-family: 'Monaco', 'Menlo', monospace;
  word-break: break-all;
}

.diff-value.old-value {
  color: #dc2626;
  text-decoration: line-through;
  opacity: 0.8;
}

.diff-value.new-value {
  color: #059669;
}

.null-value {
  color: #9ca3af;
  font-style: italic;
}

.diff-arrow {
  display: flex;
  justify-content: center;
  padding: 4px 0;
  color: #d1d5db;
}

.diff-arrow svg {
  width: 16px;
  height: 16px;
}

.audit-summary {
  font-size: 13px;
  color: #4b5563;
}

.summary-label {
  color: #6b7280;
  margin-right: 4px;
}

.audit-log-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.load-more-button {
  padding: 8px 24px;
  background: #ffffff;
  color: #3b82f6;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.load-more-button:hover:not(:disabled) {
  background: #3b82f6;
  color: white;
}

.load-more-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>