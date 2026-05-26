# forthAMS 项目发展方案

> **文档版本**: v1.0  
> **生成日期**: 2026-05-22  
> **基线状态**: 前端审查 93/100 分（commit b7011df1），585 测试全绿，构建 4.47s 通过  
> **综合评分**: 54/100（C+），10 个维度加权  
> **技术决策**: Option C — 参考 RuoYi 表结构 + 纯自定义 RBAC 实现（debate.json 已确认）

---

## 1. 执行摘要

### 1.1 项目当前状态

forthAMS 是一个前后端分离的资产管理系统（React/Vite 前端 + Spring Boot 后端），已具备 20 个前端页面模块、37 个活跃页面、19 个 API 文件、13 个 Service 文件。上一轮全量页面审查修复得分 93/100，585 测试全绿，构建正常。

然而，项目存在 **三个结构性风险**：

| # | 风险 | 影响 | 等级 |
|---|------|------|------|
| 1 | **双套页面代码**（`src/pages/` 37 个活跃 vs `src/app/pages/` 127 个死文件） | 开发者混淆、341 个文件增加维护负担和 bundle 体积 | 🔴 HIGH |
| 2 | **组件绕过统一 HTTP 客户端**（ScopeSelector、AssetBulkImportPage 等直接读 localStorage token） | 绕过统一拦截器，安全风险 | 🔴 HIGH |
| 3 | **Mock 数据残留**（WorkOrderList、NotificationBell、FileUploader 仍使用模拟数据） | 用户看到假数据，影响业务决策 | 🔴 HIGH |

### 1.2 最关键的 3 个行动项

1. **清理 `src/app/` 死代码**（P0，2-4h）— 最高 ROI 的单次操作，消除 341 个死文件
2. **修复 Token 绕过和统一 HTTP 客户端泛型**（P0，1-2 天）— 消除安全风险 + 根治 606 处 `any` 类型
3. **启动 RBAC 权限系统建设**（P1，8-12 天）— 基于 Option C 决策，纯自定义实现

---

## 2. 现状分析

### 2.1 各维度评分与问题

| 维度 | 评分/100 | 等级 | 核心问题 |
|------|---------|------|---------|
| 技术债务 | 33 | D | 双套页面代码（TD-001）、606 处 `any`（TD-002）、version 硬编码（TD-004） |
| Mock 残留 | 50 | C | WorkOrderList 用 `generateMockData`、NotificationBell 空数组、FileUploader 模拟上传 |
| 测试覆盖 | 40 | D | 37 页面 0 测试、13 个 services 仅 1 个有测试、覆盖率门槛仅适用 inventory.ts |
| 架构模式 | 50 | C | `src/pages/` vs `src/app/pages/` 双套、3 个工单目录并存、2 个供应商目录并存 |
| 国际化 | 80 | B | UI 文本已中文化，但缺少 i18n 框架，文案硬编码在组件中 |
| 性能 | 70 | B | 133 处 useMemo/useCallback、React.lazy 懒加载，但 100+ 死文件增加 bundle |
| 安全 | 60 | C | 统一 HTTP 客户端架构合理，但 localStorage token + 多组件绕过 |
| 无障碍 | 50 | C | 37 页面仅 6 个使用 aria，表单缺 label 关联，Modal 缺焦点陷阱 |
| 依赖健康 | 70 | B | 版本较新无冲突，但 @vue/test-utils 误装、echarts+recharts 并存 |
| 文档 | 50 | C | 有 README 和规范文档，但缺 API 接口文档、部署指南、组件文档 |

### 2.2 详细问题清单

#### 技术债务（TD）

| ID | 类别 | 严重度 | 详情 | 文件 |
|----|------|--------|------|------|
| TD-001 | 双套页面代码 | HIGH | `src/pages/` 37 Page 活跃，`src/app/pages/` 127 文件死代码 | `src/pages/`, `src/app/pages/` |
| TD-002 | `any` 类型滥用 | MEDIUM | 全项目 606 处 `any`，根因是 HTTP 响应拦截器解包后泛型推断断裂 | `src/services/`, `src/api/`, `src/pages/` |
| TD-003 | TODO 残留 | LOW | SettingsPage 2 处 TODO，后端端点未实现 | `src/pages/settings/SettingsPage.tsx:566,674` |
| TD-004 | version 硬编码 | MEDIUM | DisposalDetailPage 审批操作硬编码 `{ version: 1 }`，并发场景乐观锁失败 | `src/pages/disposal/DisposalDetailPage.tsx:145,154` |
| TD-005 | 类型不安全 | MEDIUM | AuditDetailPage 使用 `as unknown as Record` 强制转换 | `src/pages/audit/AuditDetailPage.tsx:113-118` |
| TD-006 | scopeId 可读性 | LOW | InventoryDetailPage 展示原始 ID 而非名称 | `src/pages/inventory/InventoryDetailPage.tsx:319-332` |
| TD-007 | console 残留 | LOW | 128 处 console 调用，部分为调试残留 | `src/services/`, `src/app/pages/`, `src/mocks/` |

