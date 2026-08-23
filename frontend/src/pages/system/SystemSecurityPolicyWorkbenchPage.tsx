import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getSecurityConfig,
  previewSecurityConfig,
  saveSecurityConfig,
  type SystemConfigPreviewResult,
} from '../../api/systemConfig';

type SystemSecurityPolicyWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canPreview?: boolean;
};

type FormState = {
  configKey: string;
  configValue: string;
  configType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  operatorId: number;
  reason: string;
  auditEvidence: string;
};

const EMPTY_FORM: FormState = {
  configKey: 'credential.minLength',
  configValue: '12',
  configType: 'NUMBER',
  operatorId: 1,
  reason: 'V3 安全策略配置态复核',
  auditEvidence: 'policy-preview-state',
};

const SECURITY_POLICY_HINTS = [
  { key: 'credential.minLength', label: '口令长度下限', value: '12', type: 'NUMBER' as const },
  { key: 'session.maxMinutes', label: '会话最长时长', value: '120', type: 'NUMBER' as const },
  { key: 'signIn.maxAttempts', label: '登录失败限制', value: '5', type: 'NUMBER' as const },
  { key: 'mfa.enabled', label: 'MFA 配置开关', value: 'false', type: 'BOOLEAN' as const },
  { key: 'audit.enabled', label: '审计记录开关', value: 'true', type: 'BOOLEAN' as const },
];

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
      // 本地用户缓存解析失败时继续使用显式操作人输入。
    }
  }
  return EMPTY_FORM.operatorId;
}

function maskedEntries(values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => `${key}: ${value}`).join('、') || '无';
}

function sanitizeNotice() {
  return '安全策略操作失败，错误详情已脱敏';
}

