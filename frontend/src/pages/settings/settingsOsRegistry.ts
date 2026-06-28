export type TabKey =
  | 'sysconfig'
  | 'numbering'
  | 'notif-pref'
  | 'notif-template'
  | 'notif-channel'
  | 'notif-switch'
  | 'mail-template'
  | 'mail-log'
  | 'webhook'
  | 'sla-config';

export type AppTone = 'stable' | 'attention' | 'contract';

export type SettingsOsIconKey =
  | 'settings'
  | 'hash'
  | 'clock'
  | 'radio'
  | 'webhook'
  | 'scroll-text'
  | 'file-text'
  | 'toggle-left'
  | 'bell'
  | 'mail'
  | 'users'
  | 'user-cog'
  | 'menu-square'
  | 'building'
  | 'briefcase'
  | 'type'
  | 'package-check'
  | 'landmark';

export interface SettingsApp {
  key: TabKey;
  group: '核心' | '通知' | '邮件' | '集成';
  label: string;
  shortLabel: string;
  summary: string;
  mission: string;
  iconKey: SettingsOsIconKey;
  tone: AppTone;
  signal: string;
  phase: string;
  metric: string;
  inspector: string[];
  actions: string[];
}

export type SystemAppStatus = 'ready' | 'contract';

export interface SystemApp {
  key: string;
  group: '账号权限' | '组织结构' | '后台能力' | '租户契约';
  label: string;
  summary: string;
  metric: string;
  owner: string;
  status: SystemAppStatus;
  statusLabel: string;
  route?: string;
  contract: string;
  iconKey: SettingsOsIconKey;
  actions: string[];
  keywords: string[];
}

export interface PipelineStep {
  label: string;
  value: string;
  tone: AppTone;
}

export type GateState = 'pass' | 'review' | 'hold';

export interface AssistantBrief {
  title: string;
  recommendation: string;
  nextStep: string;
  riskLabel: string;
  confidence: number;
}

export type AssistantModeId = 'risk-triage' | 'impact-brief' | 'release-check' | 'rollback-drill';

export interface AssistantModeBrief {
  id: AssistantModeId;
  label: string;
  description: string;
  question: string;
  recommendation: string;
  nextAction: string;
  evidence: string;
  state: GateState;
  tone: AppTone;
  blockedActions: string[];
}

export interface TopologyNode {
  label: string;
  value: string;
  detail: string;
  tone: AppTone;
}

export interface ReleaseGate {
  label: string;
  detail: string;
  state: GateState;
}

export type ReleasePipelineStepId = 'draft' | 'impact' | 'preview' | 'gate' | 'rollback';

export interface ReleasePipelineItem {
  id: ReleasePipelineStepId;
  label: string;
  statusLabel: string;
  detail: string;
  auditEvidence: string;
  backendContract: string;
  riskReason: string;
  state: GateState;
  tone: AppTone;
}

export interface SettingsReleasePreviewDiffItem {
  id: string;
  label: string;
  currentValue: string;
  draftValue: string;
  impact: string;
  evidence: string;
  state: GateState;
  tone: AppTone;
  blockedActions: string[];
}

export interface RollbackAnchor {
  title: string;
  statusLabel: string;
  detail: string;
  auditEvidence: string;
  backendContract: string;
  riskReason: string;
  state: GateState;
  tone: AppTone;
}

export type SettingsCommandKind = 'app' | 'action' | 'system';

export interface SettingsCommand {
  id: string;
  kind: SettingsCommandKind;
  appKey?: TabKey;
  systemKey?: string;
  route?: string;
  label: string;
  description: string;
  category: string;
  riskLabel: string;
  statusLabel: string;
  actionLabel: string;
  routeLabel: string;
  iconKey: SettingsOsIconKey;
  tone: AppTone;
  searchText: string;
}

export type SettingsCapabilityId =
  | 'command-center'
  | 'ai-assistant'
  | 'impact-topology'
  | 'release-preview'
  | 'rollback-anchor';

export type CapabilityContractStatus = 'ready' | 'contract';

export interface SettingsCapabilityContract {
  id: SettingsCapabilityId;
  label: string;
  surface: string;
  status: CapabilityContractStatus;
  statusLabel: string;
  dataSource: string;
  backendContract: string;
  allowedActions: string[];
  blockedActions: string[];
  safetyNotes: string[];
  evidenceText: string;
  tone: AppTone;
}

export interface SettingsCapabilityContractSummary {
  ready: number;
  contract: number;
  blocked: number;
}

export interface SettingsAppHealth {
  score: number;
  statusLabel: string;
  summary: string;
  summaryText: string;
  primaryBlocker: string;
  nextAction: string;
  readyContracts: number;
  contractContracts: number;
  blockedActions: string[];
  tone: AppTone;
  readinessLabel: string;
}

export interface SettingsAppEntryCard {
  appKey: TabKey;
  entryLabel: string;
  routeLabel: `/settings/${TabKey}`;
  primaryAction: string;
  secondaryAction: string;
  blocker: string;
  evidence: string;
  state: GateState;
  tone: AppTone;
  score: number;
  blockedActions: string[];
}

export type SettingsOperationPulseId =
  | 'human-next-step'
  | 'release-gate'
  | 'workbench-freeze'
  | 'rollback-contract';

export interface SettingsOperationPulseItem {
  id: SettingsOperationPulseId;
  label: string;
  value: string;
  detail: string;
  tone: AppTone;
  state: GateState;
  readiness: string;
  progress: number;
}

export type SettingsMotionSignalId =
  | 'human-review'
  | 'contract-blockers'
  | 'preview-ready'
  | 'protected-entry-freeze';

export interface SettingsMotionSignal {
  id: SettingsMotionSignalId;
  label: string;
  value: string;
  detail: string;
  state: GateState;
  tone: AppTone;
  progress: number;
  evidence: string;
  blockedActions: string[];
}

export type SettingsControlTowerLaneId = 'impact' | 'release' | 'rollback' | 'guardrail';

export interface SettingsControlTowerLane {
  id: SettingsControlTowerLaneId;
  label: string;
  count: number;
  progress: number;
  state: GateState;
  tone: AppTone;
  detail: string;
  evidence: string;
  blockedActions: string[];
}

export interface SettingsControlTowerAppCard {
  appKey: TabKey;
  label: string;
  phase: string;
  metric: string;
  healthScore: number;
  readinessLabel: string;
  impactEvidence: string;
  releaseGateLabel: string;
  rollbackLabel: string;
  nextAction: string;
  blockedActions: string[];
  route: `/settings/${TabKey}`;
  tone: AppTone;
  state: GateState;
}

export interface SettingsControlTower {
  lanes: SettingsControlTowerLane[];
  cards: SettingsControlTowerAppCard[];
  protectedCommandCount: number;
  protectedCommandEvidence: string;
  blockedActions: string[];
}

export type SettingsOperatorPlaybookStepId = 'prepare' | 'validate' | 'evidence' | 'guardrail';

export interface SettingsOperatorPlaybookStep {
  id: SettingsOperatorPlaybookStepId;
  label: string;
  task: string;
  detail: string;
  evidence: string;
  state: GateState;
  tone: AppTone;
  blockedActions: string[];
}

export type SettingsMissionQueueLane = 'review' | 'contract' | 'preview';

export interface SettingsMissionQueueItem {
  appKey: TabKey;
  appLabel: string;
  route: `/settings/${TabKey}`;
  lane: SettingsMissionQueueLane;
  priority: number;
  priorityLabel: string;
  action: string;
  blocker: string;
  evidence: string;
  score: number;
  state: GateState;
  tone: AppTone;
}

