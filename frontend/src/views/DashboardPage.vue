<template>
  <div class="dashboard-page">
    <!-- 顶栏 -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="page-title">资产统计仪表板</h1>
      </div>
      <div class="header-right">
        <a-button @click="handleRefresh" :loading="loading" title="刷新数据">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        <a-dropdown :trigger="['click']">
          <a-button>{{ timeRangeLabel }}</a-button>
          <template #overlay>
            <a-menu @click="handleTimeRangeChange">
              <a-menu-item key="7d">近一周</a-menu-item>
              <a-menu-item key="30d">近一月</a-menu-item>
              <a-menu-item key="90d">近一季</a-menu-item>
              <a-menu-item key="365d">近一年</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button @click="handleExport">
          <template #icon><DownloadOutlined /></template>
          导出
        </a-button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="dashboard-content">
      <!-- 指标卡片区域 -->
      <section class="metrics-section">
        <a-row :gutter="[24, 24]">
          <a-col :xs="24" :sm="12" :md="6">
            <div class="metric-card" :class="{ loading: loading }">
              <div class="metric-icon asset-total">
                <DatabaseOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-label">资产总量</div>
                <div class="metric-value">{{ formatNumber(stats.totalAssets) }}</div>
                <div class="metric-trend up" v-if="stats.totalGrowthRate">
                  <ArrowUpOutlined /> {{ stats.totalGrowthRate }}%
                </div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="metric-card" :class="{ loading: loading }">
              <div class="metric-icon asset-new">
                <PlusCircleOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-label">本月新增</div>
                <div class="metric-value">{{ formatNumber(stats.monthlyNew) }}</div>
                <div class="metric-sub">较上月 {{ stats.monthlyNewChange }}</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="metric-card" :class="{ loading: loading }">
              <div class="metric-icon asset-warning">
                <AlertOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-label">异常资产</div>
                <div class="metric-value warning">{{ formatNumber(stats.abnormalAssets) }}</div>
                <div class="metric-sub">需处理</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="metric-card" :class="{ loading: loading }">
              <div class="metric-icon asset-value">
                <DollarOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-label">资产总值</div>
                <div class="metric-value">{{ formatCurrency(stats.totalValue) }}</div>
                <div class="metric-sub">单位：万元</div>
              </div>
            </div>
          </a-col>
        </a-row>
      </section>

      <!-- 图表区域 -->
      <section class="charts-section">
        <a-row :gutter="[24, 24]">
          <!-- 资产分类分布 -->
          <a-col :xs="24" :lg="8">
            <a-card class="chart-card" title="资产分类分布">
              <div ref="typeChartRef" class="chart-container"></div>
            </a-card>
          </a-col>
          <!-- 资产状态分布 -->
          <a-col :xs="24" :lg="8">
            <a-card class="chart-card" title="资产状态分布">
              <div ref="statusChartRef" class="chart-container"></div>
            </a-card>
          </a-col>
          <!-- 资产价值趋势 -->
          <a-col :xs="24" :lg="8">
            <a-card class="chart-card" title="资产价值趋势">
              <div ref="trendChartRef" class="chart-container"></div>
            </a-card>
          </a-col>
        </a-row>
      </section>

      <!-- 资产分类明细表格 -->
      <section class="table-section">
        <a-card title="资产分类明细">
          <template #extra>
            <a-input-search
              v-model:value="tableSearchText"
              placeholder="搜索资产名称"
              style="width: 200px"
              @search="handleTableSearch"
            />
          </template>
          <a-table
            :columns="tableColumns"
            :data-source="filteredAssetList"
            :pagination="paginationConfig"
            :loading="loading"
            :scroll="{ x: 800 }"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <a @click="handleAssetClick(record)">{{ record.name }}</a>
              </template>
              <template v-else-if="column.key === 'value'">
                {{ formatCurrency(record.value) }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusLabel(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a @click="handleAssetClick(record)">查看详情</a>
              </template>
            </template>
          </a-table>
        </a-card>
      </section>

      <!-- TOP 资产排行 -->
      <section class="top-section">
        <a-card title="资产价值 TOP 10">
          <a-list :data-source="topAssets" :loading="loading" item-layout="horizontal">
            <template #renderItem="{ item, index }">
              <a-list-item>
                <a-list-item-meta>
                  <template #avatar>
                    <a-badge :count="index + 1" :number-style="badgeStyle" />
                  </template>
                  <template #title>
                    <a @click="handleAssetClick(item)">{{ item.name }}</a>
                  </template>
                  <template #description>
                    <a-progress
                      :percent="item.percent"
                      :stroke-color="getProgressColor(index)"
                      :format="(percent) => `${formatCurrency(item.value)}`"
                    />
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * 资产统计仪表板页面组件
 * @description 提供企业级资产数据的可视化展示与实时监控能力
 * @category Pages
 * @subcategory Dashboard
 */
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import type { TableProps } from 'ant-design-vue';
import * as echarts from 'echarts';
import {
  DatabaseOutlined,
  PlusCircleOutlined,
  AlertOutlined,
  DollarOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ArrowUpOutlined
} from '@ant-design/icons-vue';

// 类型定义
interface AssetStats {
  totalAssets: number;
  totalGrowthRate: number;
  monthlyNew: number;
  monthlyNewChange: string;
  abnormalAssets: number;
  totalValue: number;
}

interface AssetTypeData {
  name: string;
  value: number;
  percent: number;
}

interface AssetRecord {
  id: number;
  name: string;
  type: string;
  value: number;
  status: 'normal' | 'maintenance' | 'scrapped';
  updateDate: string;
}

type TimeRange = '7d' | '30d' | '90d' | '365d';

const router = useRouter();

// 状态管理
const loading = ref(false);
const autoRefreshEnabled = ref(false);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

const timeRange = ref<TimeRange>('30d');
const stats = reactive<AssetStats>({
  totalAssets: 0,
  totalGrowthRate: 0,
  monthlyNew: 0,
  monthlyNewChange: '+12',
  abnormalAssets: 0,
  totalValue: 0
});

const typeDistribution = ref<AssetTypeData[]>([]);
const statusDistribution = ref<AssetTypeData[]>([]);
const valueTrendData = ref<{ date: string; value: number }[]>([]);
const assetList = ref<AssetRecord[]>([]);
const topAssets = ref<(AssetRecord & { percent: number })[]>([]);

// 表格相关
const tableSearchText = ref('');
const tableFilters = ref<Record<string, string>>({});

const tableColumns = [
  { title: '资产名称', dataIndex: 'name', key: 'name', fixed: 'left', width: 180 },
  { title: '资产类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '资产价值', dataIndex: 'value', key: 'value', width: 120, sorter: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '更新日期', dataIndex: 'updateDate', key: 'updateDate', width: 120, sorter: true },
  { title: '操作', key: 'action', fixed: 'right', width: 100 }
];

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: computed(() => filteredAssetList.value.length),
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
});

// 图表容器引用
const typeChartRef = ref<HTMLElement | null>(null);
const statusChartRef = ref<HTMLElement | null>(null);
const trendChartRef = ref<HTMLElement | null>(null);

let typeChart: echarts.ECharts | null = null;
let statusChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

// 样式配置
const badgeStyle = { backgroundColor: '#1890ff' };

// 计算属性
const timeRangeLabel = computed(() => {
  const labels: Record<TimeRange, string> = {
    '7d': '近一周',
    '30d': '近一月',
    '90d': '近一季',
    '365d': '近一年'
  };
  return labels[timeRange.value];
});

const filteredAssetList = computed(() => {
  if (!tableSearchText.value) return assetList.value;
  const search = tableSearchText.value.toLowerCase();
  return assetList.value.filter(
    (item) =>
      item.name.toLowerCase().includes(search) ||
      item.type.toLowerCase().includes(search)
  );
});

// 工具函数
function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
}