export default function SystemSecurityPolicyWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
  canEdit = true,
  canPreview = true,
}: SystemSecurityPolicyWorkbenchPageProps) {
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(canView);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SystemConfigPreviewResult | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, operatorId: readOperatorId() });

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getSecurityConfig()
      .then((map) => {
        if (mounted) {
          setConfigMap(map ?? {});
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('安全策略加载失败，错误详情已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [canView]);

  const selectedHint = useMemo(
    () => SECURITY_POLICY_HINTS.find((item) => item.key === form.configKey),
    [form.configKey],
  );

  const applyHint = (hint: (typeof SECURITY_POLICY_HINTS)[number]) => {
    setForm((current) => ({
      ...current,
      configKey: hint.key,
      configValue: configMap[hint.key] ?? hint.value,
      configType: hint.type,
    }));
  };

  const auditPayload = () => ({
    operatorId: Number(form.operatorId),
    reason: form.reason.trim() || 'V3 安全策略配置态复核',
    auditEvidence: form.auditEvidence.trim() || 'policy-preview-state',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      setNotice('缺少 system:config:edit 权限，不能保存安全策略配置。');
      return;
    }
    setSaving(true);
    try {
      const key = form.configKey.trim();
      const saved = await saveSecurityConfig({ [key]: form.configValue.trim() }, auditPayload());
      setConfigMap(saved ?? { ...configMap, [key]: form.configValue.trim() });
      setNotice('安全策略配置态已保存，后端已要求操作人匹配与审计摘要，页面不声明运行时生效。');
    } catch {
      setNotice(sanitizeNotice());
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!canPreview) {
      setNotice('缺少 system:config:preview 权限，不能执行安全策略预览。');
      return;
    }
    try {
      const result = await previewSecurityConfig({
        configs: { [form.configKey.trim()]: form.configValue.trim() },
        configType: form.configType,
        ...auditPayload(),
      });
      setPreview(result);
      setNotice('安全策略预览已生成：persistent=false、cacheRefreshed=false、runtimeEffect=false。');
    } catch {
      setNotice(sanitizeNotice());
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-security-policy="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问安全策略，请确认 system:config:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-security-policy="workbench-v3">
      <div>
        <h3 className="text-lg font-semibold">安全策略</h3>
        <h3 className="mt-1 text-sm font-medium text-slate-500">
          真实调用 /system-config/security 与 /system-config/security/preview；本页只展示配置态、预览态和审计摘要，仍非 44 项全量覆盖，也不是 Workbench V3 全量完成。
        </h3>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        no-login-chain / no-direct-effect：本模块不接登录链路、不直接生效、不改变会话、MFA 或移动端运行状态；runtimeEffect 必须为 false。
      </div>

      {notice ? <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 p-4" aria-label="安全策略配置态">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">SECURITY 配置态</h4>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">configuration-state</span>
            </div>
            {loading ? <div role="status" aria-live="polite" className="mt-4 text-sm text-slate-500">安全策略加载中...</div> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SECURITY_POLICY_HINTS.map((hint) => (
                <button
                  key={hint.key}
                  type="button"
                  className="rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={() => applyHint(hint)}
                >
                  <span className="block font-semibold">{hint.label}</span>
                  <span className="mt-1 block font-mono text-xs text-slate-500">{hint.key}</span>
                  <span className="mt-2 block text-xs text-slate-500">当前配置：{configMap[hint.key] ?? '未返回或已脱敏'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4" aria-label="安全策略审计摘要">
            <h4 className="font-semibold">审计摘要</h4>
            <p className="mt-2 text-sm text-slate-600">保存必须携带 operatorId，并提供 reason 或 auditEvidence；服务端只记录 provided/not-provided 与 masked before/after。</p>
            <p className="mt-1 text-sm text-slate-600">当前复核对象：{selectedHint?.label ?? form.configKey}</p>
          </section>
        </div>

        <form className="space-y-3 rounded-2xl border border-slate-200 p-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">保存安全策略配置态</h4>
            {!canEdit ? <span className="text-xs text-amber-600">缺少 system:config:edit 权限</span> : null}
          </div>
          <label className="grid gap-1 text-sm text-slate-600">
            配置键
            <input aria-label="配置键" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configKey} onChange={(event) => setForm((current) => ({ ...current, configKey: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            配置值
            <input aria-label="配置值" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configValue} onChange={(event) => setForm((current) => ({ ...current, configValue: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            配置类型
            <select aria-label="配置类型" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configType} onChange={(event) => setForm((current) => ({ ...current, configType: event.target.value as FormState['configType'] }))}>
              <option value="STRING">STRING</option>
              <option value="NUMBER">NUMBER</option>
              <option value="BOOLEAN">BOOLEAN</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            操作人 ID
            <input aria-label="操作人 ID" className="rounded-xl border border-slate-200 px-3 py-2" type="number" value={form.operatorId} onChange={(event) => setForm((current) => ({ ...current, operatorId: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            审计原因
            <input aria-label="审计原因" className="rounded-xl border border-slate-200 px-3 py-2" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            审计证据摘要
            <input aria-label="审计证据摘要" className="rounded-xl border border-slate-200 px-3 py-2" value={form.auditEvidence} onChange={(event) => setForm((current) => ({ ...current, auditEvidence: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!canEdit || saving} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:bg-slate-300">
              保存安全策略
            </button>
            <button type="button" disabled={!canPreview} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={handlePreview}>
              影响预演
            </button>
          </div>
        </form>
      </div>

      {preview ? (
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="安全策略预览态">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">预览态结果</h4>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">preview-state</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">persistent={String(preview.persistent)} · cacheRefreshed={String(preview.cacheRefreshed)} · runtimeEffect={String(preview.runtimeEffect)}</p>
          <p className="mt-1 text-sm text-slate-600">变更键：{preview.changedKeys.join('、') || '无变更'}</p>
          <p className="mt-1 text-sm text-slate-600">beforeMasked：{maskedEntries(preview.beforeMasked)}</p>
          <p className="mt-1 text-sm text-slate-600">afterMasked：{maskedEntries(preview.afterMasked)}</p>
          <p className="mt-1 text-sm text-slate-600">影响模块：{preview.impactModules.join('、')}</p>
          {preview.summary ? <p className="mt-1 text-sm text-slate-600">摘要：{preview.summary}</p> : null}
          {preview.validationErrors.length > 0 ? <p className="mt-1 text-sm text-amber-700">校验提示：{preview.validationErrors.join('、')}</p> : null}
        </section>
      ) : null}
    </section>
  );
}
