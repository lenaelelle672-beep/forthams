/**
 * @file pages/settings/NotificationPreferenceTab.tsx
 * @description 通知偏好设置 Tab
 *
 * 功能：按分类配置站内信/邮件渠道开关、免打扰时段
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notificationPreferenceApi } from '@/api/notificationTemplate';
import type { NotificationPreference } from '@/types/notificationTemplate';
import { NOTIFICATION_CATEGORIES } from '@/types/notificationTemplate';

// ─── 分类默认偏好 ──────────────────────────────────────────────────────────────

const ALL_CATEGORIES = ['retirement', 'maintenance', 'approval', 'system'];

function createDefaultPref(category: string): NotificationPreference {
  return {
    category,
    inApp: 1,
    email: 1,
    quietStart: '',
    quietEnd: '',
  };
}

// ─── Toggle 开关组件 ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-[#3b82f6]' : 'bg-[#e5e7eb]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function NotificationPreferenceTab() {
  const qc = useQueryClient();

  const [preferences, setPreferences] = useState<NotificationPreference[]>(() =>
    ALL_CATEGORIES.map(createDefaultPref)
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── 查询 ─────────────────────────────────────────────────────────────────
  const { data: remotePrefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationPreferenceApi.list(),
  });

  // 同步远程数据
  React.useEffect(() => {
    if (remotePrefs && Array.isArray(remotePrefs)) {
      const merged = ALL_CATEGORIES.map(cat => {
        const remote = remotePrefs.find(p => p.category === cat);
        return remote || createDefaultPref(cat);
      });
      setPreferences(merged);
    }
  }, [remotePrefs]);

  // ── 保存 ─────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (data: NotificationPreference[]) => notificationPreferenceApi.batchSave(data),
    onSuccess: () => {
      toast.success('通知偏好已保存');
      qc.invalidateQueries({ queryKey: ['notification-preferences'] });
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: any) => toast.error(err?.message || '保存失败'),
  });

  // ── 事件处理 ──────────────────────────────────────────────────────────────

  const updatePref = (index: number, field: keyof NotificationPreference, value: any) => {
    setPreferences(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMut.mutate(preferences);
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知偏好设置</CardTitle>
        <p className="text-xs text-[#94a3b8] mt-1">
          分别控制各类通知的站内信和邮件接收开关，以及免打扰时段
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {preferences.map((pref, index) => (
            <div
              key={pref.category}
              className="border border-[#e5e7eb] rounded-lg p-4 hover:border-[#d0d5dd] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  {NOTIFICATION_CATEGORIES[pref.category] || pref.category}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#374151]">站内信通知</p>
                    <p className="text-xs text-[#94a3b8]">在系统内收到通知消息</p>
                  </div>
                  <Toggle
                    checked={pref.inApp === 1}
                    onChange={v => updatePref(index, 'inApp', v ? 1 : 0)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#374151]">邮件通知</p>
                    <p className="text-xs text-[#94a3b8]">发送通知到注册邮箱</p>
                  </div>
                  <Toggle
                    checked={pref.email === 1}
                    onChange={v => updatePref(index, 'email', v ? 1 : 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <Input
                  label="免打扰开始"
                  placeholder="如 22:00"
                  value={pref.quietStart || ''}
                  onChange={e => updatePref(index, 'quietStart', e.target.value)}
                />
                <Input
                  label="免打扰结束"
                  placeholder="如 08:00"
                  value={pref.quietEnd || ''}
                  onChange={e => updatePref(index, 'quietEnd', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saveMut.isPending}
            disabled={!hasChanges}
          >
            <Save className="w-4 h-4" />
            {saved ? '已保存' : '保存偏好设置'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