function formatCurrency(value: number): string {
  return '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    normal: 'green',
    maintenance: 'orange',
    scrapped: 'red'
  };
  return colors[status] || 'default';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    maintenance: '维修中',
    scrapped: '已报废'
  };
  return labels[status] || status;
}

function getProgressColor(index: number): string {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'];
  return colors[index] || '#1890ff';
}

// 数据获取
async function fetchDashboardData() {
  loading.value = true;
  try {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 更新统计数据
    stats.totalAssets = 12847;
    stats.totalGrowthRate = 3.2;
    stats.monthlyNew = 256;
    stats.monthlyNewChange = '+12';
    stats.abnormalAssets = 38;
    stats.totalValue = 8976.52;

    // 更新分类分布
    typeDistribution.value = [
      { name: '固定资产', value: 5420, percent: 42.2 },
      { name: '无形资产', value: 2890, percent: 22.5 },
      { name: '流动资产', value: 2340, percent: 18.2 },
      { name: '其他资产', value: 2197, percent: 17.1 }
    ];

    // 更新状态分布
    statusDistribution.value = [
      { name: '正常', value: 10890, percent: 84.8 },
      { name: '维修中', value: 1390, percent: 10.8 },
      { name: '已报废', value: 567, percent: 4.4 }
    ];

    // 更新趋势数据
    valueTrendData.value = [
      { date: '2024-07', value: 8200 },
      { date: '2024-08', value: 8350 },
      { date: '2024-09', value: 8520 },
      { date: '2024-10', value: 8690 },
      { date: '2024-11', value: 8840 },
      { date: '2024-12', value: 8976 }
    ];

    // 更新资产列表
    assetList.value = [
      { id: 1, name: '服务器集群-A', type: '固定资产', value: 1200000, status: 'normal', updateDate: '2024-12-15' },
      { id: 2, name: '数据库软件', type: '无形资产', value: 580000, status: 'normal', updateDate: '2024-12-14' },
      { id: 3, name: '办公电脑', type: '固定资产', value: 320000, status: 'maintenance', updateDate: '2024-12-13' },
      { id: 4, name: '网络设备', type: '固定资产', value: 280000, status: 'normal', updateDate: '2024-12-12' },
      { id: 5, name: '软件许可证', type: '无形资产', value: 240000, status: 'normal', updateDate: '2024-12-11' },
      { id: 6, name: '办公家具', type: '固定资产', value: 180000, status: 'normal', updateDate: '2024-12-10' },
      { id: 7, name: '生产设备', type: '固定资产', value: 1500000, status: 'scrapped', updateDate: '2024-12-09' },
      { id: 8, name: '测试仪器', type: '固定资产', value: 420000, status: 'normal', updateDate: '2024-12-08' },
      { id: 9, name: '监控系统', type: '固定资产', value: 350000, status: 'maintenance', updateDate: '2024-12-07' },
      { id: 10, name: '专利技术', type: '无形资产', value: 2100000, status: 'normal', updateDate: '2024-12-06' }
    ];

    // 更新 TOP 资产
    const maxValue = Math.max(...assetList.value.map((i) => i.value));
    topAssets.value = assetList.value
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        percent: Math.round((item.value / maxValue) * 100)
      }));

    // 渲染图表
    await nextTick();
    renderCharts();
  } catch (error) {
    message.error('数据加载失败，请重试');
    console.error('Failed to fetch dashboard data:', error);
  } finally {
    loading.value = false;
  }
}

