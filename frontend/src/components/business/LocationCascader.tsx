/**
 * @file components/business/LocationCascader.tsx
 * @description 位置选择器 — 搜索+树形弹窗模式，支持 1000+ 数据
 *
 * 点击触发按钮 → 弹出对话框 → 搜索过滤 + 树形浏览 → 点击选中
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { getLocationCascade } from '@/api/base';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Location } from '@/types/common';

interface LocationCascaderProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** 递归过滤树节点（名称匹配） */
function filterTree(nodes: Location[], keyword: string): Location[] {
  if (!keyword.trim()) return nodes;
  const kw = keyword.trim().toLowerCase();
  const result: Location[] = [];
  for (const node of nodes) {
    const match = (node.name ?? '').toLowerCase().includes(kw);
    const filteredChildren = node.children ? filterTree(node.children, kw) : [];
    if (match || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
    }
  }
  return result;
}

/** 展开树节点渲染 */
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  defaultExpanded,
}: {
  node: Location;
  depth: number;
  selectedId?: number;
  onSelect: (id: number, name: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <button
        type="button"
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors text-left
          ${isSelected ? 'bg-[#2563eb] text-white' : 'hover:bg-[#f1f5f9] text-[#334155]'}
        `}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(node.id, node.name ?? '');
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LocationCascader({
  value,
  onChange,
  label,
  error,
  placeholder = '请选择存放位置',
  disabled,
}: LocationCascaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: locationRes } = useQuery({
    queryKey: ['locations', 'cascade'],
    queryFn: getLocationCascade,
    staleTime: 1000 * 60 * 5,
  });

  const locations = locationRes as unknown as Location[] | undefined;
  const filtered = useMemo(() => filterTree(locations ?? [], search), [locations, search]);

  /** 查找选中节点的名称 */
  const selectedName = useMemo(() => {
    if (value == null || !locations) return '';
    function find(nodes: Location[]): string {
      for (const n of nodes) {
        if (n.id === value) return n.name ?? '';
        if (n.children) {
          const r = find(n.children);
          if (r) return r;
        }
      }
      return '';
    }
    return find(locations);
  }, [value, locations]);

  const handleSelect = (id: number, _name: string) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-[#374151] mb-1">{label}</label>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start text-left font-normal"
            disabled={disabled}
          >
            {value != null && selectedName ? (
              <span className="text-[#0f172a]">{selectedName}</span>
            ) : (
              <span className="text-[#94a3b8]">{placeholder}</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>选择存放位置</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                className="pl-9"
                placeholder="搜索位置名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto border border-[#e2e8f0] rounded-lg p-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[#94a3b8] py-8">无匹配位置</p>
              ) : (
                filtered.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={value}
                    onSelect={handleSelect}
                    defaultExpanded={!!search.trim()}
                  />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
