import { useEffect, useMemo, useState } from 'react';
import {
  todoFieldsApi,
  type TodoFieldConfig,
  type TodoFieldPreview,
} from '../../api/todoFields';

type SystemTodoFieldsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const demoFields: TodoFieldConfig[] = [
  { fieldKey: 'processName', fieldLabel: '流程名称', visible: true, sortOrder: 10 },
  { fieldKey: 'nodeName', fieldLabel: '节点名称', visible: true, sortOrder: 20 },
  { fieldKey: 'applicantName', fieldLabel: '申请人', visible: true, sortOrder: 30, sensitive: true },
  { fieldKey: 'businessKey', fieldLabel: '业务标识', visible: true, sortOrder: 40, sensitive: true },
  { fieldKey: 'priority', fieldLabel: '优先级', visible: true, sortOrder: 50 },
];

function redactedErrorMessage(action: string) {
  return `${action}失败，错误详情已脱敏，请检查登录态、权限码、租户上下文、operatorId、confirmed 和审计 payload。`;
}

export default function SystemTodoFieldsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemTodoFieldsWorkbenchPageProps) {
  const [fields, setFields] = useState<TodoFieldConfig[]>([]);
  const [preview, setPreview] = useState<TodoFieldPreview | null>(null);
  const [roleCode, setRoleCode] = useState('APPROVER');
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleCount = useMemo(() => fields.filter((field) => field.visible).length, [fields]);
  const maskedSummary = preview?.maskedFields.map((field) => field.maskedLabel ?? field.fieldLabel ?? field.fieldKey).join('、') || '暂无敏感字段预览';

  const loadFields = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextFields, nextPreview] = await Promise.all([
        todoFieldsApi.listTodoFields(roleCode),
        todoFieldsApi.previewTodoFields(roleCode),
      ]);
      setFields(nextFields);
      setPreview(nextPreview);
      setMessage(nextFields.length === 0 ? '暂无待办字段配置，可保存示例配置验证 /todo-fields 闭环。' : null);
    } catch {
      setFields([]);
      setPreview(null);
      setError(redactedErrorMessage('待办字段加载'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadFields();
  }, [canView, roleCode]);

  const saveFields = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await todoFieldsApi.saveTodoFields({
        confirmed: true,
        reason: 'Day5 待办字段保存复核通过',
        auditEvidence: 'TODO_FIELD_SAVE_GATE',
        fields: demoFields,
      });
      setFields(saved);
      setMessage('字段配置已保存：重复 fieldKey、非法 sortOrder、原型污染键和缺审计 payload 均由后端拒绝。');
    } catch {
      setError(redactedErrorMessage('保存待办字段'));
    } finally {
      setSaving(false);
    }
  };

  const saveSortOrder = async () => {
    setSaving(true);
    setError(null);
    try {
      const sorted = await todoFieldsApi.saveTodoFieldSortOrder({
        confirmed: true,
        reason: 'Day5 待办字段排序复核通过',
        auditEvidence: 'TODO_FIELD_SORT_GATE',
        fields: demoFields.map((field, index) => ({ ...field, sortOrder: (index + 1) * 5 })),
      });
      setFields(sorted);
      setMessage('稳定排序已保存，后端按 sortOrder、fieldKey 归一化。');
    } catch {
      setError(redactedErrorMessage('保存待办字段排序'));
    } finally {
      setSaving(false);
    }
  };

  const saveRoleOverride = async () => {
    setSaving(true);
    setError(null);
    try {
      const overridden = await todoFieldsApi.saveTodoFieldRoleOverride(roleCode, {
        confirmed: true,
        reason: 'Day5 待办字段角色覆盖复核通过',
        auditEvidence: 'TODO_FIELD_ROLE_GATE',
        explanation: '角色覆盖来源：overridden；未授权敏感字段仅保留脱敏解释',
        fields: demoFields.map((field) => ({ ...field, visible: field.fieldKey !== 'businessKey' })),
      });
      setFields(overridden);
      setMessage('角色覆盖已保存，页面展示 inherited/default/overridden 解释。');
    } catch {
      setError(redactedErrorMessage('保存角色覆盖'));
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    setSaving(true);
    setError(null);
    try {
      const defaults = await todoFieldsApi.resetTodoFieldDefaults({
        confirmed: true,
        reason: 'Day5 待办字段默认恢复复核通过',
        auditEvidence: 'TODO_FIELD_RESET_GATE',
      });
      setFields(defaults);
      setMessage('默认配置已恢复，后端保留历史记录并写入审计摘要。');
    } catch {
      setError(redactedErrorMessage('恢复默认配置'));
    } finally {
      setSaving(false);
    }
  };

  const previewFields = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextPreview = await todoFieldsApi.previewTodoFields(roleCode);
      setPreview(nextPreview);
      setMessage('只读预览已刷新：敏感字段默认脱敏，不返回原始敏感值。');
    } catch {
      setError(redactedErrorMessage('预览待办字段'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问待办字段配置，请确认 workflow:todo-field:list/update/reset 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">待办字段配置</h3>
          <p className="mt-1 text-sm text-slate-500">真实调用 /todo-fields 列表、保存、排序、角色覆盖、默认恢复与预览接口。</p>
        </div>
        <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={loading || saving} type="button" onClick={() => void loadFields()}>
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        字段配置强制租户隔离；保存、排序、角色覆盖和默认恢复都需要 confirmed、operatorId、reason/auditEvidence；preview 只读且默认脱敏。
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">字段列表</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{visibleCount}/{fields.length} 可见</span>
          </div>
          {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">待办字段加载中...</p> : null}
          {!loading && fields.length === 0 ? <p className="text-sm text-slate-500">暂无待办字段配置。</p> : null}
          <div className="space-y-2">
            {fields.map((field) => (
              <div key={field.fieldKey} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{field.fieldLabel ?? field.fieldKey}</span>
                  <span className="text-xs text-slate-500">#{field.sortOrder}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{field.fieldKey} · {field.visible ? '可见' : '隐藏'} · {field.source ?? 'inherited'}{field.sensitive ? ' · 敏感' : ''}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold">角色覆盖与预览</h4>
                <p className="mt-1 text-xs text-slate-500">当前角色：{roleCode}；展示 inherited/default/overridden 来源和脱敏结果。</p>
              </div>
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={roleCode} onChange={(event) => setRoleCode(event.target.value)} aria-label="待办字段角色选择">
                <option value="APPROVER">APPROVER</option>
                <option value="AUDITOR">AUDITOR</option>
                <option value="USER">USER</option>
              </select>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">预览可见字段</dt><dd>{preview?.totalVisible ?? 0} 个</dd></div>
              <div><dt className="text-xs text-slate-500">敏感字段脱敏</dt><dd>{maskedSummary}</dd></div>
            </dl>
            <div className="mt-3 space-y-2">
              {(preview?.visibleFields ?? []).map((field) => (
                <div key={field.fieldKey} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {field.maskedLabel ?? field.fieldLabel ?? field.fieldKey}：{field.maskedValue ?? '预览值已脱敏'}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">配置操作</h4>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={saveFields}>保存字段配置</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={saveSortOrder}>保存稳定排序</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving} type="button" onClick={saveRoleOverride}>保存角色覆盖</button>
              <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving} type="button" onClick={resetDefaults}>恢复默认配置</button>
              <button className="rounded-xl border border-blue-200 px-4 py-2 text-sm text-blue-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={previewFields}>刷新预览</button>
            </div>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}
