# 测试覆盖汇总

## 执行结果

| 类型 | 命令 | 结果 |
|---|---|---:|
| 前端单元测试 | `cd frontend && npm test -- --run --reporter=dot` | 89 个测试文件，883 个测试通过 |
| 前端类型检查 | `cd frontend && npx tsc -p tsconfig.json --noEmit --pretty false` | 通过 |
| 前端构建 | `cd frontend && npm run build` | 通过；仅保留既有 `three` chunk >1000 kB 警告 |
| 桌面浏览器回归 | `cd frontend && npx playwright test --project=browser-regression-smoke` | 26 个测试通过，含核心路由、工作流新建保存、工作流列表/设计器只读权限、审批详情当前节点权限、报表/审批空态、3D 大屏降级 |
| 真实后端 E2E | `cd backend && mvn spring-boot:test-run -Dspring-boot.run.profiles=e2e` 后执行 `cd frontend && npm run e2e:real -- --reporter=line` | 9 个测试通过；覆盖真实 Spring Boot 后端、Vite proxy、登录、流程设计器、工单审批、退役申请、折旧计算、审计查询、审批列表、报表与大屏 |
| 后端测试 | `cd backend && mvn test -DfailIfNoTests=false` | 662 个测试通过，0 失败，0 错误，0 跳过 |
| 流程定义服务测试 | `cd backend && mvn -q -Dtest=WorkflowDefinitionServiceTest test` | 19 个测试通过，覆盖默认列表、按租户保存草稿、完整设计器字段持久化、`saveDraft -> publish -> getDefinition` 回读、发布校验、启停、未发布拦截、审批人/角色/条件分支校验 |
| 流程定义 Controller/API 契约 | `cd backend && mvn -q -Dtest=WorkflowDefinitionControllerTest test`、`cd frontend && npm run test -- --run src/api/__tests__/workflow.test.ts` | Controller 7 个测试覆盖若依权限注解、列表/详情/保存草稿/发布/状态；前端 API 3 个测试覆盖 `/workflows` 草稿、发布、状态和自定义流程端点 |
| 流程定义迁移护栏 | `cd backend && mvn -q -Dtest=TenantSchemaConsistencyTest,PermissionSeedSchemaTest test`、本机 MySQL 临时库连续执行两遍 `V2_83__workflow_definition_table.sql` | 通过；`workflow_definition` fresh schema 与增量迁移均包含 `tenant_id DEFAULT 'dept:1'`、`uk_workflow_tenant_business`、`idx_workflow_tenant_status` |
| 部署配置静态/CI 门禁 | `cd backend && mvn -q -Dtest=DeploymentConfigConsistencyTest test` | 4 个测试通过；覆盖根单容器 Dockerfile、`docker/single-container-nginx.conf`、entrypoint、`backend/Dockerfile`、`frontend/Dockerfile`、`frontend/nginx.conf` 与 `docker-compose.yml` 的端口、健康检查、SPA fallback、API 反代、schema 初始化挂载、compose MySQL 应用用户创建，以及 CI Docker config/build/runtime smoke 命令 |
| 本地 CI 总门禁 | `env SKIP_BUILD=1 ./scripts/ci-gate.sh` | 通过，`6 passed, 0 failed, 190s`；覆盖 TypeScript、前端单测、浏览器回归 smoke 执行、后端部署/工作流 targeted gate、后端全量与工作树状态记录 |
| CI 工作流配置护栏 | `.github/workflows/ci.yml` | 已把 Dockerfile、compose、`docker/**`、`scripts/**` 纳入触发路径；新增 Playwright browser 安装、browser regression smoke 执行、后端部署/工作流 targeted gate，以及独立 `docker-config-build` job，执行 `docker compose config --quiet`、`docker compose build backend frontend`、分体容器启动 smoke（8080 `/api/health`、3000 `/`、`/workflows`、`/api/health`）和根 Dockerfile `docker build -t forthams-single:ci .` 后的单容器 runtime smoke（18080 `/api/health`、`/`、`/workflows`） |
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
| 定时报表后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=ScheduledReportServiceImplTest test` | 通过；覆盖定时报表扫描、邮件发送与状态更新期间逐活跃租户绑定/清理 TenantContext |
| 循环盘点后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=CycleCountServiceTest test` | 通过；覆盖循环盘点任务生成、资产查询与盘点明细写入期间逐活跃租户绑定/清理 TenantContext |
| 折旧后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=DepreciationSchedulerTest test` | 通过；覆盖折旧调度逐活跃租户绑定/清理 TenantContext 后查询在用资产并触发折旧计算 |
| 邮件重试后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=MailLogRetrySchedulerTest,MailLogServiceTest test` | 通过；覆盖邮件失败重试逐活跃租户绑定/清理 TenantContext，且待重试查询缺少租户上下文时 fail-closed |
| 检验任务后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=InspectionTaskServiceImplTest test` | 通过；覆盖检验任务到期提醒与逾期标记调度逐活跃租户绑定/清理 TenantContext |
| 检验记录后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=InspectionServiceImplTest test` | 通过；覆盖检验记录逾期标记调度逐活跃租户绑定/清理 TenantContext，并验证逾期通知与整改工单创建链路 |
| 安全检查后台调度租户绑定 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn -q -Dtest=SafetyChecklistServiceImplTest test` | 通过；覆盖安全检查执行逾期调度逐活跃租户绑定/清理 TenantContext，并验证逾期通知在租户上下文内发送 |
| 合同管理内部租户隔离 | `cd backend && env MAVEN_OPTS=-Djdk.attach.allowAttachSelf=true mvn test -Dtest=ContractServiceTest,ContractReminderJobTest,TenantSchemaConsistencyTest,VendorPortalControllerTest -DfailIfNoTests=false` | 18 个测试通过；覆盖内部合同新增/查询/到期扫描租户绑定、合同提醒逐活跃租户绑定/清理 TenantContext、供应商门户 vendor-token 兼容边界、合同租户迁移护栏 |
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

本轮补强工作流保存权限体验：`WorkflowCenterPage` 在账号只有 `workflow:definition:query`、缺少 `workflow:definition:edit` 时进入只读模式，禁用新建/发布/设计器写入口；`WorkflowDesignerPage` 对直达深链也进入只读预览并禁用保存/发布，避免用户进入设计器后保存接口 403 造成“新建流程无法保存”的误导；`browser-regression-smoke` 新增列表与设计器只读权限路径覆盖。

本轮补强 OAuth2 配置安全：`OAuth2Controller` 的配置 CRUD 复用 `system:config:query/edit` 若依权限表达式，provider/config 响应改为脱敏视图，不再回传 `appSecret` 明文；`OAuth2ControllerTest` 覆盖权限注解和 provider 列表脱敏序列化。

本轮补强角色管理权限边界：`RoleManagementController` 的 `/roles/all` 补齐 `system:role:query` 权限，`RoleService` 新建角色未显式指定 `dataScope` 时默认使用本部门数据范围，避免新角色默认获得全部数据权限；`RoleControllerTest`/`UserManagementServiceTest` 覆盖权限注解和默认数据范围。

本轮补强自助注册租户边界：`AuthService#register` 默认关闭匿名自助注册；显式开启时也拒绝请求体 `deptId`，必须由服务端配置 `AMS_AUTH_REGISTRATION_DEFAULT_DEPT_ID` 作为默认部门后才创建用户并签发 `dept:{deptId}` 租户令牌；`AuthServiceTest` 覆盖默认拒绝、拒绝客户端部门和服务端默认部门发令牌。

