import { FormEvent, useEffect, useMemo, useState } from 'react';
import { notificationPreferenceApi } from '../../api/notificationTemplate';
import type {
  NotificationPreference,
  NotificationPreferenceMeta,
  NotificationPreferencePreviewResponse,
} from '../../types/notificationTemplate';

type SystemNotificationPreferencesWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '只读通知偏好目录 + 无持久化偏好决策预览；不保存偏好、不发送通知、不改变真实通知发送决策。';
const endpointCopy = '真实调用 /notification-preferences、/notification-preferences/{category}、/notification-preferences/meta 与 /notification-preferences/preview。';
const coverageCopy = '仅代表 system-notification-preferences 单模块候选；消息与通知组未全组完成，仍非 44/44，也不是 Workbench V3 全量完成。';

function optionLabel(meta: NotificationPreferenceMeta | null, category: string | undefined) {
  if (!category) {
    return '未选择';
  }
  return meta?.categories.find((item) => item.value === category)?.label ?? category;
}

export default function SystemNotificationPreferencesWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemNotificationPreferencesWorkbenchPageProps) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPreference, setSelectedPreference] = useState<NotificationPreference | null>(null);
  const [meta, setMeta] = useState<NotificationPreferenceMeta | null>(null);
  const [channelInput, setChannelInput] = useState<'ALL' | 'IN_APP' | 'EMAIL'>('ALL');
  const [sampleTime, setSampleTime] = useState('22:30');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:30');
  const [previewResult, setPreviewResult] = useState<NotificationPreferencePreviewResponse | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      notificationPreferenceApi.list(),
      notificationPreferenceApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPreferences(listResult);
        setMeta(metaResult);
        const firstCategory = listResult[0]?.category ?? metaResult.categories?.[0]?.value ?? '';
        setSelectedCategory(firstCategory);
        if (!firstCategory) {
          setSelectedPreference(null);
          return;
        }
        const detail = await notificationPreferenceApi.getByCategory(firstCategory);
        if (!ignored) {
          setSelectedPreference(detail);
          setQuietStart(detail.quietStart ?? quietStart);
          setQuietEnd(detail.quietEnd ?? quietEnd);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPreferences([]);
          setSelectedPreference(null);
          setPreviewResult(null);
          setError('通知偏好只读目录加载失败，错误详情已脱敏');
        }
      })
      .finally(() => {
        if (!ignored) {
          setLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [canView]);

  const categoryOptions = useMemo(() => meta?.categories ?? [], [meta]);
  const channelOptions = useMemo(() => meta?.channelTypes ?? [], [meta]);

  const loadCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCategory) {
      return;
    }
    setSubmitting(true);
    try {
      setError(null);
      const detail = await notificationPreferenceApi.getByCategory(selectedCategory);
      setSelectedPreference(detail);
      setQuietStart(detail.quietStart ?? quietStart);
      setQuietEnd(detail.quietEnd ?? quietEnd);
      setPreviewResult(null);
    } catch {
      setError('通知偏好分类读取失败，保留字、未知分类或错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      setPreviewResult(await notificationPreferenceApi.preview({
        category: selectedCategory || undefined,
        channelType: channelInput,
        sampleTime: sampleTime.trim() || undefined,
        quietStart: quietStart.trim() || undefined,
        quietEnd: quietEnd.trim() || undefined,
      }));
    } catch {
      setError('无持久化偏好决策预览失败，错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-notification-preferences="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问通知偏好只读目录，请确认 system:notification-preference:query 或 read 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-notification-preferences="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">通知偏好</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">{endpointCopy}</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / tenant-scoped / runtimeEffect=false</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 wouldReceive、inAppEnabled、emailEnabled、quietWindowMatched、missingPreferences、rejectedInputs、tenantScoped、noPersistence 与 runtimeEffect=false。</p>
        <p>{coverageCopy}</p>
      </div>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">通知偏好只读目录加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="通知偏好只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">偏好 catalog</h4>
            <span className="text-xs text-slate-500">显示 {preferences.length} 条，只读展示</span>
          </div>
          {preferences.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无通知偏好。</h3> : null}
          <div className="space-y-2">
            {preferences.map((preference) => (
              <button
                key={preference.category}
                type="button"
                className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  setSelectedCategory(preference.category);
                  setSelectedPreference(preference);
                  setPreviewResult(null);
                }}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{preference.categoryLabel ?? optionLabel(meta, preference.category)}</span>
                  <span className="text-xs text-slate-500">{preference.category}</span>
                </span>
                <span className="mt-1 block text-slate-600">站内信：{preference.inApp === 1 ? '启用' : '停用'} · 邮件：{preference.email === 1 ? '启用' : '停用'}</span>
                <span className="mt-1 block text-xs text-slate-500">免打扰：{preference.quietStart ?? '未设'} - {preference.quietEnd ?? '未设'}；missingPreference={String(preference.missingPreference ?? false)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="通知偏好详情与预览">
          <h4 className="font-semibold">分类详情与 no-persistence preview</h4>
          <form className="space-y-3" onSubmit={loadCategory}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-preference-category">通知偏好分类</label>
            <div className="flex gap-2">
              <select
                id="notification-preference-category"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="">请选择分类</option>
                {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="submit" disabled={submitting} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">读取分类</button>
            </div>
          </form>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="通知偏好分类详情">
            当前分类：{optionLabel(meta, selectedPreference?.category ?? selectedCategory)}；站内信={selectedPreference?.inApp ?? '-'}；邮件={selectedPreference?.email ?? '-'}；只读，无运行时改动。
          </div>

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-preference-preview-channel">预览渠道</label>
            <select id="notification-preference-preview-channel" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={channelInput} onChange={(event) => setChannelInput(event.target.value as 'ALL' | 'IN_APP' | 'EMAIL')}>
              {channelOptions.length === 0 ? <option value="ALL">全部渠道</option> : channelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-preference-preview-time">样例时间</label>
            <input id="notification-preference-preview-time" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sampleTime} onChange={(event) => setSampleTime(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="notification-preference-quiet-start">免打扰开始
                <input id="notification-preference-quiet-start" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} />
              </label>
              <label className="text-sm font-medium text-slate-700" htmlFor="notification-preference-quiet-end">免打扰结束
                <input id="notification-preference-quiet-end" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} />
              </label>
            </div>
            <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化偏好预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="通知偏好预览结果">
              <p className="font-medium">wouldReceive={String(previewResult.wouldReceive)} · quietWindowMatched={String(previewResult.quietWindowMatched)}</p>
              <p>inAppEnabled={String(previewResult.inAppEnabled)} · emailEnabled={String(previewResult.emailEnabled)}</p>
              <p>missingPreferences：{previewResult.missingPreferences.join('、') || '无'}</p>
              <p>rejectedInputs：{previewResult.rejectedInputs.map((item) => `${item.field}:${item.reason}`).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · runtimeEffect={String(previewResult.runtimeEffect)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；保留分类词：{meta?.reservedCategoryWords?.join('、') ?? 'meta、preview、batch、user、users、id'}；nonGoals：{meta?.nonGoals?.join('、') ?? '不保存偏好、不发送通知、不改变真实通知发送决策'}。
      </div>
    </section>
  );
}
