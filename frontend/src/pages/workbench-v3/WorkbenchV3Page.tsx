import { Suspense, useMemo, useState } from 'react';
import { getSystemRealPage, isSystemRealPageMenuId } from '../workspace-preview/system-hub/systemRealPageRegistry';
import { systemModuleRegistry } from '../workspace-preview/system-hub/systemModuleRegistry';

type WorkbenchV3MenuItem = {
  id: string;
  label: string;
  description: string;
  status: '已接入真组件';
};

const defaultWorkbenchV3MenuId = 'system-interfaces';

export const workbenchV3IntegrationMenus: WorkbenchV3MenuItem[] = [
  { id: 'system-interfaces', label: '接口管理', description: '接口目录、方法、路径摘要与配置校验', status: '已接入真组件' },
  { id: 'system-field-mapping', label: '字段映射', description: '源字段、目标字段、转换白名单与预览', status: '已接入真组件' },
  { id: 'system-sync-rules', label: '同步规则', description: 'dry-run、单条日志重试与只读队列摘要', status: '已接入真组件' },
];

function readMenuFromLocation() {
  if (typeof window === 'undefined') {
    return defaultWorkbenchV3MenuId;
  }
  return new URLSearchParams(window.location.search).get('menu') ?? defaultWorkbenchV3MenuId;
}

export default function WorkbenchV3Page() {
  const [activeMenu, setActiveMenu] = useState(readMenuFromLocation);
  const activeItem = useMemo(
    () => workbenchV3IntegrationMenus.find((item) => item.id === activeMenu) ?? workbenchV3IntegrationMenus[0],
    [activeMenu],
  );
  const RealPage = isSystemRealPageMenuId(activeItem.id) ? getSystemRealPage(activeItem.id) : undefined;

  const selectMenu = (menuId: string) => {
    setActiveMenu(menuId);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/fixed-assets/workbenchv3?menu=${menuId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">Workbench V3</p>
        <h1 className="mt-2 text-2xl font-semibold">系统集成 V3 工作台</h1>
        <p className="mt-2 text-sm text-slate-500">三项菜单只通过 V3 registry、module metadata、专属页面与专属 API 访问。</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Workbench V3 集成配置菜单">
          <h2 className="text-sm font-semibold text-slate-700">集成配置</h2>
          <div className="mt-4 space-y-2">
            {workbenchV3IntegrationMenus.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={activeItem.id === item.id}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                  activeItem.id === item.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-blue-50'
                }`}
                onClick={() => selectMenu(item.id)}
              >
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs opacity-80">{item.description}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-medium text-blue-600">{activeItem.id}</p>
              <h2 className="text-xl font-semibold">{activeItem.label}</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{activeItem.status}</span>
          </div>

          <Suspense fallback={<div className="text-sm text-slate-500">正在加载 V3 页面...</div>}>
            {RealPage ? <RealPage embeddedInWorkbench /> : null}
          </Suspense>
        </main>
      </div>

      <footer className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        已注册模块：{systemModuleRegistry.map((module) => module.menuId).join('、')}
      </footer>
    </div>
  );
}
