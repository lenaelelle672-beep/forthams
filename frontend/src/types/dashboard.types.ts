/**
 * Dashboard Types - SWARM-003 仪表板数据看板
 * 
 * 定义仪表板相关的数据类型，包括：
 * - 资产总览统计类型
 * - 分类分布图表类型
 * - 维保到期预警类型
 * 
 * @author SWARM-003 Team
 * @version 1.0
 * @since Iteration 5
 */

/**
 * 资产统计数据类型
 * 用于资产总览统计组件，展示资产的核心指标
 * 
 * @example
 * ```typescript
 * const stats: AssetStatistics = {
 *   total: 1523,
 *   online: 1280,
 *   offline: 243,
 *   totalValue: 15800000
 * };
 * ```
 */
export interface AssetStatistics {
  /** 资产总量 */
  total: number;
  /** 在线资产数量 */
  online: number;
  /** 离线资产数量 */
  offline: number;
  /** 资产总价值（单位：元） */
  totalValue: number;
}

/**
 * 单个统计卡片的配置类型
 * 用于资产总览统计组件中的单个指标卡片
 */
export interface StatCardConfig {
  /** 卡片唯一标识 */
  id: string;
  /** 指标键名 */
  metricKey: keyof AssetStatistics;
  /** 显示标题 */
  title: string;
  /** 图标名称 */
  iconName?: string;
  /** 数值格式化选项 */
  formatOptions?: {
    /** 是否显示千分位分隔符 */
    useGrouping?: boolean;
    /** 小数位数 */
    decimals?: number;
    /** 前缀符号 */
    prefix?: string;
    /** 后缀符号 */
    suffix?: string;
  };
}

/**
 * 资产分类分布数据项
 * 用于分类分布饼图/环形图的数据展示
 * 
 * @example
 * ```typescript
 * const category: CategoryDistribution = {
 *   categoryId: 'CAT001',
 *   categoryName: '电子设备',
 *   count: 520,
 *   percentage: 34.15
 * };
 * ```
 */
export interface CategoryDistribution {
  /** 分类唯一标识 */
  categoryId: string;
  /** 分类名称 */
  categoryName: string;
  /** 该分类下的资产数量 */
  count: number;
  /** 占总量的百分比（0-100） */
  percentage: number;
}

/**
 * 分类分布图表的配置类型
 * 用于 ECharts 饼图/环形图组件
 */
export interface CategoryChartOptions {
  /** 图表类型：饼图或环形图 */
  chartType: 'pie' | 'donut';
  /** 数据源 */
  data: CategoryDistribution[];
  /** 图表标题 */
  title?: string;
  /** 环形图内半径（仅 donut 类型有效） */
  innerRadius?: number;
  /** 环形图外半径（仅 donut 类型有效） */
  outerRadius?: number;
}

/**
 * 维保预警紧急程度枚举
 */
export type MaintenanceAlertUrgency = 'urgent' | 'warning' | 'normal';

/**
 * 单条维保预警记录
 * 用于维保到期预警卡片中的预警列表项
 * 
 * @example
 * ```typescript
 * const alert: MaintenanceAlert = {
 *   id: 'MAL001',
 *   assetId: 'AST001',
 *   assetName: '服务器 Dell PowerEdge R740',
 *   maintenanceType: '定期保养',
 *   dueDate: new Date('2024-01-20'),
 *   daysUntilDue: 5,
 *   urgency: 'urgent'
 * };
 * ```
 */
export interface MaintenanceAlert {
  /** 预警记录唯一标识 */
  id: string;
  /** 资产唯一标识 */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 维保类型 */
  maintenanceType: string;
  /** 到期日期 */
  dueDate: Date;
  /** 距离到期的天数 */
  daysUntilDue: number;
  /** 紧急程度 */
  urgency: MaintenanceAlertUrgency;
}

/**
 * 维保预警汇总信息
 * 用于维保到期预警卡片顶部的预警汇总区域
 */
export interface MaintenanceAlertSummary {
  /** 7天内即将到期的维保项数量 */
  urgentCount: number;
  /** 30天内即将到期的维保项数量 */
  warningCount: number;
  /** 预警列表总数 */
  totalCount: number;
}

/**
 * 维保预警分组数据
 * 按紧急程度分组的维保预警列表
 */
export interface MaintenanceAlertGroup {
  /** 分组标识：urgent(7天内) / warning(30天内) */
  type: 'urgent' | 'warning';
  /** 分组标题 */
  title: string;
  /** 该分组下的预警列表 */
  alerts: MaintenanceAlert[];
}

/**
 * 维保预警卡片完整数据结构
 * 包含汇总信息和分组后的预警列表
 */
export interface MaintenanceAlertCardData {
  /** 预警汇总信息 */
  summary: MaintenanceAlertSummary;
  /** 按紧急程度分组的预警列表 */
  groupedAlerts: MaintenanceAlertGroup[];
}

/**
 * 仪表板轮询配置类型
 */
export interface DashboardPollingConfig {
  /** 轮询间隔时间（毫秒），默认 60000ms（60秒） */
  interval: number;
  /** 是否启用自动刷新，默认 true */
  enabled: boolean;
}

/**
 * 仪表板视图模式枚举
 */
export type DashboardViewMode = 'desktop' | 'tablet' | 'mobile';

/**
 * 仪表板布局配置类型
 */
export interface DashboardLayoutConfig {
  /** 当前视图模式 */
  viewMode: DashboardViewMode;
  /** 是否显示统计面板 */
  showStatistics: boolean;
  /** 是否显示分类分布图表 */
  showCategoryChart: boolean;
  /** 是否显示维保预警卡片 */
  showMaintenanceAlert: boolean;
}

/**
 * 仪表板错误状态类型
 */
export interface DashboardErrorState {
  /** 是否有统计数据的错误 */
  statisticsError: boolean;
  /** 是否有分类分布数据的错误 */
  categoryError: boolean;
  /** 是否有维保预警数据的错误 */
  maintenanceError: boolean;
}

/**
 * 空数据状态配置类型
 */
export interface EmptyStateConfig {
  /** 统计卡片空状态文本 */
  statisticsEmptyText: string;
  /** 分类图表空状态文本 */
  categoryEmptyText: string;
  /** 维保预警空状态文本 */
  maintenanceEmptyText: string;
}

/**
 * 仪表板数据完整类型
 * 包含所有面板的完整数据
 */
export interface DashboardData {
  /** 资产统计数据 */
  statistics: AssetStatistics | null;
  /** 分类分布数据 */
  categoryDistribution: CategoryDistribution[];
  /** 维保预警数据 */
  maintenanceAlerts: MaintenanceAlertCardData | null;
}

/**
 * 仪表板加载状态类型
 */
export interface DashboardLoadingState {
  /** 统计数据加载中 */
  statisticsLoading: boolean;
  /** 分类分布数据加载中 */
  categoryLoading: boolean;
  /** 维保预警数据加载中 */
  maintenanceLoading: boolean;
}

/**
 * API 响应类型别名
 */
export type AssetStatisticsResponse = AssetStatistics;
export type CategoryDistributionResponse = CategoryDistribution[];
export type MaintenanceAlertResponse = MaintenanceAlert[];