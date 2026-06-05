/**
 * @file components/execution/TimeLogForm.tsx
 * @description 工时登记表单组件
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Square, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

interface TimeLog {
  id: number;
  workOrderId: number;
  userId: number;
  userName?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  description?: string;
}

interface TimeLogFormProps {
  workOrderId: number;
}

export default function TimeLogForm({ workOrderId }: TimeLogFormProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  const { data: res } = useQuery({
    queryKey: ['workorder', workOrderId, 'time-logs'],
    queryFn: () => http.get<ApiResponse<TimeLog[]>>(`/workorders/${workOrderId}/execution/time-logs`),
  });

  const logs = (res as any)?.data ?? [];

  const startTimerMutation = useMutation({
    mutationFn: () => http.post(`/workorders/${workOrderId}/execution/time-logs`, { startTimer: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'time-logs'] });
      toast.success('计时已开始');
    },
    onError: (err: any) => toast.error(err?.message || '启动计时失败'),
  });

  const stopTimerMutation = useMutation({
    mutationFn: (timeLogId: number) =>
      http.put(`/workorders/${workOrderId}/execution/time-logs/${timeLogId}/stop`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'time-logs'] });
      toast.success('计时已结束');
    },
    onError: (err: any) => toast.error(err?.message || '停止计时失败'),
  });

  const manualLogMutation = useMutation({
    mutationFn: (data: any) => http.post(`/workorders/${workOrderId}/execution/time-logs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'time-logs'] });
      toast.success('工时已登记');
      setShowManual(false);
      setManualStart('');
      setManualEnd('');
    },
    onError: (err: any) => toast.error(err?.message || '登记失败'),
  });

  // 查找正在进行的计时
  const runningLog = logs.find((l: TimeLog) => !l.endTime);

  function handleManualSubmit() {
    if (!manualStart || !manualEnd) {
      toast.error('请填写开始和结束时间');
      return;
    }
    manualLogMutation.mutate({
      startTime: new Date(manualStart).toISOString(),
      endTime: new Date(manualEnd).toISOString(),
      description,
    });
  }

  function formatDuration(minutes?: number): string {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          工时登记
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 计时按钮 */}
        <div className="flex gap-2">
          {runningLog ? (
            <Button
              variant="warning"
              onClick={() => stopTimerMutation.mutate(runningLog.id)}
              loading={stopTimerMutation.isPending}
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              停止计时
            </Button>
          ) : (
            <Button
              onClick={() => startTimerMutation.mutate()}
              loading={startTimerMutation.isPending}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              开始计时
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowManual(!showManual)} className="gap-2">
            <Plus className="w-4 h-4" />
            手动登记
          </Button>
        </div>

        {/* 手动登记表单 */}
        {showManual && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">开始时间</label>
                <input
                  type="datetime-local"
                  value={manualStart}
                  onChange={e => setManualStart(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#d7deea] text-sm px-3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">结束时间</label>
                <input
                  type="datetime-local"
                  value={manualEnd}
                  onChange={e => setManualEnd(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#d7deea] text-sm px-3"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">工作描述</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="描述此时间段的工作内容"
                className="w-full h-9 rounded-lg border border-[#d7deea] text-sm px-3"
              />
            </div>
            <Button
              size="sm"
              onClick={handleManualSubmit}
              loading={manualLogMutation.isPending}
            >
              保存
            </Button>
          </div>
        )}

        {/* 工时记录列表 */}
        {logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log: TimeLog) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="text-gray-700">
                    {log.startTime ? new Date(log.startTime).toLocaleString('zh-CN') : '-'}
                    {log.endTime && ` → ${new Date(log.endTime).toLocaleString('zh-CN')}`}
                  </div>
                  {log.description && (
                    <div className="text-xs text-gray-400 mt-0.5">{log.description}</div>
                  )}
                </div>
                <div className="text-sm font-medium text-blue-600 ml-4">
                  {formatDuration(log.durationMinutes)}
                </div>
              </div>
            ))}
          </div>
        )}

        {logs.length === 0 && !runningLog && (
          <p className="text-sm text-gray-400 text-center py-4">暂无工时记录</p>
        )}
      </CardContent>
    </Card>
  );
}