#### 安全问题

| 严重度 | 详情 | 文件 |
|--------|------|------|
| HIGH | Token 存 localStorage，易受 XSS，且存在多个 key（`auth_token`、`ams_auth_token`） | `src/utils/http.ts:42`, `src/layouts/AppLayout.tsx:133-136` |
| MEDIUM | ScopeSelector.tsx:95、AssetBulkImportPage.tsx:245 直接读 localStorage 构造 Authorization | `src/components/inventory/ScopeSelector.tsx`, `src/app/pages/AssetBulkImport/AssetBulkImportPage.tsx` |
| MEDIUM | `api/workflow.ts:24` 直接从 localStorage 读 `user_info` 解析用户 ID 无校验 | `src/api/workflow.ts:24` |
| LOW | AppLayout 读取 `user_info` 反序列化无 try-catch | `src/layouts/AppLayout.tsx:144-145` |

#### Mock 残留

| 严重度 | 详情 | 文件 |
|--------|------|------|
| HIGH | WorkOrderList 使用 `generateMockData` 生成工单数据 | `src/components/WorkOrderList/index.tsx:120` |
| HIGH | NotificationBell 使用空数组 mockData 替代真实通知 | `src/components/NotificationBell.tsx:391-393` |
| HIGH | FileUploader `simulateUpload` 使用 setInterval 模拟上传进度 | `src/components/ImportPanel/FileUploader.tsx:266-289` |
| MEDIUM | `src/mocks/` 下完整 mock 文件（MSW handlers 等） | `src/mocks/` 目录 |

---

## 3. 分阶段实施路线图

### 第一阶段：紧急修复（1-2 天）

> **目标**: 消除高风险项，提升项目可维护性和安全性基线

| # | 任务 | 优先级 | 文件 | 预估工时 | 验收标准 |
|---|------|--------|------|---------|---------|
| P1-1 | 清理 `src/app/` 死代码 | P0 | `frontend/src/app/` 整个目录（341 文件） | 2-4h | `rm -rf src/app/` 后构建通过、585 测试全绿、无 import 引用 `@/app/` |
| P1-2 | 修复组件绕过统一 HTTP 客户端 | P0 | `src/components/inventory/ScopeSelector.tsx:95`, `src/api/workflow.ts:24` | 2h | 所有 API 调用走 `src/utils/http.ts`，零 `localStorage.getItem('auth_token')` 在组件中 |
| P1-3 | 清理 Mock 数据残留 | P0 | `src/components/WorkOrderList/index.tsx:120`, `src/components/NotificationBell.tsx:391-393`, `src/components/ImportPanel/FileUploader.tsx:266-289` | 4-6h | WorkOrderList 调用真实 API、NotificationBell 接入通知 API、FileUploader 实现 FormData 真实上传 |
| P1-4 | 修复 DisposalDetailPage version 硬编码 | P0 | `src/pages/disposal/DisposalDetailPage.tsx:145,154` | 0.5h | 从 `detail.version` 获取实际版本号替换硬编码 `{ version: 1 }` |
| P1-5 | 修复 AuditDetailPage 类型不安全 | P1 | `src/pages/audit/AuditDetailPage.tsx:113-118` | 0.5h | 定义 `AuditLogDetail` 接口包含 `httpMethod`/`userAgent`/`tenantId` 字段，消除 `as unknown as Record` |
| P1-6 | 修复 InventoryDetailPage scopeId 可读性 | P1 | `src/pages/inventory/InventoryDetailPage.tsx:319-332` | 1h | 复用 ScopeSelector 的 key→title 映射，scopeIds 展示名称而非原始 ID |

**P1 风险和依赖**:
- P1-1（清理 src/app/）风险：需确认 `src/app/pages/AssetBulkImport/` 中是否有被间接引用的代码。**缓解**: 先用 `grep -r '@/app/' src/pages/ src/components/ src/services/ src/api/` 确认无活跃引用
- P1-3（Mock 清理）依赖：需要后端对应 API 端点已实现。如果后端未实现，需要与后端协调或添加 feature flag
- P1-4 依赖：DisposalDetailPage 审批操作需要后端返回 `version` 字段

### 第二阶段：核心功能建设（1-2 周）

