const analyticsLocale = {
  module: {
    title: 'Analytics',
    subtitle: 'Multi-dimensional asset trends, category mix, and operating metrics',
  },
  period: {
    label: 'Range',
    '6months': 'Last 6 months',
    '12months': 'Last 12 months',
  },
  kpi: {
    totalAssets: 'Total Assets',
    totalValue: 'Total Value',
    monthlyMaintenance: 'Monthly Maintenance',
    pendingApproval: 'Pending Approvals',
  },
  charts: {
    valueTrend: 'Asset Value Trend',
    categoryDistribution: 'Category Distribution',
    deptRanking: 'Department Asset Ranking',
    disposalStats: 'Disposal Statistics',
  },
  chartLabels: {
    totalValue: 'Total Value (10k)',
    netValue: 'Net Value (10k)',
    count: 'Count',
    assetCount: 'Asset Count',
  },
  statusLabels: {
    inUse: 'In Use',
    retired: 'Retired',
    pending: 'Pending',
  },
  states: {
    loading: 'Loading data...',
    noTrendData: 'No trend data',
    noCategoryData: 'No category data',
    noDeptData: 'No department ranking data',
    noStatsData: 'No statistics data',
  },
  errors: {
    statsFailed: 'Failed to load statistics',
    trendFailed: 'Failed to load trends',
    categoryFailed: 'Failed to load categories',
    deptFailed: 'Failed to load departments',
    summaryFailed: 'Failed to load summary',
  },
  footer: 'Data from asset ledger, maintenance records, and approval workflows',
};

export default analyticsLocale;
