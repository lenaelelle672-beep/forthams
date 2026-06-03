/**
 * @file pages/settings/MailLogTab.tsx
 * @description 邮件发送日志 Tab
 *
 * 功能：发送日志列表（分页）、按状态/模板/业务筛选
 * Pattern: useQuery + invalidateQueries
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { mailLogApi } from '@/api/mailTemplate';
import type { MailLog, PageResponse } from '@/types/mailTemplate';
import { SEND_STATUS_LABELS, SEND_STATUS_COLORS } from '@/types/mailTemplate';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

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
    templateCode: templateCode || undefined,
    bizType: bizType || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['mail-logs', queryParams],
    queryFn: async () => {
      const res = await mailLogApi.list(queryParams);
      return res as unknown as PageResponse<MailLog>;
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── 渲染详情弹窗 ─────────────────────────────────────────────────────────

  const detailRecord = detailId ? records.find(r => r.id === detailId) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>邮件发送日志</CardTitle>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['mail-logs'] })} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {/* 过滤栏 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="模板编码"
              value={templateCode}
              onChange={e => setTemplateCode(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-primary w-36"
            />
            <select
              value={sendStatus}
              onChange={e => { setSendStatus(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-primary text-foreground"
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
              onChange={e => setBizType(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-primary w-28"
            />
            <Button variant="secondary" size="sm" onClick={() => { setTemplateCode(''); setSendStatus(''); setBizType(''); setPage(1); }}>
              清空
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : (
            <>
              {records.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">暂无发送日志</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-[#f8fafc]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">收件人</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">主题</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">业务类型</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">发送时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted">
                      {records.map(log => (
                        <tr key={log.id} className="hover:bg-muted">
                          <td className="px-4 py-3 text-foreground max-w-[150px] truncate" title={log.mailTo}>{log.mailTo}</td>
                          <td className="px-4 py-3 text-foreground max-w-[200px] truncate" title={log.subject}>{log.subject}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${SEND_STATUS_COLORS[log.sendStatus] || 'bg-muted text-muted-foreground'}`}>
                              {SEND_STATUS_LABELS[log.sendStatus] || log.sendStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{log.bizType || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{log.sendTime || '—'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setDetailId(log.id)}
                              className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                              title="查看详情"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 分页 */}
              {total > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">共 {total} 条记录，第 {page}/{totalPages} 页</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                    <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
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
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">邮件发送详情</h3>
              <button onClick={() => setDetailId(null)} className="text-muted-foreground hover:text-muted-foreground text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">收件人：</span><span className="text-foreground">{detailRecord.mailTo}</span></div>
                <div><span className="text-muted-foreground">状态：</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${SEND_STATUS_COLORS[detailRecord.sendStatus]}`}>
                    {SEND_STATUS_LABELS[detailRecord.sendStatus]}
                  </span>
                </div>
                <div><span className="text-muted-foreground">模板编码：</span><span className="text-foreground">{detailRecord.templateCode || '—'}</span></div>
                <div><span className="text-muted-foreground">业务类型：</span><span className="text-foreground">{detailRecord.bizType || '—'}</span></div>
                <div><span className="text-muted-foreground">业务ID：</span><span className="text-foreground">{detailRecord.bizId || '—'}</span></div>
                <div><span className="text-muted-foreground">发送时间：</span><span className="text-foreground">{detailRecord.sendTime || '—'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">重试次数：</span><span className="text-foreground">{detailRecord.retryCount || 0}/{detailRecord.maxRetry || 3}</span></div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">邮件主题：</p>
                <p className="text-foreground bg-[#f8fafc] p-2 rounded">{detailRecord.subject}</p>
              </div>
              {detailRecord.errorMessage && (
                <div>
                  <p className="text-muted-foreground mb-1">错误信息：</p>
                  <p className="text-red-600 bg-red-50 p-2 rounded text-xs">{detailRecord.errorMessage}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">邮件内容（HTML）：</p>
                <div className="bg-[#f8fafc] p-3 rounded max-h-60 overflow-y-auto">
                  <pre className="text-xs text-foreground whitespace-pre-wrap break-all">{detailRecord.content}</pre>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