export const SETTING_APPS: SettingsApp[] = [
  {
    key: 'sysconfig',
    group: '核心',
    label: '系统参数',
    shortLabel: '参数',
    summary: '密集快改、缓存刷新、变更原因和发布前校验。',
    mission: '把基础参数从散列表变成可批量处理的运营面板。',
    iconKey: 'settings',
    tone: 'stable',
    signal: '可立即升级',
    phase: 'Phase 4 首期',
    metric: '缓存刷新 / 批量保存',
    inspector: ['API: /system/configs', '风险: 批量变更需审计', '动作: 保存草稿后发布'],
    actions: ['内联快改', '刷新缓存', '变更原因'],
  },
  {
    key: 'numbering',
    group: '核心',
    label: '编号规则',
    shortLabel: '编号',
    summary: '规则试算、冲突检测、样例预览和发布门禁。',
    mission: '让编号规则在发布前能被试算、解释和回滚。',
    iconKey: 'hash',
    tone: 'attention',
    signal: '需要影响预览',
    phase: 'Phase 4 首期',
    metric: '规则试算 / 冲突检测',
    inspector: ['依赖: 资产/工单编号', '风险: 规则冲突', '动作: 试算后发布'],
    actions: ['规则试算', '冲突检测', '样例预览'],
  },
  {
    key: 'sla-config',
    group: '核心',
    label: 'SLA 配置',
    shortLabel: 'SLA',
    summary: '优先级矩阵、响应时限、解决时限和预警比例。',
    mission: '把 SLA 从数字表格升级成可解释的服务承诺矩阵。',
    iconKey: 'clock',
    tone: 'attention',
    signal: 'service 已收敛 / 校验前置',
    phase: 'Phase 4 首期',
    metric: '响应 / 解决 / 预警',
    inspector: ['GET /sla-config', 'PUT /sla-config/{id}', '影响: 工单 SLA 截止与预警状态'],
    actions: ['矩阵编辑', '预警预览', '影响说明'],
  },
  {
    key: 'notif-channel',
    group: '通知',
    label: '通知渠道',
    shortLabel: '渠道',
    summary: '渠道健康、启停、测试发送、限流和降级状态。',
    mission: '让通知渠道能被测试、监控和快速停用。',
    iconKey: 'radio',
    tone: 'stable',
    signal: '可任务化',
    phase: 'Phase 4 首期',
    metric: '健康检测 / 测试发送',
    inspector: ['API: /system/channel-configs', '动作: 发送测试', '安全: Webhook 地址脱敏'],
    actions: ['测试发送', '启停渠道', '健康状态'],
  },
  {
    key: 'webhook',
    group: '集成',
    label: 'Webhook 配置',
    shortLabel: 'Webhook',
    summary: '连接测试、签名校验、事件订阅和失败重放。',
    mission: '把集成配置变成可观测、可测试、可回滚的连接台。',
    iconKey: 'webhook',
    tone: 'attention',
    signal: 'service 已收敛 / 测试待契约',
    phase: 'Phase 4 首期',
    metric: 'URL 脱敏 / 测试待契约',
    inspector: ['API: /webhook-configs', '安全: URL 与 secret 不回显', '契约: 连接测试/失败重放待后端接口'],
    actions: ['连接测试', '事件订阅', '失败重放'],
  },
  {
    key: 'mail-log',
    group: '邮件',
    label: '邮件日志',
    shortLabel: '日志',
    summary: '失败原因、批次追踪、筛选导出和重试动作。',
    mission: '让邮件失败能被定位、追踪和人工重放。',
    iconKey: 'scroll-text',
    tone: 'contract',
    signal: '重试已接入 / 批次待增强',
    phase: 'Phase 4 首期',
    metric: '失败追踪 / 重试动作',
    inspector: ['GET /mail-logs/list', 'POST /mail-logs/{id}/retry', '约束: 批次追踪/导出待增强'],
    actions: ['失败筛选', '批次追踪', '重试发送'],
  },
  {
    key: 'notif-template',
    group: '通知',
    label: '通知模板',
    shortLabel: '模板',
    summary: '模板变量、发布版本、场景预览和回滚历史。',
    mission: '让通知文本改动在发布前可预览、可审计。',
    iconKey: 'file-text',
    tone: 'contract',
    signal: '二期增强',
    phase: 'Phase 6 二期',
    metric: '变量校验 / 场景预览',
    inspector: ['API: /notification-templates', '动作: 场景预览', '风险: 变量缺失'],
    actions: ['变量校验', '场景预览', '版本记录'],
  },
  {
    key: 'notif-switch',
    group: '通知',
    label: '流程通知开关',
    shortLabel: '开关',
    summary: '按业务事件启停通知，当前契约已对齐为事件矩阵。',
    mission: '把通知开关变成带影响说明、行级更新和可筛选的事件矩阵。',
    iconKey: 'toggle-left',
    tone: 'stable',
    signal: '契约已对齐',
    phase: 'Phase 4 Ready',
    metric: '事件矩阵 / 行级更新',
    inspector: ['API: GET /notification-switches/list', '动作: PUT /notification-switches/{id}?enabled=', '影响: 只更新通知触达开关，不发布流程'],
    actions: ['事件筛选', '行级启停', '影响说明'],
  },
  {
    key: 'notif-pref',
    group: '通知',
    label: '通知偏好',
    shortLabel: '偏好',
    summary: '用户偏好与后台策略边界需要重新归位。',
    mission: '明确个人偏好和后台策略的权限边界。',
    iconKey: 'bell',
    tone: 'contract',
    signal: '信息架构待定',
    phase: 'Phase 6 二期',
    metric: '个人偏好 / 后台策略',
    inspector: ['API: /notification-preferences', '风险: 用户域与后台域混杂', '动作: IA 再定位'],
    actions: ['边界归位', '批量策略', '权限校验'],
  },
  {
    key: 'mail-template',
    group: '邮件',
    label: '邮件模板',
    shortLabel: '邮件',
    summary: '模板版本、变量校验、测试发送和审计记录。',
    mission: '让邮件模板的变更能先预览再发布。',
    iconKey: 'mail',
    tone: 'contract',
    signal: '二期增强',
    phase: 'Phase 6 二期',
    metric: '模板变量 / 测试发送',
    inspector: ['API: /mail-templates', '动作: 测试发送', '风险: 变量缺失'],
    actions: ['变量校验', '测试发送', '版本记录'],
  },
];

export const SYSTEM_APPS: SystemApp[] = [
  {
    key: 'system-users',
    group: '账号权限',
    label: '用户管理',
    summary: '后台账号、状态、组织归属和角色分配入口。',
    metric: '账号生命周期',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/users',
    contract: '真实路由: /system/users',
    iconKey: 'users',
    actions: ['维护账号', '分配角色', '调整状态'],
    keywords: ['user', 'account', '用户', '账号', '权限'],
  },
  {
    key: 'system-roles',
    group: '账号权限',
    label: '角色管理',
    summary: '角色授权、数据范围和后台能力边界配置。',
    metric: '角色权限矩阵',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/roles',
    contract: '真实路由: /system/roles',
    iconKey: 'user-cog',
    actions: ['维护角色', '授权菜单', '限定数据范围'],
    keywords: ['role', '角色', '授权', '权限'],
  },
  {
    key: 'system-menus',
    group: '账号权限',
    label: '菜单权限',
    summary: '后台菜单、按钮权限和导航可见性控制。',
    metric: '菜单与按钮授权',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/menus',
    contract: '真实路由: /system/menus',
    iconKey: 'menu-square',
    actions: ['维护菜单', '配置按钮', '同步导航'],
    keywords: ['menu', '菜单', '按钮', '导航', 'permission'],
  },
  {
    key: 'system-depts',
    group: '组织结构',
    label: '部门管理',
    summary: '组织树、部门负责人和可用状态维护。',
    metric: '组织层级',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/depts',
    contract: '真实路由: /system/depts',
    iconKey: 'building',
    actions: ['维护组织树', '设置负责人', '调整状态'],
    keywords: ['dept', 'department', '部门', '组织'],
  },
  {
    key: 'system-posts',
    group: '组织结构',
    label: '岗位管理',
    summary: '岗位编码、岗位状态和组织内职责定位。',
    metric: '岗位字典',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/posts',
    contract: '真实路由: /system/posts',
    iconKey: 'briefcase',
    actions: ['维护岗位', '配置编码', '启停岗位'],
    keywords: ['post', 'position', '岗位', '职位'],
  },
  {
    key: 'system-custom-fields',
    group: '后台能力',
    label: '自定义字段',
    summary: '字段类型、校验规则和后台扩展字段定义。',
    metric: '字段模型',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/custom-fields',
    contract: '真实路由: /system/custom-fields',
    iconKey: 'type',
    actions: ['定义字段', '配置校验', '调整状态'],
    keywords: ['custom field', 'field', '自定义字段', '字段'],
  },
  {
    key: 'system-custom-fieldsets',
    group: '后台能力',
    label: '自定义字段集',
    summary: '字段分组、展示顺序和业务表单扩展集合。',
    metric: '字段集编排',
    owner: '系统管理',
    status: 'ready',
    statusLabel: '已挂载',
    route: '/system/custom-fieldsets',
    contract: '真实路由: /system/custom-fieldsets',
    iconKey: 'package-check',
    actions: ['编排字段集', '调整排序', '发布扩展'],
    keywords: ['custom fieldset', 'fieldset', '自定义字段集', '字段集'],
  },
  {
    key: 'system-tenants',
    group: '租户契约',
    label: '租户管理',
    summary: '已有页面与 API 能力，但当前 router 尚未挂载页面入口。',
    metric: '待路由契约',
    owner: '平台管理',
    status: 'contract',
    statusLabel: '待挂载',
    contract: '待路由契约: 缺少 /system/tenants 或 /tenants 页面路由',
    iconKey: 'landmark',
    actions: ['确认路由契约', '评审菜单权限', '等待挂载'],
    keywords: ['tenant', 'tenants', '租户', '多租户', '待挂载'],
  },
];

export const PIPELINE_STEPS: PipelineStep[] = [
  { label: '草稿', value: '可保存原因', tone: 'stable' },
  { label: '校验', value: 'impact 前置', tone: 'attention' },
  { label: '预览', value: '影响说明', tone: 'contract' },
  { label: '发布', value: '审计记录', tone: 'stable' },
  { label: '回滚', value: '高风险必备', tone: 'attention' },
];

export const ALL_TAB_KEYS: TabKey[] = SETTING_APPS.map(app => app.key);

function getCommandRiskLabel(app: SettingsApp): string {
  if (app.tone === 'stable') return '低风险';
  if (app.tone === 'attention') return '需影响预览';
  return '契约待确认';
}

function createSettingsCommand(app: SettingsApp, kind: SettingsCommandKind, action?: string): SettingsCommand {
  const route = `/settings/${app.key}`;
  const label = kind === 'app' ? app.label : `${action} · ${app.label}`;
  const description = kind === 'app'
    ? app.summary
    : `${app.label} 的快捷动作：${action}。定位到该设置页后在任务区继续处理。`;
  const category = kind === 'app' ? `${app.group} / 设置项` : `${app.group} / 快捷动作`;
  const statusLabel = `${app.phase} · ${app.signal}`;
  const actionLabel = kind === 'app' ? '打开设置' : action ?? '定位动作';
  const searchText = [
    label,
    description,
    category,
    app.shortLabel,
    app.mission,
    app.metric,
    app.signal,
    app.phase,
    ...app.actions,
    ...app.inspector,
  ].join(' ').toLowerCase();

  return {
    id: kind === 'app' ? `app:${app.key}` : `action:${app.key}:${action}`,
    kind,
    appKey: app.key,
    route,
    label,
    description,
    category,
    riskLabel: getCommandRiskLabel(app),
    statusLabel,
    actionLabel,
    routeLabel: route,
    iconKey: app.iconKey,
    tone: app.tone,
    searchText,
  };
}

