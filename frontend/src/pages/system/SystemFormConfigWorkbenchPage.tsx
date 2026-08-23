import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  formDefinitionsApi,
  type FormDefinitionDTO,
  type FormDefinitionField,
  type FormDefinitionFieldOption,
  type FormDefinitionPreviewDTO,
  type FormDefinitionReferencesDTO,
  type FormDefinitionSchema,
  type FormDefinitionSection,
  type FormDefinitionValidationResult,
  type FormDefinitionVersionDTO,
} from '../../api/formDefinitions';

type SystemFormConfigWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const defaultFormKey = 'ASSET_FORM';

const fieldTypes = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'upload'] as const;

const defaultSchema: FormDefinitionSchema = {
  sections: [
    {
      sectionKey: 'basic',
      label: '基础信息',
      fields: [
        { fieldKey: 'assetNo', label: '资产编号', type: 'text', required: true, placeholder: '系统生成或手工录入' },
        { fieldKey: 'ownerPhone', label: '联系方式', type: 'text', sensitive: true, masked: true, defaultValue: '******' },
      ],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textFrom(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function boolFrom(value: unknown) {
  return value === true;
}

function unknownToText(value: unknown) {
  if (value == null) return '';
  return String(value);
}

function createField(fieldIndex: number): FormDefinitionField {
  return {
    fieldKey: `field_${Date.now()}_${fieldIndex}`,
    label: `新字段 ${fieldIndex}`,
    type: 'text',
    placeholder: '请输入字段值',
  };
}

function cloneField(field: FormDefinitionField): FormDefinitionField {
  return {
    ...field,
    options: field.options?.map((option) => ({ ...option })),
  };
}

function cloneSchema(schema: FormDefinitionSchema): FormDefinitionSchema {
  return {
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.map(cloneField),
    })),
  };
}

function normalizeOptions(options: unknown): FormDefinitionFieldOption[] | undefined {
  if (!Array.isArray(options)) return undefined;
  const nextOptions = options.filter(isRecord).map((option, index) => ({
    value: textFrom(option.value, `option_${index + 1}`),
    label: textFrom(option.label, textFrom(option.value, `选项 ${index + 1}`)),
    disabled: boolFrom(option.disabled),
  }));
  return nextOptions.length > 0 ? nextOptions : undefined;
}

function normalizeField(field: unknown, fieldIndex: number): FormDefinitionField {
  if (!isRecord(field)) return createField(fieldIndex);
  return {
    fieldKey: textFrom(field.fieldKey, `field_${fieldIndex}`),
    label: textFrom(field.label, `字段 ${fieldIndex}`),
    type: textFrom(field.type, 'text'),
    required: boolFrom(field.required),
    sensitive: boolFrom(field.sensitive),
    masked: boolFrom(field.masked),
    defaultValue: field.defaultValue,
    placeholder: textFrom(field.placeholder),
    helpText: textFrom(field.helpText),
    options: normalizeOptions(field.options),
  };
}

function normalizeSchema(schema: FormDefinitionSchema | Record<string, unknown> | null | undefined): FormDefinitionSchema {
  const sections = isRecord(schema) && Array.isArray(schema.sections)
    ? schema.sections.filter(isRecord).map((section, sectionIndex): FormDefinitionSection => {
      const fields = Array.isArray(section.fields)
        ? section.fields.map((field, fieldIndex) => normalizeField(field, fieldIndex + 1))
        : [];
      return {
        sectionKey: textFrom(section.sectionKey, `section_${sectionIndex + 1}`),
        label: textFrom(section.label, `分组 ${sectionIndex + 1}`),
        description: textFrom(section.description),
        fields: fields.length > 0 ? fields : [createField(1)],
      };
    })
    : [];

  return sections.length > 0 ? { sections } : cloneSchema(defaultSchema);
}

function schemaFromDefinition(definition: FormDefinitionDTO | null): FormDefinitionSchema {
  return normalizeSchema(definition?.schema ?? defaultSchema);
}

function countSections(schema: FormDefinitionSchema | null | undefined) {
  return Array.isArray(schema?.sections) ? schema.sections.length : 0;
}

function countFields(schema: FormDefinitionSchema | null | undefined) {
  return Array.isArray(schema?.sections)
    ? schema.sections.reduce((total, section) => total + (Array.isArray(section.fields) ? section.fields.length : 0), 0)
    : 0;
}

function firstSelection(schema: FormDefinitionSchema) {
  const section = schema.sections[0];
  const field = section?.fields[0];
  return {
    sectionKey: section?.sectionKey ?? '',
    fieldKey: field?.fieldKey ?? '',
  };
}

function optionsToText(field: FormDefinitionField | null | undefined) {
  return field?.options?.map((option) => `${option.value}:${option.label}`).join('\n') ?? '';
}

function parseOptionsText(value: string): FormDefinitionFieldOption[] | undefined {
  const options = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, ...labelParts] = line.split(':');
      const optionValue = rawValue.trim();
      const label = labelParts.join(':').trim() || optionValue;
      return { value: optionValue, label };
    });
  return options.length > 0 ? options : undefined;
}

