/**
 * @file components/comment/CommentSection.tsx
 * @description 通用评论/协作组件 — 支持 @mention、回复、分页加载
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Reply, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getComments, createComment, deleteComment } from '@/api/comment';
import { useAuth } from '@/app/context/AuthContext';
import UserMentionAutocomplete from '@/components/comment/UserMentionAutocomplete';
import { toast } from 'sonner';
import type { BusinessComment } from '@/types/comment';

interface CommentSectionProps {
  businessType: 'ASSET' | 'WORK_ORDER' | 'RETIREMENT' | 'INSPECTION';
  businessId: number;
  maxHeight?: string;
}

export default function CommentSection({ businessType, businessId, maxHeight = '400px' }: CommentSectionProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [expanded, setExpanded] = useState(true);

  const queryKey = ['comments', businessType, businessId];

  const { data: commentsRes, isLoading } = useQuery({
    queryKey,
    queryFn: () => getComments(businessType, businessId),
  });

  const comments = (commentsRes as any)?.records ?? (commentsRes as BusinessComment[]) ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { content: string; parentCommentId?: number | null }) =>
      createComment({
        businessType,
        businessId,
        content: data.content,
        parentCommentId: data.parentCommentId ?? null,
        userId: user?.userId ?? 0,
        userName: user?.realName || user?.username || '未知用户',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setNewComment('');
      setReplyTo(null);
      toast.success('评论发表成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '评论发表失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('评论已删除');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmed = newComment.trim();
    if (!trimmed) {
      toast.warning('请输入评论内容');
      return;
    }
    createMutation.mutate({
      content: trimmed,
      parentCommentId: replyTo?.id ?? null,
    });
  }, [newComment, replyTo, createMutation]);

  const handleReply = useCallback((comment: BusinessComment) => {
    setReplyTo({ id: comment.id, userName: comment.userName });
    setNewComment(`@${comment.userName} `);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
    setNewComment('');
  }, []);

  // 过滤顶级评论
  const topLevelComments = Array.isArray(comments)
    ? comments.filter((c: any) => !c.parentCommentId)
    : [];

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)]">
      {/* 头部 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--surface-heading)]"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span>评论</span>
          {Array.isArray(comments) && (
            <span className="text-xs text-[var(--surface-muted-text)]">
              ({comments.length})
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-[var(--surface-border)]">
          {/* 评论输入 */}
          <div className="p-4 border-b border-[var(--surface-border-subtle)]">
            {replyTo && (
              <div className="flex items-center justify-between mb-2 text-xs text-[var(--brand-primary)]">
                <span>回复 @{replyTo.userName}</span>
                <button
                  onClick={handleCancelReply}
                  className="text-[var(--surface-muted-text)] hover:text-[var(--foreground)] transition"
                >
                  取消回复
                </button>
              </div>
            )}
            <UserMentionAutocomplete
              value={newComment}
              onChange={setNewComment}
              disabled={createMutation.isPending}
              onKeyEnter={handleSubmit}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!newComment.trim() || createMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                发表评论
              </button>
            </div>
          </div>

          {/* 评论列表 */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--surface-muted-text)]" />
              </div>
            ) : topLevelComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-[var(--surface-muted-text)]">
                <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                <span>暂无评论，来发表第一条评论吧</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--surface-border-subtle)]">
                {topLevelComments.map((comment: BusinessComment) => (
                  <div key={comment.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white">
                          {(comment.userName || 'A')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[var(--surface-heading)]">
                          {comment.userName}
                        </span>
                        <span className="text-xs text-[var(--surface-muted-text)]">
                          {formatTime(comment.createTime)}
                        </span>
                      </div>
                      {user?.userId === comment.userId && (
                        <button
                          onClick={() => {
                            if (confirm('确认删除该评论？')) deleteMutation.mutate(comment.id);
                          }}
                          className="text-[var(--surface-muted-text)] hover:text-[var(--destructive)] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {renderContent(comment.content)}
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => handleReply(comment)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--surface-muted-text)] hover:text-[var(--brand-primary)] transition"
                      >
                        <Reply className="w-3 h-3" />
                        回复
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 渲染评论内容（高亮 @mention） */
function renderContent(content: string): React.ReactNode {
  // 简单实现：将 @用户名 替换为蓝色高亮
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-[var(--brand-primary)] font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}
