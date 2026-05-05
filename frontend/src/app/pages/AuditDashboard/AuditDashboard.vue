/**
 * AuditDashboard.vue
 * 
 * 操作日志仪表板页面组件
 * 
 * 功能特性:
 * - 折线图展示操作趋势（按时间段聚合）
 * - 饼图展示操作类型分布
 * - Top10 活跃用户排名列表
 * 
 * @description SWARM-003: 操作日志仪表板 - 仪表板可视化层实现
 * @requires Vue 3 Composition API
 * @requires ECharts (via @/components/ui/BaseEChart)
 * @requires useAuditDashboard (hooks/useAuditDashboard)
 */
<template>
  <div class="audit-dashboard" data-testid="audit-dashboard-page">
    <!-- Header -->
    <header class="audit-dashboard__header">
      <h1 class="audit-dashboard__title">{{ t('audit.dashboard.title') }}</h1>
      <p class="audit-dashboard__subtitle">{{ t('audit.dashboard.subtitle') }}</p>
    </header>

    <!-- Loading State -->
    <div 
      v-if="loading" 
      class="audit-dashboard__loading" 
      data-testid="loading-spinner"
    >
      <div class="loading-spinner"></div>
      <span>{{ t('common.loading') }}</span>
    </div>

    <!-- Error State -->
    <div 
      v-else-if="error" 
      class="audit-dashboard__error" 
      data-testid="error-message"
    >
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
      <button @click="refresh" class="retry-button">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Dashboard Content -->
    <main v-else class="audit-dashboard__content">
      <!-- KPI Cards Row -->
      <section class="audit-dashboard__kpi-row">
        <div class="kpi-card">
          <span class="kpi-card__label">{{ t('audit.dashboard.totalOperations') }}</span>
          <span class="kpi-card__value">{{ statistics?.totalOperations ?? 0 }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">{{ t('audit.dashboard.activeUsers') }}</span>
          <span class="kpi-card__value">{{ statistics?.activeUsers ?? 0 }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">{{ t('audit.dashboard.avgDailyOperations') }}</span>
          <span class="kpi-card__value">{{ statistics?.avgDailyOperations ?? 0 }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__label">{{ t('audit.dashboard.peakHour') }}</span>
          <span class="kpi-card__value">{{ statistics?.peakHour ?? '--:--' }}</span>
        </div>
      </section>

      <!-- Charts Row -->
      <section class="audit-dashboard__charts-row">
        <!-- Trend Line Chart (折线图 - 操作趋势) -->
        <div class="chart-card chart-card--wide">
          <h3 class="chart-card__title">{{ t('audit.dashboard.trendTitle') }}</h3>
          <div 
            ref="trendChartRef" 
            class="chart-card__chart" 
            data-testid="trend-chart"
          ></div>
        </div>

        <!-- Distribution Pie Chart (饼图 - 操作类型分布) -->
        <div class="chart-card">
          <h3 class="chart-card__title">{{ t('audit.dashboard.distributionTitle') }}</h3>
          <div 
            ref="distributionChartRef" 
            class="chart-card__chart" 
            data-testid="distribution-chart"
          ></div>
        </div>
      </section>

      <!-- Top Users Row -->
      <section class="audit-dashboard__top-users">
        <h3 class="section-title">{{ t('audit.dashboard.topUsersTitle') }}</h3>
        <div 
          class="top-users-list" 
          data-testid="top-users-list"
        >
          <div 
            v-for="(user, index) in topUsers" 
            :key="user.userId"
            class="top-users-item"
          >
            <span class="top-users-item__rank" :class="`rank--${index + 1}`">
              {{ index + 1 }}
            </span>
            <span class="top-users-item__name">{{ user.username }}</span>
            <span class="top-users-item__count">{{ user.operationCount }}</span>
            <div class="top-users-item__bar">
              <div 
                class="top-users-item__bar-fill" 
                :style="{ width: getBarWidth(user.operationCount) + '%' }"
              ></div>
            </div>
          </div>
          <div 
            v-if="topUsers.length === 0" 
            class="top-users-empty"
          >
            {{ t('audit.dashboard.noData') }}
          </div>
        </div>
      </section>

      <!-- Recent Operations Table -->
      <section class="audit-dashboard__recent-table">
        <h3 class="section-title">{{ t('audit.dashboard.recentOperations') }}</h3>
        <AuditTable 
          :records="records" 
          :loading="loading"
          @page-change="handlePageChange"
        />
      </section>
    </main>

    <!-- Refresh FAB -->
    <button 
      class="audit-dashboard__fab" 
      @click="refresh"
      :title="t('common.refresh')"
    >
      🔄
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * AuditDashboard Component
 * 
 * 操作日志仪表板主组件，负责页面布局和数据展示。
 * 
 * @component
 * @requires useAuditDashboard
 * @requires BaseEChart
 * @requires AuditTable
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as echarts from 'echarts';

// Hooks
import { useAuditDashboard } from '../hooks/useAuditDashboard';

// Types
import type { TrendData, DistributionData, TopUserData, AuditRecord } from '../types/audit.types';

// Components
import AuditTable from '../components/AuditTable/index.vue';

// Constants
const DEFAULT_TREND_COLOR = '#5470c6';
const DEFAULT_DISTRIBUTION_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'];

// ── i18n ─────────────────────────────────────────────────────────────────────
const { t } = useI18n();

// ── Hooks ─────────────────────────────────────────────────────────────────────
const {
  loading,
  error,
  records,
  statistics,
  trendData,
  distributionData,
  topUsers,
  filters,
  fetchDashboardData,
  refresh,
  setTimeRange,
  setGranularity,
} = useAuditDashboard();

// ── Refs ─────────────────────────────────────────────────────────────────────
const trendChartRef = ref<HTMLDivElement | null>(null);
const distributionChartRef = ref<HTMLDivElement | null>(null);

let trendChartInstance: echarts.ECharts | null = null;
let distributionChartInstance: echarts.ECharts | null = null;

// ── Computed ─────────────────────────────────────────────────────────────────
/**
 * 计算 Top10 用户排名的最大操作次数
 * 用于归一化进度条宽度
 */
const maxOperationCount = computed(() => {
  if (!topUsers.value || topUsers.value.length === 0) return 1;
  return Math.max(...topUsers.value.map(u => u.operationCount));
});

/**
 * 根据时间范围自动调整图表粒度
 */
const autoGranularity = computed(() => {
  const start = new Date(filters.value.startTime);
  const end = new Date(filters.value.endTime);
  const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dayDiff <= 1) return 'hour';
  if (dayDiff <= 7) return 'day';
  if (dayDiff <= 30) return 'week';
  return 'month';
});

// ── Methods ───────────────────────────────────────────────────────────────────
/**
 * 计算进度条宽度百分比
 * 
 * @param count - 用户操作次数
 * @returns 百分比数值 (0-100)
 */
function getBarWidth(count: number): number {
  if (maxOperationCount.value === 0) return 0;
  return Math.round((count / maxOperationCount.value) * 100);
}

/**
 * 初始化趋势折线图
 */
function initTrendChart(): void {
  if (!trendChartRef.value) return;
  
  trendChartInstance = echarts.init(trendChartRef.value);
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { backgroundColor: '#6a7985' }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.value.map(d => d.timestamp)
    },
    yAxis: {
      type: 'value',
      name: t('audit.dashboard.operationCount')
    },
    series: [
      {
        name: t('audit.dashboard.operations'),
        type: 'line',
        smooth: true,
        itemStyle: { color: DEFAULT_TREND_COLOR },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(84, 112, 198, 0.5)' },
            { offset: 1, color: 'rgba(84, 112, 198, 0.1)' }
          ])
        },
        data: trendData.value.map(d => d.count)
      }
    ]
  };
  
  trendChartInstance.setOption(option);
}

