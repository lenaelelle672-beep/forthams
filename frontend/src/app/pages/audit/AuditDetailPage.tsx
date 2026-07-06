/**
 * @module AuditDetailPage
 * @description 审计日志详情下钻页面 — 展示单条审计日志的完整结构化信息。
 *
 * 通过 URL 参数 `/audit/:id` 提取日志 ID，调用真实后端 API 获取详情数据，
 * 结构化展示 Request Payload、Response Payload、Metadata 等字段。
 *
 * 页面状态管理：
 * - Loading 态：数据加载中显示骨架屏
 * - Error 态：API 错误时展示错误提示
 * - 404 空态：不存在的 ID 展示 "数据未找到" 提示
 *
 * @since SWARM-073
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, FileText, User, Clock, Tag, Globe, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  fetchAuditDetail,
  formatUTCToLocalDisplay,
  type AuditLogDetail,
} from '../../services/auditService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 尝试解析并美化 JSON 字符串
 *
 * @param value 原始字符串（可能为 JSON）
 * @returns 美化后的字符串，解析失败则原样返回
 */
function tryPrettyJSON(value: string | undefined | null): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

/**
 * 渲染 JSON 内容块
 *
 * @param label 区块标题
 * @param content JSON 字符串或 undefined
 * @param testId 测试标识
 * @returns React 组件
 */
const JsonBlock: React.FC<{
  label: string;
  content: string | undefined;
  testId: string;
}> = ({ label, content, testId }) => {
  if (!content) return null;
  return (
    <div data-testid={testId}>
      <h4 className="text-sm font-semibold text-muted-foreground mb-2">{label}</h4>
      <pre
        className="bg-muted/50 rounded-md p-3 text-xs overflow-auto max-h-[400px] whitespace-pre-wrap break-words"
        style={{ fontFamily: 'monospace' }}
      >
        {tryPrettyJSON(content)}
      </pre>
    </div>
  );
};

/**
 * 渲染 Key-Value 详情行
 *
 * @param icon 图标
 * @param label 标签
 * @param value 值
 * @returns React 组件
 */
