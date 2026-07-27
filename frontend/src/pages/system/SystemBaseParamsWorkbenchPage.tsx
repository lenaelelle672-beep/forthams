import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createSysConfig,
  getSystemBaseParamList,
  getSystemConfig,
  previewSystemConfig,
  refreshSysConfigCache,
  updateSysConfig,
  type SysConfigItem,
  type SystemConfigPreviewResult,
  type SystemConfigRefreshResult,
} from '../../api/systemConfig';

type SystemBaseParamsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canPreview?: boolean;
  canRefresh?: boolean;
};

type FormState = {
  configKey: string;
  configName: string;
  configValue: string;
  configType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'JSON';
  operatorId: number;
  reason: string;
};

const EMPTY_FORM: FormState = {
  configKey: 'systemName',
  configName: '系统名称',
  configValue: '',
  configType: 'STRING',
  operatorId: 1,
  reason: 'V3 基础参数保存复核',
};

const SYSTEM_BASE_PARAM_HINTS = [
  { key: 'companyName', label: '公司名称' },
  { key: 'systemName', label: '系统名称' },
  { key: 'timezone', label: '默认时区' },
  { key: 'defaultCurrency', label: '默认币种' },
  { key: 'maintenanceWarningDays', label: '维保预警天数' },
  { key: 'backupFrequency', label: '备份频率' },
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
      // 本地用户缓存解析失败时使用显式操作人输入。
    }
  }
  return EMPTY_FORM.operatorId;
}

function toDisplayValue(item: SysConfigItem) {
  return item.displayValue ?? item.configValue ?? '—';
}

function sanitizeNotice() {
  return '操作失败，错误详情已脱敏';
}

