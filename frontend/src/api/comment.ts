/**
 * @file api/comment.ts
 * @description 评论系统 API 封装
 */

import http from '@/utils/http';
import type { BusinessComment, CommentCreateDTO } from '@/types/comment';
import type { PageData } from '@/types/common';

export function getComments(
  businessType: string,
  businessId: number,
  parentCommentId?: number | null,
  pageNum = 1,
  pageSize = 20,
): Promise<PageData<BusinessComment>> {
  const params: Record<string, any> = { businessType, businessId, pageNum, pageSize };
  if (parentCommentId != null) params.parentCommentId = parentCommentId;
  return http.get('/comments', { params });
}

export function createComment(data: CommentCreateDTO): Promise<BusinessComment> {
  return http.post('/comments', data);
}

export function deleteComment(id: number): Promise<void> {
  return http.delete(`/comments/${id}`);
}