> **目标**: 完成 RBAC 权限系统、MaxKey SSO 集成、数据权限实现

#### P2-A: RBAC 权限系统（Option C — 纯自定义实现）

| # | 子任务 | 优先级 | 预估工时 | 关键文件 |
|---|--------|--------|---------|---------|
| RBAC-1 | 数据库表设计与迁移 | P1 | 1 天 | `backend/src/main/resources/db/migration/` — 参考 RuoYi `sys_user`/`sys_dept`/`sys_role`/`sys_menu`/`sys_user_role`/`sys_role_menu` 表结构 |
| RBAC-2 | 后端实体层扩展 | P1 | 1 天 | `backend/.../entity/User.java`（添加 email/phone/avatar/status 字段）、`Role.java`（添加 dataScope/sort/status）、`Dept.java`（已有 parentId/children 基础）、新建 `Menu.java`/`UserRole.java`/`RoleMenu.java` |
| RBAC-3 | 后端 CRUD API | P1 | 2 天 | `backend/.../controller/UserController.java`、`DeptController.java`、`RoleController.java`、`MenuController.java` |
| RBAC-4 | 前端管理页面 | P1 | 2 天 | `frontend/src/pages/settings/UserManagement.tsx`（新建）、`RoleManagement.tsx`（新建）、`DeptManagement.tsx`（新建）、`MenuManagement.tsx`（新建） |
| RBAC-5 | 动态路由与菜单 | P1 | 1 天 | `frontend/src/router/index.tsx`（从 `/api/v1/menus` 加载用户菜单）、`frontend/src/layouts/AppLayout.tsx`（动态渲染侧边栏） |
| RBAC-6 | 操作日志注解 | P1 | 0.5 天 | `backend/.../annotation/Log.java`（新建）、AOP 切面记录操作日志 |
| RBAC-7 | 用户导入导出 | P2 | 1 天 | `backend/.../service/UserService.java`（Excel 导入导出） |

**RBAC 总工时**: 8-12 天（含测试）

**RBAC 验收标准**:
- 用户 CRUD（创建/读取/更新/删除/重置密码/分配角色）
- 角色 CRUD（创建/读取/更新/删除/分配权限/分配菜单）
- 部门树 CRUD（创建/读取/更新/删除/树形展示/排序）
- 菜单管理（树形 CRUD，配置路由路径、图标、权限标识）
- 前端侧边栏根据用户角色动态渲染
- 操作日志记录关键操作

#### P2-B: MaxKey SSO 集成

| # | 子任务 | 优先级 | 预估工时 | 关键文件 |
|---|--------|--------|---------|---------|
| SSO-1 | 后端 Spring Security OAuth2 Client 配置 | P1 | 1 天 | `backend/.../config/SecurityConfig.java`（添加 OAuth2LoginAuthenticationProvider）、`application.yml`（MaxKey 端点配置） |
| SSO-2 | 双 Provider 共存配置 | P1 | 0.5 天 | `SecurityConfig.java` — DaoAuthenticationProvider（本地）+ OAuth2LoginAuthenticationProvider（SSO）共存 |
| SSO-3 | 前端登录页改造 | P1 | 0.5 天 | `frontend/src/pages/auth/LoginPage.tsx`（添加 "SSO 登录" 按钮，重定向到 MaxKey） |
| SSO-4 | SSO 回调处理 | P1 | 0.5 天 | `backend/.../controller/OAuth2Controller.java`（处理 MaxKey 回调，创建/关联本地用户） |

**SSO 端点（来自 debate.json 调研）**:
```
authorize: /sign/authz/oauth/v20/authorize
token:     /sign/authz/oauth/v20/token
userinfo:  /sign/api/oauth/v20/me
discovery: /sign/authz/oauth/v20/.well-known/openid-configuration
```

**SSO 总工时**: 2-3 天

**SSO 验收标准**:
- 本地账号密码登录正常
- MaxKey SSO 跳转→认证→回调→自动登录正常
- SSO 用户首次登录自动创建本地账号并关联
- SSO 登录失败有友好错误提示

#### P2-C: 数据权限

| # | 子任务 | 优先级 | 预估工时 | 关键文件 |
|---|--------|--------|---------|---------|
| DP-1 | `@DataScope` 注解定义 | P1 | 0.5 天 | `backend/.../annotation/DataScope.java`（新建） |
| DP-2 | MyBatis-Plus DataPermissionHandler 实现 | P1 | 1 天 | `backend/.../config/MyBatisPlusConfig.java`（注册 DataPermissionInterceptor）、`DataPermissionHandler` 实现（解析 @DataScope 注解拼接 SQL 条件） |
| DP-3 | 数据权限策略 | P1 | 0.5 天 | 支持四种策略：全部数据 / 本部门 / 本部门及以下 / 仅本人 |
| DP-4 | AOP 切面注入 | P1 | 0.5 天 | 切面拦截带 @DataScope 的 Mapper 方法，注入当前用户部门信息 |

