/**
 * AssetLifecycle.vue - 资产生命周期时间轴组件
 * 
 * 功能说明:
 * - 展示资产从采购到报废的全生命周期状态流转
 * - 以时间轴形式呈现历史事件
 * - 支持查看状态变更详情
 * 
 * 依赖:
 * - lifecycleService: 获取生命周期数据
 * - useAuditLogs: 获取审计日志
 */

<template>
  <div class="asset-lifecycle" v-if="isLoaded">
    <div class="timeline-header">
      <h3 class="timeline-title">资产生命周期</h3>
      <div class="timeline-controls">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="desc">最新优先</el-radio-button>
          <el-radio-button label="asc">最早优先</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    
    <el-timeline class="lifecycle-timeline" v-if="timelineEvents.length > 0">
      <el-timeline-item
        v-for="(event, index) in timelineEvents"
        :key="event.id || index"
        :timestamp="formatTimestamp(event.timestamp)"
        :type="getEventType(event.event)"
        :hollow="event.event === '当前状态'"
      >
        <div class="timeline-content">
          <div class="event-header">
            <el-tag :type="getEventTagType(event.event)" size="small">
              {{ getEventLabel(event.event) }}
            </el-tag>
            <span class="event-operator" v-if="event.operator">
              {{ event.operator }}
            </span>
          </div>
          
          <div class="event-details" v-if="event.details">
            <p class="event-reason" v-if="event.details.reason">
              {{ event.details.reason }}
            </p>
            <div class="event-meta" v-if="event.details.metadata">
              <span 
                v-for="(value, key) in event.details.metadata" 
                :key="key"
                class="meta-item"
              >
                {{ formatMetaKey(key) }}: {{ value }}
              </span>
            </div>
          </div>
          
          <div class="event-description" v-if="event.description">
            {{ event.description }}
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
    
    <el-empty 
      v-else 
      description="暂无生命周期记录"
      :image-size="80"
    />
  </div>
  
  <div v-else class="lifecycle-loading">
    <el-skeleton :rows="5" animated />
  </div>
</template>

<script setup lang="ts">
/**
 * 资产生命周期时间轴组件
 * 
 * @description 
 * 用于展示资产的全生命周期历史记录，包括：
 * - 采购入库
 * - 领用/分配
 * - 维修记录
 * - 状态变更
 * - 报废/退役申请
 * - 审批记录
 * 
 * @prop {string} assetId - 资产ID
 * @prop {string} sortOrder - 排序方式: 'asc' | 'desc'
 * 
 * @emits {Event} view-detail - 查看事件详情
 * 
 * @example
 * <AssetLifecycle :asset-id="asset.id" sort-order="desc" />
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useLifecycleService } from '@/services/retirementService';
import type { LifecycleEvent, TimelineEvent } from '@/types/retirement.types';

/**
 * Props 接口定义
 */
interface Props {
  /** 资产ID */
  assetId: string;
  /** 排序方式 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 组件属性
 */
const props = withDefaults(defineProps<Props>(), {
  sortOrder: 'desc'
});

/**
 * 组件事件
 */
const emit = defineEmits<{
  /** 查看事件详情 */
  (e: 'view-detail', event: TimelineEvent): void;
}>();

/**
 * 视图模式: desc=倒序(最新优先), asc=正序(最早优先)
 */
const viewMode = ref<'asc' | 'desc'>(props.sortOrder);

/**
 * 是否加载完成
 */
const isLoaded = ref(false);

/**
 * 原始生命周期事件列表
 */
const rawEvents = ref<LifecycleEvent[]>([]);

/**
 * 生命周期服务
 */
const lifecycleService = useLifecycleService();

/**
 * 时间轴事件列表(计算属性)
 * 根据视图模式排序
 */
const timelineEvents = computed(() => {
  const events = [...rawEvents.value];
  
  if (viewMode.value === 'desc') {
    return events.reverse();
  }
  
  return events;
});

/**
 * 获取事件类型对应的颜色
 * 
 * @param event - 事件类型
 * @returns UIKIT 颜色类型
 */
const getEventType = (event: string): string => {
  const typeMap: Record<string, string> = {
    '采购入库': 'primary',
    '领用': 'success',
    '归还': 'info',
    '维修': 'warning',
    '状态变更': 'info',
    '报废申请': 'danger',
    '退役申请': 'danger',
    '审批通过': 'success',
    '审批驳回': 'danger',
    '审批中': 'warning',
    '当前状态': 'primary',
    '报废完成': 'danger',
    '退役完成': 'info',
  };
  
  return typeMap[event] || 'info';
};

/**
 * 获取事件标签类型
 * 
 * @param event - 事件类型
 * @returns Element Plus 标签类型
 */
const getEventTagType = (event: string): '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  const tagMap: Record<string, '' | 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    '采购入库': 'primary',
    '领用': 'success',
    '归还': 'info',
    '维修': 'warning',
    '状态变更': 'info',
    '报废申请': 'danger',
    '退役申请': 'danger',
    '审批通过': 'success',
    '审批驳回': 'danger',
    '审批中': 'warning',
    '当前状态': 'primary',
    '报废完成': 'danger',
    '退役完成': 'info',
  };
  
  return tagMap[event] || 'info';
};

