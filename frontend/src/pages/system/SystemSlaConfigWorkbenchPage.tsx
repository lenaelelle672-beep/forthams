import { useEffect, useMemo, useState } from 'react';
import {
  slaConfigApi,
  type SlaConfigItem,
  type SlaConfigSimulationResult,
  type SlaRuntimeSummary,
  type SlaTimeoutExportResult,
  type SlaTimeoutRecord,
} from '../../api/slaConfig';

type SystemSlaConfigWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const policyUpdatePayload = {
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  priority: 'HIGH',
  responseHours: 2,
  resolveHours: 8,
  warningRatio: 0.75,
  escalationRatio: 0.9,
  notificationTargets: [{ targetType: 'ROLE', targetNameMasked: '审***', contactMasked: '***' }],
  reason: 'Day6 SLA策略保存复核',
};

const operationPayload = {
  confirmed: true,
  reason: 'Day6 SLA策略启停复核',
  auditEvidence: 'SLA_CONFIG_GATE',
} as const;

const simulationPayload = {
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  priority: 'HIGH',
  variables: { amount: 1200, applicantPhone: '已脱敏输入' },
  confirmed: true,
  reason: 'Day6 SLA模拟复核',
} as const;

function emptySummary(): SlaRuntimeSummary {
  return {
    totalConfigs: 0,
    activeConfigs: 0,
    overdueCount: 0,
    warningCount: 0,
    criticalCount: 0,
    timeoutRecordCount: 0,
    riskCounts: {},
    nodeDurationSummary: [],
    abnormalTraceSummary: [],
    recentTimeoutRecords: [],
    exportMaskingNotice: '导出仅返回脱敏摘要。',
    readOnly: true,
    tenantScoped: true,
  };
}

function redactedErrorMessage(action: string) {
  return `${action}失败，错误详情已脱敏，请检查登录态、权限码、租户上下文、operatorId、confirmed 和审计 payload。`;
}

function statusLabel(config?: SlaConfigItem | null) {
  return config?.enabled || config?.status === 1 || config?.statusText === 'ACTIVE' ? '已启用' : '已停用';
}