function createSystemCommand(app: SystemApp): SettingsCommand {
  const tone: AppTone = app.status === 'ready' ? 'stable' : 'contract';
  const routeLabel = app.route ?? '待路由契约 / 待挂载';
  const searchText = [
    app.label,
    app.summary,
    app.group,
    app.metric,
    app.owner,
    app.statusLabel,
    app.contract,
    routeLabel,
    ...app.actions,
    ...app.keywords,
  ].join(' ').toLowerCase();

  return {
    id: `system:${app.key}`,
    kind: 'system',
    systemKey: app.key,
    route: app.route,
    label: app.label,
    description: app.summary,
    category: `${app.group} / 系统管理`,
    riskLabel: app.status === 'ready' ? '真实路由' : '待契约',
    statusLabel: `${app.statusLabel} · ${app.metric}`,
    actionLabel: app.status === 'ready' ? '打开系统应用' : '不可执行',
    routeLabel,
    iconKey: app.iconKey,
    tone,
    searchText,
  };
}

export function buildSettingsCommands(systemApps: SystemApp[] = SYSTEM_APPS): SettingsCommand[] {
  const settingsCommands = SETTING_APPS.flatMap(app => [
    createSettingsCommand(app, 'app'),
    ...app.actions.map(action => createSettingsCommand(app, 'action', action)),
  ]);

  return [
    ...settingsCommands,
    ...systemApps.map(createSystemCommand),
  ];
}

export function filterSettingsCommands(commands: SettingsCommand[], query: string): SettingsCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;

  return commands
    .map((command, index) => ({
      command,
      index,
      score: getSettingsCommandMatchScore(command, normalized),
    }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(item => item.command);
}

function getSettingsCommandMatchScore(command: SettingsCommand, normalized: string): number {
  const strongScore = Math.max(
    getStrongFieldMatchScore(command.label, normalized),
    getStrongFieldMatchScore(command.routeLabel, normalized),
    getStrongFieldMatchScore(command.actionLabel, normalized),
    getStrongFieldMatchScore(command.category, normalized),
  );

  if (strongScore > 0) return strongScore;
  return command.searchText.includes(normalized) ? 1 : 0;
}

function getStrongFieldMatchScore(value: string, normalized: string): number {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === normalized) return 100;
  if (normalizedValue.startsWith(normalized)) return 80;
  if (normalizedValue.includes(normalized)) return 60;
  return 0;
}

export function matchesSettingApp(app: SettingsApp, normalized: string): boolean {
  const searchable = [
    app.label,
    app.shortLabel,
    app.group,
    app.summary,
    app.mission,
    app.signal,
    app.phase,
    app.metric,
    ...app.actions,
    ...app.inspector,
  ].join(' ').toLowerCase();

  return searchable.includes(normalized);
}

export function matchesSystemApp(app: SystemApp, normalized: string): boolean {
  const searchable = [
    app.label,
    app.group,
    app.summary,
    app.metric,
    app.owner,
    app.statusLabel,
    app.contract,
    app.route ?? '',
    ...app.actions,
    ...app.keywords,
  ].join(' ').toLowerCase();

  return searchable.includes(normalized);
}

export function getValidTab(tab?: string): TabKey {
  return tab && ALL_TAB_KEYS.includes(tab as TabKey) ? (tab as TabKey) : 'sysconfig';
}

export function getAppTab(app: SettingsApp): TabKey {
  return app.key;
}

function getInspectorField(app: SettingsApp, prefixes: string[], fallback: string): string {
  const match = app.inspector.find(item => prefixes.some(prefix => item.startsWith(prefix)));
  if (!match) return fallback;

  const [, value] = match.split(/[:：]/);
  return value?.trim() || match;
}

export function getAssistantBrief(app: SettingsApp): AssistantBrief {
  const risk = getInspectorField(app, ['风险', '安全', '契约', '当前'], app.signal);

  if (app.tone === 'stable') {
    return {
      title: '可进入受控预览',
      recommendation: `优先执行「${app.actions[0]}」，同步保留${app.metric}的操作证据。`,
      nextStep: `下一步：完成${app.actions[1] ?? '发布预览'}后进入审计发布。`,
      riskLabel: `低风险 / ${risk}`,
      confidence: 88,
    };
  }

  if (app.tone === 'attention') {
    return {
      title: '先跑影响预览',
      recommendation: `先处理「${app.actions[1] ?? app.actions[0]}」，再允许发布预览进入下一环。`,
      nextStep: `下一步：补齐${app.metric}的影响说明和回滚路径。`,
      riskLabel: `中风险 / ${risk}`,
      confidence: 74,
    };
  }

  return {
    title: '先锁定契约边界',
    recommendation: `把「${app.actions[0]}」作为草稿动作，发布前确认接口、变量或权限边界。`,
    nextStep: `下一步：确认${app.metric}的后端契约与审计字段。`,
    riskLabel: `契约待定 / ${risk}`,
    confidence: 63,
  };
}

const ASSISTANT_LOCAL_BLOCKED_ACTIONS = [
  '禁止自动改配置',
  '禁止自动发布',
  '禁止外发 secret 或配置敏感值',
  '禁止写 storage',
  '禁止请求网络',
];

const PUBLISH_SUCCESS_PATTERN = new RegExp('发布' + '成功', 'g');
const ROLLBACK_SUCCESS_PATTERN = new RegExp('回滚' + '成功', 'g');

function uniqueBlockedActions(actions: string[]): string[] {
  return Array.from(new Set(actions));
}

function sanitizeAssistantModeText(value: string): string {
  return value
    .replace(PUBLISH_SUCCESS_PATTERN, '发布完成')
    .replace(ROLLBACK_SUCCESS_PATTERN, '回滚完成');
}

function sanitizeAssistantModeBrief(mode: AssistantModeBrief): AssistantModeBrief {
  return {
    ...mode,
    question: sanitizeAssistantModeText(mode.question),
    recommendation: sanitizeAssistantModeText(mode.recommendation),
    nextAction: sanitizeAssistantModeText(mode.nextAction),
    evidence: sanitizeAssistantModeText(mode.evidence),
    blockedActions: mode.blockedActions.map(sanitizeAssistantModeText),
  };
}

export function getAssistantModeBriefs(app: SettingsApp): AssistantModeBrief[] {
  const assistant = getAssistantBrief(app);
  const topology = getImpactTopology(app);
  const releaseReadiness = getReleaseReadiness(app);
  const releaseGates = getReleaseGates(app);
  const releasePipeline = getReleasePipeline(app);
  const rollbackAnchor = getRollbackAnchor(app);
  const contracts = getSettingsCapabilityContracts(app);
  const aiContract = contracts.find(contract => contract.id === 'ai-assistant');
  const impactStep = releasePipeline.find(step => step.id === 'impact') ?? releasePipeline[0];
  const releaseGateStep = releasePipeline.find(step => step.id === 'gate') ?? releasePipeline[0];
  const rollbackStep = releasePipeline.find(step => step.id === 'rollback') ?? releasePipeline[releasePipeline.length - 1];
  const previewGate = releaseGates.find(gate => gate.label === '预览确认') ?? releaseGates[0];
  const auditGate = releaseGates.find(gate => gate.label === '审计与原因') ?? releaseGates[0];
  const frozenGate = releaseGates.find(gate => gate.label === '业务前台确认') ?? releaseGates[releaseGates.length - 1];
  const blockedActions = uniqueBlockedActions([
    ...ASSISTANT_LOCAL_BLOCKED_ACTIONS,
    ...(aiContract?.blockedActions ?? []),
    '禁止写回业务前台正式入口',
  ]);
  const topologyEvidence = topology
    .map(node => `${node.label}:${node.value}`)
    .join(' / ');
  const releaseHoldText = app.tone === 'contract'
    ? '保持 hold，不进入真实发布；先补齐发布、审计和版本化接口契约。'
    : `进入${releaseReadiness.label}的本地预览，只生成复核清单，不调用发布接口。`;

  return [
    {
      id: 'risk-triage',
      label: '风险分诊',
      description: '先判断当前设置能否进入人工处理队列。',
      question: `现在能否处理「${app.label}」？`,
      recommendation: assistant.recommendation,
      nextAction: assistant.nextStep,
      evidence: `${assistant.riskLabel} / ${app.signal} / ${app.metric}`,
      state: releaseReadiness.state,
      tone: assistant.confidence >= 80 ? app.tone : releaseReadiness.tone,
      blockedActions,
    },
    {
      id: 'impact-brief',
      label: '影响说明',
      description: '把上游、当前设置和下游影响整理成发布前说明。',
      question: `这次「${app.actions[0]}」会影响哪里？`,
      recommendation: `先复核影响链：${topologyEvidence}。`,
      nextAction: `下一步：把「${impactStep.label}」作为人工校验项，补齐${app.metric}证据。`,
      evidence: impactStep.auditEvidence,
      state: app.tone === 'contract' ? 'hold' : impactStep.state,
      tone: app.tone === 'contract' ? 'contract' : impactStep.tone,
      blockedActions,
    },
    {
      id: 'release-check',
      label: '发布检查',
      description: '检查发布前是否具备草稿、预览、审计和冻结入口护栏。',
      question: `「${app.label}」是否可以进入发布门禁？`,
      recommendation: releaseHoldText,
      nextAction: `下一步：确认${previewGate.label}、${auditGate.label}和${frozenGate.label}。`,
      evidence: `${releaseGateStep.auditEvidence} / ${releaseGateStep.backendContract}`,
      state: releaseReadiness.state,
      tone: releaseReadiness.tone,
      blockedActions: uniqueBlockedActions([
        ...blockedActions,
        '禁止真实发布',
        '禁止声明发布完成',
      ]),
    },
    {
      id: 'rollback-drill',
      label: '回滚演练',
      description: '用回滚锚点检查是否能人工恢复，不伪造版本号或审计流水。',
      question: `如果「${app.label}」变更失败，如何回退？`,
      recommendation: rollbackAnchor.detail,
      nextAction: `下一步：按「${rollbackStep.label}」记录回退依据，等待后端版本契约接入。`,
      evidence: `${rollbackAnchor.auditEvidence} / ${rollbackAnchor.backendContract}`,
      state: rollbackAnchor.state,
      tone: rollbackAnchor.tone,
      blockedActions: uniqueBlockedActions([
        ...blockedActions,
        '禁止伪造版本号',
        '禁止伪造审计流水',
        '禁止声明回滚完成',
      ]),
    },
  ].map(sanitizeAssistantModeBrief);
}

