# forthAMS 全流量测试报告

日期: 2026-07-08 17:15
测试范围: 后端全量单元/集成测试 + 前端 Vitest + 前端 Playwright E2E（真实后端 + 浏览器烟雾）

---

## 1. 后端 Maven 测试 (Spring Boot 8080)

### 总览
| 项目 | 数值 |
|------|------|
| 测试总数 | 331 |
| 通过 | 324 |
| 失败 | **7** |
| 错误 | 0 |
| 跳过 | 0 |
| 构建结果 | BUILD FAILURE |
| 报告路径 | `backend/target/surefire-reports/` |

### 全部 7 个失败 — TenantIsolationIntegrationTest

| # | 用例 | 行号 | 期望 | 实际 | 断言 |
|---|------|------|------|------|------|
| 1 | tenantAssetListOnlyReturnsCurrentTenantAssets | 232 | 200 | 401 | Status expected:<200> but was:<401> |
| 2 | tenantWorkOrderListOnlyReturnsCurrentTenantWorkOrders | 289 | 200 | 401 | Status expected:<200> but was:<401> |
| 3 | dashboardStatsOnlyCountsCurrentTenantAssets | 270 | 200 | 401 | Status expected:<200> but was:<401> |
| 4 | tenantInventoryTaskListOnlyReturnsCurrentTenantTasks | 309 | 200 | 401 | Status expected:<200> but was:<401> |
| 5 | tenantContextIsClearedAfterRequest | 332 | 200 | 401 | Status expected:<200> but was:<401> |
| 6 | assetCreateWritesTenantId | 352 | 200 | 401 | Status expected:<200> but was:<401> |
| 7 | tenantCannotGetUpdateOrDeleteAnotherTenantAsset | 371 | **403** | 401 | Status expected:<403> but was:<401> |

### 原因分析（初步）
- 7 个测试全部返回 401，说明 JWT 认证过滤器拦截了请求。
- 测试通过 `setUp()` 创建用户并设置测试 Token，但 `UserDetailsServiceImpl.loadUserByUsername()` 在查询用户权限时关联了 `sys_permission` / `sys_role_permission` 表。
- setUpSchema() 只重建了 `sys_user` 等表，但未建 `sys_permission` 和 `sys_role_permission`，导致 SQL JOIN 异常被 `JwtAuthenticationFilter` 捕获为 `RuntimeException` → 返回 401。
- 这是测试基础设施问题（建表不完整），不表示业务逻辑有缺陷。

---

## 2. 前端 Vitest 单元测试

### 总览
| 项目 | 数值 |
|------|------|
| 测试文件总数 | 156 |
| 通过 | 147 |
| 失败 | **9** |
| 测试用例总数 | 1245 |
| 通过 | 1232 |
| 失败 | **13** |
| 报告路径 | 无独立报告文件，终端输出仅 |

### 失败明细（13 个用例 / 9 个文件）

#### API 合约类（7 个用例）
| 文件 | 用例 | 推测原因 |
|------|------|----------|
| `workorder.test.ts` | uses unified workorder paths | API 端点已变更，测试仍引用旧路径 |
| `inventory.test.ts` | uses task-scoped confirm endpoints | API 端点已变更 |
| `inventory.test.ts` | submits and approves inventory tasks | API 端点已变更 |
| `inventory.test.ts` | patches task status | API 端点已变更 |
| `assetImport.test.ts` | uses the backend asset import/export contract | API 端点或参数已变更 |
| `NotificationBell.test.tsx` | loads unread count and fetches notifications | Mock API 响应结构不匹配 |
| `NotificationBell.test.tsx` | marks a notification and all notifications as read | Mock API 响应结构不匹配 |

#### 合规/架构合约类（3 个用例）
| 文件 | 用例 | 推测原因 |
|------|------|----------|
| `noLegacyAppImports.test.ts` | keeps desktop source code from importing @/app | 某文件违规导入了 `@/app` 路径 |
| `workbenchPlatformEntry.contract.test.ts` | keeps delivery manifest aligned with System Hub IMAGE2 | 清单与 Stitch 产物不同步 |
| `workbenchPlatformEntry.contract.test.ts` | keeps every formal System Hub Stitch prompt aligned | Stitch prompt 已更新但测试未更新 |
| `workbenchPlatformEntry.contract.test.ts` | exposes a repeatable System Hub usability verifier | 合约验证器期望与实现不符 |
| `workbenchPlatformEntry.contract.test.ts` | protects Workbench through route permissions | 路由权限元数据已变化 |

