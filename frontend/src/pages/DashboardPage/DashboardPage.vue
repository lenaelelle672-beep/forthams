<template>
  <div class="dashboard-page" data-testid="dashboard-container">
    <el-row :gutter="24" class="dashboard-header">
      <el-col :span="24">
        <h1 class="dashboard-title">{{ t('dashboard.title') }}</h1>
        <p class="dashboard-subtitle">{{ t('dashboard.subtitle') }}</p>
      </el-col>
    </el-row>

    <!-- 资产总览统计卡片 -->
    <el-row :gutter="16" class="stat-cards-row">
      <el-col :xs="24" :sm="12" :md="6" v-for="stat in statistics" :key="stat.key">
        <StatCard
          :data-testid="`stat-card-${stat.key}`"
          :title="t(`dashboard.stats.${stat.key}`)"
          :value="stat.value"
          :icon="stat.icon"
          :trend="stat.trend"
          :trend-value="stat.trendValue"
          :color="stat.color"
        />
      </el-col>
    </el-row>

    <!-- 图表和预警区域 -->
    <el-row :gutter="24" class="charts-row">
      <!-- 分类分布图表 -->
      <el-col :xs="24" :lg="14">
        <ChartContainer
          :data-testid="'category-chart'"
          :title="t('dashboard.categoryDistribution')"
        >
          <DistributionChart
            :data="categoryData"
            :loading="categoryLoading"
            @pie-click="handleCategoryClick"
          />
        </ChartContainer>
      </el-col>

      <!-- 维保到期预警 -->
      <el-col :xs="24" :lg="10">
        <MaintenanceAlertCard
          :data-testid="'maintenance-alerts'"
          :alerts="maintenanceAlerts"
          :loading="alertsLoading"
          @refresh="fetchMaintenanceAlerts"
          @handle-alert="handleAlertAction"
        />
      </el-col>
    </el-row>

    <!-- 加载状态 -->
    <div v-if="initialLoading" class="loading-overlay">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>{{ t('dashboard.loading') }}</span>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-state" data-testid="error-state">
      <el-result
        icon="error"
        :title="t('dashboard.error.title')"
        :sub-title="t('dashboard.error.subtitle')"
      >
        <template #extra>
          <el-button type="primary" @click="refreshAll">
            {{ t('dashboard.error.retry') }}
          </el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DashboardPage - 仪表板数据看板主页面
 * 
 * 功能说明：
 * - 展示资产总览统计（总资产数、在用数、闲置数、维保中数）
 * - 显示资产分类分布环形图
 * - 展示维保到期预警列表
 * 
 * 数据来源：
 * - 资产统计：Pinia store (dashboardStore)
 * - 分类分布：API /api/dashboard/categories
 * - 维保预警：API /api/dashboard/maintenance-alerts
 * 
 * 交互说明：
 * - 分类图表扇区点击跳转至分类筛选页
 * - 预警卡片支持标记已处理操作
 * - 页面支持 60s 自动刷新
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import StatCard from './components/StatCard/StatCard.vue'
import ChartContainer from './components/ChartContainer/index.tsx'
import DistributionChart from './components/DistributionChart/DistributionChart.vue'
import MaintenanceAlertCard from './components/MaintenanceAlertCard/MaintenanceAlertCard.vue'
import { useDashboardStore } from '@/stores/dashboard'
import type { AssetStatistics, CategoryDistribution, MaintenanceAlert } from './types/dashboard.types'

// i18n
const { t } = useI18n()

// Store
const dashboardStore = useDashboardStore()

// 响应式状态
const initialLoading = ref(true)
const categoryLoading = ref(false)
const alertsLoading = ref(false)
const error = ref(false)

// 定时器
let refreshInterval: ReturnType<typeof setInterval> | null = null