export function getImpactTopology(app: SettingsApp): TopologyNode[] {
  const upstream = getInspectorField(app, ['依赖', 'API', '当前', '前端旧路径'], app.group);
  const downstream = getInspectorField(app, ['动作', '目标', '后端路径', '安全'], app.actions[0]);

  return [
    {
      label: '上游输入',
      value: upstream,
      detail: `${app.group}域进入${app.phase}`,
      tone: app.tone === 'stable' ? 'stable' : 'attention',
    },
    {
      label: '当前设置',
      value: app.label,
      detail: app.metric,
      tone: app.tone,
    },
    {
      label: '下游影响',
      value: downstream,
      detail: app.summary,
      tone: app.tone === 'contract' ? 'contract' : 'stable',
    },
  ];
}

export function getReleaseGates(app: SettingsApp): ReleaseGate[] {
  const requiresReview = app.tone === 'attention';
  const requiresContract = app.tone === 'contract';

  return [
    {
      label: 'impact 分析',
      detail: requiresReview
        ? `发布前必须证明「${app.metric}」不会破坏关联流程。`
        : `记录${app.label}的变更影响，避免绕过风险面。`,
      state: requiresReview ? 'review' : 'pass',
    },
    {
      label: '预览确认',
      detail: `用「${app.actions[0]}」生成预览，不直接写回业务前台入口。`,
      state: requiresContract ? 'hold' : 'review',
    },
    {
      label: '审计与原因',
      detail: `保存变更原因、操作者和${app.metric}的发布证据。`,
      state: 'review',
    },
    {
      label: '回滚路径',
      detail: requiresReview
        ? '高风险设置发布前必须给出可回退版本或停用策略。'
        : '保留最近一次稳定版本，支持人工恢复。',
      state: requiresReview ? 'review' : 'pass',
    },
    {
      label: '业务前台确认',
      detail: '/fixed-assets/workbench?menu=home 保持冻结，只允许预览确认后另行挂回。',
      state: 'hold',
    },
  ];
}

export function getReleaseReadiness(app: SettingsApp): {
  label: string;
  detail: string;
  state: GateState;
  tone: AppTone;
} {
  if (app.tone === 'contract') {
    return {
      label: '待契约 / 不可发布',
      detail: '后端契约待补齐，仅允许整理草稿、查看风险和等待契约确认。',
      state: 'hold',
      tone: 'contract',
    };
  }

  if (app.tone === 'attention') {
    return {
      label: '需影响预览',
      detail: '必须先完成影响校验和预览确认，发布门禁保持人工复核。',
      state: 'review',
      tone: 'attention',
    };
  }

  return {
    label: '可预览',
    detail: '可进入本地发布预览，但不会触发后端发布或业务前台写入。',
    state: 'pass',
    tone: 'stable',
  };
}

export function getSettingsCapabilityContracts(app: SettingsApp): SettingsCapabilityContract[] {
  const readiness = getReleaseReadiness(app);
  const rollbackAnchor = getRollbackAnchor(app);
  const contractStatus: CapabilityContractStatus = app.tone === 'contract' ? 'contract' : 'ready';
  const impactSource = `app.inspector(${app.inspector.length}) + app.metric`;
  const releaseStatus: CapabilityContractStatus = app.tone === 'contract' ? 'contract' : 'ready';
  const releaseStatusLabel = app.tone === 'contract' ? '待契约 / hold' : `${readiness.label} / 本地预览`;
  const rollbackStatus: CapabilityContractStatus = app.tone === 'stable' ? 'ready' : 'contract';

  return [
    {
      id: 'command-center',
      label: '全局命令中心',
      surface: 'SettingsCommandPalette / CommandResultButton',
      status: 'ready',
      statusLabel: '已绑定真实设置路由',
      dataSource: 'SETTING_APPS + SYSTEM_APPS + buildSettingsCommands',
      backendContract: '仅打开已挂载 route；待契约系统应用保留不可执行状态。',
      allowedActions: ['打开 /settings/:tab', '打开 SYSTEM_APPS 中 status=ready 的真实路由', '定位当前设置动作'],
      blockedActions: ['禁止跳转待契约入口', '禁止生成冻结入口正式 command'],
      safetyNotes: ['命令只消费 registry 数据，不新增强跳或网络调用。'],
      evidenceText: `命令证据：${app.key} -> /settings/${app.key}；system-tenants 无 route 时不可执行。`,
      tone: app.tone === 'contract' ? 'attention' : app.tone,
    },
    {
      id: 'ai-assistant',
      label: 'AI 配置助手',
      surface: 'SettingsInspector / AI 配置助手',
      status: 'ready',
      statusLabel: '本地场景建议器',
      dataSource: 'getAssistantBrief(app) + getAssistantModeBriefs(app) + app.actions + app.inspector',
      backendContract: '无 AI 后端契约；仅把本地 registry 风险解释为场景建议和人工清单。',
      allowedActions: ['解释风险标签', '切换风险/影响/发布/回滚场景', '生成组件内本地清单提示'],
      blockedActions: ['禁止自动改配置', '禁止自动发布', '禁止外发 secret 或配置敏感值'],
      safetyNotes: ['助手不保存、不发布、不外发；场景切换和清单只更新组件内状态。'],
      evidenceText: `建议证据：${app.actions[0]} / ${app.metric} / ${app.signal}`,
      tone: app.tone,
    },
    {
      id: 'impact-topology',
      label: '影响拓扑',
      surface: 'SettingsInspector / 动态影响拓扑',
      status: contractStatus,
      statusLabel: app.tone === 'contract' ? '待后端契约补齐' : '已绑定本地影响数据',
      dataSource: impactSource,
      backendContract: app.tone === 'contract'
        ? '仅展示待契约影响线索，不标记真实拓扑完成态。'
        : '复用当前 inspector/API/风险字段；后端拓扑契约接入前不写入发布状态。',
      allowedActions: ['展示上游输入', '展示当前设置', '展示下游影响'],
      blockedActions: ['禁止伪造真实依赖图完成态', '禁止把待契约 app 标记为已发布拓扑'],
      safetyNotes: [`${app.label} 的拓扑由 inspector 与 metric 派生，contract tone 只显示待补证据。`],
      evidenceText: `影响证据：${app.inspector.join(' / ')}`,
      tone: app.tone,
    },
    {
      id: 'release-preview',
      label: '发布预览',
      surface: 'ReleasePipelineWorkbench / SettingsInspector 发布门禁',
      status: releaseStatus,
      statusLabel: releaseStatusLabel,
      dataSource: 'getReleaseReadiness(app) + getReleasePipeline(app)',
      backendContract: app.tone === 'contract'
        ? 'contract/hold：缺少发布、审计或版本化接口确认，不允许发布。'
        : '本地预览态；当前页面不调用发布接口，等待后端发布契约接入。',
      allowedActions: app.tone === 'contract'
        ? ['整理草稿', '查看风险原因', '等待契约确认']
        : ['生成本地预览', '展示发布门禁', '记录人工复核要求'],
      blockedActions: ['禁止真实发布', '禁止写回业务前台正式入口', '禁止声明发布完成'],
      safetyNotes: [readiness.detail],
      evidenceText: `发布证据：${readiness.label} / ${readiness.state} / ${app.metric}`,
      tone: readiness.tone,
    },
    {
      id: 'rollback-anchor',
      label: '回滚锚点',
      surface: 'ReleasePipelineWorkbench / 回滚阶段',
      status: rollbackStatus,
      statusLabel: rollbackAnchor.statusLabel,
      dataSource: 'getRollbackAnchor(app) + app.phase + app.metric',
      backendContract: rollbackAnchor.backendContract,
      allowedActions: app.tone === 'stable'
        ? ['展示本地预览锚点', '提示后端版本契约待接入']
        : ['展示影响预览要求', '保留待契约原因'],
      blockedActions: ['禁止伪造版本号', '禁止伪造审计流水', '禁止伪造回滚完成'],
      safetyNotes: [rollbackAnchor.riskReason],
      evidenceText: rollbackAnchor.auditEvidence,
      tone: rollbackAnchor.tone,
    },
  ];
}

