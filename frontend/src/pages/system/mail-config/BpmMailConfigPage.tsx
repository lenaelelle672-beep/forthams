import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Copy, Variable, Mail, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { bpmMailConfigApi } from '@/api/bpmMailConfig';
import type {
  BpmMailConfig,
  BpmMailVariable,
  CreateBpmMailConfigRequest,
  UpdateBpmMailConfigRequest,
  CreateBpmMailVariableRequest,
  UpdateBpmMailVariableRequest,
} from '@/types/bpmMailConfig';
import { PROCESS_TYPES } from '@/types/bpmMailConfig';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/Dialog';

const PROCESS_TYPE_OPTIONS = Object.entries(PROCESS_TYPES).map(([key, label]) => ({ key, label }));

const emptyConfigForm: CreateBpmMailConfigRequest = {
  processType: 'RETIREMENT',
  processName: '',
  nodeId: '',
  nodeName: '',
  subjectTemplate: '',
  contentTemplate: '',
  toRecipients: '',
  ccRecipients: '',
  enabled: 1,
  remark: '',
};

const emptyVariableForm: CreateBpmMailVariableRequest = {
  varKey: '',
  varName: '',
  defaultValue: '',
  remark: '',
};

export default function BpmMailConfigPage() {
  const qc = useQueryClient();

  const [processType, setProcessType] = useState('RETIREMENT');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BpmMailConfig | null>(null);
  const [configForm, setConfigForm] = useState<CreateBpmMailConfigRequest>(emptyConfigForm);

  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<BpmMailVariable | null>(null);
  const [variableForm, setVariableForm] = useState<CreateBpmMailVariableRequest>(emptyVariableForm);

  const subjectRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['bpm-mail-configs', processType],
    queryFn: () => bpmMailConfigApi.list(processType),
    select: (res) => res as unknown as BpmMailConfig[],
  });

  const { data: variables = [], isLoading: variablesLoading } = useQuery({
    queryKey: ['bpm-mail-variables'],
    queryFn: () => bpmMailConfigApi.listVariables(),
    select: (res) => res as unknown as BpmMailVariable[],
  });

  const createConfigMut = useMutation({
    mutationFn: (data: CreateBpmMailConfigRequest) => bpmMailConfigApi.create(data),
    onSuccess: () => {
      toast.success('配置已创建');
      qc.invalidateQueries({ queryKey: ['bpm-mail-configs'] });
      closeConfigDialog();
    },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });

  const updateConfigMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBpmMailConfigRequest }) =>
      bpmMailConfigApi.update(id, data),
    onSuccess: () => {
      toast.success('配置已更新');
      qc.invalidateQueries({ queryKey: ['bpm-mail-configs'] });
      closeConfigDialog();
    },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });

  const deleteConfigMut = useMutation({
    mutationFn: (id: number) => bpmMailConfigApi.delete(id),
    onSuccess: () => {
      toast.success('配置已删除');
      qc.invalidateQueries({ queryKey: ['bpm-mail-configs'] });
    },
    onError: () => toast.error('删除失败'),
  });

  const createVariableMut = useMutation({
    mutationFn: (data: CreateBpmMailVariableRequest) => bpmMailConfigApi.createVariable(data),
    onSuccess: () => {
      toast.success('变量已创建');
      qc.invalidateQueries({ queryKey: ['bpm-mail-variables'] });
      closeVariableDialog();
    },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });

  const updateVariableMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBpmMailVariableRequest }) =>
      bpmMailConfigApi.updateVariable(id, data),
    onSuccess: () => {
      toast.success('变量已更新');
      qc.invalidateQueries({ queryKey: ['bpm-mail-variables'] });
      closeVariableDialog();
    },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });

  const deleteVariableMut = useMutation({
    mutationFn: (id: number) => bpmMailConfigApi.deleteVariable(id),
    onSuccess: () => {
      toast.success('变量已删除');
      qc.invalidateQueries({ queryKey: ['bpm-mail-variables'] });
    },
    onError: () => toast.error('删除失败'),
  });

  function openCreateConfig() {
    setEditingConfig(null);
    setConfigForm({ ...emptyConfigForm, processType });
    setShowConfigDialog(true);
  }

  function openEditConfig(config: BpmMailConfig) {
    setEditingConfig(config);
    setConfigForm({
      processType: config.processType,
      processName: config.processName ?? '',
      nodeId: config.nodeId ?? '',
      nodeName: config.nodeName ?? '',
      subjectTemplate: config.subjectTemplate ?? '',
      contentTemplate: config.contentTemplate ?? '',
      toRecipients: config.toRecipients ?? '',
      ccRecipients: config.ccRecipients ?? '',
      enabled: config.enabled ?? 1,
      remark: config.remark ?? '',
    });
    setShowConfigDialog(true);
  }

  function closeConfigDialog() {
    setShowConfigDialog(false);
    setEditingConfig(null);
    setConfigForm(emptyConfigForm);
  }

  function submitConfig(event: React.FormEvent) {
    event.preventDefault();
    if (editingConfig) {
      const { processType: _pt, ...updates } = configForm;
      updateConfigMut.mutate({ id: editingConfig.id, data: updates });
    } else {
      createConfigMut.mutate(configForm);
    }
  }

  function insertVariable(varKey: string, target: 'subject' | 'content') {
    const placeholder = `\${${varKey}}`;
    if (target === 'subject' && subjectRef.current) {
      const ta = subjectRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = configForm.subjectTemplate!.slice(0, start) + placeholder + configForm.subjectTemplate!.slice(end);
      setConfigForm((prev) => ({ ...prev, subjectTemplate: newVal }));
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else if (target === 'content' && contentRef.current) {
      const ta = contentRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = configForm.contentTemplate!.slice(0, start) + placeholder + configForm.contentTemplate!.slice(end);
      setConfigForm((prev) => ({ ...prev, contentTemplate: newVal }));
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    }
  }

  function openCreateVariable() {
    setEditingVariable(null);
    setVariableForm(emptyVariableForm);
    setShowVariableDialog(true);
  }

  function openEditVariable(variable: BpmMailVariable) {
    setEditingVariable(variable);
    setVariableForm({
      varKey: variable.varKey,
      varName: variable.varName,
      defaultValue: variable.defaultValue ?? '',
      remark: variable.remark ?? '',
    });
    setShowVariableDialog(true);
  }

  function closeVariableDialog() {
    setShowVariableDialog(false);
    setEditingVariable(null);
    setVariableForm(emptyVariableForm);
  }

  function submitVariable(event: React.FormEvent) {
    event.preventDefault();
    if (editingVariable) {
      const { varKey: _vk, ...updates } = variableForm;
      updateVariableMut.mutate({ id: editingVariable.id, data: updates });
    } else {
      createVariableMut.mutate(variableForm);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="流程邮件配置"
        subtitle="按流程类型和节点精细化配置邮件通知模板"
        breadcrumbs={[{ label: '系统设置' }, { label: '流程邮件配置' }]}
      />

      {/* ── Config Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <Mail className="w-4 h-4 inline mr-2" />
              邮件配置
            </CardTitle>
            <Button variant="primary" size="sm" onClick={openCreateConfig}>
              <Plus className="w-4 h-4" />
              新增配置
            </Button>
          </div>
          <div className="flex items-center gap-1 mt-3 border-b border-[#e5e7eb] pb-0">
            {PROCESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setProcessType(opt.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                  processType === opt.key
                    ? 'border-[#3b82f6] text-[#3b82f6]'
                    : 'border-transparent text-[#64748b] hover:text-[#374151]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3">流程名称</th>
                  <th className="px-5 py-3">节点</th>
                  <th className="px-5 py-3">主题模板</th>
                  <th className="px-5 py-3">主送人</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {configsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[#94a3b8]">加载中...</td>
                  </tr>
                ) : configs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[#94a3b8]">暂无配置，点击"新增配置"添加</td>
                  </tr>
                ) : (
                  configs.map((config) => (
                    <tr key={config.id} className="hover:bg-[#f8fafc]">
                      <td className="px-5 py-3.5 font-medium text-[#0f172a]">{config.processName || '-'}</td>
                      <td className="px-5 py-3.5 text-[#64748b]">
                        {config.nodeId ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#f1f5f9] text-[#475569]">
                            {config.nodeName || config.nodeId}
                          </span>
                        ) : (
                          <span className="text-xs text-[#94a3b8]">通用</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#64748b] max-w-[200px] truncate">{config.subjectTemplate || '-'}</td>
                      <td className="px-5 py-3.5 text-[#64748b]">{config.toRecipients || '-'}</td>
                      <td className="px-5 py-3.5">
                        {config.enabled === 1
                          ? <span className="inline-flex items-center gap-1 text-xs text-[#16a34a]"><span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />启用</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-[#94a3b8]"><span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />停用</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditConfig(config)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`确定删除配置「${config.processName || config.processType}」？`)) {
                                deleteConfigMut.mutate(config.id);
                              }
                            }}
                            className="text-[#ef4444] hover:text-[#dc2626]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Variable Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <Variable className="w-4 h-4 inline mr-2" />
              邮件变量定义
            </CardTitle>
            <Button variant="primary" size="sm" onClick={openCreateVariable}>
              <Plus className="w-4 h-4" />
              新增变量
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-5 py-3">变量KEY</th>
                  <th className="px-5 py-3">变量名称</th>
                  <th className="px-5 py-3">默认值</th>
                  <th className="px-5 py-3">备注</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {variablesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[#94a3b8]">加载中...</td>
                  </tr>
                ) : variables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[#94a3b8]">暂无变量定义</td>
                  </tr>
                ) : (
                  variables.map((v) => (
                    <tr key={v.id} className="hover:bg-[#f8fafc]">
                      <td className="px-5 py-3.5">
                        <code className="px-2 py-0.5 bg-[#f1f5f9] text-[#3b82f6] rounded text-xs font-mono">
                          {'${' + v.varKey + '}'}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#0f172a]">{v.varName}</td>
                      <td className="px-5 py-3.5 text-[#64748b]">{v.defaultValue || '-'}</td>
                      <td className="px-5 py-3.5 text-[#94a3b8] text-xs">{v.remark || '-'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditVariable(v)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`确定删除变量「${v.varName}」？`)) {
                                deleteVariableMut.mutate(v.id);
                              }
                            }}
                            className="text-[#ef4444] hover:text-[#dc2626]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Config Dialog ── */}
      <Dialog open={showConfigDialog} onOpenChange={(open) => !open && closeConfigDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑邮件配置' : '新增邮件配置'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitConfig} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">流程类型</label>
                {editingConfig ? (
                  <div className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-[#f8fafc] flex items-center text-[#64748b]">
                    {PROCESS_TYPES[configForm.processType] || configForm.processType}
                  </div>
                ) : (
                  <select
                    value={configForm.processType}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, processType: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                  >
                    {PROCESS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">流程名称</label>
                <input
                  value={configForm.processName}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, processName: e.target.value }))}
                  placeholder="如 报废审批通知"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">节点ID</label>
                <input
                  value={configForm.nodeId ?? ''}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, nodeId: e.target.value }))}
                  placeholder="留空=通用配置"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">节点名称</label>
                <input
                  value={configForm.nodeName ?? ''}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, nodeName: e.target.value }))}
                  placeholder="如 一级审批"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
            </div>

            {/* Subject Template */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">邮件主题模板</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {variables.map((v) => (
                  <button
                    key={v.varKey}
                    type="button"
                    onClick={() => insertVariable(v.varKey, 'subject')}
                    className="inline-flex items-center px-2 py-0.5 text-xs bg-[#eff6ff] text-[#3b82f6] rounded-md border border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {v.varKey}
                  </button>
                ))}
              </div>
              <textarea
                ref={subjectRef}
                value={configForm.subjectTemplate}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, subjectTemplate: e.target.value }))}
                placeholder="如 【资产管理】通知 - ${processNo}"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-y font-mono"
              />
            </div>

            {/* Content Template */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">邮件内容模板</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {variables.map((v) => (
                  <button
                    key={v.varKey}
                    type="button"
                    onClick={() => insertVariable(v.varKey, 'content')}
                    className="inline-flex items-center px-2 py-0.5 text-xs bg-[#eff6ff] text-[#3b82f6] rounded-md border border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {v.varKey}
                  </button>
                ))}
              </div>
              <textarea
                ref={contentRef}
                value={configForm.contentTemplate}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, contentTemplate: e.target.value }))}
                placeholder="HTML 模板内容，支持 ${varKey} 变量替换"
                rows={6}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-y font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">主送人</label>
                <input
                  value={configForm.toRecipients}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, toRecipients: e.target.value }))}
                  placeholder="如 ${applicantName} 或 admin@example.com"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">抄送人</label>
                <input
                  value={configForm.ccRecipients}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, ccRecipients: e.target.value }))}
                  placeholder="可选，多个用逗号分隔"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#e5e7eb] text-[#3b82f6] focus:ring-[#3b82f6]"
                    checked={configForm.enabled === 1}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, enabled: e.target.checked ? 1 : 0 }))}
                  />
                  <span className="text-sm font-medium text-[#374151]">启用</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">备注</label>
                <input
                  value={configForm.remark ?? ''}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, remark: e.target.value }))}
                  placeholder="备注信息"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="primary" disabled={createConfigMut.isPending || updateConfigMut.isPending}>
                {editingConfig ? '保存修改' : '创建配置'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Variable Dialog ── */}
      <Dialog open={showVariableDialog} onOpenChange={(open) => !open && closeVariableDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariable ? '编辑变量' : '新增变量'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitVariable} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">变量KEY</label>
              {editingVariable ? (
                <div className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-[#f8fafc] flex items-center text-[#64748b]">
                  {editingVariable.varKey}
                </div>
              ) : (
                <input
                  value={variableForm.varKey}
                  onChange={(e) => setVariableForm((prev) => ({ ...prev, varKey: e.target.value }))}
                  placeholder="如 assetName"
                  className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                  required
                />
              )}
              <p className="text-xs text-[#94a3b8] mt-1">模板中使用 {'${varKey}'} 引用变量</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">变量名称</label>
              <input
                value={variableForm.varName}
                onChange={(e) => setVariableForm((prev) => ({ ...prev, varName: e.target.value }))}
                placeholder="如 资产名称"
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">默认值</label>
              <input
                value={variableForm.defaultValue ?? ''}
                onChange={(e) => setVariableForm((prev) => ({ ...prev, defaultValue: e.target.value }))}
                placeholder="可选，预览时使用的默认值"
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">备注</label>
              <input
                value={variableForm.remark ?? ''}
                onChange={(e) => setVariableForm((prev) => ({ ...prev, remark: e.target.value }))}
                placeholder="可选"
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="primary" disabled={createVariableMut.isPending || updateVariableMut.isPending}>
                {editingVariable ? '保存修改' : '创建变量'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
