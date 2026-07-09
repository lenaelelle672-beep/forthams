import { Suspense } from 'react';
import type { SystemRealPageEntry } from '../workspace-preview/system-hub/systemRealPageRegistry';
import { useSystemInspectorSlot } from './SystemInspectorSlotProvider';

type SystemPageHostProps = {
  activeMenu: string;
  activeMenuLabel: string;
  RealPage?: SystemRealPageEntry;
};

export default function SystemPageHost({
  activeMenu,
  activeMenuLabel,
  RealPage,
}: SystemPageHostProps) {
  const inspectorSlot = useSystemInspectorSlot();

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
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="font-semibold">该菜单尚未接入 Workbench V3 真组件</div>
            <p className="mt-2 text-amber-800">
              {activeMenuLabel}（{activeMenu}）当前显示 V3 本地建设中占位；不会把旧 V2 工作台入口作为默认路径或完成证据。
            </p>
            <p className="mt-3 text-xs text-amber-700">
              后续接入必须补齐真实页面、后端 API、权限、审计与合同测试后再登记为真实模块。
            </p>
          </div>
        )}
      </Suspense>
    </div>
  );
}
