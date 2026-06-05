/**
 * @file pages/settings/NumberingRulesTab.tsx
 * @description 编号规则配置 — 业务管理员可直接修改各流程的编号模板
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { workflowApi, type WorkflowDefinitionDTO } from '@/api/workflow';
import { createSysConfig, deleteSysConfig, getSysConfigList, updateSysConfig } from '@/api/systemConfig';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface RuleItem {
  id?: number;
  key: string;
  name: string;
  value: string;
}

const DEFAULT_RULES: RuleItem[] = [
  { key: 'numbering.rule.asset',      name: '资产编号规则',     value: 'AUTO-{YYYYMMDD}-{SEQ}' },
  { key: 'numbering.rule.workorder',  name: '工单编号规则',     value: 'WO-{YYYYMMDD}-{SEQ}' },
  { key: 'numbering.rule.approval',   name: '审批流程编号规则', value: 'AP-{YYYYMMDD}-{SEQ}' },
  { key: 'numbering.rule.retirement', name: '退役申请编号规则', value: 'RT-{YYYYMMDD}-{SEQ}' },
  { key: 'numbering.rule.compensation', name: '赔偿流程编号规则', value: 'CMP-{YYYYMMDD}-{SEQ}' },
  { key: 'numbering.rule.inventory',  name: '盘点任务编号规则', value: 'INV-{YYYYMMDD}-{SEQ}' },
];

const DEFAULT_RULE_KEYS = new Set(DEFAULT_RULES.map((rule) => rule.key));

const VARIABLE_HINTS = [
  { var: '{YYYYMMDD}', desc: '年月日（8位）' },
  { var: '{YYYY}', desc: '年（四位数）' },
  { var: '{YY}',   desc: '年（后两位）' },
  { var: '{MM}',   desc: '月（两位数）' },
  { var: '{DD}',   desc: '日（两位数）' },
  { var: '{HH}',   desc: '时（两位数）' },
  { var: '{MI}',   desc: '分（两位数）' },
  { var: '{SS}',   desc: '秒（两位数）' },
  { var: '{SEQ}',  desc: '序号（自动递增）' },
];

export default function NumberingRulesTab() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newRule, setNewRule] = useState({
    key: '',
    name: '',
    value: 'WF-{YYYYMMDD}-{SEQ}',
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await getSysConfigList({ page: 1, pageSize: 50, configKey: 'numbering.rule.' });
      const list = ((res as any)?.records ?? (res as any)?.data ?? []) as any[];
      const fetchedItems = list.map((r: any) => ({
        id: r.id,
        key: r.configKey,
        name: r.configName,
        value: r.configValue ?? '',
      }));
      const fetchedByKey = new Map(fetchedItems.map((item) => [item.key, item]));
      const items = [
        ...DEFAULT_RULES.map((rule) => ({ ...rule, ...fetchedByKey.get(rule.key) })),
        ...fetchedItems.filter((item) => !DEFAULT_RULE_KEYS.has(item.key)).sort((a, b) => a.key.localeCompare(b.key)),
      ];
      setRules(items);
      const vals: Record<string, string> = {};
      items.forEach(i => { vals[i.key] = i.value; });
      setEditValues(vals);
    } catch {
      toast.error('加载编号规则失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const list = await workflowApi.list();
      setWorkflows((Array.isArray(list) ? list : []).filter((item) => item.businessType?.startsWith('CUSTOM_')));
    } catch {
      setWorkflows([]);
    }
  };

  useEffect(() => { fetchRules(); fetchWorkflows(); }, []);

  const resolveConfigKey = (input: string) => {
    const trimmed = input.trim();
    return trimmed.startsWith('numbering.rule.') ? trimmed : `numbering.rule.${trimmed}`;
  };

  const handleWorkflowSelect = (businessType: string) => {
    const workflow = workflows.find((item) => item.businessType === businessType);
    const code = businessType.replace(/^CUSTOM_/, '') || 'FLOW';
    setNewRule({
      key: `approval.${businessType}`,
      name: `${workflow?.name || businessType}编号规则`,
      value: `${code}-{YYYYMMDD}-{SEQ}`,
    });
  };

  const handleCreate = async () => {
    const configKey = resolveConfigKey(newRule.key);
    if (!newRule.key.trim() || !newRule.name.trim() || !newRule.value.trim()) {
      toast.error('规则编码、名称和模板不能为空');
      return;
    }
    if (!/^numbering\.rule\.[a-zA-Z0-9_.-]+$/.test(configKey)) {
      toast.error('规则编码只能包含字母、数字、点、下划线和中划线');
      return;
    }
    if (rules.some((rule) => rule.key === configKey)) {
      toast.error('该编号规则已存在');
      return;
    }
    setCreating(true);
    try {
      await createSysConfig({
        configGroup: 'SYSTEM',
        configKey,
        configName: newRule.name.trim(),
        configValue: newRule.value.trim(),
        configType: 'N',
        remark: '业务编号生成规则',
        status: 0,
      } as any);
      toast.success('编号规则已新增');
      setNewRule({ key: '', name: '', value: 'WF-{YYYYMMDD}-{SEQ}' });
      setShowCreate(false);
      await fetchRules();
    } catch {
      toast.error('新增编号规则失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (rule: RuleItem) => {
    if (!rule.id || DEFAULT_RULE_KEYS.has(rule.key)) {
      return;
    }
    setDeletingKey(rule.key);
    try {
      await deleteSysConfig(rule.id);
      toast.success('编号规则已删除');
      await fetchRules();
    } catch {
      toast.error('删除编号规则失败');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let success = 0;
    let fail = 0;
    for (const rule of rules) {
      const newVal = editValues[rule.key] ?? '';
      if (!rule.id || newVal !== rule.value) {
        try {
          if (rule.id) {
            await updateSysConfig(rule.id, { configValue: newVal } as any);
          } else {
            await createSysConfig({
              configGroup: 'SYSTEM',
              configKey: rule.key,
              configName: rule.name,
              configValue: newVal,
              configType: 'Y',
              remark: '业务编号生成规则',
              status: 0,
            } as any);
          }
          success++;
        } catch {
          fail++;
        }
      }
    }
    if (success > 0) toast.success(`已保存 ${success} 条规则${fail > 0 ? `，${fail} 条失败` : ''}`);
    else if (fail > 0) toast.error('保存失败');
    await fetchRules();
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748b]">
          设置资产、工单、审批、退役、赔偿、盘点等业务编号模板。修改后立即生效，新建单据时按新规则生成。
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchRules} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="secondary" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="w-4 h-4 mr-1" />
            新增规则
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-1" />
            保存修改
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>新增编号规则</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#64748b]">自定义流程</label>
                <select
                  className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  value=""
                  onChange={(e) => e.target.value && handleWorkflowSelect(e.target.value)}
                >
                  <option value="">选择后自动生成规则</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.businessType} value={workflow.businessType}>
                      {workflow.name || workflow.businessType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#64748b]">规则编码</label>
                <input
                  className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  placeholder="approval.CUSTOM_PURCHASE"
                  value={newRule.key}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, key: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#64748b]">显示名称</label>
                <input
                  className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  placeholder="采购流程编号规则"
                  value={newRule.name}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#64748b]">编号模板</label>
                <input
                  className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  value={newRule.value}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, value: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-[#94a3b8]">
                自定义流程专属审批编号请使用 <code className="bg-[#f1f5f9] px-1 rounded">approval.CUSTOM_xxx</code>，系统会保存为 <code className="bg-[#f1f5f9] px-1 rounded">numbering.rule.approval.CUSTOM_xxx</code>。
              </p>
              <Button onClick={handleCreate} loading={creating}>
                <Plus className="w-4 h-4 mr-1" />
                确认新增
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>编号规则列表</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              加载中...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8] text-sm">暂无编号规则配置</div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.key} className="flex items-start gap-4 p-3 bg-[#f8fafc] rounded-lg">
                  <div className="w-36 flex-shrink-0 pt-2">
                    <label className="text-sm font-medium text-[#0f172a]">{rule.name}</label>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{rule.key.replace('numbering.rule.', '')}</p>
                  </div>
                  <div className="flex-1">
                    <input
                      className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm font-mono
                        focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                      value={editValues[rule.key] ?? ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [rule.key]: e.target.value }))}
                    />
                  </div>
                  <div className="w-48 flex-shrink-0 pt-2">
                    <p className="text-xs text-[#94a3b8]">生成示例：</p>
                    <p className="text-xs font-mono text-[#2563eb] mt-0.5">
                      {previewNumber(editValues[rule.key] ?? rule.value)}
                    </p>
                  </div>
                  {!DEFAULT_RULE_KEYS.has(rule.key) && rule.id && (
                    <button
                      type="button"
                      className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      disabled={deletingKey === rule.key}
                      onClick={() => handleDelete(rule)}
                      title="删除规则"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>可用变量说明</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {VARIABLE_HINTS.map((v) => (
              <div key={v.var} className="flex items-center gap-2">
                <code className="px-2 py-0.5 bg-[#f1f5f9] rounded text-[#2563eb] font-mono text-xs">{v.var}</code>
                <span className="text-[#64748b]">{v.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#94a3b8] mt-3">
            例：<code className="bg-[#f1f5f9] px-1 rounded">ZC-{'{YYYYMMDD}'}-{'{SEQ}'}</code> → <code className="bg-[#f1f5f9] px-1 rounded">ZC-20260529-001</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** 预览生成的编号 */
function previewNumber(pattern: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = String(now.getFullYear());
  const shortYear = year.slice(-2);
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  return pattern
    .replace(/\{YYYYMMDD\}/g, `${year}${month}${day}`)
    .replace(/\{YYYYMM\}/g, `${year}${month}`)
    .replace(/\{YYMMDD\}/g, `${shortYear}${month}${day}`)
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, shortYear)
    .replace(/\{MM\}/g, month)
    .replace(/\{DD\}/g, day)
    .replace(/\{HH\}/g, hour)
    .replace(/\{MI\}/g, minute)
    .replace(/\{SS\}/g, second)
    .replace(/\{SEQ\}/g, '001');
}
