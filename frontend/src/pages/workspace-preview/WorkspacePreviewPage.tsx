import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { canAccessRoute } from '@/utils/routePermissions';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Archive,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Database,
  Factory,
  FileText,
  Gauge,
  Home,
  Layers,
  LayoutDashboard,
  MapPin,
  Maximize2,
  Monitor,
  PackageCheck,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Type,
  UserCircle,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import './WorkspacePreviewPage.css';

type PreviewPage = 'overview' | 'security' | 'analytics' | 'assets' | 'stitch';
type Accent = 'blue' | 'cyan' | 'violet' | 'orange' | 'green';
type WorkbenchPage = Exclude<PreviewPage, 'stitch'>;

type WorkspaceMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  page: PreviewPage;
};

type MenuContext = {
  summary: string;
  action: string;
  routeTarget: string;
  stats: Array<{
    label: string;
    value: string;
    note: string;
  }>;
};

type RouteActionPreview = {
  title: string;
  source: string;
  routeTarget: string;
  description: string;
  primaryLabel: string;
  icon: LucideIcon;
  visual?: string;
  stats: MenuContext['stats'];
};

type ScreenPreview = {
  title: string;
  subtitle: string;
  imageSrc: string;
  stats: MenuContext['stats'];
};

type ActionWorkflow = {
  status: string;
  steps: Array<{ label: string; note: string }>;
  fields: Array<{ label: string; value: string }>;
  checklist: string[];
};

type ModuleMock = {
  eyebrow: string;
  title: string;
  summary: string;
  routeTarget: string;
  icon: LucideIcon;
  visual: string;
  action: string;
  stats: MenuContext['stats'];
  rows: Array<{ label: string; value: string; note: string; tone: 'blue' | 'cyan' | 'green' | 'orange' | 'red' }>;
  steps: Array<{ label: string; note: string }>;
};

type WorkbenchProductPageMeta = {
  position: string;
  imageSrc: string;
  stitchScreen?: string;
  assetPurpose?: string;
  filters?: string[];
  lanes?: Array<{ label: string; value: string; note: string; tone: 'blue' | 'cyan' | 'green' | 'orange' | 'red' }>;
  insights?: Array<{ label: string; value: string; note: string }>;
  actions: RouteActionPreview[];
  emptyState: string;
  errorState: string;
  deniedState: string;
};

type WorkbenchOperationItem = {
  kind: '新建/发起' | '查询/筛选' | '打开详情' | '编辑/维护' | '危险操作';
  title: string;
  description: string;
  icon: LucideIcon;
  preview?: RouteActionPreview;
  disabledReason?: string;
  tone?: 'normal' | 'warning' | 'danger';
};

type WorkOrderPrefillParams = {
  source: 'asset-risk' | 'predictive-maintenance' | 'quick-action';
  title: string;
  assetName?: string;
  assetLocation?: string;
  riskState?: string;
  riskScore?: number | string;
  riskLevel?: string;
  action?: string;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  workOrder?: string;
  description?: string;
};

type AlertPrefillParams = {
  source: 'quick-alert' | 'security-event' | 'data-alert';
  title: string;
  eventName?: string;
  alertCode?: string;
  severity?: string;
  assetName?: string;
  assetLocation?: string;
  state?: string;
  occurredAt?: string;
  suggestedAction?: string;
  description?: string;
};

type InspectionPrefillParams = {
  source: 'quick-inspection' | 'temperature-check' | 'asset-risk';
  inspectionNo: string;
  assetId: number;
  assetName?: string;
  inspectionType?: 'ANNUAL' | 'PERIODIC' | 'SPECIAL';
  inspectionDate?: string;
  nextInspectionDate?: string;
  inspectorName?: string;
  findings?: string;
};

type SafetyPrefillParams = {
  source: 'quick-safety';
  templateId: number;
  assetId: number;
  executorId: number;
  assetName?: string;
  focusItem?: string;
  readingHint?: string;
  riskLevel?: string;
  note?: string;
};

type SparePrefillParams = {
  source: 'spare-request';
  partNo: string;
  partName: string;
  specification?: string;
  unit?: string;
  currentStock?: number;
  safetyStock?: number;
  unitPrice?: number;
  relatedWorkOrder?: string;
  assetName?: string;
  supplier?: string;
  arrivalDate?: string;
  note?: string;
};

type KpiItem = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  trend: string;
  icon: LucideIcon;
  accent: Accent;
  visual: string;
};

type AssetCategory = {
  icon: LucideIcon;
  label: string;
  value: string;
  visual: string;
};

type RiskAsset = {
  rank: number;
  name: string;
  risk: number;
  location: string;
  state: string;
};

type WorkOrder = {
  code: string;
  risk: string;
  date: string;
  status: 'middle' | 'low' | 'normal';
  asset: string;
  action: string;
};

type MiniMetric = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
};

type ChartCard = {
  title: string;
  type: 'donut' | 'line' | 'bars' | 'progress' | 'work' | 'spares';
};

const assetBase = '/mock/workspace-preview';
const iconAsset = (name: string) => `${assetBase}/icons-v2/${name}.png`;
const illustrationAsset = (name: string) => `${assetBase}/illustrations/${name}.png`;
const moduleAsset = (name: string) => `${assetBase}/asset-kit-v4/modules/${name}.png`;
const assetKitV4 = (name: string) => `${assetBase}/asset-kit-v4/${name}.png`;
const detailAsset = (name: string) => `${assetBase}/asset-kit-v5/details/${name}.png`;
const moduleV6Asset = (name: string) => `${assetBase}/asset-kit-v6/modules/${name}.png`;
const detailV6Asset = (name: string) => `${assetBase}/asset-kit-v6/details/${name}.png`;
const stitchAsset = (name: string) => `${assetBase}/stitch-suite/${name}.png`;
const securityPostureThumb = moduleAsset('module-security-posture');
const securityPostureMapWide = moduleAsset('module-security-posture-map-wide');
const login5ProductHero = `${assetBase}/scene/login5-stitch-factory-cn-v4.png?v=20260614-cn-v4`;
const workbenchBasePath = '/fixed-assets/workbench';

const workbenchRouteByPage: Record<WorkbenchPage, string> = {
  overview: workbenchBasePath,
  analytics: `${workbenchBasePath}/analytics`,
  assets: `${workbenchBasePath}/assets`,
  security: `${workbenchBasePath}/security`,
};

const workbenchPageBySection: Record<string, WorkbenchPage> = {
  overview: 'overview',
  manufacturing: 'overview',
  analytics: 'analytics',
  data: 'analytics',
  assets: 'assets',
  asset: 'assets',
  security: 'security',
  safety: 'security',
};

const pageTabs: Array<{ id: PreviewPage; label: string }> = [
  { id: 'overview', label: '智能制造总览' },
  { id: 'analytics', label: '数据监控中心' },
  { id: 'assets', label: '资产运维中心' },
  { id: 'security', label: '安全态势工作台' },
  { id: 'stitch', label: '设计稿总览' },
];

const isPreviewPage = (value?: string | null): value is PreviewPage =>
  Boolean(value && pageTabs.some((tab) => tab.id === value));

const buildPreviewPath = (page: PreviewPage) =>
  page === 'overview' ? '/workspace-preview' : `/workspace-preview?tab=${page}`;

const buildWorkbenchPagePath = (page: WorkbenchPage) =>
  buildWorkbenchPath(page, getDefaultMenuIdForPage(page, true));

const menuItems: WorkspaceMenuItem[] = [
  { id: 'home', label: '运营首页', icon: Home, page: 'overview' },
  { id: 'todo', label: '流程待办', icon: ClipboardList, page: 'overview' },
  { id: 'design', label: '设计稿', icon: SlidersHorizontal, page: 'stitch' },
  { id: 'asset', label: '资产总览', icon: Layers, page: 'assets' },
  { id: 'device', label: '设备管理', icon: Cpu, page: 'assets' },
  { id: 'orders', label: '工单管理', icon: ClipboardList, page: 'assets' },
  { id: 'inspection', label: '巡检管理', icon: CheckCircle2, page: 'assets' },
  { id: 'spares', label: '备件管理', icon: PackageCheck, page: 'assets' },
  { id: 'energy', label: '数据监控', icon: Activity, page: 'analytics' },
  { id: 'report', label: '报表分析', icon: BarChart3, page: 'analytics' },
  { id: 'alarm', label: '告警中心', icon: Bell, page: 'security' },
  { id: 'policy', label: '组织策略', icon: ShieldCheck, page: 'security' },
  { id: 'settings', label: '基础维护', icon: Settings, page: 'assets' },
];

const getWorkbenchPageFromSection = (section?: string): WorkbenchPage =>
  section ? workbenchPageBySection[section] ?? 'overview' : 'overview';

const getDefaultMenuIdForPage = (page: PreviewPage, isWorkbenchRoute = false) =>
  (
    menuItems.find((item) => item.page === page && (!isWorkbenchRoute || item.id !== 'design')) ??
    menuItems[0]
  ).id;

const getRouteMenuItem = (page: WorkbenchPage, menuId?: string) =>
  menuItems.find((item) => item.id === menuId && item.page === page && item.id !== 'design') ??
  menuItems.find((item) => item.page === page && item.id !== 'design') ??
  menuItems[0];

const buildWorkbenchPath = (page: WorkbenchPage, menuId?: string) => {
  const basePath = workbenchRouteByPage[page];
  return menuId ? `${basePath}?menu=${encodeURIComponent(menuId)}` : basePath;
};

