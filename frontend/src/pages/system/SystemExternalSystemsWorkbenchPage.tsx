import { type FormEvent, useEffect, useState } from 'react';
import {
  createSystemExternalSystem,
  disableSystemExternalSystem,
  enableSystemExternalSystem,
  listSystemExternalSystems,
  updateSystemExternalSystem,
  validateSystemExternalSystemConfig,
  type SystemExternalSystemPayload,
  type SystemExternalSystemRecord,
} from '../../api/systemExternalSystems';

export const SYSTEM_EXTERNAL_SYSTEMS_ACTION_PERMISSIONS = {
  create: 'system:integration:edit',
  edit: 'system:integration:edit',
  enable: 'system:integration:edit',
  disable: 'system:integration:edit',
  test: 'system:integration:test',
} as const;

type SystemExternalSystemsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canTest?: boolean;
};

type ExternalSystemFormState = SystemExternalSystemPayload & {
  credentialInput: string;
};

const EMPTY_FORM: ExternalSystemFormState = {
  systemCode: '',
  systemName: '',
  systemType: 'ERP',
  baseUrl: '',
  authType: 'API_KEY',
  authConfig: undefined,
  enabled: false,
  operatorId: 1,
  reason: 'V3 外部系统保存复核',
  auditEvidence: '',
  credentialInput: '',
};

function readOperatorId() {
  if (typeof window === 'undefined') {
    return EMPTY_FORM.operatorId;
  }
  for (const storage of [window.sessionStorage, window.localStorage]) {
    const raw = storage.getItem('user_info') ?? storage.getItem('ams_auth_user');
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as { id?: number; userId?: number };
      const candidate = parsed.userId ?? parsed.id;
      if (typeof candidate === 'number' && candidate > 0) {
        return candidate;
      }
    } catch {
      // 忽略本地用户缓存解析失败，页面仍使用显式操作人输入。
    }
  }
  return EMPTY_FORM.operatorId;
}

