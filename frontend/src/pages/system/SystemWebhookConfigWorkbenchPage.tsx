import { type FormEvent, useEffect, useState } from 'react';
import {
  createSystemWebhookConfig,
  deleteSystemWebhookConfig,
  listSystemWebhookConfigs,
  testSystemWebhookConfig,
  updateSystemWebhookConfig,
  updateSystemWebhookConfigStatus,
  type SystemWebhookConfigPayload,
  type SystemWebhookConfigRecord,
} from '../../api/systemWebhookConfigs';

export const SYSTEM_WEBHOOK_CONFIG_ACTION_PERMISSIONS = {
  create: 'system:integration:edit',
  edit: 'system:integration:edit',
  delete: 'system:integration:delete',
  test: 'system:integration:test',
} as const;

type SystemWebhookConfigWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canTest?: boolean;
};

const EMPTY_FORM: SystemWebhookConfigPayload = {
  configName: '',
  eventType: '',
  targetUrl: '',
  enabled: true,
  signingStrategy: 'NONE',
  signingSecret: '',
  secret: '',
};

export default function SystemWebhookConfigWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
  canEdit = true,
  canDelete = true,
  canTest = true,
}: SystemWebhookConfigWorkbenchPageProps) {
  const [items, setItems] = useState<SystemWebhookConfigRecord[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<SystemWebhookConfigPayload>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    listSystemWebhookConfigs()
      .then((records) => {
        if (mounted) {
          setItems(records);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Webhook 配置加载失败，敏感细节已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [canView]);

  const handleConfigCheck = async (id: number) => {
    try {
      const result = await testSystemWebhookConfig(id);
      setNotice(`${result.message}；config-only=${result.configOnly}`);
    } catch {
      setNotice('配置校验失败，敏感细节已脱敏');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const buildPayload = (): SystemWebhookConfigPayload => ({
    configName: form.configName.trim(),
    eventType: form.eventType.trim(),
    targetUrl: form.targetUrl.trim(),
    enabled: Boolean(form.enabled),
    signingStrategy: form.signingStrategy || 'NONE',
    signingSecret: form.signingSecret?.trim() || undefined,
    secret: form.secret?.trim() || undefined,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      setNotice('缺少 system:integration:edit 权限，不能保存 Webhook 配置。');
      return;
    }
    setSaving(true);
    try {
      const saved = editingId == null
        ? await createSystemWebhookConfig(buildPayload())
        : await updateSystemWebhookConfig(editingId, buildPayload());
      setItems((current) => editingId == null
        ? [saved, ...current]
        : current.map((item) => (item.id === editingId ? saved : item)));
      setNotice(editingId == null ? 'Webhook 配置已创建' : 'Webhook 配置已更新');
      resetForm();
    } catch {
      setNotice('Webhook 配置保存失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: SystemWebhookConfigRecord) => {
    setEditingId(item.id);
    setForm({
      configName: item.configName,
      eventType: item.eventType,
      targetUrl: item.maskedTargetUrl,
      enabled: item.enabled,
      signingStrategy: item.signingStrategy || 'NONE',
      signingSecret: '',
      secret: '',
    });
    setNotice('正在编辑脱敏配置；如需更换密钥请重新输入。');
  };

  const handleStatusToggle = async (item: SystemWebhookConfigRecord) => {
    if (!canEdit) {
      setNotice('缺少 system:integration:edit 权限，不能启停 Webhook 配置。');
      return;
    }
    try {
      const updated = await updateSystemWebhookConfigStatus(item.id, !item.enabled);
      setItems((current) => current.map((record) => (record.id === item.id ? updated : record)));
      setNotice(updated.enabled ? 'Webhook 配置已启用' : 'Webhook 配置已停用');
    } catch {
      setNotice('Webhook 配置启停失败，敏感细节已脱敏');
    }
  };

  const handleDelete = async (item: SystemWebhookConfigRecord) => {
    if (!canDelete) {
      setNotice('缺少 system:integration:delete 权限，不能删除 Webhook 配置。');
      return;
    }
    if (item.enabled) {
      setNotice('请先停用 Webhook 配置后再删除。');
      return;
    }
    try {
      await deleteSystemWebhookConfig(item.id);
      setItems((current) => current.filter((record) => record.id !== item.id));
      setNotice('Webhook 配置已删除');
    } catch {
      setNotice('Webhook 配置删除失败，敏感细节已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问 Webhook 配置，请确认 system:integration:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div>
        <h3 className="text-lg font-semibold">Webhook 配置</h3>
        <p className="mt-1 text-sm text-slate-500">只加载 /system/webhook-configs 配置，配置校验仅做 config-only 验证，未触发真实外部调用。</p>
      </div>
      {notice ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <form className="rounded-2xl border border-slate-200 p-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold">{editingId == null ? '新增 Webhook 配置' : '编辑 Webhook 配置'}</h4>
          {!canEdit ? <span className="text-xs text-amber-600">缺少 system:integration:edit 权限</span> : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-600">
            配置名称
            <input
              aria-label="配置名称"
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.configName}
              onChange={(event) => setForm((current) => ({ ...current, configName: event.target.value }))}
              placeholder="资产 Webhook"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            事件类型
            <input
              aria-label="事件类型"
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.eventType}
              onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))}
              placeholder="ASSET_SYNC"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-600 md:col-span-2">
            目标 URL
            <input
              aria-label="目标 URL"
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.targetUrl}
              onChange={(event) => setForm((current) => ({ ...current, targetUrl: event.target.value }))}
              placeholder="https://hooks.example.com/asset/sync"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            签名策略
            <select
              aria-label="签名策略"
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={form.signingStrategy}
              onChange={(event) => setForm((current) => ({ ...current, signingStrategy: event.target.value }))}
            >
              <option value="NONE">NONE</option>
              <option value="HMAC_SHA256">HMAC_SHA256</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            签名密钥
            <input
              aria-label="签名密钥"
              className="rounded-xl border border-slate-200 px-3 py-2"
              type="password"
              value={form.signingSecret ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, signingSecret: event.target.value }))}
              placeholder="仅提交，不回显"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            共享 Secret
            <input
              aria-label="共享 Secret"
              className="rounded-xl border border-slate-200 px-3 py-2"
              type="password"
              value={form.secret ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, secret: event.target.value }))}
              placeholder="仅提交，不回显"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              aria-label="启用配置"
              checked={Boolean(form.enabled)}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
            启用配置
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canEdit || saving} type="submit">
            {editingId == null ? '新增配置' : '保存配置'}
          </button>
          {editingId != null ? <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" onClick={resetForm}>取消编辑</button> : null}
        </div>
      </form>
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">Webhook 配置加载中...</div> : null}
      {!loading && !error && items.length === 0 ? (
        <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无 Webhook 配置，请通过 V3 创建配置。</h3>
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">{item.configName}</h4>
                <p className="text-sm text-slate-500">{item.eventType} · {item.maskedTargetUrl}</p>
              </div>
              <button
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                type="button"
                disabled={!canTest}
                onClick={() => handleConfigCheck(item.id)}
              >
                配置校验
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>状态：{item.status ?? (item.enabled ? 'ENABLED' : 'DISABLED')}</p>
              <p>签名策略：{item.signingStrategy}</p>
              <p>敏感配置：{item.secretConfigured || item.signatureConfigured ? '已脱敏' : '未返回原值'}</p>
              <p>请求头：{item.maskedHeaders ? Object.keys(item.maskedHeaders).join('、') || '无' : '无'}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!canEdit} type="button" onClick={() => startEdit(item)}>编辑</button>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!canEdit} type="button" onClick={() => handleStatusToggle(item)}>
                {item.enabled ? '停用' : '启用'}
              </button>
              <button className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400" disabled={!canDelete || item.enabled} type="button" onClick={() => handleDelete(item)}>
                {item.enabled ? '停用后删除' : '删除'}
              </button>
            </div>
            {!canTest ? <p className="mt-2 text-xs text-amber-600">缺少 system:integration:test 权限，配置校验不可用。</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
