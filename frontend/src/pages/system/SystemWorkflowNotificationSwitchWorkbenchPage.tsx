import { FormEvent, useEffect, useMemo, useState } from 'react';
import { notificationSwitchApi } from '../../api/notificationTemplate';
import type {
  NotificationBizSwitch,
  NotificationBizSwitchMeta,
  NotificationBizSwitchPreviewResponse,
} from '../../types/notificationTemplate';

type SystemWorkflowNotificationSwitchWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = 'read-only notification switch catalog + no-persistence preview + no-send preview；workflowRuntimeEffect=false；不写库、不发送通知、不改变流程运行时。';
const endpointCopy = '真实调用 /notification-switches/list、/notification-switches/biz-type/{bizType}、/notification-switches/meta 与 /notification-switches/preview。';
const coverageCopy = '仅代表 system-workflow-notification-switch 单模块候选；not flow-platform acceptance，not message-notification group completion，not Workbench V3 full completion，消息与通知组未全组完成，仍非 44/44。';

function optionLabel(meta: NotificationBizSwitchMeta | null, options: 'bizTypes' | 'events' | 'channelTypes', value: string | undefined) {
  if (!value) {
    return '未选择';
  }
  return meta?.[options]?.find((item) => item.value === value)?.label ?? value;
}

export default function SystemWorkflowNotificationSwitchWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemWorkflowNotificationSwitchWorkbenchPageProps) {
  const [switches, setSwitches] = useState<NotificationBizSwitch[]>([]);
  const [bizType, setBizType] = useState('maintenance');
  const [event, setEvent] = useState('approved');
  const [channelType, setChannelType] = useState('IN_APP');
  const [enabled, setEnabled] = useState(1);
  const [meta, setMeta] = useState<NotificationBizSwitchMeta | null>(null);
  const [bizTypeSwitches, setBizTypeSwitches] = useState<NotificationBizSwitch[]>([]);
  const [previewResult, setPreviewResult] = useState<NotificationBizSwitchPreviewResponse | null>(null);
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
      notificationSwitchApi.list(),
      notificationSwitchApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setSwitches(listResult);
        setMeta(metaResult);
        const first = listResult[0];
        const nextBizType = first?.bizType ?? metaResult.bizTypes?.[0]?.value ?? 'maintenance';
        setBizType(nextBizType);
        setEvent(first?.event ?? metaResult.events?.[0]?.value ?? 'approved');
        setChannelType(first?.channelType ?? metaResult.channelTypes?.[0]?.value ?? 'IN_APP');
        setEnabled(first?.enabled ?? 1);
        if (!nextBizType) {
          setBizTypeSwitches([]);
          return;
        }
        const byBizType = await notificationSwitchApi.getByBizType(nextBizType);
        if (!ignored) {
          setBizTypeSwitches(byBizType);
        }
      })
      .catch(() => {
        if (!ignored) {
          setSwitches([]);
          setBizTypeSwitches([]);
          setPreviewResult(null);
          setError('流程通知开关只读目录加载失败，错误详情已脱敏');
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

  const bizTypeOptions = useMemo(() => meta?.bizTypes ?? [], [meta]);
  const eventOptions = useMemo(() => meta?.events ?? [], [meta]);
  const channelOptions = useMemo(() => meta?.channelTypes ?? [], [meta]);

  const loadBizType = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!bizType) {
      return;
    }
    setSubmitting(true);
    try {
      setError(null);
      setBizTypeSwitches(await notificationSwitchApi.getByBizType(bizType));
      setPreviewResult(null);
    } catch {
      setError('业务类型通知开关读取失败，错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  const runPreview = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setSubmitting(true);
    try {
      setError(null);
      setPreviewResult(await notificationSwitchApi.preview({
        bizType: bizType || undefined,
        event: event || undefined,
        channelType: channelType || undefined,
        enabled,
      }));
    } catch {
      setError('无持久化、无发送、无流程运行时影响预览失败，错误详情已脱敏');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-workflow-notification-switch="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问流程通知开关只读目录，请确认 system:notification-switch:query 或 read 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-workflow-notification-switch="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">流程通知开关</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / tenantScoped=true / workflowRuntimeEffect=false</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 wouldNotify、blockedBySwitch、matchedSwitches、missingSwitches、rejectedInputs、tenantScoped、noPersistence、noSend、workflowRuntimeEffect=false 与 readonlyBoundary。</p>
        <p>{coverageCopy}</p>
      </div>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">流程通知开关只读目录加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="流程通知开关只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">通知开关 catalog</h4>
            <span className="text-xs text-slate-500">显示 {switches.length} 条，只读展示</span>
          </div>
          {switches.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无流程通知开关；空态不代表通知发送链或流程平台闭环。</h3> : null}
          <div className="space-y-2">
            {switches.map((item) => (
              <button
                key={`${item.bizType}-${item.event}-${item.channelType ?? 'ALL'}-${item.id}`}
                type="button"
                className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  setBizType(item.bizType);
                  setEvent(item.event);
                  setChannelType(item.channelType ?? 'ALL');
                  setEnabled(item.enabled);
                  setPreviewResult(null);
                }}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{optionLabel(meta, 'bizTypes', item.bizType)} / {optionLabel(meta, 'events', item.event)}</span>
                  <span className="text-xs text-slate-500">{optionLabel(meta, 'channelTypes', item.channelType ?? 'ALL')}</span>
                </span>
                <span className="mt-1 block text-slate-600">enabled={item.enabled} · templateCode={item.templateCode ?? '未绑定'} · tenantScoped={String(item.tenantScoped ?? true)}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.description ?? '只读展示，不执行启停 mutation。'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="流程通知开关详情与预览">
          <h4 className="font-semibold">业务类型查询与 no-persistence preview</h4>
          <form className="space-y-3" onSubmit={loadBizType}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-switch-biz-type">业务类型</label>
            <div className="flex gap-2">
              <select
                id="notification-switch-biz-type"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={bizType}
                onChange={(eventValue) => setBizType(eventValue.target.value)}
              >
                <option value="">请选择业务类型</option>
                {bizTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="submit" disabled={submitting} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">读取业务类型</button>
            </div>
          </form>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="流程通知开关业务类型详情">
            当前业务类型：{optionLabel(meta, 'bizTypes', bizType)}；匹配 {bizTypeSwitches.length} 条；只读，不执行启停、不发送通知、不触发流程运行时。
          </div>

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-switch-event">事件</label>
            <select id="notification-switch-event" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={event} onChange={(eventValue) => setEvent(eventValue.target.value)}>
              {eventOptions.length === 0 ? <option value="approved">通过</option> : eventOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-switch-channel">渠道</label>
            <select id="notification-switch-channel" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={channelType} onChange={(eventValue) => setChannelType(eventValue.target.value)}>
              {channelOptions.length === 0 ? <option value="IN_APP">站内信</option> : channelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-switch-enabled">样例启停状态</label>
            <select id="notification-switch-enabled" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={enabled} onChange={(eventValue) => setEnabled(Number(eventValue.target.value))}>
              <option value={1}>启用样例</option>
              <option value={0}>停用样例</option>
            </select>
            <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化通知开关预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="流程通知开关预览结果">
              <p className="font-medium">wouldNotify={String(previewResult.wouldNotify)} · blockedBySwitch={String(previewResult.blockedBySwitch)}</p>
              <p>matchedSwitches={previewResult.matchedSwitches.length} · missingSwitches：{previewResult.missingSwitches.join('、') || '无'}</p>
              <p>rejectedInputs：{previewResult.rejectedInputs.map((item) => `${item.field}:${item.reason}`).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · noSend={String(previewResult.noSend)} · workflowRuntimeEffect={String(previewResult.workflowRuntimeEffect)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不启停开关、不发送通知、不接入流程运行时、不写消息中心或发送队列'}。
      </div>
    </section>
  );
}