本轮补强审批详情操作边界：`ApprovalDetailPage` 的通过/驳回按钮不再只按流程状态展示，还会校验当前账号的 `approval:process:approve/reject` 权限，并匹配当前工作流节点的指定审批人或审批角色；`browser-regression-smoke` 新增 `/approvals/:id` 当前审批人与旁观用户路径覆盖。

本轮补强审批取消后端边界：`ApprovalService#cancelProcess` 在 PENDING 状态和无审批记录之外，新增操作者必须等于流程 `applicantId` 的校验，避免具备取消权限的非发起人终止他人审批；`ApprovalServiceTest` 覆盖非发起人拒绝。

本轮修复数据分析页国际化缺口：新增 `analytics` namespace 的中英文资源并注册到 i18n，`/analytics` 不再显示 `module.title`、`kpi.totalAssets` 等裸 key。

本轮新增流程定义服务覆盖：默认业务流程列表、按租户保存草稿、完整设计器字段持久化、`saveDraft -> publish -> getDefinition` 回读、发布版本递增、空节点发布拦截、启用/停用状态切换、未发布流程提交拦截、审批人/角色/条件分支校验。`V2_83__workflow_definition_table.sql` 已补齐旧库运行时根表，真实 MySQL 临时库连续执行两遍通过，fresh schema 与增量迁移保持一致。