export function getCapabilityContractSummary(app: SettingsApp): SettingsCapabilityContractSummary {
  const contracts = getSettingsCapabilityContracts(app);

  return {
    ready: contracts.filter(contract => contract.status === 'ready').length,
    contract: contracts.filter(contract => contract.status === 'contract').length,
    blocked: contracts.filter(contract => contract.blockedActions.length > 0).length,
  };
}

export function getSettingsAppHealth(app: SettingsApp): SettingsAppHealth {
  const readiness = getReleaseReadiness(app);
  const contracts = getSettingsCapabilityContracts(app);
  const capabilitySummary = getCapabilityContractSummary(app);
  const contractBlocker = contracts.find(contract => contract.status === 'contract');
  const blockedActions = Array.from(new Set(contracts.flatMap(contract => contract.blockedActions)));
  const baseScore = readiness.state === 'pass' ? 84 : readiness.state === 'review' ? 68 : 48;
  const score = Math.max(
    0,
    Math.min(
      100,
      baseScore + capabilitySummary.ready * 2 - capabilitySummary.contract * 8 - Math.min(blockedActions.length, 10),
    ),
  );
  const statusLabel = app.tone === 'stable'
    ? '运营健康'
    : app.tone === 'attention'
      ? '需要关注'
      : '契约前置';
  const primaryBlocker = contractBlocker
    ? `待补契约：${contractBlocker.label} / ${contractBlocker.statusLabel}`
    : app.tone === 'attention'
      ? `需先完成：${readiness.label}`
      : '无主要阻断，继续保留发布与回滚证据。';
  const nextAction = contractBlocker
    ? `先确认「${contractBlocker.label}」契约，再推进${app.actions[0]}。`
    : app.tone === 'attention'
      ? `先完成「${app.actions[1] ?? app.actions[0]}」并补齐影响说明。`
      : `优先执行「${app.actions[0]}」，同步保留${app.metric}证据。`;
  const summary = `${app.label}：${capabilitySummary.ready}/${contracts.length} 能力就绪，${readiness.label}。`;

  return {
    score,
    statusLabel,
    summary,
    summaryText: summary,
    primaryBlocker,
    nextAction,
    readyContracts: capabilitySummary.ready,
    contractContracts: capabilitySummary.contract,
    blockedActions,
    tone: app.tone,
    readinessLabel: readiness.label,
  };
}

const ENTRY_CARD_BASE_BLOCKED_ACTIONS = [
  '禁止真实发布',
  '禁止写回业务前台正式入口',
  '禁止请求网络',
  '禁止写 storage',
];

function getEntryCardLabel(state: GateState): string {
  if (state === 'pass') return '可预览入口';
  if (state === 'review') return '人工复核入口';
  return '契约 hold 入口';
}

function sanitizeEntryCardText(value: string): string {
  return value
    .replace(PUBLISH_SUCCESS_PATTERN, '发布完成')
    .replace(ROLLBACK_SUCCESS_PATTERN, '回滚完成');
}

function uniqueEntryCardBlockedActions(actions: string[]): string[] {
  return Array.from(new Set(actions.map(sanitizeEntryCardText)));
}

export function getSettingsAppEntryCard(app: SettingsApp): SettingsAppEntryCard {
  const health = getSettingsAppHealth(app);
  const readiness = getReleaseReadiness(app);
  const contracts = getSettingsCapabilityContracts(app);
  const releasePipeline = getReleasePipeline(app);
  const releaseGate = releasePipeline.find(step => step.id === 'gate') ?? releasePipeline[0];
  const impactStep = releasePipeline.find(step => step.id === 'impact') ?? releasePipeline[0];
  const contractBlocker = contracts.find(contract => contract.status === 'contract');
  const blockedActions = uniqueEntryCardBlockedActions([
    ...ENTRY_CARD_BASE_BLOCKED_ACTIONS,
    ...health.blockedActions,
    ...(contractBlocker?.blockedActions ?? []),
  ]);
  const routeLabel = `/settings/${app.key}` as `/settings/${TabKey}`;

  if (readiness.state === 'hold') {
    return {
      appKey: app.key,
      entryLabel: getEntryCardLabel(readiness.state),
      routeLabel,
      primaryAction: `整理「${app.actions[0]}」人工任务`,
      secondaryAction: `等待${contractBlocker?.label ?? app.metric}契约确认`,
      blocker: health.primaryBlocker,
      evidence: `${health.summaryText} 门禁：不允许发布；${releaseGate.backendContract}`,
      state: 'hold',
      tone: 'contract',
      score: clampProgress(health.score),
      blockedActions: uniqueEntryCardBlockedActions([
        ...blockedActions,
        '禁止声明发布完成',
        '禁止声明回滚完成',
      ]),
    };
  }

  if (readiness.state === 'review') {
    return {
      appKey: app.key,
      entryLabel: getEntryCardLabel(readiness.state),
      routeLabel,
      primaryAction: health.nextAction,
      secondaryAction: `复核「${impactStep.label}」后再看发布门禁`,
      blocker: health.primaryBlocker,
      evidence: `${health.summaryText} 证据：${impactStep.auditEvidence}`,
      state: 'review',
      tone: 'attention',
      score: clampProgress(health.score),
      blockedActions,
    };
  }

  return {
    appKey: app.key,
    entryLabel: getEntryCardLabel(readiness.state),
    routeLabel,
    primaryAction: health.nextAction,
    secondaryAction: `打开${routeLabel}进入本地预览`,
    blocker: health.primaryBlocker,
    evidence: `${health.summaryText} 证据：${readiness.detail}`,
    state: 'pass',
    tone: 'stable',
    score: clampProgress(health.score),
    blockedActions,
  };
}

function getMissionQueueLane(state: GateState): SettingsMissionQueueLane {
  if (state === 'review') return 'review';
  if (state === 'hold') return 'contract';
  return 'preview';
}

function getMissionQueuePriorityLabel(lane: SettingsMissionQueueLane): string {
  if (lane === 'review') return 'P1 人工复核';
  if (lane === 'contract') return 'P2 契约冻结';
  return 'P3 可预览';
}

function getMissionQueuePriority(lane: SettingsMissionQueueLane): number {
  if (lane === 'review') return 1;
  if (lane === 'contract') return 2;
  return 3;
}

export function getSettingsMissionQueue(apps: SettingsApp[] = SETTING_APPS): SettingsMissionQueueItem[] {
  return apps
    .map(app => {
      const health = getSettingsAppHealth(app);
      const readiness = getReleaseReadiness(app);
      const lane = getMissionQueueLane(readiness.state);

      return {
        appKey: app.key,
        appLabel: app.label,
        route: `/settings/${app.key}` as `/settings/${TabKey}`,
        lane,
        priority: getMissionQueuePriority(lane),
        priorityLabel: getMissionQueuePriorityLabel(lane),
        action: health.nextAction,
        blocker: health.primaryBlocker,
        evidence: `${health.summaryText} 证据：${readiness.detail}`,
        score: clampProgress(health.score),
        state: readiness.state,
        tone: health.tone,
      };
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      if (left.score !== right.score) return left.score - right.score;
      return left.appLabel.localeCompare(right.appLabel, 'zh-Hans-CN');
    });
}

const MOTION_SIGNAL_BASE_BLOCKED_ACTIONS = [
  '禁止真实发布',
  '禁止写回业务前台正式入口',
  '禁止请求网络',
  '禁止写 storage',
];

function getMotionSignalProgress(count: number, total: number): number {
  if (total <= 0) return 0;
  return clampProgress((count / total) * 100);
}

function getMotionSignalAppLabels(items: SettingsMissionQueueItem[]): string {
  if (items.length === 0) return '无';
  return items.slice(0, 3).map(item => item.appLabel).join(' / ');
}

function getMotionSignalBlockedActions(extraActions: string[] = []): string[] {
  return Array.from(new Set([
    ...MOTION_SIGNAL_BASE_BLOCKED_ACTIONS,
    ...extraActions,
  ]));
}

