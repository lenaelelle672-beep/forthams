/**
 * @file pages/revaluation/RevaluationFormPage.tsx
 * @description 资产减值/重估表单页面
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TrendingUp, ArrowLeft, Search, Check, X, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  createRevaluation,
  getRevaluationDetail,
  approveRevaluation,
  updateRevaluation,
} from '@/api/revaluation';
import { getAssetById } from '@/api/asset';
import type { Asset } from '@/types/asset';

function formatAmount(n: number | undefined | null): string {
  if (n == null) return '-';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

export default function RevaluationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('id');
  const mode = searchParams.get('mode') || (viewId ? 'view' : 'create'); // 'view' | 'edit' | 'create'

  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [revaluationType, setRevaluationType] = useState<'IMPAIRMENT' | 'REVALUATION'>('IMPAIRMENT');
  const [newValue, setNewValue] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  // 如果是查看已有记录
  const { data: existingRecord } = useQuery({
    queryKey: ['revaluation', viewId],
    queryFn: () => getRevaluationDetail(Number(viewId)),
    enabled: !!viewId,
  });

  useEffect(() => {
    if (existingRecord) {
      setRevaluationType(existingRecord.revaluationType);
      setNewValue(existingRecord.newValue);
      setReason(existingRecord.reason || '');
      setEvidence(existingRecord.evidence || '');
      // 加载资产信息
      getAssetById(existingRecord.assetId).then((asset: any) => {
        setSelectedAsset(asset as Asset);
        setAssetSearch(asset?.assetNo || '');
      }).catch(() => {});
    }
  }, [existingRecord]);

  const handleAssetLookup = async () => {
    if (!assetSearch.trim()) return;
    try {
      const res = await getAssetById(Number(assetSearch));
      setSelectedAsset(res as Asset);
    } catch {
      toast.error('未找到资产');
    }
  };

  const createMutation = useMutation({
    mutationFn: () => createRevaluation({
      assetId: selectedAsset!.id!,
      revaluationType,
      newValue,
      reason: reason || undefined,
      evidence: evidence || undefined,
    }),
    onSuccess: () => { toast.success('创建成功'); navigate('/revaluations'); },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateRevaluation(Number(viewId!), {
      revaluationType,
      newValue,
      reason: reason || undefined,
      evidence: evidence || undefined,
    }),
    onSuccess: () => { toast.success('更新成功'); setIsEditing(false); },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });

  const approveMutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') =>
      approveRevaluation(Number(viewId!), {
        id: Number(viewId!),
        status,
        approvedBy: 1, // TODO: 从当前登录用户获取
      }),
    onSuccess: (res, status) => {
      toast.success(status === 'APPROVED' ? '审批通过' : '审批拒绝');
      navigate('/revaluations');
    },
    onError: (err: Error) => toast.error(err.message || '审批失败'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) { toast.error('请选择资产'); return; }
    if (isEditing && viewId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const diff = selectedAsset ? (newValue - (selectedAsset.currentValue ?? selectedAsset.originalValue ?? 0)) : 0;
  const isReadOnly = mode === 'view' && !isEditing;
  const canEdit = existingRecord && existingRecord.status === 'PENDING' && !isEditing;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isEditing
            ? '编辑减值/重估'
            : existingRecord
              ? '减值/重估详情'
              : '新增减值/重估'
        }
        subtitle="资产价值调整申请"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/revaluations')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
            {/* 资产选择 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">资产 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" placeholder="输入资产ID搜索..." value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <Button type="button" variant="outline" size="sm" onClick={handleAssetLookup}>
                  <Search className="w-4 h-4" /> 查找
                </Button>
              </div>
              {selectedAsset && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-semibold">{selectedAsset.assetNo} - {selectedAsset.assetName}</p>
                  <p className="text-gray-600 mt-1">当前价值: {formatAmount(selectedAsset.currentValue ?? selectedAsset.originalValue)}</p>
                </div>
              )}
            </div>

            {/* 类型选择 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">类型 <span className="text-red-500">*</span></label>
              <div className={`flex gap-4 ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={revaluationType === 'IMPAIRMENT'}
                    disabled={isReadOnly}
                    onChange={() => setRevaluationType('IMPAIRMENT')}
                  />
                  <span className="text-sm">减值</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={revaluationType === 'REVALUATION'}
                    disabled={isReadOnly}
                    onChange={() => setRevaluationType('REVALUATION')}
                  />
                  <span className="text-sm">重估</span>
                </label>
              </div>
            </div>

            {/* 新值 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">新值 (¥) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0" value={newValue || ''}
                onChange={e => setNewValue(parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {selectedAsset && newValue > 0 && (
                <p className={`text-xs mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diff >= 0 ? '增值' : '减值'}: {diff >= 0 ? '+' : ''}{formatAmount(diff)}
                </p>
              )}
            </div>

            {/* 原因 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">原因说明</label>
              <textarea
                rows={4}
                value={reason}
                disabled={isReadOnly}
                onChange={e => setReason(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            {/* 证据 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">证据材料</label>
              <textarea
                rows={3}
                value={evidence}
                disabled={isReadOnly}
                onChange={e => setEvidence(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                placeholder="提供相关证明材料链接或描述（可选）"
              />
            </div>

            {/* 审批操作区域（仅 PENDING 状态且非编辑模式显示） */}
            {existingRecord && existingRecord.status === 'PENDING' && !isEditing && (
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">审批操作</h3>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate('APPROVED')}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    审批通过
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate('REJECTED')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    审批拒绝
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              {!existingRecord ? (
                <>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!selectedAsset || createMutation.isPending}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    {createMutation.isPending ? '提交中…' : '提交申请'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/revaluations')}>取消</Button>
                </>
              ) : isEditing ? (
                <>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {updateMutation.isPending ? '保存中…' : '保存'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                </>
              ) : (
                <>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => navigate('/revaluations')}>关闭</Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