**数据权限总工时**: 2-3 天

**数据权限验收标准**:
- `@DataScope(scope = DataScopeType.DEPT)` 注解加在 Mapper 方法上自动过滤
- 四种数据范围策略正确工作
- 超级管理员不受数据权限限制

### 第三阶段：质量提升（1-2 周）

| # | 任务 | 优先级 | 文件/范围 | 预估工时 | 验收标准 |
|---|------|--------|----------|---------|---------|
| P3-1 | 修复 HTTP 客户端泛型推断（根除 `any`） | P0 | `src/utils/http.ts`（响应拦截器）、`src/api/*.ts`（19 个文件）、`src/services/*.ts`（13 个文件） | 2-3 天 | 606 处 `any` 降至 <50 处，`response as any` 全部消除 |
| P3-2 | 统一 Token 存储方案 | P1 | `src/utils/http.ts`、`src/layouts/AppLayout.tsx`、`src/api/workflow.ts` | 0.5 天 | 单一 Token 存储函数，所有组件通过 `http` 实例发送 |
| P3-3 | 关键页面单元测试 | P1 | `tests/unit/`（新增 15-20 个测试文件） | 3-4 天 | 覆盖 WorkOrderFormPage、AssetFormPage、DisposalDetailPage 等高风险页面 |
| P3-4 | Services 层测试 | P1 | `tests/unit/services/`（新增 12 个测试文件） | 2 天 | 13 个 services 至少 10 个有对应测试 |
| P3-5 | vitest 覆盖率门槛扩展 | P1 | `frontend/vitest.config.ts` | 0.5 天 | `coverage.all=true`，门槛适用于所有 `src/` 文件 |
| P3-6 | 清理 `src/mocks/` 目录 | P2 | `src/mocks/` 目录 | 1h | 移除 MSW handlers 和 assetDetail.mock.ts（920 行），或迁移到测试专用目录 |
| P3-7 | 清理误装依赖 | P2 | `package.json` | 0.5h | 移除 `@vue/test-utils`、评估 `@google/stitch-sdk` |
| P3-8 | AppLayout user_info 反序列化安全 | P2 | `src/layouts/AppLayout.tsx:144-145` | 0.5h | 添加 try-catch 包裹 `JSON.parse(localStorage.getItem('user_info'))` |
| P3-9 | console 残留清理 | P2 | `src/services/`, `src/mocks/` | 1h | 调试残留 console.debug 全部移除，保留合理的 console.error/warn |

**P3 关键依赖**:
- P3-1（any 类型治理）是 P3-3/P3-4（测试编写）的前置条件：泛型修复后类型推断更准确，测试编写更容易
- P3-5（覆盖率门槛扩展）应在 P3-3/P3-4 之后执行，避免新增测试前门槛过于严格导致构建失败

### 第四阶段：增强功能（1-2 周）

| # | 任务 | 优先级 | 文件/范围 | 预估工时 | 验收标准 |
|---|------|--------|----------|---------|---------|
| P4-1 | 前端路由守卫增强 | P1 | `frontend/src/router/index.tsx` | 1 天 | 未登录跳转 /login，无权限跳转 403 页面，角色路由守卫 |
| P4-2 | 全局错误边界 | P1 | `frontend/src/components/ErrorBoundary.tsx`（新建） | 0.5 天 | React 错误边界包裹路由，未捕获异常显示友好页面 |
| P4-3 | API 请求重试/超时策略 | P2 | `frontend/src/utils/http.ts` | 0.5 天 | 添加 axios-retry，5xx 自动重试 2 次，幂等请求重试 |
| P4-4 | i18n 框架引入 | P2 | `frontend/src/locales/`、安装 `react-i18next` | 2-3 天 | 活跃页面文案提取到 `locales/zh-CN/` JSON 文件，至少覆盖 10 个页面 |
| P4-5 | 大屏可视化深化 | P3 | `frontend/src/pages/bigscreen/BigScreen3DPage.tsx` | 2-3 天 | echarts 高级图表、实时数据推送（WebSocket）、导出功能 |
| P4-6 | Analytics 模块深化 | P3 | `frontend/src/pages/analytics/AnalyticsPage.tsx` | 1-2 天 | 高级图表、数据钻取、时间范围选择器增强 |
| P4-7 | 无障碍（a11y）基础加固 | P3 | 37 个页面 | 2-3 天 | 所有表单 label+htmlFor 关联、Modal aria-modal、表格 aria-label、Icon 按钮 aria-label |
| P4-8 | 文档体系建设 | P3 | `docs/` | 1-2 天 | API 接口文档（Swagger/OpenAPI）、组件文档（Storybook 或 MDX）、部署指南 |