export function getSettingsMotionSignals(apps: SettingsApp[] = SETTING_APPS): SettingsMotionSignal[] {
  const queue = getSettingsMissionQueue(apps);
  const total = queue.length;
  const reviewItems = queue.filter(item => item.lane === 'review');
  const contractItems = queue.filter(item => item.lane === 'contract');
  const previewItems = queue.filter(item => item.lane === 'preview');
  const appHealth = apps.map(app => getSettingsAppHealth(app));
  const readinessList = apps.map(app => getReleaseReadiness(app));
  const commandRoutes = buildSettingsCommands(SYSTEM_APPS).map(command => command.route).filter(Boolean);
  const frozenCommandCount = commandRoutes.filter(route => (
    route === '/dashboard' || route === '/fixed-assets/workbench?menu=home'
  )).length;
  const settingsRouteCount = queue.filter(item => item.route.startsWith('/settings/')).length;
  const averageHealth = total === 0
    ? 0
    : clampProgress(appHealth.reduce((sum, health) => sum + health.score, 0) / total);

  return [
    {
      id: 'human-review',
      label: '人工复核雷达',
      value: `${reviewItems.length} 项待复核`,
      detail: reviewItems.length > 0
        ? `优先复核：${getMotionSignalAppLabels(reviewItems)}。`
        : '当前没有人工复核队列，继续保留发布门禁。',
      state: reviewItems.length > 0 ? 'review' : 'pass',
      tone: reviewItems.length > 0 ? 'attention' : 'stable',
      progress: getMotionSignalProgress(reviewItems.length, total),
      evidence: `missionQueue.review=${reviewItems.length}; readiness.review=${
        readinessList.filter(readiness => readiness.state === 'review').length
      }; averageHealth=${averageHealth}`,
      blockedActions: getMotionSignalBlockedActions(['禁止绕过人工复核']),
    },
    {
      id: 'contract-blockers',
      label: '契约阻断波束',
      value: `${contractItems.length} 项契约 hold`,
      detail: contractItems.length > 0
        ? `契约阻断：${getMotionSignalAppLabels(contractItems)}。`
        : '当前没有契约 hold 阻断。',
      state: contractItems.length > 0 ? 'hold' : 'pass',
      tone: contractItems.length > 0 ? 'contract' : 'stable',
      progress: getMotionSignalProgress(contractItems.length, total),
      evidence: `missionQueue.contract=${contractItems.length}; readiness.hold=${
        readinessList.filter(readiness => readiness.state === 'hold').length
      }; contractHealth=${appHealth.filter(health => health.tone === 'contract').length}`,
      blockedActions: getMotionSignalBlockedActions(['禁止把契约 hold 标记为可发布']),
    },
    {
      id: 'preview-ready',
      label: '可预览航道',
      value: `${previewItems.length} 项可预览`,
      detail: previewItems.length > 0
        ? `本地预览：${getMotionSignalAppLabels(previewItems)}。`
        : '没有可预览应用，先处理复核或契约阻断。',
      state: previewItems.length > 0 ? 'pass' : 'review',
      tone: previewItems.length > 0 ? 'stable' : 'attention',
      progress: getMotionSignalProgress(previewItems.length, total),
      evidence: `missionQueue.preview=${previewItems.length}; readiness.pass=${
        readinessList.filter(readiness => readiness.state === 'pass').length
      }; settingsRoutes=${settingsRouteCount}/${total}`,
      blockedActions: getMotionSignalBlockedActions(['禁止把本地预览声明为真实发布']),
    },
    {
      id: 'protected-entry-freeze',
      label: '保护入口冻结',
      value: `${frozenCommandCount} 个冻结入口 command`,
      detail: frozenCommandCount === 0
        ? '保护入口只作为冻结说明，命令中心不生成正式跳转。'
        : '发现冻结入口 command，需要先移除正式跳转。',
      state: frozenCommandCount === 0 ? 'hold' : 'review',
      tone: frozenCommandCount === 0 ? 'contract' : 'attention',
      progress: frozenCommandCount === 0 ? 100 : 0,
      evidence: `frozenCommandRoutes=${frozenCommandCount}; missionQueue.settingsRoutes=${settingsRouteCount}/${total}`,
      blockedActions: getMotionSignalBlockedActions([
        '禁止生成冻结入口正式 command',
        '禁止跳转受保护入口',
      ]),
    },
  ];
}

const CONTROL_TOWER_BASE_BLOCKED_ACTIONS = [
  '禁止真实发布',
  '禁止写回业务前台正式入口',
  '禁止生成冻结入口正式 command',
  '禁止跳转受保护入口',
  '禁止请求网络',
  '禁止写 storage',
];

function sanitizeControlTowerText(value: string): string {
  return value
    .replace(PUBLISH_SUCCESS_PATTERN, '发布完成')
    .replace(ROLLBACK_SUCCESS_PATTERN, '回滚完成');
}

function uniqueControlTowerBlockedActions(actions: string[]): string[] {
  return Array.from(new Set(actions.map(sanitizeControlTowerText)));
}

function getControlTowerState(count: number, total: number): GateState {
  if (total <= 0) return 'hold';
  if (count === 0) return 'hold';
  if (count === total) return 'pass';
  return 'review';
}

function getControlTowerProgress(count: number, total: number): number {
  if (total <= 0) return 0;
  return clampProgress((count / total) * 100);
}

function getControlTowerAppLabels(cards: SettingsControlTowerAppCard[], predicate: (card: SettingsControlTowerAppCard) => boolean): string {
  const labels = cards.filter(predicate).slice(0, 3).map(card => card.label);
  return labels.length > 0 ? labels.join(' / ') : '无';
}