export default function SystemSlaConfigWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemSlaConfigWorkbenchPageProps) {
  const [configs, setConfigs] = useState<SlaConfigItem[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SlaConfigItem | null>(null);
  const [summary, setSummary] = useState<SlaRuntimeSummary>(emptySummary);
  const [timeoutRecords, setTimeoutRecords] = useState<SlaTimeoutRecord[]>([]);
  const [simulation, setSimulation] = useState<SlaConfigSimulationResult | null>(null);
  const [exportResult, setExportResult] = useState<SlaTimeoutExportResult | null>(null);
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedId = selectedConfig?.id;
  const warningSummary = useMemo(() => `${summary.overdueCount ?? 0} 个超时、${summary.warningCount ?? 0} 个预警、${summary.criticalCount ?? 0} 个高风险`, [summary]);

  const loadSlaConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextConfigs, nextSummary, nextTimeoutRecords] = await Promise.all([
        slaConfigApi.listSlaConfigs(),
        slaConfigApi.getSlaRuntimeSummary(),
        slaConfigApi.listSlaTimeoutRecords({ status: 'OPEN' }),
      ]);
      setConfigs(nextConfigs);
      setSummary(nextSummary);
      setTimeoutRecords(nextTimeoutRecords);
      const first = nextConfigs[0] ?? null;
      if (first) {
        setSelectedConfig(await slaConfigApi.getSlaConfig(first.id));
        setMessage(null);
      } else {
        setSelectedConfig(null);
        setMessage('暂无 SLA 策略，请先由后端种子或接口创建策略后再配置。');
      }
    } catch {
      setConfigs([]);
      setSelectedConfig(null);
      setSummary(emptySummary());
      setTimeoutRecords([]);
      setError(redactedErrorMessage('SLA配置加载'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadSlaConfig();
  }, [canView]);

  const updatePolicy = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await slaConfigApi.updateSlaConfig(selectedId, policyUpdatePayload);
      setSelectedConfig(updated);
      setConfigs((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage('SLA 策略已保存：响应/解决时限、提醒阈值、适用流程和通知目标均走后端审计。');
    } catch {
      setError(redactedErrorMessage('保存SLA策略'));
    } finally {
      setSaving(false);
    }
  };

  const enablePolicy = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const enabled = await slaConfigApi.enableSlaConfig(selectedId, operationPayload);
      setSelectedConfig(enabled);
      setConfigs((current) => current.map((item) => item.id === enabled.id ? enabled : item));
      setMessage('启用审计已登记：只影响后续任务和后续 SLA 计算。');
    } catch {
      setError(redactedErrorMessage('启用SLA策略'));
    } finally {
      setSaving(false);
    }
  };

  const disablePolicy = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const disabled = await slaConfigApi.disableSlaConfig(selectedId, {
        ...operationPayload,
        reason: 'Day6 SLA策略停用复核',
      });
      setSelectedConfig(disabled);
      setConfigs((current) => current.map((item) => item.id === disabled.id ? disabled : item));
      setMessage('停用审计已登记：历史实例与历史超时记录保持只读。');
    } catch {
      setError(redactedErrorMessage('停用SLA策略'));
    } finally {
      setSaving(false);
    }
  };

  const runSimulation = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await slaConfigApi.simulateSlaConfig(simulationPayload);
      setSimulation(result);
      setMessage('SLA 模拟完成：仅生成截止、预警、升级和通知目标摘要，不发送真实通知。');
    } catch {
      setError(redactedErrorMessage('模拟SLA策略'));
    } finally {
      setSaving(false);
    }
  };

  const exportMasked = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await slaConfigApi.exportSlaTimeoutRecords({
        processKey: selectedConfig?.processKey ?? 'ASSET_APPROVAL',
        confirmed: true,
        reason: 'Day6 SLA脱敏导出复核',
        auditEvidence: 'SLA_EXPORT_GATE',
      });
      setExportResult(result);
      setMessage('脱敏导出快照已生成：仅返回 masked/summary 内容。');
    } catch {
      setError(redactedErrorMessage('导出SLA超时记录'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问 SLA 配置，请确认 workflow:sla:list/update/enable/disable/test/export 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">SLA 配置</h3>
          <p className="mt-1 text-sm text-slate-500">真实调用 /sla-config 策略列表、详情、更新、启停、simulate、runtime-summary、timeout-records 与 export 接口。</p>
        </div>
        <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={loading || saving} type="button" onClick={() => void loadSlaConfig()}>
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        SLA 运行态安全边界：模拟、摘要、超时记录和脱敏导出不修改审批、工作流定义、表单实例、业务单据或任务状态；不发送真实通知，通知目标、联系方式、变量值、附件引用与导出内容只展示 masked/summary。
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">策略总数</p><p className="mt-2 text-2xl font-semibold text-slate-900">{configs.length}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">启用策略</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.activeConfigs ?? 0}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">运行风险</p><p className="mt-2 text-sm font-semibold text-red-600">{warningSummary}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">超时记录</p><p className="mt-2 text-2xl font-semibold text-slate-900">{timeoutRecords.length}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">策略列表</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{configs.length} 条</span>
          </div>
          {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">SLA 配置加载中...</p> : null}
          {!loading && configs.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无 SLA 策略。</h3> : null}
          <div className="space-y-2">
            {configs.map((config) => (
              <button key={config.id} type="button" className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedConfig?.id === config.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`} onClick={() => setSelectedConfig(config)}>
                <span className="block font-medium">{config.processKey ?? 'GLOBAL'} / {config.nodeKey ?? 'ALL'}</span>
                <span className="mt-1 block text-xs">{statusLabel(config)} · {config.priority} · 响应 {config.responseHours}h / 解决 {config.resolveHours}h</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold">策略详情与提醒阈值</h4>
                <p className="mt-1 text-xs text-slate-500">{selectedConfig?.applicableProcessSummary ?? '未选择策略'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{statusLabel(selectedConfig)}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">响应/解决</dt><dd>{selectedConfig ? `${selectedConfig.responseHours}h / ${selectedConfig.resolveHours}h` : '-'}</dd></div>
              <div><dt className="text-xs text-slate-500">提醒/升级阈值</dt><dd>{selectedConfig ? `${selectedConfig.warningRatio} / ${selectedConfig.escalationRatio ?? 0.9}` : '-'}</dd></div>
              <div><dt className="text-xs text-slate-500">通知目标</dt><dd>{selectedConfig?.notificationTargetSummary ?? '通知目标已脱敏'}</dd></div>
              <div><dt className="text-xs text-slate-500">审计摘要</dt><dd>{selectedConfig?.auditSummary ?? '暂无审计摘要'}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">操作留痕</h4>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving || !selectedId} type="button" onClick={updatePolicy}>保存策略草稿</button>
              <button className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={enablePolicy}>启用策略</button>
              <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={disablePolicy}>停用策略</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving} type="button" onClick={runSimulation}>运行模拟</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={exportMasked}>导出脱敏快照</button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="mb-2 font-semibold">模拟结果</h4>
              <p className="text-sm text-slate-600">命中策略：{simulation?.matchedConfigId ?? '暂无'}</p>
              <p className="mt-2 text-xs text-slate-500">{simulation?.policySummary ?? '尚未运行模拟。'}</p>
              <p className="mt-2 text-xs text-slate-500">{simulation?.variablePreviewMasked ?? '变量值仅展示遮罩摘要。'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="mb-2 font-semibold">脱敏导出</h4>
              <p className="text-sm text-slate-600">{exportResult?.contentSummary ?? summary.exportMaskingNotice ?? '导出仅返回 masked/summary 字段。'}</p>
              <p className="mt-2 text-xs text-slate-500">{exportResult?.fieldMaskingPolicy ?? '不返回联系方式、变量原文、附件路径或 storage key。'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <h4 className="mb-3 font-semibold">超时记录</h4>
        {timeoutRecords.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无超时记录。</h3> : null}
        <div className="grid gap-2 md:grid-cols-2">
          {timeoutRecords.map((record) => (
            <div key={record.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600">
              <p className="font-medium text-slate-800">{record.processKey ?? '-'} / {record.nodeKey ?? '-'}</p>
              <p className="text-xs text-slate-500">{record.maskedBusinessSummary ?? '业务摘要已脱敏'} · {record.riskLevel ?? 'UNKNOWN'} · {record.timeoutMinutes ?? 0} 分钟</p>
            </div>
          ))}
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}
