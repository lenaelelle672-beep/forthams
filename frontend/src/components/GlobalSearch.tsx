/**
 * @file components/GlobalSearch.tsx
 * @description Cmd+K 全局搜索组件 — 统一搜索入口（页面导航 + 数据搜索）
 *
 * 快捷键：macOS Cmd+K / Windows Linux Ctrl+K
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Package, FileText, Truck } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { globalSearch, SearchResult } from '@/api/search';

// ── 可搜索页面路由配置 ────────────────────────────────────────────────────────
interface SearchablePage {
  path: string;
  label: string;
  group: string;
}

const SEARCHABLE_PAGES: SearchablePage[] = [
  // 概览
  { path: '/',            label: '仪表板',     group: '概览' },
  { path: '/analytics',   label: '数据分析',    group: '概览' },
  { path: '/situation',   label: '资产大屏',    group: '概览' },
  { path: '/cyber-v12',   label: '科技大屏',    group: '概览' },
  { path: '/industrial-v13', label: '工业大屏', group: '概览' },
  // 资产管理
  { path: '/assets',             label: '资产台账',   group: '资产管理' },
  { path: '/assets/new',         label: '新建资产',   group: '资产管理' },
  { path: '/assets/import-export', label: '导入导出', group: '资产管理' },
  { path: '/equipment',          label: '重要设备',   group: '资产管理' },
  { path: '/idle',               label: '闲置资产',   group: '资产管理' },
  { path: '/depreciation',       label: '折旧管理',   group: '资产管理' },
  // 运营管理
  { path: '/inventory',              label: 'RFID 盘点',      group: '运营管理' },
  { path: '/inventory/tasks',        label: '盘点任务',       group: '运营管理' },
  { path: '/inventory/smart-report', label: '智能盘点报告',   group: '运营管理' },
  { path: '/workorders',             label: '工单管理',       group: '运营管理' },
  { path: '/workorders/new',         label: '新建工单',       group: '运营管理' },
  { path: '/approval',               label: '审批流程',       group: '运营管理' },
  { path: '/workflows',              label: '工作流',         group: '运营管理' },
  { path: '/workflow-designer',      label: '工作流设计器',   group: '运营管理' },
  // 退役与处置
  { path: '/retirement',                label: '退役管理',     group: '退役与处置' },
  { path: '/retirement/new',            label: '新建退役',     group: '退役与处置' },
  { path: '/disposals',                 label: '资产处置',     group: '退役与处置' },
  { path: '/disposals/transfer/new',    label: '资产转移',     group: '退役与处置' },
  { path: '/disposals/clearance/new',   label: '资产清理',     group: '退役与处置' },
  { path: '/disposals/scrap/new',       label: '资产报废',     group: '退役与处置' },
  { path: '/disposals/compensation/new', label: '赔偿管理',    group: '退役与处置' },
  // 监控与审计
  { path: '/audit', label: '审计日志', group: '监控与审计' },
  // 基础数据
  { path: '/vendors',   label: '供应商',  group: '基础数据' },
  { path: '/locations', label: '位置管理', group: '基础数据' },
  { path: '/settings',  label: '系统设置', group: '基础数据' },
];

const GROUP_ORDER = ['概览', '资产管理', '运营管理', '退役与处置', '监控与审计', '基础数据', '系统'];

function groupSorter(a: { group: string }, b: { group: string }) {
  return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
}

SEARCHABLE_PAGES.sort(groupSorter);

function groupPages(pages: SearchablePage[]): Map<string, SearchablePage[]> {
  const map = new Map<string, SearchablePage[]>();
  for (const page of pages) {
    const list = map.get(page.group) ?? [];
    list.push(page);
    map.set(page.group, list);
  }
  return map;
}

// ── 数据搜索类型标签映射 ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  asset: '资产',
  workorder: '工单',
  vendor: '供应商',
};

// ── 组件 ──────────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'page' | 'data'>('page');
  const [query, setQuery] = useState('');
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // 快捷键绑定
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // 数据搜索：300ms 防抖调用后端 API
  useEffect(() => {
    if (activeTab !== 'data' || !query.trim()) {
      setDataResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await globalSearch(query.trim());
        setDataResults(res?.data ?? []);
      } catch {
        setDataResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // 关闭时重置状态
      setQuery('');
      setActiveTab('page');
      setDataResults([]);
    }
  };

  const handleTabChange = (tab: 'page' | 'data') => {
    setActiveTab(tab);
    setQuery('');
    setDataResults([]);
  };

  // 按 type 分组数据搜索结果
  function groupDataResults(results: SearchResult[]) {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }

  // 数据搜索结果类型图标
  function ResultIcon({ type }: { type: string }) {
    switch (type) {
      case 'asset':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'workorder':
        return <FileText className="w-4 h-4 text-amber-500" />;
      case 'vendor':
        return <Truck className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  }

  const grouped = groupPages(SEARCHABLE_PAGES);

  // ── Tab 按钮样式 ─────────────────────────────────────────────────────────
  const tabBtn = (tab: 'page' | 'data') =>
    `px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
      activeTab === tab
        ? 'bg-blue-50 text-blue-600'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <>
      {/* 顶栏搜索触发按钮 — 桌面端 */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 h-8 px-3 w-56 text-sm bg-[#f8fafc] border border-[#e5e7eb] rounded-lg text-[#94a3b8] hover:text-[#64748b] hover:border-[#cbd5e1] transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="flex-1 text-left">搜索...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-medium text-[#94a3b8] bg-white border border-[#e5e7eb] rounded px-1.5 py-0.5">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* 移动端触发按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-8 h-8 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors cursor-pointer"
        aria-label="搜索"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {/* Cmd+K 命令面板 */}
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        {/* Tab 切换按钮 */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-gray-200">
          <button
            onClick={() => handleTabChange('page')}
            className={tabBtn('page')}
          >
            页面导航
          </button>
          <button
            onClick={() => handleTabChange('data')}
            className={tabBtn('data')}
          >
            数据搜索
          </button>
        </div>

        <CommandInput
          placeholder={"搜索页面或业务数据..."}
          value={query}
          onValueChange={setQuery}
        />

        <CommandList>
          {activeTab === 'page' ? (
            /* ── 页面导航 tab ─────────────────────────────────────────── */
            <>
              <CommandEmpty>未找到匹配的页面或数据</CommandEmpty>
              {Array.from(grouped.entries()).map(([group, pages]) => (
                <CommandGroup key={group} heading={group}>
                  {pages.map((page) => (
                    <CommandItem
                      key={page.path}
                      value={page.label}
                      onSelect={() => handleSelect(page.path)}
                    >
                      <span>{page.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </>
          ) : (
            /* ── 数据搜索 tab ─────────────────────────────────────────── */
            <>
              {!query.trim() && (
                <div className="py-8 text-center text-sm text-gray-400">
                  请输入关键词搜索
                </div>
              )}
              {isSearching && (
                <div className="py-8 text-center text-sm text-gray-400">
                  搜索中...
                </div>
              )}
              {!isSearching && query.trim() && dataResults.length === 0 && (
                <CommandEmpty>未找到匹配的页面或数据</CommandEmpty>
              )}
              {dataResults.length > 0 &&
                Array.from(groupDataResults(dataResults).entries()).map(
                  ([type, items]) => (
                    <CommandGroup
                      key={type}
                      heading={TYPE_LABELS[type] ?? type}
                    >
                      {items.map((r) => (
                        <CommandItem
                          key={`${r.type}-${r.id}`}
                          value={r.title}
                          onSelect={() => handleSelect(r.path)}
                        >
                          <ResultIcon type={r.type} />
                          <div className="flex flex-col">
                            <span>{r.title}</span>
                            <span className="text-xs text-gray-400">
                              {r.subtitle}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ),
                )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
