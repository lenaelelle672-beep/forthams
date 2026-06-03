/**
 * @file pages/settings/SlaConfigTab.tsx
 * @description SLA 配置 Tab — 按优先级配置响应时限和解决时限
 *
 * 对应后端：SlaConfigController
 * GET /sla-config — 查询配置列表
 * PUT /sla-config/{id} — 更新配置
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Save, Loader2 } from 'lucide-react';
import http from '@/utils/http';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface SlaConfigItem {
  id: number;
  priority: string;
  responseHours: number;
  resolveHours: number;
  warningRatio: number;
  status: number;
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '低优先级',
  MEDIUM: '中优先级',
  HIGH: '高优先级',
  CRITICAL: '紧急',
};

const PRIORITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function SlaConfigTab() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<number, Partial<SlaConfigItem>>>({});

  const { data: configs, isLoading } = useQuery<SlaConfigItem[]>({
    queryKey: ['sla-config'],
    queryFn: () => http.get<SlaConfigItem[]>('/sla-config'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SlaConfigItem> }) =>
      http.put(`/sla-config/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-config'] });
      setEdits({});
      toast.success('SLA 配置已更新');
    },
    onError: () => toast.error('更新失败，请重试'),
  });

  const setEdit = (id: number, field: 'responseHours' | 'resolveHours' | 'warningRatio', value: number) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const getValue = (item: SlaConfigItem, field: 'responseHours' | 'resolveHours' | 'warningRatio'): number => {
    return (edits[item.id]?.[field] ?? item[field]) as number;
  };

  const hasChanges = (item: SlaConfigItem): boolean => {
    const e = edits[item.id];
    if (!e) return false;
    return (
      (e.responseHours != null && e.responseHours !== item.responseHours) ||
      (e.resolveHours != null && e.resolveHours !== item.resolveHours) ||
      (e.warningRatio != null && e.warningRatio !== item.warningRatio)
    );
  };

  const sorted = configs
    ? [...configs].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#0f172a]">SLA 配置</h3>
          <p className="text-sm text-[#64748b] mt-1">
            按工单优先级分别配置 SLA 响应时限（小时）和解决时限（小时）
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#64748b]">
          <Clock className="w-4 h-4" />
          修改后点击行尾"保存"按钮生效
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[#94a3b8]">
            暂无 SLA 配置数据
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#eff6ff] text-[#2563eb]">
                      {PRIORITY_LABELS[item.priority] || item.priority}
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      ID: {item.id}
                    </span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 1 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.status === 1 ? '已启用' : '已禁用'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 响应时限 */}
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1.5">响应时限（小时）</label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={getValue(item, 'responseHours')}
                      onChange={(e) => setEdit(item.id, 'responseHours', Number(e.target.value))}
                      className="w-full h-10 rounded-lg border border-[#d7deea] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                    />
                  </div>
                  {/* 解决时限 */}
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1.5">解决时限（小时）</label>
                    <input
                      type="number"
                      min={1}
                      max={99999}
                      value={getValue(item, 'resolveHours')}
                      onChange={(e) => setEdit(item.id, 'resolveHours', Number(e.target.value))}
                      className="w-full h-10 rounded-lg border border-[#d7deea] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                    />
                  </div>
                  {/* 预警比例 */}
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1.5">预警阈值</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(getValue(item, 'warningRatio') * 100)}
                        onChange={(e) => setEdit(item.id, 'warningRatio', Number(e.target.value) / 100)}
                        className="w-full h-10 rounded-lg border border-[#d7deea] text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                      />
                      <span className="text-sm text-[#64748b] w-6">%</span>
                    </div>
                  </div>
                </div>
                {hasChanges(item) && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      loading={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({ id: item.id, data: edits[item.id] })
                      }
                    >
                      <Save className="w-4 h-4" /> 保存
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
