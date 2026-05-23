/**
 * @file components/SearchDropdown.tsx
 * @description 全局搜索下拉组件 — 内联搜索框 + API 搜索 + 下拉结果展示
 *
 * 功能：
 * - 300ms 防抖输入
 * - 调用后端 GET /api/search 获取结果
 * - 下拉面板展示，按 type 分组
 * - 点击结果跳转到详情页
 * - 快捷键 Escape 关闭
 * - 点击外面关闭
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, Package, ClipboardList, Users, Loader2 } from 'lucide-react';
import { globalSearch, type SearchResult } from '@/api/search';

// ── 类型图标映射 ──────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  asset: Package,
  workorder: ClipboardList,
  vendor: Users,
};

const TYPE_LABELS: Record<string, string> = {
  asset: '资产',
  workorder: '工单',
  vendor: '供应商',
};

export default function SearchDropdown() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── 防抖搜索 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await globalSearch(query.trim());
        const data = res?.data ?? [];
        setResults(data);
        setOpen(data.length > 0);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── 点击外部关闭 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');
      navigate(result.path);
    },
    [navigate],
  );

  // ── 键盘导航 ──────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  // ── 按类型分组 ──────────────────────────────────────────────────────────────
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[#94a3b8] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="搜索资产、工单、供应商..."
          className="w-72 h-8 pl-9 pr-8 text-sm bg-[#f8fafc] border border-[#e5e7eb] rounded-lg text-[#374151] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] transition-all"
        />
        {loading && (
          <Loader2 className="absolute right-3 w-3.5 h-3.5 text-[#94a3b8] animate-spin" />
        )}
      </div>

      {/* 下拉面板 */}
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg border border-[#e5e7eb] shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {Object.entries(groupedResults).map(([type, items]) => (
            <div key={type} className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                {TYPE_LABELS[type] || type}
              </div>
              {items.map((item, idx) => {
                const globalIdx = results.indexOf(item);
                const Icon = TYPE_ICONS[item.type] || Search;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                      globalIdx === selectedIndex
                        ? 'bg-[#f1f5f9] text-[#0f172a]'
                        : 'text-[#374151] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 text-[#94a3b8] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-[#94a3b8] truncate">{item.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
