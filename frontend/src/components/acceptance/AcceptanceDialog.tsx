/**
 * @file components/acceptance/AcceptanceDialog.tsx
 * @description 验收/返工对话框组件
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CheckCircle, XCircle, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { submitForAcceptance, acceptWorkOrder, rejectAcceptance } from '@/api/workorder';

type AcceptanceMode = 'submit' | 'accept' | 'reject';

interface AcceptanceDialogProps {
  workOrderId: number;
  mode: AcceptanceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AcceptanceDialog({ workOrderId, mode, open, onOpenChange, onSuccess }: AcceptanceDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');

  const config = {
    submit: {
      title: '提交验收',
      description: '确认工单已执行完毕，提交验收申请',
      buttonLabel: '提交验收',
      icon: Send,
      variant: 'primary' as const,
    },
    accept: {
      title: '验收通过',
      description: '确认工单验收通过，工单将标记为已完成',
      buttonLabel: '通过验收',
      icon: CheckCircle,
      variant: 'success' as const,
    },
    reject: {
      title: '验收驳回',
      description: '验收不通过，工单将返回重新执行',
      buttonLabel: '驳回并返工',
      icon: RotateCcw,
      variant: 'danger' as const,
    },
  };

  const cfg = config[mode];

  const submitMutation = useMutation({
    mutationFn: () => submitForAcceptance(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('已提交验收');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.message || '提交失败'),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptWorkOrder(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('验收通过');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectAcceptance(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('已驳回，工单返回执行');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  function handleConfirm() {
    switch (mode) {
      case 'submit':
        submitMutation.mutate();
        break;
      case 'accept':
        acceptMutation.mutate();
        break;
      case 'reject':
        rejectMutation.mutate();
        break;
    }
  }

  const isPending = submitMutation.isPending || acceptMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <cfg.icon className="w-5 h-5" />
            {cfg.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">{cfg.description}</p>
          {mode === 'reject' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              驳回后工单状态将变为「验收驳回」，需重新执行并再次提交验收
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              {mode === 'reject' ? '驳回原因 *' : '验收备注'}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full h-24 rounded-xl border border-[#d7deea] text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
              placeholder={mode === 'reject' ? '请说明驳回原因...' : '可选填写备注...'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            variant={cfg.variant}
            onClick={handleConfirm}
            loading={isPending}
            disabled={mode === 'reject' && !comment.trim()}
          >
            {cfg.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
