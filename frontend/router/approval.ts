import { createRouter, createWebHistory } from 'vue-router';
import ApprovalDashboard from '../pages/ApprovalDashboard.vue';
import ApprovalDetail from '../pages/ApprovalDetail.vue';

/**
 * SWARM-001: 工单审批流程路由配置
 * 
 * 用户可以在前端提交审批请求，后端根据状态机自动流转审批节点，
 * 并触发通知机制。
 */
const approvalRoutes = [
  {
    path: '/approvals',
    name: 'approval-dashboard',
    component: ApprovalDashboard,
    meta: { title: '审批中心', requiresAuth: true }
  },
  {
    path: '/approvals/:id',
    name: 'approval-detail',
    component: ApprovalDetail,
    meta: { title: '审批详情', requiresAuth: true },
    props: true
  }
];

/**
 * 审批流程路由器
 * 支持路由: /approvals (审批列表), /approvals/:id (审批详情)
 */
const approvalRouter = createRouter({
  history: createWebHistory(),
  routes: approvalRoutes
});

/**
 * 提交工单审批请求
 * @param ticketId 工单ID
 * @param comment 审批备注
 */
export async function submitForApproval(ticketId: string, comment?: string): Promise<void> {
  const response = await fetch(`/api/tickets/${ticketId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment })
  });
  
  if (!response.ok) {
    throw new Error(`审批提交失败: ${response.statusText}`);
  }
}

/**
 * 执行审批操作
 * @param ticketId 工单ID
 * @param action 审批动作 (approve/reject)
 * @param comment 审批意见
 */
export async function executeApproval(
  ticketId: string, 
  action: 'approve' | 'reject',
  comment?: string
): Promise<void> {
  const response = await fetch(`/api/tickets/${ticketId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment })
  });
  
  if (!response.ok) {
    throw new Error(`审批操作失败: ${response.statusText}`);
  }
}

/**
 * 获取审批列表
 * @param status 筛选状态 (可选)
 */
export async function fetchApprovalList(status?: string): Promise<any[]> {
  const url = status ? `/api/tickets?status=${status}` : '/api/tickets';
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`获取审批列表失败: ${response.statusText}`);
  }
  
  return response.json();
}

export { approvalRouter, approvalRoutes };
export default approvalRouter;