// 图表渲染
function renderCharts() {
  renderTypeChart();
  renderStatusChart();
  renderTrendChart();
}

function renderTypeChart() {
  if (!typeChartRef.value) return;

  if (!typeChart) {
    typeChart = echarts.init(typeChartRef.value);
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center'
    },
    series: [
      {
        name: '资产分类',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: typeDistribution.value.map((item) => ({
          name: item.name,
          value: item.value
        })),
        color: ['#1890ff', '#52c41a', '#faad14', '#f5222d']
      }
    ]
  };

  typeChart.setOption(option);
}

function renderStatusChart() {
  if (!statusChartRef.value) return;

  if (!statusChart) {
    statusChart = echarts.init(statusChartRef.value);
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center'
    },
    series: [
      {
        name: '资产状态',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: statusDistribution.value.map((item) => ({
          name: item.name,
          value: item.value
        })),
        color: ['#52c41a', '#faad14', '#f5222d']
      }
    ]
  };

  statusChart.setOption(option);
}

function renderTrendChart() {
  if (!trendChartRef.value) return;

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value);
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
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
      data: valueTrendData.value.map((item) => item.date)
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}万'
      }
    },
    series: [
      {
        name: '资产价值',
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3
        },
        data: valueTrendData.value.map((item) => item.value),
        color: '#1890ff'
      }
    ]
  };

  trendChart.setOption(option);
}

