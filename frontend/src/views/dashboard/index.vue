/**
 * Dashboard Index View Component
 * 
 * Provides a comprehensive dashboard for asset management visualization including:
 * - Asset overview statistics (total count, today's additions, monthly changes)
 * - Category distribution chart (pie/bar chart)
 * - Expiration warning list for assets approaching end-of-life
 * 
 * SWARM-003: Dashboard Data Visualization - Phase 1
 * 
 * @module views/dashboard
 * @requires chart.js
 * @requires vue
 */

<template>
  <div class="dashboard-container">
    <!-- Asset Overview Statistics Section -->
    <section class="stats-section" data-testid="dashboard-stats">
      <StatCard
        v-for="stat in overviewStats"
        :key="stat.id"
        :title="stat.title"
        :value="stat.value"
        :icon="stat.icon"
        :trend="stat.trend"
        :loading="loading"
      />
    </section>

    <!-- Category Distribution Chart Section -->
    <section class="chart-section" data-testid="dashboard-chart">
      <div class="chart-header">
        <h2 class="section-title">{{ t('dashboard.categoryDistribution') }}</h2>
        <div class="chart-controls">
          <button
            class="chart-toggle-btn"
            :class="{ active: chartType === 'pie' }"
            @click="setChartType('pie')"
            data-testid="chart-toggle-pie"
          >
            {{ t('dashboard.pieChart') }}
          </button>
          <button
            class="chart-toggle-btn"
            :class="{ active: chartType === 'bar' }"
            @click="setChartType('bar')"
            data-testid="chart-toggle-bar"
          >
            {{ t('dashboard.barChart') }}
          </button>
        </div>
      </div>
      <div class="chart-container" data-testid="chart-container">
        <canvas ref="chartCanvas" />
      </div>
    </section>

    <!-- Expiration Warning Section -->
    <section class="warning-section" data-testid="dashboard-warning">
      <div class="section-header">
        <h2 class="section-title">{{ t('dashboard.expirationWarning') }}</h2>
        <span class="warning-badge" v-if="warningCount > 0">
          {{ warningCount }} {{ t('dashboard.itemsExpiring') }}
        </span>
      </div>
      <div class="warning-list" data-testid="warning-list">
        <template v-if="!loading && warningAssets.length > 0">
          <WarningPanel
            v-for="asset in warningAssets"
            :key="asset.id"
            :asset="asset"
            @click="navigateToAsset(asset.id)"
          />
        </template>
        <div v-else-if="!loading" class="empty-state">
          {{ t('dashboard.noWarnings') }}
        </div>
        <div v-else class="loading-state">
          <div class="skeleton-item" v-for="i in 3" :key="i" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Dashboard Index Component Script
 * 
 * Implements the main dashboard view with three core sections:
 * asset statistics, category distribution chart, and expiration warnings.
 * 
 * @requires vue
 * @requires chart.js
 * @requires @/stores/dashboard
 * @requires @/composables/useDashboardStats
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';
import StatCard from '@/components/dashboard/StatCard.vue';
import WarningPanel from '@/components/dashboard/WarningPanel.vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useDashboardStats } from '@/composables/useDashboardStats';

// Register Chart.js components
Chart.register(...registerables);

// i18n translation composable
const { t } = useI18n();

// Dashboard store for state management
const dashboardStore = useDashboardStats();

// Reactive state
const loading = ref(true);
const chartType = ref<'pie' | 'bar'>('pie');
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Overview statistics computed from store
const overviewStats = computed(() => {
  const stats = dashboardStore.summary;
  return [
    {
      id: 'total',
      title: t('dashboard.totalAssets'),
      value: stats.total ?? 0,
      icon: 'assets',
      trend: null,
    },
    {
      id: 'today-add',
      title: t('dashboard.todayAdded'),
      value: stats.todayAdd ?? 0,
      icon: 'add',
      trend: null,
    },
    {
      id: 'month-change',
      title: t('dashboard.monthChange'),
      value: stats.monthChange ?? 0,
      icon: 'change',
      trend: stats.monthChange >= 0 ? 'up' : 'down',
    },
  ];
});

// Category statistics for chart
const categoryData = computed(() => dashboardStore.categoryStat);

// Warning assets list
const warningAssets = computed(() => {
  return dashboardStore.expiringAssets.slice(0, 5);
});

// Warning count badge
const warningCount = computed(() => {
  return dashboardStore.expiringAssets.filter(
    (asset: { expireDate: string }) => {
      const daysUntil = calculateDaysUntil(asset.expireDate);
      return daysUntil <= 30;
    }
  ).length;
});

/**
 * Calculate days until a given date
 * @param dateString - ISO date string
 * @returns number of days until the date
 */
function calculateDaysUntil(dateString: string): number {
  const targetDate = new Date(dateString);
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Set chart type and re-render
 * @param type - 'pie' or 'bar'
 */
function setChartType(type: 'pie' | 'bar'): void {
  chartType.value = type;
  renderChart();
}

/**
 * Render or update the Chart.js chart
 */
function renderChart(): void {
  if (!chartCanvas.value) return;

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  // Destroy existing chart instance
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const data = categoryData.value;
  const labels = data.map((item: { category: string }) => item.category);
  const values = data.map((item: { count: number }) => item.count);

  const chartConfig: any = {
    type: chartType.value,
    data: {
      labels,
      datasets: [
        {
          label: t('dashboard.assetCount'),
          data: values,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
          ],
          borderColor: 'rgba(255, 255, 255, 1)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: chartType.value === 'pie' ? 'right' : 'top',
        },
      },
    },
  };

  chartInstance = new Chart(ctx, chartConfig);
}

/**
 * Navigate to asset detail page
 * @param assetId - Asset ID
 */
function navigateToAsset(assetId: number): void {
  // Implementation for navigation
  // Using router.push or similar navigation method
  console.log(`Navigating to asset ${assetId}`);
}

// Lifecycle hooks
onMounted(async () => {
  try {
    loading.value = true;
    await dashboardStore.fetchDashboardData();
  } finally {
    loading.value = false;
    // Render chart after data is loaded
    setTimeout(renderChart, 100);
  }
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});

// Watch for data changes and re-render chart
watch(categoryData, () => {
  renderChart();
}, { deep: true });
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.chart-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.chart-controls {
  display: flex;
  gap: 8px;
}

.chart-toggle-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.chart-toggle-btn:hover {
  background: #f3f4f6;
}

.chart-toggle-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.chart-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  min-height: 300px;
}

.warning-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.warning-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 14px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-item {
  height: 72px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .stats-section {
    grid-template-columns: 1fr;
  }

  .chart-header {
    flex-direction: column;
    gap: 12px;
  }
}
</style>