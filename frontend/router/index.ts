import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

// 工单审批页面路由配置
import WorkOrderApply from '@/pages/WorkOrder/pages/WorkOrderApply.vue';
import WorkOrderList from '@/pages/WorkOrder/pages/WorkOrderList.vue';
import WorkOrderDetail from '@/pages/WorkOrder/pages/WorkOrderDetail.vue';

// 报废审批相关路由
import RetirementApproval from '@/pages/retirement/RetirementApproval.vue';
import RetirementList from '@/pages/retirement/RetirementList.vue';

// 仪表盘路由
import Dashboard from '@/pages/Dashboard.vue';
import AuditDashboard from '@/pages/AuditDashboard.vue';
import LogDashboard from '@/pages/LogDashboard.vue';

// 资产相关路由
import AssetList from '@/pages/AssetList.vue';
import AssetDetail from '@/pages/AssetDetail.vue';

// 折旧报表路由
import DepreciationReport from '@/pages/DepreciationReport.vue';

// 报废流程路由
import RetirementFlow from '@/pages/RetirementFlow.vue';

// 审批历史路由 (approval 相关)
import ApprovalHistoryPage from '@/pages/WorkOrder/pages/ApprovalHistoryPage.tsx';

const routes: RouteRecordRaw[] = [
  // 仪表盘
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
  },
  
  // 工单审批流程路由 - Phase 1 核心功能
  {
    path: '/workorder',
    children: [
      {
        // 工单申请页面 - 用户提交审批申请
        path: 'apply',
        name: 'WorkOrderApply',
        component: WorkOrderApply,
        meta: {
          title: '提交审批申请',
          breadcrumb: ['工单管理', '提交申请'],
        },
      },
      {
        // 工单列表页面 - 查看已提交工单及筛选
        path: 'list',
        name: 'WorkOrderList',
        component: WorkOrderList,
        meta: {
          title: '工单列表',
          breadcrumb: ['工单管理', '工单列表'],
        },
      },
      {
        // 工单详情页面 - Phase 2 实现
        path: 'detail/:id',
        name: 'WorkOrderDetail',
        component: WorkOrderDetail,
        meta: {
          title: '工单详情',
          breadcrumb: ['工单管理', '工单详情'],
        },
      },
      {
        // 审批历史页面 - 状态流转追踪
        path: 'history/:id',
        name: 'ApprovalHistoryPage',
        component: ApprovalHistoryPage,
        meta: {
          title: '审批历史',
          breadcrumb: ['工单管理', '审批历史'],
        },
      },
    ],
  },
  
  // 报废审批路由
  {
    path: '/retirement',
    children: [
      {
        path: 'approval',
        name: 'RetirementApproval',
        component: RetirementApproval,
      },
      {
        path: 'list',
        name: 'RetirementList',
        component: RetirementList,
      },
    ],
  },
  
  // 审计相关路由
  {
    path: '/audit',
    children: [
      {
        path: 'dashboard',
        name: 'AuditDashboard',
        component: AuditDashboard,
      },
      {
        path: 'logs',
        name: 'AuditLogs',
        component: AuditDashboard,
      },
    ],
  },
  
  // 操作日志仪表盘
  {
    path: '/logs',
    name: 'LogDashboard',
    component: LogDashboard,
  },
  
  // 资产相关路由
  {
    path: '/assets',
    children: [
      {
        path: '',
        name: 'AssetList',
        component: AssetList,
      },
      {
        path: ':id',
        name: 'AssetDetail',
        component: AssetDetail,
      },
    ],
  },
  
  // 折旧报表
  {
    path: '/depreciation',
    name: 'DepreciationReport',
    component: DepreciationReport,
  },
  
  // 报废流程
  {
    path: '/retirement-flow',
    name: 'RetirementFlow',
    component: RetirementFlow,
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// 路由守卫 - 工单审批权限控制
router.beforeEach((to, from, next) => {
  // Phase 1 基础权限校验（后续可在 approvalStore 中扩展）
  const publicPaths = ['/', '/workorder/list', '/workorder/apply'];
  
  if (publicPaths.includes(to.path) || to.path.startsWith('/workorder/detail')) {
    next();
  } else {
    // 其他路径需要登录验证（可扩展）
    next();
  }
});

export default router;