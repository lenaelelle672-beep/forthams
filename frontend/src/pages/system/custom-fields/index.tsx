import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Settings,
  Type, Hash, Calendar, List, ToggleLeft, Link, Mail, Regex, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getCustomFieldList,
  type CustomFieldItem,
} from '@/api/customField';

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

/* ── Helpers ───────────────────────────────────────────────────────────── */

function parseOptions(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/* ── Page Component ────────────────────────────────────────────────────── */

export default function CustomFieldsPage() {
  const pageSize = 100;
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [preview, setPreview] = useState<CustomFieldItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customFields', keyword],
    queryFn: () => getCustomFieldList(1, pageSize, keyword.trim() || undefined),
  });

  const fields = data?.records ?? [];

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
      key: 'actions', title: '操作', width: 80,
      render: (_: unknown, r: CustomFieldItem) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setPreview(r)} title="预览"><Eye className="h-3.5 w-3.5" /></Button>
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
            <p className="mt-1 text-sm text-[#64748b]">管理系统扩展字段定义（只读视图，编辑请在 V3 工作台自定义字段页操作）</p>
          </div>
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
            loading={isLoading}
            emptyText="没有找到匹配的字段"
          />
        </Card>

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
