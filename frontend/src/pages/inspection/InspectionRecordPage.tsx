import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionApi, inspectionTemplateApi } from '@/api/inspection';
import type { Inspection, InspectionTemplate } from '@/types/inspection';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { message, Form, Radio, DatePicker, Select as AntdSelect } from 'antd';
import {
  Plus, Search, RotateCcw, Edit3, Trash2, History,
  ClipboardList, CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react';
import dayjs from 'dayjs';
import TextArea from 'antd/es/input/TextArea';

/* ---------- constants ---------- */

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  ANNUAL: '年度检验',
  PERIODIC: '定期检验',
  SPECIAL: '专项检验',
};

const RESULT_BADGE: Record<
  string,
  { label: string; dot: string; border: string; bg: string; text: string }
> = {
  PASS: {
    label: '通过',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  FAIL: {
    label: '不通过',
    dot: 'bg-red-500',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  CONDITIONAL: {
    label: '附条件通过',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  PENDING: {
    label: '待检验',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  OVERDUE: {
    label: '已逾期',
    dot: 'bg-red-500',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
};

const DEFAULT_BADGE = {
  label: '',
  dot: 'bg-slate-400',
  border: 'border-slate-200',
  bg: 'bg-slate-50',
  text: 'text-slate-600',
};

/* ---------- component ---------- */

const InspectionRecordPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useState({
    keyword: '',
    inspectionType: undefined as string | undefined,
    result: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    pageNum: 1,
    pageSize: 10,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Inspection | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();

  /* ---- queries ---- */

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['inspections', params],
    queryFn: () => inspectionApi.list(params),
  });

  const { data: templates } = useQuery({
    queryKey: ['inspectionTemplates'],
    queryFn: () => inspectionTemplateApi.list({ pageNum: 1, pageSize: 100 }),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['inspectionHistory', selectedAssetId],
    queryFn: () =>
      selectedAssetId ? inspectionApi.getHistoryByAsset(selectedAssetId, 1, 20) : null,
    enabled: !!selectedAssetId,
  });

  const recordsList: Inspection[] = records?.records || records?.list || [];

  const stats = useMemo(() => {
    const s = { total: records?.total ?? 0, pass: 0, fail: 0, pending: 0, overdue: 0 };
    recordsList.forEach((r) => {
      if (r.result === 'PASS') s.pass++;
      else if (r.result === 'FAIL') s.fail++;
      else if (r.result === 'PENDING') s.pending++;
      else if (r.result === 'OVERDUE') s.overdue++;
      if (r.nextInspectionDate && dayjs(r.nextInspectionDate).diff(dayjs(), 'day') < 0) s.overdue++;
    });
    return s;
  }, [recordsList, records?.total]);

  /* ---- mutations ---- */

  const createMutation = useMutation({
    mutationFn: inspectionApi.create,
    onSuccess: () => {
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Inspection }) =>
      inspectionApi.update(id, data),
    onSuccess: () => {
      message.success('更新成功');
      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: inspectionApi.delete,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  const batchGenerateMutation = useMutation({
    mutationFn: inspectionApi.batchGenerate,
    onSuccess: (data: any) => {
      message.success(`成功生成 ${data.generated} 条检验记录`);
      setBatchModalVisible(false);
      batchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  /* ---- handlers ---- */

  const handleSearch = () => {
    setParams({ ...params, pageNum: 1 });
  };

  const handleReset = () => {
    setParams({
      keyword: '',
      inspectionType: undefined,
      result: undefined,
      startDate: undefined,
      endDate: undefined,
      pageNum: 1,
      pageSize: 10,
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setParams({ ...params, [field]: value || undefined });
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Inspection) => {
    setEditingRecord(record);
    const formData = {
      ...record,
      inspectionDate: record.inspectionDate ? dayjs(record.inspectionDate) : null,
      nextInspectionDate: record.nextInspectionDate ? dayjs(record.nextInspectionDate) : null,
      certificateExpiry: record.certificateExpiry ? dayjs(record.certificateExpiry) : null,
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('确定要删除这条检验记录吗？')) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewHistory = (assetId: number) => {
    setSelectedAssetId(assetId);
    setHistoryModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      // 处理 photos 为 JSON 字符串
      const photos = values.photos
        ? JSON.stringify(
            values.photos
              .split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s),
          )
        : null;

      const data: Inspection = {
        ...values,
        inspectionDate: values.inspectionDate
          ? values.inspectionDate.format('YYYY-MM-DD')
          : undefined,
        nextInspectionDate: values.nextInspectionDate
          ? values.nextInspectionDate.format('YYYY-MM-DD')
          : undefined,
        certificateExpiry: values.certificateExpiry
          ? values.certificateExpiry.format('YYYY-MM-DD')
          : undefined,
        photos,
      };

      if (editingRecord) {
        updateMutation.mutate({ id: editingRecord.id!, data });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleBatchGenerate = async () => {
    try {
      const values = await batchForm.validateFields();

      const assetIds = values.assetIds
        ? values.assetIds
            .split(',')
            .map((s: string) => parseInt(s.trim()))
            .filter((n: number) => !isNaN(n))
        : [];

      if (assetIds.length === 0) {
        message.error('请输入有效的资产ID列表');
        return;
      }

      batchGenerateMutation.mutate({ assetIds, templateId: values.templateId });
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const closeFormDialog = () => {
    setModalVisible(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const closeBatchDialog = () => {
    setBatchModalVisible(false);
    batchForm.resetFields();
  };

  const closeHistoryDialog = () => {
    setHistoryModalVisible(false);
    setSelectedAssetId(null);
  };

  /* ---- quick filter pills ---- */

  const typePills = [
    { key: '', label: '全部类型' },
    { key: 'ANNUAL', label: '年度检验' },
    { key: 'PERIODIC', label: '定期检验' },
    { key: 'SPECIAL', label: '专项检验' },
  ];

  const resultPills = [
    { key: '', label: '全部结果' },
    { key: 'PASS', label: '通过' },
    { key: 'FAIL', label: '不通过' },
    { key: 'CONDITIONAL', label: '附条件通过' },
    { key: 'PENDING', label: '待检验' },
  ];

  /* ---- columns ---- */

  const columns: Column<Inspection>[] = [
    { key: 'inspectionNo', title: '检验编号', width: 150 },
    { key: 'assetId', title: '资产ID', width: 90 },
    {
      key: 'inspectionType',
      title: '检验类型',
      width: 110,
      render: (val) => (
        <span className="text-sm">
          {INSPECTION_TYPE_LABELS[val as string] || (val as string)}
        </span>
      ),
    },
    { key: 'inspectionDate', title: '检验日期', width: 120 },
    {
      key: 'nextInspectionDate',
      title: '下次检验',
      width: 180,
      render: (val) => {
        const date = val as string;
        if (!date) return <span className="text-slate-400">-</span>;
        const daysLeft = dayjs(date).diff(dayjs(), 'day');
        if (daysLeft < 0)
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              已过期 {Math.abs(daysLeft)} 天
            </span>
          );
        if (daysLeft <= 30)
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {date}（{daysLeft} 天后）
            </span>
          );
        return <span className="text-sm">{date}</span>;
      },
    },
    { key: 'inspectionAgency', title: '检验机构', width: 150 },
    { key: 'inspectorName', title: '检验人', width: 100 },
    {
      key: 'result',
      title: '结果',
      width: 130,
      render: (val) => {
        const badge = RESULT_BADGE[val as string] || {
          ...DEFAULT_BADGE,
          label: val as string,
        };
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.border} ${badge.bg} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        );
      },
    },
    {
      key: '_actions',
      title: '操作',
      width: 200,
      align: 'right',
      render: (_v, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleViewHistory(row.assetId!)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <History className="h-3 w-3" />
            历史
          </button>
          <button
            onClick={() => handleEdit(row)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <Edit3 className="h-3 w-3" />
            编辑
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            删除
          </button>
        </div>
      ),
    },
  ];

  /* ---- history columns ---- */

  const HISTORY_RESULT_LABELS: Record<string, string> = {
    PASS: '通过',
    FAIL: '不通过',
    CONDITIONAL: '附条件通过',
    PENDING: '待检验',
  };

  const historyColumns: Column<Inspection>[] = [
    { key: 'inspectionNo', title: '检验编号' },
    { key: 'inspectionDate', title: '检验日期' },
    {
      key: 'inspectionType',
      title: '检验类型',
      render: (val) => (
        <span className="text-sm">
          {INSPECTION_TYPE_LABELS[val as string] || (val as string)}
        </span>
      ),
    },
    {
      key: 'result',
      title: '结果',
      render: (val) => {
        const label = HISTORY_RESULT_LABELS[val as string] || (val as string);
        const badge = RESULT_BADGE[val as string] || {
          ...DEFAULT_BADGE,
          label,
        };
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.border} ${badge.bg} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        );
      },
    },
    { key: 'inspectionAgency', title: '检验机构' },
  ];

  /* ---- stat items ---- */

  const statItems = [
    {
      label: '总记录',
      value: stats.total,
      gradient: 'from-blue-500 to-blue-600',
      Icon: ClipboardList,
    },
    {
      label: '通过',
      value: stats.pass,
      gradient: 'from-emerald-500 to-emerald-600',
      Icon: CheckCircle2,
    },
    {
      label: '待检验',
      value: stats.pending,
      gradient: 'from-sky-500 to-sky-600',
      Icon: Clock,
    },
    {
      label: '已过期/不通过',
      value: stats.overdue + stats.fail,
      gradient: 'from-red-500 to-red-600',
      Icon: AlertTriangle,
    },
  ];

  /* ---- render ---- */

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Header + Stat Bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">检验记录管理</h1>
              <p className="mt-0.5 text-sm text-slate-500">创建、编辑和追踪设备检验记录</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatchModalVisible(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                批量生成
              </button>
              <button
                onClick={handleCreate}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                新增检验
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {statItems.map(({ label, value, gradient, Icon }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
                >
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="text-lg font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Main Content Card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="检验编号/检验机构/检验人"
                  value={params.keyword}
                  onChange={(e) => setParams({ ...params, keyword: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={params.startDate || ''}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-400">至</span>
                <input
                  type="date"
                  value={params.endDate || ''}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Action buttons */}
              <button
                onClick={handleSearch}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <Search className="h-3.5 w-3.5" />
                搜索
              </button>
              <button
                onClick={handleReset}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置
              </button>
            </div>

            {/* Quick filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              {typePills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() =>
                    setParams({
                      ...params,
                      inspectionType: pill.key || undefined,
                      pageNum: 1,
                    })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    (params.inspectionType || '') === pill.key
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
              <span className="h-4 w-px bg-slate-200 mx-1" />
              {resultPills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() =>
                    setParams({ ...params, result: pill.key || undefined, pageNum: 1 })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    (params.result || '') === pill.key
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* DataTable */}
          <div className="p-5">
            <DataTable<Inspection>
              columns={columns}
              data={recordsList}
              rowKey="id"
              loading={recordsLoading}
              pagination={{
                page: params.pageNum,
                pageSize: params.pageSize,
                total: records?.total || 0,
                onChange: (page, pageSize) => setParams({ ...params, pageNum: page, pageSize }),
              }}
              emptyText="暂无检验记录"
            />
          </div>
        </Card>

        {/* ══════ Dialog: Create / Edit ══════ */}
        <Dialog open={modalVisible} onOpenChange={(open) => !open && closeFormDialog()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRecord ? '编辑检验记录' : '新增检验记录'}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  inspectionType: 'PERIODIC',
                  result: 'PENDING',
                }}
              >
                <Form.Item
                  label="资产ID"
                  name="assetId"
                  rules={[{ required: true, message: '请输入资产ID' }]}
                >
                  <input
                    type="number"
                    placeholder="资产ID"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </Form.Item>

                <Form.Item
                  label="检验编号"
                  name="inspectionNo"
                  rules={[{ required: true, message: '请输入检验编号' }]}
                >
                  <input
                    placeholder="例如：INS-2024-0001"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </Form.Item>

                <Form.Item
                  label="检验类型"
                  name="inspectionType"
                  rules={[{ required: true, message: '请选择检验类型' }]}
                >
                  <AntdSelect>
                    <AntdSelect.Option value="ANNUAL">年度检验</AntdSelect.Option>
                    <AntdSelect.Option value="PERIODIC">定期检验</AntdSelect.Option>
                    <AntdSelect.Option value="SPECIAL">专项检验</AntdSelect.Option>
                  </AntdSelect>
                </Form.Item>

                <Form.Item label="检验模板" name="templateId">
                  <AntdSelect placeholder="选择检验模板（可选）" allowClear>
                    {templates?.records?.map((t: InspectionTemplate) => (
                      <AntdSelect.Option key={t.id} value={t.id}>
                        {t.templateName} ({t.type} - {t.frequency}个月)
                      </AntdSelect.Option>
                    ))}
                  </AntdSelect>
                </Form.Item>

                <Form.Item
                  label="检验日期"
                  name="inspectionDate"
                  rules={[{ required: true, message: '请选择检验日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="下次检验日期" name="nextInspectionDate">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="检验机构" name="inspectionAgency">
                  <input
                    placeholder="检验机构名称"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </Form.Item>

                <Form.Item label="检验人" name="inspectorName">
                  <input
                    placeholder="检验人姓名"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </Form.Item>

                <Form.Item
                  label="检验结果"
                  name="result"
                  rules={[{ required: true, message: '请选择检验结果' }]}
                >
                  <Radio.Group>
                    <Radio value="PASS">通过</Radio>
                    <Radio value="FAIL">不通过</Radio>
                    <Radio value="CONDITIONAL">附条件通过</Radio>
                    <Radio value="PENDING">待检验</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item label="证书编号" name="certificateNo">
                  <input
                    placeholder="检验证书编号"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </Form.Item>

                <Form.Item label="证书有效期" name="certificateExpiry">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="检验照片" name="photos" tooltip="每行一个照片URL">
                  <TextArea
                    rows={3}
                    placeholder={
                      '例如：\nhttps://example.com/photo1.jpg\nhttps://example.com/photo2.jpg'
                    }
                  />
                </Form.Item>

                <Form.Item label="检查发现" name="findings">
                  <TextArea rows={4} placeholder="检验过程中发现的问题或说明" />
                </Form.Item>
              </Form>
            </div>
            <DialogFooter>
              <button
                onClick={closeFormDialog}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleModalOk}
                disabled={isSaving}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving && (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                )}
                确认
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════ Dialog: Batch Generate ══════ */}
        <Dialog
          open={batchModalVisible}
          onOpenChange={(open) => !open && closeBatchDialog()}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>批量生成检验记录</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <Form form={batchForm} layout="vertical">
                <Form.Item
                  label="检验模板"
                  name="templateId"
                  rules={[{ required: true, message: '请选择检验模板' }]}
                >
                  <AntdSelect placeholder="选择检验模板">
                    {templates?.records?.map((t: InspectionTemplate) => (
                      <AntdSelect.Option key={t.id} value={t.id}>
                        {t.templateName} ({t.type} - {t.frequency}个月)
                      </AntdSelect.Option>
                    ))}
                  </AntdSelect>
                </Form.Item>

                <Form.Item
                  label="资产ID列表（逗号分隔）"
                  name="assetIds"
                  rules={[{ required: true, message: '请输入资产ID列表' }]}
                  tooltip="例如：1,2,3"
                >
                  <TextArea rows={4} placeholder="例如：1,2,3,4,5" />
                </Form.Item>
              </Form>
            </div>
            <DialogFooter>
              <button
                onClick={closeBatchDialog}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleBatchGenerate}
                disabled={batchGenerateMutation.isPending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {batchGenerateMutation.isPending && (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                )}
                确认生成
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════ Dialog: History ══════ */}
        <Dialog
          open={historyModalVisible}
          onOpenChange={(open) => !open && closeHistoryDialog()}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>检验历史记录</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <DataTable<Inspection>
                columns={historyColumns}
                data={historyData?.records || historyData?.list || []}
                rowKey="id"
                loading={historyLoading}
                compact
                emptyText="暂无历史记录"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default InspectionRecordPage;
