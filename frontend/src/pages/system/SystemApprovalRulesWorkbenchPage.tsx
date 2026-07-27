import { useEffect, useMemo, useState } from 'react';
import {
  approvalRulesApi,
  type ApprovalRule,
  type ApprovalRuleConflict,
  type ApprovalRuleSimulationResult,
} from '../../api/approvalRules';

type SystemApprovalRulesWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const defaultRulePayload = {
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  ruleName: '大额资产审批规则',
  priority: 10,
  conditionExpression: "amount >= 1000 AND applicantRole == 'MANAGER'",
  approverStrategy: 'ROLE_MANAGER',
  reason: 'Day5 审批规则保存复核',
};

const simulationPayload = {
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  context: { amount: 1200, applicantRole: 'MANAGER', applicantDeptId: 'D001' },
  reason: 'Day5 审批规则模拟复核',
};

function redactedErrorMessage(action: string) {
  return `${action}失败，错误详情已脱敏，请检查登录态、权限码、租户上下文、operatorId、confirmed 和审计 payload。`;
}

function statusLabel(status?: string | null) {
  return status === 'ACTIVE' ? '已启用' : '已停用';
}

export default function SystemApprovalRulesWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemApprovalRulesWorkbenchPageProps) {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<ApprovalRule | null>(null);
  const [simulation, setSimulation] = useState<ApprovalRuleSimulationResult | null>(null);
  const [conflicts, setConflicts] = useState<ApprovalRuleConflict[]>([]);
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedId = selectedRule?.id;
  const matchedSummary = useMemo(() => simulation?.matchedRuleIds.join('、') || '暂无命中', [simulation]);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextRules = await approvalRulesApi.listApprovalRules({ processKey: 'ASSET_APPROVAL', nodeKey: 'MANAGER_REVIEW' });
      setRules(nextRules);
      const firstRule = nextRules[0] ?? null;
      if (firstRule) {
        const detail = await approvalRulesApi.getApprovalRule(firstRule.id);
        setSelectedRule(detail);
        setMessage(null);
      } else {
        setSelectedRule(null);
        setMessage('暂无审批规则，可创建示例规则验证 /approval-rules 闭环。');
      }
    } catch {
      setRules([]);
      setSelectedRule(null);
      setError(redactedErrorMessage('审批规则加载'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadRules();
  }, [canView]);

  const createRule = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await approvalRulesApi.createApprovalRule(defaultRulePayload);
      setSelectedRule(created);
      setRules((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setMessage('示例审批规则已创建，表达式已通过自有白名单 parser/evaluator 校验。');
    } catch {
      setError(redactedErrorMessage('创建审批规则'));
    } finally {
      setSaving(false);
    }
  };

  const updateRule = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await approvalRulesApi.updateApprovalRule(selectedId, {
        ...defaultRulePayload,
        priority: 20,
        reason: 'Day5 审批规则更新复核',
      });
      setSelectedRule(updated);
      setRules((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage('审批规则已更新，审计摘要和版本快照由后端记录。');
    } catch {
      setError(redactedErrorMessage('更新审批规则'));
    } finally {
      setSaving(false);
    }
  };

  const enableRule = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const enabled = await approvalRulesApi.enableApprovalRule(selectedId, {
        confirmed: true,
        reason: 'Day5 审批规则启用复核通过',
        auditEvidence: 'APPROVAL_RULE_ENABLE_GATE',
      });
      setSelectedRule(enabled);
      setRules((current) => current.map((item) => item.id === enabled.id ? enabled : item));
      setMessage('启用审计已登记：confirmed、operatorId、reason/auditEvidence 均由后端校验。');
    } catch {
      setError(redactedErrorMessage('启用审批规则'));
    } finally {
      setSaving(false);
    }
  };

  const disableRule = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const disabled = await approvalRulesApi.disableApprovalRule(selectedId, {
        confirmed: true,
        reason: 'Day5 审批规则停用复核通过',
        auditEvidence: 'APPROVAL_RULE_DISABLE_GATE',
      });
      setSelectedRule(disabled);
      setRules((current) => current.map((item) => item.id === disabled.id ? disabled : item));
      setMessage('停用审计已登记，仅影响后续流程实例。');
    } catch {
      setError(redactedErrorMessage('停用审批规则'));
    } finally {
      setSaving(false);
    }
  };

  const simulateRules = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await approvalRulesApi.simulateApprovalRules(simulationPayload);
      setSimulation(result);
      setMessage('规则模拟完成：只返回命中摘要和安全解释，不执行任意脚本。');
    } catch {
      setError(redactedErrorMessage('模拟审批规则'));
    } finally {
      setSaving(false);
    }
  };

  const detectConflicts = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await approvalRulesApi.detectApprovalRuleConflicts({
        ...simulationPayload,
        auditEvidence: 'APPROVAL_RULE_CONFLICT_GATE',
      });
      setConflicts(result);
      setMessage(result.length > 0 ? '检测到审批规则冲突，请调整优先级或条件。' : '未检测到同流程/节点/优先级冲突。');
    } catch {
      setError(redactedErrorMessage('检测审批规则冲突'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问审批规则，请确认 workflow:approval-rule:list/create/update/enable/disable/test 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">审批规则</h3>
          <p className="mt-1 text-sm text-slate-500">真实调用 /approval-rules 列表、详情、创建、更新、启用、停用、模拟与冲突检测接口。</p>
        </div>
        <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={loading || saving} type="button" onClick={() => void loadRules()}>
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        表达式只能使用自有白名单 parser/evaluator：字段、比较、短数组和 AND/OR/NOT；禁止 SpEL、JS、SQL、OGNL、脚本引擎、反射、动态类加载和任意方法调用。
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">规则列表</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{rules.length} 条</span>
          </div>
          {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">审批规则加载中...</p> : null}
          {!loading && rules.length === 0 ? <p className="text-sm text-slate-500">暂无审批规则。</p> : null}
          <div className="space-y-2">
            {rules.map((rule) => (
              <button key={rule.id} type="button" className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedRule?.id === rule.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`} onClick={() => setSelectedRule(rule)}>
                <span className="block font-medium">{rule.ruleName}</span>
                <span className="mt-1 block text-xs">{statusLabel(rule.status)} · P{rule.priority} · {rule.conditionSummary ?? '条件摘要已脱敏'}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold">规则详情与安全摘要</h4>
                <p className="mt-1 text-xs text-slate-500">{selectedRule ? `${selectedRule.processKey} / ${selectedRule.nodeKey}` : '未选择规则'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{statusLabel(selectedRule?.status)}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">条件摘要</dt><dd>{selectedRule?.conditionSummary ?? '暂无条件摘要'}</dd></div>
              <div><dt className="text-xs text-slate-500">候选处理人</dt><dd>{selectedRule?.approverSummary ?? '候选处理人摘要已脱敏'}</dd></div>
              <div><dt className="text-xs text-slate-500">启用审计</dt><dd>{selectedRule?.enabledAt ?? '尚未启用'}</dd></div>
              <div><dt className="text-xs text-slate-500">停用审计</dt><dd>{selectedRule?.disabledReason ?? '尚未停用'}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">操作留痕</h4>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={createRule}>创建示例规则</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving || !selectedId} type="button" onClick={updateRule}>更新优先级</button>
              <button className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={enableRule}>启用规则</button>
              <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={disableRule}>停用规则</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving} type="button" onClick={simulateRules}>模拟命中</button>
              <button className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={detectConflicts}>冲突检测</button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="mb-2 font-semibold">模拟结果</h4>
              <p className="text-sm text-slate-600">命中规则：{matchedSummary}</p>
              <p className="mt-2 text-xs text-slate-500">{simulation?.safeExplanation ?? '尚未运行模拟。'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="mb-2 font-semibold">冲突检测</h4>
              {conflicts.length === 0 ? <p className="text-sm text-slate-500">暂无冲突检测结果。</p> : null}
              {conflicts.map((conflict) => (
                <p key={`${conflict.ruleId}-${conflict.conflictRuleId}`} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{conflict.conflictSummary}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}