---

## 4. 高风险项详细修复方案

### 4.1 双套页面代码清理方案（TD-001）

**问题**: `src/pages/`（活跃，37 个 Page）和 `src/app/pages/`（死代码，127 个 tsx 文件 + 214 个其他文件）并存。

**修复步骤**:

```bash
# Step 1: 确认 src/app/ 无活跃引用
grep -r '@/app/' frontend/src/pages/ frontend/src/components/ frontend/src/services/ frontend/src/api/ frontend/src/hooks/ frontend/src/router/

# Step 2: 确认 src/app/ 下无被间接引用的工具/类型
grep -r "from '@/app" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "src/app/"

# Step 3: 确认 entry point 不引用 src/app/
grep -r "src/app" frontend/index.html frontend/src/main.tsx frontend/src/router/index.tsx

# Step 4: 如果以上 grep 均无输出，安全删除
rm -rf frontend/src/app/

# Step 5: 验证
cd frontend && npm run build && npx vitest run
```

**注意事项**:
- `src/app/pages/AssetBulkImport/` 中 `AssetBulkImportPage.tsx:245` 有 Token 绕过问题（TD-002 范围），但整个 `src/app/` 目录是死代码，随此任务一并删除即可
- `src/app/context/AuthContext.tsx` 是独立认证上下文，与 `src/pages/` 使用的 localStorage 模式不同，属于历史遗留

**预期收益**: 减少 ~341 个文件、消除维护混淆、减少 bundle size（如果 tree-shaking 未完全生效）

### 4.2 组件绕过统一 HTTP 客户端修复方案

**问题**: 多个组件直接从 `localStorage` 读取 `auth_token` 构造 `Authorization` 头，绕过了 `src/utils/http.ts` 的统一拦截器。

**受影响文件**:

| 文件 | 行号 | 当前代码 | 修复方向 |
|------|------|---------|---------|
| `src/components/inventory/ScopeSelector.tsx` | :95 | `localStorage.getItem('auth_token')` | 改用 `http.get()` |
| `src/api/workflow.ts` | :24 | `localStorage.getItem('user_info')` 解析用户 ID | 从后端 `/api/v1/users/me` 获取当前用户信息 |
| `src/layouts/AppLayout.tsx` | :133-136 | 多 Token key 清理 | 统一使用 `auth_token`，移除 `ams_auth_token` |
| `src/layouts/AppLayout.tsx` | :144-145 | `JSON.parse` 无 try-catch | 添加 try-catch + fallback |

**修复代码示例（ScopeSelector.tsx）**:

```typescript
// Before
const token = localStorage.getItem('auth_token');
const response = await fetch('/api/v1/locations', {
  headers: { Authorization: `Bearer ${token}` }
});

// After
import http from '@/utils/http';
const response = await http.get<Location[]>('/v1/locations');
```

**修复代码示例（workflow.ts 用户 ID 获取）**:

```typescript
// Before
const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
const userId = userInfo.id;

// After
import http from '@/utils/http';

async function getCurrentUserId(): Promise<number> {
  const user = await http.get<{ id: number }>('/v1/users/me');
  return user.id;
}
```

### 4.3 Mock 数据残留清理方案

**问题**: 三个组件仍使用模拟数据而非真实 API。

| 组件 | 当前 Mock | 修复方向 |
|------|----------|---------|
| `WorkOrderList/index.tsx:120` | `generateMockData()` 生成工单 | 调用 `getWorkOrderList()` API |
| `NotificationBell.tsx:391-393` | 空数组 `mockData` | 调用 `getNotifications()` API |
| `ImportPanel/FileUploader.tsx:266-289` | `simulateUpload` 用 `setInterval` 模拟进度 | 实现 `FormData` + `axios.post` + `onUploadProgress` |

**FileUploader 真实上传实现方案**:

```typescript
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  await http.post('/v1/assets/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total) {
        const percent = Math.round((event.loaded * 100) / event.total);
        setProgress(percent);
      }
    },
  });
};
```

**`src/mocks/` 目录清理**:
- `assetDetail.mock.ts`（920 行）— 移除或迁移到 `tests/mocks/` 供测试使用
- `handlers/` 子目录（asset.ts、dashboard.ts）— MSW 开发拦截器，移除
- `inventoryHandlers.ts`、`workOrderHandlers.ts` — 移除

