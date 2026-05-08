<template>
  <div data-testid="page-dashboard" class="dashboard-container">
    <h1 class="dashboard-title">系统仪表盘</h1>

    <!-- Stat Cards -->
    <div class="stat-cards-grid">
      <div data-testid="stat-total-tickets" class="stat-card">
        <div class="stat-icon tickets">📋</div>
        <div class="stat-content">
          <span class="stat-label">总工单数</span>
          <span class="stat-value">{{ stats.totalTickets }}</span>
        </div>
      </div>

      <div data-testid="stat-pending-approvals" class="stat-card">
        <div class="stat-icon approvals">⏳</div>
        <div class="stat-content">
          <span class="stat-label">待审批</span>
          <span class="stat-value">{{ stats.pendingApprovals }}</span>
        </div>
      </div>

      <div data-testid="stat-total-assets" class="stat-card">
        <div class="stat-icon assets">💻</div>
        <div class="stat-content">
          <span class="stat-label">资产总数</span>
          <span class="stat-value">{{ stats.totalAssets }}</span>
        </div>
      </div>

      <div data-testid="stat-active-assets" class="stat-card">
        <div class="stat-icon active">✅</div>
        <div class="stat-content">
          <span class="stat-label">活跃资产</span>
          <span class="stat-value">{{ stats.activeAssets }}</span>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="chart-placeholder">
        <h3>资产分类分布</h3>
        <div class="pie-chart-mock">饼图占位</div>
      </div>
      <div class="chart-placeholder">
        <h3>月度趋势</h3>
        <div class="bar-chart-mock">柱状图占位</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface DashboardStats {
  totalTickets: number
  pendingApprovals: number
  totalAssets: number
  activeAssets: number
}

const stats = ref<DashboardStats>({
  totalTickets: 0,
  pendingApprovals: 0,
  totalAssets: 0,
  activeAssets: 0,
})

onMounted(async () => {
  try {
    const response = await fetch('/api/dashboard/stats')
    const result = await response.json()
    if (result.code === 200) {
      stats.value = result.data
    }
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
    // Fallback mock data for development
    stats.value = {
      totalTickets: 128,
      pendingApprovals: 15,
      totalAssets: 342,
      activeAssets: 298,
    }
  }
})
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
}

.stat-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.tickets { background-color: #e6f7ff; }
.stat-icon.approvals { background-color: #fff7e6; }
.stat-icon.assets { background-color: #f6ffed; }
.stat-icon.active { background-color: #fff1f0; }

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.chart-placeholder {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 300px;
}

.chart-placeholder h3 {
  margin-bottom: 16px;
  color: #333;
}

.pie-chart-mock, .bar-chart-mock {
  height: 200px;
  background-color: #f5f5f5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}
</style>