const buildQueryPath = (path: string, params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const getRoutePathname = (routeTarget: string) => routeTarget.split(/[?#]/)[0] || routeTarget;

const buildWorkOrderPrefillPath = (params: WorkOrderPrefillParams) =>
  buildQueryPath('/workorders/new', params);

const buildAlertPrefillPath = (params: AlertPrefillParams) =>
  buildQueryPath('/notifications', params);

const buildInspectionPrefillPath = (params: InspectionPrefillParams) =>
  buildQueryPath('/inspections/new', params);

const buildSafetyPrefillPath = (params: SafetyPrefillParams) =>
  buildQueryPath('/safety-checklists/execute', params);

const buildSparePrefillPath = (params: SparePrefillParams) =>
  buildQueryPath('/spare-parts/new', params);

const menuContextById: Record<string, MenuContext> = {
  home: {
    summary: '聚合产线总览、机加设备集群、资产运维与安全态势，作为固定资产平台的指挥入口。',
    action: '进入资产运营中枢',
    routeTarget: buildWorkbenchPath('overview', 'home'),
    stats: [
      { label: '在线产线', value: '12', note: '条' },
      { label: '采集设备', value: '1,256', note: '台' },
      { label: '今日产量', value: '1.2万', note: '件' },
    ],
  },
  todo: {
    summary: '聚合待审批、预测维保工单、巡检异常和备件低储，形成跨模块流程待办队列。',
    action: '查看流程待办',
    routeTarget: '/approvals?source=workbench&status=PENDING',
    stats: [
      { label: '待审批', value: '18', note: '项' },
      { label: '待派工', value: '24', note: '单' },
      { label: '预警待办', value: '36', note: '条' },
    ],
  },
  design: {
    summary: '集中管理 IMAGE2 产品图、设计复刻稿、前端入口与交付检查，保证 demo 视觉统一。',
    action: '打开设计稿总览',
    routeTarget: buildPreviewPath('stitch'),
    stats: [
      { label: '设计稿', value: '8', note: '屏' },
      { label: '截图资产', value: '9', note: '张' },
      { label: '已接入', value: '5', note: '入口' },
    ],
  },
  asset: {
    summary: '覆盖资产台账、健康评分、风险 TOP10、生命周期流转和 MES 状态同步。',
    action: '查看资产清单',
    routeTarget: '/assets?source=workbench&view=asset-overview',
    stats: [
      { label: '资产总数', value: '6,842', note: '台' },
      { label: '健康指数', value: '86', note: '分' },
      { label: '高风险', value: '36', note: '条' },
    ],
  },
  device: {
    summary: '追踪设备在线、所在位置、温度、振动、稼动率与机台异常，面向现场运维。',
    action: '查看设备状态',
    routeTarget: '/equipment?source=workbench',
    stats: [
      { label: '在线率', value: '98.6%', note: '实时' },
      { label: '温度告警', value: '12', note: '台' },
      { label: '采集延迟', value: '95.2', note: 'ms' },
    ],
  },
  orders: {
    summary: '连接预测维保、维修派工、验收闭环和 SLA 时效，减少停机等待。',
    action: '查看预测工单',
    routeTarget: buildWorkOrderPrefillPath({
      source: 'quick-action',
      title: '固定资产工作台预测维保工单',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      riskState: '温度异常',
      riskScore: 92,
      priority: 'HIGH',
      dueDate: '2026-06-16',
      description: '来自流程待办与工单管理：注塑机 M-201 命中温度异常与维保窗口，建议生成预测维保工单。',
    }),
    stats: [
      { label: '待维保', value: '248', note: '台' },
      { label: '今日派工', value: '42', note: '单' },
      { label: '闭环率', value: '91.8%', note: '本周' },
    ],
  },
  inspection: {
    summary: '管理点检计划、巡检路线、扫码核验和异常复核，形成可追溯巡检记录。',
    action: '查看巡检计划',
    routeTarget: buildInspectionPrefillPath({
      source: 'quick-inspection',
      inspectionNo: 'INSP-20260614-M201',
      assetId: 201,
      assetName: '注塑机 M-201',
      inspectionType: 'SPECIAL',
      inspectionDate: '2026-06-14',
      nextInspectionDate: '2026-06-21',
      inspectorName: '智能巡检组',
      findings: '来自固定资产工作台巡检管理：温度与振动点位需要现场复核。',
    }),
    stats: [
      { label: '待巡检', value: '73', note: '项' },
      { label: '异常项', value: '9', note: '条' },
      { label: '准时率', value: '96.4%', note: '本月' },
    ],
  },
  spares: {
    summary: '监控关键备件库存、低储预警、领用消耗和供应商交期，保障维保连续性。',
    action: '查看备件库存',
    routeTarget: buildSparePrefillPath({
      source: 'spare-request',
      partNo: 'SP-TEMP-201',
      partName: '温控模块传感器',
      specification: 'PT100-M201 / 0-120°C',
      unit: '件',
      currentStock: 2,
      safetyStock: 8,
      unitPrice: 680,
      relatedWorkOrder: 'WO-20250612001',
      assetName: '注塑机 M-201',
      supplier: 'UNIVIEW 备件仓',
      arrivalDate: '2026-06-18',
      note: '来自固定资产工作台备件管理：低储备件与预测维保工单联动。',
    }),
    stats: [
      { label: '库存 SKU', value: '1,420', note: '个' },
      { label: '低储', value: '18', note: '项' },
      { label: '周转率', value: '4.8', note: '次/月' },
    ],
  },
  energy: {
    summary: '汇聚 MES、IoT 网关、设备采集和异常流水，支撑产线运行、能耗与质量指标同屏监控。',
    action: '查看数据链路',
    routeTarget: '/energy?source=workbench&scope=data-monitoring',
    stats: [
      { label: '采集设备', value: '1,256', note: '台' },
      { label: 'MES链路', value: '18', note: '条' },
      { label: '同步延迟', value: '95.2', note: 'ms' },
    ],
  },
  report: {
    summary: '沉淀资产、维保、巡检、备件和能耗报表，支持月度经营与审计追踪。',
    action: '生成经营报表',
    routeTarget: '/reports?source=workbench&view=operations',
    stats: [
      { label: '报表模板', value: '26', note: '个' },
      { label: '订阅任务', value: '14', note: '个' },
      { label: '导出次数', value: '312', note: '本月' },
    ],
  },
  alarm: {
    summary: '统一处理资产告警、设备风险、策略命中与安全态势事件，提升响应速度。',
    action: '查看告警队列',
    routeTarget: buildAlertPrefillPath({
      source: 'quick-alert',
      title: '固定资产工作台告警队列',
      eventName: '注塑机 M-201 温度异常',
      severity: '高危',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      state: '待研判',
      suggestedAction: '复核温度、位置与维保等级，必要时转预测维保工单。',
      description: '来自固定资产工作台告警中心：聚合资产异常、安全策略命中和联动工单。',
    }),
    stats: [
      { label: '安全评分', value: '92', note: '分' },
      { label: '高危事件', value: '3', note: '条' },
      { label: '平均响应', value: '2.3h', note: '本周' },
    ],
  },
  policy: {
    summary: '配置组织策略、风险规则、告警阈值和审批边界，让资产治理标准化。',
    action: '查看策略规则',
    routeTarget: '/risk-matrix?source=workbench&scope=policy',
    stats: [
      { label: '策略规则', value: '128', note: '条' },
      { label: '命中率', value: '11%', note: '本周' },
      { label: '待复核', value: '6', note: '项' },
    ],
  },
  settings: {
    summary: '维护组织、角色、数据字典、集成账号和平台参数，支撑固定资产平台运行。',
    action: '打开基础维护',
    routeTarget: '/settings/sysconfig?source=workbench',
    stats: [
      { label: '集成源', value: '7', note: '个' },
      { label: '角色组', value: '18', note: '个' },
      { label: '同步成功', value: '99.2%', note: '今日' },
    ],
  },
};

const assetKpis: KpiItem[] = [
  {
    label: '资产总数',
    value: '6,842',
    unit: '台',
    note: '较上月',
    trend: '8.6%',
    icon: Archive,
    accent: 'blue',
    visual: iconAsset('asset-total'),
  },
  {
    label: '在线运行',
    value: '5,102',
    unit: '台',
    note: '在线率',
    trend: '74.6%',
    icon: Monitor,
    accent: 'cyan',
    visual: iconAsset('online-running'),
  },
  {
    label: '待维保',
    value: '248',
    unit: '台',
    note: '工单数',
    trend: '132',
    icon: Wrench,
    accent: 'violet',
    visual: iconAsset('maintenance'),
  },
  {
    label: '异常预警',
    value: '36',
    unit: '条',
    note: '较昨日',
    trend: '12.5%',
    icon: Bell,
    accent: 'orange',
    visual: iconAsset('alarm'),
  },
];

const overviewKpis: KpiItem[] = [
  {
    label: '在线产线',
    value: '12',
    unit: '条',
    note: '运行中',
    trend: '10条',
    icon: Factory,
    accent: 'blue',
    visual: iconAsset('conveyor-line'),
  },
  {
    label: '采集设备',
    value: '1,256',
    unit: '台',
    note: '在线率',
    trend: '98.6%',
    icon: Database,
    accent: 'cyan',
    visual: iconAsset('data-collect'),
  },
  {
    label: '今日产量',
    value: '1.2万',
    unit: '件',
    note: 'MES同步',
    trend: '稳定',
    icon: BarChart3,
    accent: 'green',
    visual: iconAsset('sensor-data'),
  },
  {
    label: '异常预警',
    value: '36',
    unit: '条',
    note: '待处置',
    trend: '4条',
    icon: Bell,
    accent: 'orange',
    visual: iconAsset('alarm'),
  },
];

const overviewSceneMarkers = [
  ['加工单元 A-102', '稼动率 94.2%', 'blue', 'is-left'],
  ['检测中心 T-01', '良品率 99.8%', 'cyan', 'is-right'],
  ['AGV 调度', '18辆在线', 'green', 'is-bottom'],
] as const;

const assetCategories: AssetCategory[] = [
  { icon: Factory, label: '生产设备', value: '3,254', visual: iconAsset('production-equipment') },
  { icon: Server, label: '公用设备', value: '1,286', visual: iconAsset('public-equipment') },
  { icon: Box, label: '辅助设备', value: '1,045', visual: iconAsset('auxiliary-equipment') },
  { icon: Gauge, label: '检测设备', value: '687', visual: iconAsset('inspection-equipment') },
  { icon: Database, label: 'IT设备', value: '570', visual: iconAsset('it-equipment') },
];

const locationTree = [
  ['总厂区', '6,842'],
  ['生产一部', '2,156'],
  ['产线A', '856'],
  ['产线B', '658'],
  ['产线C', '642'],
  ['生产二部', '1,892'],
  ['动力车间', '1,207'],
  ['仓储物流', '587'],
];

const healthMetrics: MiniMetric[] = [
  { label: '可用率', value: '92.3%', note: '较上月 +3.4%', icon: CheckCircle2 },
  { label: '利用率', value: '78.6%', note: '较上月 +2.1%', icon: Activity },
  { label: 'MTBF', value: '1,256h', note: '较上月 +8.2%', icon: TrendingUp },
  { label: 'MTTR', value: '2.3h', note: '较上月 -0.3%', icon: Wrench },
];

const assetHealthSignals = [
  ['在线监测', '5,102台', '在线率 74.6%', 'blue', detailAsset('asset-status-distribution-v1')],
  ['位置可信', '6,218台', '覆盖 98.2%', 'cyan', detailAsset('location-tracking-v1')],
  ['温度边界', '18台', '需复核', 'orange', detailAsset('temperature-monitoring-v1')],
  ['维保准入', '92.6%', '闭环率', 'green', detailAsset('maintenance-level-v1')],
] as const;

const riskAssets: RiskAsset[] = [
  { rank: 1, name: '注塑机 M-201', risk: 92, location: '一车间 / A线', state: '温度异常' },
  { rank: 2, name: '空压机 KQ-03', risk: 88, location: '动力站 / 空压区', state: '振动偏高' },
  { rank: 3, name: '冷压机 CP-07', risk: 85, location: '二车间 / C线', state: '维保逾期' },
  { rank: 4, name: '传送带 CT-02', risk: 82, location: '装配线 / B段', state: '速度波动' },
  { rank: 5, name: '机床 C-115', risk: 80, location: '机加区 / 3号位', state: '刀具预警' },
  { rank: 6, name: '锅炉 BO-01', risk: 78, location: '动力站 / 锅炉房', state: '压力偏高' },
  { rank: 7, name: '冷却塔 LT-01', risk: 75, location: '外场 / 冷却区', state: '水温波动' },
  { rank: 8, name: '电机 M-330', risk: 72, location: '仓储线 / 2段', state: '电流异常' },
  { rank: 9, name: '配电柜 PD-12', risk: 70, location: '配电室 / 北区', state: '负载偏高' },
  { rank: 10, name: 'AGV小车 AGV-05', risk: 68, location: '物流区 / 充电位', state: '电量偏低' },
];

const assetRiskActions = [
  ['高温/振动', '12台', '自动转工单', 'red', detailAsset('temperature-monitoring-v1')],
  ['维保逾期', '7台', '计划重排', 'orange', detailAsset('maintenance-level-v1')],
  ['位置漂移', '4台', '二次定位', 'blue', detailAsset('location-tracking-v1')],
] as const;

const workOrders: WorkOrder[] = [
  { code: 'WO-20250612001', risk: '中风险', date: '2026-06-16', status: 'middle', asset: '注塑机 M-201', action: '温控模块复核' },
  { code: 'WO-20250612002', risk: '中风险', date: '2026-06-17', status: 'middle', asset: '空压机 KQ-03', action: '振动轴承点检' },
  { code: 'WO-20250612003', risk: '低风险', date: '2026-06-18', status: 'low', asset: '冷压机 CP-07', action: '液压油路检查' },
  { code: 'WO-20250612004', risk: '低风险', date: '2026-06-19', status: 'low', asset: '传送带 CT-02', action: '张紧轮维护' },
  { code: 'WO-20250612005', risk: '正常', date: '2026-06-20', status: 'normal', asset: 'AGV小车 AGV-05', action: '例行巡检' },
];

const workOrderFlowSteps = [
  ['预测', '12台中风险'],
  ['派单', '18单自动生成'],
  ['执行', '6单待确认'],
  ['验收', '91.8%闭环'],
] as const;

const chartCards: ChartCard[] = [
  { title: '设备运行状态分布', type: 'donut' },
  { title: '温度趋势（°C）', type: 'line' },
  { title: '振动趋势（mm/s）', type: 'line' },
  { title: '能耗趋势（kWh）', type: 'bars' },
  { title: '维保计划完成率（本月）', type: 'progress' },
  { title: '工单状态分布', type: 'work' },
  { title: '资产分布（按车间）', type: 'bars' },
  { title: '备件预警', type: 'spares' },
];

const securityKpis: KpiItem[] = [
  { label: '防火墙', value: '5,998', note: '在线率', trend: '96.3%', icon: Shield, accent: 'blue', visual: iconAsset('security-shield') },
  { label: '路由/交换', value: '21,402', note: '健康率', trend: '97.6%', icon: Server, accent: 'cyan', visual: iconAsset('iot-node') },
  { label: '负载均衡', value: '9.80', note: '评分', trend: '良好', icon: Gauge, accent: 'violet', visual: iconAsset('sync-delay') },
  { label: '策略命中', value: '9.60', note: '万次', trend: '2.4%', icon: Zap, accent: 'orange', visual: iconAsset('alarm') },
];

const analyticsKpis: KpiItem[] = [
  { label: '设备总量', value: '1,256', note: '采集点', trend: '98.6%', icon: Database, accent: 'blue', visual: iconAsset('data-collect') },
  { label: '消息吞吐', value: '3.42k', note: '每分钟', trend: '12.6%', icon: Activity, accent: 'cyan', visual: iconAsset('sensor-data') },
  { label: '入库流水', value: '2.48k', note: '今日', trend: '8.2%', icon: Archive, accent: 'green', visual: iconAsset('spare-stock') },
  { label: '同步延迟', value: '95.2', unit: 'ms', note: '平均', trend: '稳定', icon: Monitor, accent: 'violet', visual: iconAsset('sync-delay') },
];

const dataSignals = [
  ['采集在线', '1,256', '98.6%', 'blue'],
  ['消息吞吐', '3.42k', '每分钟', 'cyan'],
  ['今日产量', '1.2万', 'MES同步', 'green'],
  ['平均延迟', '95.2ms', '稳定', 'violet'],
] as const;

const dataPipelineSteps = [
  ['MES', '18条链路', '正常', 'blue', detailAsset('data-sync-pipeline-v1')],
  ['IoT网关', '1,256点', '在线', 'cyan', detailAsset('asset-status-distribution-v1')],
  ['数据清洗', '99.2%', '通过', 'green', detailAsset('data-sync-pipeline-v1')],
  ['指标服务', '95.2ms', '稳定', 'violet', detailAsset('data-sync-pipeline-v1')],
] as const;

const dataExceptionRows = [
  ['T-01', '温度采集延迟', '产线A / 注塑区', '处理中', 'orange'],
  ['V-07', '振动阈值波动', '机加区 / 3号位', '观察', 'blue'],
  ['M-12', 'MES批次缺口', '装配线 / B段', '待确认', 'red'],
  ['P-03', '入库流水回补', '仓储物流', '已闭环', 'green'],
] as const;

const securitySignals = [
  ['高危策略', '12', 'red', detailAsset('risk-level-tags-v1')],
  ['中危策略', '38', 'orange', detailAsset('risk-level-tags-v1')],
  ['阻断事件', '1,602', 'blue', detailAsset('asset-status-distribution-v1')],
  ['联动工单', '27', 'cyan', detailAsset('work-order-flow-v1')],
] as const;

const securityProductTiles = [
  ['风险标签', '策略命中分级', detailAsset('risk-level-tags-v1')],
  ['处置流转', '告警转工单', detailAsset('work-order-flow-v1')],
  ['状态分布', '资产风险覆盖', detailAsset('asset-status-distribution-v1')],
] as const;

const securityCompositionRows = [
  ['策略检查', '139', '20%', 'blue'],
  ['暴露主机', '69', '6%', 'red'],
  ['对象检查', '23', '3%', 'cyan'],
  ['高危端口', '366', '56%', 'orange'],
] as const;

const securityRiskRows = [
  ['1', 'YHB-1', '192.168.0.1', '弱口令暴露', '92'],
  ['2', 'YHB-1', '192.168.0.8', '策略异常命中', '88'],
  ['3', 'YHB-3', '192.168.1.12', '端口开放', '85'],
  ['4', 'YHB-5', '192.168.2.6', '补丁逾期', '82'],
  ['5', 'YHB-7', '192.168.3.2', '访问突增', '80'],
  ['6', 'YHB-9', '192.168.4.9', '异常登录', '78'],
] as const;

const securityEventRows = [
  ['熔断策略-12', '高危', '2026-06-12 14:32:09'],
  ['拦截白名单-08', '中危', '2026-06-12 14:21:10'],
  ['端口扫描-03', '低危', '2026-06-12 14:12:05'],
] as const;

const assetOpsSignals = [
  ['在线资产', '5,102', '在线率 74.6%', 'blue', detailAsset('asset-status-distribution-v1')],
  ['位置同步', '6,218', '覆盖 98.2%', 'cyan', detailAsset('location-tracking-v1')],
  ['温度异常', '18', '需关注', 'orange', detailAsset('temperature-monitoring-v1')],
  ['维保闭环', '92.6%', '本月完成', 'green', detailAsset('maintenance-level-v1')],
] as const;

const assetLifecycleSteps = [
  ['建账', '资产台账', '6,842台'],
  ['同步', 'MES状态', '18,420次'],
  ['研判', '健康评分', '86分'],
  ['派单', '预测维保', '24单'],
  ['闭环', '验收归档', '91.8%'],
] as const;

const featureBullets = [
  { icon: ShieldCheck, label: '安全态势全面感知' },
  { icon: Gauge, label: '设备健康智能预警' },
  { icon: ClipboardList, label: '运维协同高效闭环' },
  { icon: BarChart3, label: '数据驱动降本增效' },
];

const quickActions = [
  {
    label: '新增工单',
    icon: FileText,
    visual: detailAsset('work-order-flow-v1'),
    target: buildWorkOrderPrefillPath({
      source: 'quick-action',
      title: '固定资产工作台快捷预测维保工单',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      riskState: '温度异常',
      riskScore: 92,
      priority: 'HIGH',
      dueDate: '2026-06-16',
      description: '来自固定资产工作台快捷入口：健康指数与高风险资产 TOP 命中，建议生成预测维保工单。',
    }),
    summary: '基于健康指数、风险标签和维保等级发起预测维保工单，进入后可补齐资产、派工人与验收节点。',
    stats: [
      { label: '建议资产', value: '12', note: '台' },
      { label: '自动带入', value: '4', note: '项' },
      { label: '预计闭环', value: '48h', note: '内' },
    ],
  },
  {
    label: '设备巡检',
    icon: CheckCircle2,
    visual: detailAsset('asset-status-distribution-v1'),
    target: buildInspectionPrefillPath({
      source: 'quick-inspection',
      inspectionNo: 'INSP-20260614-M201',
      assetId: 201,
      assetName: '注塑机 M-201',
      inspectionType: 'SPECIAL',
      inspectionDate: '2026-06-14',
      nextInspectionDate: '2026-06-21',
      inspectorName: '智能巡检组',
      findings: '来自固定资产工作台：注塑机 M-201 在线状态波动，温度与维保等级需要现场复核。',
    }),
    summary: '进入巡检计划与扫码核验页面，围绕在线、位置、温度和异常状态生成现场巡检任务。',
    stats: [
      { label: '待巡检', value: '73', note: '项' },
      { label: '异常项', value: '9', note: '条' },
      { label: '准时率', value: '96%', note: '本月' },
    ],
  },
  {
    label: '点检执行',
    icon: ClipboardList,
    visual: detailAsset('temperature-monitoring-v1'),
    target: buildSafetyPrefillPath({
      source: 'quick-safety',
      templateId: 1,
      assetId: 201,
      executorId: 1,
      assetName: '注塑机 M-201',
      focusItem: '温度 / 振动 / 电流',
      readingHint: '18 个高温点位待确认',
      riskLevel: '高温点位',
      note: '来自固定资产工作台：注塑机 M-201 温度异常与联动告警已命中，建议现场点检并上传照片证据。',
    }),
    summary: '进入点检执行台，优先处理温度、振动、电流和安全规则命中的设备点位。',
    stats: [
      { label: '高温点位', value: '18', note: '个' },
      { label: '待确认', value: '6', note: '项' },
      { label: '联动告警', value: '3', note: '条' },
    ],
  },
  {
    label: '备件申请',
    icon: Box,
    visual: detailAsset('spare-parts-support-v1'),
    target: buildSparePrefillPath({
      source: 'spare-request',
      partNo: 'SP-TEMP-201',
      partName: '温控模块传感器',
      specification: 'PT100-M201 / 0-120°C',
      unit: '件',
      currentStock: 2,
      safetyStock: 8,
      unitPrice: 680,
      relatedWorkOrder: 'WO-20250612001',
      assetName: '注塑机 M-201',
      supplier: 'UNIVIEW 备件仓',
      arrivalDate: '2026-06-18',
      note: '来自固定资产工作台：温控模块复核工单触发低储备件申请，建议优先本仓调拨并同步工单成本。',
    }),
    summary: '进入备件申请入口，按维保工单自动带出缺件、库存下限、供应商与预计到货时间。',
    stats: [
      { label: '低储备件', value: '18', note: '项' },
      { label: '关联工单', value: '24', note: '单' },
      { label: '可用库存', value: '86%', note: '占比' },
    ],
  },
  {
    label: '维保计划',
    icon: CalendarDays,
    visual: detailAsset('maintenance-level-v1'),
    target: '/maintenance/plans',
    summary: '进入维保计划看板，按健康评分、设备等级和停机窗口重排保养节奏。',
    stats: [
      { label: '待维保', value: '248', note: '台' },
      { label: '本周计划', value: '24', note: '单' },
      { label: '闭环率', value: '92%', note: '本月' },
    ],
  },
  {
    label: '报表中心',
    icon: BarChart3,
    visual: iconAsset('report-bars'),
    target: '/reports',
    summary: '进入报表中心，汇总资产、维保、巡检、备件、能耗和安全态势的经营分析视图。',
    stats: [
      { label: '模板', value: '26', note: '个' },
      { label: '订阅', value: '14', note: '个' },
      { label: '导出', value: '312', note: '次' },
    ],
  },
  {
    label: '告警处理',
    icon: Bell,
    visual: detailAsset('risk-level-tags-v1'),
    target: buildAlertPrefillPath({
      source: 'quick-alert',
      title: '固定资产工作台高危告警处置',
      eventName: '注塑机 M-201 温度异常',
      severity: '高危',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      state: '待研判',
      suggestedAction: '复核温度、位置与维保等级，必要时转预测维保工单。',
      description: '来自固定资产工作台快捷入口：聚合资产异常、安全策略命中和联动工单，建议先完成告警研判再派工。',
    }),
    summary: '进入告警队列，聚合资产异常、安全策略命中和联动工单，支持统一研判处置。',
    stats: [
      { label: '高危', value: '3', note: '条' },
      { label: '处理中', value: '27', note: '单' },
      { label: '响应', value: '2.3h', note: '平均' },
    ],
  },
];

const moduleMockByMenuId: Record<string, ModuleMock> = {
  asset: {
    eyebrow: '资产总览',
    title: '资产健康与生命周期总览',
    summary: '把资产台账、健康评分、风险 TOP、生命周期节点和 MES 状态同步整合成资产运营中心主视角。',
    routeTarget: '/assets?source=workbench&view=asset-overview',
    icon: Layers,
    visual: detailAsset('health-gear-ring-v1'),
    action: '进入资产清单',
    stats: menuContextById.asset.stats,
    rows: [
      { label: '注塑机 M-201', value: '92分', note: '一车间 / 高风险', tone: 'red' },
      { label: '空压机 KQ-03', value: '88分', note: '动力站 / 振动偏高', tone: 'orange' },
      { label: 'AGV-05', value: '在线', note: '物流区 / 状态稳定', tone: 'green' },
    ],
    steps: [
      { label: '建账', note: '台账与编码统一' },
      { label: '同步', note: 'MES/IoT 状态回写' },
      { label: '治理', note: '健康评分与风险闭环' },
    ],
  },
  todo: {
    eyebrow: '流程待办',
    title: '审批与运维待办队列',
    summary: '把待审批、预测维保、巡检异常和备件低储合并成一个运营队列，进入后分别承接到审批、工单和维保页面。',
    routeTarget: '/approvals?source=workbench&status=PENDING',
    icon: ClipboardList,
    visual: moduleV6Asset('module-flow-todo-console'),
    action: '进入待办队列',
    stats: menuContextById.todo.stats,
    rows: [
      { label: '资产转移审批', value: '8项', note: '等待部门负责人', tone: 'orange' },
      { label: '预测维保派工', value: '24单', note: '建议今日派发', tone: 'blue' },
      { label: '低储备件复核', value: '18项', note: '关联 7 张工单', tone: 'red' },
    ],
    steps: [
      { label: '聚合', note: '审批/工单/巡检统一入队' },
      { label: '研判', note: '按风险与 SLA 排序' },
      { label: '承接', note: '跳转真实业务页面处理' },
    ],
  },
  device: {
    eyebrow: '设备管理',
    title: '机台在线与温度监控',
    summary: '把设备在线、所在位置、温度边界、振动趋势和采集延迟放到一个现场运维看板中，模拟二期对接 MES 后的设备状态页。',
    routeTarget: '/equipment?source=workbench',
    icon: Cpu,
    visual: moduleV6Asset('module-device-ops-console'),
    action: '进入设备状态看板',
    stats: menuContextById.device.stats,
    rows: [
      { label: '注塑机 M-201', value: '87.6°C', note: '一车间 / A线', tone: 'orange' },
      { label: '空压机 KQ-03', value: '6.2mm/s', note: '动力站 / 空压区', tone: 'red' },
      { label: 'AGV-05', value: '在线', note: '物流区 / 充电位', tone: 'green' },
    ],
    steps: [
      { label: '采集', note: 'IoT 网关同步温度/振动' },
      { label: '研判', note: '健康模型计算风险等级' },
      { label: '联动', note: '异常自动带出工单/点检' },
    ],
  },
  orders: {
    eyebrow: '工单管理',
    title: '预测维保工单闭环',
    summary: '按资产健康指数、维保等级和风险 TOP 自动生成预测维保工单，展示派工、备件、执行和验收的完整 mock 流程。',
    routeTarget: buildWorkOrderPrefillPath({
      source: 'quick-action',
      title: '固定资产工作台预测维保工单',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      riskState: '温度异常',
      riskScore: 92,
      priority: 'HIGH',
      dueDate: '2026-06-16',
      description: '来自固定资产工作台工单管理：健康指数与风险 TOP 自动触发预测维保。',
    }),
    icon: ClipboardList,
    visual: moduleV6Asset('module-workorder-dispatch-console'),
    action: '进入工单闭环台',
    stats: menuContextById.orders.stats,
    rows: [
      { label: 'WO-20250612001', value: '温控复核', note: '注塑机 M-201', tone: 'orange' },
      { label: 'WO-20250612002', value: '振动点检', note: '空压机 KQ-03', tone: 'red' },
      { label: 'WO-20250612003', value: '待验收', note: '冷压机 CP-07', tone: 'blue' },
    ],
    steps: [
      { label: '预测', note: '健康指数触发' },
      { label: '派工', note: '班组与备件自动带入' },
      { label: '验收', note: '结果回写资产台账' },
    ],
  },
  inspection: {
    eyebrow: '巡检管理',
    title: '点检路线与异常复核',
    summary: '围绕设备位置、风险等级和温度异常生成巡检路线，模拟现场扫码、采集、拍照和异常转派。',
    routeTarget: buildInspectionPrefillPath({
      source: 'quick-inspection',
      inspectionNo: 'INSP-20260614-M201',
      assetId: 201,
      assetName: '注塑机 M-201',
      inspectionType: 'SPECIAL',
      inspectionDate: '2026-06-14',
      nextInspectionDate: '2026-06-21',
      inspectorName: '智能巡检组',
      findings: '来自固定资产工作台巡检管理：高温点位需要现场复核。',
    }),
    icon: CheckCircle2,
    visual: detailAsset('location-tracking-v1'),
    action: '进入巡检执行台',
    stats: menuContextById.inspection.stats,
    rows: [
      { label: '产线A 温度巡检', value: '18点', note: '今日 14:00', tone: 'orange' },
      { label: '动力站振动巡检', value: '6点', note: '待现场确认', tone: 'red' },
      { label: '仓储 AGV 巡检', value: '12点', note: '已排程', tone: 'green' },
    ],
    steps: [
      { label: '排程', note: '自动按风险生成路线' },
      { label: '执行', note: '扫码核验与现场采集' },
      { label: '复核', note: '异常回到告警/工单' },
    ],
  },
  spares: {
    eyebrow: '备件管理',
    title: '备件保障与低储预警',
    summary: '把预测维保工单、低储备件、供应商交期和领用记录串起来，模拟维修前的备件准备闭环。',
    routeTarget: buildSparePrefillPath({
      source: 'spare-request',
      partNo: 'SP-TEMP-201',
      partName: '温控模块传感器',
      specification: 'PT100-M201 / 0-120°C',
      unit: '件',
      currentStock: 2,
      safetyStock: 8,
      unitPrice: 680,
      relatedWorkOrder: 'WO-20250612001',
      assetName: '注塑机 M-201',
      supplier: 'UNIVIEW 备件仓',
      arrivalDate: '2026-06-18',
      note: '来自固定资产工作台备件管理：低储备件与预测维保工单联动。',
    }),
    icon: PackageCheck,
    visual: detailAsset('spare-parts-support-v1'),
    action: '进入备件保障台',
    stats: menuContextById.spares.stats,
    rows: [
      { label: '温控模块传感器', value: '2件', note: '低于安全库存 8', tone: 'red' },
      { label: '轴承 6205', value: '6件', note: '关联 3 张工单', tone: 'orange' },
      { label: '皮带 B-320', value: '12件', note: '可保障 7 天', tone: 'green' },
    ],
    steps: [
      { label: '识别', note: '工单缺件自动匹配' },
      { label: '申请', note: '领用/采购单一键生成' },
      { label: '回写', note: '成本同步到维保工单' },
    ],
  },
  energy: {
    eyebrow: '数据监控',
    title: 'MES 与 IoT 数据链路',
    summary: '汇聚设备采集、MES 工单、产线节拍和异常流水，展示采集延迟、吞吐、链路质量与异常补偿。',
    routeTarget: '/energy?source=workbench&scope=data-monitoring',
    icon: Activity,
    visual: detailAsset('data-sync-pipeline-v1'),
    action: '进入数据链路台',
    stats: menuContextById.energy.stats,
    rows: [
      { label: 'IoT 网关 A-01', value: '95ms', note: '1,256 点在线', tone: 'blue' },
      { label: 'MES 批次同步', value: '18条', note: '产线与工单回写', tone: 'green' },
      { label: '异常流水回补', value: '3项', note: '等待人工确认', tone: 'orange' },
    ],
    steps: [
      { label: '采集', note: '网关与设备点位' },
      { label: '清洗', note: '异常补偿与去重' },
      { label: '服务', note: '指标订阅和报表' },
    ],
  },
  report: {
    eyebrow: '报表分析',
    title: '经营分析与审计报表',
    summary: '汇总资产、设备、维保、巡检、备件和安全态势，形成经营分析、月报导出和订阅任务的 mock 页面。',
    routeTarget: '/reports?source=workbench&view=operations',
    icon: BarChart3,
    visual: moduleV6Asset('module-report-analysis-console'),
    action: '进入报表中心',
    stats: menuContextById.report.stats,
    rows: [
      { label: '资产健康月报', value: '已生成', note: '06-14 09:30', tone: 'green' },
      { label: '维保成本分析', value: '订阅中', note: '每周一推送', tone: 'blue' },
      { label: '安全态势复盘', value: '待确认', note: '3 条高危事件', tone: 'orange' },
    ],
    steps: [
      { label: '汇总', note: '多中心指标聚合' },
      { label: '分析', note: '趋势/排行/成本拆解' },
      { label: '分发', note: '导出和订阅推送' },
    ],
  },
  alarm: {
    eyebrow: '告警中心',
    title: '安全告警研判处置',
    summary: '把资产异常、策略命中、风险标签和工单联动放入同一处置台，形成发现、研判、处置、闭环的安全态势 mock。',
    routeTarget: buildAlertPrefillPath({
      source: 'quick-alert',
      title: '固定资产工作台告警队列',
      eventName: '注塑机 M-201 温度异常',
      severity: '高危',
      assetName: '注塑机 M-201',
      assetLocation: '一车间 / A线',
      state: '待研判',
      suggestedAction: '复核温度、位置与维保等级，必要时转预测维保工单。',
      description: '来自固定资产工作台告警中心：聚合资产异常、安全策略命中和联动工单。',
    }),
    icon: Bell,
    visual: moduleV6Asset('module-alert-center-console'),
    action: '进入告警处置台',
    stats: menuContextById.alarm.stats,
    rows: [
      { label: '熔断策略-12', value: '高危', note: '待阻断', tone: 'red' },
      { label: '拦截白名单-08', value: '中危', note: '待复核', tone: 'orange' },
      { label: '端口扫描-03', value: '低危', note: '已归档', tone: 'blue' },
    ],
    steps: [
      { label: '发现', note: '策略/资产异常聚合' },
      { label: '研判', note: '风险等级与影响范围' },
      { label: '闭环', note: '转派工单并复盘' },
    ],
  },
  policy: {
    eyebrow: '组织策略',
    title: '风险规则与策略治理',
    summary: '模拟组织策略、风险阈值、告警规则和审批边界的配置页，让安全态势不只是看板，也能解释规则从哪里来。',
    routeTarget: '/risk-matrix?source=workbench&scope=policy',
    icon: ShieldCheck,
    visual: detailAsset('asset-status-distribution-v1'),
    action: '进入策略规则台',
    stats: menuContextById.policy.stats,
    rows: [
      { label: '高危端口暴露', value: '启用', note: '影响 366 个端口', tone: 'red' },
      { label: '维保逾期联动', value: '启用', note: '自动转工单', tone: 'orange' },
      { label: '位置漂移复核', value: '启用', note: '二次定位', tone: 'blue' },
    ],
    steps: [
      { label: '定义', note: '阈值、范围、动作' },
      { label: '命中', note: '实时匹配资产事件' },
      { label: '治理', note: '审批与复盘留痕' },
    ],
  },
  settings: {
    eyebrow: '基础维护',
    title: '组织与集成配置',
    summary: '模拟组织、角色、字典、MES/IoT 集成账号和平台参数配置，让演示从“看板”延伸到“可运营的平台”。',
    routeTarget: '/settings/sysconfig?source=workbench',
    icon: Settings,
    visual: detailAsset('data-sync-pipeline-v1'),
    action: '进入基础维护台',
    stats: menuContextById.settings.stats,
    rows: [
      { label: 'MES 集成源', value: '在线', note: '18 条链路', tone: 'green' },
      { label: 'IoT 网关', value: '1,256点', note: '平均延迟 95.2ms', tone: 'blue' },
      { label: '角色组', value: '18组', note: '4 组待复核', tone: 'orange' },
    ],
    steps: [
      { label: '配置', note: '组织/角色/字典' },
      { label: '接入', note: 'MES 与 IoT 账号' },
      { label: '监控', note: '同步质量与审计' },
    ],
  },
};

const workbenchProductPageMetaByMenuId: Record<string, WorkbenchProductPageMeta> = {
  asset: {
    position: 'Dashboard KPI 与资产态势迁移后的正式资产运营承接页。',
    imageSrc: stitchAsset('assets'),
    emptyState: '筛选条件下暂无高风险资产时，保留资产清单入口与健康评分总览。',
    errorState: 'MES/IoT 状态同步失败时，提示回到资产台账并重试同步任务。',
    deniedState: '缺少 asset:query 权限时，资产清单与明细跳转在抽屉中禁用。',
    actions: [
      {
        title: '查看资产清单',
        source: '资产总览产品页',
        routeTarget: '/assets?source=workbench&view=asset-overview',
        description: '进入资产台账，保留 Workbench 来源、资产总览视角和风险筛选上下文。',
        primaryLabel: '进入资产清单',
        icon: Layers,
        visual: detailAsset('health-gear-ring-v1'),
        stats: menuContextById.asset.stats,
      },
      {
        title: '生成风险工单',
        source: '资产总览产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'asset-risk',
          title: '资产健康风险处置工单',
          assetName: '注塑机 M-201',
          assetLocation: '一车间 / A线',
          riskState: '温度异常',
          riskScore: 92,
          riskLevel: '高风险',
          priority: 'HIGH',
          dueDate: '2026-06-16',
          description: '来自 Workbench 资产总览：健康评分 92 分且温度异常，建议转预测维保工单。',
        }),
        description: '把资产健康异常、位置、风险等级和到期时间预填到工单创建页。',
        primaryLabel: '创建工单',
        icon: ClipboardList,
        visual: detailAsset('work-order-flow-v1'),
        stats: menuContextById.orders.stats,
      },
    ],
  },
  todo: {
    position: 'Dashboard 待审批、最近工单、维保预警迁移后的统一流程队列。',
    imageSrc: moduleV6Asset('module-flow-todo-console'),
    stitchScreen: 'workbench-menu-todo-v1',
    assetPurpose: 'IMAGE2 页面级业务图：混合待办队列、SLA 排序、详情抽屉和跨模块处理入口。',
    filters: ['全部待办', '待审批', '待派工', '巡检异常', '低储备件', 'SLA超时'],
    lanes: [
      { label: '审批处理', value: '18', note: '资产转移/报废/退库', tone: 'orange' },
      { label: '预测派工', value: '24', note: '今日建议派发', tone: 'blue' },
      { label: '巡检异常', value: '9', note: '待复核点位', tone: 'red' },
      { label: '备件低储', value: '18', note: '关联 7 张工单', tone: 'cyan' },
    ],
    insights: [
      { label: '最高优先级', value: 'CRITICAL', note: '注塑机 M-201 温度异常' },
      { label: '批量处理', value: '6 项', note: '同部门审批可合并' },
      { label: '异常承接', value: '4 条', note: '可直接转工单' },
    ],
    emptyState: '当前角色暂无待审批或待派工事项时，显示已清空队列并保留工单入口。',
    errorState: '审批中心或工单中心接口异常时，展示队列不可用并允许进入对应业务页处理。',
    deniedState: '缺少 approval:process:query 或 workorder:order:query 时，对应处理按钮禁用。',
    actions: [
      {
        title: '处理审批队列',
        source: '流程待办产品页',
        routeTarget: '/approvals?source=workbench&status=PENDING',
        description: '进入审批中心，保留 Workbench 来源与 PENDING 状态筛选。',
        primaryLabel: '进入审批处理',
        icon: ClipboardList,
        visual: detailAsset('work-order-flow-v1'),
        stats: menuContextById.todo.stats,
      },
      {
        title: '派发预测工单',
        source: '流程待办产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'predictive-maintenance',
          title: '流程待办触发预测维保派工',
          assetName: '注塑机 M-201',
          assetLocation: '一车间 / A线',
          riskState: '温度异常',
          riskScore: 92,
          priority: 'HIGH',
          dueDate: '2026-06-16',
          description: '来自 Workbench 流程待办：预测维保队列命中高风险资产，需要派工。',
        }),
        description: '把待办队列中的风险资产、优先级和截止时间预填到新建工单。',
        primaryLabel: '创建预测工单',
        icon: Wrench,
        visual: detailV6Asset('todo-approval-flow-v1'),
        stats: menuContextById.orders.stats,
      },
    ],
  },
  device: {
    position: '设备在线、温度、振动、采集延迟的现场运维承接页。',
    imageSrc: moduleV6Asset('module-device-ops-console'),
    stitchScreen: 'workbench-menu-device-v1',
    assetPurpose: 'IMAGE2 页面级业务图：设备列表、遥测趋势、异常设备队列和派工/巡检入口。',
    filters: ['全部设备', '在线', '温度异常', '振动异常', '采集延迟', 'A线'],
    lanes: [
      { label: '在线设备', value: '5,102', note: '在线率 98.6%', tone: 'green' },
      { label: '温度异常', value: '12', note: '超过阈值', tone: 'orange' },
      { label: '振动异常', value: '6', note: '动力站优先', tone: 'red' },
      { label: '采集延迟', value: '95.2ms', note: 'IoT 平均', tone: 'cyan' },
    ],
    insights: [
      { label: '联动建议', value: '派工', note: '异常设备进入预测维保' },
      { label: '巡检点位', value: '18', note: '温度/振动/电流' },
      { label: '采集链路', value: '稳定', note: 'MES 已同步' },
    ],
    emptyState: '当前产线筛选下暂无异常设备时，展示在线设备概览和资产台账入口。',
    errorState: 'IoT 网关掉线或采集超时时，显示链路异常并提供数据监控跳转。',
    deniedState: '缺少 asset:query 或 dashboard:query 时，设备状态和台账入口禁用。',
    actions: [
      {
        title: '打开设备台账',
        source: '设备管理产品页',
        routeTarget: '/equipment?source=workbench&status=ONLINE',
        description: '进入设备台账，保留在线设备、WorkBench 来源和现场运维上下文。',
        primaryLabel: '进入设备台账',
        icon: Cpu,
        visual: detailV6Asset('device-telemetry-v1'),
        stats: menuContextById.device.stats,
      },
      {
        title: '创建温度复核工单',
        source: '设备管理产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'quick-action',
          title: '设备温度异常复核工单',
          assetName: '注塑机 M-201',
          assetLocation: '一车间 / A线',
          riskState: '温度异常',
          riskScore: 92,
          priority: 'HIGH',
          dueDate: '2026-06-16',
          description: '来自 Workbench 设备管理：温度边界触发复核，需要创建现场维保工单。',
        }),
        description: '把设备温度异常、位置和风险评分预填到新建工单。',
        primaryLabel: '创建复核工单',
        icon: Wrench,
        visual: moduleV6Asset('module-device-ops-console'),
        stats: menuContextById.orders.stats,
      },
    ],
  },
  orders: {
    position: '预测维保、派工执行、验收闭环和 SLA 的工单管理承接页。',
    imageSrc: moduleV6Asset('module-workorder-dispatch-console'),
    stitchScreen: 'workbench-menu-orders-v1',
    assetPurpose: 'IMAGE2 页面级业务图：预测、派工、执行、验收和备件保障的工单闭环。',
    filters: ['全部工单', '预测', '待派工', '执行中', '待验收', 'SLA风险'],
    lanes: [
      { label: '预测生成', value: '36', note: '风险模型触发', tone: 'blue' },
      { label: '待派工', value: '24', note: '班组待确认', tone: 'orange' },
      { label: '执行中', value: '42', note: '现场处理中', tone: 'cyan' },
      { label: '待验收', value: '11', note: '需复核回写', tone: 'green' },
    ],
    insights: [
      { label: 'SLA 风险', value: '4 单', note: '24h 内到期' },
      { label: '备件就绪', value: '82%', note: '低储项自动提醒' },
      { label: '闭环率', value: '91.8%', note: '本周维保' },
    ],
    emptyState: '当前筛选下暂无待办工单时，展示最近闭环记录和新建工单入口。',
    errorState: '工单服务不可用时，保留预填上下文并提示稍后重试或进入列表。',
    deniedState: '缺少 workorder:order:query 时，工单列表和新建工单入口在抽屉中禁用。',
    actions: [
      {
        title: '创建预测工单',
        source: '工单管理产品页',
        routeTarget: menuContextById.orders.routeTarget,
        description: '用 Workbench 工单管理上下文预填资产、风险、优先级和截止时间。',
        primaryLabel: '新建工单',
        icon: ClipboardList,
        visual: moduleV6Asset('module-workorder-dispatch-console'),
        stats: menuContextById.orders.stats,
      },
      {
        title: '查看工单队列',
        source: '工单管理产品页',
        routeTarget: '/workorders?source=workbench&status=PENDING',
        description: '进入工单列表，保留待派工状态和 Workbench 来源筛选。',
        primaryLabel: '进入工单列表',
        icon: FileText,
        visual: detailV6Asset('spare-maintenance-link-v1'),
        stats: menuContextById.orders.stats,
      },
    ],
  },
  inspection: {
    position: '点检路线、扫码执行、异常复核的巡检闭环承接页。',
    imageSrc: detailAsset('location-tracking-v1'),
    emptyState: '暂无今日巡检任务时，展示下次排程和按风险生成计划入口。',
    errorState: '巡检模板或路线拉取失败时，提示使用预填任务进入巡检页面。',
    deniedState: '缺少 inspection:query 时，巡检计划和执行入口禁用。',
    actions: [
      {
        title: '生成巡检计划',
        source: '巡检管理产品页',
        routeTarget: menuContextById.inspection.routeTarget,
        description: '进入巡检新建页，预填设备、巡检类型、日期和现场发现。',
        primaryLabel: '进入巡检计划',
        icon: CheckCircle2,
        visual: detailAsset('location-tracking-v1'),
        stats: menuContextById.inspection.stats,
      },
      {
        title: '执行安全点检',
        source: '巡检管理产品页',
        routeTarget: buildSafetyPrefillPath({
          source: 'quick-safety',
          templateId: 1,
          assetId: 201,
          executorId: 1,
          assetName: '注塑机 M-201',
          focusItem: '温度 / 振动 / 电流',
          readingHint: '18 个高温点位待确认',
          riskLevel: '高温点位',
          note: '来自 Workbench 巡检管理：高温点位需要现场点检并上传证据。',
        }),
        description: '进入点检执行台，预填高温点位、执行人和风险说明。',
        primaryLabel: '进入点检执行',
        icon: ClipboardList,
        visual: detailAsset('temperature-monitoring-v1'),
        stats: menuContextById.inspection.stats,
      },
    ],
  },
  spares: {
    position: '低储预警、领用申请、采购联动和工单成本回写的备件承接页。',
    imageSrc: detailAsset('spare-parts-support-v1'),
    emptyState: '暂无低储备件时，展示安全库存达标和最近领用记录。',
    errorState: '库存服务异常时，提示进入备件申请页保留工单上下文。',
    deniedState: '缺少 inventory:sparepart:query 时，备件库存与申请入口禁用。',
    actions: [
      {
        title: '申请低储备件',
        source: '备件管理产品页',
        routeTarget: menuContextById.spares.routeTarget,
        description: '进入备件申请页，预填缺件、库存下限、供应商和关联工单。',
        primaryLabel: '进入备件申请',
        icon: PackageCheck,
        visual: detailAsset('spare-parts-support-v1'),
        stats: menuContextById.spares.stats,
      },
      {
        title: '查看备件库存',
        source: '备件管理产品页',
        routeTarget: '/spare-parts?source=workbench&stock=LOW',
        description: '进入备件库存列表，保留低储筛选和工单关联上下文。',
        primaryLabel: '进入库存列表',
        icon: Box,
        visual: detailAsset('spare-parts-support-v1'),
        stats: menuContextById.spares.stats,
      },
    ],
  },
  energy: {
    position: '数据监控中心内的采集链路、异常流水和指标服务承接页。',
    imageSrc: stitchAsset('analytics'),
    emptyState: '当前产线暂无异常流水时，展示采集链路和吞吐趋势。',
    errorState: 'MES 或 IoT 连接异常时，展示错误态并保留数据链路入口。',
    deniedState: '缺少 dashboard:query 时，数据监控链路和指标服务入口禁用。',
    actions: [
      {
        title: '查看数据链路',
        source: '数据监控产品页',
        routeTarget: '/energy?source=workbench&scope=data-monitoring',
        description: '进入数据监控页面，保留 MES/IoT 链路和 Workbench 来源。',
        primaryLabel: '进入数据链路',
        icon: Activity,
        visual: detailAsset('data-sync-pipeline-v1'),
        stats: menuContextById.energy.stats,
      },
      {
        title: '订阅异常报表',
        source: '数据监控产品页',
        routeTarget: '/reports?source=workbench&view=data-monitoring&subscribe=true',
        description: '进入报表中心，预填数据链路异常订阅和监控视角。',
        primaryLabel: '进入报表订阅',
        icon: BarChart3,
        visual: detailAsset('data-sync-pipeline-v1'),
        stats: menuContextById.report.stats,
      },
    ],
  },
  report: {
    position: 'Dashboard 趋势、分类分布、部门统计和导出能力迁移后的报表页。',
    imageSrc: moduleV6Asset('module-report-analysis-console'),
    stitchScreen: 'workbench-menu-report-v1',
    assetPurpose: 'IMAGE2 页面级业务图：模板选择、趋势分析、导出订阅、失败重试和审计链路。',
    filters: ['经营月报', '资产价值', '分类分布', '部门统计', '维保成本', '导出历史'],
    lanes: [
      { label: '资产价值', value: '12月', note: '趋势已更新', tone: 'blue' },
      { label: '分类分布', value: '9 类', note: '可下钻筛选', tone: 'cyan' },
      { label: '部门统计', value: 'Top 10', note: '支持审计', tone: 'green' },
      { label: '导出异常', value: '2', note: '可重试', tone: 'orange' },
    ],
    insights: [
      { label: '订阅任务', value: '14', note: '每周自动推送' },
      { label: '导出格式', value: 'CSV/PDF', note: '保留筛选条件' },
      { label: '审计链路', value: '完整', note: '来源字段可追溯' },
    ],
    emptyState: '暂无匹配报表数据时，展示模板库、订阅任务和导出入口。',
    errorState: '报表聚合失败时，保留上次生成结果并提示重试或进入报表中心。',
    deniedState: '缺少 report:query 时，经营报表与导出入口在抽屉中禁用。',
    actions: [
      {
        title: '打开经营报表',
        source: '报表分析产品页',
        routeTarget: '/reports?source=workbench&view=operations',
        description: '进入报表中心，承接资产价值趋势、分类分布和部门资产统计。',
        primaryLabel: '进入报表中心',
        icon: BarChart3,
        visual: moduleV6Asset('module-report-analysis-console'),
        stats: menuContextById.report.stats,
      },
      {
        title: '导出资产趋势',
        source: '报表分析产品页',
        routeTarget: '/reports?source=workbench&view=asset-trend&export=csv',
        description: '进入报表导出视角，预填资产价值趋势和 CSV 导出意图。',
        primaryLabel: '进入导出页',
        icon: FileText,
        visual: detailV6Asset('report-export-lineage-v1'),
        stats: menuContextById.report.stats,
      },
    ],
  },
  alarm: {
    position: '安全态势工作台内的告警发现、研判、处置和复盘承接页。',
    imageSrc: moduleV6Asset('module-alert-center-console'),
    stitchScreen: 'workbench-menu-alert-v1',
    assetPurpose: 'IMAGE2 页面级业务图：等级筛选、策略命中、处置建议、转工单和复盘闭环。',
    filters: ['全部告警', '高危', '中危', '低危', '策略命中', '待复盘'],
    lanes: [
      { label: '高危事件', value: '3', note: '需立即处置', tone: 'red' },
      { label: '策略命中', value: '27', note: '自动聚合', tone: 'orange' },
      { label: '处理中', value: '12', note: '工单联动', tone: 'blue' },
      { label: '已闭环', value: '91.8%', note: '本周', tone: 'green' },
    ],
    insights: [
      { label: '处置建议', value: '转工单', note: '高危资产优先' },
      { label: '复盘范围', value: '4 条', note: '策略需复核' },
      { label: '平均响应', value: '2.3h', note: '本周统计' },
    ],
    emptyState: '暂无待研判告警时，展示安全评分、最近处置和规则入口。',
    errorState: '告警流聚合失败时，提示进入通知中心并保留筛选参数。',
    deniedState: '缺少 notification:query 时，告警队列与处置入口禁用。',
    actions: [
      {
        title: '查看告警队列',
        source: '告警中心产品页',
        routeTarget: menuContextById.alarm.routeTarget,
        description: '进入通知中心，预填高危告警、资产位置和建议处置动作。',
        primaryLabel: '进入告警处置',
        icon: Bell,
        visual: moduleV6Asset('module-alert-center-console'),
        stats: menuContextById.alarm.stats,
      },
      {
        title: '转派处置工单',
        source: '告警中心产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'asset-risk',
          title: '告警转派处置工单',
          assetName: '注塑机 M-201',
          assetLocation: '一车间 / A线',
          riskState: '高危告警',
          riskScore: 92,
          riskLevel: '高危',
          priority: 'CRITICAL',
          dueDate: '2026-06-15',
          description: '来自 Workbench 告警中心：高危告警需要转派处置工单并复盘。',
        }),
        description: '把告警等级、资产、位置和处置建议预填到工单创建页。',
        primaryLabel: '创建处置工单',
        icon: AlertTriangle,
        visual: detailV6Asset('todo-approval-flow-v1'),
        stats: menuContextById.orders.stats,
      },
    ],
  },
  policy: {
    position: '组织策略、风险阈值、告警规则和审批边界的治理承接页。',
    imageSrc: detailAsset('asset-status-distribution-v1'),
    emptyState: '暂无待复核策略时，展示已启用规则和最近命中记录。',
    errorState: '策略规则服务异常时，提示进入风险矩阵并保留策略范围。',
    deniedState: '缺少 risk:matrix:query 时，策略规则入口禁用。',
    actions: [
      {
        title: '查看策略规则',
        source: '组织策略产品页',
        routeTarget: '/risk-matrix?source=workbench&scope=policy',
        description: '进入风险矩阵，保留组织策略、阈值和审批边界上下文。',
        primaryLabel: '进入策略规则',
        icon: ShieldCheck,
        visual: detailAsset('asset-status-distribution-v1'),
        stats: menuContextById.policy.stats,
      },
      {
        title: '复核高危规则',
        source: '组织策略产品页',
        routeTarget: '/risk-matrix?source=workbench&scope=policy&severity=HIGH',
        description: '进入风险矩阵高危规则视角，预填策略范围和风险等级。',
        primaryLabel: '进入高危复核',
        icon: Shield,
        visual: detailAsset('asset-status-distribution-v1'),
        stats: menuContextById.policy.stats,
      },
    ],
  },
  settings: {
    position: '组织、角色、数据字典、MES/IoT 集成账号和平台参数的基础维护承接页。',
    imageSrc: detailAsset('data-sync-pipeline-v1'),
    emptyState: '暂无待维护配置时，展示集成源、角色组和字典健康状态。',
    errorState: '配置服务或集成源异常时，提示进入系统配置页处理。',
    deniedState: '缺少 system:config:query 时，基础维护入口在抽屉中禁用。',
    actions: [
      {
        title: '打开基础维护',
        source: '基础维护产品页',
        routeTarget: '/settings/sysconfig?source=workbench',
        description: '进入系统配置，保留 Workbench 来源并聚焦组织、角色、集成源维护。',
        primaryLabel: '进入基础维护',
        icon: Settings,
        visual: detailAsset('data-sync-pipeline-v1'),
        stats: menuContextById.settings.stats,
      },
      {
        title: '查看集成链路',
        source: '基础维护产品页',
        routeTarget: '/energy?source=workbench&scope=integration-config',
        description: '进入数据监控链路视角，复核 MES/IoT 集成源和同步质量。',
        primaryLabel: '进入链路监控',
        icon: Database,
        visual: detailAsset('data-sync-pipeline-v1'),
        stats: menuContextById.energy.stats,
      },
    ],
  },
};