---

## 5. 中等风险项修复策略

### 5.1 `any` 类型治理路线

**根因**: `src/utils/http.ts` 响应拦截器 `(response) => response.data` 解包后，泛型 `R` 默认为 `unknown`，导致调用方需要 `response as any` 断言。

**治理方案**（分三步）:

| 步骤 | 改动 | 影响范围 | 工时 |
|------|------|---------|------|
| Step 1 | 修改 `http.ts` 响应拦截器，保留完整 AxiosResponse 但添加 `.data` 快捷属性 | `src/utils/http.ts` | 1h |
| Step 2 | 为 `src/api/*.ts`（19 个文件）的每个函数添加正确的返回类型 | `src/api/` | 6-8h |
| Step 3 | 为 `src/services/*.ts`（13 个文件）消除 `response as any` | `src/services/` | 4-6h |

**Step 1 代码方案（http.ts）**:

```typescript
// 当前：解包后泛型推断断裂
http.interceptors.response.use(
  (response: AxiosResponse) => response.data,  // 返回 ApiResponse<T>，但 T 丢失
);

// 改进方案 A：不修改拦截器，API 层显式声明类型
// api/asset.ts
export const getAssetList = (params?: AssetListQuery) =>
  http.get<ApiResponse<PageData<Asset>>>('/v1/assets', { params });
// 调用方拿到的 res 类型为 ApiResponse<PageData<Asset>>，无需 as any
```

```typescript
// 改进方案 B：引入泛型封装函数
// utils/http.ts
export function api<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return http.request<ApiResponse<T>>(config);
}
```

**推荐方案 A**（最小改动）：保持拦截器不变，在每个 API 函数调用时显式传入泛型参数。因为当前 `UnwrappedHttpClient` 的类型签名已经支持 `http.get<T>()`，只需要在调用处补全 `<ApiResponse<XXX>>` 即可。

### 5.2 测试覆盖率提升计划

**当前状态**:
- 测试文件: 39 个（26 个 unit + 8 个 component + 4 个 e2e + 1 service）
- 覆盖率门槛: 仅适用于 `src/api/inventory.ts`
- 未覆盖模块: 37 个页面、12 个 services、8 个 hooks

**提升计划（按优先级）**:

| 批次 | 范围 | 新增测试文件数 | 预估工时 |
|------|------|-------------|---------|
| Batch 1 | 高风险页面（WorkOrderFormPage、AssetFormPage、DisposalDetailPage、AssetImportExportPage） | 4-6 | 2 天 |
| Batch 2 | Services 层（剩余 12 个未测试 service） | 12 | 2 天 |
| Batch 3 | Hooks（8 个 hooks） | 8 | 1 天 |
| Batch 4 | 其余页面 | 15-20 | 3-4 天 |
| Batch 5 | vitest 覆盖率门槛扩展 + CI 质量门禁 | 1 | 0.5 天 |

**覆盖率目标**:
- Phase 1 完成后: 关键页面和 services 覆盖率 > 60%
- Phase 2 完成后: 全项目行覆盖率 > 50%
- 长期目标: 行覆盖率 > 80%，分支覆盖率 > 70%

### 5.3 硬编码值替换方案

**受影响页面**:

| 页面 | 硬编码项 | 修复方向 |
|------|---------|---------|
| `DisposalDetailPage.tsx:145,154` | `{ version: 1 }` | 从 `detail.version` 获取 |
| `AssetScrapFormPage.tsx:262` | 报废编号/申请人 | 后端生成编号，前端从 `/api/v1/users/me` 获取用户 |
| `AssetTransferFormPage.tsx:244` | 调拨编号/申请人 | 同上 |
| `AssetClearanceFormPage.tsx:109` | 清退编号/申请人 | 同上 |
| `AssetCompensationFormPage.tsx:58,297` | DEPT_OPTIONS/赔偿编号 | `getDeptTree()` API + 同上 |
| `WorkOrderFormPage.tsx:278` | MTTR `2.4h` / 负载 `85%` | 从统计 API 获取或移除装饰性卡片 |
| `EquipmentPage.tsx:238` | `usageRate` 硬编码 75 | 从利用率 API 获取或移除 |

**统一方案**: 创建 `useCurrentUser()` hook 和 `useBusinessNumber(type)` 工具函数。

### 5.4 类型安全加固

