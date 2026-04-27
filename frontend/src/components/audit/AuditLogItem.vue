<template>
  <div class="audit-log-item" :class="{ 'is-expanded': isExpanded }">
    <div class="audit-log-header" @click="toggleExpand">
      <div class="audit-log-icon">
        <component :is="getActionIcon(logEntry.action)" />
      </div>
      <div class="audit-log-summary">
        <div class="audit-log-title">
          <span class="action-badge" :class="getActionClass(logEntry.action)">
            {{ getActionLabel(logEntry.action) }}
          </span>
          <span class="field-name">{{ logEntry.fieldName }}</span>
        </div>
        <div class="audit-log-meta">
          <span class="operator">{{ formatOperator(logEntry.operator) }}</span>
          <span class="separator">·</span>
          <span class="timestamp">{{ formatTimestamp(logEntry.timestamp) }}</span>
        </div>
      </div>
      <div class="expand-indicator">
        <ChevronDownIcon v-if="!isExpanded" :size="16" />
        <ChevronUpIcon v-else :size="16" />
      </div>
    </div>
    
    <Transition name="slide">
      <div v-if="isExpanded" class="audit-log-details">
        <div class="change-diff-container">
          <div class="diff-row old-value">
            <span class="diff-label">{{ t('audit.oldValue') || '旧值' }}</span>
            <span class="diff-value">{{ logEntry.oldValue ?? t('audit.empty') || '(空)' }}</span>
          </div>
          <div class="diff-arrow">
            <ArrowRightIcon :size="16" />
          </div>
          <div class="diff-row new-value">
            <span class="diff-label">{{ t('audit.newValue') || '新值' }}</span>
            <span class="diff-value">{{ logEntry.newValue ?? t('audit.empty') || '(空)' }}</span>
          </div>
        </div>
        
        <div v-if="logEntry.reason" class="change-reason">
          <span class="reason-label">{{ t('audit.reason') || '变更原因' }}:</span>
          <span class="reason-text">{{ logEntry.reason }}</span>
        </div>
        
        <div class="change-meta-info">
          <div class="meta-item">
            <span class="meta-label">{{ t('audit.ipAddress') || 'IP 地址' }}:</span>
            <span class="meta-value">{{ maskIpAddress(logEntry.ipAddress) }}</span>
          </div>
          <div v-if="logEntry.userAgent" class="meta-item">
            <span class="meta-label">{{ t('audit.userAgent') || '客户端' }}:</span>
            <span class="meta-value">{{ truncateText(logEntry.userAgent, 50) }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * AuditLogItem Component
 * 
 * 资产审计日志条目组件，用于展示单条审计记录的详细信息。
 * 支持展开/收起操作，显示字段变更的前后值对比。
 * 
 * @packageDocumentation
 * @component
 * @requires Vue 3 Composition API
 * @requires lucide-vue-next (图标库)
 * 
 * @example
 * ```vue
 * <AuditLogItem :log-entry="auditLog" />
 * ```
 */

import { ref, computed } from 'vue';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  ShieldIcon
} from 'lucide-vue-next';

// Types
/** 审计日志条目动作类型 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'APPROVE' | 'REJECT';

/** 审计日志条目接口定义 */
export interface AuditLogEntry {
  /** 审计记录唯一标识符 */
  id: string;
  /** 关联资产ID */
  assetId: string;
  /** 操作的字段名称 */
  fieldName: string;
  /** 字段变更前的值 */
  oldValue: string | null;
  /** 字段变更后的值 */
  newValue: string | null;
  /** 操作人标识 */
  operator: string;
  /** 操作时间戳 */
  timestamp: Date | string | number;
  /** 操作类型 */
  action: AuditAction;
  /** 变更原因（可选） */
  reason?: string;
  /** IP地址（可选） */
  ipAddress?: string;
  /** 用户代理字符串（可选） */
  userAgent?: string;
  /** 变更摘要 */
  summary?: string;
}

// Component Props
/** 组件属性接口 */
interface Props {
  /** 审计日志条目数据 */
  logEntry: AuditLogEntry;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

// Props with defaults
const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false
});

// Emits
/** 组件事件定义 */
const emit = defineEmits<{
  /** 展开状态变更事件 */
  (e: 'expand-change', isExpanded: boolean): void;
  /** 点击操作人事件 */
  (e: 'operator-click', operator: string): void;
}>();

