<template>
  <div class="maintenance-alert-card" data-testid="maintenance-alert-card">
    <div class="card-header">
      <div class="header-title">
        <el-icon><WarningFilled /></el-icon>
        <span>维保到期预警</span>
      </div>
      <div class="header-actions">
        <el-select
          v-model="filterSeverity"
          placeholder="筛选状态"
          size="small"
          clearable
          class="severity-filter"
          @change="handleFilterChange"
        >
          <el-option label="全部" value="all" />
          <el-option label="紧急" value="critical" />
          <el-option label="警示" value="warning" />
          <el-option label="正常" value="normal" />
        </el-select>
      </div>
    </div>

    <div class="alert-list" data-testid="maintenance-alerts">
      <template v-if="displayedAlerts.length > 0">
        <div
          v-for="alert in displayedAlerts"
          :key="alert.assetId"
          :data-testid="'alert-item'"
          :data-severity="alert.severity"
          class="alert-item"
          :class="`severity-${alert.severity}`"
        >
          <div class="alert-content">
            <div class="alert-main">
              <span class="asset-name">{{ alert.assetName }}</span>
              <span class="asset-code">({{ alert.assetCode }})</span>
            </div>
            <div class="alert-meta">
              <span class="due-date">
                <el-icon><Calendar /></el-icon>
                到期: {{ formatDate(alert.dueDate) }}
              </span>
              <span class="days-left" :class="`days-${alert.severity}`">
                {{ alert.daysLeft }}天后
              </span>
            </div>
          </div>
          <div class="alert-actions">
            <el-button
              type="primary"
              link
              size="small"
              :data-testid="`handle-btn-${alert.assetId}`"
              @click="handleMarkProcessed(alert)"
            >
              标记已处理
            </el-button>
          </div>
        </div>
      </template>
      <el-empty
        v-else
        :image-size="60"
        description="暂无维保预警"
      />
    </div>

    <div v-if="totalCount > MAX_DISPLAY" class="card-footer">
      <el-link type="primary" :underline="false" @click="goToFullList">
        查看全部 {{ totalCount }} 条预警
        <el-icon><ArrowRight /></el-icon>
      </el-link>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 维保到期预警卡片组件
 * 
 * 功能说明：
 * - 展示即将到期维保资产列表（最多显示5条）
 * - 按紧急程度分级显示：紧急(<7天) / 警示(7-30天) / 正常(>30天)
 * - 支持状态筛选和一键标记处理
 * 
 * @component
 * @example
 * <MaintenanceAlertCard
 *   :alerts="maintenanceAlerts"
 *   :loading="false"
 *   @handle-process="onHandleProcess"
 * />
 */
import { ref, computed } from 'vue'
import { ElIcon, ElButton, ElSelect, ElOption, ElEmpty, ElLink } from 'element-plus'
import { WarningFilled, Calendar, ArrowRight } from '@element-plus/icons-vue'

/** 维保预警项接口 */
export interface MaintenanceAlert {
  /** 资产ID */
  assetId: string
  /** 资产名称 */
  assetName: string
  /** 资产编码 */
  assetCode: string
  /** 到期日期 */
  dueDate: string
  /** 剩余天数 */
  daysLeft: number
  /** 严重程度: critical/warning/normal */
  severity: 'critical' | 'warning' | 'normal'
  /** 是否已处理 */
  processed: boolean
}

interface Props {
  /** 预警列表数据 */
  alerts: MaintenanceAlert[]
  /** 加载状态 */
  loading?: boolean
  /** 总数（用于判断是否显示"查看全部"） */
  total?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0
})

const emit = defineEmits<{
  /** 标记处理事件 */
  (e: 'handle-process', alert: MaintenanceAlert): void
  /** 跳转全部列表 */
  (e: 'view-all'): void
}>()

/** 最大显示数量 */
const MAX_DISPLAY = 5

/** 当前筛选状态 */
const filterSeverity = ref<string>('all')

/**
 * 根据严重程度计算预警级别
 * @param daysLeft 剩余天数
 * @returns 严重程度等级
 */
function calculateSeverity(daysLeft: number): 'critical' | 'warning' | 'normal' {
  if (daysLeft < 7) return 'critical'
  if (daysLeft <= 30) return 'warning'
  return 'normal'
}

/**
 * 格式化日期显示
 * @param dateStr ISO 日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 根据筛选条件过滤预警列表
 */
const filteredAlerts = computed(() => {
  if (filterSeverity.value === 'all') {
    return props.alerts
  }
  return props.alerts.filter(alert => alert.severity === filterSeverity.value)
})

/**
 * 按紧急程度排序后的预警列表
 * 紧急 > 警示 > 正常
 */
const sortedAlerts = computed(() => {
  const severityOrder = { critical: 0, warning: 1, normal: 2 }
  return [...filteredAlerts.value].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
})

/**
 * 显示的预警列表（最多 MAX_DISPLAY 条）
 */
const displayedAlerts = computed(() => {
  return sortedAlerts.value.slice(0, MAX_DISPLAY)
})

/**
 * 总数
 */
const totalCount = computed(() => props.total || props.alerts.length)

/**
 * 处理筛选状态变更
 */
function handleFilterChange(value: string) {
  filterSeverity.value = value
}

/**
 * 处理标记已处理
 * @param alert 预警项
 */
async function handleMarkProcessed(alert: MaintenanceAlert) {
  emit('handle-process', alert)
}

/**
 * 跳转到完整列表页面
 */
function goToFullList() {
  emit('view-all')
}
</script>

<style scoped>
.maintenance-alert-card {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-title .el-icon {
  color: var(--el-color-warning);
}

.severity-filter {
  width: 120px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}

.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border-left: 4px solid transparent;
  transition: all 0.2s ease;
}

.alert-item:hover {
  background: var(--el-fill-color);
}

.alert-item.severity-critical {
  border-left-color: var(--el-color-danger);
  background: rgba(245, 108, 108, 0.08);
}

.alert-item.severity-warning {
  border-left-color: var(--el-color-warning);
  background: rgba(230, 162, 60, 0.08);
}

.alert-item.severity-normal {
  border-left-color: var(--el-color-success);
}

.alert-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alert-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asset-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.asset-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.alert-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
}

.days-left {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.days-critical {
  color: var(--el-color-danger);
  background: rgba(245, 108, 108, 0.15);
}

.days-warning {
  color: var(--el-color-warning);
  background: rgba(230, 162, 60, 0.15);
}

.days-normal {
  color: var(--el-color-success);
  background: rgba(103, 194, 58, 0.15);
}

.alert-actions {
  flex-shrink: 0;
}

.card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
  text-align: center;
}
</style>