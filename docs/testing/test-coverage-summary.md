# 测试覆盖汇总

## 执行结果

| 类型 | 命令 | 结果 |
|---|---|---:|
| 前端单元测试 | `cd frontend && npm test -- --run --reporter=dot` | 89 个测试文件，883 个测试通过 |
| 前端类型检查 | `cd frontend && npx tsc -p tsconfig.json --noEmit --pretty false` | 通过 |
| 前端构建 | `cd frontend && npm run build` | 通过；仅保留既有 `three` chunk >1000 kB 警告 |
| 桌面浏览器回归 | `cd frontend && npx playwright test --project=browser-regression-smoke` | 23 个测试通过，含核心路由、工作流新建保存、报表/审批空态、3D 大屏降级 |
| 真实后端 E2E | `cd backend && mvn spring-boot:test-run -Dspring-boot.run.profiles=e2e` 后执行 `cd frontend && npm run e2e:real -- --reporter=line` | 9 个测试通过；覆盖真实 Spring Boot 后端、Vite proxy、登录、流程设计器、工单审批、退役申请、折旧计算、审计查询、审批列表、报表与大屏 |
| 后端测试 | `cd backend && mvn test -DfailIfNoTests=false` | 606 个测试通过，0 失败，0 错误 |
| 流程定义服务测试 | `cd backend && mvn -q -Dtest=WorkflowDefinitionServiceTest test` | 6 个测试通过，覆盖默认列表、保存草稿、发布、启停、未发布拦截 |
| 赔偿流程发布与估值 | `cd backend && mvn -q -Dtest=CompensationServiceTest,WorkflowDefinitionServiceTest test` | 通过，赔偿提交必须存在已发布 `ASSET_COMPENSATION` 流程；缺金额时按资产当前价值/原值自动估值 |
| WorkOrder/Retirement 闭环 | `cd backend && mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest,RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test` | 通过 |
| 后端编译 | `cd backend && mvn -q -DskipTests compile` | 通过 |
| PRD多租户基础 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=MyBatisPlusConfigTest,TenantSchemaConsistencyTest,TenantServiceTest test` | 通过；覆盖 TenantLine、schema 与当前租户查询 |
| WorkOrder/Approval 租户隔离 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=WorkOrderServiceTest,ApprovalServiceTest,MyBatisPlusConfigTest test` | 通过 |
| 主业务租户隔离扩展 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=AssetServiceTest,DashboardServiceTest,CompensationServiceTest,IdleAssetServiceTest,StocktakingServiceTest test` | 通过 |
| TenantLine SQL 防漏 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=MyBatisPlusConfigTest,TenantSchemaConsistencyTest test` | 通过；覆盖 MyBatis-Plus 拦截器顺序、租户白名单、字符串 tenantId、缺租户显式拒绝 |
| 异步任务配置 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=AsyncConfigTest test` | 通过；覆盖通知线程池与邮件线程池 Bean，防止 `@Async("mailTaskExecutor")` 运行期缺 Bean |
| SLA 后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=SlaMonitorJobTest,SlaServiceTest test` | 通过；覆盖 SLA 定时任务逐活跃租户绑定/清理 TenantContext |
| 保险/风险后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=InsuranceExpiryTaskTest,InsuranceExpiryReminderTest,RiskAssessmentReviewReminderTaskTest test` | 通过；覆盖保险到期与风险评审提醒逐活跃租户绑定/清理 TenantContext |
| 维保计划后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=MaintenancePlanServiceTest test` | 通过；覆盖维保记录自动生成与到期预警逐活跃租户绑定/清理 TenantContext |
| 前端覆盖率门禁 | `cd frontend && npm run test:coverage -- --run` | 89 个测试文件，883 个测试通过；All files statements/lines 93.91%，branches 86.77%，functions 91.17%，通过全局阈值 |
| 前端安全审计 | `cd frontend && npm audit --audit-level=high` | 0 vulnerabilities |
| Node 版本 | `cd frontend && node -v` | `v22.22.2`，满足 `.nvmrc`、`frontend/package.json engines.node` 和 `happy-dom@20.9.0` 的 Node `>=20` 要求 |

## 保留项

| 范围 | 命令 | 当前结果 |
|---|---|---|
| Node 版本一致性 | `cd frontend && node -v` | 本机为 `v22.22.2`；CI/部署需保持 Node `>=20` |
| 折旧生产链路 | `DepreciationController` / `DepreciationService` / `frontend/src/api/depreciation.ts` / `/depreciation` | 已形成 Spring Boot API、前端主路由、桌面 smoke 与真实后端 E2E 写入/计算/记录查询闭环 |
| 审计/操作日志生产链路 | `OperLogAspect` / `AuditDashboardController` / `AuditService` / `frontend/src/api/audit.ts` / `/audit` | 已形成若依 `sys_operate_log` 写入、Spring Boot 查询统计 API、前端主路由、桌面 smoke 与真实后端 E2E 查询/统计/页面覆盖；真实 E2E 已验证资产新增与折旧计算操作可落库查询 |

## 模块文档清单