export default function SystemBaseParamsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
  canEdit = true,
  canPreview = true,
  canRefresh = true,
}: SystemBaseParamsWorkbenchPageProps) {
  const [records, setRecords] = useState<SysConfigItem[]>([]);
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(canView);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SystemConfigPreviewResult | null>(null);
  const [refreshResult, setRefreshResult] = useState<SystemConfigRefreshResult | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, operatorId: readOperatorId() });

  const reload = async () => {
    setLoading(true);
    try {
      const [map, list] = await Promise.all([
        getSystemConfig(),
        getSystemBaseParamList({ page: 1, pageSize: 50 }),
      ]);
      setConfigMap(map ?? {});
      setRecords(list.records ?? []);
      setError(null);
    } catch {
      setError('基础参数加载失败，错误详情已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    Promise.all([
      getSystemConfig(),
      getSystemBaseParamList({ page: 1, pageSize: 50 }),
    ])
      .then(([map, list]) => {
        if (mounted) {
          setConfigMap(map ?? {});
          setRecords(list.records ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('基础参数加载失败，错误详情已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [canView]);

  const recordByKey = useMemo(
    () => new Map(records.map((record) => [record.configKey, record])),
    [records],
  );

  const buildPayload = () => ({
    configGroup: 'SYSTEM',
    configKey: form.configKey.trim(),
    configName: form.configName.trim() || form.configKey.trim(),
    configValue: form.configValue.trim(),
    configType: form.configType,
    status: 0,
    operatorId: Number(form.operatorId),
    reason: form.reason.trim() || 'V3 基础参数保存复核',
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, operatorId: readOperatorId() });
  };

  const startEdit = (item: SysConfigItem) => {
    setEditingId(item.id);
    setForm({
      configKey: item.configKey,
      configName: item.configName ?? item.configKey,
      configValue: item.configValue ?? item.displayValue ?? '',
      configType: ['NUMBER', 'BOOLEAN', 'SELECT', 'JSON'].includes(String(item.configType)) ? item.configType as FormState['configType'] : 'STRING',
      operatorId: readOperatorId(),
      reason: 'V3 基础参数更新复核',
    });
    setNotice('正在编辑 SYSTEM 分组基础参数，页面不会回显敏感明文。');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      setNotice('缺少 system:config:edit 权限，不能保存基础参数。');
      return;
    }
    setSaving(true);
    try {
      const existing = editingId ?? recordByKey.get(form.configKey.trim())?.id;
      const saved = existing == null
        ? await createSysConfig(buildPayload() as any)
        : await updateSysConfig(existing, buildPayload() as any);
      setRecords((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id && item.configKey !== saved.configKey);
        return [saved, ...withoutSaved];
      });
      setConfigMap((current) => ({ ...current, [saved.configKey]: toDisplayValue(saved) }));
      setNotice('基础参数已保存，响应和审计摘要已脱敏。');
      resetForm();
    } catch {
      setNotice(sanitizeNotice());
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!canPreview) {
      setNotice('缺少 system:config:preview 权限，不能执行影响预演。');
      return;
    }
    try {
      const result = await previewSystemConfig({
        configs: { [form.configKey.trim()]: form.configValue.trim() },
        operatorId: Number(form.operatorId),
        reason: form.reason.trim() || 'V3 基础参数影响预演',
        configType: form.configType,
      });
      setPreview(result);
      setNotice('影响预演已生成：未写库、未刷新缓存、未改变业务状态。');
    } catch {
      setNotice(sanitizeNotice());
    }
  };

  const handleRefresh = async () => {
    if (!canRefresh) {
      setNotice('缺少 system:config:refresh 权限，不能刷新基础参数缓存。');
      return;
    }
    try {
      const result = await refreshSysConfigCache({
        confirmed: true,
        operatorId: Number(form.operatorId),
        reason: 'Workbench V3 基础参数缓存刷新复核',
        namespaces: ['system-config:SYSTEM'],
      });
      setRefreshResult(result);
      setNotice(`缓存刷新返回 ${result.overallStatus}，请查看命名空间明细。`);
    } catch {
      setNotice(sanitizeNotice());
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-base-params="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问基础参数，请确认 system:config:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-base-params="workbench-v3">
      <div>
        <h3 className="text-lg font-semibold">基础参数</h3>
        <p className="mt-1 text-sm text-slate-500">
          真实调用 /system-config/system 与 /system/configs；仅覆盖 SYSTEM 分组基础参数，仍非 44 项全量覆盖，也不代表 Workbench V3 全量完成。
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        本页展示基础参数目录、保存、影响预演与缓存刷新结果；预演不会持久化，缓存刷新无真实缓存时必须显示 DEGRADED。
      </div>

      {notice ? <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">SYSTEM 基础参数目录</h4>
              <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={reload}>
                重新加载
              </button>
            </div>
            {loading ? <div role="status" aria-live="polite" className="mt-4 text-sm text-slate-500">基础参数加载中...</div> : null}
            {!loading && records.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无 SYSTEM 基础参数，请通过 V3 新增。</div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {records.map((item) => (
                <article key={item.id ?? item.configKey} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="font-semibold">{item.configName ?? item.configKey}</h5>
                      <p className="mt-1 font-mono text-xs text-slate-500">{item.configKey}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">SYSTEM</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">当前值：{toDisplayValue(item)}</p>
                  <p className="mt-1 text-xs text-slate-500">类型：{item.configType ?? 'STRING'} · 审计：{item.lastOperationReason ?? '待写入审计摘要'}</p>
                  <button type="button" className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={() => startEdit(item)}>
                    编辑基础参数
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="font-semibold">基础参数默认键</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SYSTEM_BASE_PARAM_HINTS.map((hint) => (
                <button
                  key={hint.key}
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={() => setForm((current) => ({ ...current, configKey: hint.key, configName: hint.label, configValue: configMap[hint.key] ?? '' }))}
                >
                  <span className="block font-medium">{hint.label}</span>
                  <span className="mt-1 block font-mono text-xs text-slate-500">{hint.key}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <form className="space-y-3 rounded-2xl border border-slate-200 p-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">{editingId == null ? '保存基础参数' : '更新基础参数'}</h4>
            {!canEdit ? <span className="text-xs text-amber-600">缺少 system:config:edit 权限</span> : null}
          </div>
          <label className="grid gap-1 text-sm text-slate-600">
            参数键
            <input aria-label="参数键" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configKey} onChange={(event) => setForm((current) => ({ ...current, configKey: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            参数名称
            <input aria-label="参数名称" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configName} onChange={(event) => setForm((current) => ({ ...current, configName: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            参数值
            <input aria-label="参数值" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configValue} onChange={(event) => setForm((current) => ({ ...current, configValue: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            参数类型
            <select aria-label="参数类型" className="rounded-xl border border-slate-200 px-3 py-2" value={form.configType} onChange={(event) => setForm((current) => ({ ...current, configType: event.target.value as FormState['configType'] }))}>
              <option value="STRING">STRING</option>
              <option value="NUMBER">NUMBER</option>
              <option value="BOOLEAN">BOOLEAN</option>
              <option value="SELECT">SELECT</option>
              <option value="JSON">JSON</option>
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
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!canEdit || saving} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:bg-slate-300">
              保存基础参数
            </button>
            <button type="button" disabled={!canPreview} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={handlePreview}>
              影响预演
            </button>
            <button type="button" disabled={!canRefresh} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={handleRefresh}>
              刷新缓存
            </button>
            {editingId != null ? <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={resetForm}>取消编辑</button> : null}
          </div>
        </form>
      </div>

      {preview ? (
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="基础参数影响预演结果">
          <h4 className="font-semibold">影响预演结果</h4>
          <p className="mt-2 text-sm text-slate-600">风险等级：{preview.riskLevel} · 持久化：{String(preview.persistent)} · 刷新缓存：{String(preview.cacheRefreshed)}</p>
          <p className="mt-1 text-sm text-slate-600">变更键：{preview.changedKeys.join('、') || '无变更'}</p>
          <p className="mt-1 text-sm text-slate-600">影响模块：{preview.impactModules.join('、')}</p>
          {preview.validationErrors.length > 0 ? <p className="mt-1 text-sm text-amber-700">校验提示：{preview.validationErrors.join('、')}</p> : null}
        </section>
      ) : null}

      {refreshResult ? (
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="基础参数缓存刷新结果">
          <h4 className="font-semibold">缓存刷新结果：{refreshResult.overallStatus}</h4>
          <p className="mt-2 text-sm text-slate-600">{refreshResult.message}</p>
          <div className="mt-3 grid gap-2">
            {refreshResult.namespaceResults.map((item) => (
              <div key={item.namespace} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {item.namespace} · {item.status} · {item.itemCount ?? 0} 项 · {item.message}{item.remediation ? ` · ${item.remediation}` : ''}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
