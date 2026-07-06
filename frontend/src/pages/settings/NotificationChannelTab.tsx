/**
 * @file pages/settings/NotificationChannelTab.tsx
 * @description 通知渠道配置 Tab
 *
 * 功能：渠道配置列表、新增/编辑/删除、启用/停用、发送测试消息
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
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

const TESTABLE_CHANNEL_TYPES = new Set(['DINGTALK', 'WECHAT']);

const EMPTY_FORM: CreateChannelConfigRequest = {
  channelType: 'DINGTALK',
  configName: '',
  webhookUrl: '',
  secret: '',
  enabled: 1,
  description: '',
};

export function buildChannelConfigPayload<T extends CreateChannelConfigRequest | UpdateChannelConfigRequest>(data: T): T {
  const payload: CreateChannelConfigRequest | UpdateChannelConfigRequest = {
    ...data,
    configName: data.configName?.trim(),
    webhookUrl: data.webhookUrl?.trim(),
    description: data.description?.trim(),
  };
  if (!payload.webhookUrl) {
    delete payload.webhookUrl;
  }
  const secret = data.secret?.trim();

  if (secret) {
    payload.secret = secret;
  } else {
    delete payload.secret;
  }

  return payload as T;
}

function getWebhookDisplay(config: ChannelConfig) {
  return config.webhookUrlMasked || (config.webhookUrlConfigured ? '已配置（已脱敏）' : '未配置');
}

function getChannelGuardState(config: ChannelConfig) {
  const webhookReady = config.webhookUrlConfigured === true;
  const typeReady = TESTABLE_CHANNEL_TYPES.has(config.channelType);
  const canTest = config.enabled === 1 && webhookReady && typeReady;

  if (!typeReady) {
    return { canTest, tone: 'muted', text: '待接入测试通道' };
  }
  if (!webhookReady) {
    return { canTest, tone: 'danger', text: '缺少 Webhook' };
  }
  if (config.enabled !== 1) {
    return { canTest, tone: 'muted', text: '停用中' };
  }
  return { canTest, tone: 'ready', text: '可测试' };
}

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
          webhookUrl: '',
          secret: '',
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
    if (!form.configName.trim()) {
      toast.error('请填写配置名称');
      return;
    }
    if (!config && !form.webhookUrl.trim()) {
      toast.error('新增渠道必须填写 Webhook URL');
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            label={config ? 'Webhook URL（留空保持原地址）' : 'Webhook URL *'}
            placeholder={config ? '需要替换地址时再填写新 Webhook URL' : '粘贴机器人 Webhook URL'}
            value={form.webhookUrl}
            onChange={e => set('webhookUrl', e.target.value)}
            required={!config}
            hint={config ? `当前地址：${getWebhookDisplay(config)}` : '保存后列表仅显示脱敏地址'}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="签名密钥"
              placeholder={config ? '留空保持原密钥，仅轮换时填写' : '钉钉签名模式需要填写'}
              value={form.secret || ''}
              onChange={e => set('secret', e.target.value)}
              hint={config ? '留空保持原密钥，仅轮换时填写' : '钉钉签名模式需要填写，企业微信不需要'}
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

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            维护提示：新增或改动后先发送测试消息再启用；列表只展示脱敏 Webhook；签名密钥仅用于授权维护，不要在工单、截图或聊天中共享。
          </div>

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
  const [testingChannelTypes, setTestingChannelTypes] = useState<string[]>([]);

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

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['channel-configs', queryParams],
    queryFn: async () => {
      const res = await channelConfigApi.list(queryParams);
      return res as unknown as PageResponse<ChannelConfig>;
    },
    retry: false,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const enabledRecords = records.filter(record => record.enabled === 1);
  const disabledCount = records.length - enabledRecords.length;
  const readyRecords = records.filter(record => getChannelGuardState(record).canTest);
  const missingWebhookCount = records.filter(record => record.webhookUrlConfigured !== true).length;
  const unsupportedTypeCount = records.filter(record => !TESTABLE_CHANNEL_TYPES.has(record.channelType)).length;
  const enabledChannelTypes = Array.from(new Set(readyRecords.map(record => record.channelType)));
  const coveredChannelTypes = Array.from(new Set(records.map(record => record.channelType)));
  const coveredChannelText = coveredChannelTypes.length
    ? coveredChannelTypes.map(type => CHANNEL_TYPE_LABELS[type] || type).join('、')
    : '无';
  const testingChannelText = testingChannelTypes
    .map(type => CHANNEL_TYPE_LABELS[type] || type)
    .join('、');
  const hasActiveFilters = Boolean(keyword || channelType);
  const selectedTypeLabel = channelType ? (CHANNEL_TYPE_LABELS[channelType] || channelType) : '';
  const emptyStateText = hasActiveFilters
    ? `当前搜索${keyword ? `「${keyword}」` : ''}${selectedTypeLabel ? `、类型「${selectedTypeLabel}」` : ''}下没有通知渠道记录。`
    : '暂无通知渠道配置，请先新增渠道并完成测试后再启用。';

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
    onMutate: (channelType: string) => {
      setTestingChannelTypes(prev => (prev.includes(channelType) ? prev : [...prev, channelType]));
    },
    onSuccess: (res: any, channelType: string) => {
      const msg = (res as unknown as string) || '测试消息发送成功';
      toast.success(`${CHANNEL_TYPE_LABELS[channelType] || channelType}：${msg}`);
    },
    onError: (err: any, channelType: string) =>
      toast.error(`${CHANNEL_TYPE_LABELS[channelType] || channelType}：${err?.message || '测试发送失败'}`),
    onSettled: (_res, _err, channelType: string) => {
      setTestingChannelTypes(prev => prev.filter(type => type !== channelType));
    },
  });

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleSubmit = (data: CreateChannelConfigRequest | UpdateChannelConfigRequest) => {
    const payload = buildChannelConfigPayload(data);
    if (editingConfig) {
      updateMut.mutate({ id: editingConfig.id, data: payload as UpdateChannelConfigRequest });
    } else {
      createMut.mutate(payload as CreateChannelConfigRequest);
    }
  };

  const handleDelete = () => {
    if (deletingConfig) deleteMut.mutate(deletingConfig.id);
  };

  const handleTest = (channelType: string) => {
    if (testingChannelTypes.includes(channelType)) return;
    testMut.mutate(channelType);
  };

  const handleTestAll = () => {
    if (enabledChannelTypes.length === 0) {
      toast.info('当前页没有可测试的启用渠道');
      return;
    }
    enabledChannelTypes.forEach(type => handleTest(type));
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
      <CardHeader className="flex-wrap items-start bg-[linear-gradient(120deg,#ffffff_0%,#f8fafc_52%,#eef6ff_100%)]">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#2563eb]" />
            通知渠道连接台
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#ecfeff] px-2 py-0.5 font-medium text-[#0e7490]">真实测试端点</span>
            <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 font-medium text-[#15803d]">Webhook 脱敏</span>
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 font-medium text-[#c2410c]">编辑留空不轮换</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAll}
            disabled={testingChannelTypes.length > 0 || enabledChannelTypes.length === 0}
            title={enabledChannelTypes.length === 0 ? '当前页没有可测试的启用渠道' : '测试当前页可测试渠道'}
          >
            <Play className="w-4 h-4" />
            测试可用渠道
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setEditingConfig(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            新增渠道
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-l-4 border-[#2563eb] bg-[#f8fbff] px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#1d4ed8]">后端契约</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  GET /system/channel-configs
                </code>
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  POST /system/channel-configs/:type/test
                </code>
              </div>
            </div>
            <div className="text-sm leading-6 text-[#475569]">
              当前页面只展示脱敏后的 Webhook 地址；钉钉和企业微信支持按渠道类型测试，点击测试会发送到该类型全部已启用配置。
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '筛选总数', value: total, hint: '全部匹配', icon: Activity, tone: 'text-[#2563eb]' },
            { label: '可测类型', value: enabledChannelTypes.length, hint: '按类型去重', icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: '缺少地址', value: missingWebhookCount, hint: '需补齐 Webhook', icon: Link2, tone: 'text-amber-600' },
            { label: '待接入测试', value: unsupportedTypeCount, hint: '后端未开放', icon: ShieldCheck, tone: 'text-[#7c3aed]' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#64748b]">{item.label}</span>
                  <Icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[#0f172a]">{item.value}</div>
                <div className="mt-1 text-xs text-[#94a3b8]">{item.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium text-[#0f172a]">当前页操作预检</span>
            <span className="text-[#64748b]">本页 <b className="text-[#0f172a]">{records.length}</b></span>
            <span className="text-[#64748b]">启用 <b className="text-emerald-700">{enabledRecords.length}</b></span>
            <span className="text-[#64748b]">停用 <b className="text-slate-500">{disabledCount}</b></span>
            <span className="min-w-0 text-[#64748b]">
              类型覆盖 <b className="text-[#0f172a]">{coveredChannelTypes.length}</b>
              <span className="ml-1 break-words">（{coveredChannelText}）</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-[#64748b]">
            {enabledChannelTypes.length > 0
              ? `批量测试将按类型发送，覆盖当前页可测试的 ${enabledChannelTypes.length} 类渠道；每类会触发后端全部已启用配置。`
              : '当前页没有可测试的启用渠道，需先补齐地址、启用配置并确认测试通道已接入。'}
            {testingChannelText ? ` 正在测试：${testingChannelText}。` : ''}
          </p>
        </div>

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
          <Button variant="outline" size="md" onClick={() => refetch()} disabled={isFetching}>
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

        {!isLoading && isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-red-700">通知渠道配置加载失败</p>
            <p className="mt-1 text-xs text-red-600">
              {(error as Error)?.message || '请稍后重试或联系管理员。'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              重试
            </Button>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {records.length === 0 ? (
              <div className="py-12 text-center text-[#64748b] text-sm">{emptyStateText}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">Webhook</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">门禁</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {records.map(c => {
                      const isTestingThisType = testingChannelTypes.includes(c.channelType);
                      const channelLabel = CHANNEL_TYPE_LABELS[c.channelType] || c.channelType;
                      const guard = getChannelGuardState(c);
                      const webhookDisplay = getWebhookDisplay(c);
                      const guardClass = guard.tone === 'ready'
                        ? 'bg-emerald-50 text-emerald-700'
                        : guard.tone === 'danger'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600';
                      return (
                        <tr key={c.id} className="hover:bg-[#f8fafc]">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_BADGE[c.channelType] ?? 'bg-gray-100 text-gray-700'}`}>
                              {channelLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-[#0f172a]">{c.configName}</td>
                          <td className="px-4 py-3">
                            <div className="min-w-[180px] max-w-[260px]">
                              <div className="truncate rounded-md bg-[#f8fafc] px-2 py-1 font-mono text-xs text-[#475569]" title={webhookDisplay}>
                                {webhookDisplay}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                                <span className={`rounded-full px-1.5 py-0.5 ${c.webhookUrlConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {c.webhookUrlConfigured ? '地址已配置' : '地址缺失'}
                                </span>
                                <span className={`rounded-full px-1.5 py-0.5 ${c.signatureConfigured ? 'bg-[#eef2ff] text-[#4338ca]' : 'bg-slate-100 text-slate-500'}`}>
                                  {c.signatureConfigured ? '签名已配置' : '无签名'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${guardClass}`}>
                              {guard.tone === 'danger' ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                              {guard.text}
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
                              disabled={isTestingThisType || !guard.canTest}
                              className="inline-flex h-7 min-w-[76px] items-center justify-center gap-1.5 rounded px-2 text-xs text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#16a34a] transition-colors mr-1 disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                              title={guard.canTest ? `测试全部已启用的${channelLabel}渠道` : guard.text}
                            >
                              {isTestingThisType ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              {isTestingThisType ? '测试中' : '测类型'}
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
                      );
                    })}
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
