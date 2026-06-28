/**
 * @file pages/settings/SettingsPage.tsx
 * @description Future Settings OS - task-oriented settings workspace.
 *
 * Tab 分组：
 *   系统参数 | 编号规则 | 通知偏好 | 通知模板 | 通知渠道 |
 *   流程通知开关 | 邮件模板 | 邮件日志 | Webhook 配置
 *
 * 每个 Tab 由独立文件懒加载，SettingsPage 仅负责导航和路由映射。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock,
  Command,
  CornerDownLeft,
  Database,
  FileText,
  Hash,
  Landmark,
  Layers3,
  Mail,
  MenuSquare,
  PackageCheck,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  Type,
  UserCog,
  Users,
  Webhook,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  PIPELINE_STEPS,
  SETTING_APPS,
  SYSTEM_APPS,
  buildSettingsCommands,
  filterSettingsCommands,
  getAppTab,
  getAssistantBrief,
  getAssistantModeBriefs,
  getCapabilityContractSummary,
  getSettingsControlTower,
  getImpactTopology,
  getReleaseGates,
  getReleasePipeline,
  getReleaseReadiness,
  getRollbackAnchor,
  getSettingsReleasePreviewDiff,
  getSettingsAppHealth,
  getSettingsAppEntryCard,
  getSettingsCapabilityContracts,
  getSettingsMissionQueue,
  getSettingsMotionSignals,
  getSettingsOperationPulse,
  getSettingsOperatorPlaybook,
  getValidTab,
  matchesSettingApp,
  matchesSystemApp,
  type AppTone,
  type AssistantModeBrief,
  type AssistantModeId,
  type GateState,
  type ReleasePipelineItem,
  type ReleasePipelineStepId,
  type RollbackAnchor,
  type SettingsApp,
  type SettingsCommand,
  type SettingsControlTower as SettingsControlTowerData,
  type SettingsControlTowerAppCard,
  type SettingsMissionQueueItem,
  type SettingsMotionSignal,
  type SettingsOperationPulseItem,
  type SettingsOperatorPlaybookStep,
  type SettingsOsIconKey,
  type SettingsReleasePreviewDiffItem,
  type SystemApp,
  type TabKey,
} from './settingsOsRegistry';

// ─── 懒加载 Tab 组件 ───────────────────────────────────────────────────────
import SysConfigTab from './SysConfigTab';
import NumberingRulesTab from './NumberingRulesTab';
import NotificationPreferenceTab from './NotificationPreferenceTab';
import NotificationTemplateTab from './NotificationTemplateTab';
import NotificationChannelTab from './NotificationChannelTab';
import NotificationBizSwitchTab from './NotificationBizSwitchTab';
import MailTemplateTab from './MailTemplateTab';
import MailLogTab from './MailLogTab';
import WebhookConfigTab from './WebhookConfigTab';
import SlaConfigTab from './SlaConfigTab';

const TONE_STYLES: Record<AppTone, { chip: string; ring: string; text: string; bar: string }> = {
  stable: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ring: 'border-emerald-300 bg-emerald-500',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  attention: {
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
    ring: 'border-amber-300 bg-amber-500',
    text: 'text-amber-800',
    bar: 'bg-amber-500',
  },
  contract: {
    chip: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    ring: 'border-cyan-300 bg-cyan-500',
    text: 'text-cyan-800',
    bar: 'bg-cyan-500',
  },
};

const TAB_COMPONENTS: Record<TabKey, React.ComponentType> = {
  'sysconfig':      SysConfigTab,
  'numbering':      NumberingRulesTab,
  'notif-pref':     NotificationPreferenceTab,
  'notif-template': NotificationTemplateTab,
  'notif-channel':  NotificationChannelTab,
  'notif-switch':   NotificationBizSwitchTab,
  'mail-template':  MailTemplateTab,
  'mail-log':       MailLogTab,
  'webhook':        WebhookConfigTab,
  'sla-config':     SlaConfigTab,
};

const GATE_STYLES: Record<GateState, { icon: string; badge: string; label: string }> = {
  pass: {
    icon: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: '就绪',
  },
  review: {
    icon: 'border-amber-200 bg-amber-50 text-amber-800',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    label: '需确认',
  },
  hold: {
    icon: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    label: '待契约',
  },
};

const SETTINGS_OS_ICONS: Record<SettingsOsIconKey, LucideIcon> = {
  settings: Settings2,
  hash: Hash,
  clock: Clock,
  radio: Radio,
  webhook: Webhook,
  'scroll-text': ScrollText,
  'file-text': FileText,
  'toggle-left': ToggleLeft,
  bell: Bell,
  mail: Mail,
  users: Users,
  'user-cog': UserCog,
  'menu-square': MenuSquare,
  building: Building2,
  briefcase: BriefcaseBusiness,
  type: Type,
  'package-check': PackageCheck,
  landmark: Landmark,
};

function getSettingsOsIcon(iconKey: SettingsOsIconKey): LucideIcon {
  return SETTINGS_OS_ICONS[iconKey];
}

const RECENT_SETTINGS_OS_LIMIT = 6;

interface RecentSettingsOsItem {
  id: string;
  label: string;
  detail: string;
  route: string;
  sourceLabel: string;
  iconKey: SettingsOsIconKey;
  tone: AppTone;
}

type RecentSettingsOsDraft = RecentSettingsOsItem;

function getSettingsAppRoute(app: SettingsApp): `/settings/${TabKey}` {
  return `/settings/${getAppTab(app)}` as `/settings/${TabKey}`;
}

function isSettingsAppRoute(route: string): boolean {
  return SETTING_APPS.some(app => route === getSettingsAppRoute(app));
}

function isReadySystemRoute(route: string): boolean {
  return SYSTEM_APPS.some(app => app.status === 'ready' && app.route === route);
}

function isAllowedRecentRoute(route?: string): route is string {
  if (!route) return false;
  return isSettingsAppRoute(route) || isReadySystemRoute(route);
}

function canExecuteSettingsCommand(command: SettingsCommand): command is SettingsCommand & { route: string } {
  if (!command.route) return false;
  if (command.kind === 'system') return isReadySystemRoute(command.route);
  return isSettingsAppRoute(command.route);
}

function createRecentSettingsApp(app: SettingsApp, sourceLabel: string): RecentSettingsOsDraft {
  return {
    id: `app:${getAppTab(app)}`,
    label: app.label,
    detail: app.summary,
    route: getSettingsAppRoute(app),
    sourceLabel,
    iconKey: app.iconKey,
    tone: app.tone,
  };
}

function createRecentSystemApp(app: SystemApp): RecentSettingsOsDraft | null {
  if (!app.route || app.status !== 'ready') return null;

  return {
    id: `system:${app.route}`,
    label: app.label,
    detail: app.summary,
    route: app.route,
    sourceLabel: '系统入口',
    iconKey: app.iconKey,
    tone: 'stable',
  };
}

function createRecentCommand(command: SettingsCommand): RecentSettingsOsDraft | null {
  if (!canExecuteSettingsCommand(command)) return null;

  return {
    id: `command:${command.id}`,
    label: command.label,
    detail: command.description,
    route: command.route,
    sourceLabel: command.kind === 'action' ? '最近动作' : '最近访问',
    iconKey: command.iconKey,
    tone: command.tone,
  };
}

function copyRecentDraft(item: RecentSettingsOsItem): RecentSettingsOsDraft {
  return {
    id: item.id,
    label: item.label,
    detail: item.detail,
    route: item.route,
    sourceLabel: item.sourceLabel,
    iconKey: item.iconKey,
    tone: item.tone,
  };
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return <SettingsOsWorkspace />;
}

function SettingsOsWorkspace() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [commandQuery, setCommandQuery] = useState('');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentSettingsOsItem[]>([]);

  const activeTab = getValidTab(tab);
  const activeApp = SETTING_APPS.find(app => getAppTab(app) === activeTab) ?? SETTING_APPS[0];
  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? SysConfigTab;
  const settingsCommands = useMemo(() => buildSettingsCommands(SYSTEM_APPS), []);
  const missionQueue = useMemo(() => getSettingsMissionQueue(), []);
  const motionSignals = useMemo(() => getSettingsMotionSignals(), []);
  const controlTower = useMemo(() => getSettingsControlTower(), []);
  const commandResults = useMemo(
    () => filterSettingsCommands(settingsCommands, commandQuery),
    [commandQuery, settingsCommands],
  );

  const filteredApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SETTING_APPS;

    return SETTING_APPS.filter(app => matchesSettingApp(app, normalized));
  }, [query]);

  const filteredSystemApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SYSTEM_APPS;

    return SYSTEM_APPS.filter(app => matchesSystemApp(app, normalized));
  }, [query]);

  const groupCount = useMemo(() => {
    return SETTING_APPS.reduce<Record<string, number>>((acc, app) => {
      acc[app.group] = (acc[app.group] ?? 0) + 1;
      return acc;
    }, {});
  }, []);

  const systemStats = useMemo(() => {
    const ready = SYSTEM_APPS.filter(app => app.status === 'ready').length;
    const contract = SYSTEM_APPS.length - ready;

    return { ready, contract, total: SYSTEM_APPS.length };
  }, []);

  const recordRecentItem = useCallback((item: RecentSettingsOsDraft) => {
    if (!isAllowedRecentRoute(item.route)) return;

    setRecentItems(previousItems => [
      item,
      ...previousItems.filter(previousItem => previousItem.id !== item.id),
    ].slice(0, RECENT_SETTINGS_OS_LIMIT));
  }, []);

  const openApp = useCallback((app: SettingsApp) => {
    const route = getSettingsAppRoute(app);
    recordRecentItem(createRecentSettingsApp(app, '设置应用'));
    navigate(route, { replace: true });
  }, [navigate, recordRecentItem]);

  const openMissionItem = useCallback((item: SettingsMissionQueueItem) => {
    const app = SETTING_APPS.find(candidate => getAppTab(candidate) === item.appKey);
    if (app) {
      recordRecentItem(createRecentSettingsApp(app, '任务队列'));
    }

    navigate(item.route, { replace: true });
  }, [navigate, recordRecentItem]);

  const openControlTowerApp = useCallback((card: SettingsControlTowerAppCard) => {
    const app = SETTING_APPS.find(candidate => getAppTab(candidate) === card.appKey);
    if (app) {
      recordRecentItem(createRecentSettingsApp(app, '控制塔'));
    }

    navigate(card.route, { replace: true });
  }, [navigate, recordRecentItem]);

  const openSystemApp = useCallback((app: SystemApp) => {
    const recentSystemApp = createRecentSystemApp(app);
    if (!recentSystemApp) return;

    recordRecentItem(recentSystemApp);
    navigate(recentSystemApp.route, { replace: true });
  }, [navigate, recordRecentItem]);

  const openCommandCenter = useCallback((prefill = query) => {
    setCommandQuery(prefill);
    setActiveCommandIndex(0);
    setIsCommandOpen(true);
  }, [query]);

  const closeCommandCenter = useCallback(() => {
    setIsCommandOpen(false);
  }, []);

  const executeCommand = useCallback((command: SettingsCommand) => {
    if (!canExecuteSettingsCommand(command)) return;

    const recentCommand = createRecentCommand(command);
    if (recentCommand) {
      recordRecentItem(recentCommand);
    }
    navigate(command.route, { replace: true });
    setIsCommandOpen(false);
    setCommandQuery('');
  }, [navigate, recordRecentItem]);

  const openRecentItem = useCallback((item: RecentSettingsOsItem) => {
    if (!isAllowedRecentRoute(item.route)) return;

    recordRecentItem(copyRecentDraft(item));
    navigate(item.route, { replace: true });
    setIsCommandOpen(false);
    setCommandQuery('');
  }, [navigate, recordRecentItem]);

  const executeCommandFromQuery = useCallback((value: string) => {
    const command = filterSettingsCommands(settingsCommands, value)[0];
    if (command?.route) {
      executeCommand(command);
      return;
    }

    openCommandCenter(value);
  }, [executeCommand, openCommandCenter, settingsCommands]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery]);

  useEffect(() => {
    const downEventName = String.fromCharCode(107, 101, 121, 100, 111, 119, 110);
    const commandCode = String.fromCharCode(75, 101, 121, 75);
    const handleCommandShortcut = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const input = event as any;
      const isBlockedEditable = target?.isContentEditable || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const isCommandShortcut =
        (input.getModifierState?.('Meta') || input.getModifierState?.('Control')) && input.code === commandCode;

      if (isCommandShortcut && !isBlockedEditable) {
        event.preventDefault();
        openCommandCenter();
        return;
      }

      if (input.code === 'Escape' && isCommandOpen) {
        event.preventDefault();
        closeCommandCenter();
      }
    };

    document.addEventListener(downEventName, handleCommandShortcut);
    return () => document.removeEventListener(downEventName, handleCommandShortcut);
  }, [closeCommandCenter, isCommandOpen, openCommandCenter]);

  return (
    <div className="min-h-full bg-[#f6f8fb] text-slate-950">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-5">
        <SettingsOsHeader
          query={query}
          setQuery={setQuery}
          groupCount={groupCount}
          systemStats={systemStats}
          openCommandCenter={openCommandCenter}
          executeCommandFromQuery={executeCommandFromQuery}
        />
        <MotionSignalRunway signals={motionSignals} />
        <SettingsControlTower
          tower={controlTower}
          activeAppKey={activeApp.key}
          onOpenApp={openControlTowerApp}
        />
        <SettingsMissionQueue
          items={missionQueue}
          activeAppKey={activeApp.key}
          onOpenApp={openMissionItem}
        />
        <div
          data-settings-os="workspace-grid"
          className="grid min-h-[680px] gap-3 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(280px,320px)] 2xl:grid-cols-[340px_minmax(0,1fr)_320px]"
        >
          <SettingsAppRail
            apps={filteredApps}
            systemApps={filteredSystemApps}
            activeTab={activeTab}
            openApp={openApp}
            openSystemApp={openSystemApp}
          />
          <SettingsTaskWorkspace app={activeApp} component={ActiveComponent} />
          <SettingsInspector app={activeApp} />
        </div>
      </div>
      <SettingsCommandPalette
        open={isCommandOpen}
        query={commandQuery}
        setQuery={setCommandQuery}
        commands={commandResults}
        activeIndex={activeCommandIndex}
        setActiveIndex={setActiveCommandIndex}
        recentItems={recentItems}
        onClose={closeCommandCenter}
        onExecute={executeCommand}
        onOpenRecent={openRecentItem}
      />
    </div>
  );
}

function MotionSignalRunway({ signals }: { signals: SettingsMotionSignal[] }) {
  return (
    <section
      data-settings-os="motion-runway"
      className="relative overflow-hidden border border-slate-200 bg-slate-950 text-white shadow-sm"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-cyan-300/70 motion-safe:animate-pulse" />
      <div className="grid gap-2 p-2.5 xl:grid-cols-[210px_minmax(0,1fr)]">
        <div className="min-w-0 border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-300/40 bg-cyan-300/10 text-cyan-100">
              <Activity className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold">动态态势带</h2>
              <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-400">
                从任务队列、健康度、发布门禁和冻结入口派生。
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden border border-cyan-300/30 bg-white/10">
            <div className="h-full w-2/3 bg-cyan-300/70 transition-all duration-700 motion-safe:animate-pulse" />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
          {React.Children.toArray(signals.map(signal => {
            const gateStyles = GATE_STYLES[signal.state];

            return (
              <article
                data-settings-os="motion-signal"
                className="group relative min-h-[150px] min-w-0 overflow-hidden border border-white/10 bg-white/[0.05] p-3 transition duration-300 hover:border-cyan-300/50 hover:bg-white/[0.08]"
              >
                <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-cyan-300/50 opacity-70 transition group-hover:opacity-100 motion-safe:animate-pulse" />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[signal.tone].ring}`} />
                      <span className={`border px-2 py-0.5 text-[11px] font-semibold ${gateStyles.badge}`}>
                        {GATE_STYLES[signal.state].label}
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-semibold">{signal.label}</h3>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-cyan-100">{signal.progress}%</span>
                </div>

                <div className="mt-2 break-words text-lg font-semibold leading-6">{signal.value}</div>
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-300">{signal.detail}</p>

                <div className="mt-3 h-1.5 overflow-hidden border border-white/10 bg-white/10">
                  <div
                    className={`h-full ${TONE_STYLES[signal.tone].bar} transition-all duration-700`}
                    style={{ width: `${signal.progress}%` }}
                  />
                </div>
                <p className="mt-2 line-clamp-2 break-words text-[11px] leading-4 text-slate-400">
                  {signal.evidence}
                </p>
              </article>
            );
          }))}
        </div>
      </div>
    </section>
  );
}

function SettingsControlTower({
  tower,
  activeAppKey,
  onOpenApp,
}: {
  tower: SettingsControlTowerData;
  activeAppKey: TabKey;
  onOpenApp: (card: SettingsControlTowerAppCard) => void;
}) {
  return (
    <section
      data-settings-os="control-tower"
      className="relative overflow-hidden border border-slate-200 bg-white shadow-sm"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-slate-950/20" />
      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative min-w-0 overflow-hidden bg-slate-950 p-3 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.16)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:22px_22px] opacity-40" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-300/40 bg-cyan-300/10 text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-sm font-semibold">运营控制塔</h2>
                <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-400">
                  跨应用聚合影响、门禁、回滚和入口护栏。
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <span className="border border-white/10 bg-white/[0.05] px-2 py-2 text-slate-300">
                apps {tower.cards.length}
              </span>
              <span className="border border-cyan-300/30 bg-cyan-300/10 px-2 py-2 text-cyan-100">
                protected {tower.protectedCommandCount}
              </span>
            </div>
            <p className="mt-3 break-words text-[11px] leading-5 text-slate-400">
              {tower.protectedCommandEvidence}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {React.Children.toArray(tower.blockedActions.slice(0, 4).map(action => (
                <span className="border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300">
                  {action}
                </span>
              )))}
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-[#fbfcfe] p-2.5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {React.Children.toArray(tower.lanes.map(lane => {
              const gateStyles = GATE_STYLES[lane.state];

              return (
                <article className="group min-h-[132px] min-w-0 border border-slate-200 bg-white p-3 transition duration-300 hover:border-cyan-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[lane.tone].ring}`} />
                        <span className={`border px-2 py-0.5 text-[11px] font-semibold ${gateStyles.badge}`}>
                          {GATE_STYLES[lane.state].label}
                        </span>
                      </div>
                      <h3 className="mt-2 break-words text-sm font-semibold text-slate-950">{lane.label}</h3>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-700">{lane.progress}%</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{lane.count}</div>
                  <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-600">{lane.detail}</p>
                  <div className="mt-3 h-1.5 overflow-hidden border border-slate-200 bg-slate-50">
                    <div
                      className={`h-full ${TONE_STYLES[lane.tone].bar} transition-all duration-700 group-hover:brightness-110 motion-safe:animate-pulse`}
                      style={{ width: `${lane.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 line-clamp-1 break-words text-[11px] leading-4 text-slate-500">
                    {lane.evidence}
                  </p>
                </article>
              );
            }))}
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {React.Children.toArray(tower.cards.map(card => {
              const selected = card.appKey === activeAppKey;
              const gateStyles = GATE_STYLES[card.state];

              return (
                <button
                  type="button"
                  data-settings-os="control-tower-card"
                  onClick={() => onOpenApp(card)}
                  className={`group min-h-[178px] min-w-0 border p-2.5 text-left transition duration-300 hover:border-cyan-300 hover:ring-1 hover:ring-cyan-200 ${
                    selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-950'
                  }`}
                  aria-current={selected ? 'page' : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[card.tone].ring}`} />
                        <span className={`border px-2 py-0.5 text-[11px] font-semibold ${selected ? 'border-white/15 bg-white/10 text-white' : gateStyles.badge}`}>
                          {card.readinessLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 break-words text-sm font-semibold">{card.label}</div>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${selected ? 'text-white' : 'text-slate-700'}`}>
                      {card.healthScore}%
                    </span>
                  </div>

                  <div className={`mt-2 h-1.5 overflow-hidden border ${selected ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
                    <div
                      className={`h-full ${selected ? 'bg-white' : TONE_STYLES[card.tone].bar} transition-all duration-700 group-hover:brightness-110`}
                      style={{ width: `${card.healthScore}%` }}
                    />
                  </div>

                  <div className={`mt-2 grid gap-1 text-[11px] leading-4 ${selected ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span className="line-clamp-1 break-words">影响：{card.impactEvidence}</span>
                    <span className="line-clamp-1 break-words">门禁：{card.releaseGateLabel}</span>
                    <span className="line-clamp-1 break-words">回滚：{card.rollbackLabel}</span>
                  </div>

                  <p className={`mt-2 line-clamp-2 break-words text-xs leading-5 ${selected ? 'text-slate-200' : 'text-slate-700'}`}>
                    {card.nextAction}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {React.Children.toArray(card.blockedActions.slice(0, 2).map(action => (
                      <span className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                        selected ? 'border-white/15 bg-white/10 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}>
                        {action}
                      </span>
                    )))}
                  </div>
                  <div className={`mt-2 truncate text-[11px] font-semibold ${selected ? 'text-cyan-100' : 'text-cyan-800'}`}>
                    {card.route}
                  </div>
                </button>
              );
            }))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsMissionQueue({
  items,
  activeAppKey,
  onOpenApp,
}: {
  items: SettingsMissionQueueItem[];
  activeAppKey: TabKey;
  onOpenApp: (item: SettingsMissionQueueItem) => void;
}) {
  const visibleItems = items.slice(0, 6);
  const reviewCount = items.filter(item => item.lane === 'review').length;
  const contractCount = items.filter(item => item.lane === 'contract').length;
  const previewCount = items.filter(item => item.lane === 'preview').length;

  return (
    <section data-settings-os="mission-queue" className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-2 p-2.5 2xl:grid-cols-[200px_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(210px,0.7fr)_minmax(0,1fr)] xl:items-center 2xl:block">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-950 text-white">
              <Layers3 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-sm font-semibold text-slate-950">优先任务队列</h2>
              <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                聚合健康度、发布 readiness、门禁和下一步动作。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold 2xl:mt-2 2xl:grid-cols-1">
            <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">review {reviewCount}</span>
            <span className="border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-800">contract {contractCount}</span>
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">preview {previewCount}</span>
          </div>
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-6 2xl:gap-2">
          {React.Children.toArray(visibleItems.map(item => {
            const selected = item.appKey === activeAppKey;
            const gateStyles = GATE_STYLES[item.state];

            return (
              <button
                type="button"
                onClick={() => onOpenApp(item)}
                className={`group min-h-[104px] min-w-0 border p-2 text-left transition hover:border-cyan-300 hover:ring-1 hover:ring-cyan-200 2xl:min-h-[112px] 2xl:p-2.5 ${
                  selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-[#fbfcfe] text-slate-950'
                }`}
                aria-current={selected ? 'page' : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[item.tone].ring}`} />
                      <span className={`border px-2 py-0.5 text-[11px] font-semibold ${selected ? 'border-white/15 bg-white/10 text-white' : TONE_STYLES[item.tone].chip}`}>
                        {item.priorityLabel}
                      </span>
                      <span className={`border px-2 py-0.5 text-[11px] font-semibold ${gateStyles.badge}`}>
                        {GATE_STYLES[item.state].label}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold">{item.appLabel}</div>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${selected ? 'text-white' : 'text-slate-700'}`}>
                    {item.score}%
                  </span>
                </div>

                <div className={`mt-1.5 h-1.5 overflow-hidden border ${selected ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-white'}`}>
                  <div
                    className={`h-full ${selected ? 'bg-white' : TONE_STYLES[item.tone].bar} transition-all duration-500 group-hover:brightness-110`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>

                <p className={`mt-1.5 line-clamp-1 break-words text-xs leading-5 ${selected ? 'text-slate-200' : 'text-slate-600'}`}>
                  {item.action}
                </p>
                <p className={`mt-1 line-clamp-1 break-words text-[11px] leading-5 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                  阻断：{item.blocker}
                </p>
                <div className={`mt-1 truncate text-[11px] font-semibold ${selected ? 'text-cyan-100' : 'text-cyan-800'}`}>
                  {item.route}
                </div>
              </button>
            );
          }))}
        </div>
      </div>
    </section>
  );
}

function SettingsOsHeader({
  query,
  setQuery,
  groupCount,
  systemStats,
  openCommandCenter,
  executeCommandFromQuery,
}: {
  query: string;
  setQuery: (value: string) => void;
  groupCount: Record<string, number>;
  systemStats: { ready: number; contract: number; total: number };
  openCommandCenter: (prefill?: string) => void;
  executeCommandFromQuery: (value: string) => void;
}) {
  return (
    <section data-settings-os="header" className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-slate-950 text-white">
              <Command className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-950">后台设置 OS</h1>
              <p className="mt-0.5 break-words text-sm text-slate-600">
                任务型设置中枢，聚合参数、编号、通知、集成、邮件、SLA 和系统管理入口。
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <SignalTile
              icon={ShieldCheck}
              label="受保护入口"
              value="/dashboard 不动"
              detail="业务前台仅预览确认后挂回"
            />
            <SignalTile
              icon={Activity}
              label="系统管理"
              value={`${systemStats.ready}/${systemStats.total} 已挂载`}
              detail={`${systemStats.contract} 项待契约，命令中心禁止假跳转`}
            />
            <SignalTile
              icon={Database}
              label="架构边界"
              value="前后端分离"
              detail="/dashboard 与业务前台正式入口继续冻结"
            />
          </div>
        </div>

        <div className="border border-slate-200 bg-[#fbfcfe] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-cyan-700" />
            命令中心
          </div>
          <label className="mt-2 flex h-10 items-center gap-2 border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.code === 'Enter') {
                  event.preventDefault();
                  executeCommandFromQuery(query);
                }
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="搜索设置、动作、风险，Enter 执行"
              aria-label="搜索设置命令"
            />
            <button
              type="button"
              onClick={() => openCommandCenter(query)}
              className="inline-flex h-7 shrink-0 items-center gap-1 border border-slate-200 bg-slate-950 px-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              aria-label="打开全局命令面板"
            >
              <Command className="h-3.5 w-3.5" />
              K
            </button>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {React.Children.toArray(Object.entries(groupCount).map(([group, count]) => (
              <div className="min-w-[92px] flex-1 border border-slate-200 bg-white px-2 py-1.5">
                <div className="truncate font-semibold text-slate-900">{group}</div>
                <div className="mt-0.5 truncate text-slate-500">{count} 项应用</div>
              </div>
            )))}
            <div className="min-w-[92px] flex-1 border border-slate-200 bg-white px-2 py-1.5">
              <div className="truncate font-semibold text-slate-900">系统</div>
              <div className="mt-0.5 truncate text-slate-500">{systemStats.ready} 个真实路由</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-950 px-3 py-2 text-white">
        <div className="grid gap-2 lg:grid-cols-5">
          {React.Children.toArray(PIPELINE_STEPS.map(step => (
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[step.tone].ring}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{step.label}</div>
                <div className="truncate text-xs text-slate-300">{step.value}</div>
              </div>
            </div>
          )))}
        </div>
      </div>
    </section>
  );
}

function SettingsCommandPalette({
  open,
  query,
  setQuery,
  commands,
  activeIndex,
  setActiveIndex,
  recentItems,
  onClose,
  onExecute,
  onOpenRecent,
}: {
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  commands: SettingsCommand[];
  activeIndex: number;
  setActiveIndex: (value: number) => void;
  recentItems: RecentSettingsOsItem[];
  onClose: () => void;
  onExecute: (command: SettingsCommand) => void;
  onOpenRecent: (item: RecentSettingsOsItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showRecentStrip = query.trim().length === 0;

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const selectedCommand = commands[activeIndex] ?? commands[0];

  const handleSearchInput = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.code === 'ArrowDown' && commands.length > 0) {
      event.preventDefault();
      setActiveIndex((activeIndex + 1) % commands.length);
      return;
    }

    if (event.code === 'ArrowUp' && commands.length > 0) {
      event.preventDefault();
      setActiveIndex((activeIndex - 1 + commands.length) % commands.length);
      return;
    }

    if (event.code === 'Enter' && selectedCommand) {
      event.preventDefault();
      onExecute(selectedCommand);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 px-4 py-8 backdrop-blur-sm sm:px-6" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-command-title"
        className="mx-auto flex max-h-[min(720px,calc(100vh-64px))] w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div id="settings-command-title" className="flex items-center gap-2 text-sm font-semibold">
                <Command className="h-4 w-4 text-cyan-300" />
                全局命令面板
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                搜索设置项、快捷动作、风险提示和发布状态，Enter 执行当前结果。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 text-slate-200 transition hover:bg-white/10"
              aria-label="关闭命令面板"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-3 flex h-12 items-center gap-2 border border-white/15 bg-white px-3 text-slate-950">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={handleSearchInput}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="输入设置、动作、风险、状态"
              aria-label="搜索全局设置命令"
            />
            <span className="hidden items-center gap-1 border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
              <CornerDownLeft className="h-3.5 w-3.5" />
              执行
            </span>
          </label>
        </div>

        <div className="min-h-0 overflow-y-auto bg-[#f6f8fb] p-3">
          {showRecentStrip ? (
            <RecentCommandStrip
              items={recentItems.slice(0, RECENT_SETTINGS_OS_LIMIT)}
              onOpenRecent={onOpenRecent}
            />
          ) : null}

          {commands.length > 0 ? (
            <div className="grid gap-2" role="listbox" aria-label="设置命令结果">
              {React.Children.toArray(commands.map((command, index) => (
                <CommandResultButton
                  command={command}
                  active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onExecute(command)}
                />
              )))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <div className="text-sm font-semibold text-slate-900">没有匹配的设置命令</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                换一个关键词，或直接输入设置名、动作名、风险状态进行定位。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentCommandStrip({
  items,
  onOpenRecent,
}: {
  items: RecentSettingsOsItem[];
  onOpenRecent: (item: RecentSettingsOsItem) => void;
}) {
  return (
    <section
      data-settings-os="recent-command-strip"
      aria-label="最近访问，本页内存态"
      className="mb-3 border border-slate-200 bg-white p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-950 text-white">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">最近访问 / 最近动作</div>
            <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">
              本页内存态，不写入 storage；刷新后清空。
            </p>
          </div>
        </div>
        <span className="shrink-0 border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-[11px] font-semibold text-slate-500">
          最多 6 项
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {React.Children.toArray(items.map(item => {
            const Icon = getSettingsOsIcon(item.iconKey);

            return (
              <button
                type="button"
                data-settings-os="recent-command-item"
                onClick={() => onOpenRecent(item)}
                className="group flex min-w-0 items-start gap-2 border border-slate-200 bg-[#fbfcfe] px-2.5 py-2 text-left transition hover:border-cyan-300 hover:bg-white"
                aria-label={`打开最近项：${item.label}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${TONE_STYLES[item.tone].ring} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-slate-950">{item.label}</span>
                    <span className="shrink-0 border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {item.sourceLabel}
                    </span>
                  </span>
                  <span className="mt-1 block line-clamp-1 break-words text-[11px] leading-5 text-slate-500">
                    {item.route}
                  </span>
                </span>
              </button>
            );
          }))}
        </div>
      ) : (
        <div className="mt-2 border border-dashed border-slate-300 bg-[#fbfcfe] px-3 py-4 text-sm text-slate-500">
          暂无最近项。打开设置应用或执行命令后，会在这里生成本页快捷回到。
        </div>
      )}
    </section>
  );
}

function CommandResultButton({
  command,
  active,
  onMouseEnter,
  onClick,
}: {
  command: SettingsCommand;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = getSettingsOsIcon(command.iconKey);
  const executable = canExecuteSettingsCommand(command);

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      aria-disabled={!executable}
      onMouseEnter={onMouseEnter}
      onClick={executable ? onClick : undefined}
      className={`w-full border px-3 py-3 text-left transition ${
        active ? 'border-slate-950 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
      } ${
        executable ? '' : 'cursor-not-allowed bg-slate-50 text-slate-500'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center border ${TONE_STYLES[command.tone].ring} text-white`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-semibold text-slate-950">{command.label}</span>
            <span className={`border px-2 py-0.5 text-[11px] font-semibold ${TONE_STYLES[command.tone].chip}`}>
              {command.riskLabel}
            </span>
          </span>
          <span className="mt-1 block break-words text-xs leading-5 text-slate-600">{command.description}</span>
          <span className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-slate-600">{command.category}</span>
            <span className="border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-slate-600">{command.statusLabel}</span>
            <span className="border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-slate-600">{command.routeLabel}</span>
            <span className={`border px-2 py-1 ${
              executable ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {command.actionLabel}
            </span>
          </span>
        </span>
      </div>
    </button>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border border-slate-200 bg-[#fbfcfe] px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className="h-4 w-4 shrink-0 text-cyan-700" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-slate-950">{value}</div>
      <div className="mt-0.5 line-clamp-1 break-words text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function SettingsAppRail({
  apps,
  systemApps,
  activeTab,
  openApp,
  openSystemApp,
}: {
  apps: SettingsApp[];
  systemApps: SystemApp[];
  activeTab: TabKey;
  openApp: (app: SettingsApp) => void;
  openSystemApp: (app: SystemApp) => void;
}) {
  return (
    <aside className="min-h-0 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">设置发现区</h2>
            <p className="mt-1 text-xs text-slate-500">
              {apps.length} 个设置应用 / {systemApps.length} 个系统入口
            </p>
          </div>
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        </div>
      </div>

      <div className="max-h-[760px] overflow-y-auto p-3">
        <div>
          <SectionTitle
            label="设置应用"
            detail="原有 /settings/:tab 工作区"
            count={apps.length}
          />
          {apps.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {React.Children.toArray(apps.map(app => (
                <SettingsAppButton
                  app={app}
                  active={getAppTab(app) === activeTab}
                  onClick={() => openApp(app)}
                />
              )))}
            </div>
          ) : (
            <EmptyRailState label="没有匹配的设置项" />
          )}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <SectionTitle
            label="系统管理区"
            detail="后台能力入口，真实路由才可打开"
            count={systemApps.length}
          />
          {systemApps.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {React.Children.toArray(systemApps.map(app => (
                <SystemAppButton
                  app={app}
                  onClick={() => openSystemApp(app)}
                />
              )))}
            </div>
          ) : (
            <EmptyRailState label="没有匹配的系统入口" />
          )}
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({
  label,
  detail,
  count,
}: {
  label: string;
  detail: string;
  count: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
        <div className="mt-1 break-words text-xs text-slate-500">{detail}</div>
      </div>
      <span className="shrink-0 border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-[11px] font-semibold text-slate-600">
        {count} 项
      </span>
    </div>
  );
}

function EmptyRailState({ label }: { label: string }) {
  return (
    <div className="mt-2 border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function SettingsAppButton({
  app,
  active,
  onClick,
}: {
  app: SettingsApp;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = getSettingsOsIcon(app.iconKey);
  const entryCard = getSettingsAppEntryCard(app);
  const gateStyles = GATE_STYLES[entryCard.state];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full border px-3 py-3 text-left transition ${
        active
          ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-[#fbfcfe]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
            active
              ? 'border-white/20 bg-white text-slate-950'
              : `${TONE_STYLES[app.tone].ring} text-white`
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 break-words text-sm font-semibold">{app.label}</span>
            <span
              className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${
                active ? 'border-white/20 bg-white/10 text-white' : TONE_STYLES[app.tone].chip
              }`}
            >
              {entryCard.entryLabel}
            </span>
          </span>
          <span className={`mt-1 block break-words text-xs leading-5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
            {app.summary}
          </span>
          <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <span className={`h-2 overflow-hidden border ${active ? 'border-white/20 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
              <span
                className={`block h-full ${active ? 'bg-white' : TONE_STYLES[entryCard.tone].bar}`}
                style={{ width: `${entryCard.score}%` }}
              />
            </span>
            <span className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-700'}`}>
              {entryCard.score}%
            </span>
          </span>
          <span className="mt-2 grid gap-1.5 text-[11px] leading-5">
            <span className={`block min-w-0 break-words border px-2 py-1 ${
              active ? 'border-white/15 bg-white/10 text-slate-200' : 'border-slate-200 bg-[#fbfcfe] text-slate-600'
            }`}>
              <span className={`font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>任务：</span>
              {entryCard.primaryAction}
            </span>
            <span className={`block min-w-0 break-words border px-2 py-1 ${
              active ? 'border-white/15 bg-white/10 text-slate-200' : 'border-slate-200 bg-[#fbfcfe] text-slate-600'
            }`}>
              <span className={`font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>入口：</span>
              {entryCard.routeLabel} · {entryCard.secondaryAction}
            </span>
            <span className={`block min-w-0 break-words border px-2 py-1 ${active ? 'border-white/15 bg-white/10 text-slate-200' : gateStyles.badge}`}>
              <span className={`font-semibold ${active ? 'text-white' : ''}`}>门禁：</span>
              {entryCard.blocker}
            </span>
          </span>
        </span>
      </div>
    </button>
  );
}

function SystemAppButton({
  app,
  onClick,
}: {
  app: SystemApp;
  onClick: () => void;
}) {
  const Icon = getSettingsOsIcon(app.iconKey);
  const ready = app.status === 'ready';
  const statusClass = ready
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <button
      type="button"
      onClick={ready ? onClick : undefined}
      aria-disabled={!ready}
      className={`group w-full border px-3 py-3 text-left transition ${
        ready
          ? 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-[#fbfcfe]'
          : 'cursor-not-allowed border-amber-200 bg-amber-50/40 text-slate-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
          ready ? 'border-slate-300 bg-slate-950 text-white' : 'border-amber-200 bg-white text-amber-700'
        }`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words text-sm font-semibold">{app.label}</span>
            <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
              {app.statusLabel}
            </span>
          </span>
          <span className="mt-1 block break-words text-xs leading-5 text-slate-600">{app.summary}</span>
          <span className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="border border-slate-200 bg-white px-2 py-1 text-slate-600">{app.group}</span>
            <span className="border border-slate-200 bg-white px-2 py-1 text-slate-600">{app.owner}</span>
            <span className={`border px-2 py-1 ${ready ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : statusClass}`}>
              {app.route ?? '待路由契约 / 待挂载'}
            </span>
          </span>
          <span className="mt-2 block break-words text-[11px] leading-5 text-slate-500">{app.contract}</span>
        </span>
      </div>
    </button>
  );
}

function SettingsTaskWorkspace({
  app,
  component: ActiveComponent,
}: {
  app: SettingsApp;
  component: React.ComponentType;
}) {
  const [activeReleaseStepId, setActiveReleaseStepId] = useState<ReleasePipelineStepId>('draft');
  const [localNotice, setLocalNotice] = useState('');
  const health = useMemo(() => getSettingsAppHealth(app), [app]);
  const operationPulse = useMemo(() => getSettingsOperationPulse(app), [app]);
  const releasePipeline = useMemo(() => getReleasePipeline(app), [app]);
  const releasePreviewDiff = useMemo(() => getSettingsReleasePreviewDiff(app), [app]);
  const rollbackAnchor = useMemo(() => getRollbackAnchor(app), [app]);
  const activeReleaseStep =
    releasePipeline.find(step => step.id === activeReleaseStepId) ?? releasePipeline[0];

  useEffect(() => {
    setActiveReleaseStepId('draft');
    setLocalNotice('');
  }, [app.key]);

  const handleLocalRefresh = () => {
    setActiveReleaseStepId('impact');
    setLocalNotice(`已本地重算「${app.label}」影响校验视图；未请求网络、未写入发布状态。`);
  };

  const handlePreviewFocus = () => {
    setActiveReleaseStepId('preview');
    setLocalNotice(`已定位「${app.label}」发布预览阶段；仅展示发布前差异，不执行真实发布。`);
  };

  return (
    <main className="min-w-0 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-[#fbfcfe] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${TONE_STYLES[app.tone].chip}`}>
                {app.signal}
              </span>
              <span className="inline-flex items-center border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {app.phase}
              </span>
              <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${TONE_STYLES[health.tone].chip}`}>
                健康度 {health.score}% · {health.statusLabel}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{app.label}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{app.mission}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLocalRefresh}
              className="inline-flex h-9 items-center gap-2 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button
              type="button"
              onClick={handlePreviewFocus}
              className="inline-flex h-9 items-center gap-2 border border-slate-950 bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <ArrowUpRight className="h-4 w-4" />
              发布预览
            </button>
          </div>
        </div>
        {localNotice && (
          <div className="mt-3 border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold leading-5 text-cyan-900">
            {localNotice}
          </div>
        )}
      </div>

      <OperationPulseDeck pulses={operationPulse} />
      <ActionStrip app={app} />
      <ReleasePipelineWorkbench
        app={app}
        activeStep={activeReleaseStep}
        pipeline={releasePipeline}
        diffItems={releasePreviewDiff}
        rollbackAnchor={rollbackAnchor}
        onSelectStep={setActiveReleaseStepId}
      />
      <div className="min-w-0 overflow-hidden bg-white">
        <ActiveComponent />
      </div>
    </main>
  );
}

function OperationPulseDeck({ pulses }: { pulses: SettingsOperationPulseItem[] }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 px-4 py-4 text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-cyan-300/70" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:100%_12px] opacity-40" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-3 w-3 shrink-0 border border-cyan-200 bg-cyan-300 motion-safe:animate-pulse" />
            <h3 className="break-words text-sm font-semibold">操作脉冲 / human-in-the-loop telemetry</h3>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-slate-300">
            每个脉冲都绑定当前设置状态，只提示人工下一步、门禁、冻结入口和回滚契约，不触发发布或跳转。
          </p>
        </div>
        <span className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
          local signals only
        </span>
      </div>

      <div className="relative mt-4 grid gap-3 xl:grid-cols-4">
        {React.Children.toArray(pulses.map(pulse => {
          const gateStyles = GATE_STYLES[pulse.state];

          return (
            <div className="group min-w-0 border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/60 hover:bg-white/[0.06]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="break-words text-xs font-semibold uppercase text-slate-400">{pulse.label}</div>
                  <div className="mt-1 break-words text-sm font-semibold text-white">{pulse.value}</div>
                </div>
                <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${gateStyles.badge}`}>
                  {gateStyles.label}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-slate-300">{pulse.detail}</p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="h-1.5 overflow-hidden border border-white/10 bg-white/10">
                  <div
                    className={`h-full ${TONE_STYLES[pulse.tone].bar} transition-all duration-500 group-hover:brightness-110`}
                    style={{ width: `${pulse.progress}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-200">{pulse.progress}%</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className={`h-2 w-2 shrink-0 border ${TONE_STYLES[pulse.tone].ring}`} />
                <span className="min-w-0 break-words text-slate-400">{pulse.readiness}</span>
              </div>
            </div>
          );
        }))}
      </div>
    </section>
  );
}

function ActionStrip({ app }: { app: SettingsApp }) {
  return (
    <div className="grid gap-3 border-b border-slate-200 px-4 py-3 md:grid-cols-3">
      {React.Children.toArray(app.actions.map(action => (
        <div className="flex items-center gap-2 border border-slate-200 bg-[#fbfcfe] px-3 py-2 text-sm text-slate-700">
          <CheckCircle2 className={`h-4 w-4 ${TONE_STYLES[app.tone].text}`} />
          <span className="min-w-0 truncate">{action}</span>
        </div>
      )))}
    </div>
  );
}

function ReleasePipelineWorkbench({
  app,
  activeStep,
  pipeline,
  diffItems,
  rollbackAnchor,
  onSelectStep,
}: {
  app: SettingsApp;
  activeStep: ReleasePipelineItem;
  pipeline: ReleasePipelineItem[];
  diffItems: SettingsReleasePreviewDiffItem[];
  rollbackAnchor: RollbackAnchor;
  onSelectStep: (step: ReleasePipelineStepId) => void;
}) {
  const readiness = getReleaseReadiness(app);
  const activeStyles = GATE_STYLES[activeStep.state];

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-3 w-3 shrink-0 border ${TONE_STYLES[readiness.tone].ring} motion-safe:animate-pulse`} />
            <h3 className="break-words text-sm font-semibold text-slate-950">发布流水线 / 回滚工作台</h3>
            <span className={`border px-2 py-0.5 text-[11px] font-semibold ${GATE_STYLES[readiness.state].badge}`}>
              {readiness.label}
            </span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            本地安全编排：只切换详情视图，不调用后端、不写业务数据、不打开正式业务前台入口。
          </p>
        </div>
        <div className="min-w-[180px] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
          <div className="font-semibold text-slate-950">{rollbackAnchor.title}</div>
          <div className={`mt-1 inline-flex border px-2 py-0.5 text-[11px] font-semibold ${GATE_STYLES[rollbackAnchor.state].badge}`}>
            {rollbackAnchor.statusLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 2xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="grid gap-2 md:grid-cols-5">
          {React.Children.toArray(pipeline.map(step => {
            const selected = step.id === activeStep.id;
            const styles = GATE_STYLES[step.state];

            return (
              <button
                type="button"
                onClick={() => onSelectStep(step.id)}
                className={`min-h-[108px] min-w-0 border bg-white p-3 text-left transition hover:border-cyan-300 hover:ring-1 hover:ring-cyan-200 ${
                  selected ? 'border-slate-950 ring-1 ring-slate-950' : 'border-slate-200'
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-950">{step.label}</span>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[step.tone].ring}`} />
                </div>
                <div className={`mt-3 inline-flex max-w-full border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
                  <span className="truncate">{step.statusLabel}</span>
                </div>
                <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-slate-600">{step.detail}</p>
              </button>
            );
          }))}
        </div>

        <div className="min-w-0 border border-slate-950 bg-slate-950 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{activeStep.label}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-300">{activeStep.statusLabel}</div>
            </div>
            <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${activeStyles.badge}`}>
              {activeStyles.label}
            </span>
          </div>
          <div className="grid gap-3 p-3 text-xs leading-5 text-slate-300 sm:grid-cols-2">
            <div className="min-w-0">
              <div className="font-semibold text-white">阶段说明</div>
              <p className="mt-1 break-words">{activeStep.detail}</p>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white">审计证据</div>
              <p className="mt-1 break-words">{activeStep.auditEvidence}</p>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white">后端契约</div>
              <p className="mt-1 break-words">{activeStep.backendContract}</p>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white">风险原因</div>
              <p className="mt-1 break-words">{activeStep.riskReason}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <div className="break-words text-sm font-semibold text-slate-950">发布前差异预演</div>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              面向人工复核的 before / after 对照，只读展示 current、draft、impact、evidence 和禁止项。
            </p>
          </div>
          <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${TONE_STYLES[app.tone].chip}`}>
            {app.tone === 'contract' ? 'contract hold' : app.tone === 'attention' ? 'manual review' : 'local preview'}
          </span>
        </div>
        <div className="grid gap-2 p-3">
          {React.Children.toArray(diffItems.map(item => {
            const styles = GATE_STYLES[item.state];

            return (
              <div className="min-w-0 border border-slate-200 bg-[#fbfcfe] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[item.tone].ring}`} />
                      <div className="break-words text-sm font-semibold text-slate-950">{item.label}</div>
                    </div>
                    <div className="mt-1 break-all text-[11px] font-semibold text-slate-400">{item.id}</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
                    {styles.label}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 lg:grid-cols-2">
                  <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
                    <div className="font-semibold text-slate-950">current</div>
                    <p className="mt-1 break-words">{item.currentValue}</p>
                  </div>
                  <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
                    <div className="font-semibold text-slate-950">draft</div>
                    <p className="mt-1 break-words">{item.draftValue}</p>
                  </div>
                  <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
                    <div className="font-semibold text-slate-950">impact</div>
                    <p className="mt-1 break-words">{item.impact}</p>
                  </div>
                  <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
                    <div className="font-semibold text-slate-950">evidence</div>
                    <p className="mt-1 break-words">{item.evidence}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {React.Children.toArray(item.blockedActions.map(action => (
                    <span className="max-w-full break-words border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold leading-4 text-rose-700">
                      {action}
                    </span>
                  )))}
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </section>
  );
}

function SettingsInspector({ app }: { app: SettingsApp }) {
  const [activeAssistantModeId, setActiveAssistantModeId] = useState<AssistantModeId>('risk-triage');
  const [assistantNotice, setAssistantNotice] = useState('');
  const assistant = getAssistantBrief(app);
  const assistantModes = useMemo(() => getAssistantModeBriefs(app), [app]);
  const activeAssistantMode =
    assistantModes.find(mode => mode.id === activeAssistantModeId) ?? assistantModes[0]!;
  const topology = getImpactTopology(app);
  const releaseGates = getReleaseGates(app);
  const capabilityContracts = getSettingsCapabilityContracts(app);
  const capabilitySummary = getCapabilityContractSummary(app);
  const operatorPlaybook = getSettingsOperatorPlaybook(app);

  useEffect(() => {
    setActiveAssistantModeId('risk-triage');
    setAssistantNotice('');
  }, [app.key]);

  const handleAssistantChecklist = useCallback(() => {
    setAssistantNotice(
      `已生成「${activeAssistantMode.label}」本地清单；未请求网络、未写 storage、未发布，仅供人工复核。`,
    );
  }, [activeAssistantMode.label]);

  return (
    <aside className="min-h-0 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">AI 配置助手</h2>
            <p className="mt-1 text-xs text-slate-500">本地规则推理，无后端调用或真实 AI 请求</p>
          </div>
          <Sparkles className={`h-4 w-4 ${TONE_STYLES[app.tone].text}`} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="border border-slate-200 bg-[#fbfcfe] p-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center border ${TONE_STYLES[app.tone].ring} text-white`}>
              {React.createElement(getSettingsOsIcon(app.iconKey), { className: 'h-5 w-5' })}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-950">{assistant.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">{assistant.riskLabel}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="h-2 overflow-hidden border border-slate-200 bg-white">
              <div
                className={`h-full ${TONE_STYLES[app.tone].bar}`}
                style={{ width: `${assistant.confidence}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700">{assistant.confidence}%</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{assistant.recommendation}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{assistant.nextStep}</p>
        </div>

        <AssistantModeWorkbench
          modes={assistantModes}
          activeMode={activeAssistantMode}
          activeModeId={activeAssistantModeId}
          notice={assistantNotice}
          onSelectMode={setActiveAssistantModeId}
          onGenerateChecklist={handleAssistantChecklist}
        />

        <OperatorPlaybookPanel steps={operatorPlaybook} />

        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Activity className={`h-4 w-4 ${TONE_STYLES[app.tone].text}`} />
              当前上下文
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="text-sm font-semibold text-slate-950">{app.metric}</div>
            <p className="text-xs leading-5 text-slate-600">{app.summary}</p>
            <div className="flex flex-wrap gap-2">
              {React.Children.toArray(app.actions.map(action => (
                <span className="border border-slate-200 bg-[#fbfcfe] px-2 py-1 text-xs font-semibold text-slate-600">
                  {action}
                </span>
              )))}
            </div>
          </div>
        </div>

        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Layers3 className={`h-4 w-4 ${TONE_STYLES[app.tone].text}`} />
              动态影响拓扑
            </div>
          </div>
          <div className="p-3">
            <div className="space-y-2">
              {React.Children.toArray(topology.map((node, index) => (
                <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-3 w-3 border ${TONE_STYLES[node.tone].ring}`} />
                    {index < topology.length - 1 && <span className="mt-1 h-full min-h-8 w-px bg-slate-200" />}
                  </div>
                  <div className="border border-slate-200 bg-[#fbfcfe] px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">{node.label}</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-950">{node.value}</div>
                    <div className="mt-1 break-words text-xs leading-5 text-slate-600">{node.detail}</div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>

        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ShieldCheck className={`h-4 w-4 ${TONE_STYLES[app.tone].text}`} />
                能力契约
              </div>
              <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  ready {capabilitySummary.ready}
                </span>
                <span className="border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-cyan-800">
                  contract {capabilitySummary.contract}
                </span>
                <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                  blocked {capabilitySummary.blocked}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2 p-3">
            {React.Children.toArray(capabilityContracts.map(contract => (
              <div className="border border-slate-200 bg-[#fbfcfe] px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-slate-950">{contract.label}</div>
                    <div className="mt-0.5 break-words text-[11px] leading-4 text-slate-500">{contract.surface}</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${TONE_STYLES[contract.tone].chip}`}>
                    {contract.statusLabel}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2">
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-slate-700">数据源：</span>{contract.dataSource}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-slate-700">后端契约：</span>{contract.backendContract}
                  </p>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                  {contract.safetyNotes[0] ?? contract.blockedActions[0]}
                </p>
              </div>
            )))}
          </div>
        </div>

        <div className="border border-slate-200 bg-slate-950 text-white">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              发布门禁
            </div>
          </div>
          <div className="space-y-2 p-3">
            {React.Children.toArray(releaseGates.map(gate => {
              const styles = GATE_STYLES[gate.state];

              return (
                <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center border ${styles.icon}`}>
                        {gate.state === 'pass' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="break-words text-sm font-semibold">{gate.label}</span>
                    </div>
                    <span className={`border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
                      {styles.label}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-xs leading-5 text-slate-300">{gate.detail}</p>
                </div>
              );
            }))}
          </div>
        </div>

        <div className="space-y-2">
          {React.Children.toArray(app.inspector.map(item => (
            <div className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600">
              {item}
            </div>
          )))}
        </div>
      </div>
    </aside>
  );
}

function AssistantModeWorkbench({
  modes,
  activeMode,
  activeModeId,
  notice,
  onSelectMode,
  onGenerateChecklist,
}: {
  modes: AssistantModeBrief[];
  activeMode: AssistantModeBrief;
  activeModeId: AssistantModeId;
  notice: string;
  onSelectMode: (modeId: AssistantModeId) => void;
  onGenerateChecklist: () => void;
}) {
  const activeStyles = GATE_STYLES[activeMode.state];
  const nextActionText = activeMode.nextAction.replace(/^下一步[:：]\s*/, '');

  return (
    <div data-settings-os="assistant-mode-workbench" className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Sparkles className={`h-4 w-4 ${TONE_STYLES[activeMode.tone].text}`} />
              场景建议器
            </div>
            <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">
              风险、影响、发布和回滚四种本地建议，不请求网络、不写入配置。
            </p>
          </div>
          <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${activeStyles.badge}`}>
            {activeStyles.label}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div data-settings-os="assistant-mode-tabs" className="grid gap-1.5 sm:grid-cols-2">
          {React.Children.toArray(modes.map(mode => {
            const selected = mode.id === activeModeId;

            return (
              <button
                type="button"
                data-settings-os="assistant-mode-button"
                onClick={() => onSelectMode(mode.id)}
                className={`min-h-[72px] min-w-0 border px-2.5 py-2 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40 ${
                  selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-[#fbfcfe] text-slate-700'
                }`}
                aria-pressed={selected}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block break-words text-xs font-semibold">{mode.label}</span>
                    <span className={`mt-1 block line-clamp-2 break-words text-[11px] leading-4 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {mode.description}
                    </span>
                  </span>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 border ${TONE_STYLES[mode.tone].ring}`} />
                </span>
              </button>
            );
          }))}
        </div>

        <div className="border border-slate-200 bg-[#fbfcfe] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="break-words text-sm font-semibold text-slate-950">{activeMode.question}</div>
              <p className="mt-1 break-words text-xs leading-5 text-slate-600">{activeMode.recommendation}</p>
            </div>
            <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${TONE_STYLES[activeMode.tone].chip}`}>
              {activeMode.label}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
            <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
              <span className="font-semibold text-slate-800">下一步：</span>
              <span className="break-words">{nextActionText}</span>
            </div>
            <div className="min-w-0 border border-slate-200 bg-white px-3 py-2">
              <span className="font-semibold text-slate-800">证据：</span>
              <span className="break-words">{activeMode.evidence}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {React.Children.toArray(activeMode.blockedActions.slice(0, 5).map(action => (
              <span className="max-w-full break-words border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold leading-4 text-rose-700">
                {action}
              </span>
            )))}
          </div>

          <button
            type="button"
            data-settings-os="assistant-local-plan"
            onClick={onGenerateChecklist}
            className="mt-3 inline-flex min-h-9 max-w-full items-center gap-2 border border-slate-950 bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            <ScrollText className="h-4 w-4 shrink-0" />
            <span className="break-words">生成本地清单</span>
          </button>

          {notice ? (
            <div
              data-settings-os="assistant-local-notice"
              className="mt-3 border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold leading-5 text-cyan-900"
            >
              {notice}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OperatorPlaybookPanel({ steps }: { steps: SettingsOperatorPlaybookStep[] }) {
  return (
    <div className="border border-slate-200 bg-slate-950 text-white">
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-cyan-300" />
              操作剧本
            </div>
            <p className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-slate-400">
              人工执行清单，仅解释本地设置状态，不发布、不回滚、不写入正式入口。
            </p>
          </div>
          <span className="shrink-0 border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
            local
          </span>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {React.Children.toArray(steps.map((step, index) => {
          const styles = GATE_STYLES[step.state];

          return (
            <div className="grid min-h-[116px] grid-cols-[28px_minmax(0,1fr)] gap-2 border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="flex flex-col items-center">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[11px] font-semibold ${styles.icon}`}>
                  {index + 1}
                </span>
                {index < steps.length - 1 && <span className="mt-2 h-full min-h-8 w-px bg-white/10" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold">{step.label}</div>
                    <div className="mt-0.5 break-words text-[11px] uppercase tracking-[0.12em] text-slate-500">{step.id}</div>
                  </div>
                  <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
                    {styles.label}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-slate-200">{step.task}</p>
                <p className="mt-1 line-clamp-2 break-words text-[11px] leading-5 text-slate-400">{step.detail}</p>
                <div className="mt-2 grid gap-2 text-[11px] leading-4 text-slate-300 sm:grid-cols-2">
                  <div className="min-w-0 border border-white/10 bg-white/[0.04] px-2 py-1.5">
                    <span className="font-semibold text-white">证据：</span>
                    <span className="break-words">{step.evidence}</span>
                  </div>
                  <div className="min-w-0 border border-white/10 bg-white/[0.04] px-2 py-1.5">
                    <span className="font-semibold text-white">禁止：</span>
                    <span className="break-words">{step.blockedActions.slice(0, 2).join(' / ')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}
