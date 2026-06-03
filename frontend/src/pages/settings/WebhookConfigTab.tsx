/**
 * @file pages/settings/WebhookConfigTab.tsx
 * @description Webhook 配置管理 Tab
 *
 * 功能：Webhook 列表（分页）、新增/编辑/删除、启用/停用
 * Pattern: useState + http + toast
 */

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import http from '@/utils/http';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface WebhookItem {
  id: number;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  description?: string;
  enabled: number;
}

interface WebhookFormState {
  name: string;
  url: string;
  secret: string;
  events: string;
  description: string;
  enabled: boolean;
}

const EMPTY_FORM: WebhookFormState = {
  name: '',
  url: '',
  secret: '',
  events: '',
  description: '',
  enabled: true,
};

const PAGE_SIZE = 10;

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function WebhookConfigTab() {
  const [data, setData] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WebhookItem | null>(null);
  const [form, setForm] = useState<WebhookFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null);

  // ── 加载数据 ────────────────────────────────────────────────────────────
  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await http.get<any>('/webhook-configs', { params: { page: p, pageSize: PAGE_SIZE } });
      setData(res.data?.records || []);
      setTotal(res.data?.total || 0);
      setPage(p);
    } catch {
      toast.error('获取 Webhook 配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── 保存（新增/编辑） ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('名称和 URL 为必填项');
      return;
    }
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      secret: form.secret || undefined,
      events: form.events ? form.events.split(',').map(s => s.trim()).filter(Boolean) : [],
      description: form.description || undefined,
      enabled: form.enabled ? 1 : 0,
    };
    setSaving(true);
    try {
      if (editingItem) {
        await http.put(`/webhook-configs/${editingItem.id}`, payload);
        toast.success('更新成功');
      } else {
        await http.post('/webhook-configs', payload);
        toast.success('创建成功');
      }
      setModalVisible(false);
      fetchData(page);
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await http.delete(`/webhook-configs/${deleteTarget.id}`);
      toast.success('删除成功');
      setDeleteTarget(null);
      fetchData(page);
    } catch {
      toast.error('删除失败');
    }
  };

  // ── 打开弹窗 ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEdit = (item: WebhookItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      url: item.url,
      secret: item.secret || '',
      events: item.events?.join(', ') || '',
      description: item.description || '',
      enabled: item.enabled === 1,
    });
    setModalVisible(true);
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook 配置</CardTitle>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          新增 Webhook
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 加载中...
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-[#94a3b8] text-sm">
            暂无 Webhook 配置，点击「新增 Webhook」创建第一个配置
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">事件</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {data.map(item => (
                    <tr key={item.id} className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-3 font-medium text-[#0f172a]">{item.name}</td>
                      <td className="px-4 py-3 text-xs text-[#64748b] font-mono max-w-[200px] truncate" title={item.url}>
                        {item.url}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.events?.map(e => (
                            <span key={e} className="px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-600">
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.enabled === 1 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.enabled === 1 ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors mr-1"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f1f5f9]">
                <span className="text-xs text-[#94a3b8]">共 {total} 条</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => fetchData(page - 1)}
                    className="px-3 py-1.5 text-xs rounded border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f8fafc]"
                  >
                    上一页
                  </button>
                  <span className="px-3 py-1.5 text-xs text-[#64748b]">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => fetchData(page + 1)}
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
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalVisible(false)} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">
              {editingItem ? '编辑 Webhook' : '新增 Webhook'}
            </h3>
            <div className="space-y-4">
              <Input
                label="名称 *"
                placeholder="如 运维告警通知"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="URL *"
                placeholder="https://example.com/webhook"
                value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              />
              <Input
                label="签名密钥"
                placeholder="可选，用于验证签名"
                type="password"
                value={form.secret}
                onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
              />
              <Input
                label="订阅事件（逗号分隔） *"
                placeholder="CONTRACT_EXPIRING, WORK_ORDER_CREATED"
                value={form.events}
                onChange={e => setForm(p => ({ ...p, events: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="可选，简要说明此 Webhook 的用途"
                  className="px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                <span className="text-sm text-[#374151]">启用</span>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.enabled ? 'bg-[#3b82f6]' : 'bg-[#e5e7eb]'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModalVisible(false)} disabled={saving}>
                  取消
                </Button>
                <Button type="button" variant="primary" onClick={handleSave} loading={saving}>
                  {editingItem ? '保存修改' : '确认新增'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">确认删除</h3>
            <p className="text-sm text-gray-500">
              确定要删除 Webhook「{deleteTarget.name}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
