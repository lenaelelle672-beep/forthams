/**
 * AuditTimelineItem.vue - 审计时间线条目组件
 * 
 * 功能说明：
 * - 渲染单条审计日志记录的时间线展示
 * - 支持 @Auditable 注解字段变更的高亮显示
 * - 展示操作类型、操作人、操作时间、变更摘要
 * 
 * 依赖模块：
 * - AuditService (服务层对接)
 * - @Auditable 注解数据绑定
 * 
 * @author SWARM-051 Team
 * @since 2025-01-15
 */

<template>
  <div class="audit-timeline-item" :class="{ 'is-highlighted': hasAuditableChanges }">
    <!-- 时间线节点 -->
    <div class="timeline-marker">
      <div class="marker-dot" :class="actionClass"></div>
      <div class="marker-line"></div>
    </div>

    <!-- 审计记录主体 -->
    <div class="timeline-content">
      <!-- 操作头部信息 -->
      <div class="audit-header">
        <span class="audit-action" :class="actionClass">
          {{ formatAction(record.action) }}
        </span>
        <span class="audit-timestamp">
          {{ formatTimestamp(record.timestamp) }}
        </span>
      </div>

      <!-- 操作人信息 -->
      <div class="audit-user">
        <i class="user-icon"></i>
        <span class="user-name">{{ record.userName }}</span>
      </div>

      <!-- 变更字段列表 -->
      <div v-if="record.changes && record.changes.length > 0" class="changed-fields">
        <div class="fields-header">
          <span class="fields-label">变更详情</span>
          <span class="fields-count">({{ record.changes.length }} 项)</span>
        </div>
        
        <div class="field-list">
          <div 
            v-for="change in record.changes" 
            :key="change.field"
            class="field-item"
            :class="{ 'field-highlight': change.isAuditable }"
          >
            <!-- @Auditable 标记 -->
            <span v-if="change.isAuditable" class="auditable-badge" title="@Auditable 注解字段">
              <svg class="badge-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0L10.163 5.305L16 6.09L12.018 9.945L12.918 16L8 13.27L3.082 16L3.982 9.945L0 6.09L5.837 5.305L8 0Z"/>
              </svg>
            </span>
            
            <!-- 字段名 -->
            <span class="field-name">{{ formatFieldName(change.field) }}</span>
            
            <!-- 值变更 -->
            <span class="field-values">
              <span class="old-value" v-if="change.oldValue !== null && change.oldValue !== undefined">
                {{ formatValue(change.oldValue) }}
              </span>
              <span class="value-arrow">→</span>
              <span class="new-value">
                {{ formatValue(change.newValue) }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- 实体信息 -->
      <div class="audit-entity" v-if="record.entityType">
        <span class="entity-type">{{ record.entityType }}</span>
        <span class="entity-id">{{ record.entityId }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @file AuditTimelineItem.vue
 * @description 审计时间线条目组件 - 展示单条审计日志记录
 * 
 * @prop {AuditRecord} record - 审计记录数据
 * 
 * @emits {click} - 条目点击事件
 * 
 * @example
 * <AuditTimelineItem 
 *   :record="auditRecord" 
 *   @click="handleItemClick" 
 * />
 */

import { computed, defineProps, defineEmits } from 'vue';
import type { AuditRecord, FieldChange } from '@/types/audit.types';

/**
 * 组件 Props 定义
 */
const props = defineProps<{
  /** 审计记录数据 */
  record: AuditRecord;
}>();

/**
 * 组件事件定义
 */
const emit = defineEmits<{
  /** 条目点击事件 */
  (e: 'click', record: AuditRecord): void;
}>();

/**
 * 判断是否有 @Auditable 字段变更
 * 
 * @description
 * 检查当前审计记录的变更字段中是否存在 @Auditable 注解标记的字段
 * 用于决定是否显示高亮样式
 */
const hasAuditableChanges = computed(() => {
  return props.record.changes?.some(change => change.isAuditable) ?? false;
});

/**
 * 根据操作类型获取对应的 CSS 类名
 * 
 * @description
 * - CREATE: 绿色，创建操作
 * - UPDATE: 蓝色，更新操作
 * - DELETE: 红色，删除操作
 * - VIEW: 灰色，查看操作
 */
const actionClass = computed(() => {
  const actionMap: Record<string, string> = {
    'CREATE': 'action-create',
    'UPDATE': 'action-update',
    'DELETE': 'action-delete',
    'VIEW': 'action-view',
  };
  return actionMap[props.record.action] ?? 'action-default';
});

/**
 * 格式化操作类型文本
 * 
 * @param action - 操作类型枚举值
 * @returns 格式化后的中文操作描述
 */
const formatAction = (action: string): string => {
  const actionLabels: Record<string, string> = {
    'CREATE': '创建',
    'UPDATE': '更新',
    'DELETE': '删除',
    'VIEW': '查看',
  };
  return actionLabels[action] ?? action;
};

/**
 * 格式化时间戳
 * 
 * @description
 * 将 ISO 8601 时间格式转换为友好的中文时间显示
 * - 今天内显示：HH:mm
 * - 昨天显示：昨天 HH:mm
 * - 今年显示：MM-DD HH:mm
 * - 更早显示：YYYY-MM-DD HH:mm
 * 
 * @param timestamp - ISO 8601 格式的时间戳
 * @returns 格式化后的时间字符串
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  if (diffDays === 0) {
    return timeStr;
  } else if (diffDays === 1) {
    return `昨天 ${timeStr}`;
  } else if (year === now.getFullYear()) {
    return `${month}-${day} ${timeStr}`;
  } else {
    return `${year}-${month}-${day} ${timeStr}`;
  }
};

/**
 * 格式化字段名称
 * 
 * @description
 * 将驼峰命名转换为中文友好格式
 * 例如：assetName -> 资产名称, status -> 状态
 * 
 * @param field - 原始字段名
 * @returns 格式化后的字段名
 */
const formatFieldName = (field: string): string => {
  const fieldNameMap: Record<string, string> = {
    'assetName': '资产名称',
    'assetCode': '资产编号',
    'status': '状态',
    'location': '位置',
    'category': '类别',
    'purchaseDate': '采购日期',
    'purchasePrice': '采购价格',
    'currentValue': '当前价值',
    'assignedTo': '分配给',
    'department': '部门',
    'description': '描述',
    'serialNumber': '序列号',
    'manufacturer': '制造商',
    'model': '型号',
    'warrantyExpiry': '保修到期',
  };
  
  return fieldNameMap[field] ?? field;
};

/**
 * 格式化字段值
 * 
 * @description
 * 将各种类型的值转换为字符串显示
 * - null/undefined: 显示 "-"
 * - 布尔值: 是/否
 * - 数字: 保留两位小数（如适用）
 * - 对象/数组: JSON 序列化
 * 
 * @param value - 字段值
 * @returns 格式化后的字符串
 */
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '-';
  }
  
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  
  if (typeof value === 'number') {
    // 判断是否为金额
    if (Math.abs(value) > 100 && Number.isInteger(value / 100)) {
      return `¥${(value / 100).toFixed(2)}`;
    }
    return String(value);
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
};

/**
 * 处理条目点击
 * 
 * @description
 * 触发 click 事件，将完整的审计记录传递给父组件
 */
const handleClick = () => {
  emit('click', props.record);
};
</script>

<style scoped>
/**
 * 审计时间线条目样式
 * 
 * 布局说明：
 * - 使用 Flexbox 布局，左侧为时间线节点，右侧为内容区
 * - 时间线节点固定宽度，高度自适应
 * - 内容区占据剩余空间
 */

/* 容器 */
.audit-timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.audit-timeline-item:hover {
  background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.02));
}