const workbenchCreateRouteByMenuId: Record<string, string> = {
  asset: '/assets/new?source=workbench',
  todo: buildWorkOrderPrefillPath({
    source: 'predictive-maintenance',
    title: '流程待办触发预测维保派工',
    assetName: '注塑机 M-201',
    assetLocation: '一车间 / A线',
    riskState: '温度异常',
    riskScore: 92,
    priority: 'HIGH',
    dueDate: '2026-06-16',
    description: '来自 Workbench 流程待办：预测维保队列命中高风险资产，需要派工。',
  }),
  device: buildWorkOrderPrefillPath({
    source: 'quick-action',
    title: '设备温度异常复核工单',
    assetName: '注塑机 M-201',
    assetLocation: '一车间 / A线',
    riskState: '温度异常',
    riskScore: 92,
    priority: 'HIGH',
    dueDate: '2026-06-16',
    description: '来自 Workbench 设备管理：温度边界触发复核，需要创建现场维保工单。',
  }),
  orders: menuContextById.orders.routeTarget,
  inspection: menuContextById.inspection.routeTarget,
  spares: menuContextById.spares.routeTarget,
  energy: '/reports?source=workbench&view=data-monitoring&subscribe=true',
  report: '/reports/scheduled?source=workbench&view=operations',
  alarm: buildWorkOrderPrefillPath({
    source: 'asset-risk',
    title: '告警转派处置工单',
    assetName: '注塑机 M-201',
    assetLocation: '一车间 / A线',
    riskState: '高危告警',
    riskScore: 92,
    riskLevel: '高危',
    priority: 'CRITICAL',
    dueDate: '2026-06-15',
    description: '来自 Workbench 告警中心：高危告警需要转派处置工单并复盘。',
  }),
  policy: '/risk-assessments/new?source=workbench&scope=policy',
  settings: '/settings/sysconfig?source=workbench&mode=edit',
};

