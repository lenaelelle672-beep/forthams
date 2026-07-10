import { Suspense } from 'react';
import type { SystemRealPageEntry } from '../workspace-preview/system-hub/systemRealPageRegistry';
import { useSystemInspectorSlot } from './SystemInspectorSlotProvider';
import { getPendingMenuStatus } from './pendingMenuStatus';

type SystemPageHostProps = {
  activeMenu: string;
  activeMenuLabel: string;
  RealPage?: SystemRealPageEntry;
};

const BACKEND_STATUS_LABEL: Record<string, { text: string; className: string }> = {
  none: { text: '后端零实现', className: 'bg-red-50 text-red-700' },
  partial: { text: '后端部分就绪', className: 'bg-amber-50 text-amber-700' },
  ready: { text: '后端就绪', className: 'bg-emerald-50 text-emerald-700' },
};

export default function SystemPageHost({
  activeMenu,
  activeMenuLabel,
  RealPage,
}: SystemPageHostProps) {
  const inspectorSlot = useSystemInspectorSlot();
  const pendingStatus = getPendingMenuStatus(activeMenu);
  const backendBadge = pendingStatus ? BACKEND_STATUS_LABEL[pendingStatus.backend] : null;

  return (
    <div
      data-system-page-host="workbench-v3"
      data-active-menu={activeMenu}
      data-inspector-menu={inspectorSlot?.activeMenu ?? activeMenu}
    >
      <Suspense fallback={<div className="text-sm text-slate-500">正在加载 V3 页面...</div>}>
        {RealPage ? (
          <RealPage embeddedInWorkbench />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">该菜单尚未接入 Workbench V3 真组件</span>
                {backendBadge ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${backendBadge.className}`}>{backendBadge.text}</span>
                ) : null}
                {pendingStatus ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">计划 {pendingStatus.phase}</span>
                ) : null}
              </div>
              <p className="mt-2 text-amber-800">
                {activeMenuLabel}（{activeMenu}）当前显示 V3 本地建设中占位；不会把旧 V2 工作台入口作为默认路径或完成证据。
              </p>
              {pendingStatus ? (
                <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-white/60 p-3 text-xs text-amber-800">
                  <div>
                    <span className="font-semibold">后端现状：</span>{pendingStatus.backendNote}
                  </div>
                  <div>
                    <span className="font-semibold">建设计划：</span>{pendingStatus.plan}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-amber-700">
                后续接入必须补齐真实页面、后端 API、权限、审计与合同测试后再登记为真实模块。
              </p>
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
}
