import { FormEvent, useEffect, useMemo, useState } from 'react';
import { channelConfigApi, CHANNEL_TYPE_LABELS } from '../../api/channelConfig';
import type {
  ChannelConfig,
  ChannelConfigMeta,
  ChannelConfigPreviewResponse,
} from '../../api/channelConfig';

type SystemNotificationChannelsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '只读通知渠道目录 + 无持久化、无发送、无外联脱敏预览；不保存渠道、不发送测试消息、不调用外部 webhook。';
const endpointCopy = '真实调用 /system/channel-configs、/system/channel-configs/{id}、/system/channel-configs/meta 与 /system/channel-configs/preview。';
const coverageCopy = '仅代表 system-notification-channels 单模块候选；消息与通知组未全组完成，仍非 44/44，也不是 Workbench V3 全量完成。';

function channelLabel(meta: ChannelConfigMeta | null, channelType: string | undefined) {
  if (!channelType) {
    return '未选择';
  }
  return meta?.channelTypes.find((item) => item.value === channelType)?.label ?? CHANNEL_TYPE_LABELS[channelType] ?? channelType;
}

export default function SystemNotificationChannelsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemNotificationChannelsWorkbenchPageProps) {
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ChannelConfig | null>(null);
  const [meta, setMeta] = useState<ChannelConfigMeta | null>(null);
  const [channelType, setChannelType] = useState('DINGTALK');
  const [configName, setConfigName] = useState('只读渠道预览');
  const [webhookConfigured, setWebhookConfigured] = useState(true);
  const [signatureConfigured, setSignatureConfigured] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [sampleEndpoint, setSampleEndpoint] = useState('/robot/send');
  const [previewResult, setPreviewResult] = useState<ChannelConfigPreviewResponse | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      channelConfigApi.list({ page: 1, pageSize: 20 }),
      channelConfigApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        const records = listResult.records ?? [];
        setConfigs(records);
        setMeta(metaResult);
        const first = records[0];
        setChannelType(first?.channelType ?? metaResult.channelTypes?.[0]?.value ?? 'DINGTALK');
        setConfigName(first?.configName ?? '只读渠道预览');
        setWebhookConfigured(Boolean(first?.webhookUrlConfigured ?? true));
        setSignatureConfigured(Boolean(first?.signatureConfigured ?? false));
        setEnabled((first?.enabled ?? 1) === 1);
        if (!first?.id) {
          setSelectedId(null);
          setSelectedConfig(null);
          return;
        }
        setSelectedId(first.id);
        const detail = await channelConfigApi.getById(first.id);
        if (!ignored) {
          setSelectedConfig(detail);
        }
      })
      .catch(() => {
        if (!ignored) {
          setConfigs([]);
          setSelectedId(null);
          setSelectedConfig(null);
          setPreviewResult(null);
          setError('通知渠道只读目录加载失败，错误详情已脱敏');
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

  const channelOptions = useMemo(() => meta?.channelTypes ?? [], [meta]);

  const loadDetail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) {
      return;
    }
    try {
      setError(null);
      const detail = await channelConfigApi.getById(selectedId);
      setSelectedConfig(detail);
      setChannelType(detail.channelType);
      setConfigName(detail.configName);
      setWebhookConfigured(Boolean(detail.webhookUrlConfigured));
      setSignatureConfigured(Boolean(detail.signatureConfigured));
      setEnabled(detail.enabled === 1);
      setPreviewResult(null);
    } catch {
      setError('通知渠道详情读取失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPreviewResult(await channelConfigApi.preview({
        channelType,
        configName: configName.trim() || undefined,
        webhookUrlConfigured: webhookConfigured,
        signatureConfigured,
        enabled: enabled ? 1 : 0,
        sampleEndpoint: sampleEndpoint.trim() || undefined,
      }));
    } catch {
      setError('无持久化、无发送渠道预览失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-notification-channels="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问通知渠道只读目录，请确认 system:notification-channel:query 或 read 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-notification-channels="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">通知渠道</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / tenantScoped=true / noSend=true</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 configured、webhookUrlMasked、webhookUrlConfigured、signatureConfigured、sampleEndpointAccepted、rejectedInputs、tenantScoped、noPersistence、noSend 与 runtimeEffect=false。</p>
        <p>{coverageCopy}</p>
      </div>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">通知渠道只读目录加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="通知渠道只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">渠道 catalog</h4>
            <span className="text-xs text-slate-500">显示 {configs.length} 条，只读展示</span>
          </div>
          {configs.length === 0 && !loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无通知渠道配置；空态不代表真实发送链闭环。</div> : null}
          <div className="space-y-2">
            {configs.map((config) => (
              <button
                key={config.id}
                type="button"
                className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  setSelectedId(config.id);
                  setSelectedConfig(config);
                  setChannelType(config.channelType);
                  setConfigName(config.configName);
                  setWebhookConfigured(Boolean(config.webhookUrlConfigured));
                  setSignatureConfigured(Boolean(config.signatureConfigured));
                  setEnabled(config.enabled === 1);
                  setPreviewResult(null);
                }}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{config.configName}</span>
                  <span className="text-xs text-slate-500">{channelLabel(meta, config.channelType)}</span>
                </span>
                <span className="mt-1 block text-slate-600">掩码地址：{config.webhookUrlMasked ?? '未配置'} · 签名状态：{config.signatureConfigured ? '已配置' : '未配置'}</span>
                <span className="mt-1 block text-xs text-slate-500">enabled={config.enabled}；tenantScoped={String(config.tenantScoped ?? true)}；只读展示。</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="通知渠道详情与预览">
          <h4 className="font-semibold">渠道详情与 no-send preview</h4>
          <form className="space-y-3" onSubmit={loadDetail}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-channel-id">通知渠道配置</label>
            <div className="flex gap-2">
              <select
                id="notification-channel-id"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">请选择配置</option>
                {configs.map((config) => <option key={config.id} value={config.id}>{config.configName}</option>)}
              </select>
              <button type="submit" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">读取详情</button>
            </div>
          </form>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="通知渠道脱敏详情">
            当前渠道：{channelLabel(meta, selectedConfig?.channelType ?? channelType)}；掩码地址={selectedConfig?.webhookUrlMasked ?? '未配置'}；不会显示或保存原始地址、签名材料、请求头或消息体。
          </div>

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-channel-preview-type">预览渠道类型</label>
            <select id="notification-channel-preview-type" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={channelType} onChange={(event) => setChannelType(event.target.value)}>
              {channelOptions.length === 0 ? <option value="DINGTALK">钉钉</option> : channelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-channel-config-name">配置名称</label>
            <input id="notification-channel-config-name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={configName} onChange={(event) => setConfigName(event.target.value)} />
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-channel-sample-endpoint">样例相对路径</label>
            <input id="notification-channel-sample-endpoint" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sampleEndpoint} onChange={(event) => setSampleEndpoint(event.target.value)} />
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={webhookConfigured} onChange={(event) => setWebhookConfigured(event.target.checked)} />地址已配置</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={signatureConfigured} onChange={(event) => setSignatureConfigured(event.target.checked)} />签名已配置</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />启用状态</label>
            </div>
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化渠道预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="通知渠道预览结果">
              <p className="font-medium">configured={String(previewResult.configured)} · previewAccepted={String(previewResult.previewAccepted)}</p>
              <p>webhookUrlMasked={previewResult.webhookUrlMasked} · webhookUrlConfigured={String(previewResult.webhookUrlConfigured)} · signatureConfigured={String(previewResult.signatureConfigured)}</p>
              <p>sampleEndpointAccepted={String(previewResult.sampleEndpointAccepted)}</p>
              <p>rejectedInputs：{previewResult.rejectedInputs.map((item) => `${item.field}:${item.reason}`).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · noSend={String(previewResult.noSend)} · runtimeEffect={String(previewResult.runtimeEffect)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不创建渠道、不更新渠道、不删除渠道、不发送测试消息、不调用外部 webhook'}。
      </div>
    </section>
  );
}
