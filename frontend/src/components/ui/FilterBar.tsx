/**
 * @file components/ui/FilterBar.tsx
 * @description 搜索栏 + 快速筛选标签 + 高级筛选入口
 */

import * as React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface QuickFilter {
  key: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  quickFilters?: QuickFilter[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  onAdvancedFilter?: () => void;
  activeFilterCount?: number;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  placeholder = '搜索...',
  onSearch,
  quickFilters,
  activeFilter,
  onFilterChange,
  onAdvancedFilter,
  activeFilterCount = 0,
  actions,
  className,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = React.useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch?.(e.target.value);
  };

  const clearSearch = () => {
    setSearchValue('');
    onSearch?.('');
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* 搜索行 */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            value={searchValue}
            onChange={handleSearch}
            placeholder={placeholder}
            className="w-full h-8 pl-9 pr-8 text-sm border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] placeholder:text-[#94a3b8]"
          />
          {searchValue && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#374151]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 高级筛选按钮 */}
        {onAdvancedFilter && (
          <Button variant="outline" size="md" onClick={onAdvancedFilter} className="gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            筛选
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}

        {/* 右侧操作按钮 */}
        {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
      </div>

      {/* 快速筛选标签 */}
      {quickFilters && quickFilters.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => onFilterChange?.('all')}
            className={cn(
              'h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              !activeFilter || activeFilter === 'all'
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]',
            )}
          >
            全部
          </button>
          {quickFilters.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => onFilterChange?.(key)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                activeFilter === key
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]',
              )}
            >
              {label}
              {count !== undefined && (
                <span
                  className={cn(
                    'ml-1 inline-flex items-center justify-center px-1 rounded-sm text-[10px]',
                    activeFilter === key ? 'bg-white/20' : 'bg-[#e2e8f0]',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
