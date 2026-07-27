import { useEffect, useState } from 'react';
import {
  dryRunSystemSyncRule,
  getSystemSyncQueueSummary,
  listSystemSyncRules,
  retrySystemSyncLog,
  type SystemSyncQueueSummary,
  type SystemSyncRuleRecord,
} from '../../api/systemSyncRules';

export const SYSTEM_SYNC_RULES_ACTION_PERMISSIONS = {
  create: 'system:integration:edit',
  edit: 'system:integration:edit',
  delete: 'system:integration:delete',
  dryRun: 'system:integration:test',
  retryLog: 'system:integration:edit',
} as const;

export default function SystemSyncRulesWorkbenchPage({ embeddedInWorkbench = false, canView = true }: { embeddedInWorkbench?: boolean; canView?: boolean }) {
  const [items, setItems] = useState<SystemSyncRuleRecord[]>([]);
  const [summary, setSummary] = useState<SystemSyncQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([listSystemSyncRules(), getSystemSyncQueueSummary()])
      .then(([records, queueSummary]) => {
        if (mounted) {
          setItems(records);
          setSummary(queueSummary);
          setError(null);
        }
      })
      .catch(() => mounted && setError('同步规则加载失败，敏感细节已脱敏'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleDryRun = async (id: number) => {
    const result = await dryRunSystemSyncRule(id, { triggerSource: 'manual' });
    setNotice(result.message ?? 'dryRun 默认 true，已完成预览');
  };

  const handleRetryLog = async () => {
    await retrySystemSyncLog(1);
    setNotice('单条日志重试请求已提交，真实重试由后端 fail-closed 控制');
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问同步规则，请确认 system:integration:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div>
        <h3 className="text-lg font-semibold">同步规则</h3>
        <p className="mt-1 text-sm text-slate-500">dryRun 默认 true；只保留 dry-run、单条日志重试、只读队列摘要，批处理队列消费入口不开放。</p>
      </div>
      {notice ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">加载中...</div> : null}
      {summary ? (
        <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
          <strong>只读队列摘要</strong>：待处理 {summary.pending}，运行中 {summary.running}，失败 {summary.failed}；队列消费已禁用。
        </div>
      ) : null}
      <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" onClick={handleRetryLog}>单条日志重试</button>
      {!loading && items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无同步规则。</div> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">{item.ruleName}</h4>
                <p className="text-sm text-slate-500">触发：{item.triggerType || item.cronExpression || 'MANUAL'}</p>
              </div>
              <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white" type="button" onClick={() => handleDryRun(item.id)}>dry-run</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">真实执行与真实重试已禁用，队列只读。</p>
          </article>
        ))}
      </div>
    </section>
  );
}
