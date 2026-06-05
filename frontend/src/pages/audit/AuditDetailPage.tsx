import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Calendar,
  Globe,
  Info,
  Wrench,
  Code2,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAuditLogDetail } from '@/api/audit';
import type { AuditLog } from '@/api/audit';
import type { ApiResponse } from '@/types/common';
import { Skeleton } from '@/components/ui/Skeleton';

interface TimelineEntry {
  time: string;
  description: string;
  isCurrent?: boolean;
}

interface OperationContext {
  method: string;
  path: string;
  userAgent: string;
  requestId: string;
  sessionId: string;
  tenantId: string;
}

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logId = Number(id);

  const { data: res, isLoading } = useQuery({
    queryKey: ['audit-logs', 'detail', logId],
    queryFn: () => getAuditLogDetail(logId),
    enabled: !!logId,
    staleTime: 1000 * 60 * 5,
  });

  const log = res as AuditLog | undefined;
  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#424753]">未找到该审计记录</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/audit')}>
          返回审计日志
        </Button>
      </div>
    );
  }

  const buildTimelineFromLog = (log: AuditLog): TimelineEntry[] => {
    const timeStr = log.createdAt?.substring(11, 19) || '—';

    // If backend returns a timeline array, use it directly
    if ('timeline' in log && Array.isArray(log.timeline)) {
      return log.timeline as TimelineEntry[];
    }

    const changes = log.changes || [];
    const entries: TimelineEntry[] = [];

    // Build an entry for each field change
    changes.forEach((change, index) => {
      const fieldDisplay = change.fieldLabel || change.field;
      const isLast = index === changes.length - 1;
      entries.push({
        time: timeStr,
        description: `${log.operatorName} 将 ${fieldDisplay} 从 "${change.oldValue || '—'}" 变更为 "${change.newValue || '—'}"`,
        isCurrent: isLast,
      });
    });

    // If no changes, create a single entry from the operation itself
    if (entries.length === 0) {
      entries.push({
        time: timeStr,
        description: `${log.operatorName} 执行了 ${log.operationType} 操作${log.description ? `：${log.description}` : ''}`,
        isCurrent: true,
      });
    }

    return entries;
  };

  const timeline: TimelineEntry[] = buildTimelineFromLog(log);

  const context: OperationContext = {
    method: log.httpMethod ?? '—',
    path: `/api/assets/${log.resourceId || '—'}`,
    userAgent: log.userAgent ?? '—',
    requestId: `REQ-${logId}`,
    sessionId: `SESS-${log.operatorId || '—'}`,
    tenantId: log.tenantId ?? '—',
  };

  const relatedChanges = (log.changes || []).map((c) => ({
    assetCode: log.resourceId || '—',
    assetName: log.description?.split('(')[0] || '—',
    field: c.fieldLabel || c.field,
    oldValue: c.oldValue || '—',
    newValue: c.newValue || '—',
    time: log.createdAt?.substring(11, 19) || '—',
  }));

  const primaryChange = log.changes?.[0];

  return (
    <div className="p-8">
      <PageHeader
        title="审计日志详情"
        breadcrumbs={[
          { label: '审计日志', href: '/audit' },
          { label: `#${logId}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回列表
            </Button>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => {
              const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit-log-${logId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4" />
              导出日志
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 border border-[#e5e7eb] rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] mb-2 uppercase">
            操作类型
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-[#dbeafe] text-[#2563eb] text-xs font-bold px-2 py-1 rounded border border-[#2563eb]/10">
              {log.operationType}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 border border-[#e5e7eb] rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] mb-2 uppercase">
            操作人
          </p>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#004191]">
                {(log.operatorName || '?')[0]}
              </span>
            </div>
            <span className="text-base font-semibold leading-6 text-[#161c27]">
              {log.operatorName || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 border border-[#e5e7eb] rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] mb-2 uppercase">
            操作时间
          </p>
          <div className="flex items-center gap-2">
            <Calendar className="w-[18px] h-[18px] text-[#727784]" />
            <span className="text-base font-semibold leading-6 text-[#161c27]">
              {log.createdAt?.substring(0, 19) || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 border border-[#e5e7eb] rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] mb-2 uppercase">
            IP 地址
          </p>
          <div className="flex items-center gap-2 text-[#161c27]">
            <Globe className="w-[18px] h-[18px] text-[#727784]" />
            <span className="text-base font-semibold leading-6">
              {log.ipAddress || '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-[#e5e7eb]">
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#004191]" />
                操作详情
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-[#f1f3ff] p-4 rounded-lg border-l-4 border-[#004191]">
                <p className="text-sm leading-5 text-[#424753]">
                  {log.description || '无详细描述'}
                </p>
              </div>

              {primaryChange && (
                <div className="border border-[#e5e7eb] rounded-lg p-4 bg-slate-50/50">
                  <h4 className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#535f74] mb-4 uppercase">
                    字段变更对比
                  </h4>
                  <div className="flex items-center justify-between px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#424753] font-medium">变更字段</span>
                      <span className="text-base font-semibold leading-6">
                        {primaryChange.fieldLabel || primaryChange.field}
                      </span>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-[#16a34a] font-bold uppercase mb-1">
                          变更前
                        </span>
                        <div className="bg-[#dcfce7] text-[#16a34a] px-4 py-1.5 rounded text-sm font-semibold border border-[#16a34a]/10">
                          {primaryChange.oldValue || '—'}
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-[#727784]" />
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] text-[#535f74] font-bold uppercase mb-1">
                          变更后
                        </span>
                        <div className="bg-[#d5daea] text-[#535f74] px-4 py-1.5 rounded text-sm font-semibold border border-[#727784]/10">
                          {primaryChange.newValue || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-[#e5e7eb]">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#004191]" />
                关联资产
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f1f3ff] text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                    <th className="px-6 py-4 font-semibold">资产编号</th>
                    <th className="px-6 py-4 font-semibold">资产名称</th>
                    <th className="px-6 py-4 font-semibold">变更字段</th>
                    <th className="px-6 py-4 font-semibold">变更前值</th>
                    <th className="px-6 py-4 font-semibold">变更后值</th>
                    <th className="px-6 py-4 font-semibold">变更时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {relatedChanges.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-[#f1f3ff] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-[#004191] font-bold">
                        {row.assetCode}
                      </td>
                      <td className="px-6 py-4 text-sm leading-5">
                        {row.assetName}
                      </td>
                      <td className="px-6 py-4 text-sm leading-5">{row.field}</td>
                      <td className="px-6 py-4">
                        <span className="text-[#16a34a] font-medium">
                          {row.oldValue}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#535f74] font-medium">
                          {row.newValue}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm leading-5 text-[#424753]">
                        {row.time}
                      </td>
                    </tr>
                  ))}
                  {relatedChanges.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-sm text-[#424753]"
                      >
                        暂无变更记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="col-span-4 flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-[#e5e7eb]">
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#004191]" />
                操作上下文
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-1 border-b border-dashed border-[#e5e7eb] pb-3">
                  <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                    请求方法
                  </span>
                  <span className="text-sm font-semibold text-[#2563eb] bg-[#dbeafe] px-2 py-0.5 rounded-sm w-fit">
                    {context.method}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-dashed border-[#e5e7eb] pb-3">
                  <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                    请求路径
                  </span>
                  <code className="text-xs leading-4 bg-[#f1f3ff] p-2 rounded block break-all text-[#161c27]">
                    {context.path}
                  </code>
                </div>
                <div className="flex flex-col gap-1 border-b border-dashed border-[#e5e7eb] pb-3">
                  <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                    用户代理
                  </span>
                  <span className="text-sm text-[#161c27] truncate">
                    {context.userAgent}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                      请求 ID
                    </span>
                    <span className="text-sm text-[#161c27]">
                      {context.requestId}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                      会话 ID
                    </span>
                    <span className="text-sm text-[#161c27]">
                      {context.sessionId}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 pt-2">
                  <span className="text-[10px] leading-3 tracking-[0.05em] font-semibold text-[#424753] uppercase">
                    租户 ID
                  </span>
                  <span className="text-sm font-bold text-[#004191]">
                    {context.tenantId}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden flex-1">
            <CardHeader className="px-6 py-4 border-b border-[#e5e7eb]">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#004191]" />
                操作轨迹
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative">
              <div className="absolute left-[26px] top-8 bottom-8 w-[2px] bg-slate-200" />
              <div className="space-y-8 relative">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div
                      className={`z-10 w-4 h-4 rounded-full border-4 border-white mt-1 shadow-sm shrink-0 ${
                        entry.isCurrent
                          ? 'bg-[#004191] ring-1 ring-[#004191]'
                          : 'bg-slate-400 ring-1 ring-slate-400'
                      }`}
                    />
                    {entry.isCurrent ? (
                      <div className="flex flex-col gap-1 bg-[#004191]/5 p-3 rounded-lg border border-[#004191]/10">
                        <span className="text-xs font-bold text-[#004191] flex items-center gap-2">
                          {entry.time}
                          <span className="bg-[#004191] text-white px-1.5 py-0.5 rounded-[2px] text-[8px] uppercase">
                            当前节点
                          </span>
                        </span>
                        <p className="text-sm font-semibold leading-6 text-[#161c27]">
                          {entry.description}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-[#424753]">
                          {entry.time}
                        </span>
                        <p className="text-sm font-semibold leading-6 text-[#161c27]">
                          {entry.description}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-[#e5e7eb]">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
      </div>
    </div>
  );
}
