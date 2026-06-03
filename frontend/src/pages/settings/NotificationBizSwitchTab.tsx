/**
 * @file pages/settings/NotificationBizSwitchTab.tsx
 * @description 流程通知开关管理 Tab
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { notificationSwitchApi } from '@/api/notificationTemplate';
import { BIZ_TYPE_LABELS } from '@/types/notificationTemplate';
import type { NotificationBizSwitch } from '@/types/notificationTemplate';

const EVENT_LABELS: Record<string, string> = {
  submitted: '提交',
  approved: '通过',
  rejected: '驳回',
  reminder: '催办',
};

export default function NotificationBizSwitchTab() {
  const qc = useQueryClient();

  const { data: switches, isLoading } = useQuery({
    queryKey: ['notification-switches'],
    queryFn: async () => {
      const res = await notificationSwitchApi.list();
      return res as unknown as NotificationBizSwitch[];
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: number }) =>
      notificationSwitchApi.updateEnabled(id, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-switches'] });
      toast.success('开关状态已更新');
    },
    onError: (err: any) => toast.error(err?.message || '更新失败'),
  });

  if (isLoading) return <div className="py-12 text-center text-[#94a3b8] text-sm">加载中...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>流程通知开关</CardTitle>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['notification-switches'] })}>
          <RefreshCw className="w-4 h-4" />刷新
        </Button>
      </CardHeader>
      <CardContent>
        {(!switches || switches.length === 0) ? (
          <div className="py-12 text-center text-[#94a3b8] text-sm">暂无流程开关配置</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">业务类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">事件</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">模板</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {switches.map((s: NotificationBizSwitch) => (
                  <tr key={s.id} className="hover:bg-[#f8fafc]">
                    <td className="px-4 py-3 text-[#374151]">{BIZ_TYPE_LABELS[s.bizType] || s.bizType}</td>
                    <td className="px-4 py-3 text-[#64748b]">{EVENT_LABELS[s.event] || s.event}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{s.templateCode || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${s.enabled === 1 ? 'bg-green-100 text-green-700' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>
                        {s.enabled === 1 ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: s.id, enabled: s.enabled === 1 ? 0 : 1 })}
                        disabled={toggleMut.isPending}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          s.enabled === 1
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}>
                        {s.enabled === 1 ? '停用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