// 事件处理
function handleRefresh() {
  fetchDashboardData();
  message.success('数据已刷新');
}

function handleTimeRangeChange({ key }: { key: string }) {
  timeRange.value = key as TimeRange;
  fetchDashboardData();
}

function handleExport() {
  message.info('正在生成导出文件...');
  // 实际导出逻辑通过 xlsx 库实现
  setTimeout(() => {
    message.success('导出成功');
  }, 1000);
}

function handleTableSearch(value: string) {
  tableSearchText.value = value;
}

function handleTableChange(pagination: TableProps['pagination']) {
  if (pagination.current) paginationConfig.current = pagination.current;
  if (pagination.pageSize) paginationConfig.pageSize = pagination.pageSize;
}

function handleAssetClick(record: AssetRecord) {
  router.push(`/asset/${record.id}`);
}

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value;
  if (autoRefreshEnabled.value) {
    autoRefreshTimer = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    message.success('已开启自动刷新（30秒间隔）');
  } else {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    message.info('已关闭自动刷新');
  }
}

// 响应式处理
function handleResize() {
  typeChart?.resize();
  statusChart?.resize();
  trendChart?.resize();
}

// 生命周期
onMounted(() => {
  fetchDashboardData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  typeChart?.dispose();
  statusChart?.dispose();
  trendChart?.dispose();
});

// 监听数据变化重新渲染图表
watch([typeDistribution, statusDistribution, valueTrendData], () => {
  nextTick(() => renderCharts());
}, { deep: true });
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #262626;
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 指标卡片样式 */
.metrics-section {
  margin-bottom: 8px;
}

.metric-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s, transform 0.3s;
}

.metric-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.metric-card.loading {
  opacity: 0.6;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  font-size: 24px;
  margin-right: 16px;
}

.metric-icon.asset-total {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: #fff;
}

.metric-icon.asset-new {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: #fff;
}

.metric-icon.asset-warning {
  background: linear-gradient(135deg, #ff7875 0%, #f5222d 100%);
  color: #fff;
}

.metric-icon.asset-value {
  background: linear-gradient(135deg, #faad14 0%, #d48806 100%);
  color: #fff;
}

.metric-info {
  flex: 1;
}

.metric-label {
  font-size: 14px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.metric-value.warning {
  color: #f5222d;
}

.metric-trend {
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.metric-trend.up {
  color: #52c41a;
}

.metric-trend.down {
  color: #f5222d;
}

.metric-sub {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

/* 图表卡片样式 */
.charts-section .chart-card {
  height: 100%;
}

.charts-section :deep(.ant-card-head) {
  min-height: 48px;
  padding: 0 16px;
}

.charts-section :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 500;
}

.charts-section :deep(.ant-card-body) {
  padding: 16px;
}

.chart-container {
  width: 100%;
  height: 280px;
}

/* 表格区域样式 */
.table-section :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 500;
}

/* TOP 资产样式 */
.top-section :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 500;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .dashboard-page {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .metric-card {
    padding: 16px;
  }

  .metric-icon {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }

  .metric-value {
    font-size: 20px;
  }

  .chart-container {
    height: 240px;
  }
}
</style>