function previewValue(field: FormDefinitionField) {
  if (field.sensitive || field.masked) return '******';
  if (field.defaultValue != null && field.defaultValue !== '') return unknownToText(field.defaultValue);
  return field.placeholder || '待填写';
}

function FieldPreview({ field, compact = false }: { field: FormDefinitionField; compact?: boolean }) {
  const value = previewValue(field);
  return (
    <div className={compact ? 'rounded-xl border border-slate-200 bg-white px-3 py-2' : 'rounded-2xl border border-slate-200 bg-white p-4'}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{field.label}</span>
        <span className="text-xs text-slate-500">{field.required ? '必填' : '选填'}</span>
      </div>
      <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        {field.type === 'select' || field.type === 'radio'
          ? field.options?.[0]?.label ?? value
          : field.type === 'checkbox'
            ? '□ ' + value
            : field.type === 'upload'
              ? '上传附件占位'
              : value}
      </div>
      {field.helpText ? <p className="mt-2 text-xs text-slate-500">{field.helpText}</p> : null}
    </div>
  );
}

export default function SystemFormConfigWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemFormConfigWorkbenchPageProps) {
  const [definitions, setDefinitions] = useState<FormDefinitionDTO[]>([]);
  const [selectedFormKey, setSelectedFormKey] = useState(defaultFormKey);
  const [selectedDefinition, setSelectedDefinition] = useState<FormDefinitionDTO | null>(null);
  const [draftName, setDraftName] = useState('资产流程表单');
  const [draftDescription, setDraftDescription] = useState('用于流程节点绑定的安全表单定义');
  const [schema, setSchema] = useState<FormDefinitionSchema>(() => cloneSchema(defaultSchema));
  const [selectedSectionKey, setSelectedSectionKey] = useState(defaultSchema.sections[0]?.sectionKey ?? '');
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultSchema.sections[0]?.fields[0]?.fieldKey ?? '');
  const [formSearch, setFormSearch] = useState('');
  const [versions, setVersions] = useState<FormDefinitionVersionDTO[]>([]);
  const [validationResult, setValidationResult] = useState<FormDefinitionValidationResult | null>(null);
  const [preview, setPreview] = useState<FormDefinitionPreviewDTO | null>(null);
  const [references, setReferences] = useState<FormDefinitionReferencesDTO | null>(null);
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedVersion = useMemo(() => versions[0], [versions]);

  const filteredDefinitions = useMemo(() => {
    const keyword = formSearch.trim().toLowerCase();
    if (!keyword) return definitions;
    return definitions.filter((definition) =>
      `${definition.formKey} ${definition.name} ${definition.description ?? ''}`.toLowerCase().includes(keyword),
    );
  }, [definitions, formSearch]);

  const selectedSection = useMemo(
    () => schema.sections.find((section) => section.sectionKey === selectedSectionKey) ?? schema.sections[0] ?? null,
    [schema, selectedSectionKey],
  );
  const selectedField = useMemo(
    () => selectedSection?.fields.find((field) => field.fieldKey === selectedFieldKey) ?? selectedSection?.fields[0] ?? null,
    [selectedFieldKey, selectedSection],
  );

  useEffect(() => {
    if (!selectedSection || !selectedField) {
      const nextSelection = firstSelection(schema);
      setSelectedSectionKey(nextSelection.sectionKey);
      setSelectedFieldKey(nextSelection.fieldKey);
      return;
    }
    if (selectedSection.sectionKey !== selectedSectionKey) setSelectedSectionKey(selectedSection.sectionKey);
    if (selectedField.fieldKey !== selectedFieldKey) setSelectedFieldKey(selectedField.fieldKey);
  }, [schema, selectedField, selectedFieldKey, selectedSection, selectedSectionKey]);

  const applySchema = (nextSchema: FormDefinitionSchema) => {
    setSchema(cloneSchema(nextSchema));
    const nextSelection = firstSelection(nextSchema);
    setSelectedSectionKey(nextSelection.sectionKey);
    setSelectedFieldKey(nextSelection.fieldKey);
  };

  const loadFormDefinition = async (formKey = selectedFormKey) => {
    setLoading(true);
    setError(null);
    try {
      const nextDefinitions = await formDefinitionsApi.listDefinitions();
      const nextKey = nextDefinitions.find((definition: FormDefinitionDTO) => definition.formKey === formKey)?.formKey ?? nextDefinitions[0]?.formKey ?? formKey;
      setDefinitions(nextDefinitions);
      setSelectedFormKey(nextKey);

      if (nextDefinitions.length === 0) {
        setSelectedDefinition(null);
        setVersions([]);
        setPreview(null);
        setReferences(null);
        applySchema(defaultSchema);
        setMessage('暂无表单定义，可保存草稿创建 system-form-config 最小闭环。');
        return;
      }

      const [detail, nextVersions, nextPreview, nextReferences] = await Promise.all([
        formDefinitionsApi.getDefinition(nextKey),
        formDefinitionsApi.listVersions(nextKey),
        formDefinitionsApi.preview(nextKey),
        formDefinitionsApi.references(nextKey),
      ]);
      const nextSchema = schemaFromDefinition(detail);
      setSelectedDefinition(detail);
      setDraftName(detail.name ?? nextKey);
      setDraftDescription(detail.description ?? '');
      applySchema(nextSchema);
      setVersions(nextVersions);
      setPreview(nextPreview);
      setReferences(nextReferences);
      setValidationResult(null);
      setMessage(null);
    } catch {
      setDefinitions([]);
      setVersions([]);
      setPreview(null);
      setReferences(null);
      setSelectedDefinition(null);
      setError('表单配置加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadFormDefinition(defaultFormKey);
  }, [canView]);

  const draftPayload = () => ({
    name: draftName,
    description: draftDescription,
    schema: cloneSchema(schema),
  });

  const runValidation = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await formDefinitionsApi.validateSchema(selectedFormKey, draftPayload());
      const sanitizedSchema = normalizeSchema(result.sanitizedSchema);
      setValidationResult(result);
      setSchema(sanitizedSchema);
      setPreview((current) => current ? { ...current, schema: sanitizedSchema, fieldCount: result.fieldCount, sensitiveFieldCount: result.sensitiveFieldCount, warnings: result.warnings } : current);
      setMessage(result.valid ? 'schema 校验通过，危险 HTML/source/script/on* 字段已过滤。' : 'schema 校验未通过，请修复 fieldKey、label、type 或重复字段。');
    } catch {
      setError('schema 校验失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await formDefinitionsApi.saveDraft(selectedFormKey, draftPayload());
      setSelectedDefinition(saved);
      setSchema(schemaFromDefinition(saved));
      setMessage('保存草稿已通过 /form-definitions/{formKey}/draft 落库并执行 schema 安全过滤。');
    } catch {
      setError('草稿保存失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      const published = await formDefinitionsApi.publish(selectedFormKey, {
        confirmed: true,
        reason: '表单配置发布复核通过',
        publishNote: '表单配置发布复核通过',
        impactScope: '仅影响后续流程节点表单绑定',
        rollbackPlan: '通过版本历史恢复上一稳定版本',
      });
      const [nextVersions, nextPreview] = await Promise.all([
        formDefinitionsApi.listVersions(selectedFormKey),
        formDefinitionsApi.preview(selectedFormKey),
      ]);
      setSelectedDefinition(published);
      setSchema(schemaFromDefinition(published));
      setVersions(nextVersions);
      setPreview(nextPreview);
      setMessage('发布表单完成：后端已校验 confirmed=true、operatorId、reason、impactScope 与 rollbackPlan。');
    } catch {
      setError('发布失败，请确认权限、状态机与高危操作审计字段。');
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    setSaving(true);
    setError(null);
    try {
      const disabled = await formDefinitionsApi.disable(selectedFormKey, {
        confirmed: true,
        reason: '停用存在风险的表单版本',
        impactScope: '停止后续流程节点绑定该表单',
        rollbackPlan: '恢复上一发布版本或重新发布草稿',
      });
      const nextVersions = await formDefinitionsApi.listVersions(selectedFormKey);
      setSelectedDefinition(disabled);
      setSchema(schemaFromDefinition(disabled));
      setVersions(nextVersions);
      setMessage('停用表单完成：已追加 DISABLE 版本快照。');
    } catch {
      setError('停用失败，请确认表单处于已发布状态且审计字段完整。');
    } finally {
      setSaving(false);
    }
  };

  const rollbackLatest = async () => {
    if (!selectedVersion) return;
    setSaving(true);
    setError(null);
    try {
      const rolledBack = await formDefinitionsApi.rollback(selectedFormKey, selectedVersion.version, {
        confirmed: true,
        reason: `恢复到 v${selectedVersion.version} 稳定表单`,
        impactScope: '仅影响后续流程节点表单绑定',
        rollbackPlan: '必要时重新恢复到当前版本快照',
      });
      const nextVersions = await formDefinitionsApi.listVersions(selectedFormKey);
      setSelectedDefinition(rolledBack);
      setSchema(schemaFromDefinition(rolledBack));
      setVersions(nextVersions);
      setMessage(`已通过 /versions/${selectedVersion.version}/rollback 恢复表单版本并追加审计证据。`);
    } catch {
      setError('版本恢复失败，请确认 rollback 权限与审计原因。');
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadFormDefinition(selectedFormKey);
  };

  const createNewDraft = () => {
    const nextKey = `FORM_${Date.now()}`;
    setSelectedFormKey(nextKey);
    setDraftName('新建流程表单');
    setDraftDescription('用于流程节点绑定的可视化表单草稿');
    setSelectedDefinition(null);
    setVersions([]);
    setPreview(null);
    setReferences(null);
    setValidationResult(null);
    applySchema(defaultSchema);
    setMessage('已新建本地表单草稿，可通过保存草稿写入 /form-definitions/{formKey}/draft。');
  };

  const addSection = () => {
    const nextField = createField(1);
    const nextSection: FormDefinitionSection = {
      sectionKey: `section_${Date.now()}`,
      label: `新分组 ${schema.sections.length + 1}`,
      description: '桌面与 H5 双端展示分组',
      fields: [nextField],
    };
    setSchema((current) => ({ sections: [...current.sections, nextSection] }));
    setSelectedSectionKey(nextSection.sectionKey);
    setSelectedFieldKey(nextField.fieldKey);
    setValidationResult(null);
    setMessage('已新增字段分组，可在右侧配置字段属性。');
  };

  const addField = () => {
    const targetSectionKey = selectedSection?.sectionKey ?? schema.sections[0]?.sectionKey;
    if (!targetSectionKey) return;
    const nextField = createField((selectedSection?.fields.length ?? 0) + 1);
    setSchema((current) => ({
      sections: current.sections.map((section) => section.sectionKey === targetSectionKey
        ? { ...section, fields: [...section.fields, nextField] }
        : section),
    }));
    setSelectedSectionKey(targetSectionKey);
    setSelectedFieldKey(nextField.fieldKey);
    setValidationResult(null);
    setMessage('已新增字段，桌面预览与钉钉 H5 预览已同步。');
  };

  const updateSelectedSection = (patch: Partial<FormDefinitionSection>) => {
    if (!selectedSection) return;
    setSchema((current) => ({
      sections: current.sections.map((section) => section.sectionKey === selectedSection.sectionKey ? { ...section, ...patch } : section),
    }));
    if (patch.sectionKey) setSelectedSectionKey(patch.sectionKey);
    setValidationResult(null);
  };

  const updateSelectedField = (patch: Partial<FormDefinitionField>) => {
    if (!selectedSection || !selectedField) return;
    setSchema((current) => ({
      sections: current.sections.map((section) => section.sectionKey === selectedSection.sectionKey
        ? {
          ...section,
          fields: section.fields.map((field) => field.fieldKey === selectedField.fieldKey ? { ...field, ...patch } : field),
        }
        : section),
    }));
    if (patch.fieldKey) setSelectedFieldKey(patch.fieldKey);
    setValidationResult(null);
  };

  const removeSelectedField = () => {
    if (!selectedSection || !selectedField) return;
    const nextSchema = {
      sections: schema.sections.map((section) => section.sectionKey === selectedSection.sectionKey
        ? { ...section, fields: section.fields.filter((field) => field.fieldKey !== selectedField.fieldKey) }
        : section),
    };
    setSchema(nextSchema);
    const nextSelection = firstSelection(nextSchema);
    setSelectedSectionKey(nextSelection.sectionKey);
    setSelectedFieldKey(nextSelection.fieldKey);
    setValidationResult(null);
    setMessage('已从当前草稿移除字段，保存草稿前不会影响已发布版本。');
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问表单配置，请确认 workflow:form:list、workflow:form:view、workflow:form:update、workflow:form:publish、workflow:form:disable 与 workflow:form:rollback 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">表单配置</h3>
          <p className="mt-1 text-sm text-slate-500">
            真实调用 /form-definitions、/schema/validate、/publish、/disable、/versions/{'{version}'}/rollback、/preview 与 /references。
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading || saving}
          type="button"
          onClick={() => void loadFormDefinition(selectedFormKey)}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        权限 fail-closed；schema 只保留 sections/fields 白名单结构，剥离 HTML/source/script/on*、javascript URL 和危险 style；敏感字段默认值仅展示遮罩预览。
      </div>

      <form className="grid gap-3 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto]" onSubmit={handleSelect}>
        <label className="space-y-1 text-sm text-slate-600" htmlFor="form-config-search">
          <span className="font-medium">表单对象搜索</span>
          <input
            id="form-config-search"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
            placeholder="搜索表单模板或 key"
            value={formSearch}
            onChange={(event) => setFormSearch(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-slate-600" htmlFor="form-config-form-key">
          <span className="font-medium">当前表单</span>
          <select
            id="form-config-form-key"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
            value={selectedFormKey}
            onChange={(event) => setSelectedFormKey(event.target.value)}
          >
            {(filteredDefinitions.length > 0 ? filteredDefinitions : [{ formKey: selectedFormKey, name: draftName }]).map((definition) => (
              <option key={definition.formKey} value={definition.formKey}>{definition.name} · {definition.formKey}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={loading || saving} type="submit">
            载入表单
          </button>
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={saving} type="button" onClick={createNewDraft}>
            新建表单
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium">草稿名称</span>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium">草稿说明</span>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
        </label>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">表单字段布局工作台</h4>
            <p className="mt-1 text-sm text-slate-500">表单对象、字段列表、桌面预览、钉钉 H5 预览和字段属性同屏联动。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-blue-700">
            <span className="rounded-full bg-blue-50 px-3 py-1">字段表</span>
            <span className="rounded-full bg-blue-50 px-3 py-1">桌面/H5 双端布局</span>
            <span className="rounded-full bg-blue-50 px-3 py-1">字段属性</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h5 className="font-semibold text-slate-800">字段表</h5>
              <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white" type="button" onClick={addSection}>新增分组</button>
            </div>
            <div className="space-y-3">
              {schema.sections.map((section) => (
                <div key={section.sectionKey} className="rounded-2xl bg-white p-3 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => {
                      setSelectedSectionKey(section.sectionKey);
                      setSelectedFieldKey(section.fields[0]?.fieldKey ?? '');
                    }}
                  >
                    <span className="text-sm font-medium text-slate-800">{section.label}</span>
                    <span className="text-xs text-slate-500">{section.fields.length} 字段</span>
                  </button>
                  <div className="mt-2 space-y-2">
                    {section.fields.map((field) => {
                      const active = section.sectionKey === selectedSection?.sectionKey && field.fieldKey === selectedField?.fieldKey;
                      return (
                        <button
                          key={field.fieldKey}
                          type="button"
                          className={active
                            ? 'w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-800'
                            : 'w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 hover:border-blue-200'}
                          onClick={() => {
                            setSelectedSectionKey(section.sectionKey);
                            setSelectedFieldKey(field.fieldKey);
                          }}
                        >
                          <span className="block font-medium">{field.label}</span>
                          <span className="text-xs text-slate-500">{field.fieldKey} · {field.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full rounded-xl border border-dashed border-blue-200 px-4 py-2 text-sm text-blue-700" type="button" onClick={addField}>
              新增字段
            </button>
          </aside>

          <main className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h5 className="font-semibold text-slate-800">桌面预览</h5>
                <h3 className="text-xs font-medium text-slate-500">双列布局模拟 PC 工作台表单。</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{countSections(schema)} 分组 / {countFields(schema)} 字段</span>
            </div>
            <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
              {schema.sections.map((section) => (
                <section key={section.sectionKey} className="space-y-3">
                  <div>
                    <h6 className="font-medium text-slate-800">{section.label}</h6>
                    {section.description ? <p className="text-xs text-slate-500">{section.description}</p> : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {section.fields.map((field) => <FieldPreview key={field.fieldKey} field={field} />)}
                  </div>
                </section>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h5 className="font-semibold">钉钉 H5 预览</h5>
                  <h3 className="text-xs font-medium text-slate-500">单列移动端布局，敏感字段默认遮罩。</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">H5</span>
              </div>
              <div className="mx-auto max-w-[320px] rounded-[28px] border border-white/10 bg-slate-100 p-3 text-slate-900">
                <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold">{draftName}</div>
                <div className="space-y-3">
                  {schema.sections.flatMap((section) => section.fields).slice(0, 6).map((field) => <FieldPreview key={field.fieldKey} field={field} compact />)}
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h5 className="font-semibold text-slate-800">字段属性</h5>
              <p className="mt-1 text-xs text-slate-500">修改字段后会同步桌面预览与钉钉 H5 预览，保存草稿前不影响已发布版本。</p>
            </div>
            {selectedSection ? (
              <div className="space-y-2 rounded-2xl bg-white p-3">
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">分组名称</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedSection.label} onChange={(event) => updateSelectedSection({ label: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">分组说明</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedSection.description ?? ''} onChange={(event) => updateSelectedSection({ description: event.target.value })} />
                </label>
              </div>
            ) : null}
            {selectedField ? (
              <div className="space-y-3 rounded-2xl bg-white p-3">
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">字段 Key</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedField.fieldKey} onChange={(event) => updateSelectedField({ fieldKey: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">字段名称</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedField.label} onChange={(event) => updateSelectedField({ label: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">字段类型</span>
                  <select className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedField.type} onChange={(event) => updateSelectedField({ type: event.target.value })}>
                    {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><input type="checkbox" checked={Boolean(selectedField.required)} onChange={(event) => updateSelectedField({ required: event.target.checked })} />必填</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><input type="checkbox" checked={Boolean(selectedField.sensitive)} onChange={(event) => updateSelectedField({ sensitive: event.target.checked })} />敏感</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><input type="checkbox" checked={Boolean(selectedField.masked)} onChange={(event) => updateSelectedField({ masked: event.target.checked })} />遮罩</label>
                </div>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">占位提示</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedField.placeholder ?? ''} onChange={(event) => updateSelectedField({ placeholder: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">默认值 / 遮罩预览</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={unknownToText(selectedField.defaultValue)} onChange={(event) => updateSelectedField({ defaultValue: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">帮助说明</span>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={selectedField.helpText ?? ''} onChange={(event) => updateSelectedField({ helpText: event.target.value })} />
                </label>
                <label className="block space-y-1 text-sm text-slate-600">
                  <span className="font-medium">选项配置</span>
                  <textarea
                    className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                    placeholder="value:label，每行一个"
                    value={optionsToText(selectedField)}
                    onChange={(event) => updateSelectedField({ options: parseOptionsText(event.target.value) })}
                  />
                </label>
                <button className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700" type="button" onClick={removeSelectedField}>
                  从草稿移除字段
                </button>
              </div>
            ) : <h3 className="rounded-2xl bg-white p-3 text-sm font-medium text-slate-500">暂无可配置字段，请先新增字段。</h3>}
          </aside>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={saving} type="button" onClick={saveDraft}>
          保存草稿
        </button>
        <button className="rounded-xl border border-blue-200 px-4 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={saving} type="button" onClick={runValidation}>
          schema 校验
        </button>
        <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={saving} type="button" onClick={publish}>
          发布表单
        </button>
        <button className="rounded-xl bg-slate-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={saving} type="button" onClick={disable}>
          停用表单
        </button>
        <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={saving || !selectedVersion} type="button" onClick={rollbackLatest}>
          恢复最近版本
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">当前定义</h4>
          <dl className="space-y-2 text-sm text-slate-600">
            <div><dt className="text-xs text-slate-500">状态 / 版本</dt><dd>{selectedDefinition?.status ?? 'UNCONFIGURED'} / v{selectedDefinition?.version ?? 0}</dd></div>
            <div><dt className="text-xs text-slate-500">章节 / 字段</dt><dd>{countSections(schema)} / {countFields(schema)}</dd></div>
            <div><dt className="text-xs text-slate-500">最后更新时间</dt><dd>{selectedDefinition?.updateTime ?? '-'}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">schema 校验与遮罩预览</h4>
          {validationResult ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p className={validationResult.valid ? 'text-green-700' : 'text-red-700'}>{validationResult.valid ? '校验通过' : '校验失败'}</p>
              <p>字段 {validationResult.fieldCount} 个，敏感字段 {validationResult.sensitiveFieldCount} 个</p>
              {validationResult.errors.map((item) => <p key={item} className="text-red-700">{item}</p>)}
              {validationResult.warnings.map((item) => <p key={item} className="text-amber-700">{item}</p>)}
            </div>
          ) : <p className="text-sm text-slate-500">尚未执行 schema 校验。</p>}
          {preview ? <p className="mt-3 text-sm text-slate-600">预览字段 {preview.fieldCount} 个，敏感字段 {preview.sensitiveFieldCount} 个，默认值以 ****** 遮罩。</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">版本历史</h4>
          {versions.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无发布/停用/回滚审计版本。</h3> : null}
          <div className="space-y-2 text-sm text-slate-600">
            {versions.slice(0, 5).map((version) => (
              <div key={version.id ?? `${version.version}-${version.actionType}`} className="rounded-xl bg-slate-50 px-3 py-2">
                v{version.version} · {version.actionType} · {version.auditReason ?? '-'}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">引用分析</h4>
          <p className="text-sm text-slate-600">引用数量：{references?.referenceCount ?? 0}</p>
          <p className="mt-2 text-xs text-slate-500">{references?.note ?? '真实调用 /references，当前最小闭环允许空引用摘要。'}</p>
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">表单配置加载中...</div> : null}
    </section>
  );
}
