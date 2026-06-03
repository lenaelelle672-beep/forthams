/**
 * @file pages/settings/SettingsPage.tsx
 * @description 系统设置页面 — Tab 导航中心
 *
 * Tab 分组：
 *   系统参数 | 编号规则 | 通知偏好 | 通知模板 | 通知渠道 |
 *   流程通知开关 | 邮件模板 | 邮件日志 | Webhook 配置
 *
 * 每个 Tab 由独立文件懒加载，SettingsPage 仅负责导航和路由映射。
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Settings2, Hash, Bell, FileText, Radio, ToggleLeft,
  Mail, ScrollText, Webhook, Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

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

// ─── 类型定义 ───────────────────────────────────────────────────────────────

type TabKey =
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

/** Tab 分组定义 */
interface TabGroup {
  label: string;
  tabs: { key: TabKey; label: string; icon: React.ReactNode }[];
}

// ─── Tab 分组配置 ────────────────────────────────────────────────────────────

const TAB_GROUPS: TabGroup[] = [
  {
    label: '系统',
    tabs: [
      { key: 'sysconfig',      label: '系统参数',   icon: <Settings2 className="w-4 h-4" /> },
      { key: 'numbering',      label: '编号规则',   icon: <Hash className="w-4 h-4" /> },
      { key: 'sla-config',     label: 'SLA 配置',   icon: <Clock className="w-4 h-4" /> },
    ],
  },
  {
    label: '通知',
    tabs: [
      { key: 'notif-pref',     label: '通知偏好',   icon: <Bell className="w-4 h-4" /> },
      { key: 'notif-template', label: '通知模板',   icon: <FileText className="w-4 h-4" /> },
      { key: 'notif-channel',  label: '通知渠道',   icon: <Radio className="w-4 h-4" /> },
      { key: 'notif-switch',   label: '流程通知开关', icon: <ToggleLeft className="w-4 h-4" /> },
    ],
  },
  {
    label: '邮件',
    tabs: [
      { key: 'mail-template',  label: '邮件模板',   icon: <Mail className="w-4 h-4" /> },
      { key: 'mail-log',       label: '邮件日志',   icon: <ScrollText className="w-4 h-4" /> },
    ],
  },
  {
    label: '集成',
    tabs: [
      { key: 'webhook',        label: 'Webhook 配置', icon: <Webhook className="w-4 h-4" /> },
    ],
  },
];

/** 全量 Tab Key → 组件映射 */
const TAB_COMPONENTS: Record<TabKey, React.LazyExoticComponent<React.ComponentType> | React.ComponentType> = {
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

/** 所有有效 Tab Key */
const ALL_TAB_KEYS: TabKey[] = TAB_GROUPS.flatMap(g => g.tabs.map(t => t.key));

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const activeTab: TabKey =
    tab && ALL_TAB_KEYS.includes(tab as TabKey) ? (tab as TabKey) : 'sysconfig';

  const handleTabChange = (key: TabKey) => {
    navigate(`/settings/${key}`, { replace: true });
  };

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? SysConfigTab;

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">系统设置</h1>
              <p className="mt-1 text-sm text-slate-500">
                集中维护系统参数、编号规则、通知渠道、邮件模板与 Webhook 集成
              </p>
            </div>
          </div>

          {/* ── Grouped tab navigation (inside header section) ──────── */}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-0.5">
              {TAB_GROUPS.map((group, gi) => (
                <React.Fragment key={group.label}>
                  {/* Group label */}
                  <span className="inline-flex items-center px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    {group.label}
                  </span>
                  {group.tabs.map(tabInfo => {
                    const isActive = activeTab === tabInfo.key;
                    return (
                      <button
                        key={tabInfo.key}
                        onClick={() => handleTabChange(tabInfo.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          isActive
                            ? 'border border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-slate-400'}>
                          {tabInfo.icon}
                        </span>
                        {tabInfo.label}
                      </button>
                    );
                  })}
                  {/* Group divider */}
                  {gi < TAB_GROUPS.length - 1 && (
                    <span className="inline-block w-px h-5 bg-slate-200 mx-1.5" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tab content ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <ActiveComponent />
        </Card>

      </div>
    </div>
  );
}
