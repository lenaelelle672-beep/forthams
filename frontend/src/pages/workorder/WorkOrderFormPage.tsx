import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Info,
  FileText,
  Users,
  Search,
  Send,
  X,
  BarChart3,
  Headset,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';

const schema = z.object({
  title: z.string().min(5, '标题至少 5 个字').max(100),
  type: z.enum(['maintenance', 'upkeep', 'inspection', 'installation']),
  assetKeyword: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  description: z.string().max(1000).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'maintenance', label: '维修' },
  { value: 'upkeep', label: '保养' },
  { value: 'inspection', label: '巡检' },
  { value: 'installation', label: '安装' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'urgent' as const, label: '紧急', color: 'text-[#ba1a1a]', bg: 'bg-[#ffdad6]', ring: 'ring-[#ba1a1a]' },
  { value: 'high' as const, label: '高', color: 'text-[#004ac6]', bg: '', ring: 'ring-[#004ac6]' },
  { value: 'medium' as const, label: '中', color: 'text-[#004ac6]', bg: '', ring: 'ring-[#004ac6]' },
  { value: 'low' as const, label: '低', color: 'text-[#004ac6]', bg: '', ring: 'ring-[#004ac6]' },
];

const ASSIGNEE_OPTIONS = [
  { value: '', label: '请选择负责人' },
  { value: 'chenwei', label: '陈伟 (项目经理)' },
  { value: 'lixiaohua', label: '李晓华 (高级工程师)' },
  { value: 'zhangjianguo', label: '张建国 (运维组长)' },
];

const collaborators = ['赵敏', '王刚'];

export default function WorkOrderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const prefill = (location.state as any) ?? {};
  const [collabInput, setCollabInput] = useState('');
  const [collaboratorsList, setCollaboratorsList] = useState(collaborators);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'maintenance',
      priority: 'urgent',
      title: prefill.title ?? '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // TODO: replace with real API call
      console.log('创建工单:', data);
      return { data: { id: 'WO-NEW-001' } };
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['workorders'] });
      const orderId = res?.data?.id;
      navigate(orderId ? `/workorders/${orderId}` : '/workorders');
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
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

  const selectedPriority = watch('priority');

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-[1440px] mx-auto px-10 py-6">
        <PageHeader
          title="新建工单"
          breadcrumbs={[
            { label: '首页', href: '/dashboard' },
            { label: '工单管理', href: '/workorders' },
            { label: '新建工单' },
          ]}
        />

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <Card>
                <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#2563eb]" />
                  <h2 className="text-lg font-semibold text-[#191c1e]">基本信息</h2>
                </div>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      className="w-full h-9 rounded border border-[#c3c6d7] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                      {...register('type')}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">关联资产</label>
                    <div className="relative">
                      <input
                        className="w-full h-9 rounded border border-[#c3c6d7] text-sm pl-3 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                        placeholder="搜索或选择资产..."
                        {...register('assetKeyword')}
                      />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#434655] hover:bg-[#e0e3e5] rounded transition-colors">
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold tracking-wide text-[#434655] mb-3">优先级</label>
                    <div className="flex gap-6 flex-wrap">
                      {PRIORITY_OPTIONS.map((p) => (
                        <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value={p.value}
                            {...register('priority')}
                            className="w-4 h-4 border-[#c3c6d7] text-[#004ac6] focus:ring-[#004ac6]"
                          />
                          <span
                            className={`text-sm font-medium px-2 py-0.5 rounded ${
                              selectedPriority === p.value && p.value === 'urgent'
                                ? 'text-[#ba1a1a] bg-[#ffdad6] font-bold'
                                : selectedPriority === p.value
                                ? 'text-[#191c1e] font-bold'
                                : 'text-[#434655]'
                            }`}
                          >
                            {p.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#2563eb]" />
                  <h2 className="text-lg font-semibold text-[#191c1e]">详细信息</h2>
                </div>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">描述</label>
                    <textarea
                      rows={4}
                      placeholder="请详细说明工单内容及注意事项..."
                      className="w-full border border-[#c3c6d7] rounded text-sm py-2 px-3 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] placeholder:text-[#94a3b8]"
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
                        className="w-full h-9 rounded border border-[#c3c6d7] text-sm pl-8 pr-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                        {...register('estimatedCost')}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">截止日期</label>
                    <input
                      type="date"
                      className="w-full h-9 rounded border border-[#c3c6d7] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                      {...register('dueDate')}
                    />
                  </div>
                </CardContent>
              </Card>

              <section className="grid grid-cols-2 gap-6">
                <div className="bg-[#2563eb] rounded p-6 text-white flex flex-col justify-between min-h-[160px]">
                  <div>
                    <BarChart3 className="w-8 h-8 mb-2" />
                    <h3 className="text-lg font-semibold">平均修复时长 (MTTR)</h3>
                  </div>
                  <div className="text-3xl font-bold">2.4h</div>
                </div>
                <div className="relative rounded overflow-hidden group min-h-[160px] bg-[#e0e3e5]">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <p className="text-white text-xs font-semibold tracking-wide">查看设备维护标准手册</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <Card>
                <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2563eb]" />
                  <h2 className="text-lg font-semibold text-[#191c1e]">人员安排</h2>
                </div>
                <CardContent className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">负责人</label>
                    <select
                      className="w-full h-9 rounded border border-[#c3c6d7] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                      {...register('assignee')}
                    >
                      {ASSIGNEE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-wide text-[#434655]">协作人</label>
                    <div className="w-full border border-[#c3c6d7] rounded p-2 min-h-[44px] flex flex-wrap gap-1 bg-white">
                      {collaboratorsList.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 bg-[#d5e3fc] text-[#0d1c2e] text-xs font-semibold px-2 py-0.5 rounded-full"
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

                  <div className="pt-4 mt-4 border-t border-[#e5e7eb]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold tracking-wide text-[#434655]">团队负载</span>
                      <span className="text-xs font-semibold tracking-wide text-[#2563eb]">85%</span>
                    </div>
                    <div className="w-full h-2 bg-[#e0e3e5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563eb] w-[85%]" />
                    </div>
                    <p className="mt-2 text-[11px] text-[#434655] leading-tight">
                      当前分配的负责人已有 3 个待处理工单。建议优先考虑资源负载。
                    </p>
                  </div>
                </CardContent>
              </Card>

              <section className="bg-[#656d84] rounded p-6 text-[#eef0ff]">
                <div className="flex items-start justify-between mb-4">
                  <Headset className="w-7 h-7" />
                  <ExternalLink className="w-5 h-5 text-[#3f465c] cursor-pointer hover:text-white transition-colors" />
                </div>
                <h4 className="text-lg font-semibold mb-1">智能辅助系统</h4>
                <p className="text-sm opacity-90">
                  根据工单类型和设备历史，系统推荐在 12 小时内完成此任务以避免进一步损坏。
                </p>
              </section>
            </div>
          </div>

          {createMutation.isError && (
            <div className="mt-6 p-3 rounded bg-[#ffdad6] border border-[#ba1a1a]/20 text-[#ba1a1a] text-sm">
              {(createMutation.error as any)?.response?.data?.message ?? '提交失败，请重试'}
            </div>
          )}
        </form>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-[#c3c6d7] z-40 flex items-center justify-end px-10 gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>
          取消
        </Button>
        <Button
          size="lg"
          loading={isSubmitting || createMutation.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          <Send className="w-4 h-4" />
          提交工单
        </Button>
      </footer>
    </div>
  );
}
