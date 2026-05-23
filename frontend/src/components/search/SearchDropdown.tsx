/**
 * @file components/search/SearchDropdown.tsx
 * @description 全局搜索下拉面板 — Portal 渲染浮动面板
 *
 * 配合 AppLayout 搜索栏使用，展示后端 /api/search 的实时搜索结果。
 * 支持键盘导航（Enter 跳转、↑↓ 选择）。
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { createPortal } from 'react-dom';
import { Search, Package, ClipboardList, Building2, ExternalLink } from 'lucide-react';
import type { SearchResult } from '@/api/search';

// ── 类型图标映射 ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  asset:     Package,
  workorder: ClipboardList,
  vendor:    Building2,
};

const TYPE_LABEL: Record<string, string> = {
  asset:     '资产',
  workorder: '工单',
  vendor:    '供应商',
};

// ── 组件属性 ──────────────────────────────────────────────────────────────────

interface SearchDropdownProps {
  visible: boolean;
  keyword: string;
  results: SearchResult[];
  loading: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  /** 输入框元素的 ref，用于定位下拉位置 */
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

export default function SearchDropdown({
  visible,
  keyword,
  results,
  loading,
  selectedIndex,
  onSelect,
  onClose,
  inputRef,
}: SearchDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible, onClose, inputRef]);

  // 选中结果后导航
  const handleItemClick = useCallback(
    (result: SearchResult) => {
      onClose();
      navigate(result.path);
    },
    [navigate, onClose],
  );

  // 不可见或不满足展示条件时返回 null
  if (!visible || keyword.trim().length === 0) return null;

  // 计算下拉位置
  const inputRect = inputRef.current?.getBoundingClientRect();
  if (!inputRect) return null;

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: inputRect.bottom + 4,
    left: inputRect.left,
    width: inputRect.width,
    minWidth: 320,
    maxWidth: 480,
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-[#e5e7eb] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] overflow-hidden"
    >
      {/* 加载态 */}
      {loading && (
        <div className="p-4 text-center text-sm text-[#94a3b8]">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full mr-2" />
          搜索中...
        </div>
      )}

      {/* 无结果 */}
      {!loading && results.length === 0 && (
        <div className="p-6 text-center">
          <Search className="w-8 h-8 text-[#cbd5e1] mx-auto mb-2" />
          <p className="text-sm text-[#94a3b8]">未找到与「{keyword}」相关的结果</p>
        </div>
      )}

      {/* 结果列表 */}
      {!loading && results.length > 0 && (
        <div>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] bg-[#f8fafc] border-b border-[#edf2f7]">
            共 {results.length} 条结果
          </div>
          <div className="max-h-80 overflow-y-auto">
            {results.map((result, index) => {
              const Icon = TYPE_ICON[result.type] || Search;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  className={`flex items-start gap-3 w-full px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-[#eef2ff] border-l-2 border-[#3b82f6]'
                      : 'hover:bg-[#f8fafc] border-l-2 border-transparent'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleItemClick(result);
                  }}
                  onMouseEnter={() => onSelect(index)}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      result.type === 'asset'
                        ? 'bg-blue-50 text-blue-600'
                        : result.type === 'workorder'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-green-50 text-green-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0f172a] truncate">
                        {result.title}
                      </span>
                      <span className="text-[10px] text-[#94a3b8] bg-[#f1f5f9] rounded px-1 py-0.5 flex-shrink-0">
                        {TYPE_LABEL[result.type] || result.type}
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5 truncate">
                      {result.subtitle}
                    </p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-[#cbd5e1] flex-shrink-0 mt-1.5" />
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 text-[10px] text-[#94a3b8] bg-[#f8fafc] border-t border-[#edf2f7] text-center">
            ↑↓ 选择 · Enter 跳转 · Esc 关闭
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
