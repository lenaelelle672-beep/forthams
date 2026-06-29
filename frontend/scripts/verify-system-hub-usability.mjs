import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(frontendRoot, '..');

const workspacePagePath = path.join(frontendRoot, 'src/pages/workspace-preview/WorkspacePreviewPage.tsx');
const workspaceStylesPath = path.join(frontendRoot, 'src/pages/workspace-preview/WorkspacePreviewPage.css');
const appLayoutPath = path.join(frontendRoot, 'src/layouts/AppLayout.tsx');
const smokePath = path.join(frontendRoot, 'src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts');
const manifestPath = path.join(
  frontendRoot,
  'public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-usability-subpages-manifest.json',
);

const workspacePage = readFileSync(workspacePagePath, 'utf8');
const workspaceStyles = readFileSync(workspaceStylesPath, 'utf8');
const appLayout = readFileSync(appLayoutPath, 'utf8');
const smoke = readFileSync(smokePath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const failures = [];
const notes = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function repoFile(relativePath) {
  return path.join(repoRoot, relativePath);
}

function publicAssetFile(publicPath) {
  return path.join(frontendRoot, 'public', publicPath.replace(/^\//, ''));
}

function collectSystemMenus() {
  const menuRegex = /createSystemMenuItem\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
  return Array.from(workspacePage.matchAll(menuRegex), ([, id, group, label]) => ({ id, group, label }));
}

const menus = collectSystemMenus();
const menuIds = new Set(menus.map((menu) => menu.id));
const formalEntries = manifest.subpages.filter((entry) => menuIds.has(entry.menuId));
const navigationEntry = manifest.subpages.find((entry) => entry.menuId === 'system-hub-navigation-console');

const expectedGroupCounts = {
  '流程平台': 9,
  '组织权限': 8,
  '基础资料': 6,
  '集成配置': 5,
  '消息与通知': 8,
  '系统参数': 8,
};

assert(menus.length === 44, `expected 44 formal System Hub menus, got ${menus.length}`);
assert(formalEntries.length === menus.length, `expected ${menus.length} formal manifest entries, got ${formalEntries.length}`);
assert(navigationEntry, 'expected the non-menu navigation-console delivery entry to remain in manifest');
assert(workspacePage.includes('function WorkbenchSystemHubDesignBridge'), 'System Hub must render the overall navigation-console design bridge');
assert(workspacePage.includes('systemHubNavigationConsoleVisual'), 'System Hub design bridge must reference the navigation console IMAGE2 asset');
assert(workspacePage.includes('systemHubNavigationConsoleStitchVisual'), 'System Hub design bridge must reference the navigation console Stitch asset');
assert(workspacePage.includes('aria-label="系统运营中枢整体设计承接"'), 'System Hub design bridge must expose a stable accessibility label');
assert(workspacePage.includes('aria-label="系统运营中枢总图与当前分组设计图"'), 'System Hub design bridge must render overall and group visual assets');

for (const [group, count] of Object.entries(expectedGroupCounts)) {
  const actual = menus.filter((menu) => menu.group === group).length;
  assert(actual === count, `expected ${group} to contain ${count} menus, got ${actual}`);
}

for (const menu of menus) {
  const entry = formalEntries.find((candidate) => candidate.menuId === menu.id);
  assert(entry, `${menu.label} (${menu.id}) is missing from the delivery manifest`);
  if (!entry) {
    continue;
  }

  assert(entry.label === menu.label, `${menu.id} label mismatch: manifest=${entry.label}, page=${menu.label}`);
  assert(entry.image2?.status === 'complete', `${menu.label} IMAGE2 status should be complete`);
  assert(entry.stitch?.status === 'ready', `${menu.label} Stitch status should be ready and connected to the Workbench matrix`);
  assert(existsSync(publicAssetFile(entry.image2?.path ?? '')), `${menu.label} IMAGE2 asset is missing: ${entry.image2?.path}`);
  assert(existsSync(publicAssetFile(entry.stitch?.path ?? '')), `${menu.label} Stitch asset is missing: ${entry.stitch?.path}`);
  assert(existsSync(repoFile(entry.promptFile)), `${menu.label} Stitch prompt is missing: ${entry.promptFile}`);

  const interactionText = (entry.interaction ?? []).join(' / ');
  const acceptanceText = (entry.acceptance ?? []).join(' / ');
  assert(/保存/.test(interactionText), `${menu.label} manifest interaction must include save`);
  assert(/提交|复核|校验|发布/.test(interactionText), `${menu.label} manifest interaction must include submit/review/check/publish`);
  assert(/真人模拟/.test(acceptanceText), `${menu.label} manifest acceptance must require real user simulation`);
  assert(/当前页|同屏|页面内容区/.test(acceptanceText), `${menu.label} manifest acceptance must keep the operation in the current page`);
  assert(/不得|不能复用|不打开通用|不复用通用|通用占位/.test(acceptanceText), `${menu.label} manifest acceptance must reject generic placeholder fallback`);

  if (existsSync(repoFile(entry.promptFile))) {
    const prompt = readFileSync(repoFile(entry.promptFile), 'utf8');
    for (const requiredText of [
      '顶部业务视角和左侧导航不得放搜索框',
      '搜索/筛选只能出现在当前专属页面内容区',
      '可真人模拟的保存草稿动作',
      '可真人模拟的提交校验/发布复核动作',
      '不得复用通用占位模板',
    ]) {
      assert(prompt.includes(requiredText), `${menu.label} prompt is missing hard requirement: ${requiredText}`);
    }
  }
}

const forbiddenNavigationSearchMarkers = [
  'workspace-system-nav-search',
  'workspace-system-nav-console',
  'workspace-system-nav-quick',
  'workspace-side-search',
  'workspace-flow-node-palette-search',
  'aria-label="搜索系统配置菜单"',
  'aria-label="搜索节点模板"',
  'handleWorkbenchSearch',
  'title="资产运营搜索"',
  'aria-label="运营首页搜索"',
];

const forbiddenAppLayoutSearchMarkers = [
  "import GlobalSearch from '@/components/GlobalSearch'",
  '<GlobalSearch',
  '搜索...',
  'aria-label="搜索"',
];

for (const marker of forbiddenAppLayoutSearchMarkers) {
  assert(!appLayout.includes(marker), `AppLayout navigation shell search marker should not exist: ${marker}`);
}

for (const marker of forbiddenNavigationSearchMarkers) {
  assert(!workspacePage.includes(marker), `navigation shell search marker should not exist in page source: ${marker}`);
  assert(!workspaceStyles.includes(marker.replace(/^\./, '')), `navigation shell search marker should not exist in styles: ${marker}`);
}

const dedicatedRoutingMarkers = [
  'WorkbenchFlowPlatformProductPage',
  'WorkbenchOrganizationPermissionConfigurator',
  'WorkbenchHandoverConfigurator',
  'WorkbenchMasterDataConfigurator',
  'WorkbenchNumberingRuleConfigurator',
  'WorkbenchCustomFieldConfigurator',
  'WorkbenchExternalSystemConfigurator',
  'WorkbenchIntegrationWorkspaceConfigurator',
  'WorkbenchMailGatewayConfigurator',
  'WorkbenchNotificationConfigurator',
  'WorkbenchMailLogConfigurator',
  'WorkbenchWorkflowNotificationSwitchConfigurator',
  'WorkbenchSystemParameterConfigurator',
  'WorkbenchAuditLogConfigurator',
];

for (const marker of dedicatedRoutingMarkers) {
  assert(workspacePage.includes(marker), `dedicated System Hub branch is missing: ${marker}`);
}

const smokeCoverageTitles = [
  '系统运营中枢切换为系统配置左侧导航并可回到业务视角',
  '系统配置专属页内搜索直接过滤配置对象',
  '消息与通知专用配置台支持邮件模板新建保存提交',
  '消息通知配置页均可新建保存提交',
  '导航控制台页支持当前页新建保存提交',
  '系统运营中枢全量配置页均落到 Future OS iframe 页面',
  '系统运营中枢薄弱配置页搜索下沉到专属页面',
  '基础资料主数据页均可新建保存提交',
  '流程设计器在窄屏下保持大画布建模态',
  '表单配置在窄屏下保持设计画布与H5预览可读',
  '审批规则在窄屏下保持命中编排和门禁矩阵可读',
];

for (const title of smokeCoverageTitles) {
  assert(smoke.includes(title), `smoke coverage title is missing: ${title}`);
}

const smokeContractMarkers = [
  'const systemHtmlPageContracts',
  'expectFutureSystemFrameContract',
  'expectFutureSettingsNavigationCenter',
  'futureMenuContracts',
  'futureSearchContracts',
  'masterDataContracts',
  'notificationContracts',
  'systemHtmlFrameBody',
  'page.setViewportSize({ width: 794, height: 890 })',
];

for (const marker of smokeContractMarkers) {
  assert(smoke.includes(marker), `smoke contract marker is missing: ${marker}`);
}

const smokeMenuCoverage = [
  'system-flow-definition',
  'system-settings-command-center',
  'system-runtime-monitor',
  'system-approval-rules',
  'system-sla-config',
  'system-user-management',
  'system-role-permissions',
  'system-menu-permissions',
  'system-dept-org',
  'system-post-management',
  'system-data-permissions',
  'system-handover',
  'system-tenant-management',
  'system-asset-category',
  'system-numbering-rules',
  'system-location-management',
  'system-vendor-management',
  'system-custom-fields',
  'system-custom-field-sets',
  'system-external-systems',
  'system-interfaces',
  'system-field-mapping',
  'system-sync-rules',
  'system-webhook-config',
  'system-workflow-mail',
  'system-mail-templates',
  'system-mail-logs',
  'system-notification-templates',
  'system-notification-channels',
  'system-notification-preferences',
  'system-workflow-notification-switch',
  'system-base-params',
  'system-security-policy',
  'system-file-storage',
  'system-import-export',
  'system-cache-management',
  'system-audit-log',
  'system-doc-center',
  'system-tech-support',
];

for (const menuId of smokeMenuCoverage) {
  assert(menuIds.has(menuId), `${menuId} smoke coverage target is not a formal System Hub menu`);
  assert(smoke.includes(menuId), `${menuId} is missing from current smoke coverage`);
}
assert(new Set(smokeMenuCoverage).size === smokeMenuCoverage.length, 'smoke menu coverage menu ids must be unique');

assert(workspacePage.includes('aria-label="流程设计器页面搜索"'), 'Flow designer must provide page-local search in the dedicated canvas toolbar, not above navigation or node palette');
assert(!workspacePage.includes('aria-label="节点库搜索"'), 'Flow designer node palette must not expose its own search textbox');
assert(workspacePage.includes("hasDedicatedSystemConfigurator ? 'is-dedicated-configurator' : ''"), 'dedicated System Hub pages must declare a full-width configurator class');
assert(workspaceStyles.includes('.workspace-system-page.is-dedicated-configurator .workspace-system-module-board'), 'dedicated System Hub pages must override the generic module-board grid');
assert(workspaceStyles.includes('.workspace-system-page.is-dedicated-configurator .workspace-system-detail'), 'dedicated System Hub pages must move design/audit support out of the primary work area');
assert(workspacePage.includes('aria-label="角色成员清单"'), 'role permissions must render a member directory instead of only a role summary');
assert(workspacePage.includes('aria-label="搜索角色成员"'), 'role member directory must provide page-local member search');
assert(workspacePage.includes('runRoleMemberAction'), 'role member directory must provide member-level actions');
assert(workspacePage.includes('用户授权任务清单'), 'user management must render a user-level grant task queue');
assert(workspacePage.includes('aria-label="搜索用户授权任务"'), 'user grant task queue must provide page-local search');
assert(workspacePage.includes('runUserGrantTaskAction'), 'user grant task queue must provide grant/revoke/handover actions');
assert(workspacePage.includes('aria-label="数据权限命中用户清单"'), 'data permissions must render a subject directory instead of only a rule matrix');
assert(workspacePage.includes('aria-label="搜索数据权限命中用户"'), 'data permission subject directory must provide page-local subject search');
assert(workspacePage.includes('runDataSubjectAction'), 'data permission subject directory must provide member-level actions');
assert(workspacePage.includes('交接对象处理清单'), 'work handover must render object-level task queue instead of only batch/scope summary');
assert(workspacePage.includes('aria-label="交接对象搜索"'), 'work handover object queue must provide page-local object search');
assert(workspacePage.includes('runHandoverObjectAction'), 'work handover object queue must provide object-level confirm/dispatch/skip actions');
assert(workspacePage.includes('异常重放任务清单'), 'sync rules must render an object-level replay task queue');
assert(workspacePage.includes('aria-label="同步异常任务搜索"'), 'sync rule replay task queue must provide page-local search');
assert(workspacePage.includes('runIntegrationReplayTaskAction'), 'sync rule replay task queue must provide row-level replay/lock/manual actions');
assert(workspacePage.includes('const runCacheManagementWarmupDrill = () =>'), 'cache management must expose a warmup drill action');
assert(workspacePage.includes('const runCacheManagementConsistencyCheck = () =>'), 'cache management must expose a consistency check action');
assert(workspacePage.includes('高危操作复核队列'), 'security policy must render a high-risk operation review queue');
assert(workspacePage.includes('aria-label="高危操作复核任务搜索"'), 'security policy queue must provide page-local search');
assert(workspacePage.includes('runSecurityRiskTaskAction'), 'security policy queue must provide row-level review/approve/lock actions');
assert(workspacePage.includes('缓存异常恢复任务清单'), 'cache management must render a row-level recovery task list');
assert(workspacePage.includes('aria-label="缓存异常任务搜索"'), 'cache management recovery queue must provide page-local task search');
assert(workspacePage.includes('runCacheRecoveryTaskAction'), 'cache management recovery queue must provide row-level replay/lock/rollback actions');
assert(workspacePage.includes('const openParameterPublishAuditTrail = () =>'), 'system parameter pages must expose page-local publish audit action');
assert(workspacePage.includes('workspace-system-parameter-audit-ledger'), 'system parameter pages must render an in-page publish audit ledger');
assert(workspacePage.includes('发布审计已展开'), 'system parameter publish audit must write in-page feedback');
assert(workspacePage.includes('文件处理异常队列'), 'file storage config must render a row-level file processing exception queue');
assert(workspacePage.includes('aria-label="文件处理异常任务搜索"'), 'file storage exception queue must provide page-local task search');
assert(workspacePage.includes('runFileStorageTaskAction'), 'file storage exception queue must provide row-level retry/quarantine/archive actions');
assert(workspacePage.includes('导入导出异步任务队列'), 'import/export config must render an async task queue, not only template fields');
assert(workspacePage.includes('aria-label="导入导出任务搜索"'), 'import/export async queue must provide page-local task search');
assert(workspacePage.includes('runImportExportQueueAction'), 'import/export async queue must provide row-level retry/pause/evidence actions');
assert(workspacePage.includes('const runAccessConnectionTest = () =>'), 'external system page must expose page-local connection test');
assert(workspacePage.includes('const openAccessAuthPolicy = () =>'), 'external system page must expose page-local auth policy check');
assert(workspacePage.includes('const runAccessSyncDryRun = () =>'), 'external system page must expose page-local sync dry-run');
assert(workspacePage.includes('const openNotificationAuditTrail = () =>'), 'notification config pages must expose page-local audit trail action');
assert(workspacePage.includes('workspace-notification-audit-ledger'), 'notification config pages must render an in-page audit ledger');
assert(workspacePage.includes('触达审计已展开'), 'notification audit action must write in-page feedback');
assert(workspacePage.includes('渠道失败处理队列'), 'notification channel page must render a row-level failed delivery queue');
assert(workspacePage.includes('aria-label="通知渠道失败任务搜索"'), 'notification channel failed queue must provide page-local task search');
assert(workspacePage.includes('runNotificationChannelTaskAction'), 'notification channel failed queue must expose row-level test/fallback/replay actions');
assert(workspacePage.includes('aria-label="通用接入测试记录"'), 'external system page must render an operation log');
assert(workspacePage.includes('const runMailGatewaySecurityReview = () =>'), 'mail gateway must expose page-local security review');
assert(workspacePage.includes('const openMailGatewayLogTrail = () =>'), 'mail gateway must expose page-local log trail');
assert(workspacePage.includes('const handleMailGatewayLogRetry ='), 'mail gateway must expose page-local log retry handling');
assert(workspacePage.includes('邮件网关安全策略检查已展开'), 'mail gateway security review must produce page feedback');
assert(workspacePage.includes('aria-label="邮件网关安全检查记录"'), 'mail gateway must render a security review ledger');
assert(workspacePage.includes('aria-label="邮件网关日志处理记录"'), 'mail gateway must render a log action ledger');
assert(workspacePage.includes('const openWorkflowSwitchAuditTrail = () =>'), 'workflow notification switch must expose page-local audit trail');
assert(workspacePage.includes('流程通知开关审计轨迹已展开'), 'workflow notification switch audit trail must produce page feedback');
assert(workspacePage.includes('aria-label={`${selectedEntry.name}通知试算记录`}'), 'workflow notification switch must render a simulation ledger');
assert(workspacePage.includes('aria-label="流程通知开关审计记录"'), 'workflow notification switch must render an audit ledger');
assert(workspacePage.includes('const runUserDifferenceBatch = () =>'), 'user management must expose page-local difference handling');
assert(workspacePage.includes('const startUserHandoverBatch = () =>'), 'user management must expose page-local handover batch generation');
assert(workspacePage.includes('用户工作交接批次已生成'), 'user management must produce handover feedback in page');
assert(workspacePage.includes('const previewRolePermissionImpact = () =>'), 'role permission must expose page-local impact preview');
assert(workspacePage.includes('const openRoleAuditTrail = () =>'), 'role permission must expose page-local audit trail');
assert(workspacePage.includes('角色权限影响预演已生成'), 'role permission impact preview must produce page feedback');
assert(workspacePage.includes('aria-label="角色权限审计记录"'), 'role permission must render an audit ledger');
assert(workspacePage.includes('const runMenuRoleVisibilityPreview = () =>'), 'menu permission must expose page-local role visibility preview');
assert(workspacePage.includes('const openMenuPermissionAuditTrail = () =>'), 'menu permission must expose page-local audit trail');
assert(workspacePage.includes('角色菜单预览已生成'), 'menu permission role preview must produce page feedback');
assert(workspacePage.includes('aria-label="菜单权限详情操作"'), 'menu permission must render detail actions');
assert(workspacePage.includes('const runDepartmentTableAction = (action: string) =>'), 'department organization must expose page-local table operations');
assert(workspacePage.includes('部门组织负责人变更已生成'), 'department owner change must produce page feedback');
assert(workspacePage.includes('负责人变更待确认清单'), 'department organization must render a leader-change task queue');
assert(workspacePage.includes('aria-label="搜索部门负责人变更任务"'), 'department leader task queue must provide page-local search');
assert(workspacePage.includes('runDepartmentLeadTaskAction'), 'department leader task queue must expose confirm/preview/handover actions');
assert(workspacePage.includes('aria-label="部门组织变更记录"'), 'department organization must render an operation ledger');
assert(workspacePage.includes('分类策略任务清单'), 'asset category must render a strategy task queue');
assert(workspacePage.includes('aria-label="资产分类策略任务搜索"'), 'asset category task queue must provide page-local search');
assert(workspacePage.includes('runAssetCategoryTaskAction'), 'asset category task queue must expose row-level actions');
assert(workspacePage.includes('aria-label={`${selectedEntry.name}分类策略处理记录`}'), 'asset category must render task action ledger');
assert(workspacePage.includes('const runDataAccessSimulation = () =>'), 'data permission must expose page-local access simulation');
assert(workspacePage.includes('const openDataAuditTrail = () =>'), 'data permission must expose page-local audit trail');
assert(workspacePage.includes('数据权限访问模拟已生成'), 'data permission access simulation must produce page feedback');
assert(workspacePage.includes('数据权限审计轨迹已展开'), 'data permission audit trail must produce page feedback');
assert(workspacePage.includes('runAuditEventAction'), 'audit log page must expose row-level audit event actions');
assert(workspacePage.includes('aria-label={`${item.label}事件处理记录`}'), 'audit log page must render an in-page event action ledger');

notes.push(`formal_menus=${menus.length}`);
notes.push(`manifest_entries=${manifest.subpages.length}`);
notes.push(`formal_manifest_entries=${formalEntries.length}`);
notes.push(`groups=${Object.entries(expectedGroupCounts).map(([group, count]) => `${group}:${count}`).join(', ')}`);

if (failures.length > 0) {
  console.error('System Hub usability verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('System Hub usability verification passed.');
  for (const note of notes) {
    console.log(`- ${note}`);
  }
}
