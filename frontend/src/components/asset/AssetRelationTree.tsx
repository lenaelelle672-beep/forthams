/**
 * @file components/asset/AssetRelationTree.tsx
 * @description 资产父子关系树组件 — 递归展示、可展开/折叠、编辑模式下支持添加/删除
 */

import React, { useState } from 'react';
import { useAssetRelations, useRemoveRelation, useAddRelation, useRelationTree } from '@/hooks/asset/useAssetRelations';
import { useAssets } from '@/hooks/useAssetById';
import type { RelationVO, RelationTreeNode, AddRelationRequest } from '@/types/asset';
import { AssetRelationType, ASSET_RELATION_TYPE_LABELS } from '@/types/asset';
import { Button } from '@/components/ui/Button';
import { CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  GitBranch,
  FileQuestion,
} from 'lucide-react';

interface AssetRelationTreeProps {
  assetId: number | null;
  /** 是否处于只读模式（详情页展示） */
  readOnly?: boolean;
}

/**
 * 关系类型标签渲染。
 */
function RelationTypeBadge({ type }: { type: AssetRelationType }) {
  const colorMap: Record<AssetRelationType, string> = {
    [AssetRelationType.SPARE_PART]: 'bg-blue-50 text-blue-700 border-blue-200',
    [AssetRelationType.ACCESSORY]: 'bg-purple-50 text-purple-700 border-purple-200',
    [AssetRelationType.UPGRADE]: 'bg-green-50 text-green-700 border-green-200',
    [AssetRelationType.ATTACHMENT]: 'bg-orange-50 text-orange-700 border-orange-200',
    [AssetRelationType.OTHER]: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colorMap[type] || colorMap[AssetRelationType.OTHER]}`}>
      {ASSET_RELATION_TYPE_LABELS[type] || type}
    </span>
  );
}

/**
 * 递归树节点组件。
 */
function TreeNode({ node, assetId, readOnly, onDelete }: {
  node: RelationTreeNode;
  assetId: number;
  readOnly?: boolean;
  onDelete: (relationId: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-4 border-l border-[#e5e7eb] pl-4">
      <div className="flex items-center gap-2 py-2 group hover:bg-[#f8fafc] rounded-lg px-2 transition-colors">
        {/* 展开/折叠按钮 */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[#94a3b8] hover:text-[#475569] transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="flex-shrink-0 w-5 h-5" />
        )}

        {/* 节点内容 */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-[#0f172a] truncate">
            {node.childAssetName || `资产#${node.childAssetId}`}
          </span>
          {node.childAssetNo && (
            <span className="text-xs text-[#94a3b8] font-mono">{node.childAssetNo}</span>
          )}
          <RelationTypeBadge type={node.relationType as AssetRelationType} />
          {node.quantity > 1 && (
            <span className="text-xs text-[#64748b]">x{node.quantity}</span>
          )}
        </div>

        {/* 删除按钮 */}
        {!readOnly && (
          <button
            onClick={() => onDelete(node.relationId)}
            className="opacity-0 group-hover:opacity-100 p-1 text-[#94a3b8] hover:text-red-600 hover:bg-red-50 rounded transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 递归子节点 */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.relationId}
              node={child}
              assetId={assetId}
              readOnly={readOnly}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 平铺列表模式下的关系项组件。
 */
function RelationItem({ item, assetId, readOnly, onDelete }: {
  item: RelationVO;
  assetId: number;
  readOnly?: boolean;
  onDelete: (relationId: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[#e5e7eb] bg-white hover:border-[#dbe1ff] hover:shadow-sm transition-all group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#0f172a]">
            {item.childAssetName || `资产#${item.childAssetId}`}
          </span>
          {item.childAssetNo && (
            <span className="text-xs text-[#94a3b8] font-mono">{item.childAssetNo}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <RelationTypeBadge type={item.relationType as AssetRelationType} />
          {item.quantity > 1 && (
            <span className="text-xs text-[#64748b]">数量: {item.quantity}</span>
          )}
          {item.remark && (
            <span className="text-xs text-[#94a3b8] truncate">{item.remark}</span>
          )}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={() => onDelete(item.relationId)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-[#94a3b8] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * 添加关系表单（内联）。
 */
function AddRelationForm({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const addMutation = useAddRelation(assetId);
  const { data: allAssets } = useAssets();

  const [childAssetId, setChildAssetId] = useState<string>('');
  const [relationType, setRelationType] = useState<AssetRelationType>(AssetRelationType.OTHER);
  const [quantity, setQuantity] = useState<number>(1);
  const [remark, setRemark] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childAssetId) {
      toast.error('请选择子资产');
      return;
    }
    const payload: AddRelationRequest = {
      parentAssetId: assetId,
      childAssetId: Number(childAssetId),
      relationType,
      quantity,
      remark: remark || undefined,
    };
    await addMutation.mutateAsync(payload);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-[#f8fafc] rounded-lg border border-[#e5e7eb] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* 子资产选择 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">子资产 *</label>
          <select
            value={childAssetId}
            onChange={(e) => setChildAssetId(e.target.value)}
            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">请选择子资产</option>
            {(allAssets ?? [])
              .filter((a) => a.id !== assetId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetNo} - {a.assetName}
                </option>
              ))}
          </select>
        </div>

        {/* 关系类型 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">关系类型</label>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as AssetRelationType)}
            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {Object.entries(ASSET_RELATION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 数量 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">数量</label>
          <input
            type="number"
            min={1}
            max={9999}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 备注 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">备注</label>
          <input
            type="text"
            maxLength={200}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="可选"
            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" size="sm" loading={addMutation.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加
        </Button>
      </div>
    </form>
  );
}

export default function AssetRelationTree({ assetId, readOnly = false }: AssetRelationTreeProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const { data: relations, isLoading: listLoading } = useAssetRelations(assetId);
  const { data: treeData, isLoading: treeLoading } = useRelationTree(assetId);
  const removeMutation = useRemoveRelation(assetId!);

  const isLoading = listLoading || treeLoading;
  const isPending = removeMutation.isPending;
  const deleteRelation = assetId ? (relationId: number) => {
    if (window.confirm('确认删除此父子关系？删除后不可恢复。')) {
      removeMutation.mutate(relationId);
    }
  } : () => {};

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 视图切换 + 添加按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isPending}
              className="text-xs"
            >
              {showAddForm ? '取消' : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  添加关联
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-[#f8fafc] rounded-lg p-0.5 border border-[#e5e7eb]">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'tree'
                ? 'bg-white text-[#0f172a] shadow-sm border border-[#e5e7eb]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            树形视图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'list'
                ? 'bg-white text-[#0f172a] shadow-sm border border-[#e5e7eb]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            列表视图
          </button>
        </div>
      </div>

      {/* 添加关系表单 */}
      {showAddForm && assetId && (
        <AddRelationForm assetId={assetId} onClose={() => setShowAddForm(false)} />
      )}

      {/* 树形视图 */}
      {viewMode === 'tree' && (
        <>
          {treeData && treeData.length > 0 ? (
            <div className="space-y-1">
              {treeData.map((node) => (
                <TreeNode
                  key={node.relationId}
                  node={node}
                  assetId={assetId!}
                  readOnly={readOnly}
                  onDelete={deleteRelation}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] gap-2">
              <GitBranch className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">暂无关联资产</p>
              {!readOnly && <p className="text-xs">点击上方「添加关联」建立资产父子关系</p>}
            </div>
          )}
        </>
      )}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <>
          {relations && relations.length > 0 ? (
            <div className="space-y-2">
              {relations.map((item) => (
                <RelationItem
                  key={item.relationId}
                  item={item}
                  assetId={assetId!}
                  readOnly={readOnly}
                  onDelete={deleteRelation}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] gap-2">
              <FileQuestion className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">暂无关联资产</p>
              {!readOnly && <p className="text-xs">点击上方「添加关联」建立资产父子关系</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