// Reactive state
/** 是否展开状态 */
const isExpanded = ref(props.defaultExpanded);

// Methods

/**
 * 切换展开/收起状态
 * @description 用户点击日志条目头部时触发
 * @returns {void}
 * @performance 无性能影响
 * @sideEffects 可能触发 expand-change 事件
 */
function toggleExpand(): void {
  isExpanded.value = !isExpanded.value;
  emit('expand-change', isExpanded.value);
}

/**
 * 获取操作类型对应的图标组件
 * @description 根据审计动作类型返回对应的图标组件
 * @param {AuditAction} action - 审计动作类型
 * @returns {object} Lucide 图标组件
 * @example
 * ```ts
 * const icon = getActionIcon('CREATE'); // Returns PlusIcon
 * ```
 */
function getActionIcon(action: AuditAction): object {
  const iconMap: Record<AuditAction, object> = {
    CREATE: PlusIcon,
    UPDATE: EditIcon,
    DELETE: TrashIcon,
    VIEW: ShieldIcon,
    EXPORT: RefreshCwIcon,
    APPROVE: PlusIcon,
    REJECT: TrashIcon
  };
  return iconMap[action] || EditIcon;
}

/**
 * 获取操作类型对应的 CSS 类名
 * @description 用于渲染不同颜色的操作类型标签
 * @param {AuditAction} action - 审计动作类型
 * @returns {string} CSS 类名
 */
function getActionClass(action: AuditAction): string {
  const classMap: Record<AuditAction, string> = {
    CREATE: 'action-create',
    UPDATE: 'action-update',
    DELETE: 'action-delete',
    VIEW: 'action-view',
    EXPORT: 'action-export',
    APPROVE: 'action-approve',
    REJECT: 'action-reject'
  };
  return classMap[action] || 'action-default';
}

/**
 * 获取操作类型对应的中文标签
 * @description 返回用户友好的操作类型显示文本
 * @param {AuditAction} action - 审计动作类型
 * @returns {string} 操作类型标签
 */
function getActionLabel(action: AuditAction): string {
  const labelMap: Record<AuditAction, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    VIEW: '查看',
    EXPORT: '导出',
    APPROVE: '审批通过',
    REJECT: '审批拒绝'
  };
  return labelMap[action] || action;
}

/**
 * 格式化操作人信息
 * @description 将操作人标识转换为显示名称
 * @param {string} operator - 操作人标识
 * @returns {string} 格式化后的操作人名称
 */
function formatOperator(operator: string): string {
  if (!operator) return '未知用户';
  // 如果是邮箱格式，截取用户名部分
  if (operator.includes('@')) {
    return operator.split('@')[0];
  }
  return operator;
}

/**
 * 格式化时间戳为友好显示格式
 * @description 将时间戳转换为 YYYY-MM-DD HH:mm 格式
 * @param {Date | string | number} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 * @example
 * ```ts
 * formatTimestamp(new Date('2024-01-15T10:30:00')); // '2024-01-15 10:30'
 * ```
 */
function formatTimestamp(timestamp: Date | string | number): string {
  if (!timestamp) return '-';
  
  const date = timestamp instanceof Date 
    ? timestamp 
    : new Date(timestamp);
  
  if (isNaN(date.getTime())) return '-';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 掩码 IP 地址以保护隐私
 * @description 对 IP 地址进行部分掩码处理
 * @param {string | undefined} ip - 原始 IP 地址
 * @returns {string} 掩码后的 IP 地址
 * @example
 * ```ts
 * maskIpAddress('192.168.1.100'); // '192.168.1.***'
 * ```
 */
function maskIpAddress(ip: string | undefined): string {
  if (!ip) return '-';
  
  // IPv4 处理
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  
  // IPv6 处理 - 简化显示
  if (ip.includes(':')) {
    return ip.substring(0, 20) + '***';
  }
  
  return ip;
}

/**
 * 截断过长的文本
 * @description 将文本截断到指定长度并添加省略号
 * @param {string | undefined} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 简化的国际化方法
 * @description 替代 vue-i18n 的简单实现，用于无国际化环境
 * @param {string} key - 翻译键
 * @param {string} fallback - 备用文本
 * @returns {string} 翻译后的文本
 */
function t(key: string, fallback?: string): string {
  // 简单的翻译映射表
  const translations: Record<string, string> = {
    'audit.oldValue': '旧值',
    'audit.newValue': '新值',
    'audit.empty': '(空)',
    'audit.reason': '变更原因',
    'audit.ipAddress': 'IP 地址',
    'audit.userAgent': '客户端'
  };
  
  return translations[key] || fallback || key;
}

// Expose methods for parent components
defineExpose({
  /** 展开方法 */
  expand: () => { isExpanded.value = true; },
  /** 收起方法 */
  collapse: () => { isExpanded.value = false; },
  /** 切换展开状态 */
  toggle: toggleExpand
});
</script>

<style scoped>
/**
 * AuditLogItem Component Styles
 * 
 * 审计日志条目组件样式，采用 BEM 命名规范。
 */

.audit-log-item {
  /** 基础样式 */
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}

.audit-log-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.audit-log-item.is-expanded {
  border-color: #3b82f6;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.15);
}

/** 日志条目头部 */
.audit-log-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  gap: 12px;
}

