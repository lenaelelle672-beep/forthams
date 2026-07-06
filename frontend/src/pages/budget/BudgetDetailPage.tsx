/**
 * @file pages/budget/BudgetDetailPage.tsx
 * @description 预算详情页面
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, ArrowLeft, Edit, Trash2, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { getBudgetDetail, deleteBudget } from '@/api/budget';
import type { Budget } from '@/types/budget';

function formatAmount(n?: number): string {
  if (n == null) return '-';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function getTypeLabel(type?: string): string {
  const map: Record<string, string> = { PURCHASE: '采购', MAINTENANCE: '维保', OPERATION: '运营' };
  return map[type ?? ''] ?? (type ?? '-');
}

function getStatusVariant(status?: string): 'default' | 'success' | 'gray' {
  if (status === 'APPROVED') return 'success';
  if (status === 'CLOSED') return 'gray';
  return 'default';
}

function getStatusLabel(status?: string): string {
  const map: Record<string, string> = { DRAFT: '草稿', APPROVED: '已审批', CLOSED: '已关闭' };
  return map[status ?? ''] ?? (status ?? '-');
}

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: budget, isLoading, error } = useQuery({
    queryKey: ['budget', id],
    queryFn: () => getBudgetDetail(Number(id!)),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBudget(Number(id!)),
    onSuccess: () => { toast.success('预算删除成功'); navigate('/budgets'); },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });

  if (isLoading) return <div className="p-6 space-y-6"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (error || !budget) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
      <FileQuestion className="w-12 h-12 text-gray-400" />
      <p className="text-gray-500">未找到预算信息</p>
      <Button variant="outline" onClick={() => navigate('/budgets')}><ArrowLeft className="w-4 h-4" /> 返回列表</Button>
    </div>
  );

  const usedPct = budget.totalAmount > 0 ? ((budget.usedAmount || 0) / budget.totalAmount * 100) : 0;
  const remaining = (budget.totalAmount || 0) - (budget.usedAmount || 0) - (budget.committedAmount || 0);

  return (
    <div className="p-6 space-y-5">
      <Card className="shadow-md border-gray-200 bg-gradient-to-r from-white to-gray-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2.5 hover:bg-blue-50 rounded-full" onClick={() => navigate('/budgets')}>
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">预算详情</h1>
                <p className="text-sm text-gray-500 mt-1">{budget.budgetYear}年 · {getTypeLabel(budget.budgetType)}预算</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={getStatusVariant(budget.status)}>{getStatusLabel(budget.status)}</Badge>
              <Button variant="outline" size="md" onClick={() => navigate(`/budgets/${id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" /> 编辑
              </Button>
              <Button variant="destructive" size="md" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> 删除
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 预算执行进度 */}
      <Card><CardContent className="p-6">
        <h2 className="text-lg font-bold mb-4">预算执行进度</h2>
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div><span className="text-xs text-gray-500">预算总额</span><p className="text-xl font-bold text-blue-600">{formatAmount(budget.totalAmount)}</p></div>
          <div><span className="text-xs text-gray-500">已使用</span><p className="text-xl font-bold text-orange-500">{formatAmount(budget.usedAmount)}</p></div>
          <div><span className="text-xs text-gray-500">已承诺</span><p className="text-xl font-bold text-purple-600">{formatAmount(budget.committedAmount)}</p></div>
          <div><span className="text-xs text-gray-500">剩余</span><p className={`text-xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatAmount(remaining)}</p></div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">执行率</span>
            <span className={`font-semibold ${usedPct > 100 ? 'text-red-600' : usedPct > 80 ? 'text-orange-500' : 'text-green-600'}`}>
              {usedPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usedPct > 100 ? 'bg-red-500' : usedPct > 80 ? 'bg-orange-400' : 'bg-green-500'}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }} />
          </div>
        </div>
      </CardContent></Card>

      {/* 基本信息 */}
      <Card><CardContent className="p-6">
        <h2 className="text-lg font-bold mb-4">基本信息</h2>
        <div className="grid grid-cols-3 gap-6">
          <div><span className="text-xs text-gray-500">预算年度</span><p className="font-semibold">{budget.budgetYear}</p></div>
          <div><span className="text-xs text-gray-500">预算类型</span><p className="font-semibold"><Badge variant="purple">{getTypeLabel(budget.budgetType)}</Badge></p></div>
          <div><span className="text-xs text-gray-500">状态</span><p className="font-semibold"><Badge variant={getStatusVariant(budget.status)}>{getStatusLabel(budget.status)}</Badge></p></div>
          <div><span className="text-xs text-gray-500">部门ID</span><p className="font-semibold">{budget.deptId || '-'}</p></div>
          <div><span className="text-xs text-gray-500">分类ID</span><p className="font-semibold">{budget.categoryId || '-'}</p></div>
          <div><span className="text-xs text-gray-500">审批人</span><p className="font-semibold">{budget.approvedBy || '-'}</p></div>
        </div>
      </CardContent></Card>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6">
            <h3 className="text-base font-semibold mb-2">确认删除预算</h3>
            <p className="text-sm text-gray-600 mb-4">此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
              <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
