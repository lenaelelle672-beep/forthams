import { useEffect, useState } from 'react';
import { listSystemFieldMappings, previewSystemFieldMapping, type SystemFieldMappingRecord } from '../../api/systemFieldMappings';

export const SYSTEM_FIELD_MAPPINGS_ACTION_PERMISSIONS = {
  create: 'system:integration:edit',
  edit: 'system:integration:edit',
  delete: 'system:integration:delete',
  preview: 'system:integration:test',
} as const;

export default function SystemFieldMappingsWorkbenchPage({ embeddedInWorkbench = false, canView = true }: { embeddedInWorkbench?: boolean; canView?: boolean }) {
  const [items, setItems] = useState<SystemFieldMappingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    listSystemFieldMappings()
      .then((records) => {
        if (mounted) {
          setItems(records);
          setError(null);
        }
      })
      .catch(() => mounted && setError('字段映射加载失败，敏感细节已脱敏'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handlePreview = async () => {
    setSubmitting(true);
    try {
      const result = await previewSystemFieldMapping({
        sourceField: 'name',
        targetField: 'assetName',
        sampleValue: '  Laptop  ',
        transformExpression: 'trim(value)',
      });
      setPreview(result.transformedValue);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问字段映射，请确认 system:integration:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div>
        <h3 className="text-lg font-semibold">字段映射</h3>
        <p className="mt-1 text-sm text-slate-500">转换表达式仅允许 trim(value)、upper(value)、lower(value)，预览不写库、不外呼。</p>
      </div>
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">加载中...</div> : null}
      <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white" type="button" disabled={submitting} onClick={handlePreview}>预览转换</button>
      {preview ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">预览结果：{preview}</div> : null}
      {!loading && items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无字段映射。</div> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <h4 className="font-semibold">{item.mappingName}</h4>
            <p className="text-sm text-slate-500">{item.sourceField} → {item.targetField}</p>
            <p className="mt-1 text-xs text-slate-400">{item.transformExpression || '无转换'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
