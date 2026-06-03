import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Info,
  FileText,
  Users,
  Search,
  Send,
  X,
  Headset,
  Paperclip,
  Upload,
  File as FileIcon,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import http from '@/utils/http';
import { createWorkOrder, updateWorkOrder } from '@/api/workorder';
import { getAssetList } from '@/api/asset';
import { getUserList } from '@/api/base';
import FaultCodeSelector from '@/components/fault-code/FaultCodeSelector';
import type { UserItem } from '@/api/base';
import type { PaginatedResponse, ApiResponse, PageData } from '@/types/common';
import type { AssetListItem } from '@/types/asset';
import FaultCodeSelector from '@/components/fault-code/FaultCodeSelector';

const schema = z.object({
  title: z.string().min(5, '标题至少 5 个字').max(100),
  type: z.enum(['PURCHASE', 'REPAIR', 'TRANSFER', 'DISPOSAL', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().max(1000).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'PURCHASE', label: '采购' },
  { value: 'REPAIR', label: '维修' },
  { value: 'TRANSFER', label: '调拨' },
  { value: 'DISPOSAL', label: '处置' },
  { value: 'OTHER', label: '其他' },
] as const;

/** 优先级选项 — 含语义色与描述说明 */
const PRIORITY_OPTIONS = [
  {
    value: 'CRITICAL' as const,
    label: '紧急',
    desc: '立即处理，影响关键业务',
    textColor: 'text-[#ba1a1a]',
    bgColor: 'bg-[#ffdad6]',
    borderColor: 'border-[#ba1a1a]',
    dotColor: 'bg-[#ba1a1a]',
  },
  {
    value: 'HIGH' as const,
    label: '高',
    desc: '优先处理，可能影响业务',
    textColor: 'text-[#c2410c]',
    bgColor: 'bg-[#ffedd5]',
    borderColor: 'border-[#c2410c]',
    dotColor: 'bg-[#c2410c]',
  },
  {
    value: 'MEDIUM' as const,
    label: '中',
    desc: '正常处理节奏',
    textColor: 'text-[#1d4ed8]',
    bgColor: 'bg-[#dbeafe]',
    borderColor: 'border-[#1d4ed8]',
    dotColor: 'bg-[#1d4ed8]',
  },
  {
    value: 'LOW' as const,
    label: '低',
    desc: '有空时处理即可',
    textColor: 'text-[#15803d]',
    bgColor: 'bg-[#dcfce7]',
    borderColor: 'border-[#15803d]',
    dotColor: 'bg-[#15803d]',
  },
] as const;

// 负责人列表从 API 动态获取，此处仅保留默认占位
const ASSIGNEE_DEFAULT = [{ value: '', label: '请选择负责人' }];

const collaborators: string[] = [];

const fieldControlClass = "w-full h-11 rounded-xl border border-[#d7deea] text-sm px-3 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]";
const textAreaClass = "w-full border border-[#d7deea] rounded-xl text-sm py-3 px-3 bg-white/95 shadow-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] placeholder:text-[#94a3b8]";
const sectionHeaderClass = "px-6 py-4 border-b border-[#e5e7eb] flex items-center gap-3 bg-gradient-to-r from-white to-[#f8fafc] rounded-t-xl";
const sectionIconClass = "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]";

export default function WorkOrderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const prefill = (location.state as Record<string, unknown> | null) ?? {};
  const [collabInput, setCollabInput] = useState('');
  const [collaboratorsList, setCollaboratorsList] = useState<string[]>(collaborators);
  const [assigneeOptions, setAssigneeOptions] = useState(ASSIGNEE_DEFAULT);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetResults, setAssetResults] = useState<AssetListItem[]>([]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; assetName: string; assetNo: string } | null>(null);
  const assetSearchRef = useRef<HTMLDivElement>(null);
  const assetSearchTimer = useRef<ReturnType<typeof setTimeout>>();
  const editId = params.id ? Number(params.id) : null;
  const isEdit = editId !== null;

  // ── 附件状态 ────────────────────────────────────────────────
  const [attachmentList, setAttachmentList] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── 故障代码选择 ──────────────────────────────────────────────
  const [faultCodeId, setFaultCodeId] = useState<number | undefined>();
  const [faultCodeLabel, setFaultCodeLabel] = useState('');

  // 从 API 获取用户列表作为负责人选项
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getUserList({ page: 1, pageSize: 100 });
        const users = (res as PageData<UserItem> | undefined)?.records ?? [];
        if (cancelled) return;
        if (users.length > 0) {
          setAssigneeOptions([
            { value: '', label: '请选择负责人' },
            ...users.map((u) => ({
              value: String(u.id),
              label: `${u.realName ?? u.username}${u.deptName ? ` (${u.deptName})` : ''}`,
            })),
          ]);
        }
      } catch {
        // API 不可用时保留默认选项
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 资产搜索（防抖 300ms，复用 GET /assets 接口）
  const searchAssets = useCallback((keyword: string) => {
    if (assetSearchTimer.current) clearTimeout(assetSearchTimer.current);
    if (!keyword.trim()) {
      setAssetResults([]);
      setShowAssetDropdown(false);
      return;
    }
    assetSearchTimer.current = setTimeout(async () => {
      try {
        const res = await getAssetList({ keyword, pageSize: 10 });
        const records = (res as PageData<AssetListItem> | undefined)?.records ?? [];
        setAssetResults(records);
        setShowAssetDropdown(records.length > 0);
      } catch {
        setAssetResults([]);
        setShowAssetDropdown(false);
      }
    }, 300);
  }, []);

  // 点击外部关闭资产搜索下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assetSearchRef.current && !assetSearchRef.current.contains(e.target as Node)) {
        setShowAssetDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: {
      type: 'REPAIR',
      priority: 'MEDIUM',
      title: typeof prefill.title === 'string' ? prefill.title : '',
      description: '',
      estimatedCost: undefined,
      dueDate: '',
      assignee: '',
    } satisfies Partial<FormValues>,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // 合并选中的资产信息和故障代码
      const payload: Record<string, unknown> = {
        ...data,
        assetId: selectedAsset?.id ?? null,
        assetName: selectedAsset?.assetName ?? null,
        assetCode: selectedAsset?.assetNo ?? null,
        collaborators: collaboratorsList,
        attachments: attachmentList,
        faultCodeId: data.type === 'REPAIR' ? (faultCodeId ?? null) : null,
      };
      if (isEdit && editId) {
        return updateWorkOrder(editId, payload);
      }
      return createWorkOrder(payload);
    },
    onSuccess: (res: unknown) => {
      qc.invalidateQueries({ queryKey: ['workorders'] });
      toast.success(isEdit ? '工单更新成功' : '工单创建成功');
      navigate('/workorders');
    },
    onError: (error: Error) => {
      const message =
        error?.message ??
        '提交失败，请重试';
      toast.error(message);
    },
  });

  // ── 文件上传 ──────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await http.post<string>('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // res 是返回的 URL 字符串
      const url = typeof res === 'string' ? res : (res as any)?.data ?? (res as any)?.url ?? '';
      if (url) {
        setAttachmentList((prev) => [...prev, url]);
        toast.success('文件上传成功');
      } else {
        toast.error('上传返回为空');
      }
    } catch (err: any) {
      toast.error(err?.message || '文件上传失败');
    } finally {
      setUploading(false);
      // 清除 input 以允许重复选择同一文件
      e.target.value = '';
    }
  }, []);

  const removeAttachment = useCallback((url: string) => {
    setAttachmentList((prev) => prev.filter((u) => u !== url));
  }, []);

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  const removeCollaborator = (name: string) => {
    setCollaboratorsList((prev) => prev.filter((c) => c !== name));
  };

  const addCollaborator = () => {
    const trimmed = collabInput.trim();
    if (trimmed && !collaboratorsList.includes(trimmed)) {
      setCollaboratorsList((prev) => [...prev, trimmed]);
      setCollabInput('');
    }
  };

  const selectedPriority = watch('priority') as FormValues['priority'];

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-br from-[#f8fafc] via-white to-[#eef2f7]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <PageHeader
          title={isEdit ? '编辑工单' : '新建工单'}
          breadcrumbs={[
            { label: '首页', href: '/dashboard' },
            { label: '工单管理', href: '/workorders' },
            { label: isEdit ? '编辑工单' : '新建工单' },
          ]}
        />

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-12 gap-4 lg:gap-6">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              {/* ── 基本信息 ── */}
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><Info className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">基本信息</h2>
                </div>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="col-span-2">
                    <Input
                      label="标题 *"
                      placeholder="请输入工单描述性标题"
                      error={errors.title?.message}
                      {...register('title')}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">工单类型</label>
                    <select
                      className={fieldControlClass}
                      {...register('type')}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* ── 资产关联 ── */}
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><Search className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">资产关联</h2>
                </div>
                <CardContent className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">关联资产</label>
                    <div className="relative" ref={assetSearchRef}>
                      {selectedAsset ? (
                        <div className="flex items-center gap-2 min-h-11 border border-blue-100 rounded-xl px-3 bg-blue-50 shadow-sm">
                          <span className="text-sm text-[#191c1e] font-medium truncate">{selectedAsset.assetName}</span>
                          <span className="text-xs text-[#434655]">({selectedAsset.assetNo})</span>
                          <button
                            type="button"
                            className="ml-auto text-[#434655] hover:text-[#ba1a1a]"
                            onClick={() => setSelectedAsset(null)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            className="w-full h-11 rounded-xl border border-[#d7deea] text-sm pl-3 pr-10 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                            placeholder="搜索资产编号或名称..."
                            value={assetSearch}
                            onChange={(e) => {
                              setAssetSearch(e.target.value);
                              searchAssets(e.target.value);
                            }}
                            onFocus={() => {
                              if (assetResults.length > 0) setShowAssetDropdown(true);
                            }}
                          />
                          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#434655] hover:bg-[#e0e3e5] rounded transition-colors">
                            <Search className="w-4 h-4" />
                          </button>
                          {showAssetDropdown && (
                            <div className="absolute z-20 top-12 left-0 right-0 bg-white border border-[#dbe4f0] rounded-2xl shadow-lg max-h-56 overflow-y-auto p-1">
                              {assetResults.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2 rounded-xl transition-colors"
                                  onClick={() => {
                                    setSelectedAsset({ id: a.id, assetName: a.assetName ?? '', assetNo: a.assetNo ?? '' });
                                    setAssetSearch('');
                                    setShowAssetDropdown(false);
                                    setAssetResults([]);
                                  }}
                                >
                                  <span className="font-medium">{a.assetName}</span>
                                  <span className="text-xs text-[#434655]">{a.assetNo}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── 故障代码选择（仅 REPAIR 类型） ── */}
              {watch('type') === 'REPAIR' && (
                <Card>
                  <div className={sectionHeaderClass}>
                    <span className={sectionIconClass}><AlertTriangle className="w-5 h-5" /></span>
                    <h2 className="text-base font-semibold text-[#191c1e]">故障代码</h2>
                  </div>
                  <CardContent>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold tracking-wide text-[#434655]">
                        关联故障代码（三级选择：现象→原因→措施）
                      </label>
                      <FaultCodeSelector
                        value={faultCodeId}
                        onChange={(id, label) => {
                          setFaultCodeId(id);
                          setFaultCodeLabel(label);
                        }}
                      />
                      {faultCodeLabel && (
                        <p className="text-xs text-blue-600 mt-1">
                          已选择: {faultCodeLabel}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── 优先级选择器（语义色卡片式） ── */}
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><Headset className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">优先级</h2>
                </div>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PRIORITY_OPTIONS.map((p) => {
                      const isSelected = selectedPriority === p.value;
                      return (
                        <label
                          key={p.value}
                          className={`relative flex flex-col gap-1.5 rounded-xl border p-3 cursor-pointer transition-all hover:shadow-sm ${
                            isSelected
                              ? `${p.borderColor} ${p.bgColor} shadow-sm`
                              : 'border-[#e5e7eb] bg-white/90 hover:border-[#c3c6d7]'
                          }`}
                        >
                          <input
                            type="radio"
                            value={p.value}
                            {...register('priority')}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.dotColor}`} />
                            <span className={`text-sm font-bold ${isSelected ? p.textColor : 'text-[#191c1e]'}`}>
                              {p.label}
                            </span>
                          </div>
                          <span className={`text-xs leading-snug ${isSelected ? p.textColor : 'text-[#6b7280]'}`}>
                            {p.desc}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* ── 详细信息 ── */}
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><FileText className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">详细信息</h2>
                </div>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">描述</label>
                    <textarea
                      rows={4}
                      placeholder="请详细说明工单内容及注意事项..."
                      className={textAreaClass}
                      {...register('description')}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">预计费用</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655] text-sm">¥</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full h-11 rounded-xl border border-[#d7deea] text-sm pl-8 pr-3 bg-white/95 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                        {...register('estimatedCost')}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">截止日期</label>
                    <input
                      type="date"
                      className={fieldControlClass}
                      {...register('dueDate')}
                    />
                  </div>
                </CardContent>
              </Card>

            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><Users className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">人员安排</h2>
                </div>
                <CardContent className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">负责人</label>
                    <select
                      className={fieldControlClass}
                      {...register('assignee')}
                    >
                      {assigneeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">协作人</label>
                    <div className="w-full border border-[#d7deea] rounded-xl p-2 min-h-[48px] flex flex-wrap gap-1.5 bg-white/95 shadow-sm focus-within:ring-2 focus-within:ring-[#2563eb]/20 focus-within:border-[#2563eb]">
                      {collaboratorsList.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-[#0d1c2e] text-xs font-semibold px-2.5 py-1 rounded-full"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => removeCollaborator(name)}
                            className="text-[#3a485b] hover:text-[#191c1e]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        className="flex-1 min-w-[80px] border-none focus:ring-0 p-0 text-sm ml-1 outline-none"
                        placeholder="添加人员..."
                        value={collabInput}
                        onChange={(e) => setCollabInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCollaborator();
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── 附件上传 ── */}
              <Card>
                <div className={sectionHeaderClass}>
                  <span className={sectionIconClass}><Paperclip className="w-5 h-5" /></span>
                  <h2 className="text-base font-semibold text-[#191c1e]">附件</h2>
                </div>
                <CardContent className="flex flex-col gap-3">
                  {/* 上传按钮 */}
                  <label className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border-2 border-dashed border-[#d7deea] text-sm text-[#64748b] cursor-pointer hover:border-[#2563eb] hover:text-[#2563eb] transition-colors bg-white/50">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? '上传中...' : '上传文件'}</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    />
                  </label>
                  {/* 已上传附件列表 */}
                  {attachmentList.length > 0 && (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {attachmentList.map((url, idx) => {
                        const fileName = url.substring(url.lastIndexOf('/') + 1) || `附件${idx + 1}`;
                        return (
                          <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                            <FileIcon className="w-4 h-4 text-[#64748b] shrink-0" />
                            <span className="flex-1 text-xs text-[#374151] truncate">{fileName}</span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(url)}
                              className="text-[#94a3b8] hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <section className="rounded-2xl border border-[#d8e2f3] bg-white/85 p-5 text-[#243047] shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                    <Headset className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-[#191c1e]">处理提示</h4>
                    <p className="text-xs text-[#64748b] mt-0.5">用于安排负责人、资产与截止时间的填写参考。</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[#475569]">
                  请结合工单类型、资产状态与现场影响填写说明，并在提交前确认负责人和截止日期。
                </p>
              </section>
            </div>
          </div>

          {saveMutation.isError && (
            <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
              {(saveMutation.error instanceof Error ? saveMutation.error.message : '提交失败，请重试')}
            </div>
          )}
        </form>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 min-h-20 bg-white/90 backdrop-blur-xl border-t border-[#d7deea] z-40 flex flex-col sm:flex-row items-stretch sm:items-center justify-end px-4 sm:px-10 py-3 sm:py-0 gap-3 sm:gap-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>
          取消
        </Button>
        <Button
          size="lg"
          loading={isSubmitting || saveMutation.isPending}
          onClick={handleSubmit((values) => onSubmit(values as unknown as FormValues))}
        >
          <Send className="w-4 h-4" />
          提交工单
        </Button>
      </footer>
    </div>
  );
}
