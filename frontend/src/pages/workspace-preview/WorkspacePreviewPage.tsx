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
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

type WorkbenchMenuPageProps = {
  item: WorkspaceMenuItem;
  context: MenuContext;
  mock: ModuleMock;
  meta: WorkbenchProductPageMeta;
  onPreviewAction: (preview: RouteActionPreview) => void;
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

const workbenchRouteHiddenMenuIds = new Set(['design', 'inspection']);

const isVisibleWorkbenchRouteMenuItem = (item: WorkspaceMenuItem) =>
  !workbenchRouteHiddenMenuIds.has(item.id);

const getWorkbenchPageFromSection = (section?: string): WorkbenchPage =>
  section ? workbenchPageBySection[section] ?? 'overview' : 'overview';

const getDefaultMenuIdForPage = (page: PreviewPage, isWorkbenchRoute = false) =>
  (
    menuItems.find((item) => item.page === page && (!isWorkbenchRoute || item.id !== 'design')) ??
    menuItems[0]
  ).id;

const getRouteMenuItem = (page: WorkbenchPage, menuId?: string) =>
  menuItems.find((item) => item.id === menuId && item.page === page && isVisibleWorkbenchRouteMenuItem(item)) ??
  menuItems.find((item) => item.page === page && isVisibleWorkbenchRouteMenuItem(item)) ??
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
  home: {
    eyebrow: '运营首页',
    title: '资产运营总览与快捷任务',
    summary: '把 Dashboard KPI、资产态势、待办、最近工单和维保预警聚合为日常运营首页，保留顶部智能制造总览作为独立主视角。',
    routeTarget: buildWorkbenchPath('overview', 'home'),
    icon: Home,
    visual: moduleV6Asset('module-operations-home-console'),
    action: '进入运营首页',
    stats: menuContextById.home.stats,
    rows: [
      { label: '高风险预警', value: '3项', note: 'CN-301 等设备', tone: 'red' },
      { label: '待审批流程', value: '12项', note: '采购/报废/维保申请', tone: 'orange' },
      { label: '今日工单', value: '6单', note: '预测/派工/验收', tone: 'blue' },
    ],
    steps: [
      { label: '总览', note: 'KPI 与资产态势' },
      { label: '派发', note: '待办与快捷任务' },
      { label: '追踪', note: '趋势、刷新与异常' },
    ],
  },
  asset: {
    eyebrow: '资产总览',
    title: '资产健康与生命周期总览',
    summary: '把资产台账、健康评分、风险 TOP、生命周期节点和 MES 状态同步整合成资产运营中心主视角。',
    routeTarget: '/assets?source=workbench&view=asset-overview',
    icon: Layers,
    visual: moduleV6Asset('module-asset-overview-console'),
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
    visual: moduleV6Asset('module-inspection-route-console'),
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
    visual: moduleV6Asset('module-spare-ops-console'),
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
    visual: moduleV6Asset('module-data-monitoring-console'),
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
    visual: moduleV6Asset('module-policy-governance-console'),
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
    visual: moduleV6Asset('module-base-maintenance-console'),
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
  home: {
    position: 'Dashboard KPI、资产态势、待办、最近工单和维保预警迁移后的运营首页。',
    imageSrc: moduleV6Asset('module-operations-home-console'),
    stitchScreen: 'workbench-menu-home-v1',
    assetPurpose: 'IMAGE2 页面级业务图：KPI 下钻、待办、最近工单、维保预警、刷新与快捷入口。',
    filters: ['全部厂区', '今日', '待处理', '高风险', '最近工单', '维保预警'],
    lanes: [
      { label: '流程待办', value: '18', note: '审批/派工/异常', tone: 'orange' },
      { label: '最近工单', value: '6', note: '派工与验收', tone: 'blue' },
      { label: '维保预警', value: '5', note: '剩余 SLA 预警', tone: 'red' },
      { label: '数据刷新', value: '正常', note: '10:24:30', tone: 'green' },
    ],
    insights: [
      { label: '综合态势', value: '良好', note: '关注 3 项预警' },
      { label: '快捷入口', value: '6 个', note: '工单/巡检/报表/告警' },
      { label: 'Dashboard 迁移', value: '已承接', note: 'KPI、工单、预警和趋势' },
    ],
    emptyState: '暂无待办与预警时，展示资产健康概览、最近刷新状态和快捷入口。',
    errorState: '运营首页聚合数据失败时，保留上次刷新结果并提供手动刷新入口。',
    deniedState: '缺少 dashboard:query 或 asset:ledger:query 时，快捷入口保留但业务按钮禁用。',
    actions: [
      {
        title: '处理流程待办',
        source: '运营首页产品页',
        routeTarget: '/approvals?source=workbench&status=PENDING&scope=operations-home',
        description: '进入审批中心，保留运营首页来源、待处理状态和跨模块待办上下文。',
        primaryLabel: '进入待办处理',
        icon: ClipboardList,
        visual: moduleV6Asset('module-flow-todo-console'),
        stats: menuContextById.todo.stats,
      },
      {
        title: '新建预测工单',
        source: '运营首页产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'quick-action',
          title: '运营首页快捷预测维保工单',
          assetName: '数控车床 CN-301',
          assetLocation: '机加车间 / CNC 区域 A线',
          riskState: '主轴振动异常',
          riskScore: 91,
          priority: 'HIGH',
          dueDate: '2026-06-15',
          description: '来自 Workbench 运营首页：维保预警命中高风险设备，需要快速生成预测维保工单。',
        }),
        description: '把运营首页维保预警中的设备、风险、优先级和截止时间预填到工单创建页。',
        primaryLabel: '新建工单',
        icon: Wrench,
        visual: moduleV6Asset('module-workorder-dispatch-console'),
        stats: menuContextById.orders.stats,
      },
      {
        title: '查看经营报表',
        source: '运营首页产品页',
        routeTarget: '/reports?source=workbench&view=operations-home',
        description: '进入报表分析，承接运营首页中的资产健康、价值趋势和部门统计。',
        primaryLabel: '进入报表',
        icon: BarChart3,
        visual: moduleV6Asset('module-report-analysis-console'),
        stats: menuContextById.report.stats,
      },
    ],
  },
  asset: {
    position: 'Dashboard KPI 与资产态势迁移后的正式资产运营承接页。',
    imageSrc: moduleV6Asset('module-asset-overview-console'),
    stitchScreen: 'workbench-menu-asset-v1',
    assetPurpose: 'IMAGE2 页面级业务图：台账筛选、健康/生命周期/分类、资产详情、处置和使用流转入口。',
    filters: ['全部组织', '资产状态', '资产分类', '健康状态', '责任人', '更多筛选'],
    lanes: [
      { label: '在用资产', value: '12,856', note: '台账可下钻', tone: 'green' },
      { label: '风险资产', value: '356', note: '可转工单', tone: 'orange' },
      { label: '处置申请', value: '18', note: '调拨/清退/报废', tone: 'blue' },
      { label: '使用流转', value: '42', note: '领用/借用/归还', tone: 'cyan' },
    ],
    insights: [
      { label: '健康分布', value: '92.4', note: '较上周 +1.56%' },
      { label: '生命周期', value: '5 阶段', note: '投产到报废' },
      { label: '二级能力', value: '处置/流转', note: '不新增一级菜单' },
    ],
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
        visual: moduleV6Asset('module-asset-overview-console'),
        stats: menuContextById.asset.stats,
      },
      {
        title: '新增资产',
        source: '资产总览产品页',
        routeTarget: '/assets/new?source=workbench&from=asset-overview',
        description: '进入资产新建页，带入 Workbench 来源和资产总览上下文。',
        primaryLabel: '新建资产',
        icon: Archive,
        visual: moduleV6Asset('module-asset-overview-console'),
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
      {
        title: '发起资产调拨',
        source: '资产总览产品页',
        routeTarget: '/disposals/transfer/new?source=workbench&assetId=201',
        description: '进入资产处置调拨表单，预填资产与 Workbench 来源，作为资产处置二级能力承接。',
        primaryLabel: '发起调拨',
        icon: ArrowRight,
        visual: moduleV6Asset('module-asset-overview-console'),
        stats: menuContextById.asset.stats,
      },
      {
        title: '发起使用流转',
        source: '资产总览产品页',
        routeTarget: '/assignments/new?source=workbench&assetId=201',
        description: '进入领用/分配表单，承接使用流转工作台能力，不新增一级菜单。',
        primaryLabel: '发起流转',
        icon: UserCircle,
        visual: moduleV6Asset('module-asset-overview-console'),
        stats: menuContextById.asset.stats,
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
    imageSrc: moduleV6Asset('module-inspection-route-console'),
    stitchScreen: 'workbench-menu-inspection-v1',
    assetPurpose: 'IMAGE2 页面级业务图：巡检计划、路线、点位、异常队列、证据上传和转工单。',
    filters: ['今日计划', '路线全部', '点位全部', '状态全部', '执行人全部', '逾期任务'],
    lanes: [
      { label: '今日计划', value: '36', note: '18 条已完成', tone: 'blue' },
      { label: '异常点位', value: '5', note: '待处理', tone: 'red' },
      { label: '按时完成率', value: '92%', note: '较昨日 +6%', tone: 'green' },
      { label: '待转工单', value: '7', note: '异常复核后转派', tone: 'orange' },
    ],
    insights: [
      { label: '扫码签到', value: '支持', note: '点位证据留存' },
      { label: '异常转派', value: '可处理', note: '进入工单创建页' },
      { label: '路线执行', value: '4 条', note: '按风险排程' },
    ],
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
        visual: moduleV6Asset('module-inspection-route-console'),
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
        visual: moduleV6Asset('module-inspection-route-console'),
        stats: menuContextById.inspection.stats,
      },
      {
        title: '转派巡检异常',
        source: '巡检管理产品页',
        routeTarget: buildWorkOrderPrefillPath({
          source: 'asset-risk',
          title: '巡检异常转派工单',
          assetName: '主轴振动传感器',
          assetLocation: '机加车间 / CNC 区域 A线',
          riskState: '巡检异常',
          riskScore: 88,
          riskLevel: '中高风险',
          priority: 'HIGH',
          dueDate: '2026-06-15',
          description: '来自 Workbench 巡检管理：点位读数异常，需要转派工单并上传处理记录。',
        }),
        description: '把巡检点位、异常读数和处理建议预填到工单创建页。',
        primaryLabel: '转工单',
        icon: Wrench,
        visual: moduleV6Asset('module-workorder-dispatch-console'),
        stats: menuContextById.inspection.stats,
      },
    ],
  },
  spares: {
    position: '低储预警、领用申请、采购联动和工单成本回写的备件承接页。',
    imageSrc: moduleV6Asset('module-spare-ops-console'),
    stitchScreen: 'workbench-menu-spares-v1',
    assetPurpose: 'IMAGE2 页面级业务图：库存筛选、低储预警、供应商 ETA、关联工单和成本回写。',
    filters: ['备件分类', '库存状态', '低储预警', '供应商', '关联工单', '高级筛选'],
    lanes: [
      { label: '备件总数', value: '3,256', note: '较昨日 +48', tone: 'blue' },
      { label: '低储备件', value: '126', note: '需补货', tone: 'orange' },
      { label: '缺货备件', value: '28', note: '影响工单', tone: 'red' },
      { label: '成本回写', value: '82%', note: '本月完成率', tone: 'green' },
    ],
    insights: [
      { label: '供应商 ETA', value: '3 天', note: '轴承 6205-2RS' },
      { label: '关联工单', value: '12 单', note: '预测维保优先' },
      { label: '二级能力', value: '领用/采购', note: '不新增菜单' },
    ],
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
        visual: moduleV6Asset('module-spare-ops-console'),
        stats: menuContextById.spares.stats,
      },
      {
        title: '查看备件库存',
        source: '备件管理产品页',
        routeTarget: '/spare-parts?source=workbench&stock=LOW',
        description: '进入备件库存列表，保留低储筛选和工单关联上下文。',
        primaryLabel: '进入库存列表',
        icon: Box,
        visual: moduleV6Asset('module-spare-ops-console'),
        stats: menuContextById.spares.stats,
      },
      {
        title: '采购申请',
        source: '备件管理产品页',
        routeTarget: '/spare-parts/new?source=workbench&mode=purchase&stock=LOW',
        description: '进入备件新建/采购申请视角，预填低储、供应商和关联工单上下文。',
        primaryLabel: '进入采购申请',
        icon: PackageCheck,
        visual: moduleV6Asset('module-spare-ops-console'),
        stats: menuContextById.spares.stats,
      },
    ],
  },
  energy: {
    position: '数据监控中心内的采集链路、异常流水和指标服务承接页。',
    imageSrc: moduleV6Asset('module-data-monitoring-console'),
    stitchScreen: 'workbench-menu-energy-v1',
    assetPurpose: 'IMAGE2 页面级业务图：MES/IoT 链路、采集延迟、异常流水、订阅导出和重试。',
    filters: ['数据链路总览', '数据源管理', '设备点位', '采集任务', '监控配置', '数据事件'],
    lanes: [
      { label: '链路健康度', value: '98.6%', note: 'MES/IoT 正常', tone: 'green' },
      { label: '接入系统', value: '12', note: '2 个异常', tone: 'blue' },
      { label: '采集延迟', value: '0.8s', note: 'P95 2.1s', tone: 'cyan' },
      { label: '异常事件', value: '32', note: '未处理', tone: 'red' },
    ],
    insights: [
      { label: '批量数据', value: '86.5GB', note: '今日数据量' },
      { label: '订阅导出', value: '可用', note: '异常报表推送' },
      { label: '事件处理', value: '重试/工单', note: '保留链路上下文' },
    ],
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
        visual: moduleV6Asset('module-data-monitoring-console'),
        stats: menuContextById.energy.stats,
      },
      {
        title: '订阅异常报表',
        source: '数据监控产品页',
        routeTarget: '/reports?source=workbench&view=data-monitoring&subscribe=true',
        description: '进入报表中心，预填数据链路异常订阅和监控视角。',
        primaryLabel: '进入报表订阅',
        icon: BarChart3,
        visual: moduleV6Asset('module-report-analysis-console'),
        stats: menuContextById.report.stats,
      },
      {
        title: '重试采集任务',
        source: '数据监控产品页',
        routeTarget: '/energy?source=workbench&scope=data-monitoring&event=delay&retry=true',
        description: '进入数据监控事件视角，保留采集延迟事件和重试意图。',
        primaryLabel: '进入事件处理',
        icon: Zap,
        visual: moduleV6Asset('module-data-monitoring-console'),
        stats: menuContextById.energy.stats,
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
    imageSrc: moduleV6Asset('module-policy-governance-console'),
    stitchScreen: 'workbench-menu-policy-v1',
    assetPurpose: 'IMAGE2 页面级业务图：风险规则、角色策略、审批边界、策略命中和权限申请。',
    filters: ['风险规则', '角色策略', '审批边界', '策略命中', '高危复核', '责任部门'],
    lanes: [
      { label: '风险规则', value: '68', note: '启用 54', tone: 'blue' },
      { label: '角色策略', value: '128', note: '110 个启用', tone: 'cyan' },
      { label: '审批边界', value: '46', note: '覆盖 23 部门', tone: 'cyan' },
      { label: '高危复核', value: '23', note: '较昨日 +6', tone: 'red' },
    ],
    insights: [
      { label: '策略命中', value: '238', note: '近 7 天' },
      { label: '无权限态', value: '显式', note: '高危规则需申请' },
      { label: '治理边界', value: '组织/角色', note: '不新增配置菜单' },
    ],
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
        visual: moduleV6Asset('module-policy-governance-console'),
        stats: menuContextById.policy.stats,
      },
      {
        title: '复核高危规则',
        source: '组织策略产品页',
        routeTarget: '/risk-matrix?source=workbench&scope=policy&severity=HIGH',
        description: '进入风险矩阵高危规则视角，预填策略范围和风险等级。',
        primaryLabel: '进入高危复核',
        icon: Shield,
        visual: moduleV6Asset('module-policy-governance-console'),
        stats: menuContextById.policy.stats,
      },
      {
        title: '新建风险评估',
        source: '组织策略产品页',
        routeTarget: '/risk-assessments/new?source=workbench&scope=policy',
        description: '进入风险评估新建页，预填组织策略和审批边界上下文。',
        primaryLabel: '新建评估',
        icon: ShieldCheck,
        visual: moduleV6Asset('module-policy-governance-console'),
        stats: menuContextById.policy.stats,
      },
    ],
  },
  settings: {
    position: '组织、角色、数据字典、MES/IoT 集成账号和平台参数的基础维护承接页。',
    imageSrc: moduleV6Asset('module-base-maintenance-console'),
    stitchScreen: 'workbench-menu-settings-v1',
    assetPurpose: 'IMAGE2 页面级业务图：分类、位置、供应商、资产型号、编号规则、集成源和系统配置。',
    filters: ['资产分类', '位置管理', '供应商管理', '资产型号', '编号规则', '系统配置'],
    lanes: [
      { label: '全部分类', value: '256', note: '启用中', tone: 'blue' },
      { label: '资产型号', value: '12,856', note: '关联资产', tone: 'cyan' },
      { label: '集成源', value: '7', note: '2 个需复核', tone: 'orange' },
      { label: '配置健康', value: '98.6%', note: '命中率', tone: 'green' },
    ],
    insights: [
      { label: '基础数据', value: '分类/位置/供应商', note: '真实路由承接' },
      { label: '危险变更', value: '确认停用', note: '需审批或权限' },
      { label: '同步质量', value: '正常', note: 'MES/IoT 集成' },
    ],
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
        visual: moduleV6Asset('module-base-maintenance-console'),
        stats: menuContextById.settings.stats,
      },
      {
        title: '查看集成链路',
        source: '基础维护产品页',
        routeTarget: '/energy?source=workbench&scope=integration-config',
        description: '进入数据监控链路视角，复核 MES/IoT 集成源和同步质量。',
        primaryLabel: '进入链路监控',
        icon: Database,
        visual: moduleV6Asset('module-data-monitoring-console'),
        stats: menuContextById.energy.stats,
      },
      {
        title: '维护资产分类',
        source: '基础维护产品页',
        routeTarget: '/categories?source=workbench',
        description: '进入资产分类维护页，承接基础维护下的分类二级能力。',
        primaryLabel: '进入资产分类',
        icon: Layers,
        visual: moduleV6Asset('module-base-maintenance-console'),
        stats: menuContextById.settings.stats,
      },
      {
        title: '维护供应商',
        source: '基础维护产品页',
        routeTarget: '/vendors?source=workbench',
        description: '进入供应商维护页，承接基础维护下的供应商二级能力。',
        primaryLabel: '进入供应商',
        icon: UserCircle,
        visual: moduleV6Asset('module-base-maintenance-console'),
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
  route?: string;
  href?: string;
  linkLabel?: string;
}> = [
  {
    title: '智能制造总览',
    status: '已纳入',
    note: '产线大图、四中心入口与产品总览逻辑',
    imageSrc: stitchAsset('overview'),
    page: 'overview',
    route: '/fixed-assets/workbench',
  },
  {
    title: '资产运维中心',
    status: '优先复刻',
    note: '健康指数、资产分类、风险 TOP10 与工单闭环',
    imageSrc: stitchAsset('assets'),
    page: 'assets',
    route: '/fixed-assets/workbench/assets',
  },
  {
    title: '数据监控中心',
    status: '已纳入',
    note: '98.6% 圆环、设备波动、台站统计与异常列表',
    imageSrc: stitchAsset('analytics'),
    page: 'analytics',
    route: '/fixed-assets/workbench/analytics',
  },
  {
    title: '安全态势工作台',
    status: '已纳入',
    note: '深色态势图、安全评分、风险列表与趋势',
    imageSrc: stitchAsset('security'),
    page: 'security',
    route: '/fixed-assets/workbench/security',
  },
  {
    title: '运营首页',
    status: 'Round 2',
    note: 'KPI 下钻、待办、最近工单、维保预警与快捷入口',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-home-v1'),
    route: '/fixed-assets/workbench?menu=home',
    linkLabel: '进入业务菜单',
  },
  {
    title: '流程待办',
    status: 'Round 1',
    note: '待审批、预测维保、巡检异常、备件低储与 SLA 队列',
    imageSrc: stitchAsset('workbench-p0/workbench-menu-todo-v1'),
    route: '/fixed-assets/workbench?menu=todo',
    linkLabel: '进入业务菜单',
  },
  {
    title: '资产总览',
    status: 'Round 2',
    note: '资产台账、健康、生命周期、风险 TOP 与二级处置/流转入口',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-asset-v1'),
    route: '/fixed-assets/workbench/assets?menu=asset',
    linkLabel: '进入业务菜单',
  },
  {
    title: '设备管理',
    status: 'Round 1',
    note: '设备在线、温度、振动、采集延迟与异常派工',
    imageSrc: stitchAsset('workbench-p0/workbench-menu-device-v1'),
    route: '/fixed-assets/workbench/assets?menu=device',
    linkLabel: '进入业务菜单',
  },
  {
    title: '工单管理',
    status: 'Round 1',
    note: '预测、派工、执行、验收、SLA 与备件保障闭环',
    imageSrc: stitchAsset('workbench-p0/workbench-menu-orders-v1'),
    route: '/fixed-assets/workbench/assets?menu=orders',
    linkLabel: '进入业务菜单',
  },
  {
    title: '备件管理',
    status: 'Round 2',
    note: '低储预警、供应商 ETA、关联工单、领用采购与成本回写',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-spares-v1'),
    route: '/fixed-assets/workbench/assets?menu=spares',
    linkLabel: '进入业务菜单',
  },
  {
    title: '数据监控',
    status: 'Round 2',
    note: 'MES/IoT 链路、采集延迟、异常流水、订阅导出和重试',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-energy-v1'),
    route: '/fixed-assets/workbench/analytics?menu=energy',
    linkLabel: '进入业务菜单',
  },
  {
    title: '报表分析',
    status: 'Round 1',
    note: '模板选择、趋势分析、导出订阅、失败重试和审计链路',
    imageSrc: stitchAsset('workbench-p0/workbench-menu-report-v1'),
    route: '/fixed-assets/workbench/analytics?menu=report',
    linkLabel: '进入业务菜单',
  },
  {
    title: '告警中心',
    status: 'Round 1',
    note: '等级筛选、策略命中、处置建议、转工单和复盘闭环',
    imageSrc: stitchAsset('workbench-p0/workbench-menu-alert-v1'),
    route: '/fixed-assets/workbench/security?menu=alarm',
    linkLabel: '进入业务菜单',
  },
  {
    title: '组织策略',
    status: 'Round 2',
    note: '风险规则、角色策略、审批边界、策略命中和高危复核',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-policy-v1'),
    route: '/fixed-assets/workbench/security?menu=policy',
    linkLabel: '进入业务菜单',
  },
  {
    title: '基础维护',
    status: 'Round 2',
    note: '分类、位置、供应商、资产型号、编号规则、集成源和系统配置',
    imageSrc: stitchAsset('workbench-round2/workbench-menu-settings-v1'),
    route: '/fixed-assets/workbench/assets?menu=settings',
    linkLabel: '进入业务菜单',
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

const workbenchOrderSummaryCards = [
  { label: '待维保', value: '248', delta: '待派工设备', icon: Gauge, tone: 'blue' },
  { label: '今日派工', value: '42', delta: '较昨日 +6', icon: ClipboardList, tone: 'cyan' },
  { label: '执行中', value: '78', delta: '较昨日 +12', icon: Wrench, tone: 'green' },
  { label: '待验收', value: '32', delta: '较昨日 -3', icon: FileText, tone: 'violet' },
  { label: '逾期工单', value: '9', delta: '较昨日 +2', icon: AlertTriangle, tone: 'red' },
  { label: '闭环率', value: '91.8%', delta: '本周闭环', icon: CheckCircle2, tone: 'green' },
] as const;

const workbenchOrderStages = [
  { label: '预测', value: '46', note: '较昨日 +7', tone: 'blue' },
  { label: '派工', value: '38', note: '较昨日 +6', tone: 'cyan' },
  { label: '执行', value: '78', note: '较昨日 +12', tone: 'green' },
  { label: '验收', value: '32', note: '较昨日 -3', tone: 'violet' },
  { label: '闭环', value: '51', note: '较昨日 +9', tone: 'orange' },
] as const;

const workbenchOrderRows = [
  {
    id: 'WO-20240614-0012',
    type: '预测维保',
    device: '数控车床 CN-301',
    location: '机加车间',
    title: '主轴振动异常预测维保',
    priority: 'P1',
    status: '派工中',
    sla: '-1.2h',
    owner: '张三丰',
    spare: '已就绪',
    tone: 'red',
  },
  {
    id: 'WO-20240614-0011',
    type: '故障报修',
    device: '立式铣床 VM-205',
    location: '加工中心',
    title: '换刀机构卡滞',
    priority: 'P2',
    status: '执行中',
    sla: '2.5h',
    owner: '李巡检',
    spare: '缺件 2',
    tone: 'orange',
  },
  {
    id: 'WO-20240614-0010',
    type: '预防性维护',
    device: '空压机 CP-101',
    location: '动力站',
    title: '油滤更换保养',
    priority: 'P3',
    status: '待验收',
    sla: '4.8h',
    owner: '王技师',
    spare: '已就绪',
    tone: 'blue',
  },
  {
    id: 'WO-20240614-0009',
    type: '预测维保',
    device: '焊接机器人 RB-501',
    location: '焊接线 A',
    title: '减速机温升趋势预警维保',
    priority: 'P2',
    status: '执行中',
    sla: '1.0h',
    owner: '赵技师',
    spare: '部分到位',
    tone: 'orange',
  },
  {
    id: 'WO-20240614-0008',
    type: '故障报修',
    device: '数控车床 CN-305',
    location: '机加车间',
    title: '冷却泵异响',
    priority: 'P1',
    status: '派工中',
    sla: '-0.3h',
    owner: '刘班组长',
    spare: '缺件 1',
    tone: 'red',
  },
  {
    id: 'WO-20240614-0007',
    type: '巡检异常',
    device: '配电柜 PDB-01',
    location: '动力站',
    title: '柜体局部过热报警',
    priority: 'P2',
    status: '执行中',
    sla: '3.2h',
    owner: '陈电工',
    spare: '无需备件',
    tone: 'orange',
  },
  {
    id: 'WO-20240614-0006',
    type: '预防性维护',
    device: '冷干机 RD-201',
    location: '动力站',
    title: '冷凝器清洁保养',
    priority: 'P3',
    status: '待验收',
    sla: '5.1h',
    owner: '孙技师',
    spare: '已就绪',
    tone: 'blue',
  },
  {
    id: 'WO-20240614-0005',
    type: '预测维保',
    device: '传送线 CV-302',
    location: '包装线',
    title: '链条磨损趋势预警维保',
    priority: 'P3',
    status: '闭环',
    sla: '--',
    owner: '周技师',
    spare: '已消耗',
    tone: 'green',
  },
] as const;

const workbenchOrderDetailTabs = ['工单信息', '设备状态', '备件与物料', '处理记录', '关联告警'] as const;

const workbenchTodoSummaryCards = [
  { label: '待审批', value: '18', delta: '较昨日 +3', icon: ClipboardList, tone: 'blue' },
  { label: '待派工', value: '24', delta: '较昨日 +5', icon: UserCircle, tone: 'cyan' },
  { label: '预警待办', value: '36', delta: '较昨日 +8', icon: AlertTriangle, tone: 'orange' },
  { label: '待完工', value: '42', delta: '执行中', icon: Activity, tone: 'green' },
  { label: '逾期', value: '7', delta: '较昨日 +2', icon: CheckCircle2, tone: 'red' },
] as const;

const workbenchTodoTabs = [
  { label: '全部待办', value: '78' },
  { label: '待审批', value: '18' },
  { label: '待派工', value: '24' },
  { label: '预警待办', value: '36' },
  { label: '逾期', value: '7' },
] as const;

const workbenchTodoRows = [
  {
    id: 'APR-20240614-0012',
    type: '待审批',
    source: '维修费用',
    title: '设备维修费用报销申请',
    relatedObject: '数控车床 CN-301',
    initiator: '张三丰',
    priority: 'P1',
    status: '待审批',
    sla: '已逾期 2h',
    createdAt: '今天 09:12',
    context: '计划外维修',
    amount: '¥ 2,850.00',
    description: '主轴异响，振动超限，需要更换轴承。',
    assetImage: iconAsset('cnc-machine'),
    tone: 'red',
  },
  {
    id: 'PM-20240614-0021',
    type: '预测维保',
    source: '工单模型',
    title: '预测维保工单待派工',
    relatedObject: '加工中心 MC-502',
    initiator: '系统预警',
    priority: 'P1',
    status: '待派工',
    sla: '剩余 1h',
    createdAt: '今天 08:45',
    context: '预测维保',
    amount: '自动派工',
    description: '温度波动超过模型阈值，建议安排班组现场复核。',
    assetImage: iconAsset('production-equipment'),
    tone: 'red',
  },
  {
    id: 'INSP-20240614-0045',
    type: '预警',
    source: '点检路线',
    title: '巡检异常：振动超限',
    relatedObject: '立式铣床 VM-205',
    initiator: '李巡检',
    priority: 'P2',
    status: '待处理',
    sla: '剩余 3h',
    createdAt: '今天 07:58',
    context: '巡检管理',
    amount: '异常点位',
    description: '减速机点位振动值超过巡检标准，需要复测并转工单。',
    assetImage: iconAsset('inspection-equipment'),
    tone: 'orange',
  },
  {
    id: 'INV-20240614-0088',
    type: '预警',
    source: '备件管理',
    title: '备件低储预警',
    relatedObject: '轴承 6205-2RS',
    initiator: '系统预警',
    priority: 'P2',
    status: '待处理',
    sla: '剩余 5h',
    createdAt: '今天 06:30',
    context: '备件管理',
    amount: '库存 12',
    description: '安全库存低于阈值，关联 3 张预测维保工单。',
    assetImage: iconAsset('auxiliary-equipment'),
    tone: 'orange',
  },
  {
    id: 'PM-20240613-0099',
    type: '待派工',
    source: '预测维保',
    title: '预测维保工单待派工',
    relatedObject: '磨床 GR-101',
    initiator: '系统预警',
    priority: 'P3',
    status: '待派工',
    sla: '剩余 8h',
    createdAt: '昨天 18:20',
    context: '预测维保',
    amount: '建议派发',
    description: '磨削主轴负载上升，建议纳入本周计划。',
    assetImage: iconAsset('cnc-cluster'),
    tone: 'blue',
  },
  {
    id: 'PUR-20240613-0033',
    type: '待审批',
    source: '采购部',
    title: '备件采购申请',
    relatedObject: '导轨滑块 HGH25',
    initiator: '王采购',
    priority: 'P3',
    status: '待审批',
    sla: '剩余 10h',
    createdAt: '昨天 17:10',
    context: '采购申请',
    amount: '¥ 8,600.00',
    description: '关联包装线维修工单，库存不足需补采。',
    assetImage: iconAsset('auxiliary-equipment'),
    tone: 'blue',
  },
  {
    id: 'WO-20240613-0077',
    type: '预警',
    source: '工单管理',
    title: '工单接单超时预警',
    relatedObject: '液压机 HP-10T',
    initiator: '系统预警',
    priority: 'P4',
    status: '待处理',
    sla: '剩余 12h',
    createdAt: '昨天 16:05',
    context: '工单管理',
    amount: '超时风险',
    description: '工单超过接单 SLA，建议转派负责人。',
    assetImage: iconAsset('public-equipment'),
    tone: 'slate',
  },
  {
    id: 'DATA-20240613-0022',
    type: '预警',
    source: '数据监控',
    title: '数据采集延迟',
    relatedObject: '加工中心 MC-301',
    initiator: '系统预警',
    priority: 'P4',
    status: '待处理',
    sla: '剩余 14h',
    createdAt: '昨天 15:40',
    context: '数据监控',
    amount: '延迟 4.3s',
    description: '设备采集链路延迟超过阈值，影响设备状态时效性。',
    assetImage: iconAsset('it-equipment'),
    tone: 'slate',
  },
] as const;

const workbenchTodoDetailTabs = ['基本信息', '审批流程', '附件', '处理建议'] as const;

const workbenchAssetSummaryCards = [
  { label: '资产总数', value: '6,842', delta: '建账总量', icon: Layers, tone: 'blue' },
  { label: '在用资产', value: '5,102', delta: '在线可追踪', icon: CheckCircle2, tone: 'green' },
  { label: '闲置资产', value: '268', delta: '待盘活', icon: Archive, tone: 'cyan' },
  { label: '风险资产', value: '36', delta: '需转派处置', icon: AlertTriangle, tone: 'red' },
  { label: '健康指数', value: '86', delta: '平台均值', icon: Gauge, tone: 'violet' },
  { label: '本月新增', value: '18', delta: '本月入账', icon: UserCircle, tone: 'orange' },
] as const;

const workbenchAssetStages = [
  { label: '建账', value: '6,842', note: '统一编码', tone: 'blue' },
  { label: '在用', value: '5,102', note: '责任到人', tone: 'green' },
  { label: '风险', value: '36', note: '健康低分', tone: 'red' },
  { label: '流转', value: '42', note: '领用/调拨', tone: 'cyan' },
  { label: '处置', value: '18', note: '审批中', tone: 'orange' },
] as const;

// 资产总览图表数据（对齐设计稿：饼图资产分类分布 / 柱图健康分布）
const workbenchAssetCategoryDistribution = [
  { name: '生产设备', value: 43, color: '#3b82f6' },
  { name: 'IT设备', value: 27, color: '#10b981' },
  { name: '安防设备', value: 18, color: '#f59e0b' },
  { name: '办公设备', value: 12, color: '#8b5cf6' },
] as const;

const workbenchAssetHealthDistribution = [
  { name: '优(90+)', value: 3856, color: '#10b981' },
  { name: '良(80-89)', value: 1980, color: '#3b82f6' },
  { name: '中(70-79)', value: 768, color: '#f59e0b' },
  { name: '差(<70)', value: 238, color: '#ef4444' },
] as const;

const workbenchAssetRows = [
  {
    id: 'FA-CN-301',
    type: '生产设备',
    asset: '数控车床 CN-301',
    location: '机加车间 / CNC 区域 A线',
    title: '主轴振动异常，建议转预测维保',
    health: '91',
    status: '高风险',
    owner: '张三丰',
    lifecycle: '在用',
    value: '¥126.8万',
    tone: 'red',
  },
  {
    id: 'FA-M-201',
    type: '生产设备',
    asset: '注塑机 M-201',
    location: '一车间 / A线',
    title: '温度边界触发巡检复核',
    health: '88',
    status: '关注',
    owner: '王班组',
    lifecycle: '在用',
    value: '¥86.2万',
    tone: 'orange',
  },
  {
    id: 'FA-CP-101',
    type: '动力设备',
    asset: '空压机 CP-101',
    location: '动力站',
    title: '油滤保养窗口待确认',
    health: '94',
    status: '正常',
    owner: '王技师',
    lifecycle: '维保中',
    value: '¥42.5万',
    tone: 'green',
  },
  {
    id: 'FA-RB-501',
    type: '生产设备',
    asset: '焊接机器人 RB-501',
    location: '焊接线 A',
    title: '减速机温升趋势预警',
    health: '86',
    status: '关注',
    owner: '赵技师',
    lifecycle: '在用',
    value: '¥68.9万',
    tone: 'orange',
  },
  {
    id: 'FA-AGV-05',
    type: '物流设备',
    asset: 'AGV-05',
    location: '物流区',
    title: '位置漂移待复核',
    health: '90',
    status: '待复核',
    owner: '物流运维',
    lifecycle: '流转中',
    value: '¥18.6万',
    tone: 'blue',
  },
  {
    id: 'FA-PDB-01',
    type: '电气设备',
    asset: '配电柜 PDB-01',
    location: '动力站',
    title: '局部过热已转告警',
    health: '83',
    status: '处理中',
    owner: '陈电工',
    lifecycle: '在用',
    value: '¥24.1万',
    tone: 'orange',
  },
] as const;

const workbenchAssetDetailTabs = ['资产信息', '健康评分', '生命周期', '处置流转', '关联工单'] as const;

const workbenchSparesSummaryCards = [
  { label: '库存 SKU', value: '1,420', delta: '在库品种', icon: PackageCheck, tone: 'blue' },
  { label: '低储备件', value: '18', delta: '需补货', icon: AlertTriangle, tone: 'orange' },
  { label: '周转率', value: '4.8', delta: '次/月', icon: TrendingUp, tone: 'green' },
  { label: '缺货备件', value: '28', delta: '影响工单', icon: Box, tone: 'red' },
  { label: '供应商 ETA', value: '3天', delta: '轴承优先', icon: CalendarDays, tone: 'cyan' },
  { label: '关联工单', value: '12', delta: '预测维保优先', icon: Wrench, tone: 'violet' },
] as const;

const workbenchSparesStages = [
  { label: '识别', value: '126', note: '低储预警', tone: 'orange' },
  { label: '申请', value: '48', note: '领用/采购', tone: 'blue' },
  { label: '采购', value: '28', note: '缺货影响', tone: 'red' },
  { label: '到货', value: '72%', note: 'ETA 达成', tone: 'cyan' },
  { label: '回写', value: '82%', note: '工单成本', tone: 'green' },
] as const;

const workbenchSparesRows = [
  {
    id: 'SP-6205-2RS',
    category: '轴承',
    part: '轴承 6205-2RS',
    stock: '6',
    state: '低储',
    supplier: 'UNIVIEW 备件仓',
    workOrder: 'WO-20240614-0012',
    eta: '2026-06-18',
    owner: '备件员',
    tone: 'orange',
  },
  {
    id: 'SP-PT100-M201',
    category: '传感器',
    part: '温控模块传感器',
    stock: '2',
    state: '缺货风险',
    supplier: '华南传感器',
    workOrder: 'WO-20240614-0011',
    eta: '2026-06-20',
    owner: '采购员',
    tone: 'red',
  },
  {
    id: 'SP-LGHP-2',
    category: '润滑',
    part: '润滑脂 LGHP-2',
    stock: '18',
    state: '已就绪',
    supplier: '设备维保仓',
    workOrder: 'WO-20240614-0012',
    eta: '已到位',
    owner: '王技师',
    tone: 'green',
  },
  {
    id: 'SP-B-320',
    category: '皮带',
    part: '皮带 B-320',
    stock: '12',
    state: '安全库存',
    supplier: '包装线仓',
    workOrder: 'WO-20240614-0005',
    eta: '可保障 7 天',
    owner: '周技师',
    tone: 'blue',
  },
  {
    id: 'SP-SEAL-35627',
    category: '密封',
    part: '密封圈 35×62×7',
    stock: '1',
    state: '待采购',
    supplier: '待询价',
    workOrder: 'WO-20240614-0012',
    eta: '待确认',
    owner: '采购员',
    tone: 'red',
  },
] as const;

const workbenchSparesDetailTabs = ['备件信息', '库存流水', '供应商 ETA', '关联工单', '成本回写'] as const;

type WorkbenchCommandRow = {
  id: string;
  type: string;
  entity: string;
  location: string;
  title: string;
  score: string;
  status: string;
  timing: string;
  owner: string;
  contextLabel: string;
  tone: string;
};

type WorkbenchCommandSummaryCard = {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone: string;
};

type WorkbenchCommandStage = {
  label: string;
  value: string;
  note: string;
  tone: string;
};

type WorkbenchCommandAction = {
  label: string;
  actionIndex?: number;
  title?: string;
  routeTarget?: string;
  description?: string;
  primaryLabel?: string;
  icon: LucideIcon;
  primary?: boolean;
};

type WorkbenchCommandDetailAction = {
  label: string;
  title: string;
  route: (row: WorkbenchCommandRow) => string;
  description: (row: WorkbenchCommandRow) => string;
  primaryLabel: string;
  icon: LucideIcon;
  primary?: boolean;
};

type WorkbenchCommandPageConfig = {
  id: string;
  className: string;
  title: string;
  subtitle: string;
  source: string;
  icon: LucideIcon;
  summaryCards: readonly WorkbenchCommandSummaryCard[];
  stages: readonly WorkbenchCommandStage[];
  rows: readonly WorkbenchCommandRow[];
  detailTabs: readonly string[];
  totalLabel: string;
  searchPlaceholder: string;
  stageLabel: string;
  filterLabel: string;
  listLabel: string;
  detailLabel: string;
  detailTabsLabel: string;
  detailActionsLabel: string;
  flowLabel: string;
  flowSteps: readonly string[];
  toolbarActions: readonly WorkbenchCommandAction[];
  rowAction: WorkbenchCommandDetailAction;
  detailActions: readonly WorkbenchCommandDetailAction[];
  detailRoute: (row: WorkbenchCommandRow) => string;
  detailDescription: (row: WorkbenchCommandRow) => string;
  metricRoute: (label: string) => string;
  stageRoute: (label: string) => string;
};

const workbenchHomeSummaryCards = [
  { label: '资产总数', value: '6,842', delta: '建账总量', icon: Layers, tone: 'blue' },
  { label: '资产健康度', value: '86', delta: '平台均值', icon: Gauge, tone: 'cyan' },
  { label: '故障设备', value: '36', delta: '需处置', icon: AlertTriangle, tone: 'red' },
  { label: '在保资产价值', value: '¥3,820万', delta: '净值', icon: Database, tone: 'green' },
  { label: '当月维保费用', value: '¥46万', delta: '本月', icon: Wrench, tone: 'orange' },
  { label: '安全评分', value: '92', delta: '较上周 +4', icon: ShieldCheck, tone: 'violet' },
] as const;

const workbenchHomeStages = [
  { label: '聚合', value: '12', note: '业务模块', tone: 'blue' },
  { label: '研判', value: '36', note: '风险事件', tone: 'orange' },
  { label: '派发', value: '24', note: '待派工', tone: 'cyan' },
  { label: '追踪', value: '91.8%', note: '闭环率', tone: 'green' },
  { label: '复盘', value: '14', note: '订阅报表', tone: 'violet' },
] as const;

const workbenchHomeRows = [
  {
    id: 'OPS-20240614-001',
    type: '维保预警',
    entity: '数控车床 CN-301',
    location: '机加车间 / CNC 区域 A线',
    title: '主轴振动异常，建议今日派发预测维保',
    score: '91',
    status: '待派工',
    timing: '1.2h',
    owner: '张三丰',
    contextLabel: '工单/告警联动',
    tone: 'red',
  },
  {
    id: 'OPS-20240614-002',
    type: '流程待办',
    entity: '资产调拨审批',
    location: '制造一部 -> 制造二部',
    title: 'CN-301 跨车间调拨等待负责人审批',
    score: 'P1',
    status: '待审批',
    timing: '2.0h',
    owner: '张经理',
    contextLabel: '审批中心',
    tone: 'orange',
  },
  {
    id: 'OPS-20240614-003',
    type: '数据刷新',
    entity: 'MES 批次同步',
    location: 'A 区 / MES',
    title: '产线与设备采集数据已同步，3 条异常待确认',
    score: '98.6%',
    status: '正常',
    timing: '95ms',
    owner: '平台运维',
    contextLabel: '数据监控',
    tone: 'green',
  },
  {
    id: 'OPS-20240614-004',
    type: '报表订阅',
    entity: '资产价值月报',
    location: '经营分析',
    title: '资产价值趋势和部门统计已生成，待订阅确认',
    score: '14',
    status: '待确认',
    timing: '今日',
    owner: '财务部',
    contextLabel: '报表分析',
    tone: 'blue',
  },
] as const;

const workbenchHomeDetailTabs = ['运营信息', '待办联动', '维保预警', '数据刷新', '报表复盘'] as const;

const workbenchHomeDomains = [
  {
    id: 'command',
    label: '运营驾驶舱',
    value: '86',
    note: '资产健康 / KPI 下钻',
    icon: Gauge,
    route: '/fixed-assets/workbench?menu=home&domain=command',
    children: ['资产健康', '流程待办', '今日工单'],
  },
  {
    id: 'maintenance',
    label: '维保预警',
    value: '5',
    note: '2h 内到期',
    icon: AlertTriangle,
    route: '/workorders?source=workbench&view=predictive',
    children: ['主轴振动', '温度异常', 'SLA 风险'],
  },
  {
    id: 'approval',
    label: '审批派发',
    value: '18',
    note: '跨模块待办',
    icon: ClipboardList,
    route: '/approvals?source=workbench&status=PENDING',
    children: ['资产调拨', '跨部门审批', '备件低储'],
  },
  {
    id: 'report',
    label: '经营复盘',
    value: '14',
    note: '报表订阅',
    icon: BarChart3,
    route: '/reports?source=workbench&view=operations-home',
    children: ['价值趋势', '部门统计', '成本分析'],
  },
] as const;

const workbenchHomeTasks = [
  {
    id: 'OPS-20240614-001',
    category: '维保预警',
    object: '数控车床 CN-301',
    location: '机加车间 / CNC 区域 A线',
    title: '主轴振动异常，建议今日派发预测维保',
    priority: 'P1',
    status: '待派工',
    sla: '1.2h',
    owner: '张三丰',
    context: '工单/告警联动',
    nextAction: '创建预测工单',
    route: buildWorkOrderPrefillPath({
      source: 'quick-action',
      title: '数控车床 CN-301 主轴振动异常预测维保',
      assetName: '数控车床 CN-301',
      assetLocation: '机加车间 / CNC 区域 A线',
      riskState: '主轴振动异常',
      riskScore: 91,
      priority: 'HIGH',
      dueDate: '2026-06-16',
      description: '来自 Workbench 运营首页：主轴振动异常，建议今日派发预测维保。',
    }),
    tone: 'red',
  },
  {
    id: 'OPS-20240614-002',
    category: '流程待办',
    object: 'CN-301 跨车间调拨',
    location: '制造一部 -> 制造二部',
    title: '数控车床 CN-301 跨车间调拨等待负责人审批',
    priority: 'P1',
    status: '待审批',
    sla: '2.0h',
    owner: '张经理',
    context: '资产调拨',
    nextAction: '处理审批',
    route: '/approvals/OPS-20240614-002/process?source=workbench&status=PENDING',
    tone: 'orange',
  },
  {
    id: 'OPS-20240614-003',
    category: '数据刷新',
    object: 'MES 批次同步',
    location: 'A 区 / MES',
    title: '产线与设备采集数据已同步，3 条异常待确认',
    priority: 'P2',
    status: '待确认',
    sla: '95ms',
    owner: '平台运维',
    context: '数据监控',
    nextAction: '查看链路',
    route: '/energy?source=workbench&scope=data-monitoring&event=OPS-20240614-003',
    tone: 'green',
  },
  {
    id: 'OPS-20240614-004',
    category: '报表订阅',
    object: '资产价值月报',
    location: '经营分析',
    title: '资产价值趋势和部门统计已生成，待订阅确认',
    priority: 'P3',
    status: '待确认',
    sla: '今日',
    owner: '财务部',
    context: '报表分析',
    nextAction: '查看报表',
    route: '/reports?source=workbench&view=operations-home',
    tone: 'blue',
  },
] as const;

const workbenchHomeQuickActions = [
  {
    label: '新建预测工单',
    route: workbenchHomeTasks[0].route,
    description: '从运营首页维保预警发起预测工单，预填设备、位置、风险、优先级和截止时间。',
    icon: Wrench,
    primary: true,
  },
  {
    label: '处理流程待办',
    route: '/approvals?source=workbench&status=PENDING',
    description: '进入审批中心，保留运营首页来源和待处理状态。',
    icon: ClipboardList,
  },
  {
    label: '查看经营报表',
    route: '/reports?source=workbench&view=operations-home',
    description: '进入报表分析，承接资产健康、价值趋势和部门统计。',
    icon: BarChart3,
  },
] as const;

const workbenchHomeStateCards = [
  { label: '空态', value: '暂无运营待办', note: '筛选无结果时保留新建工单和报表入口' },
  { label: '异常态', value: '聚合刷新失败', note: '保留上次刷新结果并允许手动重试' },
  { label: '无权限态', value: '运营操作受限', note: '缺少业务权限时展示预览并引导申请' },
] as const;

const workbenchHomeSignals = [
  { label: '资产健康', value: '86', note: '较昨日 +2', tone: 'blue' },
  { label: '流程待办', value: '18', note: 'P1 4 项', tone: 'orange' },
  { label: '今日工单', value: '42', note: '派工 24 单', tone: 'cyan' },
  { label: '维保预警', value: '5', note: '2h 内到期', tone: 'red' },
] as const;

const workbenchEnergySummaryCards = [
  { label: '数据链路总览', value: '98.6%', delta: 'MES/IoT 健康', icon: Activity, tone: 'green' },
  { label: '数据源管理', value: '12', delta: '2 个异常', icon: Database, tone: 'blue' },
  { label: '设备点位', value: '5,102', delta: '实时在线', icon: Server, tone: 'violet' },
  { label: '采集任务', value: '7', delta: '自动补偿', icon: Zap, tone: 'orange' },
  { label: '监控配置', value: '36', delta: '阈值规则', icon: Gauge, tone: 'cyan' },
  { label: '数据事件', value: '32', delta: '未处理', icon: AlertTriangle, tone: 'red' },
] as const;

const workbenchEnergyStages = [
  { label: '接入', value: '12', note: '系统源', tone: 'blue' },
  { label: '采集', value: '5,102', note: '设备点位', tone: 'cyan' },
  { label: '清洗', value: '98.6%', note: '质量分', tone: 'green' },
  { label: '事件', value: '32', note: '异常流水', tone: 'red' },
  { label: '服务', value: '14', note: '订阅导出', tone: 'violet' },
] as const;

const workbenchEnergyRows = [
  {
    id: 'DATA-IOT-GW-A01',
    type: 'IoT 网关',
    entity: 'GW-A01 采集链路',
    location: '机加车间 / CNC 区域 A线',
    title: '设备点位采集延迟高于 P95',
    score: '2.1s',
    status: '待重试',
    timing: '10:24',
    owner: '平台运维',
    contextLabel: '1,256 点位',
    tone: 'orange',
  },
  {
    id: 'DATA-MES-SYNC-08',
    type: 'MES 同步',
    entity: 'MES 批次同步',
    location: '制造一部',
    title: '工单状态与设备采集批次已完成回写',
    score: '99.2%',
    status: '正常',
    timing: '95ms',
    owner: 'MES 接口',
    contextLabel: '工单回写',
    tone: 'green',
  },
  {
    id: 'DATA-ALARM-STREAM',
    type: '事件流',
    entity: '告警事件流',
    location: '安全态势',
    title: '高危告警聚合后等待工单联动确认',
    score: '32',
    status: '待处理',
    timing: '3.2h',
    owner: '安全运营',
    contextLabel: '告警中心',
    tone: 'red',
  },
  {
    id: 'DATA-RPT-SUB',
    type: '指标服务',
    entity: '经营报表订阅',
    location: '报表分析',
    title: '资产价值和维保成本指标已推送订阅任务',
    score: '14',
    status: '已推送',
    timing: '今日',
    owner: '财务部',
    contextLabel: '报表订阅',
    tone: 'blue',
  },
] as const;

const workbenchEnergyDetailTabs = ['链路信息', '采集任务', '异常事件', '重试记录', '订阅导出'] as const;

const workbenchEnergyDomains = [
  {
    id: 'ingestion',
    label: '采集链路',
    value: '12',
    note: 'MES / IoT / PLC',
    icon: Activity,
    route: '/energy?source=workbench&scope=data-monitoring&domain=ingestion',
    children: ['IoT 网关', 'MES 同步', 'PLC 点位'],
  },
  {
    id: 'quality',
    label: '数据质量',
    value: '98.6%',
    note: '清洗 / 去重 / 回补',
    icon: Gauge,
    route: '/energy?source=workbench&scope=data-monitoring&domain=quality',
    children: ['采集延迟', '缺失补偿', '质量规则'],
  },
  {
    id: 'events',
    label: '异常事件',
    value: '32',
    note: '待处理 / 待重试',
    icon: AlertTriangle,
    route: '/energy?source=workbench&scope=data-monitoring&domain=events',
    children: ['延迟事件', '同步失败', '告警联动'],
  },
  {
    id: 'service',
    label: '指标服务',
    value: '14',
    note: '订阅 / 导出 / API',
    icon: Database,
    route: '/energy?source=workbench&scope=data-monitoring&domain=service',
    children: ['报表订阅', '接口推送', '导出队列'],
  },
] as const;

const workbenchEnergyStateCards = [
  { label: '空态', value: '暂无异常事件', note: '筛选无结果时保留链路拓扑、采集任务和订阅入口' },
  { label: '异常态', value: '采集链路异常 2 项', note: 'IoT 网关和 MES 回写延迟时保留上次成功批次' },
  { label: '无权限态', value: '数据重试受限', note: '缺少 dashboard:query 时只能查看摘要并发起权限申请' },
] as const;

const workbenchEnergyServiceCards = [
  { label: '今日吞吐', value: '86.5GB', note: '批量 + 实时数据', tone: 'blue' },
  { label: '回补任务', value: '7', note: '自动补偿中', tone: 'orange' },
  { label: '订阅导出', value: '14', note: '服务在线', tone: 'green' },
  { label: '告警联动', value: '32', note: '关联工单/告警', tone: 'red' },
] as const;

const workbenchEnergyTrendPoints = '0,94 72,72 144,76 216,48 288,54 360,34 432,42 504,24';

const workbenchEnergySourceHealth = [
  { label: 'MES 同步', value: '99.2%', percent: 99, note: '95ms', tone: 'green' },
  { label: 'IoT 网关', value: '96.8%', percent: 97, note: '2.1s', tone: 'cyan' },
  { label: 'PLC 点位', value: '94.6%', percent: 95, note: '1,256 点', tone: 'blue' },
  { label: '事件流', value: '91.8%', percent: 92, note: '32 待处理', tone: 'orange' },
] as const;

const workbenchEnergyExceptionRank = [
  { label: 'GW-A01 采集延迟', value: '18', note: 'P95 2.1s', tone: 'orange' },
  { label: '告警事件待确认', value: '12', note: '待联动工单', tone: 'red' },
  { label: 'MES 回写重试', value: '7', note: '自动补偿中', tone: 'blue' },
] as const;

const workbenchPolicySummaryCards = [
  { label: '风险规则', value: '68', delta: '启用 54', icon: ShieldCheck, tone: 'blue' },
  { label: '角色策略', value: '128', delta: '110 个启用', icon: UserCircle, tone: 'cyan' },
  { label: '审批边界', value: '46', delta: '覆盖 23 部门', icon: ClipboardList, tone: 'green' },
  { label: '策略命中', value: '238', delta: '近 7 天', icon: Bell, tone: 'orange' },
  { label: '高风险待复核', value: '23', delta: '较昨日 +6', icon: AlertTriangle, tone: 'red' },
  { label: '权限申请', value: '9', delta: '待审批', icon: Shield, tone: 'violet' },
] as const;

const workbenchPolicyStages = [
  { label: '定义', value: '68', note: '风险规则', tone: 'blue' },
  { label: '授权', value: '128', note: '角色策略', tone: 'cyan' },
  { label: '命中', value: '238', note: '近 7 天', tone: 'orange' },
  { label: '审批', value: '46', note: '边界规则', tone: 'green' },
  { label: '复盘', value: '23', note: '高危规则', tone: 'red' },
] as const;

const workbenchPolicyRows = [
  {
    id: 'POL-RISK-PORT-001',
    type: '风险规则',
    entity: '高危端口暴露',
    location: '安全态势 / IoT 网关',
    title: '端口暴露命中高危策略，需要安全复核',
    score: 'P1',
    status: '启用',
    timing: '实时',
    owner: '安全运营',
    contextLabel: '影响 366 端口',
    tone: 'red',
  },
  {
    id: 'POL-MAINT-SLA-008',
    type: '审批边界',
    entity: '维保逾期联动',
    location: '资产运维中心',
    title: '逾期维保自动转工单并要求班组确认',
    score: 'P2',
    status: '启用',
    timing: '24h',
    owner: '运维主管',
    contextLabel: '工单联动',
    tone: 'orange',
  },
  {
    id: 'POL-ROLE-ASSET-012',
    type: '角色策略',
    entity: '资产处置审批边界',
    location: '制造一部 / 财务部',
    title: '高价值资产处置需跨部门审批',
    score: '46',
    status: '待复核',
    timing: '本周',
    owner: '组织管理员',
    contextLabel: '审批中心',
    tone: 'blue',
  },
  {
    id: 'POL-POSITION-006',
    type: '风险规则',
    entity: '位置漂移复核',
    location: '物流区 / AGV',
    title: '资产定位漂移超过阈值时生成巡检任务',
    score: 'P2',
    status: '启用',
    timing: '实时',
    owner: '物流运维',
    contextLabel: '巡检联动',
    tone: 'green',
  },
] as const;

const workbenchPolicyDetailTabs = ['规则信息', '角色策略', '审批边界', '命中记录', '权限申请'] as const;

const workbenchPolicyDomains = [
  {
    id: 'rules',
    label: '风险规则',
    value: '68',
    note: '阈值/范围/动作',
    icon: ShieldCheck,
    route: '/risk-matrix?source=workbench&scope=policy&domain=rules',
    children: ['端口暴露', '维保逾期', '位置漂移'],
  },
  {
    id: 'roles',
    label: '角色策略',
    value: '128',
    note: '查看/编辑/审批',
    icon: UserCircle,
    route: '/system/roles?source=workbench&scope=policy',
    children: ['安全运营', '运维主管', '组织管理员'],
  },
  {
    id: 'boundaries',
    label: '审批边界',
    value: '46',
    note: '金额/风险/跨部门',
    icon: ClipboardList,
    route: '/approvals?source=workbench&scope=policy-boundary',
    children: ['高危复核', '资产处置', '跨部门调拨'],
  },
  {
    id: 'hits',
    label: '命中样本',
    value: '238',
    note: '近 7 天',
    icon: Bell,
    route: '/risk-matrix?source=workbench&scope=policy&view=hits',
    children: ['安全告警', '维保工单', '巡检异常'],
  },
  {
    id: 'access',
    label: '权限申请',
    value: '9',
    note: '待审批',
    icon: Shield,
    route: '/approvals/new?source=workbench&type=policy',
    children: ['规则查看', '规则编辑', '高危停用'],
  },
] as const;

const workbenchPolicyRuleDetails = [
  {
    id: 'POL-RISK-PORT-001',
    condition: '开放高危端口且 IoT 网关暴露到非白名单网段',
    trigger: '安全告警 / IoT 网关',
    boundary: 'P1 直接进入安全复核',
    rolePolicy: '安全运营可编辑，运维主管只读',
    approval: '安全运营 + 资产负责人',
    hit: 'ALM-20240614-0012',
    suggestion: '确认端口白名单，生成告警处置工单并复盘策略命中。',
    danger: '停用后高危端口告警不再自动拦截，需要二次确认。',
    route: '/risk-matrix?source=workbench&scope=policy&rule=POL-RISK-PORT-001',
  },
  {
    id: 'POL-MAINT-SLA-008',
    condition: '预测维保工单逾期 24h 且设备健康分低于 82',
    trigger: '工单管理 / 资产运维',
    boundary: 'P2 自动转派班组并要求复核',
    rolePolicy: '运维主管可编辑，班组长可处理',
    approval: '运维主管 + 设备负责人',
    hit: 'WO-20240614-0012',
    suggestion: '自动创建补救工单，带入 SLA 风险和备件需求。',
    danger: '停用后逾期维保不再自动转派，需人工巡检。',
    route: '/risk-matrix?source=workbench&scope=policy&rule=POL-MAINT-SLA-008',
  },
  {
    id: 'POL-ROLE-ASSET-012',
    condition: '高价值资产处置金额超过 50 万或跨部门流转',
    trigger: '资产处置 / 财务复核',
    boundary: '跨部门审批边界',
    rolePolicy: '组织管理员可维护，财务部可审批',
    approval: '制造一部 + 财务部',
    hit: 'APP-20240614-0038',
    suggestion: '补齐处置原因、残值口径和财务复核记录。',
    danger: '变更审批边界会影响高价值资产处置链路。',
    route: '/risk-matrix?source=workbench&scope=policy&rule=POL-ROLE-ASSET-012',
  },
  {
    id: 'POL-POSITION-006',
    condition: 'AGV 区域资产定位漂移超过 12 米且持续 15 分钟',
    trigger: '巡检管理 / 物流区定位',
    boundary: 'P2 自动生成巡检复核',
    rolePolicy: '物流运维可处理，安全运营可复盘',
    approval: '物流运维 + 巡检主管',
    hit: 'INSP-20240614-0066',
    suggestion: '生成巡检任务并校准点位，必要时联动位置维护。',
    danger: '停用后位置漂移不再自动生成巡检任务。',
    route: '/risk-matrix?source=workbench&scope=policy&rule=POL-POSITION-006',
  },
] as const;

const workbenchPolicyRoleMatrix = [
  { role: '安全运营', department: '安全态势', visible: '全部风险', editable: '高危规则', approval: 'P1 复核', status: '已授权' },
  { role: '运维主管', department: '资产运维', visible: '维保/工单', editable: 'SLA 边界', approval: 'P2 转派', status: '已授权' },
  { role: '组织管理员', department: '平台治理', visible: '角色策略', editable: '审批边界', approval: '权限申请', status: '待复核' },
] as const;

const workbenchPolicyBoundaryCards = [
  { label: '高危安全复核', value: 'P1', note: '端口暴露、越权访问、凭证异常直接进入安全复核。' },
  { label: '资产处置边界', value: '50万+', note: '高价值处置需制造、财务和资产负责人共同审批。' },
  { label: '跨部门调拨', value: '双负责人', note: '调出/调入部门同时确认，保留 Workbench 来源。' },
] as const;

const workbenchPolicyHitSamples = [
  { id: 'ALM-20240614-0012', source: '告警中心', rule: 'POL-RISK-PORT-001', result: '已转处置工单', tone: 'red' },
  { id: 'WO-20240614-0012', source: '工单管理', rule: 'POL-MAINT-SLA-008', result: 'SLA 复核中', tone: 'orange' },
  { id: 'APP-20240614-0038', source: '流程待办', rule: 'POL-ROLE-ASSET-012', result: '跨部门审批', tone: 'blue' },
] as const;

const workbenchPolicyStateCards = [
  { label: '空态', value: '暂无策略命中', note: '筛选无结果时保留新建评估和权限申请入口' },
  { label: '异常态', value: '规则同步异常 2 条', note: '策略引擎延迟时保留上次命中和重试入口' },
  { label: '无权限态', value: '风险评估受限', note: '缺少 risk:query 时只允许申请策略权限' },
] as const;

const workbenchSettingsSummaryCards = [
  { label: '资产分类', value: '256', delta: '启用中', icon: Layers, tone: 'blue' },
  { label: '位置节点', value: '86', delta: '厂区/楼层/点位', icon: MapPin, tone: 'cyan' },
  { label: '供应商', value: '128', delta: '12 个待复核', icon: UserCircle, tone: 'orange' },
  { label: '编号规则', value: '18', delta: '资产/备件/工单', icon: FileText, tone: 'green' },
  { label: '集成源', value: '7', delta: '2 个需复核', icon: Database, tone: 'red' },
  { label: '配置健康', value: '98.6%', delta: '命中率', icon: Settings, tone: 'violet' },
] as const;

const workbenchSettingsStages = [
  { label: '分类', value: '256', note: '资产/备件', tone: 'blue' },
  { label: '位置', value: '86', note: '厂区点位', tone: 'cyan' },
  { label: '供应商', value: '128', note: '资质维护', tone: 'orange' },
  { label: '编号', value: '18', note: '规则启用', tone: 'green' },
  { label: '集成', value: '7', note: 'MES/IoT', tone: 'red' },
] as const;

const workbenchSettingsRows = [
  {
    id: 'CFG-CAT-ASSET',
    type: '资产分类',
    entity: '生产设备分类',
    location: '基础数据',
    title: '生产设备、动力设备、物流设备分类结构维护',
    score: '256',
    status: '启用',
    timing: '今日',
    owner: '系统管理员',
    contextLabel: '资产台账',
    tone: 'blue',
  },
  {
    id: 'CFG-LOC-CNC-A',
    type: '位置管理',
    entity: 'CNC 区域 A线',
    location: '机加车间',
    title: '设备点位、巡检路线和资产归属位置维护',
    score: '86',
    status: '启用',
    timing: '10:24',
    owner: '运维主管',
    contextLabel: '巡检路线',
    tone: 'green',
  },
  {
    id: 'CFG-VDR-SPARE',
    type: '供应商',
    entity: 'UNIVIEW 备件仓',
    location: '备件管理',
    title: '备件供应商资质和 ETA 规则待复核',
    score: '12',
    status: '待复核',
    timing: '本周',
    owner: '采购员',
    contextLabel: '备件采购',
    tone: 'orange',
  },
  {
    id: 'CFG-INT-MES',
    type: '集成源',
    entity: 'MES 同步账号',
    location: '数据监控',
    title: 'MES/IoT 集成账号与同步频率配置',
    score: '98.6%',
    status: '正常',
    timing: '95ms',
    owner: '平台运维',
    contextLabel: '数据链路',
    tone: 'cyan',
  },
] as const;

const workbenchSettingsDetailTabs = ['维护信息', '分类位置', '供应商', '编号规则', '集成源'] as const;

const buildWorkbenchCommandConfig = (
  id: string,
  routeBase: string,
  title: string,
  subtitle: string,
  source: string,
  icon: LucideIcon,
  className: string,
  summaryCards: readonly WorkbenchCommandSummaryCard[],
  stages: readonly WorkbenchCommandStage[],
  rows: readonly WorkbenchCommandRow[],
  detailTabs: readonly string[],
  toolbarActions: readonly WorkbenchCommandAction[],
  rowAction: WorkbenchCommandDetailAction,
  detailActions: readonly WorkbenchCommandDetailAction[],
): WorkbenchCommandPageConfig => ({
  id,
  className,
  title,
  subtitle,
  source,
  icon,
  summaryCards,
  stages,
  rows,
  detailTabs,
  totalLabel: `共 ${rows.length * 18} 条`,
  searchPlaceholder: `搜索${title}编号 / 名称 / 上下文 / 责任人`,
  stageLabel: `${title}流程阶段`,
  filterLabel: `${title}查询筛选栏`,
  listLabel: `${title}列表`,
  detailLabel: `${title}详情抽屉`,
  detailTabsLabel: `${title}详情标签`,
  detailActionsLabel: `${title}详情操作`,
  flowLabel: `${title}流转`,
  flowSteps: ['聚合', '研判', '处理', '复核', '闭环'],
  toolbarActions,
  rowAction,
  detailActions,
  detailRoute: (row) => `${routeBase}/${encodeURIComponent(row.id)}?source=workbench&menu=${id}`,
  detailDescription: (row) => `打开 ${row.entity}，带入 ${title} 来源、状态 ${row.status} 和上下文 ${row.contextLabel}。`,
  metricRoute: (label) => `${routeBase}?source=workbench&metric=${encodeURIComponent(label)}`,
  stageRoute: (label) => `${routeBase}?source=workbench&stage=${encodeURIComponent(label)}`,
});

const workbenchHomeConfig = buildWorkbenchCommandConfig(
  'home',
  '/fixed-assets/workbench',
  '运营首页',
  'KPI 下钻 · 待办联动 · 维保预警',
  '运营首页页面',
  Home,
  'workspace-home-page',
  workbenchHomeSummaryCards,
  workbenchHomeStages,
  workbenchHomeRows,
  workbenchHomeDetailTabs,
  [
    { label: '处理流程待办', actionIndex: 0, icon: ClipboardList },
    { label: '新建预测工单', actionIndex: 1, icon: Wrench, primary: true },
    { label: '查看经营报表', actionIndex: 2, icon: BarChart3 },
  ],
  {
    label: '处理',
    title: '处理运营事项',
    route: (row) => `/approvals/${encodeURIComponent(row.id)}/process?source=workbench`,
    description: (row) => `处理 ${row.title}，保留运营首页上下文和责任人 ${row.owner}。`,
    primaryLabel: '进入处理',
    icon: ClipboardList,
  },
  [
    {
      label: '处理待办',
      title: '处理流程待办',
      route: (row) => `/approvals/${encodeURIComponent(row.id)}/process?source=workbench`,
      description: (row) => `处理 ${row.id}，带入 KPI、待办和 SLA 上下文。`,
      primaryLabel: '进入待办',
      icon: ClipboardList,
    },
    {
      label: '创建工单',
      title: '新建预测工单',
      route: (row) =>
        buildWorkOrderPrefillPath({
          source: 'quick-action',
          title: `${row.entity} 运营预警工单`,
          assetName: row.entity,
          assetLocation: row.location,
          riskState: row.status,
          riskScore: 91,
          priority: 'HIGH',
          dueDate: '2026-06-16',
          description: `来自 Workbench 运营首页：${row.title}`,
        }),
      description: (row) => `为 ${row.entity} 创建预测维保工单。`,
      primaryLabel: '创建工单',
      icon: Wrench,
      primary: true,
    },
    {
      label: '查看报表',
      title: '查看经营报表',
      route: () => '/reports?source=workbench&view=operations-home',
      description: () => '进入报表分析，承接运营首页中的资产健康、价值趋势和部门统计。',
      primaryLabel: '进入报表',
      icon: BarChart3,
    },
  ],
);

const workbenchEnergyConfig = buildWorkbenchCommandConfig(
  'energy',
  '/energy',
  '数据监控',
  '数据链路 · 采集事件 · 指标服务',
  '数据监控页面',
  Activity,
  'workspace-energy-page',
  workbenchEnergySummaryCards,
  workbenchEnergyStages,
  workbenchEnergyRows,
  workbenchEnergyDetailTabs,
  [
    { label: '查看数据链路', actionIndex: 0, icon: Activity },
    { label: '订阅异常报表', actionIndex: 1, icon: Bell },
    { label: '重试采集任务', actionIndex: 2, icon: Zap, primary: true },
  ],
  {
    label: '处理',
    title: '处理数据事件',
    route: (row) => `/energy?source=workbench&scope=data-monitoring&event=${encodeURIComponent(row.id)}`,
    description: (row) => `处理 ${row.entity}，保留链路、事件和重试上下文。`,
    primaryLabel: '进入事件',
    icon: Zap,
  },
  [
    {
      label: '链路详情',
      title: '查看数据链路',
      route: (row) => `/energy?source=workbench&scope=data-monitoring&link=${encodeURIComponent(row.id)}`,
      description: (row) => `查看 ${row.entity} 的采集延迟、质量分和异常流水。`,
      primaryLabel: '进入链路',
      icon: Activity,
    },
    {
      label: '重试任务',
      title: '重试采集任务',
      route: (row) => `/energy?source=workbench&scope=data-monitoring&event=${encodeURIComponent(row.id)}&retry=true`,
      description: (row) => `重试 ${row.entity}，保留事件和采集任务上下文。`,
      primaryLabel: '重试采集',
      icon: Zap,
      primary: true,
    },
    {
      label: '订阅报表',
      title: '订阅异常报表',
      route: () => '/reports?source=workbench&view=data-monitoring&subscribe=true',
      description: () => '订阅数据监控异常报表，保留链路和事件筛选。',
      primaryLabel: '进入订阅',
      icon: BarChart3,
    },
  ],
);

const workbenchPolicyConfig = buildWorkbenchCommandConfig(
  'policy',
  '/risk-matrix',
  '组织策略',
  '风险规则 · 角色策略 · 审批边界',
  '组织策略页面',
  ShieldCheck,
  'workspace-policy-page',
  workbenchPolicySummaryCards,
  workbenchPolicyStages,
  workbenchPolicyRows,
  workbenchPolicyDetailTabs,
  [
    { label: '查看策略规则', actionIndex: 0, icon: ShieldCheck },
    { label: '复核高危规则', actionIndex: 1, icon: AlertTriangle },
    { label: '新建风险评估', actionIndex: 2, icon: Shield, primary: true },
  ],
  {
    label: '复核',
    title: '复核策略规则',
    route: (row) => `/risk-matrix?source=workbench&scope=policy&rule=${encodeURIComponent(row.id)}`,
    description: (row) => `复核 ${row.entity}，保留角色策略和审批边界上下文。`,
    primaryLabel: '进入复核',
    icon: ShieldCheck,
  },
  [
    {
      label: '规则详情',
      title: '查看策略规则',
      route: (row) => `/risk-matrix?source=workbench&scope=policy&rule=${encodeURIComponent(row.id)}`,
      description: (row) => `查看 ${row.entity} 的阈值、命中记录和审批边界。`,
      primaryLabel: '进入规则',
      icon: ShieldCheck,
    },
    {
      label: '权限申请',
      title: '申请策略权限',
      route: (row) => `/approvals/new?source=workbench&type=policy&rule=${encodeURIComponent(row.id)}`,
      description: (row) => `为 ${row.entity} 发起策略权限申请。`,
      primaryLabel: '发起申请',
      icon: ClipboardList,
    },
    {
      label: '新建评估',
      title: '新建风险评估',
      route: () => '/risk-assessments/new?source=workbench&scope=policy',
      description: () => '进入风险评估新建页，预填组织策略和审批边界上下文。',
      primaryLabel: '新建评估',
      icon: Shield,
      primary: true,
    },
  ],
);

const workbenchSettingsConfig = buildWorkbenchCommandConfig(
  'settings',
  '/settings/sysconfig',
  '基础维护',
  '分类位置 · 供应商 · 集成配置',
  '基础维护页面',
  Settings,
  'workspace-settings-page',
  workbenchSettingsSummaryCards,
  workbenchSettingsStages,
  workbenchSettingsRows,
  workbenchSettingsDetailTabs,
  [
    { label: '打开基础维护', actionIndex: 0, icon: Settings },
    { label: '维护资产分类', actionIndex: 2, icon: Layers, primary: true },
    { label: '维护供应商', actionIndex: 3, icon: UserCircle },
  ],
  {
    label: '维护',
    title: '维护基础配置',
    route: (row) => `/settings/sysconfig?source=workbench&config=${encodeURIComponent(row.id)}`,
    description: (row) => `维护 ${row.entity}，保留分类、位置、供应商和集成配置上下文。`,
    primaryLabel: '进入维护',
    icon: Settings,
  },
  [
    {
      label: '系统配置',
      title: '打开基础维护',
      route: (row) => `/settings/sysconfig?source=workbench&config=${encodeURIComponent(row.id)}`,
      description: (row) => `打开 ${row.entity} 的系统配置详情。`,
      primaryLabel: '进入配置',
      icon: Settings,
    },
    {
      label: '资产分类',
      title: '维护资产分类',
      route: () => '/categories?source=workbench',
      description: () => '进入资产分类维护页，承接基础维护下的分类二级能力。',
      primaryLabel: '进入分类',
      icon: Layers,
      primary: true,
    },
    {
      label: '供应商',
      title: '维护供应商',
      route: () => '/vendors?source=workbench',
      description: () => '进入供应商维护页，承接基础维护下的供应商二级能力。',
      primaryLabel: '进入供应商',
      icon: UserCircle,
    },
  ],
);

const workbenchSettingsDomains = [
  {
    id: 'category',
    label: '资产分类',
    value: '256',
    note: '生产/动力/物流/备件',
    icon: Layers,
    route: '/categories?source=workbench',
    children: ['生产设备', '动力设备', '检测仪器'],
  },
  {
    id: 'location',
    label: '位置管理',
    value: '86',
    note: '厂区/车间/点位',
    icon: MapPin,
    route: '/locations?source=workbench',
    children: ['A 厂区', '机加车间', 'CNC 区域 A线'],
  },
  {
    id: 'vendor',
    label: '供应商',
    value: '128',
    note: '资质/ETA/联系人',
    icon: UserCircle,
    route: '/vendors?source=workbench',
    children: ['备件供应商', '维保服务商', '设备厂商'],
  },
  {
    id: 'numbering',
    label: '编号规则',
    value: '18',
    note: '资产/备件/工单',
    icon: FileText,
    route: '/settings/sysconfig?source=workbench&group=numbering',
    children: ['资产编码', '工单编码', '备件编码'],
  },
  {
    id: 'integration',
    label: '集成源',
    value: '7',
    note: 'MES/IoT/财务',
    icon: Database,
    route: '/settings/webhook?source=workbench',
    children: ['MES 同步', 'IoT 网关', '财务折旧'],
  },
] as const;

const workbenchSettingsObjects = [
  {
    id: 'CFG-CAT-ASSET',
    domain: 'category',
    type: '资产分类',
    name: '生产设备分类体系',
    owner: '系统管理员',
    status: '启用',
    scope: '资产台账 / 报表分析',
    impact: '关联资产 4,286 台',
    lastSync: '今天 10:24',
    health: '99.2%',
    risk: '低',
    change: '新增检测仪器三级分类，影响资产录入与折旧报表口径。',
    route: '/categories?source=workbench&category=CFG-CAT-ASSET',
    tone: 'blue',
  },
  {
    id: 'CFG-LOC-CNC-A',
    domain: 'location',
    type: '位置管理',
    name: 'CNC 区域 A线点位',
    owner: '运维主管',
    status: '启用',
    scope: '巡检路线 / 设备台账',
    impact: '关联设备 68 台',
    lastSync: '今天 09:48',
    health: '98.8%',
    risk: '低',
    change: '点位坐标已同步至巡检路线，移动设备需复核二维码位置。',
    route: '/locations?source=workbench&node=CFG-LOC-CNC-A',
    tone: 'green',
  },
  {
    id: 'CFG-VDR-SPARE',
    domain: 'vendor',
    type: '供应商',
    name: 'UNIVIEW 备件仓资质',
    owner: '采购员',
    status: '待复核',
    scope: '备件采购 / 工单备件',
    impact: '关联工单 12 张',
    lastSync: '昨天 17:10',
    health: '84.5%',
    risk: '中',
    change: '供应商资质证照即将到期，ETA 规则影响低储补货建议。',
    route: '/vendors?source=workbench&vendor=CFG-VDR-SPARE',
    tone: 'orange',
  },
  {
    id: 'CFG-NO-ASSET',
    domain: 'numbering',
    type: '编号规则',
    name: '资产编码规则',
    owner: '平台运维',
    status: '启用',
    scope: '资产新建 / 导入',
    impact: '今日生成 126 个编号',
    lastSync: '今天 08:30',
    health: '100%',
    risk: '低',
    change: '编码前缀按厂区 + 类别生成，导入模板已锁定重复校验。',
    route: '/settings/sysconfig?source=workbench&rule=CFG-NO-ASSET',
    tone: 'cyan',
  },
  {
    id: 'CFG-INT-MES',
    domain: 'integration',
    type: '集成源',
    name: 'MES 同步账号',
    owner: '平台运维',
    status: '同步异常',
    scope: '数据监控 / 设备状态',
    impact: '影响采集设备 42 台',
    lastSync: '5 分钟前',
    health: '91.6%',
    risk: '高',
    change: 'MES Token 即将轮换，部分设备采集延迟升高，需要复核同步频率。',
    route: '/settings/webhook?source=workbench&integration=CFG-INT-MES',
    tone: 'red',
  },
] as const;

const workbenchSettingsStateCards = [
  { label: '空态', value: '暂无待维护配置', note: '筛选无结果时保留新建和导入入口' },
  { label: '异常态', value: '同步异常 1 项', note: 'MES 集成源需复核频率和凭证' },
  { label: '无权限态', value: '供应商资质受限', note: '缺少供应商权限时只展示预览和申请入口' },
] as const;

function WorkbenchCommandPage({
  item,
  context,
  meta,
  onPreviewAction,
  config,
}: WorkbenchMenuPageProps & { config: WorkbenchCommandPageConfig }) {
  const [selectedRowId, setSelectedRowId] = useState(config.rows[0].id);
  const [detailTab, setDetailTab] = useState(config.detailTabs[0]);
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedRow = config.rows.find((row) => row.id === selectedRowId) ?? config.rows[0];
  const PageIcon = config.icon;

  const openCommandPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = config.icon,
  ) => {
    onPreviewAction({
      title,
      source: config.source,
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const runToolbarAction = (action: WorkbenchCommandAction) => {
    if (action.actionIndex !== undefined && meta.actions[action.actionIndex]) {
      onPreviewAction(meta.actions[action.actionIndex]);
      return;
    }

    openCommandPreview(
      action.title ?? action.label,
      action.routeTarget ?? config.metricRoute(action.label),
      action.description ?? `进入${config.title}的${action.label}能力，保留 Workbench 来源和当前筛选上下文。`,
      action.primaryLabel ?? action.label,
      action.icon,
    );
  };

  const openRow = (row: WorkbenchCommandRow) => {
    setSelectedRowId(row.id);
    setDetailOpen(true);
    openCommandPreview(
      `打开${config.title}详情`,
      config.detailRoute(row),
      config.detailDescription(row),
      '打开详情',
      config.icon,
    );
  };

  const runDetailAction = (action: WorkbenchCommandDetailAction, row: WorkbenchCommandRow) => {
    openCommandPreview(
      action.title,
      action.route(row),
      action.description(row),
      action.primaryLabel,
      action.icon,
    );
  };

  return (
    <section className={`workspace-orders-page ${config.className}`} aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-orders-shell" aria-label={`${config.title}产品页主体`}>
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><PageIcon /></span>
              <div>
                <h2>{config.title}</h2>
                <p>{config.subtitle}</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label={`${config.title}顶部操作`}>
              {config.toolbarActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={action.primary ? 'is-primary' : 'is-secondary'}
                    onClick={() => runToolbarAction(action)}
                  >
                    <ActionIcon />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label={`${config.title}核心指标`}>
            {config.summaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openCommandPreview(
                      `${card.label}${config.title}`,
                      config.metricRoute(card.label),
                      `按 ${card.label} 下钻${config.title}，保留当前厂区、角色和 Workbench 来源。`,
                      '查看详情',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label={config.stageLabel}>
            {config.stages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openCommandPreview(
                    `${stage.label}${config.title}`,
                    config.stageRoute(stage.label),
                    `按 ${stage.label} 阶段查看${config.title}的业务队列和处理状态。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label={config.filterLabel}>
            <label>
              <Search />
              <input readOnly value={config.searchPlaceholder} aria-label={`${config.title}搜索`} />
            </label>
            {['范围 全部', '状态 全部', '责任人 全部', '优先级 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => runToolbarAction(config.toolbarActions[0])}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openCommandPreview(
                  `${config.title}时间筛选`,
                  `${config.metricRoute('today')}&date=today`,
                  `查看今日${config.title}数据，保留当前上下文。`,
                  '查看今日',
                  CalendarDays,
                )
              }
            >
              处理时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => runToolbarAction(config.toolbarActions[0])}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label={config.listLabel}>
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label={`选择全部${config.title}`} readOnly /></span>
              <span>编号</span>
              <span>类型</span>
              <span>对象信息</span>
              <span>业务事项</span>
              <span>评分</span>
              <span>状态</span>
              <span>时效</span>
              <span>责任人</span>
              <span>上下文</span>
              <span>操作</span>
            </div>
            {config.rows.map((row) => (
              <div
                key={row.id}
                className={`workspace-orders-table-row is-${row.tone} ${row.id === selectedRow.id ? 'is-selected' : ''}`}
              >
                <span><input type="checkbox" aria-label={`选择${row.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openRow(row)}>{row.id}</button>
                <span><em>{row.type}</em></span>
                <span>
                  <strong>{row.entity}</strong>
                  <small>{row.location}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openRow(row)}>{row.title}</button>
                <span><b>{row.score}</b></span>
                <span><i>{row.status}</i></span>
                <span>{row.timing}</span>
                <span>{row.owner}</span>
                <span><em className="is-spare">{row.contextLabel}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedRowId(row.id);
                      setDetailOpen(true);
                      runDetailAction(config.rowAction, row);
                    }}
                  >
                    {config.rowAction.label}
                  </button>
                  <button type="button" className="is-more" aria-label={`${row.id}更多操作`} onClick={() => openRow(row)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label={`${config.title}分页`}>
            <span>{config.totalLabel}</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label={config.detailLabel}>
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>{config.title}详情</strong>
              <button type="button" aria-label={`关闭${config.title}详情`} onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label={`当前${config.title}信息`}>
              <div>
                <b>{selectedRow.score}</b>
                <span>
                  <strong>{selectedRow.id}</strong>
                  <small>{selectedRow.status}</small>
                </span>
              </div>
              <h3>{selectedRow.title}</h3>
              <dl>
                <div><dt>类型</dt><dd>{selectedRow.type}</dd></div>
                <div><dt>评分</dt><dd>{selectedRow.score}</dd></div>
                <div><dt>对象</dt><dd>{selectedRow.entity}</dd></div>
                <div><dt>位置</dt><dd>{selectedRow.location}</dd></div>
                <div><dt>责任人</dt><dd>{selectedRow.owner}</dd></div>
                <div><dt>时效</dt><dd>{selectedRow.timing}</dd></div>
                <div><dt>上下文</dt><dd>{selectedRow.contextLabel}</dd></div>
                <div><dt>状态</dt><dd>{selectedRow.status}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label={config.flowLabel}>
              {config.flowSteps.map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '已完成' : index === 2 ? '进行中' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label={config.detailTabsLabel}>
              {config.detailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>业务摘要</span>
                <p>{selectedRow.title}，当前状态为 {selectedRow.status}，上下文为 {selectedRow.contextLabel}。</p>
              </article>
              <article>
                <span>预填上下文</span>
                <ul>
                  <li>{selectedRow.entity} <b>已带入</b></li>
                  <li>{selectedRow.location} <b>已定位</b></li>
                  <li>{selectedRow.owner} <b className="is-warning">需确认</b></li>
                </ul>
              </article>
              <article>
                <span>处理建议</span>
                <p>按当前角色权限进入真实业务页处理，Workbench 只承接入口、上下文和预览反馈。</p>
              </article>
              <article>
                <span>关联记录</span>
                <ul>
                  <li>WO-20240614-0012 <small>工单联动</small></li>
                  <li>RPT-ASSET-VALUE-001 <small>报表追踪</small></li>
                  <li>ALM-20240614-0012 <small>告警复盘</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label={config.detailActionsLabel}>
              {config.detailActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={action.primary ? 'is-primary' : ''}
                  onClick={() => runDetailAction(action, selectedRow)}
                >
                  {action.label}
                </button>
              ))}
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <PageIcon />
            <strong>选择左侧{config.title}事项打开详情</strong>
            <span>详情抽屉会展示上下文、流转、处理建议和关联记录。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchHomePage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState<(typeof workbenchHomeDomains)[number]['id']>('command');
  const [selectedTaskId, setSelectedTaskId] = useState(workbenchHomeTasks[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchHomeDetailTabs)[number]>('运营信息');
  const selectedDomainMeta =
    workbenchHomeDomains.find((domain) => domain.id === selectedDomain) ?? workbenchHomeDomains[0];
  const selectedTask = workbenchHomeTasks.find((task) => task.id === selectedTaskId) ?? workbenchHomeTasks[0];
  const canCreateWorkOrder = canAccessRoute('/workorders/new', user);
  const canOpenReports = canAccessRoute('/reports', user);

  const openHomePreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Home,
  ) => {
    onPreviewAction({
      title,
      source: '运营首页页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openTask = (task: (typeof workbenchHomeTasks)[number]) => {
    setSelectedTaskId(task.id);
    openHomePreview(
      '打开运营首页详情',
      task.route,
      `打开 ${task.object}，带入 ${task.category}、${task.status}、${task.context} 和责任人 ${task.owner}。`,
      task.nextAction,
      task.category === '维保预警' ? Wrench : ClipboardList,
    );
  };

  return (
    <section className="workspace-orders-page workspace-home-page workspace-home-product" aria-label={`${item.label}真实产品页`}>
      <aside className="workspace-home-command" aria-label="运营首页指挥入口">
        <header>
          <span><Home /></span>
          <div>
            <h2>运营首页</h2>
            <p>KPI 下钻 · 待办联动 · 维保预警</p>
          </div>
        </header>
        <section className="workspace-home-domain-list" aria-label="运营首页运营域">
          {workbenchHomeDomains.map((domain) => {
            const DomainIcon = domain.icon;
            return (
              <button
                key={domain.id}
                type="button"
                className={domain.id === selectedDomain ? 'is-active' : ''}
                onClick={() => setSelectedDomain(domain.id)}
              >
                <DomainIcon />
                <span>
                  <strong>{domain.label}</strong>
                  <small>{domain.note}</small>
                </span>
                <b>{domain.value}</b>
              </button>
            );
          })}
        </section>
        <section className="workspace-home-domain-children" aria-label="运营首页二级运营域">
          <span>{selectedDomainMeta.label}二级项</span>
          {selectedDomainMeta.children.map((child) => (
            <button
              key={child}
              type="button"
              onClick={() =>
                openHomePreview(
                  `${child}下钻`,
                  `${selectedDomainMeta.route}&node=${encodeURIComponent(child)}`,
                  `进入 ${child} 视角，保留 Workbench 运营首页来源和当前运营域。`,
                  '进入下钻',
                  selectedDomainMeta.icon,
                )
              }
            >
              {child}
              <ArrowRight />
            </button>
          ))}
        </section>
        <section className="workspace-home-states" aria-label="运营首页状态反馈">
          {workbenchHomeStateCards.map((state) => (
            <article key={state.label}>
              <span>{state.label}</span>
              <strong>{state.value}</strong>
              <p>{state.note}</p>
            </article>
          ))}
        </section>
      </aside>

      <section className="workspace-home-center" aria-label="运营首页产品页主体">
        <header className="workspace-home-header">
          <div>
            <span>资产运营中枢</span>
            <h2>运营首页</h2>
            <p>把 Dashboard KPI、待办、最近工单和维保预警收敛成默认入口，先研判再进入业务页处理。</p>
          </div>
          <div className="workspace-orders-toolbar" aria-label="运营首页顶部操作">
            {workbenchHomeQuickActions.map((action) => {
              const ActionIcon = action.icon;
              const disabled = action.label === '新建预测工单' && !canCreateWorkOrder;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={action.primary ? 'is-primary' : 'is-secondary'}
                  disabled={disabled}
                  onClick={() =>
                    openHomePreview(
                      action.label,
                      action.route,
                      disabled ? '当前账号暂无新建工单权限，可先查看详情或申请权限。' : action.description,
                      disabled ? '暂无权限' : action.label,
                      ActionIcon,
                    )
                  }
                >
                  <ActionIcon />
                  {disabled ? '暂无权限' : action.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="workspace-home-kpis" aria-label="运营首页核心指标">
          {workbenchHomeSignals.map((signal) => (
            <button
              key={signal.label}
              type="button"
              className={`is-${signal.tone}`}
              onClick={() =>
                openHomePreview(
                  `${signal.label}下钻`,
                  `/fixed-assets/workbench?menu=home&metric=${encodeURIComponent(signal.label)}`,
                  `按 ${signal.label} 下钻运营首页，保留资产运营中枢来源和当前筛选。`,
                  '查看指标',
                  Gauge,
                )
              }
            >
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.note}</small>
            </button>
          ))}
        </div>

        <div className="workspace-home-stage-row" aria-label="运营首页流程阶段">
          {workbenchHomeStages.map((stage) => (
            <button
              key={stage.label}
              type="button"
              className={`is-${stage.tone}`}
              onClick={() =>
                openHomePreview(
                  `${stage.label}阶段`,
                  `/fixed-assets/workbench?menu=home&stage=${encodeURIComponent(stage.label)}`,
                  `按 ${stage.label} 阶段查看运营事项、待办和闭环状态。`,
                  '查看阶段',
                  ArrowRight,
                )
              }
            >
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
              <small>{stage.note}</small>
            </button>
          ))}
        </div>

        <section className="workspace-home-launcher" aria-label="运营首页快捷发起">
          {workbenchHomeQuickActions.map((action) => {
            const ActionIcon = action.icon;
            const disabled = action.label === '新建预测工单' && !canCreateWorkOrder;
            return (
              <button
                key={action.label}
                type="button"
                className={action.primary ? 'is-primary' : ''}
                disabled={disabled}
                onClick={() =>
                  openHomePreview(
                    action.label,
                    action.route,
                    disabled ? '当前账号暂无新建工单权限，可在详情中申请权限。' : action.description,
                    disabled ? '暂无权限' : action.label,
                    ActionIcon,
                  )
                }
              >
                <ActionIcon />
                <span>
                  <strong>{disabled ? '暂无权限' : action.label}</strong>
                  <small>{action.description}</small>
                </span>
              </button>
            );
          })}
        </section>

        <div className="workspace-home-filterbar" aria-label="运营首页查询筛选栏">
          <label>
            <Search />
            <input readOnly value="搜索待办号 / 资产 / 工单 / 责任人" aria-label="运营首页搜索" />
          </label>
          {['类型 全部', '优先级 全部', '责任人 全部'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                openHomePreview(
                  '筛选运营事项',
                  `/fixed-assets/workbench?menu=home&filter=${encodeURIComponent(filter)}`,
                  `按 ${filter} 筛选运营事项，保留当前运营域。`,
                  '打开筛选',
                  SlidersHorizontal,
                )
              }
            >
              {filter}
              <ArrowRight />
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              openHomePreview(
                '运营首页时间筛选',
                '/fixed-assets/workbench?menu=home&date=today',
                '查看今日运营事项，保留当前筛选上下文。',
                '查看今日',
                CalendarDays,
              )
            }
          >
            处理时间
            <CalendarDays />
          </button>
          <button
            type="button"
            className="is-reset"
            onClick={() =>
              openHomePreview(
                '运营首页空态预览',
                '/fixed-assets/workbench?menu=home&empty=true',
                '当前筛选下暂无运营待办，可清空条件或新建预测工单。',
                '清空筛选',
                Search,
              )
            }
          >
            空态预览
          </button>
        </div>

        <div className="workspace-home-task-wall" aria-label="运营首页任务墙">
          <header>
            <strong>跨模块任务墙</strong>
            <span>可发起 · 可查询 · 可打开</span>
          </header>
          <div className="workspace-home-task-head">
            <span>待办号</span>
            <span>事项</span>
            <span>优先级</span>
            <span>状态</span>
            <span>SLA</span>
            <span>责任人</span>
            <span>操作</span>
          </div>
          {workbenchHomeTasks.map((task) => (
            <div
              key={task.id}
              className={`workspace-home-task-row is-${task.tone} ${task.id === selectedTask.id ? 'is-selected' : ''}`}
            >
              <button type="button" className="is-link" onClick={() => openTask(task)}>{task.id}</button>
              <span>
                <strong>{task.title}</strong>
                <small>{task.object} · {task.context}</small>
              </span>
              <span><b>{task.priority}</b></span>
              <span><i>{task.status}</i></span>
              <span>{task.sla}</span>
              <span>{task.owner}</span>
              <span>
                <button type="button" onClick={() => openTask(task)}>{task.nextAction}</button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <aside className="workspace-home-detail" aria-label="运营首页详情抽屉">
        <header>
          <strong>运营事项详情</strong>
          <span>{selectedTask.status}</span>
        </header>
        <section className="workspace-home-detail-card" aria-label="当前运营事项信息">
          <b>{selectedTask.priority}</b>
          <div>
            <span>{selectedTask.id}</span>
            <h3>{selectedTask.title}</h3>
            <p>{selectedTask.object} · {selectedTask.location}</p>
          </div>
          <dl>
            <div><dt>类型</dt><dd>{selectedTask.category}</dd></div>
            <div><dt>责任人</dt><dd>{selectedTask.owner}</dd></div>
            <div><dt>SLA</dt><dd>{selectedTask.sla}</dd></div>
            <div><dt>上下文</dt><dd>{selectedTask.context}</dd></div>
          </dl>
        </section>

        <section className="workspace-home-alerts" aria-label="维保预警队列">
          <header>
            <span>维保预警队列</span>
            <strong>5 项</strong>
          </header>
          {workbenchHomeTasks.filter((task) => task.category !== '报表订阅').map((task) => (
            <button
              key={task.id}
              type="button"
              className={`is-${task.tone}`}
              onClick={() => openTask(task)}
            >
              <span>{task.category}</span>
              <strong>{task.object}</strong>
              <small>{task.status} · {task.sla}</small>
            </button>
          ))}
        </section>

        <nav className="workspace-home-tabs" aria-label="运营首页详情标签">
          {workbenchHomeDetailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === detailTab ? 'is-active' : ''}
              onClick={() => setDetailTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="workspace-home-tab-panel" aria-label={`${detailTab}内容`}>
          <article>
            <span>处理摘要</span>
            <p>{selectedTask.title}，当前状态为 {selectedTask.status}，下一步建议：{selectedTask.nextAction}。</p>
          </article>
          <article>
            <span>预填上下文</span>
            <ul>
              <li>{selectedTask.object} <b>已带入</b></li>
              <li>{selectedTask.location} <b>已定位</b></li>
              <li>{selectedTask.context} <b className="is-warning">需确认</b></li>
            </ul>
          </article>
        </section>

        <section className="workspace-home-permission" aria-label="运营首页权限反馈">
          <AlertTriangle />
          <div>
            <strong>{canCreateWorkOrder ? '关键操作入口可用' : '新建工单权限受限'}</strong>
            <p>{canCreateWorkOrder ? '可从运营首页直接发起预测工单、处理待办并打开报表。' : '当前账号可浏览运营态势，但新建预测工单需要申请权限。'}</p>
          </div>
        </section>

        <footer className="workspace-home-actions" aria-label="运营首页详情操作">
          <button type="button" onClick={() => openTask(selectedTask)}>
            打开详情
          </button>
          <button
            type="button"
            onClick={() =>
              openHomePreview(
                '处理流程待办',
                selectedTask.category === '流程待办'
                  ? selectedTask.route
                  : `/approvals?source=workbench&status=PENDING&ref=${encodeURIComponent(selectedTask.id)}`,
                `处理 ${selectedTask.id}，保留运营首页和 ${selectedTask.context} 上下文。`,
                '进入待办',
                ClipboardList,
              )
            }
          >
            处理待办
          </button>
          <button
            type="button"
            disabled={!canOpenReports}
            onClick={() =>
              openHomePreview(
                '查看经营报表',
                '/reports?source=workbench&view=operations-home',
                '进入报表分析，查看资产健康、价值趋势和部门统计。',
                canOpenReports ? '进入报表' : '暂无权限',
                BarChart3,
              )
            }
          >
            查看报表
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={!canCreateWorkOrder}
            onClick={() =>
              openHomePreview(
                '新建预测工单',
                workbenchHomeTasks[0].route,
                '从运营首页维保预警创建预测工单，预填设备、位置、风险和 SLA。',
                canCreateWorkOrder ? '创建工单' : '暂无权限',
                Wrench,
              )
            }
          >
            新建工单
          </button>
        </footer>
      </aside>
    </section>
  );
}

function WorkbenchEnergyPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState<(typeof workbenchEnergyDomains)[number]['id']>('ingestion');
  const [selectedRowId, setSelectedRowId] = useState(workbenchEnergyRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchEnergyDetailTabs)[number]>('链路信息');
  const selectedDomainMeta =
    workbenchEnergyDomains.find((domain) => domain.id === selectedDomain) ?? workbenchEnergyDomains[0];
  const selectedRow = workbenchEnergyRows.find((row) => row.id === selectedRowId) ?? workbenchEnergyRows[0];
  const canOpenEnergy = canAccessRoute('/energy', user);
  const canOpenReports = canAccessRoute('/reports', user);

  const openEnergyPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Activity,
  ) => {
    onPreviewAction({
      title,
      source: '数据监控页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const runEnergyAction = (actionIndex: number) => {
    const action = meta.actions[actionIndex];
    if (action) {
      onPreviewAction(action);
      return;
    }
    openEnergyPreview(
      '查看数据链路',
      '/energy?source=workbench&scope=data-monitoring',
      '进入数据监控页面，保留 MES/IoT 链路和 Workbench 来源。',
      '进入数据链路',
      Activity,
    );
  };

  const openEnergyEvent = (row: (typeof workbenchEnergyRows)[number]) => {
    setSelectedRowId(row.id);
    openEnergyPreview(
      '打开数据监控详情',
      `/energy/${encodeURIComponent(row.id)}?source=workbench&menu=energy`,
      `打开 ${row.entity}，带入 ${row.type}、${row.status}、${row.contextLabel} 和责任方 ${row.owner}。`,
      '打开详情',
      Activity,
    );
  };

  return (
    <section className="workspace-orders-page workspace-energy-page workspace-energy-product" aria-label={`${item.label}真实产品页`}>
      <aside className="workspace-energy-rail" aria-label="数据监控链路域">
        <header>
          <span><Activity /></span>
          <div>
            <h2>数据监控</h2>
            <p>数据链路 · 采集事件 · 指标服务</p>
          </div>
        </header>
        <div className="workspace-energy-domain-list" aria-label="数据监控一级链路域">
          {workbenchEnergyDomains.map((domain) => {
            const DomainIcon = domain.icon;
            return (
              <button
                key={domain.id}
                type="button"
                className={domain.id === selectedDomain ? 'is-active' : ''}
                onClick={() => setSelectedDomain(domain.id)}
              >
                <DomainIcon />
                <span>
                  <strong>{domain.label}</strong>
                  <small>{domain.note}</small>
                </span>
                <b>{domain.value}</b>
              </button>
            );
          })}
        </div>
        <section className="workspace-energy-domain-children" aria-label="数据监控二级链路">
          <span>{selectedDomainMeta.label}二级项</span>
          {selectedDomainMeta.children.map((child) => (
            <button
              key={child}
              type="button"
              onClick={() =>
                openEnergyPreview(
                  `${child}链路查询`,
                  `${selectedDomainMeta.route}&node=${encodeURIComponent(child)}`,
                  `进入 ${child} 数据链路，保留 Workbench 数据监控来源和当前域。`,
                  '进入链路',
                  selectedDomainMeta.icon,
                )
              }
            >
              {child}
              <ArrowRight />
            </button>
          ))}
        </section>
        <section className="workspace-energy-states" aria-label="数据监控状态反馈">
          {workbenchEnergyStateCards.map((state) => (
            <article key={state.label}>
              <span>{state.label}</span>
              <strong>{state.value}</strong>
              <p>{state.note}</p>
            </article>
          ))}
        </section>
      </aside>

      <section className="workspace-energy-center" aria-label="数据监控产品页主体">
        <header className="workspace-energy-header">
          <div>
            <span>业务操作台</span>
            <h2>数据监控</h2>
            <p>把 MES、IoT、设备点位和异常流水合并为可查询、可重试、可订阅的链路工作台。</p>
          </div>
        </header>
        <div className="workspace-energy-toolbar workspace-orders-toolbar" aria-label="数据监控顶部操作">
          <button type="button" onClick={() => runEnergyAction(0)}>
            <Activity />
            查看数据链路
          </button>
          <button
            type="button"
            disabled={!canOpenReports}
            onClick={() =>
              canOpenReports
                ? runEnergyAction(1)
                : openEnergyPreview(
                    '订阅异常报表',
                    '/reports?source=workbench&view=data-monitoring&subscribe=true',
                    '当前账号暂无报表订阅权限，可先查看链路详情或发起权限申请。',
                    '暂无权限',
                    BarChart3,
                  )
            }
          >
            <Bell />
            {canOpenReports ? '订阅异常报表' : '订阅受限'}
          </button>
          <button type="button" className="is-primary" onClick={() => runEnergyAction(2)}>
            <Zap />
            重试采集任务
          </button>
        </div>

        <section className="workspace-energy-visual" aria-label="数据监控链路拓扑">
          <div>
            <span>实时链路拓扑</span>
            <strong>MES / IoT / 设备点位</strong>
            <p>左侧选择链路域，右侧事件队列保留对应系统、点位、延迟、责任方和重试意图。</p>
          </div>
          <div className="workspace-data-visual">
            <span className="workspace-data-scanline" />
            <img src={meta.imageSrc} alt="数据监控链路拓扑" />
            <article className="workspace-data-live-card">
              <span>链路健康度</span>
              <strong>98.6%</strong>
              <i />
              <small>P95 延迟 2.1s</small>
            </article>
          </div>
        </section>

        <div className="workspace-energy-kpis" aria-label="数据监控核心指标">
          {workbenchEnergySummaryCards.map((card) => {
            const CardIcon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                className={`is-${card.tone}`}
                onClick={() =>
                  openEnergyPreview(
                    `${card.label}下钻`,
                    `/energy?source=workbench&scope=data-monitoring&metric=${encodeURIComponent(card.label)}`,
                    `按 ${card.label} 下钻数据监控，保留当前链路域和 Workbench 来源。`,
                    '查看指标',
                    CardIcon,
                  )
                }
              >
                <CardIcon />
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.delta}</small>
              </button>
            );
          })}
        </div>

        <section className="workspace-energy-monitor-grid" aria-label="数据监控驾驶舱">
          <article className="workspace-energy-trend-card" aria-label="数据监控趋势图">
            <header>
              <span>采集健康趋势</span>
              <strong>98.6%</strong>
            </header>
            <svg viewBox="0 0 504 118" role="img" aria-label="数据监控采集健康趋势折线">
              <defs>
                <linearGradient id="energyTrendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10a7bd" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#10a7bd" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M ${workbenchEnergyTrendPoints} L 504 118 L 0 118 Z`} fill="url(#energyTrendFill)" />
              <polyline points={workbenchEnergyTrendPoints} fill="none" stroke="#0c8da6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <g>
                <circle cx="360" cy="34" r="5" fill="#0c8da6" />
                <circle cx="504" cy="24" r="5" fill="#176de8" />
              </g>
            </svg>
            <footer>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>当前</span>
            </footer>
          </article>

          <article className="workspace-energy-health-card" aria-label="数据源健康分布">
            <header>
              <span>数据源健康分布</span>
              <button
                type="button"
                onClick={() =>
                  openEnergyPreview(
                    '查看数据源健康',
                    '/energy?source=workbench&scope=data-monitoring&view=source-health',
                    '查看 MES、IoT、PLC 和事件流的健康度、延迟与补偿状态。',
                    '查看健康分布',
                    Database,
                  )
                }
              >
                查看
              </button>
            </header>
            <div>
              {workbenchEnergySourceHealth.map((source) => (
                <button
                  key={source.label}
                  type="button"
                  className={`is-${source.tone}`}
                  onClick={() =>
                    openEnergyPreview(
                      `${source.label}健康详情`,
                      `/energy?source=workbench&scope=data-monitoring&source=${encodeURIComponent(source.label)}`,
                      `下钻 ${source.label}，带入健康度 ${source.value} 和当前延迟 ${source.note}。`,
                      '打开来源',
                      Database,
                    )
                  }
                >
                  <span>
                    <strong>{source.label}</strong>
                    <small>{source.note}</small>
                  </span>
                  <em>{source.value}</em>
                  <i style={{ '--source-health-width': `${source.percent}%` } as CSSProperties} />
                </button>
              ))}
            </div>
          </article>

          <article className="workspace-energy-rank-card" aria-label="采集异常排行">
            <header>
              <span>采集异常排行</span>
              <strong>32 待处理</strong>
            </header>
            {workbenchEnergyExceptionRank.map((event) => (
              <button
                key={event.label}
                type="button"
                className={`is-${event.tone}`}
                onClick={() =>
                  openEnergyPreview(
                    `${event.label}处理`,
                    `/energy?source=workbench&scope=data-monitoring&exception=${encodeURIComponent(event.label)}`,
                    `进入 ${event.label} 异常队列，保留数据监控来源和处理上下文。`,
                    '处理异常',
                    AlertTriangle,
                  )
                }
              >
                <span>
                  <strong>{event.label}</strong>
                  <small>{event.note}</small>
                </span>
                <b>{event.value}</b>
              </button>
            ))}
          </article>
        </section>

        <div className="workspace-energy-stage-row" aria-label="数据监控流程阶段">
          {workbenchEnergyStages.map((stage) => (
            <button
              key={stage.label}
              type="button"
              className={`is-${stage.tone}`}
              onClick={() =>
                openEnergyPreview(
                  `${stage.label}阶段`,
                  `/energy?source=workbench&scope=data-monitoring&stage=${encodeURIComponent(stage.label)}`,
                  `按 ${stage.label} 阶段查看采集任务、异常流水和指标服务状态。`,
                  '查看阶段',
                  ArrowRight,
                )
              }
            >
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
              <small>{stage.note}</small>
            </button>
          ))}
        </div>

        <div className="workspace-energy-filterbar" aria-label="数据监控查询筛选栏">
          <label>
            <Search />
            <input readOnly value="搜索链路编号 / 系统源 / 点位 / 责任方" aria-label="数据监控搜索" />
          </label>
          {['链路 全部', '状态 全部', '责任方 全部'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                openEnergyPreview(
                  '筛选数据监控',
                  `/energy?source=workbench&scope=data-monitoring&filter=${encodeURIComponent(filter)}`,
                  `按 ${filter} 筛选数据监控事件，保留当前链路域。`,
                  '打开筛选',
                  SlidersHorizontal,
                )
              }
            >
              {filter}
              <ArrowRight />
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              openEnergyPreview(
                '数据监控时间筛选',
                '/energy?source=workbench&scope=data-monitoring&date=today',
                '查看今日采集任务和异常事件，保留当前链路域。',
                '查看今日',
                CalendarDays,
              )
            }
          >
            处理时间
            <CalendarDays />
          </button>
          <button
            type="button"
            className="is-reset"
            onClick={() =>
              openEnergyPreview(
                '数据监控空态预览',
                '/energy?source=workbench&scope=data-monitoring&empty=true',
                '当前筛选下暂无异常流水，可清空条件或订阅异常报表。',
                '清空筛选',
                Search,
              )
            }
          >
            空态预览
          </button>
        </div>

        <div className="workspace-energy-table" aria-label="数据监控列表">
          <div className="workspace-energy-table-head">
            <span>链路编号</span>
            <span>来源类型</span>
            <span>监控对象</span>
            <span>业务事件</span>
            <span>质量/延迟</span>
            <span>状态</span>
            <span>责任方</span>
            <span>上下文</span>
            <span>操作</span>
          </div>
          {workbenchEnergyRows.map((row) => (
            <div
              key={row.id}
              className={`workspace-energy-table-row is-${row.tone} ${row.id === selectedRow.id ? 'is-selected' : ''}`}
            >
              <button type="button" className="is-link" onClick={() => openEnergyEvent(row)}>{row.id}</button>
              <span><em>{row.type}</em></span>
              <span>
                <strong>{row.entity}</strong>
                <small>{row.location}</small>
              </span>
              <button type="button" className="is-title" onClick={() => openEnergyEvent(row)}>{row.title}</button>
              <span><b>{row.score}</b></span>
              <span><i>{row.status}</i></span>
              <span>{row.owner}</span>
              <span><em>{row.contextLabel}</em></span>
              <span>
                <button
                  type="button"
                  onClick={() =>
                    openEnergyPreview(
                      '处理数据事件',
                      `/energy?source=workbench&scope=data-monitoring&event=${encodeURIComponent(row.id)}`,
                      `处理 ${row.entity}，保留链路、异常事件和责任方上下文。`,
                      '进入事件',
                      Zap,
                    )
                  }
                >
                  处理
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <aside className="workspace-energy-detail" aria-label="数据监控详情抽屉">
        <header>
          <strong>数据链路详情</strong>
          <span>{selectedRow.status}</span>
        </header>
        <section className="workspace-energy-detail-card" aria-label="当前数据监控信息">
          <b>{selectedRow.score}</b>
          <div>
            <span>{selectedRow.id}</span>
            <h3>{selectedRow.title}</h3>
            <p>{selectedRow.entity} · {selectedRow.location}</p>
          </div>
          <dl>
            <div><dt>来源类型</dt><dd>{selectedRow.type}</dd></div>
            <div><dt>责任方</dt><dd>{selectedRow.owner}</dd></div>
            <div><dt>采集质量</dt><dd>{selectedRow.score}</dd></div>
            <div><dt>采集时效</dt><dd>{selectedRow.timing}</dd></div>
            <div><dt>上下文</dt><dd>{selectedRow.contextLabel}</dd></div>
            <div><dt>状态</dt><dd>{selectedRow.status}</dd></div>
          </dl>
        </section>

        <section className="workspace-energy-service-cards" aria-label="数据监控服务摘要">
          {workbenchEnergyServiceCards.map((card) => (
            <article key={card.label} className={`is-${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          ))}
        </section>

        <section className="workspace-energy-event-flow" aria-label="数据监控异常流水">
          {[
            ['采集任务', selectedRow.type, '已带入'],
            ['异常事件', selectedRow.status, selectedRow.tone === 'green' ? '正常' : '需处理'],
            ['重试记录', selectedRow.timing, '可回溯'],
          ].map(([label, value, status]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{status}</small>
            </article>
          ))}
        </section>

        <nav className="workspace-energy-tabs" aria-label="数据监控详情标签">
          {workbenchEnergyDetailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === detailTab ? 'is-active' : ''}
              onClick={() => setDetailTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="workspace-energy-tab-panel" aria-label={`${detailTab}内容`}>
          <article>
            <span>事件摘要</span>
            <p>{selectedRow.title}，当前状态为 {selectedRow.status}，上下文为 {selectedRow.contextLabel}。</p>
          </article>
          <article>
            <span>预填上下文</span>
            <ul>
              <li>{selectedRow.entity} <b>已带入</b></li>
              <li>{selectedRow.location} <b>已定位</b></li>
              <li>{selectedRow.owner} <b className="is-warning">需确认</b></li>
            </ul>
          </article>
        </section>

        <section className="workspace-energy-permission" aria-label="数据监控权限反馈">
          <AlertTriangle />
          <div>
            <strong>{canOpenEnergy ? '链路操作入口可用' : '数据重试权限受限'}</strong>
            <p>{canOpenEnergy ? '可从 Workbench 打开链路、重试采集任务并订阅异常报表。' : '当前账号可查看摘要，重试和订阅需进入权限申请。'}</p>
          </div>
        </section>

        <footer className="workspace-energy-actions" aria-label="数据监控详情操作">
          <button
            type="button"
            onClick={() =>
              openEnergyPreview(
                '查看数据链路',
                `/energy?source=workbench&scope=data-monitoring&link=${encodeURIComponent(selectedRow.id)}`,
                `查看 ${selectedRow.entity} 的采集延迟、质量分和异常流水。`,
                '进入链路',
                Activity,
              )
            }
          >
            链路详情
          </button>
          <button
            type="button"
            onClick={() =>
              openEnergyPreview(
                '重试采集任务',
                `/energy?source=workbench&scope=data-monitoring&event=${encodeURIComponent(selectedRow.id)}&retry=true`,
                `重试 ${selectedRow.entity}，保留事件、责任方和采集任务上下文。`,
                '重试采集',
                Zap,
              )
            }
          >
            重试任务
          </button>
          <button
            type="button"
            disabled={!canOpenReports}
            onClick={() =>
              openEnergyPreview(
                '订阅异常报表',
                '/reports?source=workbench&view=data-monitoring&subscribe=true',
                '订阅数据监控异常报表，保留链路和事件筛选。',
                canOpenReports ? '进入订阅' : '暂无权限',
                BarChart3,
              )
            }
          >
            订阅报表
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() =>
              openEnergyPreview(
                '申请数据权限',
                `/approvals/new?source=workbench&type=data-monitoring&event=${encodeURIComponent(selectedRow.id)}`,
                `为 ${selectedRow.entity} 发起数据监控权限申请，带入链路和异常事件上下文。`,
                '发起申请',
                ClipboardList,
              )
            }
          >
            申请权限
          </button>
        </footer>
      </aside>
    </section>
  );
}

function WorkbenchPolicyPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState<(typeof workbenchPolicyDomains)[number]['id']>('rules');
  const [selectedRuleId, setSelectedRuleId] = useState(workbenchPolicyRows[0].id);
  const selectedRow = workbenchPolicyRows.find((row) => row.id === selectedRuleId) ?? workbenchPolicyRows[0];
  const selectedRule =
    workbenchPolicyRuleDetails.find((rule) => rule.id === selectedRuleId) ?? workbenchPolicyRuleDetails[0];
  const selectedDomainMeta =
    workbenchPolicyDomains.find((domain) => domain.id === selectedDomain) ?? workbenchPolicyDomains[0];
  const canCreateRiskAssessment = canAccessRoute('/risk-assessments/new', user);

  const openPolicyPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = ShieldCheck,
  ) => {
    onPreviewAction({
      title,
      source: '组织策略页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openPolicyRule = (row: (typeof workbenchPolicyRows)[number]) => {
    const rule = workbenchPolicyRuleDetails.find((detail) => detail.id === row.id) ?? workbenchPolicyRuleDetails[0];
    setSelectedRuleId(row.id);
    openPolicyPreview(
      '打开组织策略详情',
      rule.route,
      `打开 ${row.entity}，带入规则条件、角色策略、审批边界和命中样本。`,
      '打开规则',
      ShieldCheck,
    );
  };

  return (
    <section className="workspace-orders-page workspace-policy-page workspace-policy-product" aria-label={`${item.label}真实产品页`}>
      <aside className="workspace-policy-rail" aria-label="组织策略治理域">
        <header>
          <span><ShieldCheck /></span>
          <div>
            <h2>组织策略</h2>
            <p>风险规则 · 角色策略 · 审批边界</p>
          </div>
        </header>
        <div className="workspace-policy-domain-list">
          {workbenchPolicyDomains.map((domain) => {
            const DomainIcon = domain.icon;
            return (
              <button
                key={domain.id}
                type="button"
                className={domain.id === selectedDomain ? 'is-active' : ''}
                onClick={() => setSelectedDomain(domain.id)}
              >
                <DomainIcon />
                <span>
                  <strong>{domain.label}</strong>
                  <small>{domain.note}</small>
                </span>
                <b>{domain.value}</b>
              </button>
            );
          })}
        </div>
        <section className="workspace-policy-domain-children" aria-label="组织策略二级策略域">
          <span>{selectedDomainMeta.label}二级项</span>
          {selectedDomainMeta.children.map((child) => (
            <button
              key={child}
              type="button"
              onClick={() =>
                openPolicyPreview(
                  `${child}策略查询`,
                  `${selectedDomainMeta.route}&node=${encodeURIComponent(child)}`,
                  `进入 ${child} 策略域，保留 Workbench 组织策略来源和当前筛选。`,
                  '进入策略域',
                  selectedDomainMeta.icon,
                )
              }
            >
              {child}
              <ArrowRight />
            </button>
          ))}
        </section>
        <section className="workspace-policy-states" aria-label="组织策略状态反馈">
          {workbenchPolicyStateCards.map((state) => (
            <article key={state.label}>
              <span>{state.label}</span>
              <strong>{state.value}</strong>
              <p>{state.note}</p>
            </article>
          ))}
        </section>
      </aside>

      <section className="workspace-policy-center" aria-label="组织策略产品页主体">
        <header className="workspace-policy-header">
          <div>
            <span>组织策略</span>
            <h2>风险规则配置台</h2>
            <p>把风险阈值、角色权限、审批边界和命中样本放到同一治理页，进入业务页前先确认上下文。</p>
          </div>
          <div className="workspace-orders-toolbar" aria-label="组织策略顶部操作">
            <button
              type="button"
              onClick={() =>
                openPolicyPreview(
                  '查看策略规则',
                  '/risk-matrix?source=workbench&scope=policy',
                  '查看组织策略规则台，保留风险规则、角色策略和审批边界上下文。',
                  '进入规则台',
                  ShieldCheck,
                )
              }
            >
              <ShieldCheck />
              查看策略规则
            </button>
            <button
              type="button"
              onClick={() =>
                openPolicyPreview(
                  '复核高危规则',
                  '/risk-matrix?source=workbench&scope=policy&severity=high',
                  '筛选高危规则和近 7 天命中样本，进入后优先处理 P1/P2 策略。',
                  '进入复核',
                  AlertTriangle,
                )
              }
            >
              <AlertTriangle />
              复核高危规则
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() =>
                openPolicyPreview(
                  '新建风险评估',
                  '/risk-assessments/new?source=workbench&scope=policy',
                  '进入风险评估新建页，预填组织策略、规则来源和审批边界。',
                  '新建评估',
                  Shield,
                )
              }
            >
              <Shield />
              新建风险评估
            </button>
          </div>
        </header>

        <div className="workspace-policy-kpis" aria-label="组织策略核心指标">
          {workbenchPolicySummaryCards.map((card) => {
            const CardIcon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                className={`is-${card.tone}`}
                onClick={() =>
                  openPolicyPreview(
                    `${card.label}策略下钻`,
                    `/risk-matrix?source=workbench&scope=policy&metric=${encodeURIComponent(card.label)}`,
                    `按 ${card.label} 下钻组织策略规则，保留当前厂区和角色上下文。`,
                    '查看指标',
                    CardIcon,
                  )
                }
              >
                <CardIcon />
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.delta}</small>
              </button>
            );
          })}
        </div>

        <div className="workspace-policy-filterbar" aria-label="组织策略查询筛选栏">
          <label>
            <Search />
            <input readOnly value="搜索策略编号 / 规则名称 / 上下文 / 责任人" aria-label="组织策略搜索" />
          </label>
          {['范围 全部', '状态 全部', '责任人 全部', '优先级 全部'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                openPolicyPreview(
                  '查询组织策略',
                  `/risk-matrix?source=workbench&scope=policy&filter=${encodeURIComponent(filter)}`,
                  `按 ${filter} 查询组织策略规则，保留当前治理域。`,
                  '打开查询',
                  SlidersHorizontal,
                )
              }
            >
              {filter}
              <ArrowRight />
            </button>
          ))}
          <button
            type="button"
            className="is-reset"
            onClick={() =>
              openPolicyPreview(
                '组织策略空态预览',
                '/risk-matrix?source=workbench&scope=policy&empty=true',
                '当前筛选下暂无策略命中，可清空筛选或新建风险评估。',
                '清空筛选',
                Search,
              )
            }
          >
            空态预览
          </button>
        </div>

        <div className="workspace-orders-table workspace-policy-table" aria-label="组织策略规则列表">
          <div className="workspace-policy-table-head">
            <span>策略编号</span>
            <span>规则对象</span>
            <span>触发条件</span>
            <span>审批边界</span>
            <span>命中样本</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {workbenchPolicyRows.map((row) => {
            const detail = workbenchPolicyRuleDetails.find((rule) => rule.id === row.id) ?? workbenchPolicyRuleDetails[0];
            return (
              <div
                key={row.id}
                className={`workspace-policy-table-row is-${row.tone} ${row.id === selectedRow.id ? 'is-selected' : ''}`}
              >
                <button type="button" className="is-link" onClick={() => openPolicyRule(row)}>{row.id}</button>
                <span>
                  <strong>{row.entity}</strong>
                  <small>{row.type} · {row.owner}</small>
                </span>
                <span>{detail.condition}</span>
                <span>{detail.boundary}</span>
                <span><i>{detail.hit}</i></span>
                <span><b>{row.status}</b></span>
                <span>
                  <button type="button" onClick={() => openPolicyRule(row)}>打开</button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="workspace-policy-detail" aria-label="组织策略详情抽屉">
        <header>
          <strong>组织策略详情</strong>
          <span>{selectedRow.status}</span>
        </header>
        <section className="workspace-policy-detail-card" aria-label="当前组织策略规则信息">
          <b>{selectedRow.score}</b>
          <div>
            <span>{selectedRow.id}</span>
            <h3>{selectedRow.title}</h3>
            <p>{selectedRule.condition}</p>
          </div>
          <dl>
            <div><dt>规则对象</dt><dd>{selectedRow.entity}</dd></div>
            <div><dt>角色策略</dt><dd>{selectedRule.rolePolicy}</dd></div>
            <div><dt>审批边界</dt><dd>{selectedRule.boundary}</dd></div>
            <div><dt>命中来源</dt><dd>{selectedRule.trigger}</dd></div>
            <div><dt>审批人</dt><dd>{selectedRule.approval}</dd></div>
            <div><dt>命中样本</dt><dd>{selectedRule.hit}</dd></div>
          </dl>
        </section>

        <section className="workspace-policy-role-matrix" aria-label="角色策略矩阵">
          <header>
            <span>角色策略矩阵</span>
            <strong>可见 / 编辑 / 审批</strong>
          </header>
          {workbenchPolicyRoleMatrix.map((role) => (
            <article key={role.role}>
              <b>{role.role}</b>
              <span>{role.department}</span>
              <small>{role.visible} · {role.editable} · {role.approval}</small>
              <em>{role.status}</em>
            </article>
          ))}
        </section>

        <section className="workspace-policy-boundaries" aria-label="审批边界">
          {workbenchPolicyBoundaryCards.map((boundary) => (
            <article key={boundary.label}>
              <span>{boundary.label}</span>
              <strong>{boundary.value}</strong>
              <p>{boundary.note}</p>
            </article>
          ))}
        </section>

        <section className="workspace-policy-hit-samples" aria-label="策略命中样本">
          {workbenchPolicyHitSamples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className={`is-${sample.tone}`}
              onClick={() =>
                openPolicyPreview(
                  '打开策略命中样本',
                  `/risk-matrix?source=workbench&scope=policy&hit=${encodeURIComponent(sample.id)}`,
                  `查看 ${sample.id}，来源 ${sample.source}，命中规则 ${sample.rule}。`,
                  '打开样本',
                  Bell,
                )
              }
            >
              <span>{sample.source}</span>
              <strong>{sample.id}</strong>
              <small>{sample.result}</small>
            </button>
          ))}
        </section>

        <nav className="workspace-policy-tabs" aria-label="组织策略详情标签">
          {workbenchPolicyDetailTabs.map((tab, index) => (
            <button key={tab} type="button" className={index === 2 ? 'is-active' : ''}>{tab}</button>
          ))}
        </nav>

        <section className="workspace-policy-permission" aria-label="策略权限申请">
          <AlertTriangle />
          <div>
            <strong>{canCreateRiskAssessment ? '风险评估入口可用' : '风险评估权限受限'}</strong>
            <p>{canCreateRiskAssessment ? selectedRule.suggestion : '当前账号缺少 risk:query，仍可通过 Workbench 发起策略权限申请。'}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              openPolicyPreview(
                '申请策略权限',
                `/approvals/new?source=workbench&type=policy&rule=${encodeURIComponent(selectedRow.id)}`,
                `为 ${selectedRow.entity} 发起策略权限申请，带入角色策略和审批边界。`,
                '发起申请',
                ClipboardList,
              )
            }
          >
            申请策略权限
          </button>
        </section>

        <footer className="workspace-policy-actions" aria-label="组织策略详情操作">
          <button
            type="button"
            onClick={() =>
              openPolicyPreview(
                '查看策略规则',
                selectedRule.route,
                `进入 ${selectedRow.entity} 规则详情，保留命中样本和审批边界。`,
                '进入规则',
                ShieldCheck,
              )
            }
          >
            规则详情
          </button>
          <button
            type="button"
            onClick={() =>
              openPolicyPreview(
                '申请策略权限',
                `/approvals/new?source=workbench&type=policy&rule=${encodeURIComponent(selectedRow.id)}`,
                `为 ${selectedRow.entity} 申请策略权限，带入角色策略、审批边界和当前命中样本。`,
                '发起申请',
                ClipboardList,
              )
            }
          >
            权限申请
          </button>
          <button
            type="button"
            onClick={() =>
              openPolicyPreview(
                '停用策略规则',
                `/risk-matrix?source=workbench&scope=policy&danger=disable&rule=${encodeURIComponent(selectedRow.id)}`,
                selectedRule.danger,
                '进入确认',
                AlertTriangle,
              )
            }
          >
            停用规则
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() =>
              openPolicyPreview(
                '新建风险评估',
                `/risk-assessments/new?source=workbench&scope=policy&rule=${encodeURIComponent(selectedRow.id)}`,
                `新建风险评估，预填 ${selectedRow.entity} 的规则条件、命中样本和审批边界。`,
                '新建评估',
                Shield,
              )
            }
          >
            新建评估
          </button>
        </footer>
      </aside>
    </section>
  );
}

function WorkbenchSettingsPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedDomain, setSelectedDomain] = useState<(typeof workbenchSettingsDomains)[number]['id']>('category');
  const [selectedConfigId, setSelectedConfigId] = useState(workbenchSettingsObjects[0].id);
  const selectedConfig =
    workbenchSettingsObjects.find((config) => config.id === selectedConfigId) ?? workbenchSettingsObjects[0];
  const filteredConfigs = workbenchSettingsObjects.filter((config) => config.domain === selectedDomain);

  const openSettingsPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Settings,
  ) => {
    onPreviewAction({
      title,
      source: '基础维护页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openConfig = (config: (typeof workbenchSettingsObjects)[number]) => {
    setSelectedConfigId(config.id);
    setSelectedDomain(config.domain);
    openSettingsPreview(
      '打开基础维护详情',
      `${config.route}&detail=${encodeURIComponent(config.id)}`,
      `打开 ${config.name}，带入 ${config.type}、${config.scope}、${config.impact} 和最后同步 ${config.lastSync}。`,
      '打开详情',
      Settings,
    );
  };

  const selectedDomainMeta =
    workbenchSettingsDomains.find((domain) => domain.id === selectedDomain) ?? workbenchSettingsDomains[0];

  return (
    <section className="workspace-orders-page workspace-settings-page workspace-settings-product" aria-label={`${item.label}真实产品页`}>
      <aside className="workspace-settings-tree" aria-label="基础维护分类树">
        <header>
          <span><Settings /></span>
          <div>
            <h2>基础维护</h2>
            <p>分类树 · 数据字典 · 集成源</p>
          </div>
        </header>
        <div className="workspace-settings-tree-list">
          {workbenchSettingsDomains.map((domain) => {
            const DomainIcon = domain.icon;
            return (
              <button
                key={domain.id}
                type="button"
                className={domain.id === selectedDomain ? 'is-active' : ''}
                onClick={() => {
                  setSelectedDomain(domain.id);
                  const nextConfig = workbenchSettingsObjects.find((config) => config.domain === domain.id);
                  if (nextConfig) {
                    setSelectedConfigId(nextConfig.id);
                  }
                }}
              >
                <DomainIcon />
                <span>
                  <strong>{domain.label}</strong>
                  <small>{domain.note}</small>
                </span>
                <b>{domain.value}</b>
              </button>
            );
          })}
        </div>
        <section className="workspace-settings-tree-children" aria-label="基础维护二级目录">
          <span>{selectedDomainMeta.label}二级项</span>
          {selectedDomainMeta.children.map((child) => (
            <button
              key={child}
              type="button"
              onClick={() =>
                openSettingsPreview(
                  `${child}维护`,
                  `${selectedDomainMeta.route}&node=${encodeURIComponent(child)}`,
                  `进入 ${child} 的维护视图，保留基础维护来源和当前分类树上下文。`,
                  '进入维护',
                  selectedDomainMeta.icon,
                )
              }
            >
              {child}
              <ArrowRight />
            </button>
          ))}
        </section>
        <section className="workspace-settings-states" aria-label="基础维护状态反馈">
          {workbenchSettingsStateCards.map((state) => (
            <article key={state.label}>
              <span>{state.label}</span>
              <strong>{state.value}</strong>
              <p>{state.note}</p>
            </article>
          ))}
        </section>
      </aside>

      <section className="workspace-settings-center" aria-label="基础维护产品页主体">
        <header className="workspace-settings-header">
          <div>
            <span>基础维护</span>
            <h2>{selectedDomainMeta.label}维护台</h2>
            <p>统一维护分类、位置、供应商、编号规则和集成源，所有变更先预览影响再进入业务页。</p>
          </div>
          <div className="workspace-orders-toolbar" aria-label="基础维护顶部操作">
            <button
              type="button"
              onClick={() =>
                openSettingsPreview(
                  '导入基础字典',
                  '/settings/sysconfig/import?source=workbench',
                  '导入分类、位置和编号规则字典，进入后校验重复项和影响范围。',
                  '进入导入',
                  FileText,
                )
              }
            >
              <FileText />
              导入字典
            </button>
            <button
              type="button"
              onClick={() =>
                openSettingsPreview(
                  '同步集成源',
                  '/settings/webhook?source=workbench&sync=true',
                  '同步 MES、IoT 和财务集成源，进入后查看异常明细和重试记录。',
                  '进入同步',
                  Database,
                )
              }
            >
              <Database />
              同步集成源
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() =>
                openSettingsPreview(
                  '新建基础配置',
                  `/settings/sysconfig/new?source=workbench&domain=${selectedDomain}`,
                  `新建 ${selectedDomainMeta.label} 配置，预填当前厂区、责任人和二级目录。`,
                  '新建配置',
                  Settings,
                )
              }
            >
              <Settings />
              新建配置
            </button>
          </div>
        </header>

        <div className="workspace-settings-metrics" aria-label="基础维护核心指标">
          {workbenchSettingsSummaryCards.slice(0, 5).map((card) => {
            const CardIcon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                className={`is-${card.tone}`}
                onClick={() =>
                  openSettingsPreview(
                    `${card.label}维护`,
                    `/settings/sysconfig?source=workbench&metric=${encodeURIComponent(card.label)}`,
                    `按 ${card.label} 下钻基础维护对象，保留当前分类树和筛选上下文。`,
                    '查看维护项',
                    CardIcon,
                  )
                }
              >
                <CardIcon />
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.delta}</small>
              </button>
            );
          })}
        </div>

        <div className="workspace-settings-filterbar" aria-label="基础维护查询筛选栏">
          <label>
            <Search />
            <input readOnly value="搜索配置编号 / 名称 / 影响范围 / 责任人" aria-label="基础维护搜索" />
          </label>
          {['状态 全部', '影响范围 全部', '最后同步 今天'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                openSettingsPreview(
                  '筛选基础配置',
                  `/settings/sysconfig?source=workbench&filter=${encodeURIComponent(filter)}`,
                  `按 ${filter} 筛选基础维护配置，保留当前分类树。`,
                  '打开筛选',
                  SlidersHorizontal,
                )
              }
            >
              {filter}
              <ArrowRight />
            </button>
          ))}
          <button
            type="button"
            className="is-reset"
            onClick={() =>
              openSettingsPreview(
                '空筛选结果',
                '/settings/sysconfig?source=workbench&empty=true',
                '当前筛选下暂无待维护配置，可清空条件或新建配置。',
                '清空筛选',
                Search,
              )
            }
          >
            空态预览
          </button>
        </div>

        <div className="workspace-orders-table workspace-settings-table" aria-label="基础维护配置对象列表">
          <div className="workspace-settings-table-head">
            <span>配置编号</span>
            <span>对象名称</span>
            <span>影响范围</span>
            <span>最后同步</span>
            <span>健康度</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {(filteredConfigs.length ? filteredConfigs : workbenchSettingsObjects).map((config) => (
            <div
              key={config.id}
              className={`workspace-settings-table-row is-${config.tone} ${config.id === selectedConfig.id ? 'is-selected' : ''}`}
            >
              <button type="button" className="is-link" onClick={() => openConfig(config)}>{config.id}</button>
              <span>
                <strong>{config.name}</strong>
                <small>{config.type} · {config.owner}</small>
              </span>
              <span>{config.impact}</span>
              <span>{config.lastSync}</span>
              <span><b>{config.health}</b></span>
              <span><i>{config.status}</i></span>
              <span>
                <button type="button" onClick={() => openConfig(config)}>打开</button>
              </span>
            </div>
          ))}
        </div>

        <footer className="workspace-orders-pagination" aria-label="基础维护分页">
          <span>共 {workbenchSettingsObjects.length * 18} 条</span>
          <button type="button">10条/页</button>
          <button type="button" disabled>‹</button>
          <button type="button" className="is-current">1</button>
          <button type="button">2</button>
          <button type="button">›</button>
        </footer>
      </section>

      <aside className="workspace-settings-detail" aria-label="基础维护详情抽屉">
        <header>
          <strong>基础维护详情</strong>
          <span>{selectedConfig.status}</span>
        </header>
        <section className="workspace-settings-detail-card" aria-label="当前基础维护信息">
          <b>{selectedConfig.risk}</b>
          <div>
            <span>{selectedConfig.id}</span>
            <h3>{selectedConfig.name}</h3>
            <p>{selectedConfig.change}</p>
          </div>
          <dl>
            <div><dt>关联资产</dt><dd>{selectedConfig.impact}</dd></div>
            <div><dt>最后同步</dt><dd>{selectedConfig.lastSync}</dd></div>
            <div><dt>变更影响</dt><dd>{selectedConfig.scope}</dd></div>
            <div><dt>责任人</dt><dd>{selectedConfig.owner}</dd></div>
            <div><dt>供应商资质</dt><dd>{selectedConfig.domain === 'vendor' ? '证照待复核' : '无供应商依赖'}</dd></div>
            <div><dt>集成健康</dt><dd>{selectedConfig.health}</dd></div>
          </dl>
        </section>
        <section className="workspace-settings-impact" aria-label="基础维护变更影响">
          {[
            ['字段变更', selectedConfig.change],
            ['关联资产', selectedConfig.impact],
            ['审计要求', selectedConfig.risk === '高' ? '危险变更需二次确认' : '普通变更自动记录审计'],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <p>{value}</p>
            </article>
          ))}
        </section>
        <nav className="workspace-settings-tabs" aria-label="基础维护详情标签">
          {['字段变更', '关联资产', '供应商资质', '编号规则', '集成健康'].map((tab, index) => (
            <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>{tab}</button>
          ))}
        </nav>
        <section className="workspace-settings-confirm" aria-label="基础维护危险变更确认">
          <AlertTriangle />
          <div>
            <strong>危险变更需二次确认</strong>
            <p>停用规则、删除分类、修改集成凭证会影响资产录入、工单派发和报表口径。</p>
          </div>
        </section>
        <footer className="workspace-orders-detail-actions workspace-settings-actions" aria-label="基础维护详情操作">
          <button
            type="button"
            onClick={() =>
              openSettingsPreview(
                '打开基础维护',
                `${selectedConfig.route}&detail=${encodeURIComponent(selectedConfig.id)}`,
                `进入 ${selectedConfig.name}，保留关联资产、最后同步和变更影响上下文。`,
                '进入维护',
                Settings,
              )
            }
          >
            打开维护
          </button>
          <button
            type="button"
            onClick={() =>
              openSettingsPreview(
                '危险变更确认',
                `/settings/sysconfig/danger?source=workbench&config=${encodeURIComponent(selectedConfig.id)}`,
                `对 ${selectedConfig.name} 执行危险变更前，需要二次确认并写入审计记录。`,
                '进入确认',
                AlertTriangle,
              )
            }
          >
            危险变更
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() =>
              openSettingsPreview(
                '维护供应商资质',
                `/vendors?source=workbench&config=${encodeURIComponent(selectedConfig.id)}`,
                `查看 ${selectedConfig.name} 的供应商资质。若当前账号无供应商权限，则只展示无权限态。`,
                '进入供应商',
                UserCircle,
              )
            }
          >
            供应商资质
          </button>
        </footer>
      </aside>
    </section>
  );
}

function WorkbenchAssetPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(workbenchAssetRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchAssetDetailTabs)[number]>('资产信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedAsset = workbenchAssetRows.find((asset) => asset.id === selectedAssetId) ?? workbenchAssetRows[0];
  const primaryAction = meta.actions[0];
  const createAction = meta.actions[1] ?? primaryAction;
  const riskAction = meta.actions[2] ?? primaryAction;
  const transferAction = meta.actions[3] ?? primaryAction;

  const openAssetPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Layers,
  ) => {
    onPreviewAction({
      title,
      source: '资产总览页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openAsset = (asset: (typeof workbenchAssetRows)[number]) => {
    setSelectedAssetId(asset.id);
    setDetailOpen(true);
    openAssetPreview(
      '打开资产详情',
      `/assets/${asset.id}?source=workbench&menu=asset`,
      `打开 ${asset.asset}，带入位置、健康分、生命周期和 Workbench 资产总览来源。`,
      '打开详情',
      Layers,
    );
  };

  return (
    <section className="workspace-orders-page workspace-asset-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-asset-product-shell" aria-label="资产总览产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><Layers /></span>
              <div>
                <h2>资产总览</h2>
                <p>资产健康与生命周期管理</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="资产总览顶部操作">
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(primaryAction)}>
                <Layers />
                查看资产清单
              </button>
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(createAction)}>
                <Archive />
                新增资产
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(riskAction)}>
                <Wrench />
                生成风险工单
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="资产总览核心指标">
            {workbenchAssetSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openAssetPreview(
                      `${card.label}资产`,
                      `/assets?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻资产台账，保留组织、分类和健康状态筛选。`,
                      '查看资产',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label="资产生命周期">
            {workbenchAssetStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openAssetPreview(
                    `${stage.label}资产`,
                    `/assets?source=workbench&lifecycle=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 生命周期查看资产，并保留 Workbench 来源。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="资产总览查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索资产编号 / 名称 / 位置 / 责任人" aria-label="资产搜索" />
            </label>
            {['组织 全部', '资产状态 全部', '资产分类 全部', '健康状态 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(primaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button type="button" className="is-date" onClick={() => onPreviewAction(transferAction)}>
              处置流转
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(primaryAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-charts" aria-label="资产总览图表">
            <section className="workspace-orders-chart-card" aria-label="资产分类分布">
              <header><h3>资产分类分布</h3><small>按资产大类占比</small></header>
              <div className="workspace-orders-chart-body">
                <div className="workspace-orders-donut" role="img" aria-label="生产设备 43%，IT设备 27%，安防设备 18%，办公设备 12%">
                  <strong>6,842</strong>
                  <span>总资产</span>
                </div>
                <ul className="workspace-orders-chart-legend">
                  {workbenchAssetCategoryDistribution.map((entry) => (
                    <li key={entry.name}>
                      <i style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                      <strong>{entry.value}%</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="workspace-orders-chart-card" aria-label="健康分布">
              <header><h3>健康分布</h3><small>按健康分区间统计</small></header>
              <div className="workspace-orders-chart-body">
                <ResponsiveContainer width="100%" height={220}>
                  <RechartsBarChart data={[...workbenchAssetHealthDistribution]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip />
                    {workbenchAssetHealthDistribution.map((entry) => (
                      <Bar key={entry.name} dataKey="value" fill={entry.color} radius={[4, 4, 0, 0]} />
                    ))}
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="workspace-orders-table" aria-label="资产总览列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部资产" readOnly /></span>
              <span>资产编号</span>
              <span>类型</span>
              <span>资产信息</span>
              <span>风险/任务</span>
              <span>健康分</span>
              <span>状态</span>
              <span>价值</span>
              <span>责任人</span>
              <span>生命周期</span>
              <span>操作</span>
            </div>
            {workbenchAssetRows.map((asset) => (
              <div
                key={asset.id}
                className={`workspace-orders-table-row is-${asset.tone} ${
                  asset.id === selectedAsset.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${asset.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openAsset(asset)}>{asset.id}</button>
                <span><em>{asset.type}</em></span>
                <span>
                  <strong>{asset.asset}</strong>
                  <small>{asset.location}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openAsset(asset)}>{asset.title}</button>
                <span><b>{asset.health}</b></span>
                <span><i>{asset.status}</i></span>
                <span>{asset.value}</span>
                <span>{asset.owner}</span>
                <span><em className="is-spare">{asset.lifecycle}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      setDetailOpen(true);
                      openAssetPreview(
                        '生成资产风险工单',
                        buildWorkOrderPrefillPath({
                          source: 'asset-risk',
                          title: `${asset.asset} 健康风险处置工单`,
                          assetName: asset.asset,
                          assetLocation: asset.location,
                          riskState: asset.status,
                          riskScore: Number(asset.health),
                          riskLevel: asset.status,
                          priority: asset.tone === 'red' ? 'HIGH' : 'MEDIUM',
                          dueDate: '2026-06-16',
                          description: `来自 Workbench 资产总览：${asset.title}，需要承接到工单闭环。`,
                        }),
                        `为 ${asset.asset} 创建健康风险处置工单。`,
                        '创建工单',
                        Wrench,
                      );
                    }}
                  >
                    处置
                  </button>
                  <button type="button" className="is-more" aria-label={`${asset.id}更多操作`} onClick={() => openAsset(asset)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="资产分页">
            <span>共 6,842 台</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4, 5].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <span>...</span>
            <button type="button">685</button>
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="资产详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>资产详情</strong>
              <button type="button" aria-label="关闭资产详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前资产信息">
              <div>
                <b>{selectedAsset.health}</b>
                <span>
                  <strong>{selectedAsset.id}</strong>
                  <small>{selectedAsset.status}</small>
                </span>
              </div>
              <h3>{selectedAsset.asset}</h3>
              <dl>
                <div><dt>类型</dt><dd>{selectedAsset.type}</dd></div>
                <div><dt>健康分</dt><dd>{selectedAsset.health}</dd></div>
                <div><dt>位置</dt><dd>{selectedAsset.location}</dd></div>
                <div><dt>资产价值</dt><dd>{selectedAsset.value}</dd></div>
                <div><dt>责任人</dt><dd>{selectedAsset.owner}</dd></div>
                <div><dt>生命周期</dt><dd>{selectedAsset.lifecycle}</dd></div>
                <div><dt>最近同步</dt><dd>2026-06-14 10:30</dd></div>
                <div><dt>处置状态</dt><dd>{selectedAsset.status}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="资产生命周期流转">
              {['建账', '在用', '风险', '处置', '闭环'].map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '已完成' : index === 2 ? '需研判' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="资产详情标签">
              {workbenchAssetDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>资产摘要</span>
                <p>{selectedAsset.title}，当前生命周期为 {selectedAsset.lifecycle}。</p>
              </article>
              <article>
                <span>健康评分</span>
                <ul>
                  <li>健康分 {selectedAsset.health} <b>已计算</b></li>
                  <li>责任人 {selectedAsset.owner} <b>已绑定</b></li>
                  <li>风险状态 {selectedAsset.status} <b className="is-warning">需关注</b></li>
                </ul>
              </article>
              <article>
                <span>处置建议</span>
                <p>高风险资产优先生成工单；流转类资产进入调拨/领用表单，并保留审批上下文。</p>
              </article>
              <article>
                <span>关联记录</span>
                <ul>
                  <li>WO-20240614-0012 <small>派工中</small></li>
                  <li>TR-20240614-08 <small>调拨审批</small></li>
                  <li>INSP-20260614-M201 <small>待复核</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="资产详情操作">
              <button
                type="button"
                onClick={() =>
                  openAssetPreview(
                    '发起资产调拨',
                    `/disposals/transfer/new?source=workbench&assetId=${encodeURIComponent(selectedAsset.id)}`,
                    `为 ${selectedAsset.asset} 发起调拨，预填位置、责任人和资产来源。`,
                    '发起调拨',
                    ArrowRight,
                  )
                }
              >
                发起调拨
              </button>
              <button
                type="button"
                onClick={() =>
                  openAssetPreview(
                    '发起使用流转',
                    `/assignments/new?source=workbench&assetId=${encodeURIComponent(selectedAsset.id)}`,
                    `为 ${selectedAsset.asset} 发起领用/借用/归还流转。`,
                    '发起流转',
                    UserCircle,
                  )
                }
              >
                使用流转
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => onPreviewAction(riskAction)}
              >
                创建工单
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <Layers />
            <strong>选择左侧资产打开详情</strong>
            <span>详情抽屉会展示健康评分、生命周期、处置流转和关联工单。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchSparesPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedSpareId, setSelectedSpareId] = useState(workbenchSparesRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchSparesDetailTabs)[number]>('备件信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedSpare = workbenchSparesRows.find((spare) => spare.id === selectedSpareId) ?? workbenchSparesRows[0];
  const requestAction = meta.actions[0];
  const stockAction = meta.actions[1] ?? requestAction;
  const purchaseAction = meta.actions[2] ?? requestAction;

  const openSparesPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = PackageCheck,
  ) => {
    onPreviewAction({
      title,
      source: '备件管理页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openSpare = (spare: (typeof workbenchSparesRows)[number]) => {
    setSelectedSpareId(spare.id);
    setDetailOpen(true);
    openSparesPreview(
      '打开备件详情',
      `/spare-parts/${spare.id}?source=workbench&menu=spares`,
      `打开 ${spare.part}，带入库存、供应商、关联工单和成本回写上下文。`,
      '打开详情',
      PackageCheck,
    );
  };

  return (
    <section className="workspace-orders-page workspace-spares-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-spares-product-shell" aria-label="备件管理产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><PackageCheck /></span>
              <div>
                <h2>备件管理</h2>
                <p>低储预警 · 采购领用 · 工单回写</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="备件管理顶部操作">
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(requestAction)}>
                <PackageCheck />
                申请低储备件
              </button>
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(stockAction)}>
                <Box />
                查看备件库存
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(purchaseAction)}>
                <Archive />
                采购申请
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="备件管理核心指标">
            {workbenchSparesSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openSparesPreview(
                      `${card.label}备件`,
                      `/spare-parts?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻备件库存，保留低储和关联工单上下文。`,
                      '查看备件',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label="备件保障流程">
            {workbenchSparesStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openSparesPreview(
                    `${stage.label}备件`,
                    `/spare-parts?source=workbench&stage=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 阶段查看备件保障、采购和成本回写。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="备件管理查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索备件号 / 名称 / 供应商 / 关联工单" aria-label="备件搜索" />
            </label>
            {['分类 全部', '库存状态 全部', '供应商 全部', '关联工单 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(stockAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button type="button" className="is-date" onClick={() => onPreviewAction(purchaseAction)}>
              到货时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(stockAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="备件管理列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部备件" readOnly /></span>
              <span>备件号</span>
              <span>分类</span>
              <span>备件信息</span>
              <span>关联工单</span>
              <span>库存</span>
              <span>状态</span>
              <span>ETA</span>
              <span>责任人</span>
              <span>供应商</span>
              <span>操作</span>
            </div>
            {workbenchSparesRows.map((spare) => (
              <div
                key={spare.id}
                className={`workspace-orders-table-row is-${spare.tone} ${
                  spare.id === selectedSpare.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${spare.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openSpare(spare)}>{spare.id}</button>
                <span><em>{spare.category}</em></span>
                <span>
                  <strong>{spare.part}</strong>
                  <small>{spare.supplier}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openSpare(spare)}>{spare.workOrder}</button>
                <span><b>{spare.stock}</b></span>
                <span><i>{spare.state}</i></span>
                <span>{spare.eta}</span>
                <span>{spare.owner}</span>
                <span><em className="is-spare">{spare.supplier}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedSpareId(spare.id);
                      setDetailOpen(true);
                      openSparesPreview(
                        '发起备件采购',
                        `/spare-parts/new?source=workbench&partNo=${encodeURIComponent(spare.id)}&mode=purchase`,
                        `为 ${spare.part} 发起采购申请，预填库存、供应商和关联工单。`,
                        '采购申请',
                        Archive,
                      );
                    }}
                  >
                    采购
                  </button>
                  <button type="button" className="is-more" aria-label={`${spare.id}更多操作`} onClick={() => openSpare(spare)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="备件分页">
            <span>共 3,256 件</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4, 5].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <span>...</span>
            <button type="button">326</button>
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="备件详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>备件详情</strong>
              <button type="button" aria-label="关闭备件详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前备件信息">
              <div>
                <b>{selectedSpare.stock}</b>
                <span>
                  <strong>{selectedSpare.id}</strong>
                  <small>{selectedSpare.state}</small>
                </span>
              </div>
              <h3>{selectedSpare.part}</h3>
              <dl>
                <div><dt>分类</dt><dd>{selectedSpare.category}</dd></div>
                <div><dt>库存</dt><dd>{selectedSpare.stock}</dd></div>
                <div><dt>供应商</dt><dd>{selectedSpare.supplier}</dd></div>
                <div><dt>到货 ETA</dt><dd>{selectedSpare.eta}</dd></div>
                <div><dt>关联工单</dt><dd>{selectedSpare.workOrder}</dd></div>
                <div><dt>责任人</dt><dd>{selectedSpare.owner}</dd></div>
                <div><dt>成本状态</dt><dd>待回写</dd></div>
                <div><dt>库存状态</dt><dd>{selectedSpare.state}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="备件保障流转">
              {['识别', '申请', '采购', '到货', '回写'].map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '已完成' : index === 2 ? '跟进中' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="备件详情标签">
              {workbenchSparesDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>库存摘要</span>
                <p>{selectedSpare.part} 当前库存 {selectedSpare.stock}，状态为 {selectedSpare.state}。</p>
              </article>
              <article>
                <span>供应商 ETA</span>
                <ul>
                  <li>{selectedSpare.supplier} <b>{selectedSpare.eta}</b></li>
                  <li>关联工单 {selectedSpare.workOrder} <b>已绑定</b></li>
                  <li>成本回写 <b className="is-warning">待确认</b></li>
                </ul>
              </article>
              <article>
                <span>保障建议</span>
                <p>低储和缺货备件优先进入采购申请，已到位备件回写到预测维保工单。</p>
              </article>
              <article>
                <span>关联记录</span>
                <ul>
                  <li>{selectedSpare.workOrder} <small>预测维保</small></li>
                  <li>PO-20240614-08 <small>采购申请</small></li>
                  <li>RPT-SPARE-COST-015 <small>成本报表</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="备件详情操作">
              <button type="button" onClick={() => onPreviewAction(stockAction)}>
                库存列表
              </button>
              <button
                type="button"
                onClick={() =>
                  openSparesPreview(
                    '领用备件',
                    `/spare-parts/${selectedSpare.id}/request?source=workbench`,
                    `领用 ${selectedSpare.part}，保留关联工单和成本回写上下文。`,
                    '进入领用',
                    PackageCheck,
                  )
                }
              >
                领用
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(purchaseAction)}>
                采购申请
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <PackageCheck />
            <strong>选择左侧备件打开详情</strong>
            <span>详情抽屉会展示库存、供应商 ETA、关联工单和成本回写。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

const workbenchDeviceSummaryCards = [
  { label: '设备总数', value: '5,420', delta: '接入台账', icon: Cpu, tone: 'blue' },
  { label: '在线设备', value: '5,102', delta: '在线率 98.6%', icon: Monitor, tone: 'green' },
  { label: '离线设备', value: '28', delta: '需复核', icon: Database, tone: 'cyan' },
  { label: '异常设备', value: '18', delta: '温度/振动', icon: AlertTriangle, tone: 'red' },
  { label: '温度预警', value: '12', delta: '超过阈值', icon: Gauge, tone: 'orange' },
  { label: '待派工', value: '18', delta: '异常转工单', icon: Wrench, tone: 'violet' },
] as const;

const workbenchDeviceStages = [
  { label: '接入', value: '5,420', note: '设备台账', tone: 'blue' },
  { label: '在线', value: '5,102', note: '实时采集', tone: 'green' },
  { label: '预警', value: '36', note: '温度/振动', tone: 'orange' },
  { label: '派工', value: '18', note: '复核处理中', tone: 'cyan' },
  { label: '恢复', value: '96.4%', note: '本周闭环', tone: 'violet' },
] as const;

const workbenchDeviceRows = [
  {
    id: 'DEV-CN-301',
    type: '数控车床',
    device: '数控车床 CN-301',
    location: '机加车间 / CNC 区域 A线',
    title: '主轴振动 RMS 持续上升',
    health: '91',
    status: '预警',
    delay: '88ms',
    owner: '张三丰',
    telemetry: '温度 68°C / 振动 4.2mm/s',
    tone: 'red',
  },
  {
    id: 'DEV-M-201',
    type: '注塑机',
    device: '注塑机 M-201',
    location: '一车间 / A线',
    title: '温度边界触发复核',
    health: '88',
    status: '待派工',
    delay: '102ms',
    owner: '王班组',
    telemetry: '温度 82°C / 压力 14MPa',
    tone: 'orange',
  },
  {
    id: 'DEV-CP-101',
    type: '空压机',
    device: '空压机 CP-101',
    location: '动力站',
    title: '油滤更换保养窗口',
    health: '94',
    status: '正常',
    delay: '76ms',
    owner: '王技师',
    telemetry: '压力 0.72MPa / 电流 18A',
    tone: 'green',
  },
  {
    id: 'DEV-RB-501',
    type: '焊接机器人',
    device: '焊接机器人 RB-501',
    location: '焊接线 A',
    title: '减速机温升趋势预警',
    health: '86',
    status: '预警',
    delay: '114ms',
    owner: '赵技师',
    telemetry: '温度 74°C / 振动 3.1mm/s',
    tone: 'orange',
  },
  {
    id: 'DEV-PDB-01',
    type: '配电柜',
    device: '配电柜 PDB-01',
    location: '动力站',
    title: '柜体局部过热报警',
    health: '83',
    status: '处理中',
    delay: '91ms',
    owner: '陈电工',
    telemetry: '温度 71°C / 负载 82%',
    tone: 'orange',
  },
  {
    id: 'DEV-CV-302',
    type: '传送线',
    device: '传送线 CV-302',
    location: '包装线',
    title: '链条磨损趋势预警',
    health: '90',
    status: '观察',
    delay: '84ms',
    owner: '周技师',
    telemetry: '速度 1.8m/s / 振动 2.5mm/s',
    tone: 'blue',
  },
] as const;

const workbenchDeviceDetailTabs = ['设备信息', '实时遥测', '维保建议', '工单记录', '采集链路'] as const;

const workbenchReportSummaryCards = [
  { label: '资产总价值', value: '¥3,820万', delta: '净值', icon: Layers, tone: 'blue' },
  { label: '资产增长趋势', value: '+3.42%', delta: '较上期', icon: TrendingUp, tone: 'green' },
  { label: '部门资产统计', value: '3 厂区', delta: 'A/B/研发', icon: BarChart3, tone: 'cyan' },
  { label: '维保成本分析', value: '¥46万', delta: '本月', icon: Wrench, tone: 'orange' },
  { label: '风险资产统计', value: '36', delta: '需处置', icon: AlertTriangle, tone: 'red' },
  { label: '资产分类分布', value: '4 类', delta: '生产/IT/安防/办公', icon: FileText, tone: 'violet' },
] as const;

const workbenchReportStages = [
  { label: '模板', value: '26', note: '资产/维保/安全', tone: 'blue' },
  { label: '计算', value: '98.6%', note: '数据源健康', tone: 'green' },
  { label: '分析', value: '12', note: '部门统计', tone: 'cyan' },
  { label: '导出', value: '312', note: '本月任务', tone: 'orange' },
  { label: '订阅', value: '14', note: '自动推送', tone: 'violet' },
] as const;

const workbenchReportRows = [
  {
    id: 'RPT-ASSET-VALUE-001',
    type: '资产价值',
    name: '资产价值信息总览',
    owner: '张三丰',
    title: '总价值趋势、分类分布与部门 Top 5',
    metric: '¥98,760.25万',
    status: '已生成',
    range: '2026-05-15 ~ 2026-06-14',
    dataSource: 'ASSET_DB / FIN_DB',
    exportState: '已完成',
    tone: 'green',
  },
  {
    id: 'RPT-MAINT-COST-008',
    type: '维保成本',
    name: '预测维保成本分析',
    owner: '李巡检',
    title: '工单成本、备件消耗与停机损失',
    metric: '¥286.45万',
    status: '订阅中',
    range: '最近 30 天',
    dataSource: 'WORKORDER_DB',
    exportState: '每周一',
    tone: 'blue',
  },
  {
    id: 'RPT-DEPT-ASSET-012',
    type: '部门统计',
    name: '部门资产统计明细',
    owner: '质量管理部',
    title: '部门资产数量、原值、净值和风险资产',
    metric: '12 部门',
    status: '已生成',
    range: '本月',
    dataSource: 'ASSET_DB',
    exportState: '已完成',
    tone: 'green',
  },
  {
    id: 'RPT-RISK-ASSET-021',
    type: '风险资产',
    name: '风险资产明细',
    owner: '安全运营',
    title: '高风险设备、告警命中与转派工单',
    metric: '356 台',
    status: '待复核',
    range: '近 7 天',
    dataSource: 'ALARM_DB',
    exportState: '待重试',
    tone: 'orange',
  },
  {
    id: 'RPT-SPARE-COST-015',
    type: '备件成本',
    name: '备件消耗与低储影响',
    owner: '备件员',
    title: '低储备件、供应商 ETA 与关联工单',
    metric: '¥68.12万',
    status: '已生成',
    range: '本月',
    dataSource: 'SPARE_DB',
    exportState: '已完成',
    tone: 'cyan',
  },
  {
    id: 'RPT-SAFETY-REVIEW-006',
    type: '安全复盘',
    name: '安全态势复盘',
    owner: '安全委员会',
    title: '告警响应、策略命中和闭环率',
    metric: '91.8%',
    status: '待确认',
    range: '本周',
    dataSource: 'ALARM_DB',
    exportState: '审批中',
    tone: 'orange',
  },
] as const;

const workbenchReportDetailTabs = ['报表信息', '趋势分析', '导出记录', '审计追溯', '数据来源'] as const;

const workbenchReportTrendPoints = '0,84 68,78 136,62 204,68 272,48 340,54 408,38 476,28';

const workbenchReportCategoryShare = [
  { label: '生产设备', value: '45.60%', amount: '45,052.35', color: '#176de8' },
  { label: '检测仪器', value: '18.75%', amount: '18,517.26', color: '#12b6cf' },
  { label: '辅助设备', value: '12.30%', amount: '12,144.30', color: '#48c59c' },
  { label: 'IT 设备', value: '9.80%', amount: '9,681.23', color: '#f4a52b' },
  { label: '其他', value: '13.55%', amount: '13,365.11', color: '#8a63f6' },
] as const;

const workbenchReportDepartmentRank = [
  { label: '制造一部', value: '18,620.45', percent: 100 },
  { label: '制造二部', value: '15,842.30', percent: 85 },
  { label: '设备管理部', value: '12,356.78', percent: 66 },
  { label: '质量管理部', value: '8,975.60', percent: 48 },
] as const;

const workbenchReportExportHistory = [
  { name: '资产价值总览_20260614.xlsx', owner: '张三丰', status: '已完成', tone: 'green' },
  { name: '资产分类分布_20260614.pdf', owner: '张三丰', status: '已完成', tone: 'green' },
  { name: '部门资产统计_20260613.xlsx', owner: '李巡检', status: '失败', tone: 'red' },
] as const;

const workbenchAlarmSummaryCards = [
  { label: '安全评分', value: '92', delta: '分 · 较上周 +4', icon: ShieldCheck, tone: 'green' },
  { label: '高危事件', value: '3', delta: '需立即处置', icon: AlertTriangle, tone: 'red' },
  { label: '中危事件', value: '12', delta: '处理中', icon: Shield, tone: 'orange' },
  { label: '平均响应时间', value: '2.3h', delta: '本周统计', icon: Activity, tone: 'cyan' },
  { label: '已处置', value: '91.8%', delta: '本周闭环', icon: CheckCircle2, tone: 'green' },
  { label: '待处置', value: '8', delta: '待研判', icon: Wrench, tone: 'blue' },
] as const;

const workbenchAlarmStages = [
  { label: '发现', value: '36', note: '资产/策略告警', tone: 'red' },
  { label: '研判', value: '27', note: '自动聚合', tone: 'orange' },
  { label: '处置', value: '12', note: '工单联动', tone: 'blue' },
  { label: '复盘', value: '4', note: '策略需复核', tone: 'cyan' },
  { label: '闭环', value: '91.8%', note: '本周', tone: 'green' },
] as const;

const workbenchAlarmRows = [
  {
    id: 'ALM-20240614-0012',
    level: '高危',
    strategy: '熔断策略-12',
    asset: '数控车床 CN-301',
    location: '机加车间 / CNC 区域 A线',
    title: '主轴振动异常触发高危策略',
    score: 'P1',
    status: '待研判',
    response: '1.2h',
    owner: '安全运营',
    suggestion: '转派工单',
    tone: 'red',
  },
  {
    id: 'ALM-20240614-0011',
    level: '中危',
    strategy: '拦截白名单-08',
    asset: '注塑机 M-201',
    location: '一车间 / A线',
    title: '温度边界连续越限',
    score: 'P2',
    status: '处置中',
    response: '2.5h',
    owner: '王班组',
    suggestion: '现场复核',
    tone: 'orange',
  },
  {
    id: 'ALM-20240614-0010',
    level: '低危',
    strategy: '端口扫描-03',
    asset: 'IoT 网关 GW-A01',
    location: '数据采集间',
    title: '采集网关异常探测',
    score: 'P3',
    status: '已归档',
    response: '4.8h',
    owner: '平台运维',
    suggestion: '策略复盘',
    tone: 'blue',
  },
  {
    id: 'ALM-20240614-0009',
    level: '高危',
    strategy: '维保逾期联动',
    asset: '空压机 CP-101',
    location: '动力站',
    title: '油滤保养逾期叠加振动异常',
    score: 'P1',
    status: '待转派',
    response: '0.8h',
    owner: '王技师',
    suggestion: '创建工单',
    tone: 'red',
  },
  {
    id: 'ALM-20240614-0008',
    level: '中危',
    strategy: '位置漂移复核',
    asset: 'AGV-05',
    location: '物流区',
    title: '资产定位漂移超过阈值',
    score: 'P2',
    status: '待复核',
    response: '3.2h',
    owner: '物流运维',
    suggestion: '巡检确认',
    tone: 'orange',
  },
  {
    id: 'ALM-20240614-0007',
    level: '低危',
    strategy: '账号异常登录',
    asset: '报表服务账号',
    location: '平台服务',
    title: '非工作时段导出任务触发复核',
    score: 'P3',
    status: '已关闭',
    response: '6.1h',
    owner: '审计员',
    suggestion: '审计留痕',
    tone: 'green',
  },
] as const;

const workbenchAlarmDetailTabs = ['告警信息', '策略命中', '处置建议', '处理记录', '关联工单'] as const;

function WorkbenchDevicePage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(workbenchDeviceRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchDeviceDetailTabs)[number]>('设备信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedDevice =
    workbenchDeviceRows.find((device) => device.id === selectedDeviceId) ?? workbenchDeviceRows[0];
  const primaryAction = meta.actions[0];
  const secondaryAction = meta.actions[1] ?? primaryAction;

  const openDevicePreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Cpu,
  ) => {
    onPreviewAction({
      title,
      source: '设备管理页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openDevice = (device: (typeof workbenchDeviceRows)[number]) => {
    setSelectedDeviceId(device.id);
    setDetailOpen(true);
    openDevicePreview(
      '打开设备详情',
      `/equipment/${device.id}?source=workbench&menu=device`,
      `打开 ${device.device}，带入位置、健康分、遥测状态和 Workbench 设备管理来源。`,
      '打开详情',
      Cpu,
    );
  };

  return (
    <section className="workspace-orders-page workspace-device-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-device-product-shell" aria-label="设备管理产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><Cpu /></span>
              <div>
                <h2>设备管理</h2>
                <p>在线监测 · 遥测异常 · 现场派工</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="设备管理顶部操作">
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(primaryAction)}>
                <Cpu />
                打开设备台账
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openDevicePreview(
                    '采集链路诊断',
                    '/energy?source=workbench&scope=data-monitoring&device=all',
                    '进入数据监控中心，按设备采集延迟、网关状态和最近异常筛选。',
                    '进入数据监控',
                    Database,
                  )
                }
              >
                <Database />
                链路诊断
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(secondaryAction)}>
                <Wrench />
                创建复核工单
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="设备管理核心指标">
            {workbenchDeviceSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openDevicePreview(
                      `${card.label}设备`,
                      `/equipment?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻设备台账，保留厂区、产线和 Workbench 来源。`,
                      '查看设备',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label="设备运维阶段">
            {workbenchDeviceStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openDevicePreview(
                    `${stage.label}设备`,
                    `/equipment?source=workbench&stage=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 阶段查看设备状态和运维动作。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="设备管理查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索设备编号 / 名称 / 位置 / 责任人" aria-label="设备搜索" />
            </label>
            {['类型 全部', '在线状态 全部', '健康状态 全部', '产线 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(primaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openDevicePreview(
                  '按采集时间筛选',
                  '/equipment?source=workbench&telemetry=latest',
                  '查看最近采集时间和链路延迟异常设备。',
                  '查看采集状态',
                  CalendarDays,
                )
              }
            >
              采集时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(primaryAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="设备管理列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部设备" readOnly /></span>
              <span>设备号</span>
              <span>类型</span>
              <span>设备信息</span>
              <span>异常/任务</span>
              <span>健康分</span>
              <span>状态</span>
              <span>延迟</span>
              <span>责任人</span>
              <span>遥测</span>
              <span>操作</span>
            </div>
            {workbenchDeviceRows.map((device) => (
              <div
                key={device.id}
                className={`workspace-orders-table-row is-${device.tone} ${
                  device.id === selectedDevice.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${device.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openDevice(device)}>{device.id}</button>
                <span><em>{device.type}</em></span>
                <span>
                  <strong>{device.device}</strong>
                  <small>{device.location}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openDevice(device)}>{device.title}</button>
                <span><b>{device.health}</b></span>
                <span><i>{device.status}</i></span>
                <span>{device.delay}</span>
                <span>{device.owner}</span>
                <span><em className="is-spare">{device.telemetry}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedDeviceId(device.id);
                      setDetailOpen(true);
                      openDevicePreview(
                        '创建设备复核工单',
                        buildWorkOrderPrefillPath({
                          source: 'quick-action',
                          title: `${device.device} 设备异常复核工单`,
                          assetName: device.device,
                          assetLocation: device.location,
                          riskState: device.title,
                          riskScore: Number(device.health),
                          priority: device.tone === 'red' ? 'HIGH' : 'MEDIUM',
                          dueDate: '2026-06-16',
                          description: `来自 Workbench 设备管理：${device.telemetry}，需要现场复核。`,
                        }),
                        `为 ${device.device} 创建复核工单，预填位置、遥测和健康分。`,
                        '创建工单',
                        Wrench,
                      );
                    }}
                  >
                    派工
                  </button>
                  <button type="button" className="is-more" aria-label={`${device.id}更多操作`} onClick={() => openDevice(device)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="设备分页">
            <span>共 5,420 台</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4, 5].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <span>...</span>
            <button type="button">542</button>
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="设备详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>设备详情</strong>
              <button type="button" aria-label="关闭设备详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前设备信息">
              <div>
                <b>{selectedDevice.health}</b>
                <span>
                  <strong>{selectedDevice.id}</strong>
                  <small>{selectedDevice.status}</small>
                </span>
              </div>
              <h3>{selectedDevice.device}</h3>
              <dl>
                <div><dt>类型</dt><dd>{selectedDevice.type}</dd></div>
                <div><dt>健康分</dt><dd>{selectedDevice.health}</dd></div>
                <div><dt>位置</dt><dd>{selectedDevice.location}</dd></div>
                <div><dt>采集延迟</dt><dd>{selectedDevice.delay}</dd></div>
                <div><dt>责任人</dt><dd>{selectedDevice.owner}</dd></div>
                <div><dt>状态</dt><dd>{selectedDevice.status}</dd></div>
                <div><dt>最近采集</dt><dd>2026-06-14 10:28</dd></div>
                <div><dt>遥测</dt><dd>{selectedDevice.telemetry}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="设备运维流转">
              {['接入', '在线', '预警', '派工', '恢复'].map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '已完成' : index === 2 ? '待复核' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="设备详情标签">
              {workbenchDeviceDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>异常摘要</span>
                <p>{selectedDevice.title}，当前遥测为 {selectedDevice.telemetry}。</p>
              </article>
              <article>
                <span>实时遥测</span>
                <ul>
                  <li>采集延迟 {selectedDevice.delay} <b>已同步</b></li>
                  <li>{selectedDevice.telemetry} <b className="is-warning">需关注</b></li>
                  <li>MES 设备状态 <b>在线</b></li>
                </ul>
              </article>
              <article>
                <span>维保建议</span>
                <p>优先复核温度、振动和主轴负载；必要时生成预测维保工单并联动备件保障。</p>
              </article>
              <article>
                <span>采集链路</span>
                <ul>
                  <li>IoT 网关 GW-A01 <small>正常</small></li>
                  <li>MES 同步任务 MES-SYNC-08 <small>成功</small></li>
                  <li>最近异常 EVT-20240614-09 <small>已记录</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="设备详情操作">
              <button
                type="button"
                onClick={() =>
                  openDevicePreview(
                    '打开设备台账',
                    `/equipment/${selectedDevice.id}?source=workbench`,
                    `打开 ${selectedDevice.device} 的设备台账详情。`,
                    '打开台账',
                    Cpu,
                  )
                }
              >
                台账
              </button>
              <button
                type="button"
                onClick={() =>
                  openDevicePreview(
                    '发起巡检',
                    `/inspections/new?source=workbench&assetCode=${encodeURIComponent(selectedDevice.id)}`,
                    `为 ${selectedDevice.device} 发起巡检任务，预填设备编号和位置。`,
                    '发起巡检',
                    CheckCircle2,
                  )
                }
              >
                巡检
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  openDevicePreview(
                    '创建复核工单',
                    buildWorkOrderPrefillPath({
                      source: 'quick-action',
                      title: `${selectedDevice.device} 设备异常复核工单`,
                      assetName: selectedDevice.device,
                      assetLocation: selectedDevice.location,
                      riskState: selectedDevice.title,
                      riskScore: Number(selectedDevice.health),
                      priority: selectedDevice.tone === 'red' ? 'HIGH' : 'MEDIUM',
                      dueDate: '2026-06-16',
                      description: `来自 Workbench 设备详情：${selectedDevice.telemetry}，需要现场复核。`,
                    }),
                    `为 ${selectedDevice.device} 创建现场复核工单。`,
                    '创建工单',
                    Wrench,
                  )
                }
              >
                创建工单
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <Cpu />
            <strong>选择左侧设备打开详情</strong>
            <span>详情抽屉会展示遥测、维保建议、工单记录和采集链路。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchTodoPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedTodoId, setSelectedTodoId] = useState(workbenchTodoRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchTodoDetailTabs)[number]>('基本信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedTodo = workbenchTodoRows.find((todo) => todo.id === selectedTodoId) ?? workbenchTodoRows[0];
  const primaryAction = meta.actions[0];
  const secondaryAction = meta.actions[1] ?? primaryAction;

  const openTodoPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = ClipboardList,
  ) => {
    onPreviewAction({
      title,
      source: '流程待办页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openTodo = (todo: (typeof workbenchTodoRows)[number]) => {
    setSelectedTodoId(todo.id);
    setDetailOpen(true);
    openTodoPreview(
      '打开待办详情',
      `/approvals/${todo.id}?source=workbench&queue=todo`,
      `打开 ${todo.id}，带入来源模块、优先级、SLA 和处理上下文。`,
      '打开详情',
      FileText,
    );
  };

  return (
    <section className="workspace-orders-page workspace-todo-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-todo-product-shell" aria-label="流程待办产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><ClipboardList /></span>
              <div>
                <h2>流程待办</h2>
                <p>审批 · 派工 · 预警队列</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="流程待办顶部操作">
              <button
                type="button"
                className="is-secondary"
                onClick={() => onPreviewAction(primaryAction)}
              >
                <ClipboardList />
                批量处理
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openTodoPreview(
                    '刷新待办队列',
                    '/approvals?source=workbench&refresh=true',
                    '刷新审批、预测维保、巡检异常和备件低储队列。',
                    '刷新队列',
                    Activity,
                  )
                }
              >
                <Activity />
                刷新队列
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(secondaryAction)}>
                <Wrench />
                创建预测工单
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="流程待办核心指标">
            {workbenchTodoSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openTodoPreview(
                      `${card.label}队列`,
                      `/approvals?source=workbench&queue=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻流程待办，保留当前厂区和 Workbench 来源。`,
                      '查看队列',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <nav className="workspace-todo-queue-tabs" aria-label="流程待办状态切换">
            {workbenchTodoTabs.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                className={index === 0 ? 'is-active' : ''}
                onClick={() =>
                  openTodoPreview(
                    `${tab.label}队列`,
                    `/approvals?source=workbench&queue=${encodeURIComponent(tab.label)}`,
                    `按 ${tab.label} 查看流程待办，保留当前 Workbench 来源。`,
                    '查看队列',
                    ClipboardList,
                  )
                }
              >
                {tab.label}
                <small>({tab.value})</small>
              </button>
            ))}
          </nav>

          <div className="workspace-orders-filterbar" aria-label="流程待办查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索待办号 / 来源 / 标题 / 责任人" aria-label="流程待办搜索" />
            </label>
            {['类型 全部', '优先级 全部', '状态 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(secondaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openTodoPreview(
                  '按创建时间筛选',
                  '/approvals?source=workbench&createdAt=today',
                  '按创建时间筛选待办，保留类型、优先级和状态条件。',
                  '查看今日创建',
                  CalendarDays,
                )
              }
            >
              创建时间
              <CalendarDays />
            </button>
            <button
              type="button"
              className="is-reset"
              onClick={() =>
                openTodoPreview(
                  '筛选待办',
                  '/approvals?source=workbench&filter=drawer',
                  '打开流程待办筛选抽屉，预填当前厂区、状态和优先级。',
                  '打开筛选',
                  SlidersHorizontal,
                )
              }
            >
              <SlidersHorizontal />
              筛选
            </button>
            <button type="button" className="is-icon" aria-label="刷新流程待办" onClick={() => onPreviewAction(secondaryAction)}>
              <Activity />
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="流程待办列表">
            <div className="workspace-orders-table-head">
              <span>优先级</span>
              <span>类型</span>
              <span>标题</span>
              <span>关联对象</span>
              <span>发起人</span>
              <span>创建时间</span>
              <span>SLA</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {workbenchTodoRows.map((todo) => (
              <div
                key={todo.id}
                className={`workspace-orders-table-row is-${todo.tone} ${todo.id === selectedTodo.id ? 'is-selected' : ''}`}
              >
                <span><b>{todo.priority}</b></span>
                <span><em>{todo.type}</em></span>
                <button type="button" className="is-title" onClick={() => openTodo(todo)}>
                  <strong>{todo.title}</strong>
                  <small>单号 {todo.id}</small>
                </button>
                <span>{todo.relatedObject}</span>
                <span>
                  <strong>{todo.initiator}</strong>
                  <small>{todo.source}</small>
                </span>
                <span>{todo.createdAt}</span>
                <span className={todo.sla.includes('逾期') ? 'is-danger' : ''}>{todo.sla}</span>
                <span><i>{todo.status}</i></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedTodoId(todo.id);
                      setDetailOpen(true);
                      openTodoPreview(
                        '处理待办',
                        `/approvals/${todo.id}/process?source=workbench`,
                        `处理 ${todo.id}，带入 ${todo.type}、${todo.relatedObject} 和 SLA ${todo.sla}。`,
                        '进入处理',
                        ClipboardList,
                      );
                    }}
                  >
                    处理
                  </button>
                  <button type="button" className="is-more" aria-label={`${todo.id}更多操作`} onClick={() => openTodo(todo)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="流程待办分页">
            <span>共 105 条</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4, 5].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <span>...</span>
            <button type="button">11</button>
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="流程待办详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>待处理项详情</strong>
              <button type="button" aria-label="关闭待办详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前待办信息">
              <div className="workspace-todo-detail-summary">
                <span>
                  <b>{selectedTodo.priority}</b>
                  <small>{selectedTodo.status}</small>
                </span>
                <img src={selectedTodo.assetImage} alt="" />
              </div>
              <p>单号 {selectedTodo.id}</p>
              <h3>{selectedTodo.title}</h3>
              <dl>
                <div><dt>关联设备</dt><dd>{selectedTodo.relatedObject}</dd></div>
                <div><dt>申请人</dt><dd>{selectedTodo.initiator}</dd></div>
                <div><dt>所在位置</dt><dd>机加车间 · CNC 区域 A线</dd></div>
                <div><dt>申请时间</dt><dd>2026-06-14 09:12</dd></div>
                <div><dt>维修类型</dt><dd>{selectedTodo.context}</dd></div>
                <div><dt>申请金额</dt><dd>{selectedTodo.amount}</dd></div>
                <div><dt>故障描述</dt><dd>{selectedTodo.description}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="流程待办流转">
              {['申请人提交', '部门主管审核', '设备经理审核', '财务审核', '完成'].map((step, index) => (
                <span key={step} className={index === 0 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index === 0 ? '06-14 09:12' : index === 1 ? '审核' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="流程待办详情标签">
              {workbenchTodoDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>基本信息</span>
                <p>来源于 {selectedTodo.source}，关联对象为 {selectedTodo.relatedObject}，当前状态为 {selectedTodo.status}。</p>
              </article>
              <article>
                <span>审批流程</span>
                <ul>
                  <li>申请人提交 <b>已完成</b></li>
                  <li>部门主管审核 <b className="is-warning">待处理</b></li>
                  <li>设备经理审核 <small>待流转</small></li>
                </ul>
              </article>
              <article>
                <span>附件</span>
                <ul>
                  <li>维修报告.pdf <small>1.2 MB</small></li>
                  <li>费用明细.xlsx <small>82 KB</small></li>
                </ul>
              </article>
              <article>
                <span>处理建议</span>
                <p>建议同意申请，并批准 {selectedTodo.amount} 维修费用；高风险项优先转交设备经理复核。</p>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="流程待办详情操作">
              <button
                type="button"
                onClick={() =>
                  openTodoPreview(
                    '驳回待办',
                    `/approvals/${selectedTodo.id}/reject?source=workbench`,
                    `驳回 ${selectedTodo.id}，要求填写处理意见并回写审批中心。`,
                    '进入驳回',
                    X,
                  )
                }
              >
                驳回
              </button>
              <button
                type="button"
                onClick={() =>
                  openTodoPreview(
                    '转交待办',
                    `/approvals/${selectedTodo.id}/assign?source=workbench`,
                    `转交 ${selectedTodo.id}，保留待办来源和处理上下文。`,
                    '进入转交',
                    UserCircle,
                  )
                }
              >
                转交
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  openTodoPreview(
                    '同意待办',
                    `/approvals/${selectedTodo.id}/approve?source=workbench`,
                    `同意 ${selectedTodo.id}，带入 SLA、来源模块和业务上下文。`,
                    '进入同意',
                    ClipboardList,
                  )
                }
              >
                同意
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <FileText />
            <strong>选择左侧待办打开详情</strong>
            <span>详情抽屉会展示上下文、处理建议、流转记录和关联单据。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchOrdersPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedOrderId, setSelectedOrderId] = useState(workbenchOrderRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchOrderDetailTabs)[number]>('工单信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedOrder = workbenchOrderRows.find((order) => order.id === selectedOrderId) ?? workbenchOrderRows[0];
  const primaryAction = meta.actions[0];
  const secondaryAction = meta.actions[1] ?? primaryAction;

  const openOrderPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = ClipboardList,
  ) => {
    onPreviewAction({
      title,
      source: '工单管理页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openRow = (order: (typeof workbenchOrderRows)[number]) => {
    setSelectedOrderId(order.id);
    setDetailOpen(true);
    openOrderPreview(
      '打开工单详情',
      `/workorders/${order.id}?source=workbench&menu=orders`,
      `打开 ${order.id}，带入设备、SLA、备件状态和 Workbench 工单管理来源。`,
      '打开详情',
      FileText,
    );
  };

  return (
    <section className="workspace-orders-page workspace-workorder-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-workorder-product-shell" aria-label="工单管理产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><ClipboardList /></span>
              <div>
                <h2>工单管理</h2>
                <p>预测工单 · 派工执行 · 验收闭环</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="工单管理顶部操作">
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openOrderPreview(
                    '高级筛选',
                    '/workorders?source=workbench&filter=advanced&status=PENDING',
                    '打开工单列表并保留高级筛选上下文，支持类型、优先级、状态、责任人和创建时间组合查询。',
                    '打开筛选',
                    SlidersHorizontal,
                  )
                }
              >
                <SlidersHorizontal />
                高级筛选
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openOrderPreview(
                    '导出工单',
                    '/reports?source=workbench&view=workorders&export=xlsx',
                    '按当前筛选条件导出预测维保、派工、执行和验收闭环工单。',
                    '进入导出',
                    FileText,
                  )
                }
              >
                <FileText />
                导出
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(primaryAction)}>
                <ClipboardList />
                新建工单
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="工单管理核心指标">
            {workbenchOrderSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openOrderPreview(
                      `${card.label}筛选`,
                      `/workorders?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 指标下钻工单队列，保留 Workbench 来源和当前厂区上下文。`,
                      '查看队列',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label="工单流程阶段">
            {workbenchOrderStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openOrderPreview(
                    `${stage.label}阶段工单`,
                    `/workorders?source=workbench&stage=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 阶段查看工单，进入列表后保留阶段筛选。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="工单查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索工单号 / 设备 / 标题 / 报修人" aria-label="工单搜索" />
            </label>
            {['类型 全部', '优先级 全部', '状态 全部', '责任人 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(secondaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openOrderPreview(
                  '按创建时间筛选',
                  '/workorders?source=workbench&createdAt=today',
                  '打开工单列表并预填今日创建时间范围。',
                  '查看今日工单',
                  CalendarDays,
                )
              }
            >
              创建时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(secondaryAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="工单管理列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部工单" readOnly /></span>
              <span>工单号</span>
              <span>类型</span>
              <span>设备信息</span>
              <span>标题</span>
              <span>优先级</span>
              <span>状态</span>
              <span>SLA</span>
              <span>责任人</span>
              <span>备件状态</span>
              <span>操作</span>
            </div>
            {workbenchOrderRows.map((order) => (
              <div
                key={order.id}
                className={`workspace-orders-table-row is-${order.tone} ${
                  order.id === selectedOrder.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${order.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openRow(order)}>{order.id}</button>
                <span><em>{order.type}</em></span>
                <span>
                  <strong>{order.device}</strong>
                  <small>{order.location}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openRow(order)}>{order.title}</button>
                <span><b>{order.priority}</b></span>
                <span><i>{order.status}</i></span>
                <span className={order.sla.startsWith('-') ? 'is-danger' : ''}>{order.sla}</span>
                <span>{order.owner}</span>
                <span><em className="is-spare">{order.spare}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setDetailOpen(true);
                      openOrderPreview(
                        '处理工单',
                        `/workorders/${order.id}?source=workbench&action=process`,
                        `处理 ${order.id}，带入当前状态 ${order.status}、SLA ${order.sla} 和责任人 ${order.owner}。`,
                        '进入处理',
                        Wrench,
                      );
                    }}
                  >
                    处理
                  </button>
                  <button type="button" className="is-more" aria-label={`${order.id}更多操作`} onClick={() => openRow(order)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="工单分页">
            <span>共 216 条</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4, 5].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <span>...</span>
            <button type="button">22</button>
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="工单详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>工单详情</strong>
              <button type="button" aria-label="关闭工单详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前工单信息">
              <div>
                <b>{selectedOrder.priority}</b>
                <span>
                  <strong>{selectedOrder.id}</strong>
                  <small>{selectedOrder.status}</small>
                </span>
              </div>
              <h3>{selectedOrder.title}</h3>
              <dl>
                <div><dt>设备</dt><dd>{selectedOrder.device}</dd></div>
                <div><dt>SLA 限时</dt><dd>2026-06-14 10:30</dd></div>
                <div><dt>位置</dt><dd>{selectedOrder.location} · CNC 区域 A线</dd></div>
                <div><dt>剩余/逾期</dt><dd className={selectedOrder.sla.startsWith('-') ? 'is-danger' : ''}>{selectedOrder.sla}</dd></div>
                <div><dt>报修人</dt><dd>系统预测</dd></div>
                <div><dt>优先级</dt><dd>{selectedOrder.priority} 紧急</dd></div>
                <div><dt>创建时间</dt><dd>2026-06-14 09:12</dd></div>
                <div><dt>责任人</dt><dd>{selectedOrder.owner}</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="工单流程">
              {['预测', '派工', '执行', '验收', '闭环'].map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '06-14 09:12' : index === 2 ? '待执行' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="工单详情标签">
              {workbenchOrderDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>故障描述</span>
                <p>主轴轴承振动 RMS 持续上升，预测未来 3 天存在故障风险。</p>
              </article>
              <article>
                <span>备件需求</span>
                <ul>
                  <li>轴承 6205-2RS × 2 <b>已到位</b></li>
                  <li>润滑脂 LGHP-2 × 1 <b>已到位</b></li>
                  <li>密封圈 35×62×7 × 1 <b className="is-warning">待采购</b></li>
                </ul>
              </article>
              <article>
                <span>处理建议</span>
                <p>更换主轴轴承，检查润滑系统，并在试运行后回写验收记录。</p>
              </article>
              <article>
                <span>附件</span>
                <ul>
                  <li>振动趋势图.pdf <small>1.8 MB</small></li>
                  <li>设备点检记录.xlsx <small>86 KB</small></li>
                  <li>历史维保记录.pdf <small>1.2 MB</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="工单详情操作">
              <button
                type="button"
                onClick={() =>
                  openOrderPreview(
                    '转派工单',
                    `/workorders/${selectedOrder.id}/assign?source=workbench`,
                    `转派 ${selectedOrder.id}，保留当前工单详情和备件状态。`,
                    '进入转派',
                    UserCircle,
                  )
                }
              >
                转派
              </button>
              <button
                type="button"
                onClick={() =>
                  openOrderPreview(
                    '挂起工单',
                    `/workorders/${selectedOrder.id}/suspend?source=workbench`,
                    `挂起 ${selectedOrder.id} 并要求填写原因，不在 Workbench 内直接提交危险操作。`,
                    '进入挂起',
                    AlertTriangle,
                  )
                }
              >
                挂起
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  openOrderPreview(
                    '开始执行',
                    `/workorders/${selectedOrder.id}/execute?source=workbench`,
                    `开始执行 ${selectedOrder.id}，带入设备、处理建议和附件上下文。`,
                    '开始执行',
                    Wrench,
                  )
                }
              >
                开始执行
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <FileText />
            <strong>选择左侧工单打开详情</strong>
            <span>详情抽屉会展示流程、备件、处理记录和关联告警。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchReportPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedReportId, setSelectedReportId] = useState(workbenchReportRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchReportDetailTabs)[number]>('报表信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedReport =
    workbenchReportRows.find((report) => report.id === selectedReportId) ?? workbenchReportRows[0];
  const primaryAction = meta.actions[0];
  const exportAction = meta.actions[1] ?? primaryAction;

  const openReportPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = BarChart3,
  ) => {
    onPreviewAction({
      title,
      source: '报表分析页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openReport = (report: (typeof workbenchReportRows)[number]) => {
    setSelectedReportId(report.id);
    setDetailOpen(true);
    openReportPreview(
      '打开报表详情',
      `/reports/${report.id}?source=workbench&menu=report`,
      `打开 ${report.name}，带入模板、时间范围、数据源和导出审计上下文。`,
      '打开详情',
      FileText,
    );
  };

  return (
    <section className="workspace-orders-page workspace-report-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-report-product-shell" aria-label="报表分析产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><BarChart3 /></span>
              <div>
                <h2>报表分析</h2>
                <p>模板中心 · 分析视图 · 导出订阅</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="报表分析顶部操作">
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(primaryAction)}>
                <BarChart3 />
                打开经营报表
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(exportAction)}>
                <FileText />
                导出资产趋势
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openReportPreview(
                    '订阅经营报表',
                    '/reports?source=workbench&view=operations&subscribe=true',
                    '进入报表订阅配置，预填资产价值、部门统计和导出频率。',
                    '进入订阅',
                    Bell,
                  )
                }
              >
                <Bell />
                订阅报表
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="报表分析核心指标">
            {workbenchReportSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openReportPreview(
                      `${card.label}报表`,
                      `/reports?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻经营分析，保留当前报表模板和时间范围。`,
                      '查看报表',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <section className="workspace-report-analytics-grid" aria-label="报表分析图表区">
            <article className="workspace-report-trend-card" aria-label="报表趋势图">
              <header>
                <span>资产价值趋势（万元）</span>
                <button
                  type="button"
                  onClick={() =>
                    openReportPreview(
                      '查看资产价值趋势',
                      '/reports?source=workbench&view=asset-trend&period=30d',
                      '打开资产价值趋势分析，带入最近 30 天、总值、净值和风险资产口径。',
                      '查看趋势',
                      TrendingUp,
                    )
                  }
                >
                  按日
                </button>
              </header>
              <svg viewBox="0 0 476 118" role="img" aria-label="资产价值趋势折线">
                <defs>
                  <linearGradient id="reportTrendFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#176de8" stopOpacity=".22" />
                    <stop offset="100%" stopColor="#176de8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`M ${workbenchReportTrendPoints} L 476 118 L 0 118 Z`} fill="url(#reportTrendFill)" />
                <polyline points={workbenchReportTrendPoints} fill="none" stroke="#176de8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="0,98 68,92 136,86 204,90 272,78 340,72 408,76 476,64" fill="none" stroke="#12b6cf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <footer>
                <span>资产总价值</span>
                <span>在用资产净值</span>
                <strong>¥98,760.25 万</strong>
              </footer>
            </article>

            <article className="workspace-report-donut-card" aria-label="资产分类环图">
              <header>
                <span>资产分类分布</span>
                <strong>98,760.25</strong>
              </header>
              <div className="workspace-report-donut-wrap">
                <div className="workspace-report-donut" role="img" aria-label="资产分类占比环图">
                  <span>总资产净值</span>
                  <b>98,760.25</b>
                </div>
                <ul>
                  {workbenchReportCategoryShare.map((category) => (
                    <li key={category.label} style={{ '--report-category-color': category.color } as CSSProperties}>
                      <span>{category.label}</span>
                      <em>{category.value}</em>
                      <strong>{category.amount}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="workspace-report-rank-card" aria-label="部门资产排行">
              <header>
                <span>部门资产价值 Top 4</span>
                <button
                  type="button"
                  onClick={() =>
                    openReportPreview(
                      '查看部门资产统计',
                      '/reports?source=workbench&view=department-assets',
                      '打开部门资产统计，带入资产数量、净值、风险资产和在用率。',
                      '查看明细',
                      BarChart3,
                    )
                  }
                >
                  按价值
                </button>
              </header>
              <div>
                {workbenchReportDepartmentRank.map((rank) => (
                  <button
                    key={rank.label}
                    type="button"
                    onClick={() =>
                      openReportPreview(
                        `${rank.label}资产明细`,
                        `/reports?source=workbench&view=department-assets&department=${encodeURIComponent(rank.label)}`,
                        `查看 ${rank.label} 的资产价值、风险资产和部门统计明细。`,
                        '查看部门',
                        BarChart3,
                      )
                    }
                  >
                    <span>{rank.label}</span>
                    <i><b style={{ '--report-rank-width': `${rank.percent}%` } as CSSProperties} /></i>
                    <strong>{rank.value}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className="workspace-report-export-card" aria-label="导出历史摘要">
              <header>
                <span>导出历史</span>
                <button type="button" onClick={() => onPreviewAction(exportAction)}>更多</button>
              </header>
              {workbenchReportExportHistory.map((history) => (
                <button
                  key={history.name}
                  type="button"
                  className={`is-${history.tone}`}
                  onClick={() =>
                    openReportPreview(
                      `${history.name}导出记录`,
                      `/reports/export-history?source=workbench&file=${encodeURIComponent(history.name)}`,
                      `打开 ${history.name} 的导出记录，带入创建人 ${history.owner} 和状态 ${history.status}。`,
                      history.status === '失败' ? '重试导出' : '查看记录',
                      FileText,
                    )
                  }
                >
                  <FileText />
                  <span>
                    <strong>{history.name}</strong>
                    <small>{history.owner}</small>
                  </span>
                  <em>{history.status}</em>
                </button>
              ))}
            </article>
          </section>

          <div className="workspace-orders-stage-row" aria-label="报表分析流程">
            {workbenchReportStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openReportPreview(
                    `${stage.label}报表任务`,
                    `/reports?source=workbench&stage=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 阶段查看报表任务、导出记录和订阅状态。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="报表分析查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索报表名称 / 模板 / 创建人 / 数据源" aria-label="报表搜索" />
            </label>
            {['模板 全部', '时间范围 30天', '数据源 全部', '状态 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(primaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openReportPreview(
                  '按生成时间筛选',
                  '/reports?source=workbench&view=operations&generatedAt=today',
                  '查看今日生成、导出和订阅推送的报表任务。',
                  '查看今日报表',
                  CalendarDays,
                )
              }
            >
              生成时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(primaryAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="报表分析列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部报表" readOnly /></span>
              <span>报表编号</span>
              <span>类型</span>
              <span>报表信息</span>
              <span>分析内容</span>
              <span>指标</span>
              <span>状态</span>
              <span>时间范围</span>
              <span>创建人</span>
              <span>数据源</span>
              <span>操作</span>
            </div>
            {workbenchReportRows.map((report) => (
              <div
                key={report.id}
                className={`workspace-orders-table-row is-${report.tone} ${
                  report.id === selectedReport.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${report.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openReport(report)}>{report.id}</button>
                <span><em>{report.type}</em></span>
                <span>
                  <strong>{report.name}</strong>
                  <small>{report.exportState}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openReport(report)}>{report.title}</button>
                <span><b>{report.metric}</b></span>
                <span><i>{report.status}</i></span>
                <span>{report.range}</span>
                <span>{report.owner}</span>
                <span><em className="is-spare">{report.dataSource}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setDetailOpen(true);
                      openReportPreview(
                        '重新导出报表',
                        `/reports/${report.id}/export?source=workbench&format=xlsx`,
                        `重新导出 ${report.name}，保留模板、时间范围和数据源审计记录。`,
                        '重新导出',
                        FileText,
                      );
                    }}
                  >
                    导出
                  </button>
                  <button type="button" className="is-more" aria-label={`${report.id}更多操作`} onClick={() => openReport(report)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="报表分页">
            <span>共 26 个模板</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="报表详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>订阅 / 导出详情</strong>
              <button type="button" aria-label="关闭报表详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前报表信息">
              <div>
                <b>{selectedReport.metric}</b>
                <span>
                  <strong>{selectedReport.id}</strong>
                  <small>{selectedReport.status}</small>
                </span>
              </div>
              <h3>{selectedReport.name}</h3>
              <dl>
                <div><dt>报表类型</dt><dd>{selectedReport.type}</dd></div>
                <div><dt>导出状态</dt><dd>{selectedReport.exportState}</dd></div>
                <div><dt>时间范围</dt><dd>{selectedReport.range}</dd></div>
                <div><dt>创建人</dt><dd>{selectedReport.owner}</dd></div>
                <div><dt>数据源</dt><dd>{selectedReport.dataSource}</dd></div>
                <div><dt>生成时间</dt><dd>2026-06-14 10:28</dd></div>
                <div><dt>审计状态</dt><dd>已留痕</dd></div>
                <div><dt>分发方式</dt><dd>XLSX / PDF / 订阅</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="报表生成流程">
              {['任务开始', '数据准备', '数据计算', '报告生成', '分发审计'].map((step, index) => (
                <span key={step} className={index < 4 ? 'is-done' : 'is-active'}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 4 ? '已完成' : '可订阅'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="报表详情标签">
              {workbenchReportDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>分析摘要</span>
                <p>{selectedReport.title}，当前核心指标为 {selectedReport.metric}。</p>
              </article>
              <article>
                <span>导出记录</span>
                <ul>
                  <li>{selectedReport.name}_20260614.xlsx <b>{selectedReport.exportState}</b></li>
                  <li>{selectedReport.name}_20260614.pdf <b>已完成</b></li>
                  <li>审计链路 {selectedReport.dataSource} <b>成功</b></li>
                </ul>
              </article>
              <article>
                <span>订阅配置</span>
                <p>支持按周推送给设备、财务和安全角色，并保留 Workbench 来源与筛选条件。</p>
              </article>
              <article>
                <span>数据来源</span>
                <ul>
                  <li>资产主数据 ASSET_DB <small>成功</small></li>
                  <li>工单数据 WORKORDER_DB <small>成功</small></li>
                  <li>巡检数据 INSPECTION_DB <small>成功</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="报表详情操作">
              <button
                type="button"
                onClick={() =>
                  openReportPreview(
                    '关闭报表详情',
                    '/reports?source=workbench&view=operations',
                    '回到报表中心，保留当前模板和筛选条件。',
                    '返回报表',
                    X,
                  )
                }
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() =>
                  openReportPreview(
                    '重新导出报表',
                    `/reports/${selectedReport.id}/export?source=workbench&format=xlsx`,
                    `重新导出 ${selectedReport.name} 并记录审计链路。`,
                    '重新导出',
                    FileText,
                  )
                }
              >
                重新导出
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  openReportPreview(
                    '订阅此报表',
                    `/reports/${selectedReport.id}/subscribe?source=workbench`,
                    `订阅 ${selectedReport.name}，预填模板、时间范围和接收角色。`,
                    '订阅报表',
                    Bell,
                  )
                }
              >
                订阅此报表
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <BarChart3 />
            <strong>选择左侧报表打开详情</strong>
            <span>详情抽屉会展示趋势、导出、订阅、审计和数据源状态。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchAlarmPage({
  item,
  context,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
  const [selectedAlarmId, setSelectedAlarmId] = useState(workbenchAlarmRows[0].id);
  const [detailTab, setDetailTab] = useState<(typeof workbenchAlarmDetailTabs)[number]>('告警信息');
  const [detailOpen, setDetailOpen] = useState(true);
  const selectedAlarm = workbenchAlarmRows.find((alarm) => alarm.id === selectedAlarmId) ?? workbenchAlarmRows[0];
  const primaryAction = meta.actions[0];
  const dispatchAction = meta.actions[1] ?? primaryAction;

  const openAlarmPreview = (
    title: string,
    routeTarget: string,
    description: string,
    primaryLabel: string,
    icon: LucideIcon = Bell,
  ) => {
    onPreviewAction({
      title,
      source: '告警中心页面',
      routeTarget,
      description,
      primaryLabel,
      icon,
      visual: meta.imageSrc,
      stats: context.stats,
    });
  };

  const openAlarm = (alarm: (typeof workbenchAlarmRows)[number]) => {
    setSelectedAlarmId(alarm.id);
    setDetailOpen(true);
    openAlarmPreview(
      '打开告警详情',
      `/notifications/${alarm.id}?source=workbench&menu=alarm`,
      `打开 ${alarm.id}，带入等级、策略、资产、处置建议和 Workbench 告警来源。`,
      '打开详情',
      Bell,
    );
  };

  return (
    <section className="workspace-orders-page workspace-alarm-page" aria-label={`${item.label}真实产品页`}>
      <div className="workspace-orders-main">
        <section className="workspace-menu-product-shell workspace-alarm-product-shell" aria-label="告警中心产品页主体">
          <header className="workspace-orders-header">
            <div className="workspace-orders-title">
              <span className="workspace-orders-icon"><Bell /></span>
              <div>
                <h2>告警中心</h2>
                <p>等级研判 · 策略命中 · 处置复盘</p>
              </div>
            </div>
            <div className="workspace-orders-toolbar" aria-label="告警中心顶部操作">
              <button type="button" className="is-secondary" onClick={() => onPreviewAction(primaryAction)}>
                <Bell />
                查看告警队列
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() =>
                  openAlarmPreview(
                    '查看策略命中',
                    '/risk-matrix?source=workbench&scope=alarm&hit=true',
                    '进入风险矩阵，按告警策略命中、等级和资产影响范围筛选。',
                    '进入策略',
                    ShieldCheck,
                  )
                }
              >
                <ShieldCheck />
                策略命中
              </button>
              <button type="button" className="is-primary" onClick={() => onPreviewAction(dispatchAction)}>
                <AlertTriangle />
                转派处置工单
              </button>
            </div>
          </header>

          <div className="workspace-orders-kpis" aria-label="告警中心核心指标">
            {workbenchAlarmSummaryCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  className={`is-${card.tone}`}
                  onClick={() =>
                    openAlarmPreview(
                      `${card.label}告警`,
                      `/notifications?source=workbench&metric=${encodeURIComponent(card.label)}`,
                      `按 ${card.label} 下钻告警队列，保留安全态势、策略和资产上下文。`,
                      '查看告警',
                      CardIcon,
                    )
                  }
                >
                  <CardIcon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.delta}</small>
                </button>
              );
            })}
          </div>

          <div className="workspace-orders-stage-row" aria-label="告警处置流程">
            {workbenchAlarmStages.map((stage) => (
              <button
                key={stage.label}
                type="button"
                className={`is-${stage.tone}`}
                onClick={() =>
                  openAlarmPreview(
                    `${stage.label}告警`,
                    `/notifications?source=workbench&stage=${encodeURIComponent(stage.label)}`,
                    `按 ${stage.label} 阶段查看告警处置和复盘记录。`,
                    '查看阶段',
                    ArrowRight,
                  )
                }
              >
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <small>{stage.note}</small>
              </button>
            ))}
          </div>

          <div className="workspace-orders-filterbar" aria-label="告警中心查询筛选栏">
            <label>
              <Search />
              <input readOnly value="搜索告警号 / 策略 / 资产 / 责任人" aria-label="告警搜索" />
            </label>
            {['等级 全部', '状态 全部', '策略 全部', '责任人 全部'].map((filter) => (
              <button key={filter} type="button" onClick={() => onPreviewAction(primaryAction)}>
                {filter}
                <ArrowRight />
              </button>
            ))}
            <button
              type="button"
              className="is-date"
              onClick={() =>
                openAlarmPreview(
                  '按响应时间筛选',
                  '/notifications?source=workbench&respondedAt=today',
                  '查看今日响应、处置和复盘的告警记录。',
                  '查看响应',
                  CalendarDays,
                )
              }
            >
              响应时间
              <CalendarDays />
            </button>
            <button type="button" className="is-reset" onClick={() => onPreviewAction(primaryAction)}>
              重置
            </button>
          </div>

          <div className="workspace-orders-table" aria-label="告警中心列表">
            <div className="workspace-orders-table-head">
              <span><input type="checkbox" aria-label="选择全部告警" readOnly /></span>
              <span>告警号</span>
              <span>等级</span>
              <span>资产信息</span>
              <span>告警标题</span>
              <span>优先级</span>
              <span>状态</span>
              <span>响应</span>
              <span>责任人</span>
              <span>处置建议</span>
              <span>操作</span>
            </div>
            {workbenchAlarmRows.map((alarm) => (
              <div
                key={alarm.id}
                className={`workspace-orders-table-row is-${alarm.tone} ${
                  alarm.id === selectedAlarm.id ? 'is-selected' : ''
                }`}
              >
                <span><input type="checkbox" aria-label={`选择${alarm.id}`} readOnly /></span>
                <button type="button" className="is-link" onClick={() => openAlarm(alarm)}>{alarm.id}</button>
                <span><em>{alarm.level}</em></span>
                <span>
                  <strong>{alarm.asset}</strong>
                  <small>{alarm.location}</small>
                </span>
                <button type="button" className="is-title" onClick={() => openAlarm(alarm)}>{alarm.title}</button>
                <span><b>{alarm.score}</b></span>
                <span><i>{alarm.status}</i></span>
                <span>{alarm.response}</span>
                <span>{alarm.owner}</span>
                <span><em className="is-spare">{alarm.suggestion}</em></span>
                <span>
                  <button
                    type="button"
                    className="is-process"
                    onClick={() => {
                      setSelectedAlarmId(alarm.id);
                      setDetailOpen(true);
                      openAlarmPreview(
                        '处理告警',
                        `/notifications/${alarm.id}/process?source=workbench`,
                        `处理 ${alarm.id}，带入等级 ${alarm.level}、策略 ${alarm.strategy} 和处置建议。`,
                        '进入处理',
                        AlertTriangle,
                      );
                    }}
                  >
                    处理
                  </button>
                  <button type="button" className="is-more" aria-label={`${alarm.id}更多操作`} onClick={() => openAlarm(alarm)}>
                    ···
                  </button>
                </span>
              </div>
            ))}
          </div>

          <footer className="workspace-orders-pagination" aria-label="告警分页">
            <span>共 36 条</span>
            <button type="button">10条/页</button>
            <button type="button" disabled>‹</button>
            {[1, 2, 3, 4].map((pageNo) => (
              <button key={pageNo} type="button" className={pageNo === 1 ? 'is-current' : ''}>{pageNo}</button>
            ))}
            <button type="button">›</button>
          </footer>
        </section>
      </div>

      <aside className="workspace-orders-detail" aria-label="告警详情抽屉">
        {detailOpen ? (
          <>
            <header className="workspace-orders-detail-head">
              <strong>告警研判详情</strong>
              <button type="button" aria-label="关闭告警详情" onClick={() => setDetailOpen(false)}>
                <X />
              </button>
            </header>
            <section className="workspace-orders-detail-card" aria-label="当前告警信息">
              <div>
                <b>{selectedAlarm.score}</b>
                <span>
                  <strong>{selectedAlarm.id}</strong>
                  <small>{selectedAlarm.status}</small>
                </span>
              </div>
              <h3>{selectedAlarm.title}</h3>
              <dl>
                <div><dt>告警等级</dt><dd>{selectedAlarm.level}</dd></div>
                <div><dt>策略命中</dt><dd>{selectedAlarm.strategy}</dd></div>
                <div><dt>资产</dt><dd>{selectedAlarm.asset}</dd></div>
                <div><dt>位置</dt><dd>{selectedAlarm.location}</dd></div>
                <div><dt>响应时长</dt><dd>{selectedAlarm.response}</dd></div>
                <div><dt>责任人</dt><dd>{selectedAlarm.owner}</dd></div>
                <div><dt>处置建议</dt><dd>{selectedAlarm.suggestion}</dd></div>
                <div><dt>最近触发</dt><dd>2026-06-14 10:18</dd></div>
              </dl>
            </section>

            <section className="workspace-orders-flow" aria-label="告警研判流转">
              {['发现', '聚合', '研判', '处置', '复盘'].map((step, index) => (
                <span key={step} className={index < 2 ? 'is-done' : index === 2 ? 'is-active' : ''}>
                  <CheckCircle2 />
                  <strong>{step}</strong>
                  <small>{index < 2 ? '已完成' : index === 2 ? '待研判' : '待流转'}</small>
                </span>
              ))}
            </section>

            <nav className="workspace-orders-tabs" aria-label="告警详情标签">
              {workbenchAlarmDetailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === detailTab ? 'is-active' : ''}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <section className="workspace-orders-tab-panel" aria-label={`${detailTab}内容`}>
              <article>
                <span>告警摘要</span>
                <p>{selectedAlarm.asset} 命中 {selectedAlarm.strategy}，当前建议为 {selectedAlarm.suggestion}。</p>
              </article>
              <article>
                <span>策略命中</span>
                <ul>
                  <li>{selectedAlarm.strategy} <b>{selectedAlarm.level}</b></li>
                  <li>资产影响范围 {selectedAlarm.location} <b>已识别</b></li>
                  <li>响应 SLA {selectedAlarm.response} <b className="is-warning">需跟进</b></li>
                </ul>
              </article>
              <article>
                <span>处置建议</span>
                <p>先完成远程研判，再按风险等级转派工单或巡检；复盘时回写策略命中效果。</p>
              </article>
              <article>
                <span>关联工单</span>
                <ul>
                  <li>WO-20240614-0012 <small>派工中</small></li>
                  <li>INSP-20260614-M201 <small>待现场复核</small></li>
                  <li>复盘任务 RV-20240614-03 <small>待启动</small></li>
                </ul>
              </article>
            </section>

            <footer className="workspace-orders-detail-actions" aria-label="告警详情操作">
              <button
                type="button"
                onClick={() =>
                  openAlarmPreview(
                    '转派告警',
                    `/notifications/${selectedAlarm.id}/assign?source=workbench`,
                    `转派 ${selectedAlarm.id}，保留策略、资产和响应 SLA。`,
                    '进入转派',
                    UserCircle,
                  )
                }
              >
                转派
              </button>
              <button
                type="button"
                onClick={() =>
                  openAlarmPreview(
                    '发起复盘',
                    `/notifications/${selectedAlarm.id}/review?source=workbench`,
                    `对 ${selectedAlarm.id} 发起策略复盘，带入策略命中和处置记录。`,
                    '进入复盘',
                    ShieldCheck,
                  )
                }
              >
                复盘
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  openAlarmPreview(
                    '创建告警处置工单',
                    buildWorkOrderPrefillPath({
                      source: 'asset-risk',
                      title: `${selectedAlarm.asset} 告警处置工单`,
                      assetName: selectedAlarm.asset,
                      assetLocation: selectedAlarm.location,
                      riskState: selectedAlarm.level,
                      riskScore: selectedAlarm.score === 'P1' ? 92 : selectedAlarm.score === 'P2' ? 78 : 62,
                      riskLevel: selectedAlarm.level,
                      priority: selectedAlarm.level === '高危' ? 'CRITICAL' : 'HIGH',
                      dueDate: '2026-06-15',
                      description: `来自 Workbench 告警中心：${selectedAlarm.title}，建议 ${selectedAlarm.suggestion}。`,
                    }),
                    `为 ${selectedAlarm.asset} 创建告警处置工单。`,
                    '创建工单',
                    AlertTriangle,
                  )
                }
              >
                创建工单
              </button>
            </footer>
          </>
        ) : (
          <button type="button" className="workspace-orders-detail-empty" onClick={() => setDetailOpen(true)}>
            <Bell />
            <strong>选择左侧告警打开详情</strong>
            <span>详情抽屉会展示等级、策略命中、处置建议、处理记录和关联工单。</span>
          </button>
        )}
      </aside>
    </section>
  );
}

function WorkbenchProductPage({
  item,
  context,
  mock,
  meta,
  onPreviewAction,
}: WorkbenchMenuPageProps) {
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
              <strong>21</strong>
              设计稿
            </span>
            <span>
              <strong>18</strong>
              页面稿
            </span>
            <span>
              <strong>11</strong>
              业务菜单
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
            {screen.route ? (
              <>
                <small className="workspace-stitch-route">{screen.route}</small>
                <a href={screen.route}>
                  {screen.linkLabel ?? '进入正式路由'}
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
    () => (isWorkbenchRoute ? menuItems.filter(isVisibleWorkbenchRouteMenuItem) : menuItems),
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

          {!isWorkbenchRoute ? (
            <WorkspaceContextStrip item={activeItem} context={activeContext} onAction={handleContextAction} />
          ) : null}
          {activeModuleMock && activeProductPageMeta && activeItem.id === 'home' ? (
            <WorkbenchHomePage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'asset' ? (
            <WorkbenchAssetPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'device' ? (
            <WorkbenchDevicePage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'todo' ? (
            <WorkbenchTodoPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'orders' ? (
            <WorkbenchOrdersPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'spares' ? (
            <WorkbenchSparesPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'energy' ? (
            <WorkbenchEnergyPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'report' ? (
            <WorkbenchReportPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'alarm' ? (
            <WorkbenchAlarmPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'policy' ? (
            <WorkbenchPolicyPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta && activeItem.id === 'settings' ? (
            <WorkbenchSettingsPage
              item={activeItem}
              context={activeContext}
              mock={activeModuleMock}
              meta={activeProductPageMeta}
              onPreviewAction={setRoutePreview}
            />
          ) : activeModuleMock && activeProductPageMeta ? (
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