/**
 * 获取事件显示标签
 * 
 * @param event - 事件类型
 * @returns 显示文本
 */
const getEventLabel = (event: string): string => {
  const labelMap: Record<string, string> = {
    '采购入库': '📦 采购入库',
    '领用': '👤 领用',
    '归还': '↩️ 归还',
    '维修': '🔧 维修',
    '状态变更': '🔄 状态变更',
    '报废申请': '📋 报废申请',
    '退役申请': '📋 退役申请',
    '审批通过': '✅ 审批通过',
    '审批驳回': '❌ 审批驳回',
    '审批中': '⏳ 审批中',
    '当前状态': '📍 当前状态',
    '报废完成': '🗑️ 报废完成',
    '退役完成': '📤 退役完成',
  };
  
  return labelMap[event] || event;
};

/**
 * 格式化时间戳
 * 
 * @param timestamp - ISO 时间戳
 * @returns 格式化后的时间字符串
 */
const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return '-';
  
  const date = new Date(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 格式化元数据键名
 * 
 * @param key - 元数据键
 * @returns 格式化后的键名
 */
const formatMetaKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    'asset_name': '资产名称',
    'asset_code': '资产编码',
    'old_status': '原状态',
    'new_status': '新状态',
    'approver': '审批人',
    'reason': '原因',
    'estimated_value': '预估残值',
    'actual_value': '实际价值',
    'department': '部门',
    'location': '位置',
  };
  
  return keyMap[key] || key;
};

/**
 * 加载生命周期数据
 * 
 * @description
 * 从服务获取资产的生命周期历史记录
 */
const loadLifecycleData = async (): Promise<void> => {
  if (!props.assetId) return;
  
  try {
    isLoaded.value = false;
    
    const response = await lifecycleService.getAssetLifecycle(props.assetId);
    
    if (response && response.data) {
      rawEvents.value = response.data.events || [];
    } else {
      rawEvents.value = [];
    }
  } catch (error) {
    console.error('加载生命周期数据失败:', error);
    rawEvents.value = [];
  } finally {
    isLoaded.value = true;
  }
};

/**
 * 查看事件详情
 * 
 * @param event - 时间轴事件
 */
const handleViewDetail = (event: TimelineEvent): void => {
  emit('view-detail', event);
};

// 监听资产ID变化
watch(
  () => props.assetId,
  (newId) => {
    if (newId) {
      loadLifecycleData();
    }
  },
  { immediate: true }
);

// 组件挂载时加载数据
onMounted(() => {
  loadLifecycleData();
});

// 暴露方法给父组件
defineExpose({
  /** 刷新数据 */
  refresh: loadLifecycleData,
  /** 获取事件列表 */
  getEvents: () => rawEvents.value,
});
</script>

<style scoped>
/**
 * 资产生命周期时间轴样式
 */
.asset-lifecycle {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.timeline-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.timeline-controls {
  display: flex;
  gap: 8px;
}

.lifecycle-timeline {
  padding: 8px 0;
}

.timeline-content {
  padding: 4px 0;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.event-operator {
  font-size: 12px;
  color: #909399;
}

.event-details {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-top: 8px;
}

.event-reason {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.meta-item {
  display: inline-flex;
  gap: 4px;
}

.event-description {
  margin-top: 8px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.lifecycle-loading {
  padding: 24px;
}

/* 空状态样式 */
:deep(.el-empty__description) {
  color: #909399;
}
</style>