const workbenchDetailRouteByMenuId: Record<string, string> = {
  asset: '/assets/201?source=workbench',
  todo: '/approvals/1?source=workbench',
  device: '/equipment/201?source=workbench',
  orders: '/workorders/1?source=workbench',
  inspection: '/inspections/1?source=workbench',
  spares: '/spare-parts/1?source=workbench',
  energy: '/energy?source=workbench&scope=data-monitoring&device=201',
  report: '/reports?source=workbench&view=operations&dept=A',
  alarm: '/notifications?source=workbench&severity=HIGH',
  policy: '/risk-matrix?source=workbench&scope=policy&severity=HIGH',
  settings: '/settings/sysconfig?source=workbench&tab=integration',
};

const workbenchEditRouteByMenuId: Record<string, string> = {
  asset: '/assets/201/edit?source=workbench',
  todo: '/approvals/1?source=workbench&mode=process',
  device: '/equipment/201?source=workbench&mode=maintain',
  orders: '/workorders/1/acceptance?source=workbench',
  inspection: '/inspections/1/edit?source=workbench',
  spares: '/spare-parts/1?source=workbench&mode=edit',
  energy: '/settings/sysconfig?source=workbench&tab=integration',
  report: '/reports/scheduled?source=workbench&mode=edit',
  alarm: '/notifications?source=workbench&action=resolve',
  policy: '/risk-matrix?source=workbench&scope=policy&mode=edit',
  settings: '/settings/sysconfig?source=workbench&mode=edit',
};

function buildWorkbenchOperationPreview({
  title,
  source,
  routeTarget,
  description,
  primaryLabel,
  icon,
  visual,
  stats,
}: RouteActionPreview): RouteActionPreview {
  return { title, source, routeTarget, description, primaryLabel, icon, visual, stats };
}

function findCreateAction(actions: RouteActionPreview[]) {
  return actions.find((action) => /新建|创建|生成|申请|派发|转派|订阅/.test(action.title)) ?? actions[1] ?? actions[0];
}

function buildWorkbenchOperations(
  item: WorkspaceMenuItem,
  context: MenuContext,
  meta: WorkbenchProductPageMeta,
): WorkbenchOperationItem[] {
  const queryAction = meta.actions[0];
  const createAction = findCreateAction(meta.actions);
  const detailRoute = workbenchDetailRouteByMenuId[item.id] ?? queryAction.routeTarget;
  const editRoute = workbenchEditRouteByMenuId[item.id] ?? detailRoute;
  const createRoute = workbenchCreateRouteByMenuId[item.id] ?? createAction.routeTarget;

  return [
    {
      kind: '新建/发起',
      title: createAction.title.includes('查看') || createAction.title.includes('打开') ? `发起${item.label}` : createAction.title,
      description: '进入真实业务页创建或发起处理，并带入 Workbench 上下文。',
      icon: createAction.icon,
      preview: buildWorkbenchOperationPreview({
        ...createAction,
        routeTarget: createRoute,
        primaryLabel: createAction.primaryLabel || '发起处理',
      }),
    },
    {
      kind: '查询/筛选',
      title: queryAction.title,
      description: '按当前菜单、状态和来源查询列表，保留 source=workbench。',
      icon: Search,
      preview: buildWorkbenchOperationPreview({
        ...queryAction,
        title: queryAction.title,
        description: `${queryAction.description} 支持按状态、来源和业务对象继续筛选。`,
      }),
    },
    {
      kind: '打开详情',
      title: `打开${item.label}详情`,
      description: '从队列或列表进入单据/资产/配置详情，继续处理当前对象。',
      icon: FileText,
      preview: buildWorkbenchOperationPreview({
        title: `打开${item.label}详情`,
        source: `${item.label}详情入口`,
        routeTarget: detailRoute,
        description: `打开 ${item.label} 的示例详情或业务列表定位结果，保留 Workbench 来源。`,
        primaryLabel: '打开详情',
        icon: FileText,
        visual: meta.imageSrc,
        stats: context.stats,
      }),
    },
    {
      kind: '编辑/维护',
      title: `维护${item.label}`,
      description: '进入现有编辑、验收、配置或维护入口，不在 Workbench 内重复造页面。',
      icon: Wrench,
      preview: buildWorkbenchOperationPreview({
        title: `维护${item.label}`,
        source: `${item.label}维护入口`,
        routeTarget: editRoute,
        description: `进入 ${item.label} 的维护/编辑/验收承接页，保留当前业务上下文。`,
        primaryLabel: '进入维护',
        icon: Wrench,
        visual: meta.imageSrc,
        stats: context.stats,
      }),
    },
    {
      kind: '危险操作',
      title: `${item.label}停用/撤销`,
      description: '删除、停用、撤销等高风险操作必须回到详情页二次确认并校验权限。',
      icon: X,
      disabledReason: 'Workbench 仅展示危险操作反馈；实际执行需进入详情页二次确认。',
      tone: 'danger',
    },
  ];
}

