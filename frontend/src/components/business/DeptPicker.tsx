/**
 * @file components/business/DeptPicker.tsx
 * @description 部门选择器 — 搜索+树形弹窗模式
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { getDeptList } from '@/api/base';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Department } from '@/types/common';

interface DeptPickerProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  error?: string;
}

function filterTree(nodes: Department[], keyword: string): Department[] {
  if (!keyword.trim()) return nodes;
  const kw = keyword.trim().toLowerCase();
  const result: Department[] = [];
  for (const node of nodes) {
    const match = (node.deptName ?? '').toLowerCase().includes(kw);
    const children = node.children ? filterTree(node.children, kw) : [];
    if (match || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

function DeptNode({
  node, depth, selectedId, onSelect, defaultExpanded,
}: {
  node: Department; depth: number; selectedId?: number;
  onSelect: (id: number) => void; defaultExpanded: boolean;
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
          onSelect(node.id);
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{node.deptName}</span>
      </button>
      {hasChildren && expanded && node.children!.map((child) => (
        <DeptNode key={child.id} node={child} depth={depth+1}
          selectedId={selectedId} onSelect={onSelect} defaultExpanded={false} />
      ))}
    </div>
  );
}

export function DeptPicker({ value, onChange, error }: DeptPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: deptRes } = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDeptList(),
    staleTime: 1000 * 60 * 5,
  });

  const departments = deptRes as unknown as Department[] | undefined;
  const filtered = useMemo(() => filterTree(departments ?? [], search), [departments, search]);

  const selectedName = useMemo(() => {
    if (value == null || !departments) return '';
    function find(nodes: Department[]): string {
      for (const n of nodes) {
        if (n.id === value) return n.deptName ?? '';
        if (n.children) { const r = find(n.children); if (r) return r; }
      }
      return '';
    }
    return find(departments);
  }, [value, departments]);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">使用部门</label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-start text-left font-normal">
            {value != null && selectedName ? (
              <span className="text-[#0f172a]">{selectedName}</span>
            ) : (
              <span className="text-[#94a3b8]">请选择部门</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>选择部门</DialogTitle></DialogHeader>
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input className="pl-9" placeholder="搜索部门名称..." value={search}
                onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            <div className="max-h-80 overflow-y-auto border border-[#e2e8f0] rounded-lg p-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[#94a3b8] py-8">无匹配部门</p>
              ) : filtered.map((node) => (
                <DeptNode key={node.id} node={node} depth={0}
                  selectedId={value} onSelect={(id) => { onChange?.(id); setOpen(false); }}
                  defaultExpanded={!!search.trim()} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
