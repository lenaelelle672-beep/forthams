const analyticsLocale = {
  module: {
    title: '数据分析',
    subtitle: '多维资产趋势、分类结构与运营指标分析',
  },
  period: {
    label: '数据范围',
    '6months': '近 6 个月',
    '12months': '近 12 个月',
  },
  kpi: {
    totalAssets: '资产总数',
    totalValue: '资产总值',
    monthlyMaintenance: '本月维保',
    pendingApproval: '待审批',
  },
  charts: {
    valueTrend: '资产价值趋势',
    categoryDistribution: '资产分类分布',
    deptRanking: '部门资产排行',
    disposalStats: '处置统计',
  },
  chartLabels: {
    totalValue: '总值（万元）',
    netValue: '净值（万元）',
    count: '数量',
    assetCount: '资产数量',
  },
  statusLabels: {
    inUse: '在用',
    retired: '已退役',
    pending: '待审批',
  },
  states: {
    loading: '数据加载中...',
    noTrendData: '暂无趋势数据',
    noCategoryData: '暂无分类数据',
    noDeptData: '暂无部门排行数据',
    noStatsData: '暂无统计数据',
  },
  errors: {
    statsFailed: '统计数据加载失败',
    trendFailed: '趋势数据加载失败',
    categoryFailed: '分类数据加载失败',
    deptFailed: '部门数据加载失败',
    summaryFailed: '汇总数据加载失败',
  },
  footer: '数据来自资产台账、维保记录与审批流程',
};

export default analyticsLocale;