function getActionWorkflow(preview: RouteActionPreview): ActionWorkflow {
  const routeTarget = preview.routeTarget;
  const statMap = new Map(preview.stats.map((stat) => [stat.label, stat.value]));
  const isWorkOrder = routeTarget.includes('/workorders') || routeTarget.includes('/maintenance') || preview.title.includes('工单') || preview.title.includes('风险处置');
  const isAlert = routeTarget.includes('/notifications') || preview.title.includes('告警') || preview.source.includes('异常');
  const isRisk = routeTarget.includes('/risk-matrix') || preview.source.includes('风险');
  const isInspection = routeTarget.includes('/inspections') || routeTarget.includes('/safety-checklists');
  const isSpare = routeTarget.includes('/spare-parts');

  if (isWorkOrder) {
    return {
      status: '预测维保闭环',
      steps: [
        { label: '识别', note: '健康指数/风险标签触发' },
        { label: '派工', note: '自动带出资产与计划窗口' },
        { label: '执行', note: '现场处理、备件与照片回传' },
        { label: '验收', note: '复核指标并归档闭环' },
      ],
      fields: [
        { label: '资产对象', value: preview.title.replace(' 风险处置', '').replace(' 工单预览', '') },
        { label: '优先级', value: statMap.get('处置建议') || statMap.get('风险等级') || '中' },
        { label: '计划窗口', value: statMap.get('计划日期') || '48h内' },
        { label: '联动数据', value: '温度 / 位置 / 维保' },
      ],
      checklist: ['确认资产定位与当前状态', '校验维保等级和备件保障', '生成派工人与验收节点'],
    };
  }

  if (isAlert || isRisk) {
    return {
      status: isRisk ? '策略研判处置' : '告警闭环处置',
      steps: [
        { label: '接入', note: '同步告警、策略和资产上下文' },
        { label: '研判', note: '匹配风险等级与影响范围' },
        { label: '处置', note: '阻断/复核/转工单' },
        { label: '闭环', note: '记录处理结果与复盘动作' },
      ],
      fields: [
        { label: '事件来源', value: preview.source },
        { label: '风险等级', value: statMap.get('等级') || statMap.get('风险分') || '中危' },
        { label: '处置建议', value: statMap.get('处置') || statMap.get('状态') || '复核' },
        { label: '关联单据', value: '自动联动' },
      ],
      checklist: ['核对策略命中与资产归属', '确认是否需要阻断或转派', '沉淀处置日志和复盘结论'],
    };
  }

  if (isInspection) {
    return {
      status: '现场巡检执行',
      steps: [
        { label: '派发', note: '生成点检任务与路线' },
        { label: '扫码', note: '到场核验资产身份' },
        { label: '采集', note: '录入温度/振动/照片' },
        { label: '提交', note: '异常转告警或工单' },
      ],
      fields: [
        { label: '任务范围', value: statMap.get('待巡检') || statMap.get('高温点位') || '当前模块' },
        { label: '异常项', value: statMap.get('异常项') || statMap.get('待确认') || '待核对' },
        { label: '执行人', value: '班组自动分配' },
        { label: '同步方式', value: '移动端回传' },
      ],
      checklist: ['确认点位清单', '校验扫码与现场位置', '异常项自动进入处置队列'],
    };
  }

  if (isSpare) {
    return {
      status: '备件保障联动',
      steps: [
        { label: '识别', note: '关联工单缺件' },
        { label: '校验', note: '库存下限与替代料' },
        { label: '申请', note: '生成领用/采购单' },
        { label: '回写', note: '同步工单成本' },
      ],
      fields: [
        { label: '关联工单', value: statMap.get('关联工单') || '自动带入' },
        { label: '库存状态', value: statMap.get('可用库存') || '待核对' },
        { label: '低储备件', value: statMap.get('低储备件') || '0' },
        { label: '供应策略', value: '优先本仓' },
      ],
      checklist: ['核对备件编码与替代料', '检查库存下限和预计到货', '回写维保工单成本'],
    };
  }

  return {
    status: '业务页面预检',
    steps: [
      { label: '进入', note: '打开目标业务页面' },
      { label: '筛选', note: '带入当前模块上下文' },
      { label: '处理', note: '完成业务动作' },
      { label: '归档', note: '同步状态与报表' },
    ],
    fields: [
      { label: '业务来源', value: preview.source },
      { label: '目标路径', value: preview.routeTarget },
      { label: '当前状态', value: preview.stats[0]?.value || '待处理' },
      { label: '处理方式', value: preview.primaryLabel },
    ],
    checklist: ['确认当前模块上下文', '检查筛选条件是否完整', '进入后保留回到工作台路径'],
  };
}

const overviewModules: Array<{
  index: number;
  title: string;
  summary: string;
  metric: string;
  page: PreviewPage;
  icon: LucideIcon;
  imageSrc: string;
  imagePosition?: string;
}> = [
  {
    index: 2,
    title: '机加设备集群',
    summary: '状态概览',
    metric: '集群在线率 100%',
    page: 'assets',
    icon: Factory,
    imageSrc: moduleAsset('module-machining-cluster'),
  },
  {
    index: 3,
    title: '数据监控中心',
    summary: '核心指标',
    metric: '今日产量 1.2万',
    page: 'analytics',
    icon: BarChart3,
    imageSrc: moduleAsset('module-data-monitoring'),
  },
  {
    index: 4,
    title: '资产运维中心',
    summary: '综合评估',
    metric: '健康指数 86',
    page: 'assets',
    icon: Layers,
    imageSrc: moduleAsset('module-asset-ops'),
  },
  {
    index: 5,
    title: '安全态势工作台',
    summary: '系统评级',
    metric: '安全评分 92',
    page: 'security',
    icon: ShieldCheck,
    imageSrc: securityPostureThumb,
  },
];

const stitchScreens: Array<{
  title: string;
  status: string;
  note: string;
  imageSrc: string;
  page?: WorkbenchPage;
  href?: string;
  linkLabel?: string;
}> = [
  {
    title: '智能制造总览',
    status: '已纳入',
    note: '产线大图、四中心入口与产品总览逻辑',
    imageSrc: stitchAsset('overview'),
    page: 'overview',
  },
  {
    title: '资产运维中心',
    status: '优先复刻',
    note: '健康指数、资产分类、风险 TOP10 与工单闭环',
    imageSrc: stitchAsset('assets'),
    page: 'assets',
  },
  {
    title: '数据监控中心',
    status: '已纳入',
    note: '98.6% 圆环、设备波动、台站统计与异常列表',
    imageSrc: stitchAsset('analytics'),
    page: 'analytics',
  },
  {
    title: '安全态势工作台',
    status: '已纳入',
    note: '深色态势图、安全评分、风险列表与趋势',
    imageSrc: stitchAsset('security'),
    page: 'security',
  },
  {
    title: '设计稿登录页',
    status: '已精修',
    note: '中文 IMAGE2 产品图与真实登录页截图（/login5）',
    imageSrc: stitchAsset('login5-cn'),
    href: '/login5',
    linkLabel: '打开登录页',
  },
  {
    title: '登录页设计稿回归',
    status: '新生成',
    note: '按中文产品图与明确分割线生成 LOGIN5 高保真稿',
    imageSrc: `${assetBase}/stitch-suite/login5-stitch-refresh.png`,
    href: '/login5',
    linkLabel: '打开 LOGIN5',
  },
  {
    title: '完整产品套稿',
    status: '已导出',
    note: '中文策展总稿，覆盖登录、总览、监控、运维与安全态势',
    imageSrc: stitchAsset('contact-sheet-cn-v2'),
    href: '/workspace-preview?tab=stitch',
    linkLabel: '查看总览稿',
  },
  {
    title: '前端路由验收总览',
    status: '真实截图',
    note: 'LOGIN4、LOGIN5、设计稿总览与四个工作台入口的浏览器验收拼图',
    imageSrc: stitchAsset('react-route-audit-sheet'),
    href: '/workspace-preview?tab=stitch',
    linkLabel: '查看验收面板',
  },
  {
    title: '产线产品图',
    status: '资产源',
    note: '后续首页与卡片缩略图的产品图素材',
    imageSrc: stitchAsset('production-line'),
  },
];

const stitchDeliveryChecks: Array<{
  label: string;
  value: string;
  note: string;
  tone: 'ok' | 'warn';
  icon: LucideIcon;
}> = [
  {
    label: '设计来源',
    value: '项目可追溯',
    note: '产品套来源、生成稿与落地路由均已归档',
    tone: 'ok',
    icon: CheckCircle2,
  },
  {
    label: '安全链路',
    value: '受控访问',
    note: '生成、取回与落地均走受控入口，前台不展示凭据',
    tone: 'warn',
    icon: AlertTriangle,
  },
  {
    label: '页面生成',
    value: '登录稿完成',
    note: 'LOGIN5 中文产品图与登录页设计稿已完成回归',
    tone: 'ok',
    icon: ShieldCheck,
  },
  {
    label: '复刻能力',
    value: '能力已就绪',
    note: '设计稿生成、素材取回与本地复刻链路已完成校验',
    tone: 'ok',
    icon: ShieldCheck,
  },
  {
    label: '登录套稿',
    value: '2 屏输出',
    note: '中文产品背景图与 LOGIN5 登录页稿均已归档',
    tone: 'ok',
    icon: Monitor,
  },
  {
    label: '稿件取回',
    value: '截图可审查',
    note: 'LOGIN5 页面稿已取回 HTML 与审查截图',
    tone: 'ok',
    icon: Database,
  },
  {
    label: '本地导出',
    value: '8 屏资产',
    note: '登录、总览、监控、运维、安全态势和总览拼图已落盘',
    tone: 'ok',
    icon: FileText,
  },
  {
    label: '生成基线',
    value: '已对齐',
    note: 'UNIVIEW、无阴影卡片、IMAGE2 产品图与设计稿登录页约束已写入生成基线',
    tone: 'ok',
    icon: Type,
  },
  {
    label: '生成回归',
    value: '已产出',
    note: '中文登录背景图与登录页稿已落盘到交付资产',
    tone: 'ok',
    icon: Zap,
  },
  {
    label: '前端接入',
    value: '6 个入口',
    note: '四个工作台页面与设计稿登录页已纳入当前 demo',
    tone: 'ok',
    icon: CheckCircle2,
  },
];

const stitchAssetCatalog: Array<{
  group: string;
  title: string;
  usage: string;
  status: string;
  imageSrc: string;
}> = [
  {
    group: '主视觉',
    title: '登录中文工厂图',
    usage: 'login5 / 登录页整块产品图',
    status: '已接入',
    imageSrc: login5ProductHero,
  },
  {
    group: '模块图',
    title: '产线总览',
    usage: '首页主视觉 / 总览入口',
    status: '已接入',
    imageSrc: illustrationAsset('production-line-clean'),
  },
  {
    group: '模块图',
    title: '数据监控中心',
    usage: '监控页缩略图 / 总览入口',
    status: '已接入',
    imageSrc: moduleAsset('module-data-monitoring'),
  },
  {
    group: '模块图',
    title: '资产运维中心',
    usage: '资产页缩略图 / 健康评估入口',
    status: '已接入',
    imageSrc: moduleAsset('module-asset-ops'),
  },
  {
    group: '模块图',
    title: '安全态势工作台',
    usage: '安全态势缩略图 / 总览入口',
    status: '已接入',
    imageSrc: securityPostureThumb,
  },
  {
    group: '核心图标',
    title: '资产总数',
    usage: 'KPI 卡片 / 资产分类',
    status: '已接入',
    imageSrc: iconAsset('asset-total'),
  },
  {
    group: '核心图标',
    title: '在线运行',
    usage: 'KPI 卡片 / 在线状态',
    status: '已接入',
    imageSrc: iconAsset('online-running'),
  },
  {
    group: '核心图标',
    title: '维保工单',
    usage: '待维保 / 工单闭环',
    status: '已接入',
    imageSrc: iconAsset('maintenance'),
  },
  {
    group: '状态素材',
    title: '异常预警',
    usage: '告警中心 / 风险列表',
    status: '已接入',
    imageSrc: iconAsset('alarm'),
  },
  {
    group: '健康图',
    title: '资产健康指数环',
    usage: '资产运维中心核心图',
    status: '已接入',
    imageSrc: assetKitV4('asset-health-ring-v2'),
  },
];

const stitchAssetHighlights: Array<{
  title: string;
  note: string;
  badge: string;
  imageSrc: string;
}> = [
  {
    title: '模块缩略图总包',
    note: '首页入口与卡片缩略图统一来源',
    badge: '4 模块',
    imageSrc: `${assetBase}/asset-kit-v4/module-thumbnail-sheet.png`,
  },
  {
    title: '产品图资产预览',
    note: 'KPI、中心图、图标与状态素材总览',
    badge: '资产包',
    imageSrc: `${assetBase}/asset-kit-v4/asset-kit-v4-preview.png`,
  },
  {
    title: '健康指数环',
    note: '资产运维中心核心评分图案',
    badge: '核心图',
    imageSrc: assetKitV4('asset-health-ring-v2'),
  },
];

const stitchDetailAssetCatalog: Array<{
  title: string;
  scenario: string;
  usage: string;
  source: string;
  imageSrc: string;
}> = [
  {
    title: '温度监测',
    scenario: '设备环境 / 异常预警',
    usage: '资产运维中心温度、振动、电流等传感指标',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('temperature-monitoring-v1'),
  },
  {
    title: '位置追踪',
    scenario: '台账定位 / 车间分布',
    usage: '固定资产所在车间、产线、仓位和地图锚点',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('location-tracking-v1'),
  },
  {
    title: '维保等级',
    scenario: '预测维保 / 优先级',
    usage: '高/中/低维保优先级、计划状态和保养动作',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('maintenance-level-v1'),
  },
  {
    title: '资产状态分布',
    scenario: '在线 / 待机 / 故障',
    usage: '运行状态胶囊、状态图例和资产分布统计',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('asset-status-distribution-v1'),
  },
  {
    title: '风险等级标签',
    scenario: '风险 TOP10 / 告警列表',
    usage: '高风险、关注、正常、排名徽标与处置标识',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('risk-level-tags-v1'),
  },
  {
    title: '采集同步延迟',
    scenario: '数据监控 / MES 对接',
    usage: 'IoT 采集、清洗、同步延迟和接口健康状态',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('data-sync-pipeline-v1'),
  },
  {
    title: '备件保障',
    scenario: '维保闭环 / 库存协同',
    usage: '备件库存、缺件提醒、领用申请和采购联动',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('spare-parts-support-v1'),
  },
  {
    title: '健康齿轮',
    scenario: '健康评分 / 指数环',
    usage: '健康指数环外围齿轮、设备健康与评分装饰',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('health-gear-ring-v1'),
  },
  {
    title: '工单流转',
    scenario: '工单管理 / 处置闭环',
    usage: '创建、派发、执行、验收、关闭全流程节点',
    source: 'IMAGE2 已精绘',
    imageSrc: detailAsset('work-order-flow-v1'),
  },
];

function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`workspace-panel ${className}`}>
      {title ? (
        <div className="workspace-panel-head">
          <h2>{title}</h2>
          {action ? <button type="button">{action}</button> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function WorkspaceModuleMock({
  mock,
  onPreviewAction,
}: {
  mock: ModuleMock;
  onPreviewAction: (preview: RouteActionPreview) => void;
}) {
  const Icon = mock.icon;

  return (
    <section className="workspace-module-mock" aria-label={`${mock.title}模块看板`}>
      <div className="workspace-module-mock-visual">
        <img src={mock.visual} alt="" loading="eager" decoding="async" />
        <span>{mock.eyebrow}</span>
      </div>
      <div className="workspace-module-mock-copy">
        <div className="workspace-module-mock-title">
          <IsoIcon icon={Icon} src={mock.visual} alt="" />
          <div>
            <span>{mock.eyebrow}</span>
            <strong>{mock.title}</strong>
          </div>
        </div>
        <p>{mock.summary}</p>
        <div className="workspace-module-mock-stats" aria-label={`${mock.title}关键指标`}>
          {mock.stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="workspace-module-mock-action"
          onClick={() =>
            onPreviewAction({
              title: mock.title,
              source: `${mock.eyebrow}模块入口`,
              routeTarget: mock.routeTarget,
              description: mock.summary,
              primaryLabel: mock.action,
              icon: mock.icon,
              visual: mock.visual,
              stats: mock.stats,
            })
          }
        >
          {mock.action}
          <ArrowRight />
        </button>
      </div>
      <div className="workspace-module-mock-rows" aria-label={`${mock.title}业务清单`}>
        {mock.rows.map((row) => (
          <div key={row.label} className={`is-${row.tone}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.note}</small>
          </div>
        ))}
      </div>
      <div className="workspace-module-mock-flow" aria-label={`${mock.title}流程`}>
        {mock.steps.map((step, index) => (
          <span key={step.label}>
            <em>{String(index + 1).padStart(2, '0')}</em>
            <strong>{step.label}</strong>
            <small>{step.note}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function WorkbenchProductPage({
  item,
  context,
  mock,
  meta,
  onPreviewAction,
}: {
  item: WorkspaceMenuItem;
  context: MenuContext;
  mock: ModuleMock;
  meta: WorkbenchProductPageMeta;
  onPreviewAction: (preview: RouteActionPreview) => void;
}) {
  const Icon = item.icon;
  const [primaryAction, secondaryAction = primaryAction] = meta.actions;
  const PrimaryActionIcon = primaryAction.icon;
  const SecondaryActionIcon = secondaryAction.icon;
  const operations = buildWorkbenchOperations(item, context, meta);
  const filters = meta.filters?.length ? meta.filters : ['全部', ...context.stats.map((stat) => stat.label)];

  return (
    <section className="workspace-product-page" aria-label={`${item.label}产品页`}>
      <div className="workspace-product-hero">
        <div className="workspace-product-copy">
          <span>{mock.eyebrow}</span>
          <h2>{mock.title}</h2>
          <p>{meta.position}</p>
          <small>{mock.summary}</small>
          <figure className="workspace-product-visual-card">
            <img src={meta.imageSrc} alt={`${item.label} IMAGE2 页面级产品图`} loading="eager" decoding="async" />
            <figcaption>
              <strong>{meta.stitchScreen ?? `${item.id}-workbench-screen`}</strong>
              <small>{meta.assetPurpose ?? '页面级 IMAGE2 资产，服务 Workbench 内容区业务操作。'}</small>
            </figcaption>
          </figure>
          <div className="workspace-product-metrics" aria-label={`${item.label}关键指标`}>
            {context.stats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.note}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="workspace-product-console" aria-label={`${item.label}业务操作台`}>
          <div className="workspace-product-console-head">
            <div>
              <IsoIcon icon={Icon} src={meta.imageSrc} alt="" />
              <span>
                <small>业务操作台</small>
                <strong>{mock.title}</strong>
              </span>
            </div>
            <em>实时</em>
          </div>
          <div className="workspace-product-command-row">
            <button type="button" onClick={() => onPreviewAction(primaryAction)}>
              <PrimaryActionIcon />
              <span>{primaryAction.title}</span>
            </button>
            <button type="button" onClick={() => onPreviewAction(secondaryAction)}>
              <SecondaryActionIcon />
              <span>{secondaryAction.title}</span>
            </button>
          </div>
          <div className="workspace-product-filter-row" aria-label={`${item.label}筛选条件`}>
            {filters.map((filter, index) => (
              <span key={filter} className={index === 0 ? 'is-current' : ''}>{filter}</span>
            ))}
          </div>
          <div className="workspace-product-console-list" aria-label={`${item.label}可处理业务队列`}>
            {mock.rows.map((row, index) => {
              const action = meta.actions[index % meta.actions.length];
              return (
                <button key={row.label} type="button" className={`is-${row.tone}`} onClick={() => onPreviewAction(action)}>
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.note}</small>
                  </span>
                  <b>{row.value}</b>
                  <ArrowRight />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="workspace-product-operations" aria-label={`${item.label}CRUD操作矩阵`}>
        {operations.map((operation) => {
          const OperationIcon = operation.icon;
          return (
            <button
              key={operation.kind}
              type="button"
              className={`${operation.tone ? `is-${operation.tone}` : ''}`}
              disabled={!operation.preview}
              onClick={() => {
                if (operation.preview) {
                  onPreviewAction(operation.preview);
                }
              }}
            >
              <OperationIcon />
              <span>
                <small>{operation.kind}</small>
                <strong>{operation.title}</strong>
                <em>{operation.disabledReason ?? operation.description}</em>
              </span>
            </button>
          );
        })}
      </section>

      {meta.lanes?.length || meta.insights?.length ? (
        <section className="workspace-product-ia" aria-label={`${item.label}页面信息架构`}>
          {meta.lanes?.length ? (
            <div className="workspace-product-lanes">
              <div className="workspace-product-panel-head">
                <span>业务泳道</span>
                <strong>可处理</strong>
              </div>
              <div className="workspace-product-lane-grid">
                {meta.lanes.map((lane) => (
                  <button
                    key={lane.label}
                    type="button"
                    className={`is-${lane.tone}`}
                    onClick={() => onPreviewAction(primaryAction)}
                  >
                    <span>{lane.label}</span>
                    <strong>{lane.value}</strong>
                    <small>{lane.note}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {meta.insights?.length ? (
            <div className="workspace-product-insights">
              <div className="workspace-product-panel-head">
                <span>运营洞察</span>
                <strong>带上下文</strong>
              </div>
              <div className="workspace-product-insight-grid">
                {meta.insights.map((insight) => (
                  <div key={insight.label}>
                    <span>{insight.label}</span>
                    <strong>{insight.value}</strong>
                    <small>{insight.note}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="workspace-product-grid">
        <section className="workspace-product-panel workspace-product-list" aria-label={`${item.label}业务承接清单`}>
          <div className="workspace-product-panel-head">
            <span>业务承接</span>
            <strong>真实入口</strong>
          </div>
          {mock.rows.map((row) => (
            <div key={row.label} className={`is-${row.tone}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.note}</small>
            </div>
          ))}
        </section>

        <section className="workspace-product-panel workspace-product-flow" aria-label={`${item.label}流程闭环`}>
          <div className="workspace-product-panel-head">
            <span>流程闭环</span>
            <strong>可追溯</strong>
          </div>
          {mock.steps.map((step, index) => (
            <div key={step.label}>
              <em>{String(index + 1).padStart(2, '0')}</em>
              <span>{step.label}</span>
              <small>{step.note}</small>
            </div>
          ))}
        </section>

        <section className="workspace-product-panel workspace-product-actions" aria-label={`${item.label}页面跳转`}>
          <div className="workspace-product-panel-head">
            <span>关键跳转</span>
            <strong>带上下文</strong>
          </div>
          {meta.actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button key={action.title} type="button" onClick={() => onPreviewAction(action)}>
                <IsoIcon icon={ActionIcon} src={action.visual} alt="" />
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.routeTarget}</small>
                </span>
                <ArrowRight />
              </button>
            );
          })}
        </section>
      </div>

      <section className="workspace-product-states" aria-label={`${item.label}页面状态矩阵`}>
        <article>
          <Archive />
          <span>空态</span>
          <p>{meta.emptyState}</p>
        </article>
        <article>
          <X />
          <span>异常态</span>
          <p>{meta.errorState}</p>
        </article>
        <article>
          <ShieldCheck />
          <span>无权限态</span>
          <p>{meta.deniedState}</p>
        </article>
      </section>
    </section>
  );
}