本轮补强 CI/local gate：`scripts/ci-gate.sh` 现在把 TypeScript、前端单测、浏览器回归 smoke 执行、后端部署/工作流 targeted gate、后端全量串成单入口；本轮先捕获 `ApprovalListPage.tsx` 类型谓词问题，完成最小类型修复后复跑通过。随后将 browser regression 从 `--list` 清单升级为真实执行，首次真实执行发现 `/inventory` 标题选择器非精确匹配导致 25/26，通过 `exact: true` 最小修复后 `npm run e2e:browser-regression` 复跑 26/26 通过。`.github/workflows/ci.yml` 已在 Dockerfile、compose、`docker/**`、`scripts/**` 变化时触发，先安装 Playwright browsers，再执行 browser regression smoke 与后端部署/工作流 targeted gate；同时新增独立 `docker-config-build` job，对 compose 配置、分体前后端镜像构建、分体容器 runtime smoke、根单容器 Dockerfile 构建和单容器 runtime smoke 做 CI 侧真实 Docker 门禁。`docker-compose.yml` 已显式创建 `${DB_USERNAME}`/`${DB_PASSWORD}` 对应的 MySQL 应用用户，避免 CI 容器启动后后端使用 `ams_user` 连接失败。

本轮关闭赔偿流程残留风险：`CompensationService#createCompensation` 已接入 `WorkflowDefinitionService#requirePublishedDefinition("ASSET_COMPENSATION")`，并新增未发布流程拦截测试。

本轮新增赔偿估值最小闭环：后端新增 `POST /compensations/valuation`，创建赔偿单时如果未传赔偿金额，会按资产当前价值估算，当前价值缺失时使用资产原值；前端新增“系统估值”按钮并允许人工覆盖。

本轮关闭前端依赖安全风险：`happy-dom` 与 `vite` 已升级，`react-router` 已升级到安全版本，存在高危且无修复版本的 `xlsx` 已从前端直接依赖中移除；`npm audit --audit-level=high` 返回 0 vulnerabilities。当前 Node `v22.22.2` 满足 `.nvmrc`、`frontend/package.json engines.node` 和 `happy-dom@20.9.0` 的 Node `>=20` 要求。

本轮新增认证闭环浏览器覆盖：未登录访问受保护页面会跳转登录页；退出登录会清理本地会话并返回登录页。该测试曾发现退出后 URL 已到 `/login` 但旧布局仍渲染的问题，已通过 `AuthContext#logout` 改为由 auth state 驱动路由跳转修复。

本轮新增若依操作日志覆盖：资产新增/修改/删除、资产导入/导出、折旧计算、工单新增/修改/删除/提交/审批/挂起/验收等主业务写操作已接入 `@OperLog`；真实后端 E2E profile 开启 `ams.oper-log.enabled=true`，并断言“资产新增”“折旧计算”可从 `/audit-logs` 查询到 `sys_operate_log` 落库记录。

本轮补强多租户 SQL 防漏：`TenantLineInnerInterceptor` 对租户业务表缺少 TenantContext 的 SQL 改为显式拒绝，不再生成 `tenant_id = ''` 的静默空结果；后端全量 621 个测试通过，真实后端 E2E 9 个测试通过。

