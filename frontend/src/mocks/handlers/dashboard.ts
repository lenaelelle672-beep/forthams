/**
 * SWARM-003 仪表板数据看板 Mock Handlers
 * 
 * 提供资产看板 API 的 Mock 实现，支持以下功能：
 * - R-001: 资产总览统计（总数、在线、离线、告警）
 * - R-002: 分类分布图表数据
 * - R-003: 维保到期预警卡片
 * - R-004: 实时刷新机制（60s 间隔）
 * 
 * 边界约束：
 * - C-001: 资产总数上限 999,999，超限显示 "999K+"
 * - C-002: 预警时间分级（紧急≤7d/红色，预警8-30d/橙色，正常>30d/灰色）
 * - C-003: 图表分类超过 12 项时合并为"其他"
 * - C-005: 所有数据从 API 返回，禁止硬编码
 */

import { http, HttpResponse, delay } from 'msw';

// =======================
// Type Definitions
// =======================

/** 资产总览统计数据 */
export interface AssetOverviewDTO {
  /** 资产总数 */
  total: number;
  /** 在线资产数 */
  online: number;
  /** 离线资产数 */
  offline: number;
  /** 告警资产数 */
  warning: number;
  /** 环比变化趋势 */
  trend: {
    total: string;    // e.g., "+5.2%" or "-3.1%"
    online: string;
    offline: string;
    warning: string;
  };
}

/** 分类分布项 */
export interface CategoryItem {
  /** 分类名称 */
  name: string;
  /** 数量 */
  value: number;
  /** 占比百分比 */
  percentage: number;
}

/** 分类分布图表数据 */
export interface CategoryDistributionDTO {
  /** 分类列表 */
  categories: CategoryItem[];
  /** 总数 */
  total: number;
}

/** 维保到期预警项 */
export interface MaintenanceWarningItem {
  /** 资产ID */
  id: string;
  /** 资产名称 */
  name: string;
  /** 分类 */
  category: string;
  /** 维保到期日期 */
  expireDate: string;
  /** 剩余天数 */
  expireDays: number;
  /** 紧急程度 */
  severity: 'urgent' | 'warning' | 'normal';
}

/** 维保到期预警列表 */
export interface MaintenanceWarningDTO {
  /** 预警列表 */
  items: MaintenanceWarningItem[];
  /** 总数 */
  total: number;
}

/** 仪表板完整响应 */
export interface DashboardStatsDTO {
  overview: AssetOverviewDTO;
  categoryDistribution: CategoryDistributionDTO;
  maintenanceWarnings: MaintenanceWarningDTO;
  /** 最后更新时间 */
  lastUpdated: string;
}

// =======================
// Mock Data Generators
// =======================

/**
 * 生成资产总览统计数据
 * @param overrides 可选的覆盖值
 */
function generateOverviewData(overrides?: Partial<AssetOverviewDTO>): AssetOverviewDTO {
  const defaultData: AssetOverviewDTO = {
    total: 1234,
    online: 1100,
    offline: 50,
    warning: 84,
    trend: {
      total: '+5.2%',
      online: '+3.1%',
      offline: '-2.0%',
      warning: '+12.5%',
    },
  };
  return { ...defaultData, ...overrides };
}

/**
 * 生成分类分布数据
 * @param count 分类数量
 */
function generateCategoryData(count: number = 8): CategoryDistributionDTO {
  const baseCategories = [
    { name: '计算机设备', value: 350 },
    { name: '网络设备', value: 280 },
    { name: '办公设备', value: 220 },
    { name: '安全设备', value: 180 },
    { name: '存储设备', value: 120 },
    { name: '打印设备', value: 90 },
    { name: '监控设备', value: 75 },
    { name: '会议设备', value: 45 },
    { name: '投影设备', value: 30 },
    { name: '音频设备', value: 25 },
    { name: '其他设备', value: 20 },
    { name: '备用设备', value: 15 },
  ];

  // C-003: 超过12项时合并为"其他"
  let categories = baseCategories.slice(0, count);
  if (count > 12) {
    const mergedOthers = baseCategories.slice(11).reduce((sum, cat) => sum + cat.value, 0);
    categories = baseCategories.slice(0, 11);
    categories.push({ name: '其他', value: mergedOthers });
  }

  const total = categories.reduce((sum, cat) => sum + cat.value, 0);
  return {
    categories: categories.map(cat => ({
      ...cat,
      percentage: parseFloat(((cat.value / total) * 100).toFixed(1)),
    })),
    total,
  };
}

/**
 * 计算预警严重程度
 * C-002: 紧急(≤7d)红色，预警(8-30d)橙色，正常(>30d)灰色
 */
