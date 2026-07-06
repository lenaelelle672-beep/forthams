/**
 * @file pages/budget/BudgetFormPage.tsx
 * @description 预算新建/编辑表单页面
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wallet, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { createBudget, updateBudget, getBudgetDetail } from '@/api/budget';
import type { Budget } from '@/types/budget';

export default function BudgetFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<Partial<Budget>>({
    budgetYear: new Date().getFullYear(),
    deptId: undefined,
    categoryId: undefined,
    budgetType: 'PURCHASE',
    totalAmount: 0,
    status: 'DRAFT',
  });

  const { data: detail } = useQuery({
    queryKey: ['budget-detail', id],
    queryFn: () => getBudgetDetail(Number(id!)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detail) {
      setForm({
        budgetYear: detail.budgetYear,
        deptId: detail.deptId,
        categoryId: detail.categoryId,
        budgetType: detail.budgetType,
        totalAmount: detail.totalAmount,
        status: detail.status,
      });
    }
  }, [detail]);

  const createMutation = useMutation({
    mutationFn: () => createBudget(form),
    onSuccess: () => { toast.success('预算创建成功'); navigate('/budgets'); },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateBudget(Number(id!), form),
    onSuccess: () => { toast.success('预算更新成功'); navigate('/budgets'); },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const set = (field: keyof Budget, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? '编辑预算' : '新增预算'}
        subtitle={isEdit ? '修改预算信息' : '创建新的预算记录'}
        actions={<Button variant="outline" size="sm" onClick={() => navigate('/budgets')}><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</Button>}
      />
      <Card><CardContent className="p-6">
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">预算年度 <span className="text-red-500">*</span></label>
              <input type="number" required value={form.budgetYear || ''} onChange={e => set('budgetYear', parseInt(e.target.value) || new Date().getFullYear())}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">预算类型 <span className="text-red-500">*</span></label>
              <select value={form.budgetType} onChange={e => set('budgetType', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="PURCHASE">采购预算</option>
                <option value="MAINTENANCE">维保预算</option>
                <option value="OPERATION">运营预算</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">部门ID</label>
              <input type="number" value={form.deptId ?? ''} onChange={e => set('deptId', e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">分类ID</label>
              <input type="number" value={form.categoryId ?? ''} onChange={e => set('categoryId', e.target.value ? parseInt(e.target.value) : undefined)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">预算总额 (¥) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0" required value={form.totalAmount || ''} onChange={e => set('totalAmount', parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">状态</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="DRAFT">草稿</option>
                <option value="APPROVED">已审批</option>
                <option value="CLOSED">已关闭</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" variant="primary" disabled={createMutation.isPending || updateMutation.isPending}>
              <Wallet className="w-4 h-4 mr-1" />
              {createMutation.isPending || updateMutation.isPending ? '保存中…' : (isEdit ? '更新预算' : '创建预算')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/budgets')}>取消</Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  );
}
