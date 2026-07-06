/**
 * @file components/ui/PermissionTree.tsx
 * @description 权限树组件 — 支持半选状态（indeterminate）、展开/折叠全部、menuType 标签
 * 基于 Radix UI Checkbox + Tailwind CSS
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Check, Minus } from 'lucide-react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import type { MenuItem } from '@/api/menu';

// ─── 帮助函数 ───────────────────────────────────────────────────────────────

/** 收集一个 MenuItem 的所有后代 ID（不含自身） */
function getAllDescendantIds(item: MenuItem): number[] {
  const ids: number[] = [];
  if (item.children) {
    for (const child of item.children) {
      ids.push(child.id, ...getAllDescendantIds(child));
    }
  }
  return ids;
}

/** 计算节点的三态选中状态（递归：逐层检查直接子节点） */
function computeCheckedState(
  selectedSet: Set<number>,
  item: MenuItem,
): boolean | 'indeterminate' {
  const { children } = item;
  if (!children || children.length === 0) {
    return selectedSet.has(item.id);
  }

  let checkedCount = 0;
  let indeterminateCount = 0;

  for (const child of children) {
    const state = computeCheckedState(selectedSet, child);
    if (state === true) checkedCount++;
    else if (state === 'indeterminate') indeterminateCount++;
  }

  const total = children.length;
  if (checkedCount === total) return true;
  if (checkedCount > 0 || indeterminateCount > 0) return 'indeterminate';
  return false;
}

/** 收集树中所有节点 ID */
function collectAllIds(items: MenuItem[]): Set<number> {
  const ids = new Set<number>();
  const walk = (list: MenuItem[]) => {
    for (const item of list) {
      ids.add(item.id);
      if (item.children) walk(item.children);
    }
  };
  walk(items);
  return ids;
}

// ─── menuType 标签配置 ─────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  M: { label: '目录', className: 'text-blue-600 bg-blue-50' },
  C: { label: '菜单', className: 'text-green-600 bg-green-50' },
  F: { label: '按钮', className: 'text-gray-500 bg-gray-100' },
};

// ─── 树节点组件 ─────────────────────────────────────────────────────────────

interface TreeNodeProps {
  item: MenuItem;
  depth: number;
  selectedSet: Set<number>;
  expandedSet: Set<number>;
  onToggleCheck: (item: MenuItem) => void;
  onToggleExpand: (id: number) => void;
}

const TreeNode = React.memo(function TreeNode({
  item,
  depth,
  selectedSet,
  expandedSet,
  onToggleCheck,
  onToggleExpand,
}: TreeNodeProps) {
  const hasCh = !!(item.children && item.children.length > 0);
  const checked = useMemo(
    () => computeCheckedState(selectedSet, item),
    [selectedSet, item],
  );
  const expanded = expandedSet.has(item.id);
  const typeInfo = TYPE_LABEL[item.menuType] || null;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-gray-50"
        style={{ paddingLeft: 8 + depth * 22 }}
      >
        {/* 展开/折叠按钮 */}
        {hasCh ? (
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Radix UI 三态 Checkbox */}
        <CheckboxPrimitive.Root
          checked={checked}
          onCheckedChange={() => onToggleCheck(item)}
          className="w-4 h-4 shrink-0 rounded border border-gray-300 flex items-center justify-center
            data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500
            data-[state=indeterminate]:bg-blue-500 data-[state=indeterminate]:border-blue-500
            hover:border-blue-400 transition-colors"
          id={`perm-tree-${item.id}`}
        >
          <CheckboxPrimitive.Indicator>
            {checked === 'indeterminate' ? (
              <Minus className="w-3 h-3 text-white" />
            ) : (
              <Check className="w-3 h-3 text-white" />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

        {/* 名称 + 类型标签 + 权限码 */}
        <label
          htmlFor={`perm-tree-${item.id}`}
          className="flex items-center gap-1.5 cursor-pointer min-w-0 flex-1"
        >
          <span className="text-sm text-gray-800 truncate">{item.menuName}</span>
          {typeInfo && (
            <span
              className={`text-[10px] leading-none px-1.5 py-0.5 rounded shrink-0 ${typeInfo.className}`}
            >
              {typeInfo.label}
            </span>
          )}
          {item.perms && (
            <span className="text-xs text-gray-400 shrink-0">({item.perms})</span>
          )}
        </label>
      </div>

      {/* 子节点 */}
      {hasCh && expanded && (
        <div>
          {item.children!.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedSet={selectedSet}
              expandedSet={expandedSet}
              onToggleCheck={onToggleCheck}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── 权限树组件（导出） ─────────────────────────────────────────────────────

export interface PermissionTreeProps {
  /** 菜单树数据（来自 getMenuTree API） */
  items: MenuItem[];
  /** 当前选中的菜单 ID 列表 */
  selectedIds: number[];
  /** 选中变化回调 */
  onSelectionChange: (ids: number[]) => void;
}

export function PermissionTree({
  items,
  selectedIds,
  onSelectionChange,
}: PermissionTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => collectAllIds(items));

  // items 变化时默认展开全部
  React.useEffect(() => {
    setExpandedIds(collectAllIds(items));
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  /** 切换节点选中（父子联动） */
  const handleToggleCheck = useCallback(
    (item: MenuItem) => {
      const descendants = getAllDescendantIds(item);
      const allIds = [item.id, ...descendants];
      const prevSet = new Set(selectedIds);
      const allSelected = allIds.every((id) => prevSet.has(id));

      const next = new Set(prevSet);
      if (allSelected) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      onSelectionChange(Array.from(next));
    },
    [selectedIds, onSelectionChange],
  );

  /** 切换展开/折叠 */
  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 展开全部 */
  const handleExpandAll = useCallback(() => {
    setExpandedIds(collectAllIds(items));
  }, [items]);

  /** 折叠全部 */
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 pt-2 pb-1">
        <button
          type="button"
          onClick={handleExpandAll}
          className="inline-flex items-center justify-center rounded text-xs font-medium
            h-7 px-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50
            transition-colors"
        >
          展开全部
        </button>
        <button
          type="button"
          onClick={handleCollapseAll}
          className="inline-flex items-center justify-center rounded text-xs font-medium
            h-7 px-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50
            transition-colors"
        >
          折叠全部
        </button>
        <span className="ml-auto text-sm text-gray-500">
          已选{' '}
          <span className="font-medium text-blue-600">{selectedIds.length}</span>{' '}
          项
        </span>
      </div>

      {/* 树容器 */}
      <div className="max-h-[500px] overflow-y-auto py-2 border-y border-gray-100">
        {items.length > 0 ? (
          items.map((item) => (
            <TreeNode
              key={item.id}
              item={item}
              depth={0}
              selectedSet={selectedSet}
              expandedSet={expandedIds}
              onToggleCheck={handleToggleCheck}
              onToggleExpand={handleToggleExpand}
            />
          ))
        ) : (
          <div className="text-sm text-gray-400 py-4 text-center">暂无菜单数据</div>
        )}
      </div>
    </div>
  );
}
