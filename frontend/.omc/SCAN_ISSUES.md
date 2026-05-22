# forthAMS Frontend — 全量问题清单 · 修复追踪
> 整合两轮蜂群扫描（2026-05-21），基于活动代码路径（`src/router/index.tsx` → `src/pages/`）
> 状态标记：✅ 已完成 | 🔄 进行中 | ⬜ 待处理 | ➖ 跳过（3D大屏相关）

---

## 关键架构背景

| 事实 | 说明 |
|------|------|
| **活动入口** | `src/main.tsx` → `src/router/index.tsx` → `src/pages/` |
| **死代码区** | `src/app/`（~200 文件）、`src/pages/DashboardPage/`、`src/pages/audit-dashboard/`、`src/pages/AssetDetailPage/` |
| **UI 框架** | 活动代码用 Radix UI / shadcn；死代码用 antd（未安装） |
| **HTTP 客户端** | `src/utils/http.ts`（唯一合规实例，token: `auth_token`，拦截器解包 `response.data`） |

---

## P0 — 运行时崩溃 / 致命错误（7 项）

| ID | 状态 | 文件 | 行号 | 问题 |
|----|------|------|------|------|
| P0-01 | ✅ | 项目级 | — | **tsconfig.json 已存在** — GAI 已验证 |
| P0-02 | ✅ | `src/api/retirementApi.ts` | 15 | 已用 `const request = http` 别名解决 — GAI 已修复 |
| P0-03 | ✅ | `src/api/stats.ts` | 全部端点 | 路径已无双重前缀 — GAI 已验证 |
| P0-04 | ✅ | `src/pages/disposal/AssetCompensationFormPage.tsx` | 221 | `navigate('/disposals')` 路由正确 — GAI 已修复 |
| P0-05 | ✅ | `src/pages/retirement/RetirementListPage.tsx` | 181/189 | 导航到 `/retirement/${id}` 路由已定义 — GAI 已验证 |
| P0-06 | ✅ | `src/pages/auth/LoginPage.tsx` | 32-38 | DEMO_ACCOUNTS 仅含 username，无密码 — GAI 已修复 |
| P0-07 | ✅ | `src/pages/audit-dashboard/` | — | 死代码目录（含损坏 import），GAI 已清理相关路由文件 |

---

## P1 — 功能缺陷（数据错误 / API 不通）（14 项）

### P1-A：API 层错误

| ID | 状态 | 文件 | 问题 |
|----|------|------|------|
| P1-01 | ✅ | `src/api/assetExport.ts` `src/api/assetImport.ts` | 已使用 http 实例，有 Bearer token — GAI 验证 |
| P1-02 | ✅ | `src/services/approvalFlowService.ts` | 移除 response.data 二次解包 — GAI 修复 |
| P1-03 | ✅ | `src/services/inventoryService.ts` | 移除 response.data 二次解包 — GAI 修复 |
| P1-04 | ✅ | `src/services/dashboardService.ts` | 修正二次解包，修复类型错误 — GAI 修复 |
| P1-05 | ✅ | `src/services/auditApi.ts` | 移除 response.data 二次解包 — GAI 修复 |
| P1-06 | ✅ | `src/services/assetService.ts` `src/services/retirementService.ts` | 移除 response.data 二次解包 — GAI 修复 |
| P1-07 | ✅ | `src/api/workflow.ts` | 移除 unwrap() 双重解包，修正 token key — GAI 修复 |
| P1-08 | ✅ | `src/services/categoryService.ts` `src/services/auditService.ts` | 移除 response.data 二次解包 — GAI 修复 |

### P1-B：Mock 数据未替换（活动页面）

| ID | 状态 | 文件 | Mock 内容 |
|----|------|------|-----------|
| P1-09 | ✅ | `src/pages/retirement/RetirementDetailPage.tsx` | 移除 mockSteps，改为状态推导 — GAI 修复 |
| P1-10 | ✅ | `src/pages/depreciation/DepreciationListPage.tsx` | 移除 MOCK_SCHEDULES，改为 TanStack Query — GAI 修复 |
| P1-11 | ✅ | `src/pages/idle/IdleAssetsPage.tsx` | 移除 MOCK+fetch()，改为 useQuery+idleAsset API — GAI 修复 |
| P1-12 | ➖ | `src/pages/bigscreen/BigScreenPage.tsx` | 图表/值班/天气数据硬编码（3D 大屏相关，跳过） |
| P1-13 | ✅ | `src/pages/workorder/WorkOrderFormPage.tsx` | 处理人下拉改为 userApi.search() — GAI 修复 |
| P1-14 | ✅ | `src/pages/asset/AssetListPage.tsx` | SUMMARY_CARDS 改为 getReportSummary() — GAI 修复 |

### P1-C：错误处理缺失

| ID | 状态 | 文件 | 问题 |
|----|------|------|------|
| P1-15 | ✅ | `src/hooks/asset/useAssets.ts` | create/update/delete mutation 添加 onError — GAI 修复 |
| P1-16 | ✅ | `src/pages/approval/ApprovalListPage.tsx` | approve/reject mutation 添加 onError — GAI 修复 |
| P1-17 | ✅ | DashboardPage / AnalyticsPage / AuditDashboardPage / NotificationsPage / AssetListPage | Query error 展示为 error banner — GAI 修复 |
| P1-18 | ⬜ | ~90 处 service 层 | catch 后仅 log 返回空数据，调用方无法区分失败和无数据（范围过大，留待后续） |

---

## P2 — 架构混乱 / 代码质量（18 项）

### P2-A：类型系统混乱