| 文件 | 问题 | 修复 |
|------|------|------|
| `AuditDetailPage.tsx:113-118` | `as unknown as Record<string, string>` | 定义 `AuditLogDetail` 接口 |
| `AssetListPage.tsx:104` | `(res as unknown as ApiResponse<PageData<AssetListItem>>)` | 修复 `useAssetList` hook 返回类型 |
| `services/*.ts` | `return response as any` | 泛型参数修复（见 5.1） |
| `pages/*.tsx` | `Column<any>[]` | 定义各模块的 Column 类型 |

---

## 6. 技术选型建议

### 6.1 已确定选型（来自 debate.json）

| 决策项 | 选型 | 理由 |
|--------|------|------|
| RBAC 方案 | **Option C: 纯自定义实现** | forthAMS 已有 Spring Security 6 + User/Dept/Role 实体，增量成本最低，零技术债务 |
| MaxKey SSO | **Spring Security 6 OAuth2 Client** | 标准路径，MaxKey 官方有完整集成示例 |
| 数据权限 | **MyBatis-Plus DataPermissionInterceptor + 自定义 @DataScope** | 参考 RuoYi 思路，2-3 天可实现 |

### 6.2 新增技术选型需求

| 需求 | 推荐方案 | 备选 | 理由 |
|------|---------|------|------|
| i18n 框架 | **react-i18next** | react-intl | 社区最大、配置简单、支持懒加载 namespace |
| 状态管理 | **维持当前 useState + react-query** | Zustand/Jotai | 当前方案够用，无需引入额外依赖 |
| 图表库统一 | **维持双库** echarts（大屏）+ recharts（页面） | 统一到 echarts | 功能不重叠，大屏用 echarts 是正确的性能选择 |
| 文件上传 | **axios onUploadProgress** | tus-js-client | 项目已有 axios，原生支持进度回调 |
| API 类型安全 | **现有 http.ts + 显式泛型** | tRPC / Zodios | 最小改动方案，不引入新依赖 |

---

## 7. 资源和时间估算

### 7.1 总工时估算

| 阶段 | 工时范围 | 核心任务 |
|------|---------|---------|
| **P1 紧急修复** | 10-14 小时（1.5-2 天） | 死代码清理、Token 绕过修复、Mock 清理、version 硬编码 |
| **P2 核心功能** | 80-120 小时（10-15 天） | RBAC 8-12天、SSO 2-3天、数据权限 2-3天 |
| **P3 质量提升** | 48-64 小时（6-8 天） | any 类型治理、测试覆盖、依赖清理 |
| **P4 增强功能** | 48-64 小时（6-8 天） | i18n、路由守卫、a11y、文档 |
| **总计** | **186-262 小时（23-33 天）** | — |

### 7.2 关键路径分析

```
P1 紧急修复（2天）
    ↓
P2-A RBAC 数据库设计（1天）→ P2-A 后端 CRUD（2天）→ P2-A 前端管理页面（2天）→ P2-A 动态路由（1天）
    ↓（可并行）
P2-B SSO 集成（2-3天）
    ↓（可并行）
P2-C 数据权限（2-3天）
    ↓
P3-1 any 类型治理（2-3天）→ P3-3/P3-4 测试编写（5-6天）
    ↓
P4 增强功能（6-8天）
```

**关键路径**: P1 → RBAC 数据库设计 → RBAC 全链路 → any 类型治理 → 测试 → 增强功能

**可并行任务**:
- P2-B（SSO）和 P2-C（数据权限）可与 P2-A（RBAC）并行
- P3-1（any 类型治理）可与 P2 后半段并行启动
- P4 各子任务可按需独立启动

### 7.3 里程碑建议

| 里程碑 | 时间点 | 交付物 |
|--------|--------|--------|
| M1: 安全基线达标 | 第 2 天 | P1 全部完成，0 死代码、0 Token 绕过、0 Mock 残留 |
| M2: RBAC MVP | 第 10 天 | 用户/角色/部门 CRUD、动态菜单、基础权限控制 |
| M3: 认证体系完整 | 第 14 天 | MaxKey SSO + 数据权限上线 |
| M4: 质量基线达标 | 第 22 天 | any < 50 处、测试覆盖 > 50%、vitest 门槛全量生效 |
| M5: 功能增强完成 | 第 30 天 | i18n 框架、路由守卫、a11y 基础、文档体系 |

---

## 8. 风险评估

### 8.1 各阶段关键风险