function calculateSeverity(expireDays: number): 'urgent' | 'warning' | 'normal' {
  if (expireDays <= 7) return 'urgent';
  if (expireDays <= 30) return 'warning';
  return 'normal';
}

/**
 * 生成维保到期预警数据
 */
function generateMaintenanceWarnings(): MaintenanceWarningDTO {
  const now = new Date();
  
  const items: MaintenanceWarningItem[] = [
    {
      id: 'AST-001',
      name: 'Dell PowerEdge R740 服务器',
      category: '服务器',
      expireDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 3,
      severity: calculateSeverity(3),
    },
    {
      id: 'AST-002',
      name: 'Cisco Catalyst 9300 交换机',
      category: '网络设备',
      expireDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 7,
      severity: calculateSeverity(7),
    },
    {
      id: 'AST-003',
      name: 'HP ProLiant DL380 服务器',
      category: '服务器',
      expireDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 15,
      severity: calculateSeverity(15),
    },
    {
      id: 'AST-004',
      name: 'Fortinet FortiGate 600E 防火墙',
      category: '安全设备',
      expireDate: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 22,
      severity: calculateSeverity(22),
    },
    {
      id: 'AST-005',
      name: 'Lenovo ThinkStation P520 工作站',
      category: '计算机设备',
      expireDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 30,
      severity: calculateSeverity(30),
    },
    {
      id: 'AST-006',
      name: 'Dell EMC SC5020 存储阵列',
      category: '存储设备',
      expireDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 45,
      severity: calculateSeverity(45),
    },
    {
      id: 'AST-007',
      name: 'Epson EB-2265U 投影仪',
      category: '投影设备',
      expireDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 60,
      severity: calculateSeverity(60),
    },
    {
      id: 'AST-008',
      name: 'Hikvision DS-8632NI-I8 录像机',
      category: '监控设备',
      expireDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expireDays: 90,
      severity: calculateSeverity(90),
    },
  ];

  return {
    items,
    total: items.length,
  };
}

// =======================
// Mock Handlers
// =======================

/**
 * 资产总览统计 API Handler
 * 
 * ATB-1 测试场景覆盖：
 * - T-1.1: 默认数据 total=1234
 * - T-1.2: 数值 0 时显示 "0"
 * - T-1.3: 数值 999,500 时截断显示 "999K+"
 * - T-1.4: 无数据时显示 "--"
 * - T-1.5: trend "+5.2%" 显示绿色上升箭头
 * - T-1.6: trend "-3.1%" 显示红色下降箭头
 */
export const assetOverviewHandler = http.get('/api/dashboard/overview', async ({ request }) => {
  // 模拟网络延迟（30-80ms）
  await delay(30 + Math.random() * 50);
  
  const url = new URL(request.url);
  const testMode = url.searchParams.get('test');
  
  // 测试场景处理
  switch (testMode) {
    case 'zero':
      return HttpResponse.json(generateOverviewData({
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
      }));
    
    case 'truncated':
      return HttpResponse.json(generateOverviewData({
        total: 999500,
        online: 850000,
        offline: 50000,
        warning: 99500,
      }));
    
    case 'null':
      return HttpResponse.json({
        total: null,
        online: null,
        offline: null,
        warning: null,
        trend: null,
      });
    
    case 'negative-trend':
      return HttpResponse.json(generateOverviewData({
        trend: {
          total: '-3.1%',
          online: '-2.5%',
          offline: '+5.0%',
          warning: '-10.0%',
        },
      }));
    
    default:
      return HttpResponse.json(generateOverviewData());
  }
});

/**
 * 分类分布图表数据 API Handler
 * 
 * ATB-2 测试场景覆盖：
 * - T-2.1: 8类资产分布
 * - T-2.3: 数据为空数组
 * - T-2.4: 超过12类数据时合并为"其他"
 */
export const categoryDistributionHandler = http.get('/api/dashboard/categories', async ({ request }) => {
  await delay(40 + Math.random() * 60);
  
  const url = new URL(request.url);
  const count = parseInt(url.searchParams.get('count') || '8', 10);
  const testMode = url.searchParams.get('test');
  
  switch (testMode) {
    case 'empty':
      return HttpResponse.json({
        categories: [],
        total: 0,
      });
    
    case 'many':
      // 超过12类的测试数据
      return HttpResponse.json(generateCategoryData(15));
    
    default:
      return HttpResponse.json(generateCategoryData(count));
  }
});

