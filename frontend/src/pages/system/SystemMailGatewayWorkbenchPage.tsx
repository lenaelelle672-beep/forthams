import { FormEvent, useEffect, useMemo, useState } from 'react';
import { mailGatewayApi } from '../../api/mailGateways';
import type { MailGateway, MailGatewayMeta, MailGatewayPage, MailGatewayPreviewResponse } from '../../api/mailGateways';

type SystemMailGatewayWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = 'metadata-only mail gateway catalog + dry-run preview；readOnly=true、tenantScoped=true、noPersistence=true、noSend=true、noNetwork=true、credentialExposed=false。';
const endpointCopy = '真实调用 /system/mail-gateways、/system/mail-gateways/{id}、/system/mail-gateways/meta 与 /system/mail-gateways/preview。';
const coverageCopy = '仅代表 system-mail-gateway 已接入真组件；不代表消息与通知组、邮件子系统或 Workbench V3 全量完成。';

const emptyPage: MailGatewayPage = {
  records: [],
  total: 0,
  page: 1,
  pageSize: 20,
  pages: 0,
  tenantScoped: true,
  readOnly: true,
  readonlyBoundary: boundaryCopy,
};

function display(value: string | number | boolean | undefined | null) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

export default function SystemMailGatewayWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemMailGatewayWorkbenchPageProps) {
  const [keyword, setKeyword] = useState('');
  const [tlsMode, setTlsMode] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ page: number; pageSize: number; keyword?: string; tlsMode?: string }>({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<MailGatewayPage>(emptyPage);
  const [selectedGateway, setSelectedGateway] = useState<MailGateway | null>(null);
  const [meta, setMeta] = useState<MailGatewayMeta | null>(null);
  const [previewResult, setPreviewResult] = useState<MailGatewayPreviewResponse | null>(null);
  const [previewHostMasked, setPreviewHostMasked] = useState('smtp.***.corp');
  const [previewSenderMasked, setPreviewSenderMasked] = useState('n***@c***');
  const [previewPort, setPreviewPort] = useState('587');
  const [previewTlsMode, setPreviewTlsMode] = useState('STARTTLS');
  const [previewAuthConfigured, setPreviewAuthConfigured] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [previewPriority, setPreviewPriority] = useState('10');
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
      mailGatewayApi.list(activeFilters),
      mailGatewayApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setMeta(metaResult);
        const first = listResult.records[0];
        if (!first) {
          setSelectedGateway(null);
          return;
        }
        const detail = await mailGatewayApi.getById(first.id);
        if (!ignored) {
          setSelectedGateway(detail);
          setPreviewHostMasked(detail.hostMasked || 'smtp.***.corp');
          setPreviewSenderMasked(detail.senderMasked || 'n***@c***');
          setPreviewPort(String(detail.port || 587));
          setPreviewTlsMode(detail.tlsMode || 'STARTTLS');
          setPreviewAuthConfigured(Boolean(detail.authConfigured));
          setPreviewEnabled(detail.enabled !== false);
          setPreviewPriority(String(detail.priority ?? 10));
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setSelectedGateway(null);
          setPreviewResult(null);
          setError('邮件网关只读目录加载失败，错误详情已脱敏');
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
  }, [activeFilters, canView]);

  const tlsOptions = useMemo(() => meta?.tlsModes ?? [], [meta]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      page: 1,
      pageSize: 20,
      keyword: keyword.trim() || undefined,
      tlsMode: tlsMode || undefined,
    });
  };

  const openGateway = async (gateway: MailGateway) => {
    try {
      setError(null);
      const detail = await mailGatewayApi.getById(gateway.id);
      setSelectedGateway(detail);
      setPreviewResult(null);
      setPreviewHostMasked(detail.hostMasked || 'smtp.***.corp');
      setPreviewSenderMasked(detail.senderMasked || 'n***@c***');
      setPreviewPort(String(detail.port || 587));
      setPreviewTlsMode(detail.tlsMode || 'STARTTLS');
      setPreviewAuthConfigured(Boolean(detail.authConfigured));
      setPreviewEnabled(detail.enabled !== false);
      setPreviewPriority(String(detail.priority ?? 10));
    } catch {
      setError('邮件网关脱敏详情读取失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const port = Number(previewPort);
    const priority = Number(previewPriority);
    try {
      setError(null);
      setPreviewResult(await mailGatewayApi.preview({
        gatewayCode: selectedGateway?.gatewayCode || 'smtp-main',
        gatewayName: selectedGateway?.gatewayName || '主邮件网关',
        hostMasked: previewHostMasked,
        senderMasked: previewSenderMasked,
        port: Number.isFinite(port) ? port : undefined,
        tlsMode: previewTlsMode,
        authConfigured: previewAuthConfigured,
        enabled: previewEnabled,
        priority: Number.isFinite(priority) ? priority : undefined,
      }));
    } catch {
      setError('邮件网关 dry-run preview 失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-mail-gateway="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问邮件网关 metadata-only catalog，请确认 system:mail-gateway:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-mail-gateway="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">邮件网关配置</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / no-send / no-network / no-secret</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 previewAccepted、configured、acceptedFields、rejectedInputs、tenantScoped、noPersistence、noSend、noNetwork、runtimeEffect=false、cacheRefreshed=false、credentialExposed=false、smtpConnect=false、javaMailSenderUsed=false、mailSenderProviderUsed=false 与 readonlyBoundary。</p>
        <p>{coverageCopy}</p>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="mail-gateway-keyword">邮件网关关键词</label>
        <input
          id="mail-gateway-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按编码、名称或脱敏元数据筛选"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="mail-gateway-tls-mode">TLS 模式</label>
        <select id="mail-gateway-tls-mode" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={tlsMode} onChange={(event) => setTlsMode(event.target.value)}>
          <option value="">全部 TLS 模式</option>
          {tlsOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">只读刷新</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">邮件网关 metadata-only catalog 加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="邮件网关只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">网关 catalog</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无可展示的邮件网关元数据；这不代表邮件子系统完成。</div> : null}
          <div className="space-y-2">
            {page.records.map((gateway) => (
              <button key={gateway.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openGateway(gateway)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{gateway.gatewayName}</span>
                  <span className="text-xs text-slate-500">{gateway.tlsMode} · priority={display(gateway.priority)}</span>
                </span>
                <span className="mt-1 block text-slate-600">{gateway.gatewayCode} · hostMasked={display(gateway.hostMasked)} · senderMasked={display(gateway.senderMasked)}</span>
                <span className="mt-1 block text-xs text-slate-500">port={display(gateway.port)} · authConfigured={display(gateway.authConfigured)} · enabled={display(gateway.enabled)} · lastTestStatus={display(gateway.lastTestStatus)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="邮件网关脱敏详情与预览">
          <h4 className="font-semibold">脱敏详情与 dry-run preview</h4>
          {selectedGateway ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="邮件网关脱敏详情">
              <p>网关：{selectedGateway.gatewayName}（{selectedGateway.gatewayCode}）</p>
              <p>hostMasked={display(selectedGateway.hostMasked)} · senderMasked={display(selectedGateway.senderMasked)}</p>
              <p>port={display(selectedGateway.port)} · tlsMode={display(selectedGateway.tlsMode)} · authConfigured={display(selectedGateway.authConfigured)}</p>
              <p>tenantScoped={display(selectedGateway.tenantScoped ?? true)} · readOnly={display(selectedGateway.readOnly ?? true)}</p>
            </div>
          ) : <p className="text-sm text-slate-500">请选择一条邮件网关元数据查看脱敏详情。</p>}

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="mail-gateway-host-masked">hostMasked</label>
            <input id="mail-gateway-host-masked" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewHostMasked} onChange={(event) => setPreviewHostMasked(event.target.value)} />
            <label className="block text-sm font-medium text-slate-700" htmlFor="mail-gateway-sender-masked">senderMasked</label>
            <input id="mail-gateway-sender-masked" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewSenderMasked} onChange={(event) => setPreviewSenderMasked(event.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="mail-gateway-port">port</label>
                <input id="mail-gateway-port" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewPort} onChange={(event) => setPreviewPort(event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="mail-gateway-preview-tls">tlsMode</label>
                <select id="mail-gateway-preview-tls" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewTlsMode} onChange={(event) => setPreviewTlsMode(event.target.value)}>
                  {(tlsOptions.length === 0 ? [{ value: 'STARTTLS', label: 'STARTTLS 元数据' }] : tlsOptions).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={previewAuthConfigured} onChange={(event) => setPreviewAuthConfigured(event.target.checked)} /> authConfigured
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} /> enabled
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="mail-gateway-priority">priority</label>
            <input id="mail-gateway-priority" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewPriority} onChange={(event) => setPreviewPriority(event.target.value)} />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行 dry-run preview</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="邮件网关预览结果">
              <p className="font-medium">previewAccepted={String(previewResult.previewAccepted)} · configured={String(previewResult.configured)}</p>
              <p>acceptedFields={previewResult.acceptedFields.join('、') || '无'} · rejectedInputs={previewResult.rejectedInputs.map((item) => item.field).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · noSend={String(previewResult.noSend)} · noNetwork={String(previewResult.noNetwork)} · runtimeEffect={String(previewResult.runtimeEffect)} · cacheRefreshed={String(previewResult.cacheRefreshed)} · credentialExposed={String(previewResult.credentialExposed)} · smtpConnect={String(previewResult.smtpConnect)} · javaMailSenderUsed={String(previewResult.javaMailSenderUsed)} · mailSenderProviderUsed={String(previewResult.mailSenderProviderUsed)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不连接网络、不改变运行时、不代表邮件子系统完成'}。
      </div>
    </section>
  );
}
