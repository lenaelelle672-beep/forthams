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
  '流程平台': 7,
  '组织权限': 7,
  '基础资料': 6,
  '集成配置': 5,
  '消息与通知': 8,
  '系统参数': 6,
};

assert(menus.length === 39, `expected 39 formal System Hub menus, got ${menus.length}`);
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
  '流程定义页支持当前页新建保存提交',
  '系统运营中枢缺失配置页均落到专用功能面板',
  '基础资料主数据页均可新建保存提交',
  '消息通知配置页均可新建保存提交',
];

for (const title of smokeCoverageTitles) {
  assert(smoke.includes(title), `smoke coverage title is missing: ${title}`);
}

const smokeDraftCoverage = [
  ['system-flow-definition', '流程定义', ['menu=system-flow-definition', '流程定义草稿已保存', '流程定义校验已提交']],
  ['system-flow-designer', '流程设计器', ['menu=system-flow-designer', '流程设计器操作结果', '草稿已保存', '提交校验已完成']],
  ['system-form-config', '表单配置', ['menu=system-form-config', '表单草稿已保存', '表单校验已提交']],
  ['system-form-storage', '表单存储', ['menu=system-form-storage', '表单存储草稿已保存', '表单存储校验已提交']],
  ['system-approval-rules', '审批规则', ['menu=system-approval-rules', '审批规则草稿已保存', '审批规则校验已提交']],
  ['system-todo-fields', '待办字段配置', ['menu=system-todo-fields', '待办字段草稿已保存', '待办字段校验已提交']],
  ['system-sla-config', 'SLA 配置', ['menu=system-sla-config', 'SLA 草稿已保存', 'SLA 校验已提交']],
  ['system-user-management', '用户管理', ['menu=system-user-management', '用户管理草稿已保存', '用户管理校验已提交']],
  ['system-role-permissions', '角色权限', ["menuId: 'system-role-permissions'", '角色权限草稿已保存', '角色权限校验已提交']],
  ['system-menu-permissions', '菜单权限', ["menuId: 'system-menu-permissions'", '菜单权限草稿已保存', '菜单权限校验已提交']],
  ['system-dept-org', '部门组织', ["menuId: 'system-dept-org'", '部门组织草稿已保存', '部门组织校验已提交']],
  ['system-post-management', '岗位管理', ["menuId: 'system-post-management'", '岗位管理草稿已保存', '岗位管理校验已提交']],
  ['system-data-permissions', '数据权限', ["menuId: 'system-data-permissions'", '数据权限草稿已保存', '数据权限校验已提交']],
  ['system-handover', '工作交接', ['menu=system-handover', '交接草稿已保存', '交接生效已提交']],
  ['system-asset-category', '资产分类', ["menuId: 'system-asset-category'", '资产分类草稿已保存', '资产分类校验已提交']],
  ['system-numbering-rules', '编号规则', ['menu=system-numbering-rules', '编号规则草稿已保存', '编号规则校验已提交']],
  ['system-location-management', '位置管理', ["menuId: 'system-location-management'", 'runMasterDataDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-vendor-management', '供应商管理', ["menuId: 'system-vendor-management'", '供应商管理草稿已保存', '供应商管理校验已提交']],
  ['system-custom-fields', '自定义字段', ["menuId: 'system-custom-fields'", 'runMasterDataDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-custom-field-sets', '自定义字段集', ["menuId: 'system-custom-field-sets'", 'runMasterDataDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-external-systems', '外部系统配置', ['menu=system-external-systems', '接入配置草稿已保存', '接入配置提交校验已完成']],
  ['system-interfaces', '接口配置', ['menu=system-interfaces', 'runIntegrationDraftFlow', 'toContainText(`${pageLabel}草稿已保存`)', 'toContainText(`${pageLabel}提交校验已完成`)']],
  ['system-field-mapping', '字段映射', ['menu=system-field-mapping', 'runIntegrationDraftFlow', 'toContainText(`${pageLabel}草稿已保存`)', 'toContainText(`${pageLabel}提交校验已完成`)']],
  ['system-sync-rules', '同步规则', ['menu=system-sync-rules', 'runIntegrationDraftFlow', 'toContainText(`${pageLabel}草稿已保存`)', 'toContainText(`${pageLabel}提交校验已完成`)']],
  ['system-webhook-config', 'Webhook 配置', ['menu=system-webhook-config', 'runIntegrationDraftFlow', 'toContainText(`${pageLabel}草稿已保存`)', 'toContainText(`${pageLabel}提交校验已完成`)']],
  ['system-mail-gateway', '邮件网关配置', ['menu=system-mail-gateway', '邮件网关草稿已保存', '邮件网关校验已提交']],
  ['system-workflow-mail', '流程邮件配置', ["menuId: 'system-workflow-mail'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-mail-templates', '邮件模板', ['menu=system-mail-templates', '邮件模板草稿已保存', '邮件模板校验已提交']],
  ['system-mail-logs', '邮件日志', ["menuId: 'system-mail-logs'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-notification-templates', '通知模板', ["menuId: 'system-notification-templates'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-notification-channels', '通知渠道', ["menuId: 'system-notification-channels'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-notification-preferences', '通知偏好', ["menuId: 'system-notification-preferences'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-workflow-notification-switch', '流程通知开关', ["menuId: 'system-workflow-notification-switch'", 'runNotificationDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-base-params', '基础参数', ['menu=system-base-params', '基础参数草稿已保存', '基础参数校验已提交']],
  ['system-security-policy', '安全策略', ["menuId: 'system-security-policy'", 'runSystemParameterDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-file-storage', '文件存储配置', ["menuId: 'system-file-storage'", 'runSystemParameterDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-import-export', '导入导出配置', ["menuId: 'system-import-export'", 'runSystemParameterDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-cache-management', '缓存管理', ["menuId: 'system-cache-management'", 'runSystemParameterDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
  ['system-audit-log', '操作审计', ["menuId: 'system-audit-log'", 'runSystemParameterDraftFlow', 'toContainText(`${label}草稿已保存`)', 'toContainText(`${label}校验已提交`)']],
];

for (const [menuId, label, tokens] of smokeDraftCoverage) {
  assert(menuIds.has(menuId), `${label} (${menuId}) smoke coverage target is not a formal System Hub menu`);
  for (const token of tokens) {
    assert(smoke.includes(token), `${label} (${menuId}) smoke must include evidence token: ${token}`);
  }
}
assert(smokeDraftCoverage.length === menus.length, `expected smoke draft coverage for ${menus.length} menus, got ${smokeDraftCoverage.length}`);
assert(new Set(smokeDraftCoverage.map(([menuId]) => menuId)).size === menus.length, 'smoke draft coverage menu ids must be unique');

assert(smoke.includes("page.locator('.workspace-system-nav-console')).toHaveCount(0)"), 'smoke must assert removed System Hub nav console');
assert(smoke.includes("page.locator('header').filter({ hasText: '搜索...' })).toHaveCount(0)"), 'smoke must assert old GlobalSearch desktop trigger text is absent from headers');
assert(smoke.includes("page.locator('header [aria-label=\"搜索\"]')).toHaveCount(0)"), 'smoke must assert top header has no exact search trigger');
assert(smoke.includes("page.locator('.workspace-side').getByRole('textbox')).toHaveCount(0)"), 'smoke must assert left navigation has no search textbox');
assert(workspacePage.includes('aria-label="流程设计器页面搜索"'), 'Flow designer must provide page-local search in the dedicated canvas toolbar, not above navigation or node palette');
assert(!workspacePage.includes('aria-label="节点库搜索"'), 'Flow designer node palette must not expose its own search textbox');
assert(smoke.includes("getByRole('textbox', { name: '流程设计器页面搜索'"), 'smoke must cover Flow Designer page-local search');
assert(smoke.includes("nodePalette.getByRole('textbox')).toHaveCount(0)"), 'smoke must assert Flow Designer node palette has no search textbox');
assert(smoke.includes("getByLabel('流程设计器画布工具条').getByRole('textbox')).toHaveCount(1)"), 'smoke must assert Flow Designer canvas toolbar owns the page search textbox');
assert(smoke.includes("getByLabel('流程设计器页面内搜索空结果')"), 'smoke must cover Flow Designer page-local search empty state');
assert(smoke.includes("page.getByLabel('系统运营中枢整体设计承接')"), 'smoke must cover the overall System Hub design bridge');
assert(smoke.includes('system-hub-subpage-00-navigation-console-v2'), 'smoke must assert the navigation console IMAGE2 asset renders');
assert(smoke.includes('stitch-system-hub-subpage-00-navigation-console-v1'), 'smoke must assert the navigation console Stitch asset renders');
assert(smoke.includes("getByRole('button', { name: '查看总图'"), 'smoke must cover the design bridge preview action');
assert(workspacePage.includes("hasDedicatedSystemConfigurator ? 'is-dedicated-configurator' : ''"), 'dedicated System Hub pages must declare a full-width configurator class');
assert(workspaceStyles.includes('.workspace-system-page.is-dedicated-configurator .workspace-system-module-board'), 'dedicated System Hub pages must override the generic module-board grid');
assert(workspaceStyles.includes('.workspace-system-page.is-dedicated-configurator .workspace-system-detail'), 'dedicated System Hub pages must move design/audit support out of the primary work area');
assert(smoke.includes('runIntegrationDraftFlow'), 'smoke must cover integration draft save-submit flow');
assert(smoke.includes('runSystemParameterDraftFlow'), 'smoke must cover system parameter draft save-submit flow');
assert(workspacePage.includes('aria-label="角色成员清单"'), 'role permissions must render a member directory instead of only a role summary');
assert(workspacePage.includes('aria-label="搜索角色成员"'), 'role member directory must provide page-local member search');
assert(workspacePage.includes('runRoleMemberAction'), 'role member directory must provide member-level actions');
assert(smoke.includes("page.getByLabel('搜索角色成员')"), 'smoke must cover role member search');
assert(smoke.includes('角色成员复核已生成'), 'smoke must cover role member review action');
assert(workspacePage.includes('用户授权任务清单'), 'user management must render a user-level grant task queue');
assert(workspacePage.includes('aria-label="搜索用户授权任务"'), 'user grant task queue must provide page-local search');
assert(workspacePage.includes('runUserGrantTaskAction'), 'user grant task queue must provide grant/revoke/handover actions');
assert(smoke.includes("page.getByLabel('搜索用户授权任务')"), 'smoke must cover user grant task search');
assert(smoke.includes('用户权限授权已生成'), 'smoke must cover user grant action feedback');
assert(smoke.includes("page.getByLabel('交接与审计记录')).toContainText('角色授权授权')"), 'smoke must prove user grant action writes audit ledger');
assert(workspacePage.includes('aria-label="数据权限命中用户清单"'), 'data permissions must render a subject directory instead of only a rule matrix');
assert(workspacePage.includes('aria-label="搜索数据权限命中用户"'), 'data permission subject directory must provide page-local subject search');
assert(workspacePage.includes('runDataSubjectAction'), 'data permission subject directory must provide member-level actions');
assert(smoke.includes("page.getByLabel('搜索数据权限命中用户')"), 'smoke must cover data permission subject search');
assert(smoke.includes('数据权限成员复核已生成'), 'smoke must cover data permission subject review action');
assert(workspacePage.includes('交接对象处理清单'), 'work handover must render object-level task queue instead of only batch/scope summary');
assert(workspacePage.includes('aria-label="交接对象搜索"'), 'work handover object queue must provide page-local object search');
assert(workspacePage.includes('runHandoverObjectAction'), 'work handover object queue must provide object-level confirm/dispatch/skip actions');
assert(smoke.includes("getByRole('textbox', { name: '交接对象搜索'"), 'smoke must cover handover object search');
assert(smoke.includes('交接明细确认已生成'), 'smoke must cover handover object confirmation action');
assert(smoke.includes("page.getByLabel('工作交接审计记录')).toContainText('明细确认')"), 'smoke must prove handover object action writes audit ledger');
assert(workspacePage.includes('异常重放任务清单'), 'sync rules must render an object-level replay task queue');
assert(workspacePage.includes('aria-label="同步异常任务搜索"'), 'sync rule replay task queue must provide page-local search');
assert(workspacePage.includes('runIntegrationReplayTaskAction'), 'sync rule replay task queue must provide row-level replay/lock/manual actions');
assert(smoke.includes("getByRole('textbox', { name: '同步异常任务搜索'"), 'smoke must cover sync replay task search');
assert(smoke.includes('同步异常任务锁定已生成'), 'smoke must cover sync replay task lock action');
assert(smoke.includes("page.getByLabel('同步规则操作留痕')).toContainText('异常锁定')"), 'smoke must prove sync replay action writes operation ledger');
assert(workspacePage.includes('const runCacheManagementWarmupDrill = () =>'), 'cache management must expose a warmup drill action');
assert(workspacePage.includes('const runCacheManagementConsistencyCheck = () =>'), 'cache management must expose a consistency check action');
assert(smoke.includes("cacheManagementConsole.getByRole('button', { name: '预热演练'"), 'smoke must cover cache warmup drill');
assert(smoke.includes("cacheManagementConsole.getByRole('button', { name: '一致性校验'"), 'smoke must cover cache consistency check');
assert(workspacePage.includes('高危操作复核队列'), 'security policy must render a high-risk operation review queue');
assert(workspacePage.includes('aria-label="高危操作复核任务搜索"'), 'security policy queue must provide page-local search');
assert(workspacePage.includes('runSecurityRiskTaskAction'), 'security policy queue must provide row-level review/approve/lock actions');
assert(smoke.includes("getByRole('searchbox', { name: '高危操作复核任务搜索'"), 'smoke must cover security risk task search');
assert(smoke.includes('高危操作锁定已生成'), 'smoke must cover security risk lock action');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('高危操作锁定')"), 'smoke must prove security risk action writes audit ledger');
assert(workspacePage.includes('缓存异常恢复任务清单'), 'cache management must render a row-level recovery task list');
assert(workspacePage.includes('aria-label="缓存异常任务搜索"'), 'cache management recovery queue must provide page-local task search');
assert(workspacePage.includes('runCacheRecoveryTaskAction'), 'cache management recovery queue must provide row-level replay/lock/rollback actions');
assert(smoke.includes("getByRole('textbox', { name: '缓存异常任务搜索'"), 'smoke must cover cache recovery task search');
assert(smoke.includes('缓存异常任务锁定已生成'), 'smoke must cover cache recovery lock action');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('缓存异常锁定')"), 'smoke must prove cache recovery action writes audit ledger');
assert(workspacePage.includes('const openParameterPublishAuditTrail = () =>'), 'system parameter pages must expose page-local publish audit action');
assert(workspacePage.includes('workspace-system-parameter-audit-ledger'), 'system parameter pages must render an in-page publish audit ledger');
assert(workspacePage.includes('发布审计已展开'), 'system parameter publish audit must write in-page feedback');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('参数变更')"), 'smoke must cover system parameter in-page publish audit');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('发布门禁')"), 'smoke must cover system parameter publish gate audit');
assert(smoke.includes("page.getByLabel('CIP 转固附件上限发布审计记录')).toContainText('回滚记录')"), 'smoke must cover base parameter rollback audit');
assert(workspacePage.includes('文件处理异常队列'), 'file storage config must render a row-level file processing exception queue');
assert(workspacePage.includes('aria-label="文件处理异常任务搜索"'), 'file storage exception queue must provide page-local task search');
assert(workspacePage.includes('runFileStorageTaskAction'), 'file storage exception queue must provide row-level retry/quarantine/archive actions');
assert(smoke.includes("getByRole('textbox', { name: '文件处理异常任务搜索'"), 'smoke must cover file storage task search');
assert(smoke.includes('文件处理任务隔离已生成'), 'smoke must cover file storage quarantine action');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('文件异常隔离')"), 'smoke must prove file storage task action writes audit ledger');
assert(workspacePage.includes('导入导出异步任务队列'), 'import/export config must render an async task queue, not only template fields');
assert(workspacePage.includes('aria-label="导入导出任务搜索"'), 'import/export async queue must provide page-local task search');
assert(workspacePage.includes('runImportExportQueueAction'), 'import/export async queue must provide row-level retry/pause/evidence actions');
assert(smoke.includes("getByRole('textbox', { name: '导入导出任务搜索'"), 'smoke must cover import/export async task search');
assert(smoke.includes('导入导出任务取证已生成'), 'smoke must cover import/export async task evidence action');
assert(smoke.includes("page.getByLabel(`${draftName}发布审计记录`)).toContainText('异步任务取证')"), 'smoke must prove import/export task action writes audit ledger');
assert(workspacePage.includes('const runAccessConnectionTest = () =>'), 'external system page must expose page-local connection test');
assert(workspacePage.includes('const openAccessAuthPolicy = () =>'), 'external system page must expose page-local auth policy check');
assert(workspacePage.includes('const runAccessSyncDryRun = () =>'), 'external system page must expose page-local sync dry-run');
assert(workspacePage.includes('const openNotificationAuditTrail = () =>'), 'notification config pages must expose page-local audit trail action');
assert(workspacePage.includes('workspace-notification-audit-ledger'), 'notification config pages must render an in-page audit ledger');
assert(workspacePage.includes('触达审计已展开'), 'notification audit action must write in-page feedback');
assert(smoke.includes("page.getByLabel(`${draftName}触达审计记录`)).toContainText('流程引用')"), 'smoke must cover notification in-page audit trail');
assert(smoke.includes("page.getByLabel(`${draftName}触达审计记录`)).toContainText('变量快照')"), 'smoke must cover notification variable snapshot audit');
assert(smoke.includes("page.getByLabel('CIP 转固完结通知触达审计记录')).toContainText('发送日志')"), 'smoke must cover mail template in-page audit trail');
assert(workspacePage.includes('渠道失败处理队列'), 'notification channel page must render a row-level failed delivery queue');
assert(workspacePage.includes('aria-label="通知渠道失败任务搜索"'), 'notification channel failed queue must provide page-local task search');
assert(workspacePage.includes('runNotificationChannelTaskAction'), 'notification channel failed queue must expose row-level test/fallback/replay actions');
assert(smoke.includes("getByRole('textbox', { name: '通知渠道失败任务搜索'"), 'smoke must cover notification channel task search');
assert(smoke.includes('通知渠道切换降级已生成'), 'smoke must cover notification channel fallback action feedback');
assert(smoke.includes("page.getByLabel(`${notificationCase.draftName}触达审计记录`)).toContainText('渠道降级切换')"), 'smoke must prove notification channel action writes audit ledger');
assert(workspacePage.includes('aria-label="外部系统接入测试记录"'), 'external system page must render an operation log');
assert(smoke.includes("page.getByLabel('外部系统接入测试记录')).toContainText('同步试跑')"), 'smoke must cover external sync dry-run operation log');
assert(workspacePage.includes('const runMailGatewaySecurityReview = () =>'), 'mail gateway must expose page-local security review');
assert(workspacePage.includes('const openMailGatewayLogTrail = () =>'), 'mail gateway must expose page-local log trail');
assert(workspacePage.includes('const handleMailGatewayLogRetry ='), 'mail gateway must expose page-local log retry handling');
assert(workspacePage.includes('邮件网关安全策略检查已展开'), 'mail gateway security review must produce page feedback');
assert(workspacePage.includes('aria-label="邮件网关安全检查记录"'), 'mail gateway must render a security review ledger');
assert(workspacePage.includes('aria-label="邮件网关日志处理记录"'), 'mail gateway must render a log action ledger');
assert(smoke.includes("page.getByLabel('邮件网关安全检查记录')).toContainText('敏感脱敏')"), 'smoke must cover mail gateway security review ledger');
assert(smoke.includes("page.getByLabel('邮件网关日志处理记录')).toContainText('MAIL-CIP-044')"), 'smoke must cover mail gateway log retry ledger');
assert(workspacePage.includes('const openWorkflowSwitchAuditTrail = () =>'), 'workflow notification switch must expose page-local audit trail');
assert(workspacePage.includes('流程通知开关审计轨迹已展开'), 'workflow notification switch audit trail must produce page feedback');
assert(workspacePage.includes('aria-label={`${selectedEntry.name}通知试算记录`}'), 'workflow notification switch must render a simulation ledger');
assert(workspacePage.includes('aria-label="流程通知开关审计记录"'), 'workflow notification switch must render an audit ledger');
assert(smoke.includes("page.getByLabel(`${notificationCase.draftName}通知试算记录`)).toContainText('发送预演')"), 'smoke must cover workflow notification simulation ledger');
assert(smoke.includes("page.getByLabel('流程通知开关审计记录')).toContainText('审计轨迹')"), 'smoke must cover workflow notification audit ledger');
assert(workspacePage.includes('const runUserDifferenceBatch = () =>'), 'user management must expose page-local difference handling');
assert(workspacePage.includes('const startUserHandoverBatch = () =>'), 'user management must expose page-local handover batch generation');
assert(workspacePage.includes('用户工作交接批次已生成'), 'user management must produce handover feedback in page');
assert(smoke.includes("page.getByLabel('交接与审计记录')).toContainText('工作交接批次')"), 'smoke must cover user handover audit record');
assert(workspacePage.includes('const previewRolePermissionImpact = () =>'), 'role permission must expose page-local impact preview');
assert(workspacePage.includes('const openRoleAuditTrail = () =>'), 'role permission must expose page-local audit trail');
assert(workspacePage.includes('角色权限影响预演已生成'), 'role permission impact preview must produce page feedback');
assert(workspacePage.includes('aria-label="角色权限审计记录"'), 'role permission must render an audit ledger');
assert(smoke.includes("page.getByLabel('角色权限审计记录')).toContainText('影响预演')"), 'smoke must cover role impact ledger append');
assert(smoke.includes("page.getByLabel('角色权限审计记录')).toContainText('审计轨迹')"), 'smoke must cover role audit ledger append');
assert(workspacePage.includes('const runMenuRoleVisibilityPreview = () =>'), 'menu permission must expose page-local role visibility preview');
assert(workspacePage.includes('const openMenuPermissionAuditTrail = () =>'), 'menu permission must expose page-local audit trail');
assert(workspacePage.includes('角色菜单预览已生成'), 'menu permission role preview must produce page feedback');
assert(workspacePage.includes('aria-label="菜单权限详情操作"'), 'menu permission must render detail actions');
assert(smoke.includes("page.getByLabel('菜单权限角色可见性预览')).toContainText(menuPermissions.previewRole)"), 'smoke must cover menu role preview append');
assert(smoke.includes("page.getByLabel('菜单权限角色可见性预览')).toContainText('审计追踪')"), 'smoke must cover menu audit preview append');
assert(workspacePage.includes('const runDepartmentTableAction = (action: string) =>'), 'department organization must expose page-local table operations');
assert(workspacePage.includes('部门组织负责人变更已生成'), 'department owner change must produce page feedback');
assert(workspacePage.includes('负责人变更待确认清单'), 'department organization must render a leader-change task queue');
assert(workspacePage.includes('aria-label="搜索部门负责人变更任务"'), 'department leader task queue must provide page-local search');
assert(workspacePage.includes('runDepartmentLeadTaskAction'), 'department leader task queue must expose confirm/preview/handover actions');
assert(workspacePage.includes('aria-label="部门组织变更记录"'), 'department organization must render an operation ledger');
assert(smoke.includes("page.getByLabel('搜索部门负责人变更任务')"), 'smoke must cover department leader task search');
assert(smoke.includes('部门组织影响预演已生成'), 'smoke must cover department leader task impact preview action');
assert(smoke.includes("page.getByLabel('部门组织变更记录')).toContainText('成本中心同步影响预演')"), 'smoke must prove department leader task action writes operation ledger');
assert(smoke.includes("page.getByLabel('部门组织变更记录')).toContainText('负责人变更')"), 'smoke must cover department operation ledger append');
assert(smoke.includes("page.getByLabel('部门组织变更记录')).toContainText('待二次确认')"), 'smoke must cover department stop confirmation ledger append');
assert(workspacePage.includes('分类策略任务清单'), 'asset category must render a strategy task queue');
assert(workspacePage.includes('aria-label="资产分类策略任务搜索"'), 'asset category task queue must provide page-local search');
assert(workspacePage.includes('runAssetCategoryTaskAction'), 'asset category task queue must expose row-level actions');
assert(workspacePage.includes('aria-label={`${selectedEntry.name}分类策略处理记录`}'), 'asset category must render task action ledger');
assert(smoke.includes("getByRole('textbox', { name: '资产分类策略任务搜索'"), 'smoke must cover asset category task search');
assert(smoke.includes('资产分类策略预演已生成'), 'smoke must cover asset category strategy preview action');
assert(smoke.includes("page.getByLabel('生产设备 / 回流焊炉分类策略处理记录')).toContainText('折旧策略策略预演')"), 'smoke must prove asset category task action writes ledger');
assert(workspacePage.includes('const runDataAccessSimulation = () =>'), 'data permission must expose page-local access simulation');
assert(workspacePage.includes('const openDataAuditTrail = () =>'), 'data permission must expose page-local audit trail');
assert(workspacePage.includes('数据权限访问模拟已生成'), 'data permission access simulation must produce page feedback');
assert(workspacePage.includes('数据权限审计轨迹已展开'), 'data permission audit trail must produce page feedback');
assert(smoke.includes("page.getByLabel('数据权限访问模拟')).toContainText('访问模拟')"), 'smoke must cover data access simulation append');
assert(smoke.includes("page.getByLabel('数据权限访问模拟')).toContainText('审计追踪')"), 'smoke must cover data audit append');
assert(workspacePage.includes('runAuditEventAction'), 'audit log page must expose row-level audit event actions');
assert(workspacePage.includes('aria-label={`${item.label}事件处理记录`}'), 'audit log page must render an in-page event action ledger');
assert(smoke.includes("filteredAuditEvents.getByRole('button', { name: '单条取证'"), 'smoke must cover single audit event evidence action');
assert(smoke.includes('审计事件冻结已生成'), 'smoke must cover audit event freeze action');
assert(smoke.includes("page.getByLabel('操作审计事件处理记录')).toContainText('EVT-CIP-001')"), 'smoke must prove audit event action writes event ledger');
assert(smoke.includes("page.getByLabel('操作审计参数对象列表')).toContainText('已提交校验')"), 'smoke must prove audit log draft submission updates the in-page policy list');
assert(smoke.includes("page.getByLabel('操作审计专用配置预览')).toContainText('已提交校验')"), 'smoke must prove audit log draft submission updates the in-page config preview table');

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
