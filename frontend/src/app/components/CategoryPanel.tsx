/**
 * CategoryPanel — 资产分类树侧边栏
 *
 * 从 /categories/tree 拉取分类树数据，渲染为可折叠侧边树，
 * 点击节点后通过 onSelect 回调更新外部 categoryId 过滤条件。
 *
 * @module components/CategoryPanel
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Tag,
  Layers,
  RefreshCw,
} from "lucide-react";
import { categoryService } from "../services/categoryService";
import type { CategoryTreeNode } from "../services/categoryService";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface CategoryPanelProps {
  /** 当前选中的分类 code，null 表示"全部" */
  selectedCode: string | null;
  /** 选中回调 */
  onSelect: (code: string | null) => void;
  /** 面板标题，默认"资产分类" */
  title?: string;
}

/* ------------------------------------------------------------------ */
/*  Tree Node 子组件                                                    */
/* ------------------------------------------------------------------ */

interface TreeNodeProps {
  node: CategoryTreeNode;
  expandedCodes: Set<string>;
  selectedCode: string | null;
  onToggle: (code: string) => void;
  onSelect: (code: string | null) => void;
  level: number;
}

function TreeNode({
  node,
  expandedCodes,
  selectedCode,
  onToggle,
  onSelect,
  level,
}: TreeNodeProps) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = expandedCodes.has(node.code);
  const isSelected = selectedCode === node.code;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onSelect(isSelected ? null : node.code);
          if (hasChildren) onToggle(node.code);
        }}
        className={[
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm rounded-md transition-colors group",
          isSelected
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
        ].join(" ")}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {/* 展开/收起箭头 */}
        <span className="flex-shrink-0 w-4 h-4">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </span>

        {/* 图标 */}
        {hasChildren ? (
          <Layers className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
        ) : (
          <Tag className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
        )}

        {/* 名称 */}
        <span className="truncate flex-1">{node.name}</span>

        {/* 子节点数量 */}
        {hasChildren && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {node.children!.length}
          </span>
        )}
      </button>

      {/* 递归子节点 */}
      {hasChildren && isExpanded &&
        node.children!.map((child) => (
          <TreeNode
            key={child.code}
            node={child}
            expandedCodes={expandedCodes}
            selectedCode={selectedCode}
            onToggle={onToggle}
            onSelect={onSelect}
            level={level + 1}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  CategoryPanel 主组件                                               */
/* ------------------------------------------------------------------ */

/**
 * CategoryPanel
 *
 * 资产分类过滤树，嵌入在 AssetListPage 的左侧可拖拽面板中。
 * "全部" 选项始终置顶，选中时 onSelect(null)。
 */
export function CategoryPanel({
  selectedCode,
  onSelect,
  title = "资产分类",
}: CategoryPanelProps) {
  const [nodes, setNodes] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await categoryService.getTree();
      const data: CategoryTreeNode[] = Array.isArray(res?.data)
        ? (res.data as CategoryTreeNode[])
        : Array.isArray((res as unknown as { data: { data: CategoryTreeNode[] } })?.data?.data)
          ? (res as unknown as { data: { data: CategoryTreeNode[] } }).data.data
          : [];
      setNodes(data);
      // 默认展开第一层
      const firstLevelCodes = new Set(data.map((n) => n.code));
      setExpandedCodes(firstLevelCodes);
    } catch {
      setError("加载分类失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleToggle = useCallback((code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* 面板标题 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <button
          type="button"
          onClick={fetchTree}
          disabled={loading}
          className="p-1 rounded text-gray-400 hover:text-gray-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
          title="刷新分类"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 树内容 */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {/* "全部" 选项 */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            "w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm rounded-md transition-colors mb-0.5",
            selectedCode === null
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-700 hover:bg-gray-50",
          ].join(" ")}
        >
          <span className="w-4 h-4 flex-shrink-0" />
          <Layers className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
          <span className="flex-1">全部分类</span>
        </button>

        {/* 分隔线 */}
        <div className="border-t border-gray-200 my-1 mx-1" />

        {/* 加载中 */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">加载中...</span>
          </div>
        )}

        {/* 错误 */}
        {!loading && error && (
          <div className="px-3 py-4 text-xs text-red-500 text-center">
            {error}
            <button
              type="button"
              onClick={fetchTree}
              className="block mx-auto mt-1 text-blue-500 hover:underline"
            >
              重试
            </button>
          </div>
        )}

        {/* 空数据 */}
        {!loading && !error && nodes.length === 0 && (
          <div className="px-3 py-8 text-xs text-gray-400 text-center">
            暂无分类数据
          </div>
        )}

        {/* 树节点 */}
        {!loading && !error && nodes.map((node) => (
          <TreeNode
            key={node.code}
            node={node}
            expandedCodes={expandedCodes}
            selectedCode={selectedCode}
            onToggle={handleToggle}
            onSelect={onSelect}
            level={0}
          />
        ))}
      </div>
    </div>
  );
}

export default CategoryPanel;
