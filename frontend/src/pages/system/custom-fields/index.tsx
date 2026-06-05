import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Search, Settings,
  Type, Hash, Calendar, List, ToggleLeft, Link, Mail, Regex, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectItem } from '@/components/ui/Select';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface CustomFieldItem {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions?: string | null;
  validationPattern?: string | null;
  fieldOrder: number;
  required: number;
  encrypted: number;
  status: number;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const FIELD_TYPES = [
  { value: 'TEXT', label: '文本' },
  { value: 'NUMBER', label: '数字' },
  { value: 'DATE', label: '日期' },
  { value: 'DROPDOWN', label: '下拉选择' },
  { value: 'BOOLEAN', label: '布尔' },
  { value: 'URL', label: '网址' },
  { value: 'EMAIL', label: '邮箱' },
  { value: 'REGEX', label: '正则' },
];

const TYPE_ICON: Record<string, typeof Type> = {
  TEXT: Type, NUMBER: Hash, DATE: Calendar, DROPDOWN: List,
  BOOLEAN: ToggleLeft, URL: Link, EMAIL: Mail, REGEX: Regex,
};

const TYPE_BADGE: Record<string, string> = {
  TEXT: 'bg-slate-100 text-slate-700',
  NUMBER: 'bg-blue-100 text-blue-700',
  DATE: 'bg-green-100 text-green-700',
  DROPDOWN: 'bg-purple-100 text-purple-700',
  BOOLEAN: 'bg-amber-100 text-amber-700',
  URL: 'bg-cyan-100 text-cyan-700',
  EMAIL: 'bg-pink-100 text-pink-700',
  REGEX: 'bg-rose-100 text-rose-700',
};

const STAT_BG: Record<string, string> = {
  TEXT: 'bg-slate-50 text-slate-500', NUMBER: 'bg-blue-50 text-blue-500',
  DATE: 'bg-emerald-50 text-emerald-500', DROPDOWN: 'bg-purple-50 text-purple-500',
  BOOLEAN: 'bg-amber-50 text-amber-500', URL: 'bg-cyan-50 text-cyan-500',
  EMAIL: 'bg-pink-50 text-pink-500', REGEX: 'bg-rose-50 text-rose-500',
};

/* ── Mock Data ─────────────────────────────────────────────────────────── */

let _nextId = 14;

const INITIAL_FIELDS: CustomFieldItem[] = [
  { id: 1, fieldName: 'purchase_channel', fieldLabel: '采购渠道', fieldType: 'DROPDOWN', fieldOptions: '["京东","天猫","线下","直采"]', validationPattern: null, fieldOrder: 1, required: 1, encrypted: 0, status: 1 },
  { id: 2, fieldName: 'warranty_expiry', fieldLabel: '保修到期', fieldType: 'DATE', fieldOptions: null, validationPattern: null, fieldOrder: 2, required: 0, encrypted: 0, status: 1 },
  { id: 3, fieldName: 'asset_weight', fieldLabel: '资产重量(kg)', fieldType: 'NUMBER', fieldOptions: null, validationPattern: null, fieldOrder: 3, required: 0, encrypted: 0, status: 1 },
  { id: 4, fieldName: 'vendor_website', fieldLabel: '供应商网址', fieldType: 'URL', fieldOptions: null, validationPattern: null, fieldOrder: 4, required: 0, encrypted: 0, status: 1 },
  { id: 5, fieldName: 'contact_email', fieldLabel: '联系邮箱', fieldType: 'EMAIL', fieldOptions: null, validationPattern: null, fieldOrder: 5, required: 1, encrypted: 0, status: 1 },
  { id: 6, fieldName: 'is_imported', fieldLabel: '是否进口', fieldType: 'BOOLEAN', fieldOptions: null, validationPattern: null, fieldOrder: 6, required: 0, encrypted: 0, status: 1 },
  { id: 7, fieldName: 'serial_code', fieldLabel: '序列号', fieldType: 'REGEX', fieldOptions: null, validationPattern: '^[A-Z]{2}\\d{6,12}$', fieldOrder: 7, required: 1, encrypted: 0, status: 1 },
  { id: 8, fieldName: 'storage_location', fieldLabel: '存放位置', fieldType: 'TEXT', fieldOptions: null, validationPattern: null, fieldOrder: 8, required: 0, encrypted: 0, status: 1 },
  { id: 9, fieldName: 'depreciation_method', fieldLabel: '折旧方式', fieldType: 'DROPDOWN', fieldOptions: '["直线法","双倍余额递减","年数总和"]', validationPattern: null, fieldOrder: 9, required: 0, encrypted: 0, status: 1 },
  { id: 10, fieldName: 'maintenance_cycle', fieldLabel: '保养周期(天)', fieldType: 'NUMBER', fieldOptions: null, validationPattern: null, fieldOrder: 10, required: 0, encrypted: 0, status: 1 },
  { id: 11, fieldName: 'last_inspection', fieldLabel: '上次检验日期', fieldType: 'DATE', fieldOptions: null, validationPattern: null, fieldOrder: 11, required: 0, encrypted: 0, status: 0 },
  { id: 12, fieldName: 'risk_level', fieldLabel: '风险等级', fieldType: 'DROPDOWN', fieldOptions: '["低","中","高","极高"]', validationPattern: null, fieldOrder: 12, required: 1, encrypted: 0, status: 1 },
  { id: 13, fieldName: 'remarks', fieldLabel: '备注', fieldType: 'TEXT', fieldOptions: null, validationPattern: null, fieldOrder: 99, required: 0, encrypted: 0, status: 1 },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function parseOptions(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const EMPTY_FORM = {
  fieldName: '', fieldLabel: '', fieldType: 'TEXT', fieldOptions: '',
  validationPattern: '', fieldOrder: 0, required: 0, encrypted: 0, status: 1,
};

/* ── Page Component ────────────────────────────────────────────────────── */

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomFieldItem[]>(INITIAL_FIELDS);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [preview, setPreview] = useState<CustomFieldItem | null>(null);

  /* filtered data */
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return fields.filter((f) => {
      if (typeFilter !== 'ALL' && f.fieldType !== typeFilter) return false;
      if (kw && !f.fieldName.toLowerCase().includes(kw) && !f.fieldLabel.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [fields, keyword, typeFilter]);

  /* stat counts */
  const statCounts = useMemo(() => {
    const map: Record<string, number> = {};
    fields.forEach((f) => { map[f.fieldType] = (map[f.fieldType] ?? 0) + 1; });
    return map;
  }, [fields]);

  /* CRUD */
  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(row: CustomFieldItem) {
    setEditing(row);
    setForm({
      fieldName: row.fieldName, fieldLabel: row.fieldLabel, fieldType: row.fieldType,
      fieldOptions: row.fieldOptions ?? '', validationPattern: row.validationPattern ?? '',
      fieldOrder: row.fieldOrder, required: row.required, encrypted: row.encrypted, status: row.status,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.fieldName.trim() || !form.fieldLabel.trim()) { toast.error('字段名和显示名不能为空'); return; }
    if (form.fieldType === 'DROPDOWN' && !form.fieldOptions.trim()) { toast.error('下拉类型需要填写选项（JSON 数组）'); return; }
    if (editing) {
      setFields((prev) => prev.map((f) => f.id === editing.id ? { ...f, ...form } : f));
      toast.success('字段更新成功');
    } else {
      const newField: CustomFieldItem = { ...form, id: _nextId++ };
      setFields((prev) => [...prev, newField]);
      toast.success('字段创建成功');
    }
    setDialogOpen(false);
    setEditing(null);
  }

  function handleDelete(id: number) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    toast.success('字段已删除');
  }

  /* columns */
  const columns: Column<CustomFieldItem>[] = [
    { key: 'id', title: 'ID', width: 60 },
    {
      key: 'fieldName', title: '字段名',
      render: (_: unknown, r: CustomFieldItem) => (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">{r.fieldName}</code>
      ),
    },
    { key: 'fieldLabel', title: '显示名' },
    {
      key: 'fieldType', title: '类型', width: 110,
      render: (_: unknown, r: CustomFieldItem) => {
        const Icon = TYPE_ICON[r.fieldType] ?? Type;
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[r.fieldType] ?? ''}`}>
            <Icon className="h-3 w-3" />{FIELD_TYPES.find((t) => t.value === r.fieldType)?.label ?? r.fieldType}
          </span>
        );
      },
    },
    {
      key: 'fieldOptions', title: '选项', width: 90,
      render: (_: unknown, r: CustomFieldItem) => {
        const opts = parseOptions(r.fieldOptions);
        return opts.length > 0 ? <Badge variant="purple">{opts.length} 项</Badge> : <span className="text-slate-400">-</span>;
      },
    },
    {
      key: 'required', title: '必填', width: 70, align: 'center',
      render: (_: unknown, r: CustomFieldItem) => r.required === 1
        ? <Badge variant="warning">必填</Badge>
        : <span className="text-slate-400">否</span>,
    },
    { key: 'fieldOrder', title: '排序', width: 70, align: 'center' },
    {
      key: 'status', title: '状态', width: 80,
      render: (_: unknown, r: CustomFieldItem) => (
        <Badge variant={r.status === 1 ? 'success' : 'gray'}>{r.status === 1 ? '启用' : '停用'}</Badge>
      ),
    },
    {
      key: 'actions', title: '操作', width: 120,
      render: (_: unknown, r: CustomFieldItem) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setPreview(r)} title="预览"><Eye className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="编辑"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} title="删除"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  /* stat cards data */
  const statItems = FIELD_TYPES.filter((t) => (statCounts[t.value] ?? 0) > 0);

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#1d4ed8]" />
              <h1 className="text-xl font-bold text-[#0f172a]">自定义字段管理</h1>
            </div>
            <p className="mt-1 text-sm text-[#64748b]">管理系统扩展字段定义，支持多种数据类型与校验规则</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />新增字段</Button>
        </div>

        {/* Stat overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {statItems.map((t) => {
            const Icon = TYPE_ICON[t.value] ?? Type;
            return (
              <button
                key={t.value}
                onClick={() => setTypeFilter((prev) => prev === t.value ? 'ALL' : t.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  typeFilter === t.value
                    ? 'border-[#1d4ed8] bg-blue-50 ring-1 ring-blue-200'
                    : 'border-[#e5e7eb] bg-white hover:border-[#cbd5e1]'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${STAT_BG[t.value] ?? ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs text-[#64748b]">{t.label}</p>
                  <p className="text-sm font-semibold text-[#0f172a]">{statCounts[t.value] ?? 0}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <Card className="!p-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-4 w-4 text-[#94a3b8]" />
            <Input
              placeholder="搜索字段名或显示名..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="max-w-xs"
            />
            {typeFilter !== 'ALL' && (
              <button
                onClick={() => setTypeFilter('ALL')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
              >
                {FIELD_TYPES.find((t) => t.value === typeFilter)?.label}
                <span className="ml-0.5 text-blue-400">&times;</span>
              </button>
            )}
            <span className="ml-auto text-xs text-[#94a3b8]">共 {filtered.length} 条</span>
          </div>
        </Card>

        {/* Table */}
        <Card className="!p-0 overflow-hidden">
          <DataTable<CustomFieldItem>
            columns={columns}
            data={filtered}
            emptyText="没有找到匹配的字段"
          />
        </Card>

        {/* ── Form Dialog ──────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑字段' : '新增字段'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-6 py-4">
              {/* Basic info */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">基本信息</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#374151]">字段名 <span className="text-red-400">*</span></label>
                    <Input value={form.fieldName} onChange={(e) => setForm({ ...form, fieldName: e.target.value })} placeholder="英文标识，如 purchase_channel" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#374151]">显示名 <span className="text-red-400">*</span></label>
                    <Input value={form.fieldLabel} onChange={(e) => setForm({ ...form, fieldLabel: e.target.value })} placeholder="中文显示名" />
                  </div>
                </div>
              </fieldset>

              {/* Type & validation */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">类型与校验</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.fieldType} onValueChange={(v) => setForm({ ...form, fieldType: v })} label="字段类型">
                    {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </Select>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#374151]">排序号</label>
                    <Input type="number" value={form.fieldOrder} onChange={(e) => setForm({ ...form, fieldOrder: Number(e.target.value) })} />
                  </div>
                </div>
                {form.fieldType === 'DROPDOWN' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#374151]">选项 (JSON 数组)</label>
                    <Input value={form.fieldOptions} onChange={(e) => setForm({ ...form, fieldOptions: e.target.value })} placeholder='["选项1","选项2"]' />
                    {form.fieldOptions && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {parseOptions(form.fieldOptions).map((o, i) => (
                          <span key={i} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-600">{o}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {form.fieldType === 'REGEX' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#374151]">正则表达式</label>
                    <Input value={form.validationPattern} onChange={(e) => setForm({ ...form, validationPattern: e.target.value })} placeholder="^[A-Z].*" className="font-mono text-xs" />
                  </div>
                )}
              </fieldset>

              {/* Flags */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">属性</legend>
                <div className="grid grid-cols-3 gap-3">
                  <Select value={String(form.required)} onValueChange={(v) => setForm({ ...form, required: Number(v) })} label="必填">
                    <SelectItem value="0">否</SelectItem><SelectItem value="1">是</SelectItem>
                  </Select>
                  <Select value={String(form.encrypted)} onValueChange={(v) => setForm({ ...form, encrypted: Number(v) })} label="加密">
                    <SelectItem value="0">否</SelectItem><SelectItem value="1">是</SelectItem>
                  </Select>
                  <Select value={String(form.status)} onValueChange={(v) => setForm({ ...form, status: Number(v) })} label="状态">
                    <SelectItem value="1">启用</SelectItem><SelectItem value="0">停用</SelectItem>
                  </Select>
                </div>
              </fieldset>

              <div className="flex justify-end gap-2 border-t border-[#e5e7eb] pt-4">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>取消</Button>
                <Button onClick={handleSave}>{editing ? '保存修改' : '创建字段'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Preview Dialog ───────────────────────────────────────── */}
        <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>字段预览 - {preview?.fieldLabel}</DialogTitle>
            </DialogHeader>
            {preview && (
              <div className="space-y-4 px-6 py-4">
                <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-4">
                  <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                    {preview.fieldLabel}
                    {preview.required === 1 && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {preview.fieldType === 'TEXT' && <Input placeholder={`请输入${preview.fieldLabel}`} />}
                  {preview.fieldType === 'NUMBER' && <Input type="number" placeholder={`请输入${preview.fieldLabel}`} />}
                  {preview.fieldType === 'DATE' && <Input type="date" />}
                  {preview.fieldType === 'DROPDOWN' && (
                    <select className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm">
                      <option value="">请选择{preview.fieldLabel}</option>
                      {parseOptions(preview.fieldOptions).map((o, i) => <option key={i} value={o}>{o}</option>)}
                    </select>
                  )}
                  {preview.fieldType === 'BOOLEAN' && (
                    <div className="flex items-center gap-3">
                      <span className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-slate-200 px-0.5"><span className="inline-block h-4 w-4 rounded-full bg-white shadow" /></span>
                      <span className="text-sm text-slate-500">开关切换</span>
                    </div>
                  )}
                  {preview.fieldType === 'URL' && <Input placeholder="https://example.com" />}
                  {preview.fieldType === 'EMAIL' && <Input type="email" placeholder="user@example.com" />}
                  {preview.fieldType === 'REGEX' && (
                    <div>
                      <Input placeholder={`匹配规则: ${preview.validationPattern ?? ''}`} className="font-mono text-xs" />
                      {preview.validationPattern && <p className="mt-1 text-xs text-slate-400">正则: {preview.validationPattern}</p>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#64748b]">
                  <div>字段名: <code className="text-slate-600">{preview.fieldName}</code></div>
                  <div>类型: {preview.fieldType}</div>
                  <div>排序: {preview.fieldOrder}</div>
                  <div>状态: {preview.status === 1 ? '启用' : '停用'}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