const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
    <div className="flex items-center gap-2 min-w-[140px] text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-sm font-medium flex-1">{value}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * AuditDetailPage — 审计日志详情下钻页面
 *
 * 通过 URL 中的 `:id` 参数调用 fetchAuditDetail(id) 获取日志详情，
 * 结构化展示操作人、操作类型、资源信息、请求/响应载荷等完整信息。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * // 路由配置: /audit/:id → AuditDetailPage
 * // 访问 /audit/abc-123 即可查看 ID 为 "abc-123" 的日志详情
 * ```
 */
const AuditDetailPage: React.FC = () => {
  /** 从 URL 提取日志 ID */
  const { id } = useParams<{ id: string }>();

  /** 路由导航钩子 */
  const navigate = useNavigate();

  /** 日志详情数据 */
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);

  /** 加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 是否为 404 状态 */
  const [isNotFound, setIsNotFound] = useState(false);

  /**
   * 加载日志详情数据
   */
  const loadDetail = useCallback(async () => {
    if (!id) {
      setError('缺少日志 ID 参数');
      setIsNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const data = await fetchAuditDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      const errWithStatus = err as Error & { status?: number };
      if (errWithStatus.status === 404) {
        setIsNotFound(true);
        setError('数据未找到');
      } else {
        setError(err instanceof Error ? err.message : '加载日志详情失败');
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /** 页面初次加载时获取数据 */
  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  /** 返回审计列表 */
  const handleGoBack = useCallback(() => {
    navigate('/audit');
  }, [navigate]);

  // ---- 404 / 数据未找到空态 ----
  if (isNotFound) {
    return (
      <div
        className="audit-detail-panel flex flex-col items-center justify-center min-h-[400px] p-6"
        data-testid="audit-detail-panel"
      >
        <FileText className="size-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">
          数据未找到
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          审计日志 {id ? `"${id}"` : ''} 不存在或已被删除
        </p>
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="size-4 mr-1" />
          返回审计列表
        </Button>
      </div>
    );
  }

  // ---- Loading 态 ----
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px] p-6"
        data-testid="audit-detail-loading"
      >
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // ---- Error 态 ----
  if (error) {
    return (
      <div
        className="audit-detail-panel flex flex-col items-center justify-center min-h-[400px] p-6"
        data-testid="audit-detail-panel"
      >
        <div className="text-destructive text-center">
          <p className="text-lg font-semibold mb-2">加载失败</p>
          <p className="text-sm mb-6">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadDetail}>
            重试
          </Button>
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="size-4 mr-1" />
            返回审计列表
          </Button>
        </div>
      </div>
    );
  }

  // ---- 无数据 ----
  if (!detail) {
    return (
      <div
        className="audit-detail-panel flex flex-col items-center justify-center min-h-[400px] p-6"
        data-testid="audit-detail-panel"
      >
        <p className="text-muted-foreground mb-4">暂无数据</p>
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="size-4 mr-1" />
          返回审计列表
        </Button>
      </div>
    );
  }

  // ---- 正常渲染详情 ----
  return (
    <div className="audit-detail-panel space-y-6 p-6" data-testid="audit-detail-panel">
      {/* 页面标题与返回按钮 */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={handleGoBack}>
          <ArrowLeft className="size-4 mr-1" />
          返回
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">审计日志详情</h1>
          <p className="text-sm text-muted-foreground mt-1">
            日志 ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{detail.id}</code>
          </p>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DetailRow
            icon={<Clock className="size-4" />}
            label="操作时间"
            value={detail.created_at ? formatUTCToLocalDisplay(detail.created_at) : '-'}
          />
          <DetailRow
            icon={<User className="size-4" />}
            label="操作人"
            value={
              <span>
                {detail.operator_name}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({detail.operator_id})
                </span>
              </span>
            }
          />
          <DetailRow
            icon={<Tag className="size-4" />}
            label="操作类型"
            value={<Badge variant="outline">{detail.action_type}</Badge>}
          />
          <DetailRow
            icon={<Tag className="size-4" />}
            label="资源类型"
            value={detail.resource_type || '-'}
          />
          <DetailRow
            icon={<Hash className="size-4" />}
            label="资源 ID"
            value={
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {detail.resource_id || '-'}
              </code>
            }
          />
          <DetailRow
            icon={<Globe className="size-4" />}
            label="IP 地址"
            value={
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {detail.ip_address || '-'}
              </code>
            }
          />
        </CardContent>
      </Card>

      {/* 操作详情 */}
      {detail.detail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">操作详情</CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="bg-muted/50 rounded-md p-3 text-xs overflow-auto max-h-[300px] whitespace-pre-wrap break-words"
              style={{ fontFamily: 'monospace' }}
              data-testid="audit-detail-detail-content"
            >
              {tryPrettyJSON(detail.detail)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Request Payload */}
      {detail.request_payload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">请求载荷 (Request Payload)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonBlock
              label=""
              content={detail.request_payload}
              testId="audit-detail-request-payload"
            />
          </CardContent>
        </Card>
      )}

      {/* Response Payload */}
      {detail.response_payload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">响应载荷 (Response Payload)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonBlock
              label=""
              content={detail.response_payload}
              testId="audit-detail-response-payload"
            />
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {detail.metadata && Object.keys(detail.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">扩展元数据 (Metadata)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="bg-muted/50 rounded-md p-3 text-xs overflow-auto max-h-[300px] whitespace-pre-wrap break-words"
              style={{ fontFamily: 'monospace' }}
              data-testid="audit-detail-metadata"
            >
              {JSON.stringify(detail.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

AuditDetailPage.displayName = 'AuditDetailPage';

export default AuditDetailPage;
export { AuditDetailPage };
