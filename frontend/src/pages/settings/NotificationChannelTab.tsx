/**
 * @file pages/settings/NotificationChannelTab.tsx
 * @description 通知渠道配置 Tab
 *
 * 功能：渠道配置列表、新增/编辑/删除、启用/停用、发送测试消息
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw, Send, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  channelConfigApi,
  type ChannelConfig,
  type CreateChannelConfigRequest,
  type UpdateChannelConfigRequest,
  type PageResponse,
  CHANNEL_TYPE_LABELS,
} from '@/api/channelConfig';

const PAGE_SIZE = 10;

const CHANNEL_TYPE_OPTIONS = [
  { key: '', label: '全部类型' },
  ...Object.entries(CHANNEL_TYPE_LABELS).map(([key, label]) => ({ key, label })),
];

const EMPTY_FORM: CreateChannelConfigRequest = {
  channelType: 'DINGTALK',
  configName: '',
  webhookUrl: '',
  secret: '',
  enabled: 1,
  description: '',
};

function ChannelFormDialog({
  open, config, submitting, onClose, onSubmit,
}: {
  open: boolean;
  config: ChannelConfig | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateChannelConfigRequest | UpdateChannelConfigRequest) => void;
}) {
  const [form, setForm] = useState<CreateChannelConfigRequest>({ ...EMPTY_FORM });

  React.useEffect(() => {
    if (open) {
      if (config) {
        setForm({
          channelType: config.channelType,
          configName: config.configName,
          webhookUrl: config.webhookUrl,
          secret: config.secret || '',
          enabled: config.enabled,
          description: config.description || '',
        });
      } else {
        setForm({ ...EMPTY_FORM });
      }
    }
  }, [open, config]);

  if (!open) return null;

  const set = (field: keyof CreateChannelConfigRequest, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.configName.trim() || !form.webhookUrl.trim()) {
      toast.error('配置名称和 Webhook URL 为必填项');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-[#0f172a] mb-5">
          {config ? '编辑通知渠道' : '新增通知渠道'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">渠道类型 *</label>
              <select
                value={form.channelType}
                onChange={e => set('channelType', e.target.value)}
                disabled={!!config}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                {Object.entries(CHANNEL_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <Input
              label="配置名称 *"
              placeholder="如 运维群钉钉机器人"
              value={form.configName}
              onChange={e => set('configName', e.target.value)}
              required
            />
          </div>

          <Input
            label="Webhook URL *"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            value={form.webhookUrl}
            onChange={e => set('webhookUrl', e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="签名密钥（Secret）"
              placeholder="钉钉签名模式需要填写"
              value={form.secret || ''}
              onChange={e => set('secret', e.target.value)}
              hint="钉钉签名模式需要填写，企业微信不需要"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">状态</label>
              <select
                value={form.enabled}
                onChange={e => set('enabled', Number(e.target.value))}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                <option value={1}>启用</option>
                <option value={0}>停用</option>
              </select>
            </div>
          </div>

          <Input
            label="描述"
            placeholder="可选，简要说明此配置的用途"
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {config ? '保存修改' : '确认新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  open, config, deleting, onClose, onConfirm,
}: {
  open: boolean;
  config: ChannelConfig | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-3">确认删除</h3>
        <p className="text-sm text-[#64748b] mb-6">
          确定要删除通知渠道「<span className="font-medium text-[#0f172a]">{config.configName}</span>」
          （{CHANNEL_TYPE_LABELS[config.channelType] || config.channelType}）吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationChannelTab() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [channelType, setChannelType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChannelConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<ChannelConfig | null>(null);

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    channelType: channelType || undefined,
    keyword: keyword || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['channel-configs', queryParams],
    queryFn: async () => {
      const res = await channelConfigApi.list(queryParams);
      return res as unknown as PageResponse<ChannelConfig>;
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const createMut = useMutation({
    mutationFn: (data: CreateChannelConfigRequest) => channelConfigApi.create(data),
    onSuccess: () => {
      toast.success('渠道配置创建成功');
      qc.invalidateQueries({ queryKey: ['channel-configs'] });
      setDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (err: any) => toast.error(err?.message || '创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateChannelConfigRequest }) =>
      channelConfigApi.update(id, data),
    onSuccess: () => {
      toast.success('渠道配置更新成功');
      qc.invalidateQueries({ queryKey: ['channel-configs'] });
      setDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (err: any) => toast.error(err?.message || '更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => channelConfigApi.delete(id),
    onSuccess: () => {
      toast.success('渠道配置已删除');
      qc.invalidateQueries({ queryKey: ['channel-configs'] });
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
    },
    onError: (err: any) => toast.error(err?.message || '删除失败'),
  });

  const testMut = useMutation({
    mutationFn: (channelType: string) => channelConfigApi.test(channelType),
    onSuccess: (res: any) => {
      const msg = (res as unknown as string) || '测试消息发送成功';
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err?.message || '测试发送失败'),
  });

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleSubmit = (data: CreateChannelConfigRequest | UpdateChannelConfigRequest) => {
    if (editingConfig) {
      updateMut.mutate({ id: editingConfig.id, data: data as UpdateChannelConfigRequest });
    } else {
      createMut.mutate(data as CreateChannelConfigRequest);
    }
  };

  const handleDelete = () => {
    if (deletingConfig) deleteMut.mutate(deletingConfig.id);
  };

  const handleTest = (channelType: string) => {
    testMut.mutate(channelType);
  };

  const submitting = createMut.isPending || updateMut.isPending;

  const TYPE_BADGE: Record<string, string> = {
    DINGTALK: 'bg-blue-100 text-blue-700',
    WECHAT: 'bg-green-100 text-green-700',
    EMAIL: 'bg-purple-100 text-purple-700',
  };

  const STATUS_BADGE: Record<number, string> = {
    1: 'bg-green-100 text-green-700',
    0: 'bg-[#f1f5f9] text-[#94a3b8]',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知渠道配置</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const types = ['DINGTALK', 'WECHAT'];
              types.forEach(t => handleTest(t));
            }}
            disabled={testMut.isPending}
          >
            <Play className="w-4 h-4" />
            测试所有渠道
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setEditingConfig(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            新增渠道
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              type="text"
              placeholder="搜索配置名称..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full h-9 pl-3 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8]"
            />
          </div>
          <select
            value={channelType}
            onChange={e => { setChannelType(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-[#e5e7eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] text-[#374151]"
          >
            {CHANNEL_TYPE_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <Button variant="outline" size="md" onClick={handleSearch}>搜索</Button>
          <Button variant="outline" size="md" onClick={() => qc.invalidateQueries({ queryKey: ['channel-configs'] })} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {!isLoading && (
          <>
            {records.length === 0 ? (
              <div className="py-12 text-center text-[#94a3b8] text-sm">暂无通知渠道配置</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">Webhook</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {records.map(c => (
                      <tr key={c.id} className="hover:bg-[#f8fafc]">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_BADGE[c.channelType] ?? 'bg-gray-100 text-gray-700'}`}>
                            {CHANNEL_TYPE_LABELS[c.channelType] || c.channelType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0f172a]">{c.configName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-[#64748b] font-mono truncate max-w-[200px] inline-block align-middle">
                            {c.webhookUrl}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[c.enabled] ?? STATUS_BADGE[0]}`}>
                            {c.enabled === 1 ? '启用' : '停用'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setEditingConfig(c); setDialogOpen(true); }}
                            className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors mr-1"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleTest(c.channelType)}
                            className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#16a34a] transition-colors mr-1"
                            title="发送测试"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeletingConfig(c); setDeleteDialogOpen(true); }}
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
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#94a3b8]">共 {total} 条记录，第 {page}/{totalPages} 页</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                <span className="text-sm text-[#64748b] px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <ChannelFormDialog
        open={dialogOpen}
        config={editingConfig}
        submitting={submitting}
        onClose={() => { setDialogOpen(false); setEditingConfig(null); }}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        config={deletingConfig}
        deleting={deleteMut.isPending}
        onClose={() => { setDeleteDialogOpen(false); setDeletingConfig(null); }}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
