# SWARM-001 工单审批流程 - Approval Router 规格指导

## 1. 需求与背景

### 1.1 业务需求

工单审批流程是企业级工单系统核心模块 `frontend/src/router/approval.ts`，需支持以下路由配置：

| 功能 | 路由路径 | HTTP 方法 | 说明 |
|------|----------|-----------|------|
| 发起审批申请 | `/work-order/:id/approval/new` | GET/POST | 创建审批申请表单页 |
| 待审批列表 | `/approvals/pending` | GET | 展示当前用户待审批工单 |
| 审批详情 | `/approvals/:approvalId` | GET | 审批详情及操作面板 |
| 执行审批 | `/approvals/:approvalId/approve` | POST | 批准操作 |
| 执行驳回 | `/approvals/:approvalId/reject` | POST | 驳回操作 |
| 审批历史 | `/approvals/:approvalId/history` | GET | 审批流程历史记录 |

### 1.2 现状痛点

- 当前 `approval.ts` 路由配置缺失审批相关页面路由
- 用户无法通过前端导航访问审批功能
- 审批操作未绑定到正确的 API 端点

### 1.3 业务价值

- 实现工单审批流程前端路由全覆盖
- 支持用户高效导航至审批功能入口
- 为后端审批 API 提供前端路由绑定

---

## 2. 当前 Phase 实现目标

### Phase 1: 路由骨架搭建

| 目标 | 交付物 |
|------|--------|
| 路由配置基础结构 | `approval.ts` 路由模块导出 |
| 审批页面路由注册 | 6 条审批相关路由定义 |
| 路由守卫配置 | 审批权限校验守卫 |
| 懒加载配置 | 审批页面组件懒加载 |

### Phase 2: 路由与组件绑定

| 目标 | 交付物 |
|------|--------|
| 审批申请页路由 | `/work-order/:id/approval/new` → `WorkOrderApprovalForm` |
| 待审批列表路由 | `/approvals/pending` → `PendingApprovalsList` |
| 审批详情路由 | `/approvals/:approvalId` → `ApprovalDetailPage` |

### Phase 3: 路由守卫与权限

| 目标 | 交付物 |
|------|--------|
| 审批权限守卫 | `approvalGuard` 路由守卫 |
| 审批人身份校验 | `isApprover` 权限判断 |
| 未授权重定向 | 跳转至首页或登录页 |

---

## 3. 边界约束

### 3.1 功能边界

```
✓ 支持 GET/POST 审批路由
✓ 支持路径参数 :id, :approvalId
✓ 支持查询参数 ?page=1&pageSize=20
✓ 支持路由懒加载
✓ 支持路由守卫鉴权
✗ 不处理实际审批逻辑（由后端 API 处理）
✗ 不实现状态管理（由 Zustand Store 处理）
✗ 不实现通知推送（由 WebSocket Service 处理）
```

### 3.2 技术约束

| 约束项 | 规格 |
|--------|------|
| 路由框架 | React Router v6 |
| TypeScript 版本 | 4.9+ |
| 路由懒加载 | `React.lazy()` + `Suspense` |
| 路径匹配 | 支持嵌套路由 |
| 重定向 | 使用 `<Navigate>` 组件 |

### 3.3 数据约束

| 约束项 | 规格 |
|--------|------|
| URL 最大长度 | 2048 字符 |
| 路径参数类型 | `string` / `number` |
| 查询参数编码 | UTF-8 |

---

## 4. 验收测试基准 (ATB)

### TC-ROUTER-001: 路由模块导出验证

```typescript
// pytest 物理测试 - test_approval_router_export
import { approvalRouter } from '@/router/approval';

test('approvalRouter should be defined', () => {
  expect(approvalRouter).toBeDefined();
  expect(typeof approvalRouter).toBe('object');
});

test('approvalRouter should have correct number of routes', () => {
  const routes = approvalRouter.routes;
  expect(routes.length).toBeGreaterThanOrEqual(6);
});
```

### TC-ROUTER-002: 审批申请页路由配置

```typescript
// pytest 物理测试 - test_approval_form_route
import { approvalRouter } from '@/router/approval';

test('approval form route should be configured', () => {
  const formRoute = approvalRouter.routes.find(
    (r) => r.path === '/work-order/:id/approval/new'
  );
  
  expect(formRoute).toBeDefined();
  expect(formRoute.component).toBeDefined();
  expect(formRoute.path).toBe('/work-order/:id/approval/new');
});
```

### TC-ROUTER-003: 待审批列表路由配置

```typescript
// pytest 物理测试 - test_pending_list_route
import { approvalRouter } from '@/router/approval';

test('pending approvals list route should be configured', () => {
  const pendingRoute = approvalRouter.routes.find(
    (r) => r.path === '/approvals/pending'
  );
  
  expect(pendingRoute).toBeDefined();
  expect(pendingRoute.path).toBe('/approvals/pending');
  expect(pendingRoute.loader).toBeDefined(); // 应有数据加载器
});
```

### TC-ROUTER-004: 审批详情路由配置

```typescript
// pytest 物理测试 - test_approval_detail_route
import { approvalRouter } from '@/router/approval';

test('approval detail route with :approvalId param', () => {
  const detailRoute = approvalRouter.routes.find(
    (r) => r.path === '/approvals/:approvalId'
  );
  
  expect(detailRoute).toBeDefined();
  expect(detailRoute.path).toContain(':approvalId');
  expect(detailRoute.children).toBeDefined();
});
```

