/**
 * @file pages/settings/SysConfigTab.tsx
 * @description 系统参数管理 Tab — RuoYi 风格 CRUD
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getSysConfigList,
  createSysConfig,
  updateSysConfig,
  deleteSysConfig,
  refreshSysConfigCache,
  type SysConfigItem,
  type SysConfigPageResult,
} from '@/api/systemConfig';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#3b82f6]' : 'bg-[#e5e7eb]'}`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

interface FormState {
  configName: string;
  configKey: string;
  configValue: string;
  configType: string;
  remark: string;
  status: number;
}

const EMPTY_FORM: FormState = {
  configName: '',
  configKey: '',
  configValue: '',
  configType: 'N',
  remark: '',
  status: 0,
};

export default function SysConfigTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchName, setSearchName] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<SysConfigItem | null>(null);
  const [editingValue, setEditingValue] = useState<{ id: number; val: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sys-configs', page, pageSize, searchName, searchKey],
    queryFn: async () => {
      const res = await getSysConfigList({ page, pageSize, configName: searchName || undefined, configKey: searchKey || undefined });
      return res as unknown as SysConfigPageResult;
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;

  const createMut = useMutation({
    mutationFn: (d: typeof form) => createSysConfig(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys-configs'] });
      toast.success('参数创建成功');
      closeForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? '创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: typeof form }) => updateSysConfig(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys-configs'] });
      toast.success('参数更新成功');
      closeForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? '更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSysConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys-configs'] });
      toast.success('参数已删除');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? '删除失败'),
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshSysConfigCache(),
    onSuccess: () => {
      toast.success('缓存已刷新');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? '刷新失败'),
  });

  const inlineUpdateMut = useMutation({
    mutationFn: ({ id, configValue }: { id: number; configValue: string }) =>
      updateSysConfig(id, { configValue } as Partial<SysConfigItem>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sys-configs'] });
      setEditingValue(null);
      toast.success('参数值已更新');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '更新失败');
      setEditingValue(null);
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEditForm = (item: SysConfigItem) => {
    setEditingId(item.id);
    setForm({
      configName: item.configName ?? '',
      configKey: item.configKey ?? '',
      configValue: item.configValue ?? '',
      configType: item.configType ?? 'N',
      remark: item.remark ?? '',
      status: item.status ?? 0,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.configName.trim() || !form.configKey.trim()) {
      toast.error('参数名称和参数键名为必填项');
      return;
    }
    if (editingId != null) {
      updateMut.mutate({ id: editingId, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const startInlineEdit = (item: SysConfigItem) => {
    setEditingValue({ id: item.id, val: item.configValue ?? '' });
  };

  const saveInlineEdit = () => {
    if (editingValue) {
      inlineUpdateMut.mutate({ id: editingValue.id, configValue: editingValue.val });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统参数</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refreshMut.mutate()} loading={refreshMut.isPending}>
            <RefreshCw className="w-4 h-4" />
            刷新缓存
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateForm}>
            <Plus className="w-4 h-4" />
            新增参数
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 搜索表单 */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#f1f5f9]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              placeholder="参数名称"
              value={searchName}
              onChange={e => { setSearchName(e.target.value); setPage(1); }}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              placeholder="参数键名"
              value={searchKey}
              onChange={e => { setSearchKey(e.target.value); setPage(1); }}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">参数名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">参数键名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">参数值</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">内置/自定义</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">备注</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {records.map(item => (
                    <tr key={item.id} className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{item.id}</td>
                      <td className="px-4 py-3 font-medium text-[#0f172a]">{item.configName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{item.configKey}</td>
                      <td className="px-4 py-3">
                        {editingValue?.id === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editingValue.val}
                              onChange={e => setEditingValue(p => p ? { ...p, val: e.target.value } : null)}
                              className="h-7 px-2 rounded border border-[#3b82f6] text-xs w-32 focus:outline-none"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditingValue(null); }}
                            />
                            <button onClick={saveInlineEdit} className="text-[#3b82f6] text-xs hover:underline">保存</button>
                            <button onClick={() => setEditingValue(null)} className="text-[#94a3b8] text-xs hover:underline">取消</button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-[#3b82f6] border-b border-dashed border-[#d1d5db]"
                            onClick={() => startInlineEdit(item)}
                            title="点击编辑"
                          >
                            {item.configValue || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${item.configType === 'Y' ? 'bg-blue-50 text-blue-600' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                          {item.configType === 'Y' ? '内置' : '自定义'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 0 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {item.status === 0 ? '正常' : '停用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b] max-w-[150px] truncate" title={item.remark}>{item.remark || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEditForm(item)} className="text-[#3b82f6] hover:text-[#2563eb] text-xs mr-3">
                          <Pencil className="w-3.5 h-3.5 inline mr-1" />编辑
                        </button>
                        <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-xs">
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[#94a3b8] text-sm">暂无系统参数</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {total > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f1f5f9]">
                <span className="text-xs text-[#94a3b8]">共 {total} 条</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-xs rounded border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f8fafc]"
                  >
                    上一页
                  </button>
                  <span className="px-3 py-1.5 text-xs text-[#64748b]">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 text-xs rounded border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f8fafc]"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">
              {editingId != null ? '编辑参数' : '新增参数'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="参数名称 *" placeholder="如 邮件发送启用" value={form.configName} onChange={e => setForm(p => ({ ...p, configName: e.target.value }))} required />
                <Input label="参数键名 *" placeholder="如 ams.email.enabled" value={form.configKey} onChange={e => setForm(p => ({ ...p, configKey: e.target.value }))} required />
              </div>
              <Input label="参数值" placeholder="配置值" value={form.configValue} onChange={e => setForm(p => ({ ...p, configValue: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">内置/自定义</label>
                <select
                  value={form.configType}
                  onChange={e => setForm(p => ({ ...p, configType: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                >
                  <option value="N">自定义</option>
                  <option value="Y">系统内置</option>
                </select>
              </div>
              <Input label="备注" placeholder="参数说明" value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} />
              <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                <span className="text-sm text-[#374151]">状态</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94a3b8]">{form.status === 0 ? '正常' : '停用'}</span>
                  <Toggle checked={form.status === 0} onChange={v => setForm(p => ({ ...p, status: v ? 0 : 1 }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>取消</Button>
                <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
                  {editingId != null ? '确认修改' : '确认新增'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">确认删除参数</h3>
            <p className="text-sm text-gray-500">
              确定要删除参数「{deleteTarget.configName || deleteTarget.configKey}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={() => { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}>
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