function IsoIcon({
  icon: Icon,
  accent = 'blue',
  src,
  alt = '',
}: {
  icon?: LucideIcon;
  accent?: Accent;
  src?: string;
  alt?: string;
}) {
  return (
    <div className={`workspace-iso-icon workspace-iso-${accent} ${src ? 'workspace-iso-image' : ''}`} aria-hidden={alt ? undefined : true}>
      {src ? <img src={src} alt={alt} loading="eager" decoding="async" /> : (
        <>
          <span />
          <i />
          {Icon ? <Icon /> : null}
        </>
      )}
    </div>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  return (
    <article className={`workspace-kpi-card workspace-kpi-${item.accent}`}>
      <div className="workspace-kpi-copy">
        <span>{item.label}</span>
        <strong>
          {item.value}
          {item.unit ? <em>{item.unit}</em> : null}
        </strong>
        <small>
          {item.note} <b>{item.trend}</b>
        </small>
      </div>
      <IsoIcon icon={item.icon} accent={item.accent} src={item.visual} alt="" />
    </article>
  );
}

function HealthRing() {
  return (
    <div className="workspace-health-ring" aria-label="资产健康指数 86">
      <img
        className="workspace-health-ring-asset"
        src={assetKitV4('asset-health-ring-v2')}
        alt=""
        loading="eager"
        decoding="async"
      />
      <div className="workspace-ring-core">
        <span className="workspace-ring-core-gear" aria-hidden="true">
          <Settings />
        </span>
        <strong>86</strong>
        <span>健康指数</span>
        <em>良好</em>
      </div>
    </div>
  );
}

function AssetCategoryList() {
  return (
    <Panel title="资产分类统计" action="全部">
      <div className="workspace-category-list">
        {assetCategories.map((item) => (
          <div key={item.label} className="workspace-category-row">
            <IsoIcon icon={item.icon} src={item.visual} alt="" />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LocationTree() {
  return (
    <Panel title="车间/产线分布" action="全部">
      <div className="workspace-location-tree">
        {locationTree.map(([label, value], index) => (
          <div
            key={label}
            className={`workspace-location-row workspace-location-depth-${index === 0 ? 0 : index < 5 ? 1 : 0}`}
          >
            <MapPin />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HealthPanel() {
  return (
    <Panel title="资产健康指数（风险综合评估）" action="详情" className="workspace-health-panel">
      <HealthRing />
      <div className="workspace-health-trend">
        <span>较上月</span>
        <strong>▲ 6</strong>
      </div>
      <div className="workspace-health-scope" aria-label="健康评估维度">
        {['在线', '位置', '温度', '维保', '告警'].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="workspace-health-metrics">
        {healthMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="workspace-health-metric">
              <Icon />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </div>
          );
        })}
      </div>
      <div className="workspace-health-signal-strip" aria-label="资产健康信号">
        {assetHealthSignals.map(([label, value, note, tone, visual]) => (
          <div key={label} className={`workspace-health-signal is-${tone}`}>
            <img className="workspace-detail-thumb" src={visual} alt="" loading="lazy" />
            <div className="workspace-signal-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="workspace-risk-forecast">
        <div>
          <span>预测风险（未来7天）</span>
          <strong>中风险设备&nbsp;&nbsp;12 台</strong>
          <small>占比 1.2%</small>
        </div>
        <svg viewBox="0 0 170 54" role="img" aria-label="预测风险趋势">
          <path d="M2 34 C20 14 35 38 50 24 C64 12 78 12 93 29 C108 43 120 43 138 14 C150 2 160 4 168 8" />
        </svg>
      </div>
    </Panel>
  );
}

function RiskTopPanel({ onPreviewAction }: { onPreviewAction: (preview: RouteActionPreview) => void }) {
  return (
    <Panel title="高风险资产 TOP10" action="全部">
      <div className="workspace-risk-table">
        <div className="workspace-risk-head">
          <span>排名</span>
          <span>资产名称</span>
          <span>风险指数</span>
        </div>
        {riskAssets.map((item) => (
          <button
            key={item.name}
            type="button"
            className="workspace-risk-row"
            data-preview-kind="asset-risk"
            onClick={() =>
              onPreviewAction({
                title: `${item.name} 风险处置`,
                source: '高风险资产 TOP10',
                routeTarget: buildWorkOrderPrefillPath({
                  source: 'asset-risk',
                  title: `${item.name}${item.state}风险处置工单`,
                  assetName: item.name,
                  assetLocation: item.location,
                  riskState: item.state,
                  riskScore: item.risk,
                  priority: item.risk >= 90 ? 'CRITICAL' : item.risk >= 85 ? 'HIGH' : 'MEDIUM',
                  dueDate: item.risk >= 90 ? '2026-06-15' : '2026-06-16',
                  description: `来自高风险资产 TOP10：${item.location} 出现「${item.state}」，风险指数 ${item.risk} 分。建议结合温度、位置、维保等级和风险标签生成预测维保工单，并安排现场复核。`,
                }),
                description: `${item.location} 出现「${item.state}」，建议结合温度、位置、维保等级和风险标签生成预测维保工单。`,
                primaryLabel: '生成工单',
                icon: Wrench,
                visual: detailAsset('risk-level-tags-v1'),
                stats: [
                  { label: '风险指数', value: String(item.risk), note: '分' },
                  { label: '当前排名', value: String(item.rank), note: 'TOP10' },
                  { label: '处置建议', value: item.risk >= 85 ? '高' : '中', note: '优先级' },
                ],
              })
            }
          >
            <em>{item.rank}</em>
            <span className="workspace-risk-device">
              <b>{item.name}</b>
              <small>{item.location} · {item.state}</small>
            </span>
            <strong>{item.risk}</strong>
          </button>
        ))}
      </div>
      <div className="workspace-risk-action-strip" aria-label="风险处置建议">
        {assetRiskActions.map(([label, value, action, tone, visual]) => (
          <div key={label} className={`workspace-risk-action is-${tone}`}>
            <img className="workspace-detail-thumb" src={visual} alt="" loading="lazy" />
            <div className="workspace-signal-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{action}</small>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WorkOrderPanel({ onPreviewAction }: { onPreviewAction: (preview: RouteActionPreview) => void }) {
  return (
    <Panel title="预测维保工单" action="全部">
      <div className="workspace-workorder-hero">
        <img src={detailAsset('work-order-flow-v1')} alt="" loading="lazy" />
        <div>
          <span>工单闭环</span>
          <strong>预测 · 派单 · 执行 · 验收</strong>
          <small>联动维保等级、风险标签和备件保障</small>
        </div>
      </div>
      <div className="workspace-workorder-list">
        {workOrders.map((item) => (
          <button
            key={item.code}
            type="button"
            data-preview-kind="workorder"
            onClick={() =>
              onPreviewAction({
                title: `${item.code} 工单预览`,
                source: '预测维保工单',
                routeTarget: buildWorkOrderPrefillPath({
                  source: 'predictive-maintenance',
                  title: `${item.asset}${item.action}预测维保工单`,
                  assetName: item.asset,
                  riskLevel: item.risk,
                  action: item.action,
                  dueDate: item.date,
                  priority: item.risk.includes('中') ? 'HIGH' : item.risk.includes('低') ? 'MEDIUM' : 'LOW',
                  workOrder: item.code,
                  description: `承接预测维保工单 ${item.code}：${item.asset} 需要执行「${item.action}」，计划日期 ${item.date}。进入后可直接安排派工、备件准备和验收闭环。`,
                }),
                description: `${item.asset} 需要执行「${item.action}」，计划日期 ${item.date}，进入后可查看派工、备件和验收闭环。`,
                primaryLabel: '生成派工单',
                icon: ClipboardList,
                visual: detailAsset('work-order-flow-v1'),
                stats: [
                  { label: '风险等级', value: item.risk, note: '当前' },
                  { label: '计划日期', value: item.date.slice(5), note: '本年' },
                  { label: '执行动作', value: item.action.slice(0, 4), note: '摘要' },
                ],
              })
            }
          >
            <span className="workspace-workorder-main">
              <b>{item.code}</b>
              <small>{item.asset} · {item.action}</small>
            </span>
            <strong className={`workspace-workorder-${item.status}`}>{item.risk}</strong>
            <em>{item.date}</em>
          </button>
        ))}
      </div>
      <div className="workspace-workorder-flow" aria-label="预测维保闭环">
        {workOrderFlowSteps.map(([label, value], index) => (
          <span key={label}>
            <em>{index + 1}</em>
            <strong>{label}</strong>
            <small>{value}</small>
          </span>
        ))}
      </div>
      <div className="workspace-workorder-summary">
        <span>本周计划</span>
        <strong>24</strong>
        <small>自动派单 18 / 待确认 6</small>
      </div>
    </Panel>
  );
}

function DonutChart() {
  return (
    <div className="workspace-donut">
      <div>
        <strong>6,842</strong>
        <span>总数</span>
      </div>
    </div>
  );
}

function LineChart({ variant = 'temp' }: { variant?: 'temp' | 'vibration' }) {
  const pathA =
    variant === 'temp'
      ? 'M0 54 C18 16 38 26 54 48 C70 70 85 68 106 38 C126 8 141 15 176 52 C190 65 206 46 220 31'
      : 'M0 62 C22 44 37 17 55 36 C72 54 88 62 107 47 C124 34 141 29 167 45 C185 56 202 47 220 34';
  const pathB =
    variant === 'temp'
      ? 'M0 76 C20 54 35 72 58 58 C78 45 90 30 118 57 C138 75 154 72 178 41 C193 22 207 38 220 52'
      : 'M0 78 C26 70 41 52 63 66 C82 78 101 84 124 63 C139 50 156 52 182 70 C197 80 209 70 220 58';

  return (
    <svg className="workspace-line-visual" viewBox="0 0 220 100" role="img" aria-label="趋势图">
      <path d={pathA} />
      <path d={pathB} />
      <path d="M0 82 C24 60 48 74 70 63 C92 52 114 39 142 59 C158 70 178 82 220 70" />
    </svg>
  );
}

function BarChart() {
  const bars = [62, 88, 74, 96, 66, 82, 70, 92, 68, 104, 58, 80];
  return (
    <div className="workspace-bars" aria-label="柱状图">
      {bars.map((bar, index) => (
        <span key={`${bar}-${index}`} style={{ height: `${bar}%` }} />
      ))}
    </div>
  );
}

function ProgressChart() {
  return (
    <div className="workspace-progress-card">
      <strong>92.6<small>%</small></strong>
      <span>较上月 ▲ 6.3%</span>
      {[
        ['已完成', 248, 92],
        ['已派发', 229, 82],
        ['进行中', 12, 24],
        ['未开始', 7, 14],
      ].map(([label, value, pct]) => (
        <div key={label}>
          <em>{label}</em>
          <i><b style={{ width: `${pct}%` }} /></i>
          <small>{value}</small>
        </div>
      ))}
    </div>
  );
}

function WorkStateChart() {
  return (
    <div className="workspace-work-chart">
      <DonutChart />
      <ul>
        <li><span />已完成 256</li>
        <li><span />进行中 98</li>
        <li><span />待审批 37</li>
        <li><span />已取消 30</li>
      </ul>
    </div>
  );
}

function SparesPanel() {
  const rows = [
    ['液压油滤芯', '3', '5'],
    ['轴承 6205', '6', '10'],
    ['皮带 B-320', '2', '5'],
    ['接触器 CJX2', '1', '3'],
    ['传感器 PT100', '4', '8'],
  ];
  return (
    <div className="workspace-spares">
      <div className="workspace-spares-hero">
        <img src={detailAsset('spare-parts-support-v1')} alt="" loading="lazy" />
        <div>
          <span>备件保障</span>
          <strong>18 项低储预警</strong>
          <small>领用、采购和维保工单联动</small>
        </div>
      </div>
      {rows.map(([name, stock, min]) => (
        <div key={name}>
          <span>{name}</span>
          <em>库存 <b>{stock}</b></em>
          <strong>低于最小库存 {min}</strong>
        </div>
      ))}
    </div>
  );
}

function SecurityPosturePanel({ onOpenBigScreen }: { onOpenBigScreen: () => void }) {
  return (
    <Panel title="安全态势总览" className="workspace-security-visual-panel">
      <a
        href="/bigscreen-3d"
        className="workspace-security-visual"
        onClick={(event) => {
          event.preventDefault();
          onOpenBigScreen();
        }}
        aria-label="查看安全态势大屏"
      >
        <img src={securityPostureMapWide} alt="" loading="eager" decoding="async" />
        <div className="workspace-security-scan" aria-hidden />
        <div className="workspace-security-corners" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="workspace-security-chip workspace-security-chip-left">
          <span>处置闭环</span>
          <strong>91.8%</strong>
        </div>
        <div className="workspace-security-score-card">
          <span>安全评分</span>
          <strong>92<em>/100</em></strong>
          <small>较昨日 +3.2%</small>
        </div>
        <span className="workspace-security-open-screen">
          <Maximize2 />
          查看安全态势大屏
        </span>
      </a>
      <div className="workspace-security-signal-grid">
        {securitySignals.map(([label, value, tone, visual]) => (
          <div key={label} className={`workspace-security-signal workspace-security-signal-${tone}`}>
            <img className="workspace-detail-thumb" src={visual} alt="" loading="lazy" />
            <div className="workspace-signal-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="workspace-security-flow" aria-label="安全处置状态">
        <span>发现</span>
        <i />
        <span>研判</span>
        <i />
        <span>处置</span>
        <i />
        <span>闭环</span>
      </div>
      <div className="workspace-security-product-tiles" aria-label="安全态势配套产品图">
        {securityProductTiles.map(([title, note, visual]) => (
          <div key={title}>
            <img src={visual} alt="" loading="eager" decoding="async" />
            <span>{title}</span>
            <strong>{note}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DataMonitoringPanel() {
  return (
    <Panel title="数据监控驾驶舱" action="实时" className="workspace-data-visual-panel">
      <div className="workspace-data-visual">
        <img src={moduleAsset('module-data-monitoring')} alt="" loading="eager" decoding="async" />
        <div className="workspace-data-scanline" aria-hidden />
        <div className="workspace-data-live-card">
          <span>数据管道</span>
          <strong>98.6%</strong>
          <small>设备采集在线率</small>
          <i />
        </div>
      </div>
      <div className="workspace-data-signal-row">
        {dataSignals.map(([label, value, note, tone]) => (
          <div key={label} className={`workspace-data-signal is-${tone}`}>
            <i aria-hidden />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="workspace-data-pipeline" aria-label="数据链路状态">
        {dataPipelineSteps.map(([label, value, state, tone, visual]) => (
          <div key={label} className={`workspace-data-pipeline-step is-${tone}`}>
            <img className="workspace-detail-thumb" src={visual} alt="" loading="eager" decoding="async" />
            <div className="workspace-signal-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{state}</small>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DataHealthScorePanel() {
  return (
    <Panel title="数据健康评分" className="workspace-data-score-panel">
      <div className="workspace-data-score-shell">
        <div className="workspace-data-score-orbit" aria-label="数据健康评分 123522">
          <i className="workspace-data-score-gridline" aria-hidden />
          <i className="workspace-data-score-sweep" aria-hidden />
          <i className="workspace-data-score-ring ring-a" aria-hidden />
          <i className="workspace-data-score-ring ring-b" aria-hidden />
          <i className="workspace-data-score-ring ring-c" aria-hidden />
          <span className="workspace-data-score-marker marker-mes" aria-hidden>
            <b>MES</b>
            <em>99.2%</em>
          </span>
          <span className="workspace-data-score-marker marker-iot" aria-hidden>
            <b>IoT</b>
            <em>98.6%</em>
          </span>
          <span className="workspace-data-score-marker marker-sync" aria-hidden>
            <b>同步</b>
            <em>95.2ms</em>
          </span>
          <span className="workspace-data-score-dot dot-a" aria-hidden />
          <span className="workspace-data-score-dot dot-b" aria-hidden />
          <span className="workspace-data-score-dot dot-c" aria-hidden />
          <div className="workspace-data-score-core">
            <strong>123,522</strong>
            <span>综合健康评分</span>
            <em>良好</em>
          </div>
        </div>
        <div className="workspace-data-score-metrics" aria-label="数据质量分项">
          <div>
            <span>采集完整</span>
            <strong>99.2%</strong>
            <small>MES / IoT</small>
          </div>
          <div>
            <span>同步准点</span>
            <strong>95.2ms</strong>
            <small>平均延迟</small>
          </div>
          <div>
            <span>清洗通过</span>
            <strong>98.8%</strong>
            <small>规则校验</small>
          </div>
        </div>
        <div className="workspace-data-score-scale" aria-label="数据健康等级">
          <span>异常</span>
          <i aria-hidden />
          <span>稳定</span>
          <i aria-hidden />
          <span>优秀</span>
        </div>
      </div>
    </Panel>
  );
}

function AssetOpsPosturePanel() {
  return (
    <Panel title="资产运维态势" action="MES同步" className="workspace-asset-visual-panel">
      <div className="workspace-asset-visual-layout">
        <div className="workspace-asset-visual-shot">
          <img src={moduleAsset('module-asset-ops')} alt="" loading="lazy" />
          <div className="workspace-asset-floating-tag workspace-asset-floating-online">
            <span>运行在线</span>
            <strong>98.5%</strong>
          </div>
          <div className="workspace-asset-floating-tag workspace-asset-floating-maintenance">
            <span>待派单</span>
            <strong>24</strong>
          </div>
        </div>
        <div className="workspace-asset-ops-card">
          <span>资产运维中心</span>
          <strong>86<em>健康指数</em></strong>
          <p>联动 MES 采集资产状态、所在位置、温度、维保工单与异常告警，形成资产全生命周期运维闭环。</p>
          <div>
            <small>今日同步</small>
            <b>18,420</b>
          </div>
          <div>
            <small>异常闭环</small>
            <b>91.8%</b>
          </div>
        </div>
      </div>
      <div className="workspace-asset-signal-grid">
        {assetOpsSignals.map(([label, value, note, tone, visual]) => (
          <div key={label} className={`workspace-asset-signal workspace-asset-signal-${tone}`}>
            <img className="workspace-detail-thumb" src={visual} alt="" loading="lazy" />
            <div className="workspace-signal-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="workspace-asset-life-track" aria-label="资产生命周期闭环">
        {assetLifecycleSteps.map(([phase, label, value], index) => (
          <span key={phase}>
            <em>{index + 1}</em>
            <strong>{phase}</strong>
            <small>{label}</small>
            <b>{value}</b>
          </span>
        ))}
      </div>
    </Panel>
  );
}

function ChartPanel({ card }: { card: ChartCard }) {
  return (
    <Panel title={card.title} className="workspace-chart-panel">
      {card.type === 'donut' ? <DonutChart /> : null}
      {card.type === 'line' ? <LineChart variant={card.title.includes('振动') ? 'vibration' : 'temp'} /> : null}
      {card.type === 'bars' ? <BarChart /> : null}
      {card.type === 'progress' ? <ProgressChart /> : null}
      {card.type === 'work' ? <WorkStateChart /> : null}
      {card.type === 'spares' ? <SparesPanel /> : null}
    </Panel>
  );
}

function ModulePreview({
  page,
  title,
  desc,
  icon: Icon,
  imageSrc,
  onSelect,
}: {
  page: PreviewPage;
  title: string;
  desc: string;
  icon: LucideIcon;
  imageSrc: string;
  onSelect: (page: PreviewPage) => void;
}) {
  return (
    <button type="button" className={`workspace-module-preview workspace-module-${page}`} onClick={() => onSelect(page)}>
      <div className="workspace-module-title">
        <IsoIcon icon={Icon} src={page === 'security' ? iconAsset('alarm') : iconAsset('report-bars')} alt="" />
        <div>
          <strong>{title}</strong>
          <span>{desc}</span>
        </div>
      </div>
      <img className="workspace-module-shot" src={imageSrc} alt="" loading="eager" decoding="async" />
    </button>
  );
}

function OverviewTitle({ index, title }: { index: number; title: string }) {
  return (
    <div className="workspace-overview-title">
      <em>{index}</em>
      <h2>{title}</h2>
    </div>
  );
}

function OverviewModuleCard({
  item,
  onSelect,
}: {
  item: (typeof overviewModules)[number];
  onSelect: (page: PreviewPage) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={`workspace-overview-module workspace-overview-module-${item.page}`}
      onClick={() => onSelect(item.page)}
    >
      <OverviewTitle index={item.index} title={item.title} />
      <span className="workspace-overview-module-icon" aria-hidden="true">
        <Icon />
      </span>
      <img src={item.imageSrc} alt="" loading="eager" decoding="async" />
      <div className="workspace-overview-module-meta">
        <span>{item.summary}</span>
        <strong>{item.metric}</strong>
      </div>
    </button>
  );
}

function StitchSuiteDashboard() {
  return (
    <section className="workspace-stage workspace-stage-stitch" aria-label="设计复刻总览">
      <section className="workspace-stitch-hero">
        <div className="workspace-stitch-hero-copy">
          <span>产品套设计稿</span>
          <h2>设计复刻总览</h2>
          <p>首批产品套页面已形成设计资产、截图资产和路由入口，作为当前前端 demo 的复刻来源。</p>
          <div className="workspace-stitch-stats" aria-label="设计稿状态">
            <span>
              <strong>8</strong>
              设计稿
            </span>
            <span>
              <strong>6</strong>
              页面稿
            </span>
            <span>
              <strong>5</strong>
              已接入入口
            </span>
          </div>
        </div>
        <img src={stitchAsset('contact-sheet-cn-v2')} alt="UNIVIEW 固定资产产品套复刻总稿" loading="eager" decoding="async" />
      </section>

      <section className="workspace-stitch-delivery" aria-label="设计交付链路">
        {stitchDeliveryChecks.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`workspace-stitch-delivery-card is-${item.tone}`}>
              <span>
                <Icon />
              </span>
              <div>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
                <p>{item.note}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="workspace-stitch-grid" aria-label="页面设计稿">
        {stitchScreens.map((screen) => (
          <article key={screen.title} className="workspace-stitch-card">
            <div className="workspace-stitch-card-head">
              <div>
                <strong>{screen.title}</strong>
                <span>{screen.note}</span>
              </div>
              <em>{screen.status}</em>
            </div>
            <img src={screen.imageSrc} alt={`${screen.title} 设计稿`} loading="eager" decoding="async" />
            {screen.page ? (
              <>
                <small className="workspace-stitch-route">{buildWorkbenchPagePath(screen.page)}</small>
                <a href={buildWorkbenchPagePath(screen.page)}>
                  进入正式路由
                </a>
              </>
            ) : null}
            {screen.href ? (
              <a href={screen.href}>
                {screen.linkLabel ?? '打开页面'}
              </a>
            ) : null}
          </article>
        ))}
      </section>

      <section className="workspace-stitch-assets" aria-label="产品图资产包">
        <div className="workspace-stitch-assets-copy">
          <span>产品图资产包</span>
          <h2>产品图与模块缩略图资产包</h2>
          <p>用于卡片图案、中心入口和后续逐页高保真复刻，保持 UNIVIEW 固定资产产品线统一视觉。</p>
        </div>
        {stitchAssetHighlights.map((asset) => (
          <figure key={asset.title} className="workspace-stitch-asset-figure">
            <img src={asset.imageSrc} alt={`${asset.title}产品图资产`} loading="eager" decoding="async" />
            <figcaption>
              <strong>{asset.title}</strong>
              <small>{asset.note}</small>
            </figcaption>
            <em>{asset.badge}</em>
          </figure>
        ))}
      </section>

      <section className="workspace-stitch-catalog" aria-label="统一产品图与图标资产清单">
        <div className="workspace-stitch-catalog-head">
          <span>视觉资产清单</span>
          <h2>统一产品图、模块图与卡片图标</h2>
          <p>按页面用途沉淀主视觉、中心缩略图、指标图标和健康指数环，后续 Stitch 复刻与 React 落地都以这套资产为准。</p>
        </div>
        <div className="workspace-stitch-catalog-grid">
          {stitchAssetCatalog.map((asset) => (
            <article key={`${asset.group}-${asset.title}`} className="workspace-stitch-catalog-card">
              <img src={asset.imageSrc} alt={`${asset.title}视觉资产`} loading="eager" decoding="async" />
              <div>
                <span>{asset.group}</span>
                <strong>{asset.title}</strong>
                <small>{asset.usage}</small>
              </div>
              <em>{asset.status}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-stitch-detail-assets" aria-label="业务细分图标资产清单">
        <div className="workspace-stitch-catalog-head">
          <span>细分状态资产</span>
          <h2>二期 MES 与资产运维细分图标</h2>
          <p>九类细分状态素材已按统一产品图风格沉淀，覆盖二期 MES 对接、资产运维、维保闭环和安全态势，可直接用于 Stitch 复刻与 React 落地。</p>
        </div>
        <div className="workspace-stitch-detail-grid">
          {stitchDetailAssetCatalog.map((asset) => (
            <article key={asset.title} className="workspace-stitch-detail-card">
              <img src={asset.imageSrc} alt={`${asset.title}业务细分资产`} loading="eager" decoding="async" />
              <div>
                <span>{asset.scenario}</span>
                <strong>{asset.title}</strong>
                <small>{asset.usage}</small>
              </div>
              <em>{asset.source}</em>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function OverviewDashboard({ onSelectPage }: { onSelectPage: (page: PreviewPage) => void }) {
  return (
    <section className="workspace-stage workspace-stage-overview" aria-label="智能制造总览">
      <section className="workspace-kpis workspace-overview-kpis" aria-label="产线关键指标">
        {overviewKpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <section className="workspace-overview-hero">
        <OverviewTitle index={1} title="产线总览" />
        <div className="workspace-overview-scene">
          <img src={illustrationAsset('production-line-clean')} alt="" loading="lazy" />
          {overviewSceneMarkers.map(([label, value, tone, position]) => (
            <div key={label} className={`workspace-overview-marker workspace-overview-marker-${tone} ${position}`}>
              <span aria-hidden="true" />
              <div>
                <strong>{label}</strong>
                <em>{value}</em>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-overview-grid" aria-label="核心中心入口">
        {overviewModules.map((item) => (
          <OverviewModuleCard key={item.title} item={item} onSelect={onSelectPage} />
        ))}
      </section>
    </section>
  );
}

function AssetDashboard({
  onSelectPage,
  onOpenRoute,
  onPreviewAction,
  isWorkbenchRoute,
}: {
  onSelectPage: (page: PreviewPage) => void;
  onOpenRoute: (routeTarget: string) => void;
  onPreviewAction: (preview: RouteActionPreview) => void;
  isWorkbenchRoute: boolean;
}) {
  const visibleChartCards = isWorkbenchRoute ? chartCards.slice(0, 4) : chartCards;

  return (
    <section className="workspace-stage workspace-stage-assets" aria-label="资产运维中心">
      <section className="workspace-kpis" aria-label="资产关键指标">
        {assetKpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <section className="workspace-asset-grid">
        <div className="workspace-left-column">
          <AssetCategoryList />
          <LocationTree />
        </div>
        <HealthPanel />
        <div className="workspace-right-column">
          <RiskTopPanel onPreviewAction={onPreviewAction} />
          <WorkOrderPanel onPreviewAction={onPreviewAction} />
        </div>
      </section>

      <AssetOpsPosturePanel />

      <section className="workspace-chart-grid" aria-label="资产运维分析图表">
        {visibleChartCards.map((card) => (
          <ChartPanel key={card.title} card={card} />
        ))}
      </section>

      <section className="workspace-quick-panel" aria-label="快捷入口">
        <h2>快捷入口</h2>
        <div>
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.label}
                data-route-target={item.target}
                onClick={() => onOpenRoute(item.target)}
              >
                <IsoIcon icon={Icon} src={item.visual} alt="" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!isWorkbenchRoute ? (
        <>
          <section className="workspace-module-previews" aria-label="其他工作台预览">
            <ModulePreview
              page="security"
              title="安全态势工作台"
              desc="安全风险全局感知与防控"
              icon={ShieldCheck}
              imageSrc={securityPostureThumb}
              onSelect={onSelectPage}
            />
            <ModulePreview
              page="analytics"
              title="数据监控中心"
              desc="设备与产线数据实时监控"
              icon={BarChart3}
              imageSrc={moduleAsset('module-data-monitoring')}
              onSelect={onSelectPage}
            />
          </section>

          <section className="workspace-value-band" aria-label="产品价值">
            <h2>为制造企业打造智能资产运维新体验</h2>
            <div>
              {[
                ['全资产可视化', '资产台账、运行状态、健康度一屏掌握', FileText, iconAsset('asset-total')],
                ['智能预警预测', '多维数据建模分析提前发现潜在风险', ShieldCheck, iconAsset('alarm')],
                ['运维高效协同', '工单、巡检、计划闭环管理提升执行效率', ClipboardList, iconAsset('work-order')],
                ['数据驱动决策', '多维指标趋势分析看板辅助管理优化', BarChart3, iconAsset('report-bars')],
                ['降本增效可控', '减少停机损失降低运维成本', PackageCheck, iconAsset('spare-stock')],
              ].map(([title, desc, Icon, visual]) => (
                <article key={title}>
                  <IsoIcon icon={Icon as LucideIcon} src={visual as string} alt="" />
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}

function SecurityDashboard({
  onPreviewAction,
  onOpenBigScreen,
}: {
  onPreviewAction: (preview: RouteActionPreview) => void;
  onOpenBigScreen: () => void;
}) {
  return (
    <section className="workspace-stage workspace-stage-compact workspace-stage-security" aria-label="安全态势工作台">
      <section className="workspace-kpis">
        {securityKpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>
      <section className="workspace-compact-grid">
        <Panel title="攻击面综合安全指数" className="workspace-big-score">
          <div className="workspace-score-orb">
            <img src={detailAsset('health-gear-ring-v1')} alt="" aria-hidden="true" loading="eager" decoding="async" />
            <strong>98.6%</strong>
            <span>安全评分</span>
          </div>
          <div className="workspace-security-composition" aria-label="攻击面风险构成">
            {securityCompositionRows.map(([label, value, ratio, tone]) => (
              <div key={label} className={`workspace-security-composition-row is-${tone}`}>
                <span>{label}</span>
                <strong>{value}</strong>
                <em>{ratio}</em>
                <i aria-hidden="true" style={{ '--ratio': ratio } as CSSProperties} />
              </div>
            ))}
          </div>
        </Panel>
        <SecurityPosturePanel onOpenBigScreen={onOpenBigScreen} />
        <Panel title="主机攻击面风险 TOP10">
          <div className="workspace-security-risk-list">
            {securityRiskRows.map(([rank, host, ip, issue, score]) => (
              <button
                key={`${host}-${ip}`}
                type="button"
                data-preview-kind="security-risk"
                onClick={() =>
                  onPreviewAction({
                    title: `${host} 主机风险`,
                    source: '主机攻击面风险 TOP10',
                    routeTarget: `/risk-matrix?host=${encodeURIComponent(host)}&ip=${encodeURIComponent(ip)}`,
                    description: `${ip} 命中「${issue}」风险，建议进入策略规则查看暴露面、阻断事件和联动工单。`,
                    primaryLabel: '查看策略',
                    icon: ShieldCheck,
                    visual: detailAsset('risk-level-tags-v1'),
                    stats: [
                      { label: '风险分', value: score, note: '当前' },
                      { label: '排名', value: rank, note: 'TOP10' },
                      { label: '处置', value: Number(score) >= 88 ? '阻断' : '复核', note: '建议' },
                    ],
                  })
                }
              >
                <em>{rank}</em>
                <span>
                  <b>{host}</b>
                  <small>{ip} · {issue}</small>
                </span>
                <strong>{score}</strong>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="安全告警处置">
          <div className="workspace-security-event-list">
            {securityEventRows.map(([name, level, time]) => (
              <button
                key={name}
                type="button"
                data-preview-kind="security-event"
                onClick={() =>
                  onPreviewAction({
                    title: `${name} 告警处置`,
                    source: '安全告警处置',
                    routeTarget: buildAlertPrefillPath({
                      source: 'security-event',
                      title: `${name} 告警处置`,
                      eventName: name,
                      severity: level,
                      occurredAt: time,
                      state: level === '高危' ? '待阻断' : '待复核',
                      suggestedAction: level === '高危' ? '先阻断策略命中资产，再转派复核工单。' : '核对策略命中范围并记录处置意见。',
                      description: `${name} 于 ${time} 触发 ${level} 告警，进入后可查看研判记录、处置动作和闭环工单。`,
                    }),
                    description: `${name} 于 ${time} 触发 ${level} 告警，进入后可查看研判记录、处置动作和闭环工单。`,
                    primaryLabel: '处理告警',
                    icon: Bell,
                    visual: detailAsset('work-order-flow-v1'),
                    stats: [
                      { label: '等级', value: level, note: '当前' },
                      { label: '时间', value: time.slice(11, 16), note: '触发' },
                      { label: '闭环', value: level === '高危' ? '待' : '中', note: '状态' },
                    ],
                  })
                }
              >
                <span>{name}</span>
                <strong className={`workspace-security-level-${level === '高危' ? 'high' : level === '中危' ? 'middle' : 'low'}`}>
                  {level}
                </strong>
                <em>{time}</em>
              </button>
            ))}
          </div>
          <div className="workspace-security-closure-card" aria-label="安全告警闭环进度">
            <div>
              <span>闭环进度</span>
              <strong>91.8%</strong>
              <small>本日处置 27 · 待确认 4</small>
            </div>
            <i aria-hidden="true" style={{ '--progress': '91.8%' } as CSSProperties}>
              <b />
            </i>
          </div>
          <div className="workspace-security-process-strip" aria-label="安全告警处置阶段">
            {[
              ['01', '发现', '自动聚合'],
              ['02', '研判', '策略命中'],
              ['03', '处置', '阻断转派'],
              ['04', '闭环', '工单回写'],
            ].map(([step, label, note]) => (
              <span key={label}>
                <em>{step}</em>
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
            ))}
          </div>
        </Panel>
      </section>
    </section>
  );
}

function AnalyticsDashboard({ onPreviewAction }: { onPreviewAction: (preview: RouteActionPreview) => void }) {
  return (
    <section className="workspace-stage workspace-stage-compact workspace-stage-analytics" aria-label="数据监控中心">
      <section className="workspace-kpis">
        {analyticsKpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>
      <section className="workspace-compact-grid workspace-analytics-grid">
        <DataHealthScorePanel />
        <DataMonitoringPanel />
        <Panel title="设备实时波动">
          <LineChart variant="vibration" />
          <div className="workspace-chart-legend" aria-label="设备实时波动图例">
            <span><i className="is-blue" />采集吞吐</span>
            <span><i className="is-cyan" />网关在线</span>
            <span><i className="is-gold" />异常波动</span>
          </div>
        </Panel>
        <Panel title="台站运行统计">
          <BarChart />
          <div className="workspace-bar-summary" aria-label="台站运行统计摘要">
            <span>12 台站</span>
            <strong>98.6%</strong>
            <small>平均在线</small>
          </div>
        </Panel>
        <Panel title="异常告警实时列表">
          <div className="workspace-monitor-alert-list">
            {dataExceptionRows.map(([code, title, source, state, tone]) => (
              <button
                key={code}
                type="button"
                className={`workspace-monitor-alert-row is-${tone}`}
                data-preview-kind="data-alert"
                onClick={() =>
                  onPreviewAction({
                    title: `${code} ${title}`,
                    source: '异常告警实时列表',
                    routeTarget: buildAlertPrefillPath({
                      source: 'data-alert',
                      title: `${code} ${title}`,
                      alertCode: code,
                      eventName: title,
                      severity: state,
                      assetName: source,
                      state,
                      suggestedAction: '联动 MES 记录、采集链路和处置日志，确认是否需要转工单。',
                      description: `${source} 出现「${title}」，当前状态为「${state}」，进入后可联动 MES 记录、采集链路和处置日志。`,
                    }),
                    description: `${source} 出现「${title}」，当前状态为「${state}」，进入后可联动 MES 记录、采集链路和处置日志。`,
                    primaryLabel: '查看异常',
                    icon: AlertTriangle,
                    visual: detailAsset('data-sync-pipeline-v1'),
                    stats: [
                      { label: '告警编号', value: code, note: '实时' },
                      { label: '状态', value: state, note: '当前' },
                      { label: '来源', value: source.split(' / ')[0], note: '区域' },
                    ],
                  })
                }
              >
                <em>{code}</em>
                <span>
                  <b>{title}</b>
                  <small>{source}</small>
                </span>
                <strong>{state}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </section>
    </section>
  );
}

function WorkspaceContextStrip({
  item,
  context,
  onAction,
}: {
  item: WorkspaceMenuItem;
  context: MenuContext;
  onAction?: () => void;
}) {
  const Icon = item.icon;

  return (
    <section className="workspace-context-strip" aria-label={`${item.label}业务上下文`}>
      <div className="workspace-context-title">
        <span>
          <Icon />
        </span>
        <div>
          <p>当前模块</p>
          <strong>{item.label}</strong>
        </div>
      </div>
      <p className="workspace-context-summary">{context.summary}</p>
      <div className="workspace-context-stats" aria-label={`${item.label}核心状态`}>
        {context.stats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="workspace-context-action"
        data-route-target={context.routeTarget}
        onClick={onAction}
      >
        {context.action}
        <ArrowRight />
      </button>
    </section>
  );
}

function WorkspaceActionPreview({
  preview,
  canAccessTarget,
  onCancel,
  onConfirm,
}: {
  preview: RouteActionPreview | null;
  canAccessTarget: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!preview) {
    return null;
  }

  const Icon = preview.icon;
  const workflow = getActionWorkflow(preview);

  return (
    <div className="workspace-action-preview-layer">
      <button
        type="button"
        className="workspace-action-preview-backdrop"
        aria-label="关闭操作预览"
        onClick={onCancel}
      />
      <aside
        className="workspace-action-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-action-preview-title"
      >
        <button
          type="button"
          className="workspace-action-close"
          aria-label="关闭操作预览"
          onClick={onCancel}
        >
          <X />
        </button>
        <div className="workspace-action-hero">
          <div className="workspace-action-icon">
            {preview.visual ? <img src={preview.visual} alt="" loading="lazy" /> : <Icon />}
          </div>
          <span>{preview.source}</span>
          <h2 id="workspace-action-preview-title">{preview.title}</h2>
          <p>{preview.description}</p>
        </div>
        <div className="workspace-action-route">
          <span>目标路径</span>
          <strong>{preview.routeTarget}</strong>
        </div>
        {!canAccessTarget ? (
          <div className="workspace-action-permission" role="status">
            当前账号缺少访问该业务页面的权限，请联系管理员开通对应菜单或权限码。
          </div>
        ) : null}
        <div className="workspace-action-stats" aria-label={`${preview.title}关键指标`}>
          {preview.stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
        <section className="workspace-action-workflow" aria-label={`${preview.title}业务流程`}>
          <div className="workspace-action-section-title">
            <span>业务流程</span>
            <strong>{workflow.status}</strong>
          </div>
          <div className="workspace-action-stepper">
            {workflow.steps.map((step, index) => (
              <div key={step.label}>
                <em>{index + 1}</em>
                <span>{step.label}</span>
                <small>{step.note}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="workspace-action-form-preview" aria-label={`${preview.title}预填字段`}>
          <div className="workspace-action-section-title">
            <span>预填字段</span>
            <strong>进入后自动带入</strong>
          </div>
          <div className="workspace-action-field-grid">
            {workflow.fields.map((field) => (
              <div key={field.label}>
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="workspace-action-checklist" aria-label={`${preview.title}处置核对项`}>
          <div className="workspace-action-section-title">
            <span>处置核对</span>
            <strong>{workflow.checklist.length} 项</strong>
          </div>
          {workflow.checklist.map((item) => (
            <div key={item}>
              <CheckCircle2 />
              <span>{item}</span>
            </div>
          ))}
        </section>
        <div className="workspace-action-buttons">
          <button type="button" onClick={onCancel}>
            留在当前页
          </button>
          <button
            type="button"
            data-route-target={preview.routeTarget}
            onClick={onConfirm}
            disabled={!canAccessTarget}
          >
            {canAccessTarget ? preview.primaryLabel : '暂无权限'}
            <ArrowRight />
          </button>
        </div>
      </aside>
    </div>
  );
}

function WorkspaceScreenPreview({
  preview,
  onCancel,
}: {
  preview: ScreenPreview | null;
  onCancel: () => void;
}) {
  if (!preview) {
    return null;
  }

  return (
    <div className="workspace-screen-preview-layer">
      <button
        type="button"
        className="workspace-screen-preview-backdrop"
        aria-label="关闭大屏预览"
        onClick={onCancel}
      />
      <section
        className="workspace-screen-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-screen-preview-title"
      >
        <header>
          <div>
            <span>产品大屏预览</span>
            <h2 id="workspace-screen-preview-title">{preview.title}</h2>
            <p>{preview.subtitle}</p>
          </div>
          <button type="button" aria-label="关闭大屏预览" onClick={onCancel}>
            <X />
          </button>
        </header>
        <div className="workspace-screen-preview-image">
          <img src={preview.imageSrc} alt={`${preview.title}产品图`} loading="eager" decoding="async" />
        </div>
        <footer>
          {preview.stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          ))}
        </footer>
      </section>
    </div>
  );
}

export default function WorkspacePreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { section } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isWorkbenchRoute = location.pathname.startsWith(workbenchBasePath);
  const routePage = getWorkbenchPageFromSection(section);
  const routeMenuId = searchParams.get('menu') ?? undefined;
  const previewTabParam = searchParams.get('tab');
  const previewTabPage = isPreviewPage(previewTabParam) ? previewTabParam : undefined;
  const initialPage = isWorkbenchRoute ? routePage : previewTabPage ?? 'overview';
  const [activePage, setActivePage] = useState<PreviewPage>(initialPage);
  const [activeMenu, setActiveMenu] = useState(
    isWorkbenchRoute
      ? getRouteMenuItem(routePage, routeMenuId).id
      : getDefaultMenuIdForPage(initialPage, isWorkbenchRoute),
  );
  const [routePreview, setRoutePreview] = useState<RouteActionPreview | null>(null);
  const [screenPreview, setScreenPreview] = useState<ScreenPreview | null>(null);

  const visibleMenuItems = useMemo(
    () => (isWorkbenchRoute ? menuItems.filter((item) => item.id !== 'design') : menuItems),
    [isWorkbenchRoute],
  );

  const visiblePageTabs = useMemo(
    () => (isWorkbenchRoute ? pageTabs.filter((tab) => tab.id !== 'stitch') : pageTabs),
    [isWorkbenchRoute],
  );

  useEffect(() => {
    if (!isWorkbenchRoute) {
      return;
    }

    if (section && !workbenchPageBySection[section]) {
      navigate(workbenchBasePath, { replace: true });
      return;
    }

    const routeMenuItem = getRouteMenuItem(routePage, routeMenuId);
    setActivePage(routePage);
    setActiveMenu(routeMenuItem.id);
    setRoutePreview(null);
    setScreenPreview(null);
  }, [isWorkbenchRoute, navigate, routeMenuId, routePage, section]);

  useEffect(() => {
    if (isWorkbenchRoute) {
      return;
    }

    const nextPage = previewTabPage ?? 'overview';
    setActivePage(nextPage);
    setActiveMenu(getDefaultMenuIdForPage(nextPage));
    setRoutePreview(null);
    setScreenPreview(null);
  }, [isWorkbenchRoute, previewTabPage]);

  useEffect(() => {
    if (!routePreview && !screenPreview) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRoutePreview(null);
        setScreenPreview(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [routePreview, screenPreview]);

  const activeItem = useMemo(
    () => visibleMenuItems.find((item) => item.id === activeMenu) ?? visibleMenuItems[0],
    [activeMenu, visibleMenuItems],
  );

  const activeContext = menuContextById[activeItem.id] ?? menuContextById.home;
  const shouldRenderMenuModule = !isWorkbenchRoute || Boolean(routeMenuId);
  const activeModuleMock = shouldRenderMenuModule ? moduleMockByMenuId[activeItem.id] : undefined;
  const activeProductPageMeta = isWorkbenchRoute && routeMenuId ? workbenchProductPageMetaByMenuId[activeItem.id] : undefined;
  const canAccessRoutePreview = routePreview
    ? canAccessRoute(getRoutePathname(routePreview.routeTarget), user)
    : true;

  const selectPage = (page: PreviewPage) => {
    setRoutePreview(null);
    setScreenPreview(null);

    if (isWorkbenchRoute && page !== 'stitch') {
      navigate(buildWorkbenchPath(page));
      return;
    }

    setActivePage(page);
    const firstMenuItem = visibleMenuItems.find((item) => item.page === page);
    if (firstMenuItem) {
      setActiveMenu(firstMenuItem.id);
    }
    navigate(buildPreviewPath(page));
  };

  const selectMenu = (item: WorkspaceMenuItem) => {
    setRoutePreview(null);
    setScreenPreview(null);

    if (isWorkbenchRoute && item.page !== 'stitch') {
      setActiveMenu(item.id);
      setActivePage(item.page);
      navigate(buildWorkbenchPath(item.page, item.id));
      return;
    }

    setActiveMenu(item.id);
    setActivePage(item.page);
    navigate(buildPreviewPath(item.page));
  };

  const handleContextAction = () => {
    if (activeContext.routeTarget) {
      setRoutePreview({
        title: activeContext.action,
        source: `${activeItem.label}业务入口`,
        routeTarget: activeContext.routeTarget,
        description: activeContext.summary,
        primaryLabel: '进入业务页面',
        icon: activeItem.icon,
        stats: activeContext.stats,
      });
    }
  };

  const openRouteTarget = (routeTarget: string) => {
    const quickAction = quickActions.find((item) => item.target === routeTarget);

    if (!quickAction) {
      navigate(routeTarget);
      return;
    }

    setRoutePreview({
      title: quickAction.label,
      source: '快捷入口',
      routeTarget: quickAction.target,
      description: quickAction.summary,
      primaryLabel: '进入处理',
      icon: quickAction.icon,
      visual: quickAction.visual,
      stats: quickAction.stats,
    });
  };

  const confirmRoutePreview = () => {
    if (routePreview?.routeTarget && canAccessRoutePreview) {
      navigate(routePreview.routeTarget);
      setRoutePreview(null);
    }
  };

  const showUtilityPreview = (preview: RouteActionPreview) => {
    setScreenPreview(null);
    setRoutePreview(preview);
  };

  const handleWorkbenchSearch = () => {
    showUtilityPreview({
      title: '资产运营搜索',
      source: '工作台顶部工具',
      routeTarget: '/assets?source=workbench-search',
      description: '进入资产台账后按资产编号、设备名称、位置和状态检索，当前工作台上下文会作为筛选来源保留。',
      primaryLabel: '打开资产检索',
      icon: Search,
      stats: [
        { label: '资产范围', value: '6,842', note: '台' },
        { label: '在线设备', value: '5,102', note: '台' },
        { label: '异常预警', value: '36', note: '条' },
      ],
    });
  };

  const handleWorkbenchFullscreen = () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }

    void (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
  };

  const handleWorkbenchTypeSettings = () => {
    showUtilityPreview({
      title: '文字与密度设置',
      source: '工作台顶部工具',
      routeTarget: location.pathname + location.search,
      description: '正式平台将接入用户偏好保存；当前版本先保持已确认的工作台密度，并通过浏览器缩放和系统无障碍设置承接字体放大。',
      primaryLabel: '返回工作台',
      icon: Type,
      stats: [
        { label: '当前密度', value: '紧凑', note: 'B端' },
        { label: '动效', value: '跟随系统', note: '降级' },
        { label: '偏好保存', value: '规划中', note: '占位' },
      ],
    });
  };

  const handleWorkbenchNotifications = () => {
    showUtilityPreview({
      title: '工作台通知中心',
      source: '工作台顶部工具',
      routeTarget: buildAlertPrefillPath({
        source: 'quick-alert',
        title: '工作台顶部通知',
        eventName: '固定资产运营通知',
        severity: '待处理',
        state: '待查看',
        suggestedAction: '查看预警通知、审批提醒和维保派工回执。',
        description: '来自固定资产工作台顶部通知入口：聚合预警通知、审批提醒和维保派工回执。',
      }),
      description: '进入通知中心，自动带入工作台来源、通知类型和处置建议。',
      primaryLabel: '打开通知中心',
      icon: Bell,
      stats: [
        { label: '未读通知', value: '12', note: '条' },
        { label: '预警通知', value: '4', note: '条' },
        { label: '审批提醒', value: '8', note: '项' },
      ],
    });
  };

  return (
    <div
      className={`workspace-preview-page ${
        isWorkbenchRoute ? 'is-workbench-route' : activePage === 'stitch' ? 'is-stitch-route' : 'is-design-board'
      }`}
    >
      {!isWorkbenchRoute ? (
        <header className="workspace-preview-heading">
          <h1><span>固定资产</span>工作台设计</h1>
          <div className="workspace-feature-bullets" aria-label="工作台能力">
            {featureBullets.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.label}>
                  <Icon />
                  {item.label}
                </span>
              );
            })}
          </div>
        </header>
      ) : null}

      <div className={`workspace-window workspace-window-${activePage}`} aria-label="B端工作台预览">
        <aside className="workspace-side">
          <div className="workspace-brand">
            <div className="workspace-brand-mark">
              <Shield />
            </div>
            <strong>UNIVIEW</strong>
          </div>

          <nav className="workspace-menu" aria-label="工作台菜单">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeMenu;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? 'is-active' : ''}
                  aria-pressed={active}
                  onClick={() => selectMenu(item)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="workspace-main">
          <div className="workspace-topbar">
            <div className="workspace-topbar-title">
              <span>固定资产平台</span>
              <strong>{activeItem.label}</strong>
              <small>UNIVIEW · A 厂区 · MES 已同步</small>
            </div>
            {isWorkbenchRoute ? (
              <div className="workspace-entry-switch" aria-label="平台入口">
                <button type="button" onClick={() => navigate('/dashboard')} title="过渡期保留的旧版仪表板">
                  <LayoutDashboard />
                  <span>旧版仪表板</span>
                </button>
                <button
                  type="button"
                  className={activePage === 'overview' && activeMenu === 'home' ? 'is-active' : ''}
                  onClick={() => navigate(buildWorkbenchPath('overview', 'home'))}
                  title="固定资产平台正式入口"
                >
                  <ShieldCheck />
                  <span>资产运营中枢</span>
                </button>
              </div>
            ) : null}
            <div className="workspace-view-tabs" aria-label="工作台切换">
              {visiblePageTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === activePage ? 'is-active' : ''}
                  onClick={() => selectPage(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="workspace-topbar-status" aria-label="运行状态">
              <span><i className="is-running" />运行中 5,102</span>
              <span><i className="is-standby" />待机 248</span>
              <span><i className="is-fault" />故障 36</span>
            </div>
            <div className="workspace-actions" aria-label="快捷操作">
              <button type="button" aria-label="搜索" title="资产运营搜索" onClick={handleWorkbenchSearch}>
                <Search />
              </button>
              <button type="button" aria-label="全屏" title="切换全屏" onClick={handleWorkbenchFullscreen}>
                <Maximize2 />
              </button>
              <button type="button" aria-label="文字设置" title="文字与密度设置" onClick={handleWorkbenchTypeSettings}>
                <Type />
              </button>
              <button type="button" aria-label="通知" title="通知中心" onClick={handleWorkbenchNotifications}>
                <Bell />
              </button>
              <button type="button" aria-label="用户" title="个人中心" onClick={() => navigate('/profile')}>
                <UserCircle />
              </button>
            </div>
          </div>

          <WorkspaceContextStrip item={activeItem} context={activeContext} onAction={handleContextAction} />
          {activeModuleMock && activeProductPageMeta ? (
            <WorkbenchProductPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock ? (
            <WorkspaceModuleMock mock={activeModuleMock} onPreviewAction={setRoutePreview} />
          ) : null}

          {!activeProductPageMeta && activePage === 'overview' ? <OverviewDashboard onSelectPage={selectPage} /> : null}
          {!activeProductPageMeta && activePage === 'assets' ? (
            <AssetDashboard
              onSelectPage={selectPage}
              onOpenRoute={openRouteTarget}
              onPreviewAction={setRoutePreview}
              isWorkbenchRoute={isWorkbenchRoute}
            />
          ) : null}
          {!activeProductPageMeta && activePage === 'security' ? (
            <SecurityDashboard onPreviewAction={setRoutePreview} onOpenBigScreen={() => navigate('/bigscreen-3d')} />
          ) : null}
          {!activeProductPageMeta && activePage === 'analytics' ? <AnalyticsDashboard onPreviewAction={setRoutePreview} /> : null}
          {!isWorkbenchRoute && activePage === 'stitch' ? (
            <StitchSuiteDashboard />
          ) : null}
        </main>
      </div>
      <WorkspaceActionPreview
        preview={routePreview}
        canAccessTarget={canAccessRoutePreview}
        onCancel={() => setRoutePreview(null)}
        onConfirm={confirmRoutePreview}
      />
      <WorkspaceScreenPreview
        preview={screenPreview}
        onCancel={() => setScreenPreview(null)}
      />
    </div>
  );
}