/* 高亮状态 - 当存在 @Auditable 字段变更时 */
.audit-timeline-item.is-highlighted {
  background: linear-gradient(90deg, 
    rgba(255, 193, 7, 0.05) 0%, 
    transparent 100%
  );
  border-left: 3px solid var(--color-warning, #ffc107);
}

/* 时间线节点 */
.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--color-border, #e5e7eb);
  background-color: var(--color-bg, #fff);
  z-index: 1;
}

.marker-line {
  width: 2px;
  flex: 1;
  background-color: var(--color-border, #e5e7eb);
  margin-top: 4px;
}

/* 操作类型样式 */
.marker-dot.action-create,
.audit-action.action-create {
  background-color: var(--color-success, #22c55e);
  border-color: var(--color-success, #22c55e);
  color: white;
}

.marker-dot.action-update,
.audit-action.action-update {
  background-color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: white;
}

.marker-dot.action-delete,
.audit-action.action-delete {
  background-color: var(--color-danger, #ef4444);
  border-color: var(--color-danger, #ef4444);
  color: white;
}

.marker-dot.action-view,
.audit-action.action-view {
  background-color: var(--color-secondary, #6b7280);
  border-color: var(--color-secondary, #6b7280);
  color: white;
}

/* 内容区域 */
.timeline-content {
  flex: 1;
  min-width: 0;
}

/* 头部信息 */
.audit-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.audit-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.audit-action.action-create { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
.audit-action.action-update { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.audit-action.action-delete { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; }
.audit-action.action-view { background-color: rgba(107, 114, 128, 0.1); color: #6b7280; }

.audit-timestamp {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

/* 用户信息 */
.audit-user {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--color-text, #374151);
}

.user-icon {
  width: 14px;
  height: 14px;
  background-color: var(--color-bg-hover, #f3f4f6);
  border-radius: 50%;
}

/* 变更字段列表 */
.changed-fields {
  background-color: var(--color-bg-subtle, #f9fafb);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.fields-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12px;
}

.fields-label {
  color: var(--color-text-secondary, #6b7280);
  font-weight: 500;
}

.fields-count {
  color: var(--color-text-muted, #9ca3af);
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.field-item:hover {
  background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.03));
}

/* @Auditable 字段高亮 */
.field-item.field-highlight {
  background-color: rgba(255, 193, 7, 0.08);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.auditable-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--color-warning, #ffc107);
}

.badge-icon {
  width: 12px;
  height: 12px;
}

.field-name {
  color: var(--color-text, #374151);
  font-weight: 500;
  min-width: 60px;
}

.field-values {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary, #6b7280);
}

.old-value {
  text-decoration: line-through;
  color: var(--color-danger, #ef4444);
  opacity: 0.7;
}

.value-arrow {
  color: var(--color-text-muted, #9ca3af);
}

.new-value {
  color: var(--color-success, #22c55e);
}

/* 实体信息 */
.audit-entity {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted, #9ca3af);
}

.entity-type {
  padding: 1px 4px;
  background-color: var(--color-bg-hover, #f3f4f6);
  border-radius: 2px;
  text-transform: uppercase;
}

.entity-id {
  font-family: monospace;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .audit-timeline-item {
    gap: 8px;
    padding: 10px 0;
  }

  .timeline-marker {
    width: 16px;
  }

  .marker-dot {
    width: 10px;
    height: 10px;
  }

  .field-item {
    flex-wrap: wrap;
  }

  .field-values {
    flex-wrap: wrap;
    width: 100%;
  }
}
</style>