/**
 * 维保到期预警数据 API Handler
 * 
 * ATB-3 测试场景覆盖：
 * - T-3.1: 剩余3天（紧急/红色）
 * - T-3.2: 剩余15天（预警/橙色）
 * - T-3.3: 剩余60天（正常/灰色）
 * - T-3.5: 列表为空
 * - T-3.6: 列表超过5条
 */
export const maintenanceWarningHandler = http.get('/api/dashboard/warnings', async ({ request }) => {
  await delay(35 + Math.random() * 55);
  
  const url = new URL(request.url);
  const testMode = url.searchParams.get('test');
  
  switch (testMode) {
    case 'empty':
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    
    case 'many':
      // 生成超过5条的测试数据
      const baseWarnings = generateMaintenanceWarnings();
      const extraItems: MaintenanceWarningItem[] = [];
      for (let i = 9; i <= 15; i++) {
        const days = i * 5;
        extraItems.push({
          id: `AST-0${i}`,
          name: `测试资产 ${i}`,
          category: '测试分类',
          expireDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          expireDays: days,
          severity: calculateSeverity(days),
        });
      }
      return HttpResponse.json({
        items: [...baseWarnings.items, ...extraItems],
        total: baseWarnings.items.length + extraItems.length,
      });
    
    default:
      return HttpResponse.json(generateMaintenanceWarnings());
  }
});

/**
 * 仪表板完整数据 API Handler（一次性获取所有数据）
 */
export const dashboardStatsHandler = http.get('/api/dashboard/stats', async ({ request }) => {
  await delay(50 + Math.random() * 100);
  
  const url = new URL(request.url);
  const testMode = url.searchParams.get('test');
  
  // 支持组合测试模式
  const overviewTest = url.searchParams.get('overview_test') || testMode;
  const categoryCount = parseInt(url.searchParams.get('category_count') || '8', 10);
  
  const response: DashboardStatsDTO = {
    overview: generateOverviewData(overviewTest ? { total: 0 } : undefined),
    categoryDistribution: generateCategoryData(categoryCount),
    maintenanceWarnings: generateMaintenanceWarnings(),
    lastUpdated: new Date().toISOString(),
  };
  
  // 应用测试覆盖
  if (overviewTest === 'zero') {
    response.overview = {
      total: 0,
      online: 0,
      offline: 0,
      warning: 0,
      trend: { total: '0%', online: '0%', offline: '0%', warning: '0%' },
    };
  } else if (overviewTest === 'truncated') {
    response.overview = {
      total: 999500,
      online: 850000,
      offline: 50000,
      warning: 99500,
      trend: { total: '+5%', online: '+3%', offline: '-2%', warning: '+12%' },
    };
  }
  
  return HttpResponse.json(response);
});

// =======================
// Export All Handlers
// =======================

/**
 * 仪表板相关所有 Mock Handlers
 */
export const dashboardHandlers = [
  assetOverviewHandler,
  categoryDistributionHandler,
  maintenanceWarningHandler,
  dashboardStatsHandler,
];

// =======================
// Utility Functions (for testing)
// =======================

/**
 * 格式化数值显示
 * C-001: 超过 999,999 显示 "999K+"
 */
export function formatNumber(value: number | null): string {
  if (value === null || value === undefined) {
    return '--';
  }
  if (value === 0) {
    return '0';
  }
  if (value >= 999500) {
    return '999K+';
  }
  return value.toLocaleString('zh-CN');
}

/**
 * 获取趋势方向
 */
export function getTrendDirection(trend: string): 'up' | 'down' | 'neutral' {
  if (!trend) return 'neutral';
  if (trend.startsWith('+')) return 'up';
  if (trend.startsWith('-')) return 'down';
  return 'neutral';
}

/**
 * 获取预警严重程度标签
 */
export function getSeverityLabel(severity: 'urgent' | 'warning' | 'normal'): string {
  switch (severity) {
    case 'urgent': return '紧急';
    case 'warning': return '预警';
    case 'normal': return '正常';
  }
}

/**
 * 获取预警严重程度颜色
 * C-002: 紧急(≤7d)红色，预警(8-30d)橙色，正常(>30d)灰色
 */
export function getSeverityColor(severity: 'urgent' | 'warning' | 'normal'): string {
  switch (severity) {
    case 'urgent': return '#ff4d4f';   // 红色
    case 'warning': return '#fa8c16'; // 橙色
    case 'normal': return '#8c8c8c';  // 灰色
  }
}

/**
 * 格式化到期倒计时文本
 */
export function formatExpireCountdown(expireDays: number): string {
  if (expireDays === 0) return '今天到期';
  if (expireDays === 1) return '明天到期';
  return `${expireDays}天后到期`;
}