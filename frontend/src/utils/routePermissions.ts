type PermissionUser = {
  roles?: string[];
  permissions?: string[];
} | null | undefined;

type RoutePermissionRule = {
  prefix?: string;
  exact?: string;
  any: string[];
};

const SUPER_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  { prefix: '/fixed-assets/workbench', any: ['dashboard:query', 'asset:ledger:query'] },
  { prefix: '/dashboard', any: ['dashboard:query'] },
  { exact: '/analytics/reliability', any: ['analytics:reliability:query'] },
  { exact: '/analytics/tco', any: ['tco:query'] },
  { exact: '/analytics/health', any: ['asset:query'] },
  { exact: '/asset-health', any: ['asset:query'] },
  { prefix: '/analytics', any: ['stats:query', 'dashboard:query'] },
  { prefix: '/system/users', any: ['system:user:list', 'system:user:query'] },
  { prefix: '/system/roles', any: ['system:role:list', 'system:role:query'] },
  { prefix: '/system/menus', any: ['system:menu:list', 'system:menu:query'] },
  { prefix: '/system/depts', any: ['system:dept:list', 'system:dept:query'] },
  { prefix: '/system/posts', any: ['system:post:list', 'system:post:query'] },
  { prefix: '/system/custom-fields', any: ['custom:field:query'] },
  { prefix: '/system/custom-fieldsets', any: ['custom:fieldset:query'] },
  { prefix: '/settings/notif-pref', any: ['notification:preference:list'] },
  { prefix: '/settings/notif-template', any: ['notification:template:list'] },
  { prefix: '/settings/notif-channel', any: ['channel:config:list'] },
  { prefix: '/settings/notif-switch', any: ['notification:switch:list'] },
  { prefix: '/settings/mail-template', any: ['mail:template:list'] },
  { prefix: '/settings/mail-log', any: ['mail:log:list'] },
  { prefix: '/settings/webhook', any: ['system:config:query', 'system:config:edit'] },
  { prefix: '/settings', any: ['system:config', 'system:config:query'] },
  { prefix: '/settings-v2/mail-template', any: ['mail:template:list'] },
  { prefix: '/settings-v2', any: ['system:config', 'system:config:query'] },
  { exact: '/workflows', any: ['workflow:definition:query'] },
  { prefix: '/workflow-designer', any: ['workflow:definition:edit'] },
  { prefix: '/workflow-form', any: ['workflow:definition:query'] },
  { exact: '/assets/new', any: ['asset:ledger:create'] },
  { prefix: '/assets/import-export', any: ['asset:ledger:query', 'asset:ledger:create'] },
  { prefix: '/assets', any: ['asset:ledger:query'] },
  { prefix: '/asset-models', any: ['asset:model:query'] },
  { prefix: '/equipment', any: ['asset:query'] },
  { prefix: '/categories', any: ['asset:category:query'] },
  { prefix: '/manufacturers', any: ['manufacturer:query'] },
  { prefix: '/maintenance', any: ['asset:maintenance:query', 'asset:maintenance:execution:query'] },
  { prefix: '/fault-codes', any: ['fault-code:query'] },
  { prefix: '/spare-parts', any: ['inventory:sparepart:query'] },
  { prefix: '/inventory/abc-classification', any: ['abc:query'] },
  { prefix: '/inventory/cycle-count', any: ['cycle-count:query'] },
  { prefix: '/inventory', any: ['inventory:query', 'stocktaking:cycle:query'] },
  { prefix: '/stocktaking-cycles', any: ['stocktaking:cycle:query'] },
  { prefix: '/idle', any: ['idle:query'] },
  { prefix: '/depreciation', any: ['depreciation:query'] },
  { prefix: '/revaluations', any: ['revaluation:query'] },
  { prefix: '/budgets', any: ['budget:query'] },
  { prefix: '/assignments', any: ['asset:assignment:query'] },
  { prefix: '/borrows', any: ['asset:borrow:query'] },
  { prefix: '/intake', any: ['asset:intake:query'] },
  { prefix: '/workorders', any: ['workorder:order:query'] },
  { prefix: '/approvals', any: ['approval:process:query'] },
  { prefix: '/purchase-orders', any: ['purchase:order:query'] },
  { prefix: '/contracts', any: ['contract:query'] },
  { prefix: '/gis', any: ['location:query', 'asset:query'] },
  { prefix: '/floorplans', any: ['asset:query'] },
  { prefix: '/energy', any: ['asset:query'] },
  { prefix: '/licenses', any: ['license:query'] },
  { prefix: '/sam', any: ['license:query'] },
  { prefix: '/disposals/transfer', any: ['disposal:transfer'] },
  { prefix: '/disposals/clearance', any: ['disposal:clearance'] },
  { prefix: '/disposals/scrap', any: ['disposal:scrap'] },
  { prefix: '/disposals', any: ['disposal:query', 'asset:retirement:query'] },
  { prefix: '/compensation', any: ['compensation:query'] },
  { prefix: '/insurances', any: ['insurance:list:query'] },
  { prefix: '/inspection-templates', any: ['inspection:template:query'] },
  { prefix: '/inspection-records', any: ['inspection:record:query'] },
  { prefix: '/inspections', any: ['inspection:query'] },
  { prefix: '/risk-assessments', any: ['risk:query'] },
  { prefix: '/risk-matrix', any: ['risk:matrix:query'] },
  { prefix: '/safety-checklists/history', any: ['safety:history'] },
  { prefix: '/safety-checklists/execute', any: ['safety:execute'] },
  { prefix: '/safety-checklists/config', any: ['safety:query'] },
  { prefix: '/reports/scheduled', any: ['scheduled-report:query'] },
  { prefix: '/report-builder', any: ['saved-report:query'] },
  { prefix: '/reports', any: ['report:query'] },
  { prefix: '/notifications', any: ['notification:query'] },
  { prefix: '/test-results', any: ['asset:query'] },
  { prefix: '/bigscreen-3d', any: ['bigscreen:query'] },
  { prefix: '/bigscreen', any: ['bigscreen:query'] },
  { prefix: '/audit', any: ['audit:query'] },
  { prefix: '/locations', any: ['location:query'] },
  { prefix: '/vendors', any: ['vendor:vendor:query'] },
  { prefix: '/abc', any: ['abc:query'] },
];

function normalizePath(path: string) {
  const pathname = path.split(/[?#]/)[0] || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function hasSuperRole(user: PermissionUser) {
  return (user?.roles ?? []).some((role) => SUPER_ROLES.has(role.toUpperCase()));
}

function findRule(path: string) {
  const normalized = normalizePath(path);
  return ROUTE_PERMISSION_RULES.find((rule) => {
    if (rule.exact) {
      return normalizePath(rule.exact) === normalized;
    }
    if (rule.prefix) {
      return normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`);
    }
    return false;
  });
}

export function canAccessRoute(path: string, user: PermissionUser) {
  if (!user || hasSuperRole(user)) {
    return true;
  }

  const permissions = user.permissions ?? [];
  if (permissions.length === 0) {
    return true;
  }

  const rule = findRule(path);
  if (!rule) {
    return true;
  }

  return rule.any.some((permission) => permissions.includes(permission));
}
