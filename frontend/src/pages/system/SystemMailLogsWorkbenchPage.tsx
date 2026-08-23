import { FormEvent, useEffect, useMemo, useState } from 'react';
import { mailLogApi } from '../../api/mailTemplate';
import type { MailLog, MailLogMeta, PageResponse } from '../../types/mailTemplate';

type SystemMailLogsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '邮件日志仅 read-only catalog/detail/biz/meta；redacted=true，tenantScoped=true，no retry/export/send，不保证日志采集链路，不代表邮件子系统完成。';
const endpointCopy = '真实调用 /mail-logs/list、/mail-logs/{id}、/mail-logs/biz 与 /mail-logs/meta；页面不触发重试、导出、发送、SMTP/mail gateway、workflow mail 或 notification pipeline。';
const redactionCopy = '收件人、抄送、密送、发件人、主题、正文、错误、供应商标识、请求标识、头信息与载荷只展示掩码或诊断摘要。';

const emptyPage: PageResponse<MailLog> = { records: [], total: 0, size: 20, current: 1, pages: 0, redacted: true, readOnly: true, tenantScoped: true };

function display(value: string | number | undefined | null) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

export default function SystemMailLogsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemMailLogsWorkbenchPageProps) {
  const [templateCodeInput, setTemplateCodeInput] = useState('');
  const [sendStatusInput, setSendStatusInput] = useState('');
  const [bizTypeInput, setBizTypeInput] = useState('');
  const [bizIdInput, setBizIdInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ page: number; pageSize: number; templateCode?: string; sendStatus?: string; bizType?: string; bizId?: number }>({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<PageResponse<MailLog>>(emptyPage);
  const [selectedLog, setSelectedLog] = useState<MailLog | null>(null);
  const [bizLogs, setBizLogs] = useState<MailLog[]>([]);
  const [meta, setMeta] = useState<MailLogMeta | null>(null);
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
      mailLogApi.list(activeFilters),
      mailLogApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setMeta(metaResult);
        const first = listResult.records[0];
        if (!first) {
          setSelectedLog(null);
          setBizLogs([]);
          return;
        }
        const [detail, related] = await Promise.all([
          mailLogApi.getById(first.id),
          first.bizType && first.bizId ? mailLogApi.getByBiz(first.bizType, first.bizId) : Promise.resolve([]),
        ]);
        if (!ignored) {
          setSelectedLog(detail);
          setBizLogs(related);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setSelectedLog(null);
          setBizLogs([]);
          setError('邮件日志只读 catalog 加载失败，错误详情已脱敏');
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

  const sendStatusOptions = useMemo(() => meta?.sendStatuses ?? [], [meta]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bizId = Number(bizIdInput);
    setActiveFilters({
      page: 1,
      pageSize: 20,
      templateCode: templateCodeInput.trim() || undefined,
      sendStatus: sendStatusInput || undefined,
      bizType: bizTypeInput.trim() || undefined,
      bizId: Number.isFinite(bizId) && bizId > 0 ? bizId : undefined,
    });
  };

  const openLog = async (log: MailLog) => {
    try {
      setError(null);
      const [detail, related] = await Promise.all([
        mailLogApi.getById(log.id),
        log.bizType && log.bizId ? mailLogApi.getByBiz(log.bizType, log.bizId) : Promise.resolve([]),
      ]);
      setSelectedLog(detail);
      setBizLogs(related);
    } catch {
      setError('邮件日志详情加载失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-mail-logs="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问邮件日志 read-only catalog，请确认 system:mail-log:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-mail-logs="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">邮件日志</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / redacted / tenantScoped</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>{redactionCopy}</p>
        <p>仍非 44/44，不代表 Workbench V3 全量完成；消息与通知组未全组完成。</p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_140px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="mail-log-template-code">邮件日志模板编码</label>
        <input
          id="mail-log-template-code"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="模板编码"
          value={templateCodeInput}
          onChange={(event) => setTemplateCodeInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="mail-log-status">邮件日志状态</label>
        <select id="mail-log-status" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sendStatusInput} onChange={(event) => setSendStatusInput(event.target.value)}>
          <option value="">全部状态</option>
          {sendStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="mail-log-biz-type">邮件日志业务类型</label>
        <input
          id="mail-log-biz-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="业务类型"
          value={bizTypeInput}
          onChange={(event) => setBizTypeInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="mail-log-biz-id">邮件日志业务 ID</label>
        <input
          id="mail-log-biz-id"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="业务 ID"
          value={bizIdInput}
          onChange={(event) => setBizIdInput(event.target.value)}
        />
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">邮件日志加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="邮件日志列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">日志 catalog</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无可展示的邮件日志；这不代表日志采集链路已完成。</h3> : null}
          <div className="space-y-2">
            {page.records.map((log) => (
              <button key={log.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openLog(log)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{display(log.templateCode)}</span>
                  <span className="text-xs text-slate-500">{display(log.sendStatus)}</span>
                </span>
                <span className="mt-1 block text-slate-600">收件人：{display(log.maskedMailTo)} · 主题：{display(log.maskedSubject)}</span>
                <span className="mt-1 block text-xs text-slate-500">业务：{display(log.bizType)} #{display(log.bizId)} · redacted={String(log.redacted ?? true)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="邮件日志脱敏详情">
          <h4 className="font-semibold">脱敏详情与业务关联</h4>
          {selectedLog ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>日志 ID：{selectedLog.id}</p>
              <p>模板编码：{display(selectedLog.templateCode)}</p>
              <p>收件人掩码：{display(selectedLog.maskedMailTo)}</p>
              <p>发件人掩码：{display(selectedLog.maskedMailFrom)}</p>
              <p>主题摘要：{display(selectedLog.maskedSubject)}</p>
              <p>正文摘要：{display(selectedLog.maskedBodySummary)}</p>
              <p>诊断摘要：{display(selectedLog.diagnosticSummary)}</p>
              <p>只读边界：{selectedLog.readonlyBoundary ?? boundaryCopy}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一条日志查看脱敏详情。</h3>}

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="邮件日志业务查询结果">
            <p className="font-medium">biz lookup 结果</p>
            <p className="mt-1 text-xs text-slate-500">仅调用 /mail-logs/biz 获取同业务下的脱敏日志，不进行重试、重发、导出或发送。</p>
            <ul className="mt-3 space-y-2">
              {bizLogs.map((log) => (
                <li key={log.id} className="rounded-xl bg-white px-3 py-2">
                  #{log.id} · {display(log.sendStatus)} · {display(log.maskedMailTo)} · {display(log.diagnosticSummary)}
                </li>
              ))}
              {bizLogs.length === 0 ? <li className="text-slate-500">暂无业务关联日志。</li> : null}
            </ul>
          </div>
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；redactionPolicy：{meta?.redactionPolicy?.join('、') ?? redactionCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? 'no retry/export/send，no collection guarantee，not mail subsystem complete'}。
      </div>
    </section>
  );
}
