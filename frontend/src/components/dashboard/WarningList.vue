<template>
  <div class="warning-list" data-testid="warning-list">
    <div class="warning-header">
      <h3 class="warning-title">{{ title }}</h3>
      <div class="warning-filter">
        <el-radio-group v-model="filterDays" size="small">
          <el-radio-button :label="7">7天内</el-radio-button>
          <el-radio-button :label="30">30天内</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    
    <div v-if="loading" class="warning-loading">
      <el-skeleton :rows="3" animated />
    </div>
    
    <div v-else-if="error" class="warning-error">
      <el-empty description="加载失败，请重试">
        <el-button type="primary" @click="retryLoad">重试</el-button>
      </el-empty>
    </div>
    
    <div v-else-if="warnings.length === 0" class="warning-empty">
      <el-empty :description="emptyText" />
    </div>
    
    <ul v-else class="warning-items" data-testid="warning-items">
      <li 
        v-for="item in warnings" 
        :key="item.id"
        class="warning-item"
        @click="handleItemClick(item)"
        role="button"
        tabindex="0"
        @keydown.enter="handleItemClick(item)"
      >
        <div class="warning-item-info">
          <span class="warning-item-name">{{ item.name }}</span>
          <span class="warning-item-category">{{ item.category }}</span>
        </div>
        <div class="warning-item-expire">
          <span 
            class="warning-expire-tag"
            :class="getExpireTagClass(item.daysLeft)"
          >
            {{ item.daysLeft }}天后到期
          </span>
          <span class="warning-expire-date">{{ formatDate(item.expireDate) }}</span>
        </div>
      </li>
    </ul>
    
    <div v-if="hasMore && warnings.length > 0" class="warning-footer">
      <el-button text type="primary" @click="loadMore">
        查看更多
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WarningList Component
 * 
 * 到期预警列表组件，展示即将到期的资产信息。
 * 支持7天/30天时间过滤，点击可跳转至资产详情页。
 * 
 * @component
 * @example
 * <WarningList 
 *   title="到期预警" 
 *   :loading="false"
 *   :warnings="warningData"
 *   @item-click="handleWarningClick"
 * />
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

/** 预警项接口定义 */
export interface WarningItem {
  /** 资产ID */
  id: string | number
  /** 资产名称 */
  name: string
  /** 资产分类 */
  category: string
  /** 到期日期 */
  expireDate: string | Date
  /** 剩余天数 */
  daysLeft: number
}

/** 组件Props定义 */
export interface WarningListProps {
  /** 组件标题 */
  title?: string
  /** 加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 预警数据列表 */
  warnings?: WarningItem[]
  /** 是否显示更多按钮 */
  hasMore?: boolean
  /** 空状态文本 */
  emptyText?: string
  /** 最大显示数量 */
  maxDisplay?: number
}

const props = withDefaults(defineProps<WarningListProps>(), {
  title: '到期预警',
  loading: false,
  error: null,
  warnings: () => [],
  hasMore: false,
  emptyText: '暂无到期预警',
  maxDisplay: 5
})

const emit = defineEmits<{
  /** 预警项点击事件 */
  (e: 'item-click', item: WarningItem): void
  /** 加载更多事件 */
  (e: 'load-more'): void
  /** 过滤条件变更事件 */
  (e: 'filter-change', days: number): void
}>()

const router = useRouter()
const filterDays = ref<number>(30)

/** 过滤后的预警列表 */
const filteredWarnings = computed(() => {
  return props.warnings
    .filter(item => item.daysLeft <= filterDays.value)
    .slice(0, props.maxDisplay)
})

/** 根据剩余天数获取标签样式类 */
function getExpireTagClass(daysLeft: number): string {
  if (daysLeft <= 7) {
    return 'expire-tag-danger'
  } else if (daysLeft <= 15) {
    return 'expire-tag-warning'
  }
  return 'expire-tag-info'
}

/** 格式化日期显示 */
function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/** 处理预警项点击 */
function handleItemClick(item: WarningItem): void {
  emit('item-click', item)
  router.push({
    name: 'AssetDetail',
    params: { id: item.id }
  })
}

/** 重新加载数据 */
function retryLoad(): void {
  emit('filter-change', filterDays.value)
}

/** 加载更多 */
function loadMore(): void {
  emit('load-more')
}

/** 监听过滤条件变化 */
watch(filterDays, (newDays) => {
  emit('filter-change', newDays)
})

/** 组件挂载时触发初始加载 */
onMounted(() => {
  emit('filter-change', filterDays.value)
})
</script>

<style scoped>
.warning-list {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.warning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.warning-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.warning-filter {
  display: flex;
  gap: 8px;
}

.warning-loading,
.warning-error,
.warning-empty {
  padding: 24px 0;
  text-align: center;
}

.warning-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.warning-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-bottom: 8px;
}

.warning-item:last-child {
  margin-bottom: 0;
}

.warning-item:hover {
  background-color: #f5f7fa;
}

.warning-item:focus {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}

.warning-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.warning-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.warning-item-category {
  font-size: 12px;
  color: #909399;
}

.warning-item-expire {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.warning-expire-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.expire-tag-danger {
  background-color: #fef0f0;
  color: #f56c6c;
}

.expire-tag-warning {
  background-color: #fdf6ec;
  color: #e6a23c;
}

.expire-tag-info {
  background-color: #ecf5ff;
  color: #409eff;
}

.warning-expire-date {
  font-size: 12px;
  color: #c0c4cc;
}

.warning-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}
</style>