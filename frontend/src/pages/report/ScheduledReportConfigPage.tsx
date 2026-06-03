/**
 * @file pages/report/ScheduledReportConfigPage.tsx
 * @description 定时报表配置页面 — CRUD + 启用/暂停
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Pause, Play, Trash2, Loader2 } from 'lucide-react';
import { getScheduledReports, deleteScheduledReport, toggleScheduledReport } from '@/api/scheduledReport';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { ScheduledReport } from '@/types/scheduledReport';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: '#10b981' },
  PAUSED: { label: '暂停', color: '#f59e0b' },
};

export default function ScheduledReportConfigPage() {
  const qc = useQueryClient();
  const [pageNum, setPageNum] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['scheduled-reports', pageNum],
    queryFn: () => getScheduledReports(pageNum, pageSize),
  });

  const reports = (data as any)?.records ?? [];
  const total = (data as any)?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteScheduledReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('定时报表已删除');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleScheduledReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('状态已切换');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--surface-heading)]">定时报表配置</h1>
          <p className="text-sm text-[var(--surface-muted-text)]">管理定时报表调度和邮件推送</p>
        </div>
        <Button
          onClick={() => toast.info('新建报表功能即将开放')}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          新建定时报表
        </Button>
      </div>

      <Card className="bg-[var(--surface-card)]">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--surface-muted-text)]" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-[var(--surface-muted-text)]">
              <Clock className="w-12 h-12 mb-3 opacity-40" />
              <span>暂无定时报表配置</span>
              <span className="mt-1">点击"新建定时报表"开始创建</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left py-3 px-3 text-[var(--surface-muted-text)] font-medium">ID</th>
                    <th className="text-left py-3 px-3 text-[var(--surface-muted-text)] font-medium">CRON 表达式</th>
                    <th className="text-left py-3 px-3 text-[var(--surface-muted-text)] font-medium">格式</th>
                    <th className="text-center py-3 px-3 text-[var(--surface-muted-text)] font-medium">状态</th>
                    <th className="text-left py-3 px-3 text-[var(--surface-muted-text)] font-medium">上次执行</th>
                    <th className="text-left py-3 px-3 text-[var(--surface-muted-text)] font-medium">下次执行</th>
                    <th className="text-center py-3 px-3 text-[var(--surface-muted-text)] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report: ScheduledReport) => (
                    <tr key={report.id} className="border-b border-[var(--surface-border-subtle)] hover:bg-[var(--surface-muted)] transition-colors">
                      <td className="py-3 px-3 font-medium">{report.id}</td>
                      <td className="py-3 px-3 font-mono text-xs">{report.cronExpr || '-'}</td>
                      <td className="py-3 px-3">{report.format || 'PDF'}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: (STATUS_MAP[report.status]?.color || '#999') + '20',
                            color: STATUS_MAP[report.status]?.color || '#999',
                          }}
                        >
                          {STATUS_MAP[report.status]?.label || report.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-[var(--surface-muted-text)]">
                        {report.lastRunAt ? new Date(report.lastRunAt).toLocaleString('zh-CN') : '从未执行'}
                      </td>
                      <td className="py-3 px-3 text-xs text-[var(--surface-muted-text)]">
                        {report.nextRunAt ? new Date(report.nextRunAt).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleMutation.mutate(report.id)}
                            disabled={toggleMutation.isPending}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-muted-strong)] transition"
                            title={report.status === 'ACTIVE' ? '暂停' : '启用'}
                          >
                            {report.status === 'ACTIVE' ? (
                              <Pause className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Play className="w-4 h-4 text-green-500" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确认删除该定时报表？')) deleteMutation.mutate(report.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-muted-strong)] transition"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