| 阶段 | 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|------|---------|
| P1 | 删除 `src/app/` 后发现被间接引用导致构建失败 | 低 | 高 | 先执行 grep 全量搜索确认无引用，分批删除并每次构建验证 |
| P1 | Mock 清理后后端 API 未实现导致功能缺失 | 中 | 中 | 与后端确认 API 就绪状态，未就绪的添加 feature flag 或 loading 占位 |
| P2 | RBAC 数据库迁移与现有数据冲突 | 中 | 高 | 先在测试环境验证 DDL，提供回滚脚本，增量迁移 |
| P2 | MaxKey 环境/网络不可达 | 中 | 中 | SSO 功能降级为可选，不影响本地认证 |
| P3 | any 类型修复引入大量改动导致回归 | 中 | 高 | 分批修复，每批修复后运行全量测试 |
| P3 | 测试覆盖率门槛提升导致 CI 频繁失败 | 低 | 中 | 先添加测试再提升门槛，分阶段收紧 |
| P4 | i18n 提取工作量超预期（20 个页面 × ~50 处文案） | 中 | 低 | 按优先级分批提取，先覆盖核心页面 |

### 8.2 整体风险缓解策略

1. **每个阶段完成后执行全量验证**: `npm run build && npx vitest run`，确保零回归
2. **分批次提交**: 每个子任务完成后独立 commit，便于回滚
3. **后端 API 协调**: P2 开始前与后端团队对齐 API 端点和数据结构
4. **Feature Flag**: RBAC 和 SSO 功能通过环境变量控制开关，降低上线风险
5. **文档同步更新**: 每个阶段完成后更新 README 和 API 文档

---

## 附录 A: 项目技术栈清单

### 前端

| 依赖 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 框架 |
| React Router | 7.13.0 | 路由 |
| TypeScript | ^5.9.3 | 类型安全 |
| Vite | 6.4.2 | 构建工具 |
| Tailwind CSS | 4.1.12 | 样式 |
| shadcn/ui (Radix) | 30+ packages | 组件库 |
| TanStack Query | v5 | 服务端状态管理 |
| react-hook-form | v7 | 表单管理 |
| zod | — | Schema 校验 |
| axios | ^1.14.0 | HTTP 客户端 |
| recharts | — | 页面级图表 |
| echarts | — | 大屏图表 |
| sonner | — | Toast 通知 |
| vitest | ^3.0.8 | 测试框架 |

### 后端

| 依赖 | 版本 | 用途 |
|------|------|------|
| Spring Boot | 3.2.5 | 应用框架 |
| Spring Security | 6 | 认证授权 |
| MyBatis-Plus | 3.5.9 | ORM |
| MySQL | — | 数据库 |
| JWT | — | Token 认证 |

## 附录 B: 活跃页面模块清单

| 模块目录 | 页面数 | 关键文件 |
|---------|--------|---------|
| dashboard | 1 | DashboardPage.tsx |
| analytics | 1 | AnalyticsPage.tsx |
| asset | 3 | AssetListPage.tsx, AssetDetailPage.tsx, AssetFormPage.tsx |
| equipment | 1 | EquipmentPage.tsx |
| idle | 1 | IdleAssetsPage.tsx |
| depreciation | 1 | DepreciationListPage.tsx |
| inventory | 4 | InventoryTasksPage.tsx, InventoryDetailPage.tsx, RFIDScanPage.tsx, InventoryFormPage.tsx |
| workorder | 3 | WorkOrderListPage.tsx, WorkOrderDetailPage.tsx, WorkOrderFormPage.tsx |
| approval | 1 | ApprovalListPage.tsx |
| retirement | 3 | RetirementListPage.tsx, RetirementDetailPage.tsx, RetirementFormPage.tsx |
| disposal | 5 | DisposalListPage.tsx, DisposalDetailPage.tsx, AssetScrapFormPage.tsx, AssetTransferFormPage.tsx, AssetClearanceFormPage.tsx, AssetCompensationFormPage.tsx |
| workflow | 2 | WorkflowCenterPage.tsx, WorkflowDesignerPage.tsx |
| audit | 2 | AuditDashboardPage.tsx, AuditDetailPage.tsx |
| settings | 1 | SettingsPage.tsx |
| locations | 1 | LocationsPage.tsx |
| vendors | 1 | VendorsPage.tsx |
| notifications | 1 | NotificationsPage.tsx |
| auth | 1 | LoginPage.tsx |
| bigscreen | 1 | BigScreen3DPage.tsx |
| AssetImportExport | 1 | AssetImportExportPage.tsx |

## 附录 C: 前一轮审查残留项（93→100 分差距）

| # | 页面 | 问题 | 难度 | 本方案定位 |
|---|------|------|------|-----------|
| 1 | InventoryDetailPage | scopeId 展示原始 ID 未做名称解析 | LOW | P1-6 |
| 2 | AuditDetailPage | 类型未定义字段 `as unknown as Record` | MEDIUM | P1-5 |
| 3 | DisposalDetailPage | version 硬编码 `{ version: 1 }` | MEDIUM | P1-4 |
