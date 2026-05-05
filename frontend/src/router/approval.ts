/**
 * Approval Router — 审批模块路由配置
 *
 * 对应 SPEC Phase 1: 核心审批流与基础工作台
 *
 * 路由规划:
 *   /approvals/pending   — 待审批列表（部门主管可见 APPROVING_LEVEL_1，资产管理员可见 APPROVING_LEVEL_2）
 *   /approvals/history   — 审批历史记录
 *   /approvals/:id       — 审批详情（含通过/驳回操作）
 *
 * 数据隔离约束:
 *   列表接口严格校验当前用户角色，不同角色仅可见对应审批级别的工单。
 */

import { lazy, type RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Lazy-loaded page components (code splitting)
// ---------------------------------------------------------------------------

/** 待审批工单列表页 — ATB-4 验收目标 */
const ApprovalPendingList = lazy(
  () =>
    import(
      /* webpackChunkName: "approval-pending" */ '@/pages/Approval/ApprovalPendingList'
    ),
);

/** 审批历史记录页 */
const ApprovalHistory = lazy(
  () =>
    import(
      /* webpackChunkName: "approval-history" */ '@/pages/Approval/ApprovalHistory'
    ),
);

/** 审批详情页（含通过/驳回表单） — ATB-5 验收目标 */
const ApprovalDetail = lazy(
  () =>
    import(
      /* webpackChunkName: "approval-detail" */ '@/pages/Approval/ApprovalDetail'
    ),
);

// ---------------------------------------------------------------------------
// Layout wrapper
// ---------------------------------------------------------------------------

/**
 * ApprovalLayout — 审批模块公共布局
 *
 * 提供审批工作台的侧边导航、面包屑及公共状态栏。
 * 子路由通过 <Outlet /> 渲染。
 */
function ApprovalLayout(): ReactNode {
  // Layout component is lazy-loaded to keep the router bundle small.
  // The actual layout implementation lives in the page layer.
  const Layout = lazy(
    () =>
      import(
        /* webpackChunkName: "approval-layout" */ '@/pages/Approval/ApprovalLayout'
      ),
  );
  return <Layout />;
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/**
 * 审批模块路由配置
 *
 * 所有审批相关路由均挂载在 `/approvals` 前缀下。
 * 各页面组件采用 React.lazy 按需加载，减少首屏体积。
 */
export const approvalRoutes: RouteObject[] = [
  {
    path: '/approvals',
    element: <ApprovalLayout />,
    children: [
      {
        index: true,
        element: <ApprovalPendingList />,
        handle: {
          /** 页面元数据 — 用于面包屑与权限校验 */
          title: '待审批工单',
          permission: 'approval:pending',
          /** 数据隔离：列表接口会根据当前用户角色自动过滤审批级别 */
          requiredRoles: ['DEPARTMENT_MANAGER', 'ASSET_MANAGER'],
        },
      },
      {
        path: 'pending',
        element: <ApprovalPendingList />,
        handle: {
          title: '待审批工单',
          permission: 'approval:pending',
          requiredRoles: ['DEPARTMENT_MANAGER', 'ASSET_MANAGER'],
        },
      },
      {
        path: 'history',
        element: <ApprovalHistory />,
        handle: {
          title: '审批历史',
          permission: 'approval:history',
          requiredRoles: ['DEPARTMENT_MANAGER', 'ASSET_MANAGER'],
        },
      },
      {
        path: ':id',
        element: <ApprovalDetail />,
        handle: {
          title: '审批详情',
          permission: 'approval:detail',
          requiredRoles: ['DEPARTMENT_MANAGER', 'ASSET_MANAGER'],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { ApprovalPendingList, ApprovalHistory, ApprovalDetail };