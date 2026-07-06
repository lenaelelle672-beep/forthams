/**
 * AssetToolbar — 资产列表页工具栏
 *
 * 参考设备管理 SaaS 截图交互，提供：
 * 切换视图 / 快速处理 / + 新建 / 编辑▾ / 导入导出▾ / 打印▾ + 搜索框
 *
 * @module components/AssetToolbar
 */

import React, { useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Upload,
  Download,
  Printer,
  RefreshCw,
  Search,
  LayoutList,
  LayoutGrid,
  Zap,
  ChevronDown,
  Trash2,
  FileSpreadsheet,
  FileDown,
  QrCode,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type ViewMode = "table" | "card";

export interface AssetToolbarProps {
  /** 当前视图模式 */
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** 搜索关键词 */
  keyword: string;
  onKeywordChange: (kw: string) => void;
  /** 已选中行数 */
  selectedCount: number;
  onClearSelection: () => void;
  /** 刷新 */
  onRefresh: () => void;
  loading?: boolean;
  /** 新建 */
  onNew: () => void;
  /** 导出 */
  onExport: () => void;
  exporting?: boolean;
  /** 导入 */
  onImport: () => void;
  /** 删除选中 */
  onDeleteSelected?: () => void;
}

/* ------------------------------------------------------------------ */
/*  小 Dropdown 组件（无依赖）                                         */
/* ------------------------------------------------------------------ */

function DropdownButton({
  icon: Icon,
  label,
  items,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  items: { label: string; icon?: React.ComponentType<{ className?: string }>; danger?: boolean; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1 h-8 px-3 text-sm rounded-md border transition-colors",
          disabled
            ? "border-gray-200 text-slate-600 bg-white cursor-not-allowed"
            : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400",
        ].join(" ")}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 ml-0.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { item.onClick(); setOpen(false); }}
              className={[
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                item.danger
                  ? "text-red-600 hover:bg-red-50"
                  : "text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {item.icon && <item.icon className="w-3.5 h-3.5 flex-shrink-0" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AssetToolbar                                                        */
/* ------------------------------------------------------------------ */

/**
 * AssetToolbar
 *
 * 资产列表页顶部工具栏，含视图切换、批量操作、搜索。
 */
export function AssetToolbar({
  viewMode,
  onViewModeChange,
  keyword,
  onKeywordChange,
  selectedCount,
  onClearSelection,
  onRefresh,
  loading = false,
  onNew,
  onExport,
  exporting = false,
  onImport,
  onDeleteSelected,
}: AssetToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 h-12 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
      {/* ── 左区：操作按钮 ── */}

      {/* 切换视图 */}
      <div className="inline-flex border border-gray-200 rounded-md overflow-hidden flex-shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange("table")}
          className={[
            "inline-flex items-center gap-1 h-8 px-2.5 text-sm transition-colors",
            viewMode === "table"
              ? "bg-blue-50 text-blue-700"
              : "bg-white text-gray-500 hover:bg-gray-50",
          ].join(" ")}
          title="表格视图"
        >
          <LayoutList className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">表格</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("card")}
          className={[
            "inline-flex items-center gap-1 h-8 px-2.5 text-sm border-l border-gray-200 transition-colors",
            viewMode === "card"
              ? "bg-blue-50 text-blue-700"
              : "bg-white text-gray-500 hover:bg-gray-50",
          ].join(" ")}
          title="卡片视图"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">卡片</span>
        </button>
      </div>

      {/* 快速处理 */}
      <DropdownButton
        icon={Zap}
        label="快速处理"
        disabled={selectedCount === 0}
        items={[
          { label: "批量设为在用", onClick: () => {} },
          { label: "批量设为闲置", onClick: () => {} },
          { label: "批量移交部门", onClick: () => {} },
        ]}
      />

      {/* + 新建（主按钮） */}
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-1 h-8 px-3 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>新建</span>
      </button>

      {/* 编辑 */}
      <DropdownButton
        icon={Pencil}
        label="编辑"
        disabled={selectedCount === 0}
        items={[
          { label: "编辑选中项", icon: Pencil, onClick: () => {} },
          {
            label: "删除选中项",
            icon: Trash2,
            danger: true,
            onClick: () => onDeleteSelected?.(),
          },
        ]}
      />

      {/* 导入/导出 */}
      <DropdownButton
        icon={FileSpreadsheet}
        label="导入/导出"
        items={[
          { label: "导入 Excel", icon: Upload, onClick: onImport },
          { label: "下载导入模板", icon: FileDown, onClick: () => {} },
          {
            label: exporting ? "导出中..." : "条件导出",
            icon: Download,
            onClick: onExport,
          },
        ]}
      />

      {/* 打印 */}
      <DropdownButton
        icon={Printer}
        label="打印"
        items={[
          { label: "打印列表", icon: Printer, onClick: () => window.print() },
          { label: "批量打印二维码", icon: QrCode, onClick: () => {} },
        ]}
      />

      {/* 刷新 */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1 h-8 px-2.5 text-sm rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
        title="刷新"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>

      {/* ── 分隔 ── */}
      <div className="flex-1" />

      {/* 已选中徽标 */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">
            已选 {selectedCount} 条
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded text-gray-400 hover:text-gray-500 hover:bg-blue-50"
            title="清除选择"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── 右区：搜索框 ── */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="搜索资产..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className="h-8 w-48 pl-8 pr-3 text-sm border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </div>
    </div>
  );
}

export default AssetToolbar;