| 模块 | 文档 |
|---|---|
| 资产台账管理 | `docs/testing/module-01-asset-registry.md` |
| 重要设备管理 | `docs/testing/module-02-important-equipment.md` |
| RFID资产盘点 | `docs/testing/module-03-rfid-inventory.md` |
| 闲置资产管理 | `docs/testing/module-04-idle-assets.md` |
| 资产赔偿管理 | `docs/testing/module-05-compensation.md` |
| 审批流程管理 | `docs/testing/module-06-approval-workflow.md` |
| 数据统计分析 | `docs/testing/module-07-analytics-dashboard.md` |
| 系统设置 | `docs/testing/module-08-system-settings.md` |
| 多租户PRD | `docs/testing/prd-tenant-isolation-coverage.md` |
| 浏览器冒烟 | `docs/testing/browser-smoke-report.md` |
| 真实后端 E2E | `docs/testing/real-backend-e2e-report.md` |
| WorkOrder/Retirement 闭环 | `docs/testing/workorder-retirement-closure.md` |

## 覆盖结论

核心模块的按钮、搜索、提交、保存、删除、审批、扫描等交互均已在文档中标注对应代码路径和验证命令。当前自动化测试以服务/控制器/状态/API 层为主，真实浏览器端逐按钮 E2E 可在 Playwright 场景中继续扩展。

本轮新增桌面核心路由回归覆盖：`core-routes-smoke.spec.ts` 已纳入 `browser-regression-smoke` 项目，当前覆盖 `/`、`/assets`、`/equipment`、`/depreciation`、`/inventory`、`/idle`、`/disposals`、`/approvals`、`/workflows`、`/analytics`、`/audit`、`/settings`，并断言页面没有进入“页面加载失败”兜底。

本轮修复数据分析页国际化缺口：新增 `analytics` namespace 的中英文资源并注册到 i18n，`/analytics` 不再显示 `module.title`、`kpi.totalAssets` 等裸 key。

本轮新增流程定义服务覆盖：默认 4 条业务流程列表、按租户保存草稿、发布版本递增、空节点发布拦截、启用/停用状态切换、未发布流程提交拦截。

本轮关闭赔偿流程残留风险：`CompensationService#createCompensation` 已接入 `WorkflowDefinitionService#requirePublishedDefinition("ASSET_COMPENSATION")`，并新增未发布流程拦截测试。

本轮新增赔偿估值最小闭环：后端新增 `POST /compensations/valuation`，创建赔偿单时如果未传赔偿金额，会按资产当前价值估算，当前价值缺失时使用资产原值；前端新增“系统估值”按钮并允许人工覆盖。

本轮关闭前端依赖安全风险：`happy-dom` 与 `vite` 已升级，`react-router` 已升级到安全版本，存在高危且无修复版本的 `xlsx` 已从前端直接依赖中移除；`npm audit --audit-level=high` 返回 0 vulnerabilities。当前 Node `v22.22.2` 满足 `.nvmrc`、`frontend/package.json engines.node` 和 `happy-dom@20.9.0` 的 Node `>=20` 要求。

本轮新增认证闭环浏览器覆盖：未登录访问受保护页面会跳转登录页；退出登录会清理本地会话并返回登录页。该测试曾发现退出后 URL 已到 `/login` 但旧布局仍渲染的问题，已通过 `AuthContext#logout` 改为由 auth state 驱动路由跳转修复。

本轮新增若依操作日志覆盖：资产新增/修改/删除、资产导入/导出、折旧计算、工单新增/修改/删除/提交/审批/挂起/验收等主业务写操作已接入 `@OperLog`；真实后端 E2E profile 开启 `ams.oper-log.enabled=true`，并断言“资产新增”“折旧计算”可从 `/audit-logs` 查询到 `sys_operate_log` 落库记录。

本轮补强多租户 SQL 防漏：`TenantLineInnerInterceptor` 对租户业务表缺少 TenantContext 的 SQL 改为显式拒绝，不再生成 `tenant_id = ''` 的静默空结果；后端全量 606 个测试通过，真实后端 E2E 9 个测试通过。

本轮补齐异步邮件执行器：`AsyncConfig` 新增 `mailTaskExecutor`，与 `EmailServiceImpl` 中的 `@Async("mailTaskExecutor")` 保持一致，避免邮件发送链路运行期找不到 executor Bean；新增 `AsyncConfigTest` 锁定通知与邮件线程池配置。

本轮补强 SLA 后台调度租户治理：`SlaMonitorJob` 改为按 `TenantService#getActiveTenantIds()` 逐租户绑定 `TenantContext` 后刷新 SLA 状态和发送违约通知，并在每个租户执行后清理上下文；新增 `SlaMonitorJobTest` 防止调度线程缺租户上下文。

本轮补强保险/风险评审后台提醒租户治理：`InsuranceExpiryTask`、`InsuranceExpiryReminder`、`RiskAssessmentReviewReminderTask` 改为按活跃租户逐个设置并清理 `TenantContext`；新增 3 个调度测试防止后台线程绕过租户上下文。

本轮补强维保计划后台调度租户治理：`MaintenancePlanService#scheduledGenerateRecords` 与 `scheduledDueReminder` 改为按活跃租户逐个设置并清理 `TenantContext`，mapper 调度 SQL 同步加入 `tenant_id` 参数；新增 `MaintenancePlanServiceTest` 防止维保计划调度跨租户扫描。
