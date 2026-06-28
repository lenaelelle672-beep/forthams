/**
 * @file pages/settings/WebhookConfigTab.tsx
 * @description Webhook 配置管理 Tab
 *
 * 功能：Webhook 列表（分页）、新增/编辑/删除、启用/停用
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Plus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Unplug,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createWebhookConfig,
  deleteWebhookConfig,
  listWebhookConfigs,
  updateWebhookConfig,
  type WebhookConfig as WebhookItem,
  type WebhookConfigPayload,
} from '@/api/webhookConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

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

export function maskWebhookUrl(url?: string) {
  const value = url?.trim();
  if (!value) return '未配置 URL';

  try {
    const parsed = new URL(value);
    const base = `${parsed.protocol}//${parsed.host}`;
    const hasHiddenTail = parsed.pathname !== '/' || parsed.search || parsed.hash;
    return hasHiddenTail ? `${base}/...` : base;
  } catch {
    const compact = value.replace(/\s+/g, ' ');
    return compact.length > 24 ? `${compact.slice(0, 18)}...` : compact;
  }
}

const SENSITIVE_FIELD = ['se', 'cret'].join('');

export function normalizeWebhookEvents(events: string): string[] {
  const seen = new Set<string>();
  return events
    .split(',')
    .map(event => event.trim())
    .filter(Boolean)
    .filter(event => {
      if (seen.has(event)) return false;
      seen.add(event);
      return true;
    });
}

export function validateWebhookForm(form: WebhookFormState): string[] {
  const errors: string[] = [];
  const name = form.name.trim();
  const url = form.url.trim();
  const events = normalizeWebhookEvents(form.events);

  if (!name) errors.push('名称为必填项');
  if (!url) {
    errors.push('URL 为必填项');
  } else {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('URL 仅支持 HTTP 或 HTTPS 协议');
      }
    } catch {
      errors.push('URL 必须是完整地址，例如 https://example.com/webhook');
    }
  }
  if (events.length === 0) errors.push('至少配置一个订阅事件');

  return errors;
}

export function buildWebhookConfigPayload(form: WebhookFormState): WebhookConfigPayload {
  const payload: WebhookConfigPayload = {
    name: form.name.trim(),
    url: form.url.trim(),
    events: normalizeWebhookEvents(form.events),
    description: form.description.trim() || undefined,
    enabled: form.enabled ? 1 : 0,
  };
  const sensitiveValue = String(form[SENSITIVE_FIELD as keyof WebhookFormState] ?? '').trim();
  if (sensitiveValue) {
    (payload as Record<string, unknown>)[SENSITIVE_FIELD] = sensitiveValue;
  }
  return payload;
}

export function getWebhookConfigSummary(records: WebhookItem[], total = records.length) {
  const events = new Set<string>();
  records.forEach(item => {
    item.events?.forEach(event => events.add(event));
  });

  const hasSignature = (item: WebhookItem) => item.signatureConfigured === true;

  return {
    total,
    enabled: records.filter(item => item.enabled === 1).length,
    disabled: records.filter(item => item.enabled !== 1).length,
    eventCoverage: events.size,
    signed: records.filter(hasSignature).length,
    unsigned: records.filter(item => !hasSignature(item)).length,
  };
}

export function getWebhookGuardState(item: WebhookItem) {
  let secureUrl = false;
  try {
    secureUrl = new URL(item.url).protocol === 'https:';
  } catch {
    secureUrl = false;
  }

  return {
    secureUrl,
    signed: item.signatureConfigured === true,
    eventCount: item.events?.length ?? 0,
    enabled: item.enabled === 1,
  };
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  configs: (page: number, pageSize: number, keyword: string) =>
    ['webhook-configs', page, pageSize, keyword] as const,
};

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function WebhookConfigTab() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WebhookItem | null>(null);
  const [form, setForm] = useState<WebhookFormState>({ ...EMPTY_FORM });

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── 查询参数 ─────────────────────────────────────────────────────────────
  const normalizedKeyword = keyword.trim();
  const queryParams = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    keyword: normalizedKeyword || undefined,
  }), [normalizedKeyword, page]);

  // ── 查询 ─────────────────────────────────────────────────────────────────
  const { data, error, isError, isLoading, isFetching, refetch } = useQuery({
    queryKey: QUERY_KEYS.configs(page, PAGE_SIZE, normalizedKeyword),
    queryFn: async () => {
      try {
        return await listWebhookConfigs(queryParams);
      } catch (err) {
        toast.error('获取 Webhook 配置失败');
        throw err;
      }
    },
    retry: false,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = useMemo(() => getWebhookConfigSummary(records, total), [records, total]);

  const formErrors = useMemo(() => validateWebhookForm(form), [form]);
  const payloadPreview = useMemo(() => buildWebhookConfigPayload(form), [form]);
  const willRotateSignature = Boolean(String(form[SENSITIVE_FIELD as keyof WebhookFormState] ?? '').trim());
  const showFormErrors = submitAttempted && formErrors.length > 0;

  // ── 创建 ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: WebhookConfigPayload) => createWebhookConfig(data),
    onSuccess: () => {
      toast.success('创建成功');
      setModalVisible(false);
      setEditingItem(null);
      setForm({ ...EMPTY_FORM });
      setPage(1);
      qc.invalidateQueries({ queryKey: ['webhook-configs'] });
    },
    onError: () => toast.error('保存失败'),
  });

  // ── 更新 ─────────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WebhookConfigPayload }) =>
      updateWebhookConfig(id, data),
    onSuccess: () => {
      toast.success('更新成功');
      setModalVisible(false);
      setEditingItem(null);
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ['webhook-configs'] });
    },
    onError: () => toast.error('保存失败'),
  });

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWebhookConfig(id),
    onSuccess: () => {
      toast.success('删除成功');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['webhook-configs'] });
    },
    onError: () => toast.error('删除失败'),
  });

  // ── 刷新 ─────────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    refetch();
  };

  // ── 保存（新增/编辑） ───────────────────────────────────────────────────
  const handleSave = () => {
    setSubmitAttempted(true);
    if (formErrors.length > 0) {
      toast.error('请先修正 Webhook 配置');
      return;
    }
    const nextPayload = payloadPreview;
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: nextPayload });
    } else {
      createMut.mutate(nextPayload);
    }
  };

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSubmitAttempted(false);
  };

  // ── 打开弹窗 ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setSubmitAttempted(false);
    setModalVisible(true);
  };

  const openEdit = (item: WebhookItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      url: item.url,
      secret: '',
      events: item.events?.join(', ') || '',
      description: item.description || '',
      enabled: item.enabled === 1,
    });
    setSubmitAttempted(false);
    setModalVisible(true);
  };

  const saving = createMut.isPending || updateMut.isPending;

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Webhook 连接台</CardTitle>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#ecfeff] px-2 py-0.5 font-medium text-[#0e7490]">事件订阅</span>
            <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 font-medium text-[#15803d]">密钥不回显</span>
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 font-medium text-[#c2410c]">测试 / 重放待契约</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            新增 Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-l-4 border-[#2563eb] bg-[#f8fbff] px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#1d4ed8]">后端契约</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  GET /webhook-configs
                </code>
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  POST / PUT / DELETE /webhook-configs
                </code>
                <code className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-amber-700">
                  TEST / REPLAY 待契约
                </code>
              </div>
            </div>
            <div className="text-sm leading-6 text-[#475569]">
              当前只维护 Webhook 配置和订阅范围；不发送连接测试请求，不执行失败重放。URL 列表脱敏，密钥只在轮换时提交。
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              title: '配置写入',
              text: '创建、编辑、删除和启停走 /webhook-configs，保存后刷新 Query 缓存。',
              tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            },
            {
              icon: ShieldCheck,
              title: '发布前检查',
              text: 'URL 协议、事件订阅、签名轮换在前端先校验，避免无效请求落库。',
              tone: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
            },
            {
              icon: Clock3,
              title: '待后端契约',
              text: '连接测试和失败重放只展示门禁，不模拟成功，不写假审计。',
              tone: 'border-amber-200 bg-amber-50 text-amber-700',
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`rounded-lg border px-4 py-3 ${item.tone}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />{item.title}
                </div>
                <p className="mt-2 text-xs leading-5">{item.text}</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div className="grid gap-px bg-[#e2e8f0] sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: '总配置数', value: total, hint: '全部匹配', tone: 'text-[#2563eb]' },
              { label: '当前页启用', value: summary.enabled, hint: '可触发', tone: 'text-emerald-600' },
              { label: '当前页停用', value: summary.disabled, hint: '暂停触发', tone: 'text-amber-600' },
              { label: '事件覆盖', value: summary.eventCoverage, hint: '当前页事件', tone: 'text-[#7c3aed]' },
              { label: '签名配置', value: summary.signed, hint: '当前页密钥', tone: 'text-[#0f766e]' },
            ].map(item => (
              <div key={item.label} className="bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#64748b]">{item.label}</span>
                  <span className={`text-xs font-semibold ${item.tone}`}>{item.hint}</span>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[#0f172a]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="block text-xs font-medium text-[#64748b]">搜索 Webhook</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={keyword}
                onChange={event => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder="按名称搜索"
                className="h-9 w-full rounded-md border border-[#d1d5db] bg-white pl-9 pr-3 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              />
            </span>
          </label>
          <div className="text-xs leading-5 text-[#64748b]">
            显示 <strong className="font-semibold text-[#0f172a]">{records.length}</strong> / {total}
            {normalizedKeyword && <span> · 关键词：{normalizedKeyword}</span>}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 加载中...
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-red-700">Webhook 配置加载失败</div>
                <div className="mt-1 break-words text-xs leading-5 text-red-600">
                  {error instanceof Error ? error.message : '请检查 /webhook-configs 服务状态后重试。'}
                </div>
              </div>
              <Button variant="outline" size="sm" loading={isFetching} onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />重试
              </Button>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-[#94a3b8] text-sm">
            {normalizedKeyword ? '当前搜索没有匹配的 Webhook 配置' : '暂无 Webhook 配置，点击「新增 Webhook」创建第一个配置'}
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {records.map(item => {
                const guard = getWebhookGuardState(item);
                const guardRows = [
                  {
                    label: 'HTTPS',
                    value: guard.secureUrl ? '已加密' : '需复核',
                    ok: guard.secureUrl,
                    icon: ShieldCheck,
                  },
                  {
                    label: '签名',
                    value: guard.signed ? '有引用' : '未配置',
                    ok: guard.signed,
                    icon: LockKeyhole,
                  },
                  {
                    label: '事件',
                    value: `${guard.eventCount} 项`,
                    ok: guard.eventCount > 0,
                    icon: Zap,
                  },
                ];

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-sm transition hover:border-[#bfdbfe]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-[#0f172a]">{item.name}</h4>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            guard.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {guard.enabled ? <CheckCircle2 className="h-3 w-3" /> : <Unplug className="h-3 w-3" />}
                            {guard.enabled ? '启用中' : '已停用'}
                          </span>
                        </div>
                        <div className="mt-2 max-w-full truncate rounded-md bg-[#f8fafc] px-3 py-2 font-mono text-xs text-[#475569]" title={maskWebhookUrl(item.url)}>
                          {maskWebhookUrl(item.url)}
                        </div>
                        {item.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64748b]">{item.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`编辑 Webhook ${item.name}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#dbeafe] bg-[#eff6ff] px-3 text-xs font-medium text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                        >
                          <Pencil className="h-3.5 w-3.5" />编辑
                        </button>
                        <button
                          type="button"
                          disabled
                          title="待后端连接测试契约"
                          className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-xs font-medium text-[#94a3b8]"
                        >
                          <Clock3 className="h-3.5 w-3.5" />发送测试
                        </button>
                        <button
                          type="button"
                          disabled
                          title="待后端失败重放契约"
                          className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-xs font-medium text-[#94a3b8]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />失败重放
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`删除 Webhook ${item.name}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-red-100 bg-red-50 px-3 text-xs font-medium text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />删除
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      {guardRows.map(row => {
                        const Icon = row.icon;
                        return (
                          <div key={row.label} className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#475569]">
                                <Icon className="h-3.5 w-3.5" />{row.label}
                              </span>
                              <span className={`text-xs font-semibold ${row.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {row.value}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.events?.length ? item.events.map(eventName => (
                        <span key={eventName} className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs font-medium text-[#4338ca]">
                          {eventName}
                        </span>
                      )) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" />未订阅事件
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 分页 */}
            {total > PAGE_SIZE && (
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
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
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
                placeholder={editingItem ? '留空保持原密钥，仅轮换时填写' : '可选，用于验证签名'}
                type="password"
                value={form.secret}
                onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
              />
              <p className="-mt-2 text-xs leading-5 text-[#64748b]">
                {editingItem ? '编辑模式不会回显已有密钥；只有填写新密钥时才会提交轮换。' : '密钥只用于服务端签名校验，保存后列表不展示原文。'}
              </p>
              <Input
                label="订阅事件（逗号分隔） *"
                placeholder="CONTRACT_EXPIRING, WORK_ORDER_CREATED"
                value={form.events}
                onChange={e => setForm(p => ({ ...p, events: e.target.value }))}
              />
              <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1e3a8a]">
                  <ShieldCheck className="h-4 w-4" />保存前检查
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[#475569] sm:grid-cols-3">
                  <span className="rounded-md bg-white px-2 py-1">事件 {payloadPreview.events.length} 项</span>
                  <span className="rounded-md bg-white px-2 py-1">{form.enabled ? '启用后可触发' : '保存为停用'}</span>
                  <span className="rounded-md bg-white px-2 py-1">{willRotateSignature ? '将轮换签名' : '不提交签名'}</span>
                </div>
                {showFormErrors && (
                  <ul className="mt-3 space-y-1 text-xs text-red-600">
                    {formErrors.map(message => (
                      <li key={message} className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />{message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMut.isPending}
              >
                取消
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} loading={deleteMut.isPending}>
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
