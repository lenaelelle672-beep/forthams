/**
 * @file components/execution/StepChecklist.tsx
 * @description 步骤 CheckList 组件
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Check, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import ProgressBar from './ProgressBar';
import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

interface WorkOrderStep {
  id: number;
  workOrderId: number;
  stepName: string;
  stepOrder: number;
  isCompleted: number;
  completedBy?: number;
  completedAt?: string;
  note?: string;
}

interface StepChecklistProps {
  workOrderId: number;
}

export default function StepChecklist({ workOrderId }: StepChecklistProps) {
  const queryClient = useQueryClient();
  const [newStepName, setNewStepName] = useState('');

  const { data: res } = useQuery({
    queryKey: ['workorder', workOrderId, 'steps'],
    queryFn: () => http.get<ApiResponse<WorkOrderStep[]>>(`/workorders/${workOrderId}/execution/steps`),
  });

  const { data: progressRes } = useQuery({
    queryKey: ['workorder', workOrderId, 'progress'],
    queryFn: () => http.get<ApiResponse<any>>(`/workorders/${workOrderId}/execution/progress`),
  });

  const steps = (res as any)?.data ?? [];
  const progress = (progressRes as any)?.data ?? { totalSteps: 0, completedSteps: 0, percentage: 0 };

  const createMutation = useMutation({
    mutationFn: (stepName: string) =>
      http.post(`/workorders/${workOrderId}/execution/steps`, { stepName, stepOrder: steps.length + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'steps'] });
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'progress'] });
      setNewStepName('');
      toast.success('步骤已添加');
    },
    onError: (err: any) => toast.error(err?.message || '添加失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (stepId: number) => http.delete(`/workorders/${workOrderId}/execution/steps/${stepId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'steps'] });
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'progress'] });
      toast.success('步骤已删除');
    },
    onError: (err: any) => toast.error(err?.message || '删除失败'),
  });

  const toggleMutation = useMutation({
    mutationFn: (step: WorkOrderStep) => {
      if (step.isCompleted) {
        return http.put(`/workorders/${workOrderId}/execution/steps/${step.id}/uncomplete`, {});
      }
      return http.put(`/workorders/${workOrderId}/execution/steps/${step.id}/complete`, { completedBy: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'steps'] });
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId, 'progress'] });
    },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Square className="w-4 h-4" />
            执行步骤
          </span>
          <span className="text-sm font-normal text-gray-500">
            {progress.completedSteps}/{progress.totalSteps}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 进度条 */}
        <ProgressBar percentage={progress.percentage} />

        {/* 新增步骤 */}
        <div className="flex gap-2">
          <Input
            value={newStepName}
            onChange={e => setNewStepName(e.target.value)}
            placeholder="输入步骤名称..."
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => newStepName.trim() && createMutation.mutate(newStepName.trim())}
            disabled={!newStepName.trim()}
            loading={createMutation.isPending}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* 步骤列表 */}
        {steps.length > 0 && (
          <div className="space-y-1">
            {steps.map((step: WorkOrderStep) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  step.isCompleted ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <button
                  onClick={() => toggleMutation.mutate(step)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    step.isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {step.isCompleted && <Check className="w-3 h-3" />}
                </button>
                <span className={`flex-1 text-sm ${step.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {step.stepName}
                </span>
                <button
                  onClick={() => deleteMutation.mutate(step.id)}
                  className="p-1 text-gray-300 hover:text-red-500 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {steps.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">暂无步骤，请添加工单执行步骤</p>
        )}
      </CardContent>
    </Card>
  );
}
