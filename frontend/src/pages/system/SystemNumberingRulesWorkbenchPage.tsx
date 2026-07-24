import { FormEvent, useEffect, useMemo, useState } from 'react';
import { numberingRulesApi } from '../../api/numberingRules';
import type { NumberingRule, NumberingRuleMeta, NumberingRulePreviewResponse } from '../../api/numberingRules';

type SystemNumberingRulesWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = 'read-only numbering rule catalog + no-persistence deterministic preview；预览不会持久化、不刷新缓存、不预留或占用序号。';
const endpointCopy = '真实调用 /numbering-rules、/numbering-rules/{ruleKey}、/numbering-rules/meta 与 /numbering-rules/preview。';
const coverageCopy = '仅代表 system-numbering-rules 单模块候选；当前不保证并发唯一，未接入资产/工单/流程创建链路，不代表基础资料组完成，不代表 44/44 或 Workbench V3 全量完成。';

function variableCopy(rule: NumberingRule | null) {
  return rule?.variables?.join('、') || '暂无变量或仅展示默认模板';
}

export default function SystemNumberingRulesWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemNumberingRulesWorkbenchPageProps) {
  const [rules, setRules] = useState<NumberingRule[]>([]);
  const [selectedRuleKey, setSelectedRuleKey] = useState('numbering.rule.asset');
  const [template, setTemplate] = useState('AUTO-{YYYYMMDD}-{SEQ}');
  const [sampleAt, setSampleAt] = useState('2026-07-08T09:10:11');
  const [sampleSequence, setSampleSequence] = useState('009');
  const [detail, setDetail] = useState<NumberingRule | null>(null);
  const [meta, setMeta] = useState<NumberingRuleMeta | null>(null);
  const [previewResult, setPreviewResult] = useState<NumberingRulePreviewResponse | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      numberingRulesApi.list(),
      numberingRulesApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setRules(listResult);
        setMeta(metaResult);
        const first = listResult[0] ?? metaResult.defaultRules?.[0];
        const nextRuleKey = first?.ruleKey ?? 'numbering.rule.asset';
        setSelectedRuleKey(nextRuleKey);
        setTemplate(first?.template ?? 'AUTO-{YYYYMMDD}-{SEQ}');
        const detailResult = await numberingRulesApi.detail(nextRuleKey);
        if (!ignored) {
          setDetail(detailResult);
          setTemplate(detailResult.template || first?.template || 'AUTO-{YYYYMMDD}-{SEQ}');
        }
      })
      .catch(() => {
        if (!ignored) {
          setRules([]);
          setDetail(null);
          setPreviewResult(null);
          setError('编号规则只读目录加载失败，错误详情已脱敏');
        }
      })
      .finally(() => {
        if (!ignored) {
          setLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [canView]);

  const selectedRule = useMemo(
    () => rules.find((item) => item.ruleKey === selectedRuleKey) ?? detail,
    [detail, rules, selectedRuleKey],
  );
  const variableOptions = useMemo(() => meta?.allowedVariables ?? [], [meta]);

  const loadDetail = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!selectedRuleKey) {
      return;
    }
    setSubmitting(true);
    try {
      setError(null);
      const detailResult = await numberingRulesApi.detail(selectedRuleKey);
      setDetail(detailResult);
      setTemplate(detailResult.template);
      setPreviewResult(null);
    } catch {
      setError('编号规则详情读取失败，错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  const runPreview = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      setPreviewResult(await numberingRulesApi.preview({
        ruleKey: selectedRuleKey || undefined,
        template: template || undefined,
        sampleAt: sampleAt || undefined,
        sampleSequence: sampleSequence || undefined,
      }));
    } catch {
      setError('无持久化、无缓存刷新、无序号预留的编号预览失败，错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-numbering-rules="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问编号规则只读目录，请确认 system:numbering-rule:query 或 read 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-numbering-rules="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">编号规则</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / tenantScoped=true / sequenceAllocated=false</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 previewValue、usedVariables、missingVariables、rejectedVariables、authority、warnings、tenantScoped、noPersistence、noSequenceReserved、runtimeEffect=false、cacheRefreshed=false、sequenceAllocated=false、persistent=false 与 readonlyBoundary。</p>
        <p>{coverageCopy}</p>
      </div>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">编号规则只读目录加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="编号规则只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">编号规则 catalog</h4>
            <span className="text-xs text-slate-500">显示 {rules.length} 条，只读展示</span>
          </div>
          {rules.length === 0 && !loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无编号规则；空态不代表序列分配、并发唯一或创建链路闭环。</div> : null}
          <div className="space-y-2">
            {rules.map((item) => (
              <button
                key={item.ruleKey}
                type="button"
                className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  setSelectedRuleKey(item.ruleKey);
                  setTemplate(item.template);
                  setDetail(item);
                  setPreviewResult(null);
                }}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.source ?? 'system_config'}</span>
                </span>
                <span className="mt-1 block text-slate-600">{item.ruleKey} · {item.template}</span>
                <span className="mt-1 block text-xs text-slate-500">tenantScoped={String(item.tenantScoped ?? true)} · readOnly={String(item.readOnly ?? true)} · variables={variableCopy(item)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="编号规则详情与预览">
          <h4 className="font-semibold">详情读取与 no-persistence preview</h4>
          <form className="space-y-3" onSubmit={loadDetail}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="numbering-rule-key">规则编码</label>
            <div className="flex gap-2">
              <select
                id="numbering-rule-key"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={selectedRuleKey}
                onChange={(eventValue) => setSelectedRuleKey(eventValue.target.value)}
              >
                {(rules.length === 0 ? [{ ruleKey: 'numbering.rule.asset', name: '资产编号规则' }] : rules).map((item) => <option key={item.ruleKey} value={item.ruleKey}>{item.name}</option>)}
              </select>
              <button type="submit" disabled={submitting} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">读取规则详情</button>
            </div>
          </form>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="编号规则详情">
            当前规则：{selectedRule?.name ?? selectedRuleKey}；模板：{template || '未加载'}；authority={detail?.authority ?? meta?.authority ?? 'system_config:numbering.rule.*'}；只读，不执行序号分配或缓存刷新。
          </div>

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="numbering-rule-template">模板</label>
            <input id="numbering-rule-template" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={template} onChange={(eventValue) => setTemplate(eventValue.target.value)} />
            <label className="block text-sm font-medium text-slate-700" htmlFor="numbering-rule-sample-at">样例时间</label>
            <input id="numbering-rule-sample-at" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sampleAt} onChange={(eventValue) => setSampleAt(eventValue.target.value)} />
            <label className="block text-sm font-medium text-slate-700" htmlFor="numbering-rule-sample-sequence">样例序号</label>
            <input id="numbering-rule-sample-sequence" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sampleSequence} onChange={(eventValue) => setSampleSequence(eventValue.target.value)} />
            <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化编号预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="编号规则预览结果">
              <p className="font-medium">previewValue={previewResult.previewValue}</p>
              <p>usedVariables={previewResult.usedVariables.join('、') || '无'} · missingVariables={previewResult.missingVariables.join('、') || '无'}</p>
              <p>rejectedVariables={previewResult.rejectedVariables.join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · noSequenceReserved={String(previewResult.noSequenceReserved)} · runtimeEffect={String(previewResult.runtimeEffect)} · cacheRefreshed={String(previewResult.cacheRefreshed)} · sequenceAllocated={String(previewResult.sequenceAllocated)} · persistent={String(previewResult.persistent)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        变量说明：{variableOptions.map((item) => `${item.value}=${item.label}`).join('；') || '元数据未加载'}。边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不分配或预留序列号、不保证并发唯一、不接入创建链路'}。
      </div>
    </section>
  );
}