export default function SystemExternalSystemsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
  canEdit = true,
  canTest = true,
}: SystemExternalSystemsWorkbenchPageProps) {
  const [items, setItems] = useState<SystemExternalSystemRecord[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<ExternalSystemFormState>({ ...EMPTY_FORM, operatorId: readOperatorId() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    listSystemExternalSystems()
      .then((records) => {
        if (mounted) {
          setItems(records);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('外部系统加载失败，敏感细节已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [canView]);

  const resetForm = () => {
    setEditingId(null);
    setForm((current) => ({ ...EMPTY_FORM, operatorId: Number(current.operatorId) || readOperatorId() }));
  };

  const buildPayload = (): SystemExternalSystemPayload => ({
    systemCode: form.systemCode.trim(),
    systemName: form.systemName.trim(),
    systemType: form.systemType,
    baseUrl: form.baseUrl.trim(),
    authType: form.authType,
    authConfig: form.credentialInput.trim() ? { credential: form.credentialInput.trim() } : undefined,
    enabled: Boolean(form.enabled),
    operatorId: Number(form.operatorId),
    reason: form.reason?.trim() || 'V3 外部系统保存复核',
    auditEvidence: form.auditEvidence?.trim() || undefined,
  });

  const buildOperationPayload = (item: SystemExternalSystemRecord, action: 'enable' | 'disable') => ({
    confirmed: true,
    operatorId: Number(form.operatorId) || readOperatorId(),
    reason: action === 'enable' ? `启用外部系统 ${item.systemCode}` : `停用外部系统 ${item.systemCode}`,
    auditEvidence: 'Workbench V3 外部系统启停复核',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      setNotice('缺少 system:integration:edit 权限，不能保存外部系统。');
      return;
    }
    setSaving(true);
    try {
      const saved = editingId == null
        ? await createSystemExternalSystem(buildPayload())
        : await updateSystemExternalSystem(editingId, buildPayload());
      setItems((current) => editingId == null
        ? [saved, ...current]
        : current.map((item) => (item.id === editingId ? saved : item)));
      setNotice(editingId == null ? '外部系统已创建，认证材料仅保存脱敏摘要。' : '外部系统已更新，敏感配置未回显。');
      resetForm();
    } catch {
      setNotice('外部系统保存失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: SystemExternalSystemRecord) => {
    setEditingId(item.id);
    setForm({
      systemCode: item.systemCode,
      systemName: item.systemName,
      systemType: item.systemType,
      baseUrl: item.maskedBaseUrl,
      authType: item.authType || 'NONE',
      authConfig: undefined,
      enabled: item.enabled,
      operatorId: readOperatorId(),
      reason: 'V3 外部系统更新复核',
      auditEvidence: item.auditEvidenceSummary ?? '',
      credentialInput: '',
    });
    setNotice('正在编辑脱敏配置；如需更换认证材料请重新输入。');
  };

  const handleStatusToggle = async (item: SystemExternalSystemRecord) => {
    if (!canEdit) {
      setNotice('缺少 system:integration:edit 权限，不能启停外部系统。');
      return;
    }
    try {
      const updated = item.enabled
        ? await disableSystemExternalSystem(item.id, buildOperationPayload(item, 'disable'))
        : await enableSystemExternalSystem(item.id, buildOperationPayload(item, 'enable'));
      setItems((current) => current.map((record) => (record.id === item.id ? updated : record)));
      setNotice(updated.enabled ? '外部系统已启用，未触发真实外部调用。' : '外部系统已停用，未触发真实外部调用。');
    } catch {
      setNotice('外部系统启停失败，敏感细节已脱敏');
    }
  };

  const handleConfigCheck = async (item: SystemExternalSystemRecord) => {
    if (!canTest) {
      setNotice('缺少 system:integration:test 权限，不能执行配置校验。');
      return;
    }
    try {
      const result = await validateSystemExternalSystemConfig(item.id, {
        operatorId: Number(form.operatorId) || readOperatorId(),
        reason: `配置校验 ${item.systemCode}`,
      });
      setNotice(`${result.message}；config-only=${result.configOnly}；no-real-external-call=${result.noRealExternalCall}`);
    } catch {
      setNotice('外部系统配置校验失败，敏感细节已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问外部系统，请确认 system:integration:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div>
        <h3 className="text-lg font-semibold">外部系统</h3>
        <p className="mt-1 text-sm text-slate-500">真实调用 /system/external-systems；只展示目录、状态、认证掩码和 config-only 校验结果，未触发真实外部调用。</p>
      </div>
      {notice ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <form className="rounded-2xl border border-slate-200 p-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold">{editingId == null ? '新增外部系统' : '编辑外部系统'}</h4>
          {!canEdit ? <span className="text-xs text-amber-600">缺少 system:integration:edit 权限</span> : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-600">
            系统编码
            <input aria-label="系统编码" className="rounded-xl border border-slate-200 px-3 py-2" value={form.systemCode} onChange={(event) => setForm((current) => ({ ...current, systemCode: event.target.value }))} placeholder="ERP_CORE" />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            系统名称
            <input aria-label="系统名称" className="rounded-xl border border-slate-200 px-3 py-2" value={form.systemName} onChange={(event) => setForm((current) => ({ ...current, systemName: event.target.value }))} placeholder="ERP Core" />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            系统类型
            <select aria-label="系统类型" className="rounded-xl border border-slate-200 px-3 py-2" value={form.systemType} onChange={(event) => setForm((current) => ({ ...current, systemType: event.target.value }))}>
              <option value="ERP">ERP</option>
              <option value="MES">MES</option>
              <option value="EHR">EHR</option>
              <option value="PO">PO</option>
              <option value="CONTRACT">CONTRACT</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            认证方式
            <select aria-label="认证方式" className="rounded-xl border border-slate-200 px-3 py-2" value={form.authType} onChange={(event) => setForm((current) => ({ ...current, authType: event.target.value }))}>
              <option value="NONE">NONE</option>
              <option value="API_KEY">API_KEY</option>
              <option value="BEARER_TOKEN">BEARER_TOKEN</option>
              <option value="BASIC">BASIC</option>
              <option value="OAUTH_CLIENT">OAUTH_CLIENT</option>
              <option value="HMAC">HMAC</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600 md:col-span-2">
            基础地址
            <input aria-label="基础地址" className="rounded-xl border border-slate-200 px-3 py-2" value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://erp.example.com/api" />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            一次性认证材料
            <input aria-label="一次性认证材料" className="rounded-xl border border-slate-200 px-3 py-2" type="password" value={form.credentialInput} onChange={(event) => setForm((current) => ({ ...current, credentialInput: event.target.value }))} placeholder="仅提交，不回显" />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            操作人 ID
            <input aria-label="操作人 ID" className="rounded-xl border border-slate-200 px-3 py-2" type="number" value={form.operatorId} onChange={(event) => setForm((current) => ({ ...current, operatorId: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600 md:col-span-2">
            审计原因
            <input aria-label="审计原因" className="rounded-xl border border-slate-200 px-3 py-2" value={form.reason ?? ''} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="V3 外部系统保存复核" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input aria-label="启用外部系统" checked={Boolean(form.enabled)} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            启用外部系统
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canEdit || saving} type="submit">
            {editingId == null ? '新增外部系统' : '保存外部系统'}
          </button>
          {editingId != null ? <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" onClick={resetForm}>取消编辑</button> : null}
        </div>
      </form>
      {loading ? <div className="text-sm text-slate-500">外部系统加载中...</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无外部系统，请通过 V3 创建目录项。</div>
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">{item.systemName}</h4>
                <p className="text-sm text-slate-500">{item.systemCode} · {item.systemType} · {item.maskedBaseUrl}</p>
              </div>
              <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canTest} onClick={() => handleConfigCheck(item)}>
                配置校验
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>状态：{item.status ?? (item.enabled ? 'ENABLED' : 'DISABLED')}</p>
              <p>健康：{item.healthStatus ?? 'UNKNOWN'}</p>
              <p>认证方式：{item.authType}</p>
              <p>认证摘要：{item.maskedSecretSummary ?? '未返回原值'}</p>
              <p>配置掩码：{item.configMasked || item.authConfigured ? '已脱敏' : '无需认证'}</p>
              <p>最近校验：{item.lastValidationStatus ?? '未校验'}</p>
            </div>
            {item.lastValidationMessage ? <p className="mt-2 text-xs text-blue-600">{item.lastValidationMessage}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!canEdit} type="button" onClick={() => startEdit(item)}>编辑</button>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={!canEdit} type="button" onClick={() => handleStatusToggle(item)}>
                {item.enabled ? '停用' : '启用'}
              </button>
            </div>
            {!canTest ? <p className="mt-2 text-xs text-amber-600">缺少 system:integration:test 权限，配置校验不可用。</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
