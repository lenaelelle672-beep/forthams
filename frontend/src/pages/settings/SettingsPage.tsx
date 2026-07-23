/**
 * @file pages/settings/SettingsPage.tsx
 * @description Settings route redirect.
 *
 * Maps a settings tab to the legacy workbench menu and redirects there.
 * The historical tabbed Settings OS workspace has been removed.
 */

import { Navigate, useParams } from 'react-router';
import { getValidTab, type TabKey } from './settingsOsRegistry';

const SETTINGS_WORKBENCH_MENU_BY_TAB: Record<TabKey, string> = {
  sysconfig: 'system-base-params',
  numbering: 'system-numbering-rules',
  'notif-pref': 'system-notification-preferences',
  'notif-template': 'system-notification-templates',
  'notif-channel': 'system-notification-channels',
  'notif-switch': 'system-workflow-notification-switch',
  'mail-template': 'system-mail-templates',
  'mail-log': 'system-mail-logs',
  webhook: 'system-webhook-config',
  'sla-config': 'system-sla-config',
};

export default function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = getValidTab(tab);
  const menuId = SETTINGS_WORKBENCH_MENU_BY_TAB[activeTab] ?? 'system-flow-definition';

  return <Navigate to={`/fixed-assets/workbench?menu=${menuId}`} replace />;
}