/**
 * 初始化分布饼图
 */
function initDistributionChart(): void {
  if (!distributionChartRef.value) return;
  
  distributionChartInstance = echarts.init(distributionChartRef.value);
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: t('audit.dashboard.operationType'),
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: distributionData.value.map((d, i) => ({
          name: d.operationType,
          value: d.count,
          itemStyle: { color: DEFAULT_DISTRIBUTION_COLORS[i % DEFAULT_DISTRIBUTION_COLORS.length] }
        }))
      }
    ]
  };
  
  distributionChartInstance.setOption(option);
}

/**
 * 更新趋势图表数据
 */
function updateTrendChart(): void {
  if (!trendChartInstance) return;
  
  trendChartInstance.setOption({
    xAxis: {
      data: trendData.value.map(d => d.timestamp)
    },
    series: [{
      data: trendData.value.map(d => d.count)
    }]
  });
}

/**
 * 更新分布图表数据
 */
function updateDistributionChart(): void {
  if (!distributionChartInstance) return;
  
  distributionChartInstance.setOption({
    series: [{
      data: distributionData.value.map((d, i) => ({
        name: d.operationType,
        value: d.count,
        itemStyle: { color: DEFAULT_DISTRIBUTION_COLORS[i % DEFAULT_DISTRIBUTION_COLORS.length] }
      }))
    }]
  });
}