// 计算属性：统计数据
const statistics = computed(() => {
  const stats = dashboardStore.statistics
  if (!stats) return []

  return [
    {
      key: 'total',
      value: stats.total || 0,
      icon: 'Collection',
      trend: stats.totalTrend || 'neutral',
      trendValue: stats.totalTrendValue || '0%',
      color: '#409EFF'
    },
    {
      key: 'inUse',
      value: stats.inUse || 0,
      icon: 'Check',
      trend: stats.inUseTrend || 'neutral',
      trendValue: stats.inUseTrendValue || '0%',
      color: '#67C23A'
    },
    {
      key: 'idle',
      value: stats.idle || 0,
      icon: 'Clock',
      trend: stats.idleTrend || 'neutral',
      trendValue: stats.idleTrendValue || '0%',
      color: '#E6A23C'
    },
    {
      key: 'underMaintenance',
      value: stats.underMaintenance || 0,
      icon: 'Tools',
      trend: stats.maintenanceTrend || 'neutral',
      trendValue: stats.maintenanceTrendValue || '0%',
      color: '#F56C6C'
    }
  ]
})

// 计算属性：分类数据
const categoryData = computed(() => {
  const categories = dashboardStore.categories
  if (!categories || categories.length === 0) return []

  return categories.map((cat: CategoryDistribution) => ({
    name: cat.categoryName,
    value: cat.count,
    categoryId: cat.categoryId
  }))
})

// 计算属性：预警数据
const maintenanceAlerts = computed(() => {
  const alerts = dashboardStore.alerts
  if (!alerts || alerts.length === 0) return []

  return alerts
    .sort((a: MaintenanceAlert, b: MaintenanceAlert) => {
      const severityOrder = { critical: 0, warning: 1, normal: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    .slice(0, 5)
})

// 方法：初始化数据
async function initializeData(): Promise<void> {
  try {
    error.value = false
    initialLoading.value = true
    
    await Promise.all([
      dashboardStore.fetchStatistics(),
      dashboardStore.fetchCategoryDistribution(),
      dashboardStore.fetchMaintenanceAlerts()
    ])
  } catch (err) {
    console.error('Dashboard initialization failed:', err)
    error.value = true
  } finally {
    initialLoading.value = false
  }
}

// 方法：获取分类分布数据
async function fetchCategoryDistribution(): Promise<void> {
  categoryLoading.value = true
  try {
    await dashboardStore.fetchCategoryDistribution()
  } catch (err) {
    console.error('Failed to fetch category distribution:', err)
  } finally {
    categoryLoading.value = false
  }
}

// 方法：获取维保预警数据
async function fetchMaintenanceAlerts(): Promise<void> {
  alertsLoading.value = true
  try {
    await dashboardStore.fetchMaintenanceAlerts()
  } catch (err) {
    console.error('Failed to fetch maintenance alerts:', err)
  } finally {
    alertsLoading.value = false
  }
}

// 方法：刷新全部数据
async function refreshAll(): Promise<void> {
  await initializeData()
}

// 方法：处理分类图表点击
function handleCategoryClick(params: { data: { categoryId: string } }): void {
  if (params?.data?.categoryId) {
    // 跳转至分类筛选页，传递 categoryId 参数
    const queryParams = new URLSearchParams({ categoryId: params.data.categoryId })
    window.location.href = `/assets?${queryParams.toString()}`
  }
}

// 方法：处理预警操作
async function handleAlertAction(alert: MaintenanceAlert): Promise<void> {
  try {
    await dashboardStore.markMaintenanceHandled(alert.assetId)
    ElMessage.success(t('dashboard.alerts.markedSuccess'))
    await fetchMaintenanceAlerts()
  } catch (err) {
    console.error('Failed to handle maintenance alert:', err)
    ElMessage.error(t('dashboard.alerts.markFailed'))
  }
}

// 生命周期：挂载
onMounted(() => {
  initializeData()
  
  // 设置 60s 自动刷新
  refreshInterval = setInterval(() => {
    if (!error.value) {
      refreshAll()
    }
  }, 60000)
})

// 生命周期：卸载
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})
</script>

<style scoped lang="scss">
.dashboard-page {
  padding: 24px;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.dashboard-header {
  margin-bottom: 24px;
}

.dashboard-title {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.dashboard-subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.stat-cards-row {
  margin-bottom: 24px;
}

.charts-row {
  margin-bottom: 24px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 1000;

  .el-icon {
    font-size: 48px;
    color: #409EFF;
    margin-bottom: 16px;
  }

  span {
    font-size: 16px;
    color: #606266;
  }
}

.error-state {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 1000;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .dashboard-page {
    padding: 16px;
  }

  .dashboard-title {
    font-size: 22px;
  }

  .stat-cards-row {
    .el-col {
      margin-bottom: 16px;
    }
  }
}
</style>