/**
 * @file components/shared/LocationCascader.tsx
 * @description 位置级联选择器 — 调用 locationService.getTree() 拉取数据
 *
 * 集成：
 * - 与 useSpatialTime() 双向绑定 URL searchParams（写入 locationId）
 * - 支持搜索过滤
 * - 支持清除
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
// 注意：Radix Popover 的弹出层是 children 模式（PopoverTrigger 触发 + PopoverContent 渲染），不支持 `content` prop
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSpatialTime } from './SpatialTimeContext';
import locationService, { type LocationNode } from '@/services/locationService';
import { cn } from '@/utils/cn';

interface LocationCascaderProps {
  className?: string;
  placeholder?: string;
}

/** 把 LocationNode 树扁平化并支持搜索 */
function flattenTree(
  nodes: LocationNode[],
  depth = 0,
  acc: Array<{ node: LocationNode; depth: number; pathName: string }> = [],
  parentPath = '',
): Array<{ node: LocationNode; depth: number; pathName: string }> {
  for (const n of nodes) {
    const pathName = parentPath ? `${parentPath} / ${n.name}` : n.name;
    acc.push({ node: n, depth, pathName });
    if (n.children && n.children.length > 0) {
      flattenTree(n.children, depth + 1, acc, pathName);
    }
  }
  return acc;
}

export const LocationCascader: React.FC<LocationCascaderProps> = ({
  className,
  placeholder = '选择空间单元',
}) => {
  const { query, setSpatialTime } = useSpatialTime();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || tree.length > 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    locationService
      .getTree()
      .then((data) => {
        if (cancelled) return;
        setTree(data || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '加载位置树失败');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tree.length]);

  const flat = useMemo(() => flattenTree(tree), [tree]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter((f) => f.pathName.toLowerCase().includes(q) || f.node.locationCode?.toLowerCase().includes(q));
  }, [flat, search]);

  const selectedLabel = useMemo(() => {
    if (!query.locationId) return null;
    const found = flat.find((f) => f.node.id === query.locationId);
    return found ? found.pathName : `#${query.locationId}`;
  }, [query.locationId, flat]);

  const handleSelect = (id: number) => {
    setSpatialTime({ locationId: id });
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    setSpatialTime({ locationId: null });
  };

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border transition-colors',
              query.locationId
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-[#e5e7eb] bg-white text-[#64748b] hover:bg-gray-50',
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px]">{selectedLabel || placeholder}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3 space-y-2">
          <Input
            autoFocus
            placeholder="搜索位置名称 / 编码"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="max-h-72 overflow-y-auto -mx-1 px-1">
            {loading ? (
              <div className="space-y-1.5 py-2">
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
              </div>
            ) : error ? (
              <div className="text-xs text-red-500 py-3 text-center">{error}</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={search ? '无匹配位置' : '暂无位置数据'}
                description={search ? '尝试更换关键词' : '请先在「位置管理」中维护空间层级'}
                className="py-4"
              />
            ) : (
              <ul className="space-y-0.5">
                {filtered.map(({ node, depth, pathName }) => {
                  const selected = query.locationId === node.id;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(node.id)}
                        className={cn(
                          'w-full text-left text-sm rounded px-2 py-1.5 hover:bg-blue-50 transition-colors flex items-center gap-2',
                          selected && 'bg-blue-50 text-blue-700 font-medium',
                        )}
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                      >
                        <MapPin className="w-3 h-3 text-[#94a3b8] shrink-0" />
                        <span className="truncate">{pathName}</span>
                        {node.locationCode && (
                          <span className="ml-auto text-[10px] text-[#94a3b8] font-mono shrink-0">
                            {node.locationCode}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {query.locationId && (
        <button
          type="button"
          onClick={handleClear}
          className="text-[#64748b] hover:text-red-500 p-1"
          title="清除空间筛选"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default LocationCascader;