### TC-ROUTER-005: 审批操作路由配置

```typescript
// pytest 物理测试 - test_approval_action_routes
import { approvalRouter } from '@/router/approval';

test('approve and reject routes should be action routes', () => {
  const approveRoute = approvalRouter.routes.find(
    (r) => r.path.endsWith('/approve')
  );
  const rejectRoute = approvalRouter.routes.find(
    (r) => r.path.endsWith('/reject')
  );
  
  expect(approveRoute).toBeDefined();
  expect(rejectRoute).toBeDefined();
  expect(approveRoute.action).toBeDefined();
  expect(rejectRoute.action).toBeDefined();
});
```

### TC-ROUTER-006: 路由守卫配置验证

```typescript
// pytest 物理测试 - test_approval_guard
import { approvalRouter } from '@/router/approval';

test('protected routes should have guards', () => {
  const protectedRoutes = ['/approvals/pending', '/approvals/:approvalId'];
  
  protectedRoutes.forEach((path) => {
    const route = approvalRouter.routes.find((r) => r.path === path);
    expect(route).toBeDefined();
    expect(route.beforeEnter || route.guard).toBeDefined();
  });
});
```

### TC-ROUTER-007: 懒加载配置验证

```typescript
// pytest 物理测试 - test_lazy_loading
import { approvalRouter } from '@/router/approval';

test('routes should use lazy loading', async () => {
  const routes = approvalRouter.routes;
  
  for (const route of routes) {
    if (route.component) {
      // 懒加载的组件应该是 Promise
      const componentType = route.component.toString();
      expect(componentType).toContain('Promise') || 
        expect(route.component.$$typeof).toBe(Symbol.for('react.lazy'));
    }
  }
});
```

### TC-ROUTER-008: 路由集成测试

```typescript
// playwright 物理测试 - test_approval_navigation_flow
import { test, expect } from '@playwright/test';

test('full approval navigation flow', async ({ page }) => {
  // 1. 访问待审批列表
  await page.goto('/approvals/pending');
  await expect(page.locator('.pending-list')).toBeVisible();
  
  // 2. 点击审批项进入详情
  await page.click('.approval-item:first-child');
  await expect(page.url()).toMatch(/\/approvals\/\d+/);
  await expect(page.locator('.approval-detail')).toBeVisible();
  
  // 3. 执行批准操作
  await page.click('.btn-approve');
  await expect(page.locator('.toast-success')).toContainText('审批已通过');
});
```

---

## 5. 开发切入层级序列

### Level 1: 路由模块基础

```
1.1 创建 approval.ts 文件
1.2 导入 React Router 依赖
1.3 定义路由配置常量
1.4 导出 approvalRouter 对象
```

### Level 2: 路由定义

```
2.1 定义审批申请页路由 (/work-order/:id/approval/new)
2.2 定义待审批列表路由 (/approvals/pending)
2.3 定义审批详情路由 (/approvals/:approvalId)
2.4 定义审批历史路由 (/approvals/:approvalId/history)
2.5 定义操作路由 (/approvals/:approvalId/approve, /reject)
```

### Level 3: 路由守卫

```
3.1 创建 approvalGuard 守卫函数
3.2 实现 isApprover 权限校验
3.3 配置受保护路由的 beforeEnter
3.4 实现未授权重定向逻辑
```

### Level 4: 懒加载与 Suspense

```
4.1 使用 React.lazy 懒加载页面组件
4.2 配置 Suspense 加载状态
4.3 定义 fallback 组件
```

### Level 5: 路由集成

```
5.1 在主路由文件中引入 approvalRouter
5.2 配置嵌套路由结构
5.3 验证路由匹配优先级
```

### 依赖关系图

```
Level 1 ──► Level 2 ──► Level 3 ──► Level 4 ──► Level 5
   │           │           │           │
   │           │           │           └── 依赖 React Router v6
   │           │           └── 依赖 useAuth hook
   │           └── 依赖页面组件定义
   └── 依赖类型定义
```

---

## 附录 A: 类型定义速查

```typescript
// frontend/src/router/approval.ts

interface ApprovalRouteConfig {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  loader?: () => Promise<any>;
  action?: (args: ActionArgs) => Promise<Response>;
  beforeEnter?: (args: LoaderArgs) => Promise<Response | Redirect>;
  children?: ApprovalRouteConfig[];
}

interface ApprovalRouter {
  routes: ApprovalRouteConfig[];
  basename?: string;
}
```

## 附录 B: 验收状态追踪

| TC ID | 测试描述 | 状态 | 执行时间 |
|-------|----------|------|----------|
| TC-ROUTER-001 | 路由模块导出验证 | pending | - |
| TC-ROUTER-002 | 审批申请页路由配置 | pending | - |
| TC-ROUTER-003 | 待审批列表路由配置 | pending | - |
| TC-ROUTER-004 | 审批详情路由配置 | pending | - |
| TC-ROUTER-005 | 审批操作路由配置 | pending | - |
| TC-ROUTER-006 | 路由守卫配置验证 | pending | - |
| TC-ROUTER-007 | 懒加载配置验证 | pending | - |
| TC-ROUTER-008 | 路由集成测试 | pending | - |

---

**文档版本**: SWARM-001-ROUTER-v1.0  
**生成时间**: 2024  
**状态**: DRAFT  
**责任人**: 前端路由开发工程师