本轮补齐异步邮件执行器：`AsyncConfig` 新增 `mailTaskExecutor`，与 `EmailServiceImpl` 中的 `@Async("mailTaskExecutor")` 保持一致，避免邮件发送链路运行期找不到 executor Bean；新增 `AsyncConfigTest` 锁定通知与邮件线程池配置。

本轮补强 SLA 后台调度租户治理：`SlaMonitorJob` 改为按 `TenantService#getActiveTenantIds()` 逐租户绑定 `TenantContext` 后刷新 SLA 状态和发送违约通知，并在每个租户执行后清理上下文；新增 `SlaMonitorJobTest` 防止调度线程缺租户上下文。

本轮补强保险/风险评审后台提醒租户治理：`InsuranceExpiryTask`、`InsuranceExpiryReminder`、`RiskAssessmentReviewReminderTask` 改为按活跃租户逐个设置并清理 `TenantContext`；新增 3 个调度测试防止后台线程绕过租户上下文。

本轮补强维保计划后台调度租户治理：`MaintenancePlanService#scheduledGenerateRecords` 与 `scheduledDueReminder` 改为按活跃租户逐个设置并清理 `TenantContext`，mapper 调度 SQL 同步加入 `tenant_id` 参数；新增 `MaintenancePlanServiceTest` 防止维保计划调度跨租户扫描。

本轮补强定时报表后台调度租户治理：`ScheduledReportServiceImpl#scanAndExecute` 改为按活跃租户逐个设置并清理 `TenantContext`，定时报表扫描条件同步加入 `tenant_id` 过滤；新增 `ScheduledReportServiceImplTest` 防止定时报表调度跨租户扫描、邮件发送和更新。

本轮补强循环盘点后台调度租户治理：`CycleCountService` 的月度/季度/年度定时入口改为按活跃租户逐个设置并清理 `TenantContext`，手动触发仍保持当前租户语义；新增 `CycleCountServiceTest` 防止循环盘点规则扫描、任务创建和明细写入缺失租户上下文。

本轮补强折旧后台调度租户治理：`DepreciationScheduler#runDailyDepreciation` 改为按活跃租户逐个设置并清理 `TenantContext`，每个租户内查询在用资产并调用折旧计算；新增 `DepreciationSchedulerTest` 防止折旧调度缺失租户上下文。

本轮补强邮件重试后台调度租户治理：`MailLogRetryScheduler#retryFailedMails` 改为按活跃租户逐个设置并清理 `TenantContext`，`MailLogService#getPendingRetry` 强制要求租户上下文并按 `tenant_id` 过滤；新增 `MailLogRetrySchedulerTest` 与 `MailLogServiceTest` 防止邮件重试跨租户扫描或静默跳过。

本轮补强检验任务后台调度测试护栏：`InspectionTaskServiceImplTest` 新增逾期标记调度用例，断言多活跃租户扫描期间 `TenantContext` 正确绑定并在任务结束后清理，避免未来重构让检验任务逾期标记回退为无租户扫描。

本轮补强安全检查后台调度测试护栏：新增 `SafetyChecklistServiceImplTest`，覆盖安全检查执行逾期调度在逐活跃租户扫描期间绑定/清理 `TenantContext`，并验证逾期通知发送链路处于正确租户上下文。

本轮补强检验记录后台调度测试护栏：`InspectionServiceImplTest` 新增逾期检验标记调度用例，覆盖租户上下文绑定/清理、检验结果更新为 `OVERDUE`、逾期通知发送与整改工单创建，防止检验记录调度回退为无租户扫描。

本轮补强合同管理内部租户治理：`contract` 新增 `tenant_id` forward migration，内部 `ContractService` 查询/详情/新增/到期扫描显式要求当前租户，`ContractReminderJob` 改为逐活跃租户绑定并清理 `TenantContext`；供应商门户仍保持 `vendor-portal` token 边界和 `contract` 白名单兼容，后续若要供应商维度也租户隔离，需要单独设计 vendor/portal 租户模型。
