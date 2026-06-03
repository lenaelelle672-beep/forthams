/**
 * @file types/comment.ts
 * @description 评论系统类型定义
 */

export interface BusinessComment {
  id: number;
  businessType: 'ASSET' | 'WORK_ORDER' | 'RETIREMENT' | 'INSPECTION';
  businessId: number;
  userId: number;
  userName: string;
  content: string;
  parentCommentId: number | null;
  createTime: string;
  updateTime: string;
  replyToUserName?: string;
}

export interface CommentCreateDTO {
  businessType: string;
  businessId: number;
  content: string;
  parentCommentId?: number | null;
  userId: number;
  userName: string;
}