/** 图标容器 */
.audit-log-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  border-radius: 6px;
  color: #6b7280;
}

.audit-log-item.is-expanded .audit-log-icon {
  background-color: #eff6ff;
  color: #3b82f6;
}

/** 日志摘要信息 */
.audit-log-summary {
  flex: 1;
  min-width: 0;
}

.audit-log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

/** 操作类型标签 */
.action-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.action-create {
  background-color: #dcfce7;
  color: #16a34a;
}

.action-update {
  background-color: #dbeafe;
  color: #2563eb;
}

.action-delete {
  background-color: #fee2e2;
  color: #dc2626;
}

.action-view {
  background-color: #f3f4f6;
  color: #6b7280;
}

.action-export {
  background-color: #fef3c7;
  color: #d97706;
}

.action-approve {
  background-color: #dcfce7;
  color: #16a34a;
}

.action-reject {
  background-color: #fee2e2;
  color: #dc2626;
}

/** 字段名称 */
.field-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

/** 元信息行 */
.audit-log-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.separator {
  color: #d1d5db;
}

/** 展开指示器 */
.expand-indicator {
  flex-shrink: 0;
  color: #9ca3af;
  transition: transform 0.2s ease-in-out;
}

.audit-log-item.is-expanded .expand-indicator {
  color: #3b82f6;
}

/** 详情展开区域 */
.audit-log-details {
  padding: 0 16px 16px;
  border-top: 1px solid #f3f4f6;
  background-color: #fafafa;
}

/** 变更对比容器 */
.change-diff-container {
  display: flex;
  align-items: stretch;
  gap: 12px;
  margin: 16px 0;
  padding: 12px;
  background-color: #ffffff;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

/** 变更行样式 */
.diff-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diff-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
}

.diff-value {
  font-size: 13px;
  color: #374151;
  word-break: break-all;
  line-height: 1.5;
}

.old-value .diff-value {
  color: #dc2626;
  background-color: #fef2f2;
  padding: 4px 8px;
  border-radius: 4px;
}

.new-value .diff-value {
  color: #16a34a;
  background-color: #f0fdf4;
  padding: 4px 8px;
  border-radius: 4px;
}

/** 箭头图标 */
.diff-arrow {
  display: flex;
  align-items: center;
  color: #9ca3af;
  flex-shrink: 0;
}

/** 变更原因 */
.change-reason {
  margin-bottom: 12px;
  padding: 10px 12px;
  background-color: #fffbeb;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

.reason-label {
  font-size: 12px;
  font-weight: 500;
  color: #92400e;
  margin-right: 6px;
}

.reason-text {
  font-size: 13px;
  color: #78350f;
}

/** 元信息区域 */
.change-meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.meta-label {
  color: #6b7280;
}

.meta-value {
  color: #374151;
  font-family: 'Monaco', 'Menlo', monospace;
}

/** 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}

/** 响应式适配 */
@media (max-width: 640px) {
  .change-diff-container {
    flex-direction: column;
  }
  
  .diff-arrow {
    transform: rotate(90deg);
    justify-content: center;
  }
  
  .change-meta-info {
    flex-direction: column;
    gap: 8px;
  }
}
</style>