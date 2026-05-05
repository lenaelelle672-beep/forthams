<template>
  <div class="dashboard">
    <!-- 页面标题栏 -->
    <header class="dashboard-header">
      <div class="dashboard-header__left">
        <h1 class="dashboard-header__title">资产总览</h1>
        <span class="dashboard-header__subtitle">实时掌握资产全貌与关键预警</span>
      </div>
      <div class="dashboard-header__right">
        <el-button 
          type="primary" 
          :icon="Refresh" 
          :loading="isRefreshing"
          class="dashboard-header__refresh-btn"
          @click="handleRefresh"
        >
          刷新数据
        </el-button>
      </div>
    </header>

    <!-- 主体内容区 -->
    <main class="dashboard-main">
      <!-- 左侧统计区 (60%) -->
      <section class="dashboard-stats">
        <div class="stats-grid">
          <!-- 资产总数卡片 -->
          <StatCard
            title="资产总数"
            :value="summary.total"
            icon="Box"
            :loading="statsLoading"
            :trend="{ value: 12, isUp: true }"
          />
          
          <!-- 今日新增卡片 -->
          <StatCard
            title="今日新增"
            :value="summary.todayNew"
            icon="Plus"
            :loading="statsLoading"
            :trend="{ value: 3, isUp: true }"
          />
          
          <!-- 维保中资产卡片 -->
          <StatCard
            title="维保中资产"
            :value="summary.maintenanceCount"
            icon="Tool"
            :loading="statsLoading"
          />
          
          <!-- 即将到期卡片 -->
          <StatCard
            title="即将到期"
            :value="summary.expiringCount"
            icon="Warning"
            :loading="statsLoading"
          />
        </div>

        <!-- 资产分类饼图 -->
        <div class="category-chart">
          <h3 class="section-title">资产分类分布</h3>
          <div class="category-chart__content">
            <div class="category-chart__pie">
              <PieChart :data="categoryData" :loading="statsLoading" />
            </div>
            <ul class="category-chart__legend">
              <li 
                v-for="(item, index) in summary.byCategory" 
                :key="index"
                class="legend-item"
              >
                <span 
                  class="legend-item__color" 
                  :style="{ backgroundColor: legendColors[index] }"
                ></span>
                <span class="legend-item__name">{{ item.name }}</span>
                <span class="legend-item__value">{{ item.value }}</span>
                <span class="legend-item__percent">
                  ({{ calculatePercent(item.value, summary.total) }}%)
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 趋势图表 -->
        <div class="trend-section">
          <h3 class="section-title">资产新增趋势</h3>
          <TrendChart 
            title="近6个月资产新增趋势"
            :data="trendData"
            :loading="trendLoading"
          />
        </div>
      </section>

      <!-- 右侧预警区 (40%) -->
      <aside class="dashboard-warnings">
        <!-- 维保到期预警 -->
        <WarningPanel
          title="维保到期预警"
          :list="maintenanceWarnings"
          :loading="warningLoading"
          type="maintenance"
        />

        <!-- 报废到期预警 -->
        <WarningPanel
          title="报废到期预警"
          :list="scrapWarnings"
          :loading="warningLoading"
          type="scrap"
        />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import StatCard from '../components/StatCard/index.vue'
import WarningPanel from '../components/WarningPanel/index.vue'
import TrendChart from '../components/TrendChart/index.vue'
import PieChart from '../components/PieChart/index.vue'
import { useDashboardStore } from '@/stores/dashboardStore'

// Pinia Store
const dashboardStore = useDashboardStore()

// 响应式状态
const isRefreshing = ref(false)

// 加载状态
const statsLoading = computed(() => dashboardStore.loading)
const warningLoading = computed(() => dashboardStore.loading)
const trendLoading = computed(() => dashboardStore.loading)

// 统计数据
const summary = computed(() => ({
  total: dashboardStore.summary.total || 0,
  todayNew: dashboardStore.summary.todayNew || 0,
  maintenanceCount: dashboardStore.summary.maintenanceCount || 0,
  expiringCount: dashboardStore.summary.expiringCount || 0,
  byCategory: dashboardStore.summary.byCategory || []
}))

// 预警数据
const maintenanceWarnings = computed(() => {
  return dashboardStore.warnings
    .filter(w => w.type === 'maintenance')
    .slice(0, 10)
})

const scrapWarnings = computed(() => {
  return dashboardStore.warnings
    .filter(w => w.type === 'scrap')
    .slice(0, 10)
})

// 趋势数据
const trendData = computed(() => {
  const data = dashboardStore.trendData
  return {
    labels: data?.labels || ['9月', '10月', '11月', '12月', '1月', '2月'],
    values: data?.values || [0, 0, 0, 0, 0, 0]
  }
})

// 分类数据
const categoryData = computed(() => {
  return summary.value.byCategory.map(item => ({
    name: item.name,
    value: item.value
  }))
})

// 图例颜色
const legendColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']

// 计算百分比
function calculatePercent(value: number, total: number): string {
  if (total === 0) return '0.0'
  return ((value / total) * 100).toFixed(1)
}

// 刷新数据
async function handleRefresh() {
  isRefreshing.value = true
  try {
    await Promise.all([
      dashboardStore.fetchSummary(),
      dashboardStore.fetchWarnings(),
      dashboardStore.fetchTrend()
    ])
    ElMessage.success('数据已刷新')
  } catch (error) {
    ElMessage.error('刷新失败，请重试')
  } finally {
    isRefreshing.value = false
  }
}

// 初始化加载数据
onMounted(async () => {
  try {
    await Promise.all([
      dashboardStore.fetchSummary(),
      dashboardStore.fetchWarnings(),
      dashboardStore.fetchTrend()
    ])
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
})
</script>

<style scoped>
.dashboard {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.dashboard-header__left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-header__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.dashboard-header__subtitle {
  font-size: 14px;
  color: #909399;
}

.dashboard-header__refresh-btn {
  min-width: 120px;
}

.dashboard-main {
  display: flex;
  gap: 24px;
  min-height: calc(100vh - 180px);
}

/* 左侧统计区 */
.dashboard-stats {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  padding-left: 12px;
  border-left: 4px solid #409EFF;
}

.category-chart {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.category-chart__content {
  display: flex;
  gap: 24px;
  align-items: center;
}

.category-chart__pie {
  flex: 0 0 280px;
  height: 280px;
}

.category-chart__legend {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.legend-item:hover {
  background: #ecf5ff;
}

.legend-item__color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-item__name {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.legend-item__value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  min-width: 50px;
  text-align: right;
}

.legend-item__percent {
  font-size: 12px;
  color: #909399;
  min-width: 60px;
  text-align: right;
}

.trend-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  flex: 1;
}

/* 右侧预警区 */
.dashboard-warnings {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 响应式适配 */
@media screen and (max-width: 1279px) {
  .dashboard-main {
    flex-direction: column;
  }

  .dashboard-stats,
  .dashboard-warnings {
    flex: 1 1 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media screen and (max-width: 1023px) {
  .dashboard {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .category-chart__content {
    flex-direction: column;
  }

  .category-chart__pie {
    flex: 0 0 auto;
    width: 100%;
    height: 220px;
  }
}
</style>