/**
 * 响应窗口调整事件
 */
function handleResize(): void {
  trendChartInstance?.resize();
  distributionChartInstance?.resize();
}

/**
 * 处理页码变化
 */
function handlePageChange(page: number): void {
  // 通知父组件或更新本地状态
  console.log('Page changed to:', page);
}

// ── Watchers ─────────────────────────────────────────────────────────────────
/**
 * 监听趋势数据变化，更新图表
 */
watch(trendData, () => {
  if (trendChartInstance) {
    updateTrendChart();
  }
}, { deep: true });

/**
 * 监听分布数据变化，更新图表
 */
watch(distributionData, () => {
  if (distributionChartInstance) {
    updateDistributionChart();
  }
}, { deep: true });

/**
 * 监听粒度变化，重新获取数据
 */
watch(autoGranularity, (newGranularity) => {
  setGranularity(newGranularity);
  fetchDashboardData();
});

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  // 初始化图表
  initTrendChart();
  initDistributionChart();
  
  // 添加窗口调整监听
  window.addEventListener('resize', handleResize);
  
  // 获取仪表板数据
  await fetchDashboardData();
});

onUnmounted(() => {
  // 销毁图表实例
  trendChartInstance?.dispose();
  distributionChartInstance?.dispose();
  
  // 移除窗口调整监听
  window.removeEventListener('resize', handleResize);
});
</script>

<style module>
/**
 * AuditDashboard 样式模块
 * 
 * 包含仪表板页面所有样式定义：
 * - 布局样式 (grid, flexbox)
 * - 图表容器样式
 * - 响应式适配
 */

