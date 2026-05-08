import { defineAsyncComponent } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

/**
 * 工单模块路由配置
 *
 * 包含工单的 CRUD 操作页面路由：
 * - /ticket/list          → 工单列表页（已存在）
 * - /ticket/detail/:id    → 工单详情页（已存在）
 * - /ticket/create        → 创建工单页（新增）
 * - /ticket/edit/:id      → 编辑工单页（新增）
 */

const TicketList = defineAsyncComponent(() => import('@/views/ticket/TicketList.vue'));
const TicketDetail = defineAsyncComponent(() => import('@/views/ticket/ticket-detail.vue'));
const TicketCreate = defineAsyncComponent(() => import('@/views/ticket/ticket-create.vue'));
const TicketEdit = defineAsyncComponent(() => import('@/views/ticket/ticket-edit.vue'));

export const ticketRoutes: RouteRecordRaw[] = [
  {
    path: 'ticket',
    children: [
      {
        path: 'list',
        name: 'TicketList',
        component: TicketList,
        meta: { title: '工单列表' },
      },
      {
        path: 'detail/:id',
        name: 'TicketDetail',
        component: TicketDetail,
        props: true,
        meta: { title: '工单详情' },
      },
      {
        path: 'create',
        name: 'TicketCreate',
        component: TicketCreate,
        meta: { title: '创建工单' },
      },
      {
        path: 'edit/:id',
        name: 'TicketEdit',
        component: TicketEdit,
        props: true,
        meta: { title: '编辑工单' },
      },
    ],
  },
];

export default ticketRoutes;
