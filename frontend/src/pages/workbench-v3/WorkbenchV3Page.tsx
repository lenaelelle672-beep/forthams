import { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { getSystemRealPage, isSystemRealPageMenuId } from '../workspace-preview/system-hub/systemRealPageRegistry';
import { systemModuleRegistry } from '../workspace-preview/system-hub/systemModuleRegistry';

type WorkbenchV3MenuItem = {
  id: string;
  label: string;
  description: string;
  status: '已接入真组件';
};

type WorkbenchV3NavigationItem = {
  id: string;
  label: string;
};

type WorkbenchV3NavigationGroup = {
  id: string;
  label: string;
  items: WorkbenchV3NavigationItem[];
};

const defaultWorkbenchV3MenuId = 'system-interfaces';

const unsupportedV3MenuLabels: Record<string, string> = {
  'system-mail-gateway': '邮件网关配置',
};

export const workbenchV3IntegrationMenus: WorkbenchV3MenuItem[] = [
  { id: 'system-interfaces', label: '接口管理', description: '接口目录、方法、路径摘要与配置校验', status: '已接入真组件' },
  { id: 'system-field-mapping', label: '字段映射', description: '源字段、目标字段、转换白名单与预览', status: '已接入真组件' },
  { id: 'system-sync-rules', label: '同步规则', description: 'dry-run、单条日志重试与只读队列摘要', status: '已接入真组件' },
  { id: 'system-webhook-config', label: 'Webhook 配置', description: 'config-only 校验、敏感字段脱敏与租户隔离', status: '已接入真组件' },
  { id: 'system-cache-management', label: '缓存管理', description: '应用内命名空间、可观测空态与白名单刷新', status: '已接入真组件' },
  { id: 'system-file-storage', label: '文件存储', description: '附件元数据、业务类型筛选与只读边界', status: '已接入真组件' },
  { id: 'system-asset-category', label: '资产分类', description: '分类树、关键词查询与只读列表', status: '已接入真组件' },
  { id: 'system-vendor-management', label: '供应商管理', description: '供应商只读列表、关键词搜索与状态筛选', status: '已接入真组件' },
  { id: 'system-location-management', label: '位置管理', description: '位置只读列表、根位置摘要与状态筛选', status: '已接入真组件' },
  { id: 'system-user-management', label: '用户管理', description: '用户只读列表、关键词搜索与状态筛选', status: '已接入真组件' },
  { id: 'system-dept-org', label: '部门组织', description: '部门树列表、根部门摘要与状态筛选', status: '已接入真组件' },
  { id: 'system-role-permissions', label: '角色权限', description: '角色-权限绑定目录、权限库存与风险提示', status: '已接入真组件' },
  { id: 'system-flow-definition', label: '流程定义', description: '流程模板目录、业务类型搜索与节点摘要', status: '已接入真组件' },
  { id: 'system-runtime-monitor', label: '运行监控', description: '审批实例列表、待处理数量与流程类型筛选', status: '已接入真组件' },
  { id: 'system-settings-command-center', label: '流程控制台', description: '流程模板、运行实例、待处理数量与只读健康摘要', status: '已接入真组件' },
];

const workbenchV3IntegrationMenuIds = new Set(workbenchV3IntegrationMenus.map((item) => item.id));

export const workbenchV3MenuGroups: WorkbenchV3NavigationGroup[] = [
  {
    id: 'process-platform',
    label: '流程平台',
    items: [
      { id: 'system-settings-command-center', label: '流程控制台' },
      { id: 'system-flow-definition', label: '流程定义' },
      { id: 'system-flow-designer', label: '流程设计器' },
      { id: 'system-form-config', label: '表单配置' },
      { id: 'system-form-storage', label: '表单存储' },
      { id: 'system-approval-rules', label: '审批规则' },
      { id: 'system-todo-fields', label: '待办字段配置' },
      { id: 'system-sla-config', label: 'SLA 配置' },
      { id: 'system-runtime-monitor', label: '运行监控' },
    ],
  },
  {
    id: 'organization-permissions',
    label: '组织权限',
    items: [
      { id: 'system-user-management', label: '用户管理' },
      { id: 'system-dept-org', label: '部门组织' },
      { id: 'system-role-permissions', label: '角色权限' },
      { id: 'system-menu-permissions', label: '菜单权限' },
      { id: 'system-post-management', label: '岗位管理' },
      { id: 'system-data-permissions', label: '数据权限' },
      { id: 'system-handover', label: '交接管理' },
      { id: 'system-tenant-management', label: '租户管理' },
    ],
  },
  {
    id: 'master-data',
    label: '基础资料',
    items: [
      { id: 'system-asset-category', label: '资产分类' },
      { id: 'system-vendor-management', label: '供应商管理' },
      { id: 'system-location-management', label: '位置管理' },
      { id: 'system-numbering-rules', label: '编号规则' },
      { id: 'system-custom-fields', label: '自定义字段' },
      { id: 'system-custom-field-sets', label: '字段集' },
    ],
  },
  {
    id: 'integration-config',
    label: '集成配置',
    items: [
      { id: 'system-interfaces', label: '接口管理' },
      { id: 'system-field-mapping', label: '字段映射' },
      { id: 'system-sync-rules', label: '同步规则' },
      { id: 'system-webhook-config', label: 'Webhook 配置' },
      { id: 'system-external-systems', label: '外部系统' },
    ],
  },
  {
    id: 'message-notification',
    label: '消息与通知',
    items: [
      { id: 'system-mail-gateway', label: '邮件网关配置' },
      { id: 'system-workflow-mail', label: '流程邮件配置' },
      { id: 'system-mail-templates', label: '邮件模板' },
      { id: 'system-mail-logs', label: '邮件日志' },
      { id: 'system-notification-templates', label: '通知模板' },
      { id: 'system-notification-channels', label: '通知渠道' },
      { id: 'system-notification-preferences', label: '通知偏好' },
      { id: 'system-workflow-notification-switch', label: '流程通知开关' },
    ],
  },
  {
    id: 'system-parameters',
    label: '系统参数',
    items: [
      { id: 'system-base-params', label: '基础参数' },
      { id: 'system-security-policy', label: '安全策略' },
      { id: 'system-file-storage', label: '文件存储' },
      { id: 'system-import-export', label: '导入导出' },
      { id: 'system-cache-management', label: '缓存管理' },
      { id: 'system-audit-log', label: '审计日志' },
      { id: 'system-doc-center', label: '文档中心' },
      { id: 'system-tech-support', label: '技术支持' },
    ],
  },
];

const workbenchV3MenuLabelById = new Map(
  workbenchV3MenuGroups.flatMap((group) => group.items.map((item) => [item.id, item.label] as const)),
);

function readMenuFromLocation() {
  if (typeof window === 'undefined') {
    return defaultWorkbenchV3MenuId;
  }
  const menuId = new URLSearchParams(window.location.search).get('menu')?.trim();
  return menuId || defaultWorkbenchV3MenuId;
}

export default function WorkbenchV3Page() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState(readMenuFromLocation);
  const activeItem = useMemo(
    () => workbenchV3IntegrationMenus.find((item) => item.id === activeMenu),
    [activeMenu],
  );
  const activeGroup = useMemo(
    () => workbenchV3MenuGroups.find((group) => group.items.some((item) => item.id === activeMenu)) ?? workbenchV3MenuGroups[0],
    [activeMenu],
  );
  const isUnsupportedMenu = !activeItem;
  const activeMenuLabel = activeItem?.label ?? workbenchV3MenuLabelById.get(activeMenu) ?? unsupportedV3MenuLabels[activeMenu] ?? activeMenu;
  const RealPage = activeItem && isSystemRealPageMenuId(activeItem.id) ? getSystemRealPage(activeItem.id) : undefined;

  const selectMenu = (menuId: string) => {
    setActiveMenu(menuId);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/fixed-assets/workbenchv3?menu=${menuId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="p-6">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">系统管理 V3 工作台</h1>
        <p className="mt-2 text-sm text-slate-500">十五项菜单只通过 V3 registry、module metadata、专属页面与专属 API 访问，仍非 44 项全量覆盖。</p>
      </section>

      <nav className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Workbench V3 六域顶部导航">
        <div className="flex flex-wrap gap-2">
          {workbenchV3MenuGroups.map((group) => {
            const isActiveGroup = activeGroup.id === group.id;
            const integratedCount = group.items.filter((item) => workbenchV3IntegrationMenuIds.has(item.id)).length;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={isActiveGroup}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  isActiveGroup
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                }`}
                onClick={() => selectMenu(group.items[0].id)}
              >
                <span className="block text-sm font-semibold">{group.label}</span>
                <span className={`mt-1 block text-xs ${isActiveGroup ? 'text-blue-100' : 'text-slate-400'}`}>
                  {integratedCount}/{group.items.length} 已接入
                </span>
              </button>
            );
          })}
        </div>

      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Workbench V3 子项导航">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">当前分组</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">{activeGroup.label}</h2>
          </div>

          <div className="mt-4 space-y-2">
            {activeGroup.items.map((item) => {
              const isActiveMenu = activeMenu === item.id;
              const menuMeta = workbenchV3IntegrationMenus.find((menu) => menu.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActiveMenu}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                    isActiveMenu ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  onClick={() => selectMenu(item.id)}
                >
                  <span className="flex items-center justify-between gap-2 font-semibold">
                    {item.label}
                    {!menuMeta && <span className={`shrink-0 text-xs ${isActiveMenu ? 'text-blue-100' : 'text-amber-600'}`}>待接入</span>}
                  </span>
                  {menuMeta && <span className="mt-1 block text-xs opacity-80">{menuMeta.description}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
                <p className="text-xs font-medium text-blue-600">{activeItem?.id ?? activeMenu}</p>
                <h2 className="text-xl font-semibold">{activeMenuLabel}</h2>
              </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {activeItem?.status ?? '待接入 V3'}
            </span>
          </div>

          <Suspense fallback={<div className="text-sm text-slate-500">正在加载 V3 页面...</div>}>
            {RealPage ? (
              <RealPage embeddedInWorkbench />
            ) : isUnsupportedMenu ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <div className="font-semibold">该菜单尚未接入 Workbench V3 真组件</div>
                <p className="mt-2 text-amber-800">
                  {activeMenu} 仍在 V2 Workbench 设计/预览体系中，V3 六域导航会保留，但不会把未接入页面误报为已完成。
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700"
                  onClick={() => navigate(`/fixed-assets/workbench?menu=${activeMenu}`)}
                >
                  打开 V2 工作台入口
                </button>
              </div>
            ) : null}
          </Suspense>
        </section>
      </div>

      <footer className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        已注册模块：{systemModuleRegistry.map((module) => module.menuId).join('、')}
      </footer>
      </main>
    </div>
  );
}