/* ── Container ───────────────────────────────────────────────────────────── */
.dashboard {
  /**
   * 仪表板主容器
   * 使用 CSS Grid 实现响应式两列布局
   */
  container-type: inline-size;
  container-name: audit-dashboard;
  min-height: 100vh;
  padding: var(--spacing-lg, 24px);
  background: var(--bg-secondary, #f5f7fa);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.header {
  margin-bottom: var(--spacing-xl, 32px);
}

.title {
  font-size: var(--font-size-2xl, 28px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary, #1f2937);
  margin-bottom: var(--spacing-xs, 4px);
}

.subtitle {
  font-size: var(--font-size-sm, 14px);
  color: var(--text-secondary, #6b7280);
}

/* ── KPI Cards ───────────────────────────────────────────────────────────── */
.kpiRow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md, 16px);
  margin-bottom: var(--spacing-xl, 32px);
}

@media (max-width: 1024px) {
  .kpiRow {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .kpiRow {
    grid-template-columns: 1fr;
  }
}

.kpiCard {
  background: var(--bg-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 24px);
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  transition: box-shadow 0.2s ease;
}

.kpiCard:hover {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
}

.kpiLabel {
  display: block;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-xs, 4px);
}

.kpiValue {
  display: block;
  font-size: var(--font-size-3xl, 36px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary, #1f2937);
}

/* ── Charts ─────────────────────────────────────────────────────────────── */
.chartsRow {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--spacing-lg, 24px);
  margin-bottom: var(--spacing-xl, 32px);
}

@media (max-width: 1024px) {
  .chartsRow {
    grid-template-columns: 1fr;
  }
}

.chartCard {
  background: var(--bg-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 24px);
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
}

.chartTitle {
  font-size: var(--font-size-lg, 18px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #1f2937);
  margin-bottom: var(--spacing-md, 16px);
}

.chartContainer {
  height: 320px;
  width: 100%;
}

/* ── Top Users ───────────────────────────────────────────────────────────── */
.topUsersSection {
  background: var(--bg-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 24px);
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  margin-bottom: var(--spacing-xl, 32px);
}

.sectionTitle {
  font-size: var(--font-size-lg, 18px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #1f2937);
  margin-bottom: var(--spacing-lg, 24px);
}

.topUsersList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.topUsersItem {
  display: grid;
  grid-template-columns: 40px 1fr 80px 200px;
  align-items: center;
  gap: var(--spacing-md, 16px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  border-radius: var(--radius-md, 8px);
  transition: background-color 0.2s ease;
}

.topUsersItem:hover {
  background-color: var(--bg-secondary, #f5f7fa);
}

.topUsersRank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: var(--font-weight-bold, 700);
  font-size: var(--font-size-sm, 14px);
  color: var(--text-white, #ffffff);
  background: var(--bg-gray-300, #d1d5db);
}

.rank--1 {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
}

.rank--2 {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
}

.rank--3 {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.topUsersName {
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #1f2937);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topUsersCount {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #1f2937);
  text-align: right;
}

.topUsersBar {
  height: 8px;
  background: var(--bg-gray-200, #e5e7eb);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.topUsersBarFill {
  height: 100%;
  background: linear-gradient(90deg, #5470c6 0%, #91cc75 100%);
  border-radius: var(--radius-full, 9999px);
  transition: width 0.5s ease-out;
}

.topUsersEmpty {
  padding: var(--spacing-xl, 32px);
  text-align: center;
  color: var(--text-secondary, #6b7280);
}

/* ── Recent Table ────────────────────────────────────────────────────────── */
.recentTableSection {
  background: var(--bg-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-lg, 24px);
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
}

/* ── Loading & Error ─────────────────────────────────────────────────────── */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--spacing-md, 16px);
}

.loadingSpinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-gray-200, #e5e7eb);
  border-top-color: var(--color-primary, #5470c6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--spacing-md, 16px);
  color: var(--color-error, #ef4444);
}

.errorIcon {
  font-size: 48px;
}

.retryButton {
  margin-top: var(--spacing-md, 16px);
  padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px);
  background: var(--color-primary, #5470c6);
  color: var(--text-white, #ffffff);
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retryButton:hover {
  background: var(--color-primary-dark, #4352a0);
}

/* ── FAB ─────────────────────────────────────────────────────────────────── */
.fab {
  position: fixed;
  bottom: var(--spacing-xl, 32px);
  right: var(--spacing-xl, 32px);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary, #5470c6);
  color: var(--text-white, #ffffff);
  border: none;
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  cursor: pointer;
  font-size: 24px;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.fab:hover {
  transform: scale(1.1);
  background: var(--color-primary-dark, #4352a0);
}

.fab:active {
  transform: scale(0.95);
}
</style>