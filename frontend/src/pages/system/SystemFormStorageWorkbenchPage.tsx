import { useEffect, useMemo, useState } from 'react';
import {
  formStorageApi,
  type FormStorageAttachmentSummary,
  type FormStorageExportSnapshot,
  type FormStorageRecord,
} from '../../api/formStorage';

type SystemFormStorageWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const defaultQuery = { formKey: 'ASSET_FORM', includeArchived: true, pageNum: 1, pageSize: 20 };

function redactedErrorMessage(action: string) {
  return `${action}失败，错误详情已脱敏，请检查登录态、权限码、租户上下文或高危操作审计字段。`;
}

function statusLabel(status?: string | null) {
  if (status === 'ARCHIVED') return '已归档';
  if (status === 'DELETED') return '已删除留痕';
  return '可更新';
}

export default function SystemFormStorageWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemFormStorageWorkbenchPageProps) {
  const [records, setRecords] = useState<FormStorageRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<FormStorageRecord | null>(null);
  const [attachments, setAttachments] = useState<FormStorageAttachmentSummary[]>([]);
  const [exportSnapshot, setExportSnapshot] = useState<FormStorageExportSnapshot | null>(null);
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedId = selectedRecord?.id;
  const selectedFields = useMemo(() => selectedRecord?.fieldSummaries ?? [], [selectedRecord]);
  const visibleAttachments = attachments.length > 0 ? attachments : selectedRecord?.attachmentSummaries ?? [];

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextRecords = await formStorageApi.listFormStorageRecords(defaultQuery);
      setRecords(nextRecords);
      const firstRecord = nextRecords[0] ?? null;
      setSelectedRecord(firstRecord);
      setExportSnapshot(null);
      if (!firstRecord) {
        setAttachments([]);
        setMessage('暂无表单实例，可通过创建示例实例验证 /form-storage 最小闭环。');
        return;
      }
      const [detail, nextAttachments] = await Promise.all([
        formStorageApi.getFormStorageRecord(firstRecord.id),
        formStorageApi.listFormStorageAttachments(firstRecord.id),
      ]);
      setSelectedRecord(detail);
      setAttachments(nextAttachments);
      setMessage(null);
    } catch {
      setRecords([]);
      setSelectedRecord(null);
      setAttachments([]);
      setError(redactedErrorMessage('表单存储加载'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadRecords();
  }, [canView]);

  const createDemoRecord = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await formStorageApi.createFormStorageRecord({
        formKey: 'ASSET_FORM',
        definitionVersion: 1,
        businessKey: 'ASSET_CASE_MASKED',
        fieldValues: [
          { fieldKey: 'assetNo', fieldLabel: '资产编号', valueType: 'text', rawValue: 'MASKED_INPUT_SAMPLE' },
          { fieldKey: 'ownerPhone', fieldLabel: '联系方式', valueType: 'text', rawValue: 'SENSITIVE_INPUT_SAMPLE', sensitive: true },
        ],
        attachments: [
          { fileName: '验收附件.pdf', contentType: 'application/pdf', fileSize: 2048, referenceKey: 'acceptanceDoc', storageKey: 'MASKED_REFERENCE_INPUT' },
        ],
      });
      setSelectedRecord(created);
      setRecords((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setAttachments(created.attachmentSummaries ?? []);
      setMessage('示例实例已创建：响应只展示 maskedValue 与附件脱敏摘要。');
    } catch {
      setError(redactedErrorMessage('创建表单实例'));
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedRecord = async () => {
    if (!selectedRecord || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await formStorageApi.updateFormStorageRecord(selectedId, {
        formKey: selectedRecord.formKey,
        definitionVersion: selectedRecord.definitionVersion,
        businessKey: selectedRecord.businessKey ?? 'ASSET_CASE_MASKED',
        fieldValues: [
          { fieldKey: 'assetNo', fieldLabel: '资产编号', valueType: 'text', rawValue: 'MASKED_UPDATE_SAMPLE' },
          { fieldKey: 'ownerPhone', fieldLabel: '联系方式', valueType: 'text', rawValue: 'SENSITIVE_UPDATE_SAMPLE', sensitive: true },
        ],
      });
      setSelectedRecord(updated);
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage('字段值已更新，页面仍只显示脱敏摘要。');
    } catch {
      setError(redactedErrorMessage('更新表单实例'));
    } finally {
      setSaving(false);
    }
  };

  const registerAttachment = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const attachment = await formStorageApi.registerFormStorageAttachment(selectedId, {
        fileName: '复核附件.pdf',
        contentType: 'application/pdf',
        fileSize: 4096,
        referenceKey: 'reviewEvidence',
        storageKey: 'MASKED_REVIEW_REFERENCE',
      });
      setAttachments((current) => [attachment, ...current.filter((item) => item.id !== attachment.id)]);
      setMessage('附件引用已登记：未上传二进制，URL/storageKey 已脱敏。');
    } catch {
      setError(redactedErrorMessage('附件引用登记'));
    } finally {
      setSaving(false);
    }
  };

  const archiveSelectedRecord = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const archived = await formStorageApi.archiveFormStorageRecord(selectedId, {
        confirmed: true,
        reason: 'Day4 表单实例归档复核通过',
        auditEvidence: 'FORM_STORAGE_ARCHIVE_GATE',
      });
      setSelectedRecord(archived);
      setRecords((current) => current.map((item) => item.id === archived.id ? archived : item));
      setMessage('归档留痕已登记，confirmed、operatorId、reason/auditEvidence 均由后端校验。');
    } catch {
      setError(redactedErrorMessage('归档表单实例'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedRecord = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const removed = await formStorageApi.deleteFormStorageRecord(selectedId, {
        confirmed: true,
        reason: 'Day4 表单实例删除留痕复核通过',
        auditEvidence: 'FORM_STORAGE_DELETE_GATE',
      });
      setSelectedRecord(removed);
      setRecords((current) => current.map((item) => item.id === removed.id ? removed : item));
      setMessage('删除留痕已登记，未物理删除字段或附件引用。');
    } catch {
      setError(redactedErrorMessage('删除留痕'));
    } finally {
      setSaving(false);
    }
  };

  const deleteFirstAttachment = async () => {
    if (!selectedId || !visibleAttachments[0]?.id) return;
    setSaving(true);
    setError(null);
    try {
      await formStorageApi.deleteFormStorageAttachment(selectedId, visibleAttachments[0].id, {
        confirmed: true,
        reason: '删除附件引用留痕复核通过',
        auditEvidence: 'FORM_ATTACHMENT_DELETE_GATE',
      });
      const nextAttachments = await formStorageApi.listFormStorageAttachments(selectedId);
      setAttachments(nextAttachments);
      setMessage('附件引用删除留痕已登记，页面只保留脱敏摘要。');
    } catch {
      setError(redactedErrorMessage('附件引用删除'));
    } finally {
      setSaving(false);
    }
  };

  const exportMasked = async () => {
    setSaving(true);
    setError(null);
    try {
      const snapshot = await formStorageApi.exportFormStorageRecords({
        confirmed: true,
        reason: '导出脱敏快照复核通过',
        auditEvidence: 'FORM_STORAGE_EXPORT_GATE',
        query: defaultQuery,
      });
      setExportSnapshot(snapshot);
      setMessage('导出脱敏快照已生成，不包含 rawValue、附件 URL/storageKey 或原始文件流。');
    } catch {
      setError(redactedErrorMessage('导出脱敏快照'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问表单存储，请确认 workflow:form-storage:view/create/update/archive/delete/export 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">表单存储</h3>
          <p className="mt-1 text-sm text-slate-500">
            真实调用 /form-storage 列表、详情、创建、更新、归档、删除留痕、附件引用与导出脱敏接口。
          </p>
        </div>
        <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={loading || saving} type="button" onClick={() => void loadRecords()}>
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        服务层强制租户隔离；字段值、附件引用、错误和导出均默认脱敏；附件只登记引用元数据，不读取 uploads，不提供二进制上传或下载。
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">实例列表</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{records.length} 条</span>
          </div>
          {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">表单存储加载中...</p> : null}
          {!loading && records.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无表单实例。</h3> : null}
          <div className="space-y-2">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedRecord?.id === record.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'}`}
                onClick={() => {
                  setSelectedRecord(record);
                  void formStorageApi.listFormStorageAttachments(record.id).then(setAttachments).catch(() => setError(redactedErrorMessage('附件引用查询')));
                }}
              >
                <span className="block font-medium">{record.formKey} · v{record.definitionVersion}</span>
                <span className="mt-1 block text-xs">{statusLabel(record.status)} · {record.fieldSummary ?? '字段摘要已脱敏'}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold">实例详情与脱敏摘要</h4>
                <p className="mt-1 text-xs text-slate-500">{selectedRecord ? `${selectedRecord.formKey} / ${selectedRecord.businessKey ?? '未绑定业务标识'}` : '未选择实例'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{statusLabel(selectedRecord?.status)}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <h3 className="text-xs font-medium text-slate-500">字段摘要</h3>
                <p className="mt-1">{selectedRecord?.fieldSummary ?? '字段摘要为空'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <h3 className="text-xs font-medium text-slate-500">附件摘要</h3>
                <p className="mt-1">{selectedRecord?.attachmentSummary ?? '附件引用为空'}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <h5 className="mb-2 text-sm font-semibold">字段 maskedValue</h5>
                <div className="space-y-2 text-sm text-slate-600">
                  {selectedFields.length === 0 ? <p>暂无字段摘要。</p> : null}
                  {selectedFields.map((field) => (
                    <div key={field.id ?? field.fieldKey} className="rounded-xl border border-slate-100 px-3 py-2">
                      {field.fieldLabel ?? field.fieldKey}：{field.maskedValue}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="mb-2 text-sm font-semibold">附件脱敏引用</h5>
                <div className="space-y-2 text-sm text-slate-600">
                  {visibleAttachments.length === 0 ? <p>暂无附件引用。</p> : null}
                  {visibleAttachments.map((attachment) => (
                    <div key={attachment.id ?? attachment.referenceKey} className="rounded-xl border border-slate-100 px-3 py-2">
                      <p>{attachment.fileName} · {attachment.contentType ?? '未知类型'} · {attachment.fileSize ?? 0} bytes</p>
                      <p className="text-xs text-slate-500">{attachment.maskedUrl ?? 'url 已脱敏'} / {attachment.maskedStorageKey ?? 'storageKey 已脱敏'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">操作留痕</h4>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving} type="button" onClick={createDemoRecord}>创建示例实例</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving || !selectedId} type="button" onClick={updateSelectedRecord}>更新字段摘要</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:bg-slate-100" disabled={saving || !selectedId} type="button" onClick={registerAttachment}>登记附件引用</button>
              <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={archiveSelectedRecord}>归档实例</button>
              <button className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving || !selectedId} type="button" onClick={deleteSelectedRecord}>删除留痕</button>
              <button className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 disabled:bg-slate-100" disabled={saving || !selectedId || visibleAttachments.length === 0} type="button" onClick={deleteFirstAttachment}>删除附件引用</button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-300" disabled={saving} type="button" onClick={exportMasked}>导出脱敏快照</button>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">归档留痕</dt><dd>{selectedRecord?.archiveReason ?? '尚未归档'}</dd></div>
              <div><dt className="text-xs text-slate-500">删除留痕</dt><dd>{selectedRecord?.deleteReason ?? '尚未删除'}</dd></div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">导出脱敏结果</h4>
            {exportSnapshot ? (
              <div className="space-y-2 text-sm text-slate-600">
                <p>导出编号：{exportSnapshot.exportId}</p>
                <p>记录 {exportSnapshot.total} 条，字段 {exportSnapshot.maskedFields.length} 个，附件 {exportSnapshot.maskedAttachments.length} 个。</p>
                <p className="text-xs text-slate-500">仅包含 querySummary、maskedFields、maskedAttachments 与审计证据。</p>
              </div>
            ) : <p className="text-sm text-slate-500">尚未生成导出快照。</p>}
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    </section>
  );
}