export function getSettingsControlTower(apps: SettingsApp[] = SETTING_APPS): SettingsControlTower {
  const commandRoutes = buildSettingsCommands(SYSTEM_APPS)
    .map(command => command.route)
    .filter(Boolean);
  const protectedCommandCount = commandRoutes.filter(route => (
    route === '/dashboard' || route === '/fixed-assets/workbench?menu=home'
  )).length;

  const cards = apps.map(app => {
    const health = getSettingsAppHealth(app);
    const readiness = getReleaseReadiness(app);
    const releasePipeline = getReleasePipeline(app);
    const rollbackAnchor = getRollbackAnchor(app);
    const topology = getImpactTopology(app);
    const contracts = getSettingsCapabilityContracts(app);
    const impactStep = releasePipeline.find(step => step.id === 'impact') ?? releasePipeline[0];
    const releaseGate = releasePipeline.find(step => step.id === 'gate') ?? releasePipeline[0];
    const blockedActions = uniqueControlTowerBlockedActions([
      ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
      ...health.blockedActions,
      ...contracts.flatMap(contract => contract.blockedActions),
    ]);

    return {
      appKey: app.key,
      label: app.label,
      phase: app.phase,
      metric: app.metric,
      healthScore: clampProgress(health.score),
      readinessLabel: readiness.label,
      impactEvidence: `${impactStep.auditEvidence} / ${topology.map(node => `${node.label}:${node.value}`).join(' / ')}`,
      releaseGateLabel: releaseGate.statusLabel,
      rollbackLabel: rollbackAnchor.statusLabel,
      nextAction: sanitizeControlTowerText(health.nextAction),
      blockedActions,
      route: `/settings/${app.key}` as `/settings/${TabKey}`,
      tone: health.tone,
      state: readiness.state,
    };
  });

  const total = cards.length;
  const impactReadyCount = cards.filter(card => card.state !== 'hold').length;
  const releaseReadyCount = cards.filter(card => card.state === 'pass').length;
  const rollbackReadyCount = apps.filter(app => getRollbackAnchor(app).state === 'pass').length;
  const protectedRouteCount = cards.filter(card => card.route.startsWith('/settings/')).length;
  const contractCount = cards.filter(card => card.state === 'hold').length;
  const reviewCount = cards.filter(card => card.state === 'review').length;
  const blockedActions = uniqueControlTowerBlockedActions([
    ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
    ...cards.flatMap(card => card.blockedActions),
  ]);

  const lanes: SettingsControlTowerLane[] = [
    {
      id: 'impact',
      label: '影响校验',
      count: impactReadyCount,
      progress: getControlTowerProgress(impactReadyCount, total),
      state: getControlTowerState(impactReadyCount, total),
      tone: impactReadyCount === total ? 'stable' : 'attention',
      detail: impactReadyCount === total
        ? '所有设置应用都有可读影响链路，仍需保留人工复核。'
        : `待补影响校验：${getControlTowerAppLabels(cards, card => card.state === 'hold')}。`,
      evidence: `impactReady=${impactReadyCount}/${total}; review=${reviewCount}; contract=${contractCount}`,
      blockedActions: uniqueControlTowerBlockedActions([
        ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
        '禁止伪造真实依赖图完成态',
      ]),
    },
    {
      id: 'release',
      label: '发布门禁',
      count: releaseReadyCount,
      progress: getControlTowerProgress(releaseReadyCount, total),
      state: getControlTowerState(releaseReadyCount, total),
      tone: releaseReadyCount === total ? 'stable' : 'attention',
      detail: releaseReadyCount > 0
        ? `可进入本地门禁：${getControlTowerAppLabels(cards, card => card.state === 'pass')}。`
        : '当前没有应用可直接进入本地门禁，先处理复核或契约 hold。',
      evidence: `releasePass=${releaseReadyCount}/${total}; releaseReview=${reviewCount}; releaseHold=${contractCount}`,
      blockedActions: uniqueControlTowerBlockedActions([
        ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
        '禁止声明发布完成',
      ]),
    },
    {
      id: 'rollback',
      label: '回滚锚点',
      count: rollbackReadyCount,
      progress: getControlTowerProgress(rollbackReadyCount, total),
      state: getControlTowerState(rollbackReadyCount, total),
      tone: rollbackReadyCount === total ? 'stable' : 'attention',
      detail: rollbackReadyCount === total
        ? '所有设置应用都有本地回滚锚点说明，等待后端版本契约。'
        : `待补回滚锚点：${getControlTowerAppLabels(cards, card => card.rollbackLabel !== '可预览')}。`,
      evidence: `rollbackPreview=${rollbackReadyCount}/${total}; rollbackHoldOrReview=${total - rollbackReadyCount}`,
      blockedActions: uniqueControlTowerBlockedActions([
        ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
        '禁止伪造版本号',
        '禁止伪造审计流水',
        '禁止伪造回滚完成',
      ]),
    },
    {
      id: 'guardrail',
      label: '入口护栏',
      count: protectedRouteCount,
      progress: protectedCommandCount === 0 ? 100 : 0,
      state: 'hold',
      tone: 'contract',
      detail: protectedCommandCount === 0
        ? '所有控制塔卡片只打开设置页，受保护入口只作为冻结证据。'
        : '发现受保护入口 command，必须移除正式跳转。',
      evidence: `settingsRoutes=${protectedRouteCount}/${total}; protectedCommandRoutes=${protectedCommandCount}`,
      blockedActions: uniqueControlTowerBlockedActions([
        ...CONTROL_TOWER_BASE_BLOCKED_ACTIONS,
        '禁止生成 /dashboard 跳转',
        '禁止生成 /fixed-assets/workbench?menu=home 跳转',
      ]),
    },
  ];

  return {
    lanes,
    cards,
    protectedCommandCount,
    protectedCommandEvidence: `protectedCommandRoutes=${protectedCommandCount}; outputRoutes=/settings/:tab only`,
    blockedActions,
  };
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGateProgress(state: GateState, readyValue: number, reviewValue: number, holdValue: number): number {
  if (state === 'pass') return readyValue;
  if (state === 'review') return reviewValue;
  return holdValue;
}

const OPERATOR_PLAYBOOK_BASE_BLOCKED_ACTIONS = [
  '禁止自动发布',
  '禁止真实发布',
  '禁止写回业务前台正式入口',
];

function getOperatorValidateState(app: SettingsApp): GateState {
  if (app.tone === 'stable') return 'pass';
  if (app.tone === 'attention') return 'review';
  return 'hold';
}

function getOperatorEvidenceState(app: SettingsApp): GateState {
  return app.tone === 'contract' ? 'hold' : 'review';
}

export function getSettingsOperatorPlaybook(app: SettingsApp): SettingsOperatorPlaybookStep[] {
  const health = getSettingsAppHealth(app);
  const readiness = getReleaseReadiness(app);
  const contracts = getSettingsCapabilityContracts(app);
  const releaseGates = getReleaseGates(app);
  const releasePipeline = getReleasePipeline(app);
  const releaseGate = releasePipeline.find(step => step.id === 'gate') ?? releasePipeline[0];
  const previewGate = releaseGates.find(gate => gate.label === '预览确认') ?? releaseGates[0];
  const evidenceGate = releaseGates.find(gate => gate.label === '审计与原因') ?? releaseGates[0];
  const frozenGate = releaseGates.find(gate => gate.label === '业务前台确认') ?? releaseGates[releaseGates.length - 1];
  const contractBlocker = contracts.find(contract => contract.status === 'contract');
  const blockedActions = Array.from(new Set([
    ...OPERATOR_PLAYBOOK_BASE_BLOCKED_ACTIONS,
    ...contracts.flatMap(contract => contract.blockedActions),
  ]));
  const blockedActionsText = blockedActions.slice(0, 4).join(' / ');

  if (app.tone === 'contract') {
    return [
      {
        id: 'prepare',
        label: '准备 / 契约 hold',
        task: `冻结「${app.actions[0]}」为草稿动作，先补齐${contractBlocker?.label ?? app.metric}契约。`,
        detail: `${readiness.detail} ${health.primaryBlocker}`,
        evidence: `待补证据：${contractBlocker?.evidenceText ?? app.inspector.join(' / ')}`,
        state: 'hold',
        tone: 'contract',
        blockedActions,
      },
      {
        id: 'validate',
        label: '校验 / 禁止发布',
        task: `只允许复核${app.metric}的契约缺口，不允许发布或进入发布预览。`,
        detail: releaseGate.backendContract,
        evidence: `hold 证据：${releaseGate.auditEvidence}`,
        state: 'hold',
        tone: 'contract',
        blockedActions,
      },
      {
        id: 'evidence',
        label: '证据 / 待补齐',
        task: '记录缺失接口、审计字段和版本化要求，等待后端契约确认。',
        detail: releaseGate.riskReason,
        evidence: `契约证据：${health.summaryText} ${evidenceGate.detail}`,
        state: 'hold',
        tone: 'contract',
        blockedActions,
      },
      {
        id: 'guardrail',
        label: '护栏 / 不写正式入口',
        task: '保持契约 hold，不创建正式入口、不声明发布完成、不写业务前台。',
        detail: `${frozenGate.detail} 禁止项：${blockedActionsText}`,
        evidence: `禁止动作证据：${blockedActionsText}`,
        state: 'hold',
        tone: 'contract',
        blockedActions,
      },
    ];
  }

  const requiresReview = app.tone === 'attention';
  const validateState = getOperatorValidateState(app);
  const evidenceState = getOperatorEvidenceState(app);

  return [
    {
      id: 'prepare',
      label: requiresReview ? '准备 / 先复核' : '准备 / 可预览',
      task: requiresReview
        ? `先安排「${app.actions[1] ?? app.actions[0]}」影响预览，再处理${app.actions[0]}。`
        : `执行「${app.actions[0]}」前整理变更意图，可进入本地预览。`,
      detail: health.nextAction,
      evidence: `准备证据：${app.phase} / ${app.metric} / ${readiness.label}`,
      state: readiness.state,
      tone: readiness.tone,
      blockedActions,
    },
    {
      id: 'validate',
      label: requiresReview ? '校验 / 人工复核' : '校验 / 影响记录',
      task: requiresReview
        ? `人工复核${app.metric}影响面，确认依赖、冲突或路径风险。`
        : `确认${app.metric}影响记录完整，低风险也不能跳过门禁。`,
      detail: previewGate.detail,
      evidence: `校验证据：${app.inspector.join(' / ')}`,
      state: validateState,
      tone: app.tone,
      blockedActions,
    },
    {
      id: 'evidence',
      label: '证据 / 审计原因',
      task: '保存操作者、变更原因、预览确认结果和回滚依据。',
      detail: evidenceGate.detail,
      evidence: `审计证据：${releaseGate.auditEvidence}`,
      state: evidenceState,
      tone: evidenceState === 'review' ? 'attention' : app.tone,
      blockedActions,
    },
    {
      id: 'guardrail',
      label: '护栏 / 只读解释层',
      task: '只展示本地剧本，不触发发布、回滚、外链跳转或正式入口写回。',
      detail: `${frozenGate.detail} 禁止项：${blockedActionsText}`,
      evidence: `禁止动作证据：${blockedActionsText}`,
      state: 'hold',
      tone: 'contract',
      blockedActions,
    },
  ];
}

export function getSettingsReleasePreviewDiff(app: SettingsApp): SettingsReleasePreviewDiffItem[] {
  const readiness = getReleaseReadiness(app);
  const contracts = getSettingsCapabilityContracts(app);
  const releaseContract = contracts.find(contract => contract.id === 'release-preview');
  const playbookBlockedActions = Array.from(new Set([
    ...OPERATOR_PLAYBOOK_BASE_BLOCKED_ACTIONS,
    ...(releaseContract?.blockedActions ?? []),
  ]));

  if (app.tone === 'contract') {
    const contractBlockedActions = Array.from(new Set([
      ...playbookBlockedActions,
      '禁止进入本地预览态',
      '禁止声明发布完成',
    ]));

    return [
      {
        id: `${app.key}:contract-gap`,
        label: '契约缺口',
        currentValue: `${app.signal}；${app.inspector.join(' / ')}`,
        draftValue: `仅保留草稿说明：${app.actions[0]}，契约未补齐前不允许发布。`,
        impact: '发布、审计或版本化契约未补齐，所有发布前差异保持 hold。',
        evidence: releaseContract?.backendContract ?? 'contract/hold：契约未补齐，不允许发布。',
        state: 'hold',
        tone: 'contract',
        blockedActions: contractBlockedActions,
      },
      {
        id: `${app.key}:audit-gap`,
        label: '审计证据',
        currentValue: `当前只能读取 registry 线索：${app.metric}`,
        draftValue: '待补接口、审计字段、版本号和人工复核证据；不生成发布记录。',
        impact: '缺少可验证审计链，不能把草稿升级为发布结果。',
        evidence: `契约证据：${app.inspector.join(' / ')}`,
        state: 'hold',
        tone: 'contract',
        blockedActions: contractBlockedActions,
      },
      {
        id: `${app.key}:entry-freeze`,
        label: '正式入口冻结',
        currentValue: '业务前台正式入口保持冻结，不由设置页挂回。',
        draftValue: '只展示冻结约束文案；契约未补齐时不允许发布。',
        impact: '避免把待契约设置误写回正式业务入口。',
        evidence: '冻结证据：禁止写回业务前台正式入口；禁止真实发布。',
        state: 'hold',
        tone: 'contract',
        blockedActions: contractBlockedActions,
      },
    ];
  }

  if (app.tone === 'attention') {
    return [
      {
        id: `${app.key}:impact-review`,
        label: '影响预览',
        currentValue: `${app.signal}；${app.inspector[0] ?? app.metric}`,
        draftValue: `先补齐${app.metric}影响说明，再由人工复核。`,
        impact: '可能影响依赖、路径、冲突或变量，发布预览前必须人工确认。',
        evidence: `影响证据：${app.inspector.join(' / ')}`,
        state: 'review',
        tone: 'attention',
        blockedActions: playbookBlockedActions,
      },
      {
        id: `${app.key}:draft-control`,
        label: '草稿控制',
        currentValue: `当前动作：${app.actions[0]}`,
        draftValue: `追加${app.actions[1] ?? app.actions[0]}结果和回滚依据，不触发真实发布。`,
        impact: '草稿可进入本地预览，但需人工复核后才能继续门禁判断。',
        evidence: `预览证据：${readiness.detail}`,
        state: 'review',
        tone: 'attention',
        blockedActions: playbookBlockedActions,
      },
      {
        id: `${app.key}:operator-gate`,
        label: '人工门禁',
        currentValue: '发布门禁保持人工复核。',
        draftValue: '展示影响预览、审计原因和禁止项，不生成成功态。',
        impact: '阻止中风险设置绕过复核或误写正式入口。',
        evidence: `门禁证据：${releaseContract?.evidenceText ?? readiness.label}`,
        state: 'review',
        tone: 'attention',
        blockedActions: playbookBlockedActions,
      },
    ];
  }

  return [
    {
      id: `${app.key}:local-preview`,
      label: '本地预览',
      currentValue: `${app.label} 当前处于${readiness.label}。`,
      draftValue: `整理${app.actions[0]}草稿，可进入本地预览但不声明真实发布。`,
      impact: '低风险设置仍只展示本地差异，不触发后端发布。',
      evidence: `预览证据：${app.phase} / ${app.metric}`,
      state: 'pass',
      tone: 'stable',
      blockedActions: playbookBlockedActions,
    },
    {
      id: `${app.key}:audit-ready`,
      label: '审计准备',
      currentValue: `已有线索：${app.inspector[0] ?? app.signal}`,
      draftValue: `补充变更原因、操作者、${app.metric}和预览确认结果。`,
      impact: '支持人工检查发布前差异，但不写入真实审计流水。',
      evidence: `审计证据：${app.inspector.join(' / ')}`,
      state: 'review',
      tone: 'attention',
      blockedActions: playbookBlockedActions,
    },
    {
      id: `${app.key}:entry-guard`,
      label: '入口护栏',
      currentValue: '业务前台正式入口不由本工作台写回。',
      draftValue: '本地面板只展示冻结约束和禁止项。',
      impact: '避免把本地预览误解为正式入口挂载。',
      evidence: '护栏证据：禁止真实发布；禁止写回业务前台正式入口。',
      state: 'hold',
      tone: 'contract',
      blockedActions: playbookBlockedActions,
    },
  ];
}

export function getSettingsOperationPulse(app: SettingsApp): SettingsOperationPulseItem[] {
  const health = getSettingsAppHealth(app);
  const readiness = getReleaseReadiness(app);
  const releasePipeline = getReleasePipeline(app);
  const rollbackAnchor = getRollbackAnchor(app);
  const capabilitySummary = getCapabilityContractSummary(app);
  const frozenWorkbenchGate = getReleaseGates(app).find(gate => gate.label === '业务前台确认');
  const releaseGate = releasePipeline.find(step => step.id === 'gate') ?? releasePipeline[0];
  const contractMode = capabilitySummary.contract > 0;

  return [
    {
      id: 'human-next-step',
      label: '人类操作下一步',
      value: health.nextAction,
      detail: health.primaryBlocker,
      tone: health.tone,
      state: readiness.state,
      readiness: health.readinessLabel,
      progress: clampProgress(health.score),
    },
    {
      id: 'release-gate',
      label: '发布门禁状态',
      value: releaseGate.statusLabel,
      detail: releaseGate.detail,
      tone: releaseGate.tone,
      state: releaseGate.state,
      readiness: readiness.label,
      progress: clampProgress(readiness.state === 'pass' ? 76 : getGateProgress(releaseGate.state, 86, 58, 24)),
    },
    {
      id: 'workbench-freeze',
      label: '业务前台冻结确认',
      value: frozenWorkbenchGate?.label ?? '业务前台确认',
      detail: frozenWorkbenchGate?.detail ?? '/fixed-assets/workbench?menu=home 保持冻结，禁止生成正式 route command。',
      tone: 'contract',
      state: frozenWorkbenchGate?.state ?? 'hold',
      readiness: '冻结 / 不生成正式入口',
      progress: clampProgress(18 + (readiness.state === 'pass' ? 14 : 0)),
    },
    {
      id: 'rollback-contract',
      label: contractMode ? '契约与回滚保持' : '回滚锚点状态',
      value: rollbackAnchor.statusLabel,
      detail: contractMode
        ? `${rollbackAnchor.backendContract} ${rollbackAnchor.riskReason}`
        : rollbackAnchor.detail,
      tone: rollbackAnchor.tone,
      state: rollbackAnchor.state,
      readiness: contractMode ? 'contract / hold' : rollbackAnchor.statusLabel,
      progress: clampProgress(getGateProgress(rollbackAnchor.state, 78, 52, 22)),
    },
  ];
}

export function getReleasePipeline(app: SettingsApp): ReleasePipelineItem[] {
  const readiness = getReleaseReadiness(app);
  const rollbackAnchor = getRollbackAnchor(app);
  const contractText = app.tone === 'contract'
    ? '后端契约待补齐，暂不允许发布。'
    : `复用当前设置页能力：${app.inspector[0] ?? app.metric}。`;
  const impactState: GateState = app.tone === 'stable' ? 'pass' : app.tone === 'attention' ? 'review' : 'hold';
  const previewState: GateState = app.tone === 'contract' ? 'hold' : 'review';
  const gateState: GateState = app.tone === 'stable' ? 'review' : app.tone === 'attention' ? 'review' : 'hold';

  return [
    {
      id: 'draft',
      label: '草稿',
      statusLabel: '本地草稿',
      detail: `整理「${app.actions[0]}」变更意图和操作原因，不写入后端发布状态。`,
      auditEvidence: `草稿证据：${app.label} / ${app.phase} / ${app.metric}`,
      backendContract: contractText,
      riskReason: app.tone === 'contract' ? '契约未确认，草稿不能升级为真实发布。' : '草稿阶段仅用于发布前说明。',
      state: 'pass',
      tone: 'stable',
    },
    {
      id: 'impact',
      label: '影响校验',
      statusLabel: app.tone === 'attention' ? '需影响预览' : readiness.label,
      detail: app.tone === 'stable'
        ? `记录${app.metric}的影响面，作为发布预览前置证据。`
        : `围绕${app.metric}补齐依赖、路径或变量影响说明。`,
      auditEvidence: `影响证据：${app.inspector.join(' / ')}`,
      backendContract: contractText,
      riskReason: app.tone === 'attention'
        ? `风险原因：${getInspectorField(app, ['风险', '当前', '依赖', '前端旧路径'], app.signal)}。`
        : '低风险也必须保留影响记录，避免绕过发布门禁。',
      state: impactState,
      tone: app.tone === 'stable' ? 'stable' : 'attention',
    },
    {
      id: 'preview',
      label: '预览确认',
      statusLabel: app.tone === 'contract' ? '待契约 / 不可发布' : readiness.label,
      detail: `用「${app.actions[1] ?? app.actions[0]}」生成本地确认视图，不打开业务前台正式入口。`,
      auditEvidence: `预览证据：${app.summary}`,
      backendContract: contractText,
      riskReason: app.tone === 'contract'
        ? '后端契约待补齐，预览只能展示待办原因。'
        : '预览确认仅为本地安全态，不代表真实发布完成。',
      state: previewState,
      tone: app.tone === 'contract' ? 'contract' : app.tone,
    },
    {
      id: 'gate',
      label: '发布门禁',
      statusLabel: app.tone === 'contract' ? '待契约 / 不可发布' : app.tone === 'attention' ? '需人工复核' : '可进入门禁',
      detail: readiness.detail,
      auditEvidence: `门禁证据：操作者、变更原因、${app.metric}、预览确认结果。`,
      backendContract: app.tone === 'contract'
        ? '后端契约待补齐；缺少发布、审计或版本化接口确认。'
        : '当前工作台不调用发布接口，等待后端发布契约接入。',
      riskReason: app.tone === 'stable'
        ? '无后端发布动作，仍需真实契约后才能落库。'
        : `风险原因：${app.signal}。`,
      state: gateState,
      tone: readiness.tone,
    },
    {
      id: 'rollback',
      label: '回滚锚点',
      statusLabel: rollbackAnchor.statusLabel,
      detail: rollbackAnchor.detail,
      auditEvidence: rollbackAnchor.auditEvidence,
      backendContract: rollbackAnchor.backendContract,
      riskReason: rollbackAnchor.riskReason,
      state: rollbackAnchor.state,
      tone: rollbackAnchor.tone,
    },
  ];
}

export function getRollbackAnchor(app: SettingsApp): RollbackAnchor {
  if (app.tone === 'contract') {
    return {
      title: `${app.label} 回滚锚点`,
      statusLabel: '待契约 / 不可发布',
      detail: '没有伪造发布完成记录；待后端契约补齐版本号、审计流水和恢复接口后才能生成锚点。',
      auditEvidence: `待补证据：${app.inspector.join(' / ')}`,
      backendContract: '后端契约待补齐：发布版本、审计流水、回滚接口。',
      riskReason: '契约缺失时强行发布会制造不可验证的版本状态。',
      state: 'hold',
      tone: 'contract',
    };
  }

  if (app.tone === 'attention') {
    return {
      title: `${app.label} 回滚锚点`,
      statusLabel: '需影响预览',
      detail: `先完成${app.metric}影响预览，再锁定最近稳定配置作为人工回退依据。`,
      auditEvidence: `需补证据：影响预览、预览确认、${app.actions[0]}结果。`,
      backendContract: '后端契约待补齐：正式回滚接口尚未在此工作台调用。',
      riskReason: `风险原因：${getInspectorField(app, ['风险', '当前', '依赖', '前端旧路径'], app.signal)}。`,
      state: 'review',
      tone: 'attention',
    };
  }

  return {
    title: `${app.label} 回滚锚点`,
    statusLabel: '可预览',
    detail: '允许展示本地预览锚点；真实回滚仍等待后端版本契约接入。',
    auditEvidence: `可用证据：${app.phase}、${app.metric}、${app.actions.join(' / ')}`,
    backendContract: '后端契约待补齐：当前仅展示安全预览，不调用回滚接口。',
    riskReason: '没有后端写入，因此不存在假发布完成；后续需接入真实版本号。',
    state: 'pass',
    tone: 'stable',
  };
}