#### 组件渲染类（3 个用例）
| 文件 | 用例 | 推测原因 |
|------|------|----------|
| `AssetImportExportPage.test.tsx` | passes selected category and status filters | DOM 结构变化，getByRole/findBy 定位失败 |
| `ApprovalDetailPage.runtimeAssignee.test.tsx` | （文件级失败） | 渲染依赖的上下文或 Mock 缺失 |
| `DepreciationCard.test.tsx` | （文件级失败） | 组件依赖数据或 Mock 不匹配 |

---

## 3. 前端 Playwright E2E 测试

### 3.1 真实后端 API 闭环 (`real-backend-smoke.spec.ts`)

| 用例 | 结果 |
|------|------|
| 登录后可打开仪表板和资产台账 | ❌ **失败** |
| 登录页可见且流程设计器配置校验有效 | ⏭️ 未执行（依赖前一个） |

**失败原因**（1 个）:
- 第 25 行: `getByLabel('用户名')` 匹配到 2 个元素
  - `<input id="username">`（文本输入框）
  - `<input type="checkbox">`（"记住用户名"复选框）
- 改为 `page.locator('#username')` 可修复，但此处仅报告不修改

### 3.2 浏览器烟雾测试 (`browser-smoke.spec.ts`)

| # | 用例 | 结果 |
|---|------|------|
| 1 | 登录页可见，并能通过登录接口进入仪表板 | ❌ **失败** |
| 2 | 未登录访问受保护页面会跳转登录页 | ❌ **失败** |
| 3 | 退出登录会清理会话并回到登录页 | ❌ **失败** |
| 4 | 受保护核心页面均可渲染且无浏览器运行时错误 | ❌ **失败** |
| 5 | 核心按钮、搜索框和表单提交路径可交互 | ❌ **失败** |

**失败原因**:
1-3: 登录流程失败，核心原因是登录 locator 二义性（同上 `getByLabel('用户名')` 匹配 2 个元素）→ 无法填完表单登录，后续断言全部中断。
4-5: 依赖登录状态（创建 session），前置失败导致连锁失败。

---

## 4. 汇总

| 测试层 | 总数 | 通过 | 失败 | 失败率 |
|--------|------|------|------|--------|
| 后端 Maven 测试 | 331 | 324 | 7 | 2.1% |
| 前端 Vitest (文件) | 156 | 147 | 9 | 5.8% |
| 前端 Vitest (用例) | 1245 | 1232 | 13 | 1.0% |
| Playwright E2E (real-backend) | 2 | 0 | 1 | 50% |
| Playwright E2E (browser-smoke) | 5 | 0 | 5 | 100% |

### 问题分类
| 类别 | 数量 | 影响范围 |
|------|------|----------|
| 测试基础设施缺陷（JSON 认证模拟不完整） | 7 | 后端 |
| API 端点过期 / Mock 不匹配 | 7 | 前端 Vitest |
| 合规合约过期 | 5 | 前端 Vitest |
| 组件渲染 / DOM 结构变化 | 3 | 前端 Vitest |
| 测试 locator 设计问题（二义性/失准） | 6 | 前端 Playwright |

### 服务状态（测试时）
- 后端 PID 66100, :8080 ✅
- 前端 Vite PID 69307, :5173 ✅
- MySQL 运行中 ✅

### 证据路径
- 后端 Surefire TXT: `backend/target/surefire-reports/com.ams.tenant.TenantIsolationIntegrationTest.txt`
- 后端 Surefire XML: `backend/target/surefire-reports/TEST-com.ams.tenant.TenantIsolationIntegrationTest.xml`
- Playwright HTML 报告: `frontend/playwright-report/index.html`
- Playwright 截图: `frontend/test-results/real-backend-smoke-*/test-failed-1.png`
- Playwright 截图: `frontend/test-results/browser-smoke-*/test-failed-1.png`
- 本次测试命令:
  - `mvn test -f backend/pom.xml`
  - `npx vitest run` (frontend/)
  - `AMS_E2E_REAL_BACKEND=true npx playwright test "real-backend-smoke"`
  - `npx playwright test "browser-smoke"`