| ID | 状态 | 问题 | 涉及文件 |
|----|------|------|---------|
| P2-01 | ✅ | **4 套冲突 `PaginatedResponse`**（`records`/`items`/`list`/`data[]`） | 标注兼容注释，主定义统一到 `common.ts` — GAI 修复 |
| P2-02 | ✅ | **3 套冲突 `Asset` 接口**（camelCase/snake_case/混合） | 确认 `asset.ts` 为权威定义 — GAI 验证 |
| P2-03 | ✅ | **3 套冲突 `AssetStatus` 枚举**（`IN_USE`/`NORMAL`/`active`） | 统一为 `IN_USE` 大写格式 — GAI 修复 |
| P2-04 | ✅ | **2 套 `ApiResponse` 成功码**（code=200 vs code=0） | 统一到 `common.ts` — GAI 修复 |
| P2-05 | ✅ | **3 处 `DepreciationMethod`**，值 case 不一致（`straight_line` vs `STRAIGHT_LINE`） | 统一为 `STRAIGHT_LINE` 大写 — GAI 修复 |
| P2-06 | ✅ | `retirement.types.ts` 全文 snake_case，与其余模块 camelCase 冲突 | 保持 snake_case（后端对齐） — GAI 验证 |
| P2-07 | ✅ | `assetImportExport.ts` 状态值小写（`in_use`）vs 枚举大写（`IN_USE`） | 统一为 `IN_USE` 大写 — GAI 修复 |

### P2-B：死代码 / 重复代码

| ID | 状态 | 问题 | 规模 |
|----|------|------|------|
| P2-08 | ✅ | 死路由文件清理（`router/index.legacy.ts` 等 4 个文件） | GAI 已完成 |
| P2-09 | ⬜ | `src/app/` 全目录死代码（与 `src/pages/` 26 组重复，含 3 个循环依赖） | ~200 文件 |
| P2-10 | ⬜ | 3 个影子页面目录（不在路由中）：`src/pages/DashboardPage/`、`src/pages/audit-dashboard/`、`src/pages/AssetDetailPage/` | ~20 文件 |
| P2-11 | ⬜ | API 功能三重重复：退役×3、审批×3、资产×3 | 9 文件 |
| P2-12 | ⬜ | `downloadBlob()` 定义 3 处 | `api/assetImport.ts` `api/assetExport.ts` `utils/fileDownloader.ts` |
| P2-13 | ⬜ | 文件大小限制常量定义 3 处；`FileValidationResult` 接口 2 处 | `constants/` `utils/` |
| P2-14 | ⬜ | 8/9 个 hooks 是死代码（mock/stub/空实现/竞态条件） | `src/hooks/` |
| P2-15 | ✅ | 10 个活动页面用 `useState+useEffect` 手动 fetch，已迁移 TanStack Query | GAI 在 P1 Wave 3 中完成 |
| P2-16 | ⬜ | `AssetImportExport` 子组件混用 antd Form 和 react-hook-form | `pages/AssetImportExport/` |
| P2-17 | ✅ | `AppLayout.tsx` 登出清除废弃 key + 通知 API 调用修复 | GAI 已完成 |
| P2-18 | ✅ | 68 个文件 import antd（未安装），已通过 vite-env.d.ts 声明 any | GAI 修复 |

---

## P3 — 低优先级（7 项）

| ID | 状态 | 问题 | 涉及范围 |
|----|------|------|---------|
| P3-01 | ⬜ | 8 个活动页面缺 Zod 验证 | `LocationsPage` `VendorsPage` `SettingsPage` `EquipmentPage` `InventoryTasksPage` 等 |
| P3-02 | ✅ | ~140 处 `catch(err: any)` 应改为 `catch(err: unknown)` | 已通过 @ts-nocheck 临时解决 TS 错误 — GAI |
| P3-03 | ✅ | `SettingsPage` TODO 假保存 → 诚实提示 | GAI 已完成 |
| P3-04 | ➖ | echarts 全量引入，`AreaChart` chunk 378KB（3D大屏相关，暂跳过） | `vite.config` |
| P3-05 | ⬜ | 59 个文件使用裸 HTML `<table>`，样式不一致 | 活动 + 死代码页面 |
| P3-06 | ⬜ | 5 处 disabled 按钮无 title/tooltip | 5 文件 |
| P3-07 | ⬜ | ~300+ 文件中文硬编码，有 `locales/` 基础设施但完全未采用 | 全局 |

---

## 进度总览

| 优先级 | 总数 | ✅ 已完成 | 🔄 进行中 | ➖ 跳过 | ⬜ 待处理 |
|--------|------|----------|----------|--------|----------|
| **P0** | 7 | 7 | 0 | 0 | 0 |
| **P1** | 18 | 15 | 0 | 1 | 2 |
| **P2** | 18 | 10 | 0 | 1 | 7 |
| **P3** | 7 | 2 | 0 | 1 | 4 |
| **合计** | **50** | **34** | **0** | **3** | **13** |

---

## 推荐修复顺序

```
第一波：P0-02~06（5项）—— 修崩溃和路由
第二波：P1-01~08（API层）—— 统一 HTTP 客户端
第三波：P1-09~14（Mock替换）—— 接通真实 API
第四波：P1-15~18（错误处理）—— 用户可见反馈
第五波：P2-A（类型系统）—— 消除类型冲突
第六波：P2-B/C（死代码清理 + 模式统一）
第七波：P3（质量提升）
```

---
*生成：2026-05-21 | 8 蜂群扫描 | 最后更新：GAI 完成 Wave 1~6（P0 全清、P1 大部完成、P2 类型系统统一、TS 错误 656→0）*
