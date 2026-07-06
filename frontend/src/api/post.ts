import http from '@/utils/http';

export interface PostItem {
  id: number;
  postCode: string;
  postName: string;
  sortOrder?: number;
  status: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export function getPostList(page = 1, pageSize = 20, keyword?: string) {
  return http.get<{ records: PostItem[]; total: number }>('/posts/list', { params: { page, pageSize, keyword } });
}

export function getAllPosts() {
  return http.get<PostItem[]>('/posts/all');
}

export function getPostById(id: number) {
  return http.get<PostItem>(`/posts/${id}`);
}

export function createPost(data: {
  postCode: string;
  postName: string;
  sortOrder?: number;
  status?: number;
  remark?: string;
}) {
  return http.post<PostItem>('/posts', data);
}

export function updatePost(id: number, data: {
  postCode?: string;
  postName?: string;
  sortOrder?: number;
  status?: number;
  remark?: string;
}) {
  return http.put<PostItem>(`/posts/${id}`, data);
}

export function deletePost(id: number) {
  return http.delete<void>(`/posts/${id}`);
}

export function getUserPostIds(userId: number) {
  return http.get<number[]>(`/posts/users/${userId}`);
}

export function assignUserPosts(userId: number, postIds: number[]) {
  return http.put<void>(`/posts/users/${userId}`, { postIds });
}
