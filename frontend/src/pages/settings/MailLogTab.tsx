/**
 * @file pages/settings/MailLogTab.tsx
 * @description 邮件发送日志 Tab
 *
 * 功能：发送日志列表、失败摘要、失败重试、详情诊断
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Eye, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { mailLogApi } from '@/api/mailTemplate';
import type { MailLog, PageResponse } from '@/types/mailTemplate';
import { SEND_STATUS_LABELS, SEND_STATUS_COLORS } from '@/types/mailTemplate';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const DEFAULT_MAX_RETRY = 3;

export type MailLogStats = {
  total: number;
  failed: number;
  pending: number;
  success: number;
  retryable: number;
  exhausted: number;
};

export type MailLogEmptyState = {
  title: string;
  description: string;
};

// ─── 纯 helper，供运营规则测试复用 ───────────────────────────────────────────

export function canRetryMailLog(log: Pick<MailLog, 'sendStatus' | 'retryCount' | 'maxRetry'>) {
  const retryCount = log.retryCount ?? 0;
  const maxRetry = log.maxRetry ?? DEFAULT_MAX_RETRY;

  return log.sendStatus === 'FAILED' && maxRetry > 0 && retryCount < maxRetry;
}

export function getMailLogStats(records: Array<Pick<MailLog, 'sendStatus' | 'retryCount' | 'maxRetry'>>): MailLogStats {
  return records.reduce<MailLogStats>(
    (stats, log) => {
      const isFailed = log.sendStatus === 'FAILED';

      stats.total += 1;
      if (isFailed) stats.failed += 1;
      if (log.sendStatus === 'PENDING') stats.pending += 1;
      if (log.sendStatus === 'SUCCESS') stats.success += 1;
      if (canRetryMailLog(log)) stats.retryable += 1;
      if (isFailed && !canRetryMailLog(log)) stats.exhausted += 1;

      return stats;
    },
    { total: 0, failed: 0, pending: 0, success: 0, retryable: 0, exhausted: 0 },
  );
}

export function getMailLogEmptyState(input: boolean | { hasActiveFilters?: boolean }): MailLogEmptyState {
  const hasActiveFilters = typeof input === 'boolean' ? input : Boolean(input.hasActiveFilters);

  if (hasActiveFilters) {
    return {
      title: '没有匹配的邮件日志',
      description: '调整模板编码、状态或业务类型后再试。',
    };
  }

  return {
    title: '还没有邮件发送日志',
    description: '系统发送邮件后会在这里留下状态、错误和重试记录。',
  };
}

function getRetryProgress(log: Pick<MailLog, 'retryCount' | 'maxRetry'>) {
  return {
    retryCount: log.retryCount ?? 0,
    maxRetry: log.maxRetry ?? DEFAULT_MAX_RETRY,
  };
}

function getErrorMessage(error: Error | null) {
  return error?.message || '邮件发送日志加载失败，请稍后重试。';
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function MailLogTab() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [sendStatus, setSendStatus] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [bizType, setBizType] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    sendStatus: sendStatus || undefined,
    templateCode: templateCode.trim() || undefined,
    bizType: bizType.trim() || undefined,
  };

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PageResponse<MailLog>, Error>({
    queryKey: ['mail-logs', queryParams],
    queryFn: async () => {
      const res = await mailLogApi.list(queryParams);
      return res as unknown as PageResponse<MailLog>;
    },
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => mailLogApi.retry(id),
    onSuccess: () => {
      toast.success('已提交重试发送');
      qc.invalidateQueries({ queryKey: ['mail-logs'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '重试发送失败，请稍后再试');
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = Boolean(sendStatus || templateCode.trim() || bizType.trim());
  const stats = getMailLogStats(records);
  const emptyState = getMailLogEmptyState(hasActiveFilters);
  const detailRecord = detailId ? records.find(r => r.id === detailId) : null;
  const retryingId = retryMutation.isPending ? retryMutation.variables : undefined;

  const resetFilters = () => {
    setTemplateCode('');
    setSendStatus('');
    setBizType('');
    setPage(1);
  };

  const handleRetry = (log: MailLog) => {
    if (!canRetryMailLog(log) || retryMutation.isPending) return;
    retryMutation.mutate(log.id);
  };

  const renderRetryPolicy = (log: MailLog) => {
    const { retryCount, maxRetry } = getRetryProgress(log);

    if (log.sendStatus === 'FAILED') {
      if (canRetryMailLog(log)) {
        return (
          <div className="min-w-[120px] text-xs">
            <p className="font-medium text-red-700">可重试</p>
            <p className="mt-0.5 text-muted-foreground">{retryCount}/{maxRetry} 次，建议先核对错误信息</p>
          </div>
        );
      }

      return (
        <div className="min-w-[120px] text-xs">
          <p className="font-medium text-muted-foreground">已达上限</p>
          <p className="mt-0.5 text-muted-foreground">{retryCount}/{maxRetry} 次，需要人工排查</p>
        </div>
      );
    }

    if (log.sendStatus === 'PENDING') {
      return <span className="text-xs text-amber-700">等待发送队列处理</span>;
    }

    if (log.sendStatus === 'SUCCESS') {
      return <span className="text-xs text-green-700">已送达，无需重试</span>;
    }

    return <span className="text-xs text-muted-foreground">暂无策略</span>;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-wrap">
          <div className="min-w-0">
            <CardTitle>邮件发送日志</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">跟踪失败邮件、重试上限和当前页发送健康度</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {/* 运营摘要 */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                当前页
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{stats.total}</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                失败
              </div>
              <p className="mt-2 text-xl font-semibold text-red-700">{stats.failed}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Clock3 className="h-3.5 w-3.5" />
                待发送
              </div>
              <p className="mt-2 text-xl font-semibold text-amber-700">{stats.pending}</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-3">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                成功
              </div>
              <p className="mt-2 text-xl font-semibold text-green-700">{stats.success}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-xs text-blue-700">
                <RotateCcw className="h-3.5 w-3.5" />
                可重试
              </div>
              <p className="mt-2 text-xl font-semibold text-blue-700">{stats.retryable}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                已达上限
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-700">{stats.exhausted}</p>
            </div>
          </div>

          <div className={`mb-4 flex flex-col gap-2 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between ${stats.failed > 0 ? 'border-red-100 bg-red-50 text-red-800' : 'border-green-100 bg-green-50 text-green-800'}`}>
            <div className="flex min-w-0 items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">失败预检</p>
                <p className="mt-0.5 text-xs leading-5">
                  {stats.failed > 0
                    ? `当前页有 ${stats.failed} 条失败日志，${stats.retryable} 条可直接重试，${stats.exhausted} 条已达上限。`
                    : '当前页暂无失败日志，继续观察待发送队列即可。'}
                </p>
              </div>
            </div>
            {stats.retryable > 0 && <span className="text-xs font-medium">优先处理最近失败且未达上限的邮件。</span>}
          </div>

          {/* 过滤栏 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="模板编码"
                value={templateCode}
                onChange={e => { setTemplateCode(e.target.value); setPage(1); }}
                className="h-9 w-40 rounded-lg border border-border bg-white px-3 pl-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <select
              value={sendStatus}
              onChange={e => { setSendStatus(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">全部状态</option>
              <option value="PENDING">待发送</option>
              <option value="SUCCESS">发送成功</option>
              <option value="FAILED">发送失败</option>
            </select>
            <input
              type="text"
              placeholder="业务类型"
              value={bizType}
              onChange={e => { setBizType(e.target.value); setPage(1); }}
              className="h-9 w-32 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              清空
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
              <p className="mt-3 text-sm font-semibold text-red-700">日志加载失败</p>
              <p className="mx-auto mt-1 max-w-xl break-words text-xs leading-5 text-red-600">{getErrorMessage(error)}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                重试加载
              </Button>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-[#f8fafc] px-4 py-12 text-center">
              <p className="text-sm font-medium text-foreground">{emptyState.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
              {hasActiveFilters && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
                  清空筛选
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[#f8fafc]">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">收件人</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">主题</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">业务类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">发送时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">重试策略</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted">
                    {records.map(log => {
                      const rowRetrying = retryingId === log.id;
                      const retryable = canRetryMailLog(log);

                      return (
                        <tr key={log.id} className="hover:bg-muted">
                          <td className="max-w-[180px] truncate px-4 py-3 text-foreground" title={log.mailTo}>{log.mailTo}</td>
                          <td className="max-w-[240px] truncate px-4 py-3 text-foreground" title={log.subject}>{log.subject || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${SEND_STATUS_COLORS[log.sendStatus] || 'bg-muted text-muted-foreground'}`}>
                              {SEND_STATUS_LABELS[log.sendStatus] || log.sendStatus}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground" title={log.bizType}>{log.bizType || '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{log.sendTime || '—'}</td>
                          <td className="px-4 py-3">{renderRetryPolicy(log)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDetailId(log.id)}
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                                title="查看详情"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {retryable && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRetry(log)}
                                  loading={rowRetrying}
                                  disabled={retryMutation.isPending}
                                  className="h-7"
                                >
                                  {!rowRetrying && <RotateCcw className="h-3.5 w-3.5" />}
                                  {rowRetrying ? '重试中' : '重试发送'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {total > 0 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">共 {total} 条记录，第 {page}/{totalPages} 页</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                    <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 日志详情弹窗 */}
      {detailId && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[10px] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="min-w-0 text-base font-semibold text-foreground">邮件发送详情</h3>
              <button onClick={() => setDetailId(null)} className="text-lg leading-none text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0"><span className="text-muted-foreground">收件人：</span><span className="break-words text-foreground">{detailRecord.mailTo}</span></div>
                <div><span className="text-muted-foreground">状态：</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${SEND_STATUS_COLORS[detailRecord.sendStatus] || 'bg-muted text-muted-foreground'}`}>
                    {SEND_STATUS_LABELS[detailRecord.sendStatus] || detailRecord.sendStatus}
                  </span>
                </div>
                <div className="min-w-0"><span className="text-muted-foreground">模板编码：</span><span className="break-words text-foreground">{detailRecord.templateCode || '—'}</span></div>
                <div className="min-w-0"><span className="text-muted-foreground">业务类型：</span><span className="break-words text-foreground">{detailRecord.bizType || '—'}</span></div>
                <div><span className="text-muted-foreground">业务ID：</span><span className="text-foreground">{detailRecord.bizId || '—'}</span></div>
                <div><span className="text-muted-foreground">发送时间：</span><span className="text-foreground">{detailRecord.sendTime || '—'}</span></div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">重试次数：</span>
                  <span className="text-foreground">
                    {getRetryProgress(detailRecord).retryCount}/{getRetryProgress(detailRecord).maxRetry}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">邮件主题：</p>
                <p className="break-words rounded bg-[#f8fafc] p-2 text-foreground">{detailRecord.subject || '—'}</p>
              </div>

              {detailRecord.sendStatus === 'FAILED' && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    失败诊断
                  </div>
                  <p className="mt-2 break-words text-xs leading-5 text-red-700">
                    {detailRecord.errorMessage || '后端未返回错误明细，请结合邮件网关和业务单据继续排查。'}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-[#f8fafc] p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <RotateCcw className="h-4 w-4" />
                  重试策略
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {detailRecord.sendStatus === 'FAILED'
                    ? canRetryMailLog(detailRecord)
                      ? '该失败日志未达重试上限，可手动触发一次重试；提交后列表会刷新，新的失败原因以服务端返回为准。'
                      : '该失败日志已达重试上限，请先确认收件人、模板变量、邮件网关和业务状态后再人工处理。'
                    : '当前日志不是失败状态，不需要人工重试。'}
                </p>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">邮件内容（HTML）：</p>
                <div className="max-h-60 overflow-y-auto rounded bg-[#f8fafc] p-3">
                  <pre className="whitespace-pre-wrap break-all text-xs text-foreground">{detailRecord.content || '—'}</pre>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {canRetryMailLog(detailRecord) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(detailRecord)}
                  loading={retryingId === detailRecord.id}
                  disabled={retryMutation.isPending}
                >
                  {retryingId !== detailRecord.id && <RotateCcw className="h-4 w-4" />}
                  {retryingId === detailRecord.id ? '重试中' : '重试发送'}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
