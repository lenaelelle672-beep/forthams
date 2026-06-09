# goon.md — 交接笔记（Cowork → Claude Code）

## 2026-06-09 21:05 最新状态（Codex GAI2 检验模板复制闭环）

### 当前事实
- 已补齐检验模板复制闭环：`InspectionTemplateService.copyTemplate` 会复制源模板名称、类型、周期、适用分类、检查项、状态、创建人，并以当前 `TenantContext` 写入新模板。
- `InspectionTemplateController` 新增 `POST /inspection-templates/{id}/copy`，权限使用 `inspection:template:create`，与“复制会创建新模板”的语义一致。
- 桌面 `InspectionTemplatePage` 操作列新增“复制”按钮，调用已有 `inspectionTemplateApi.copy` 并在成功后刷新模板列表。
- 新增 `InspectionTemplateServiceImplTest`，覆盖成功复制和源模板不存在时报错。

### 最新验证
- GitNexus impact：`InspectionTemplateService` upstream 风险 `MEDIUM`，5 个直接依赖、无受影响流程；`InspectionTemplatePage` upstream 风险 `LOW`。
- Targeted 后端：`mvn test -Dtest=InspectionTemplateServiceImplTest -DfailIfNoTests=false` 通过，`2` 个测试通过。
- 前端类型检查：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。
- 后端全量：`mvn test` 通过，`585` 个测试，0 failure/error/skip。
- 前端全量：`npm test -- --run --reporter=dot` 通过，`85` 个文件、`861` 个测试通过。
- 前端构建：`npm run build` 通过，仅保留既有 `three-Caxi2su_.js` 大 chunk warning。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:50 最新状态（Codex GAI2 检验按类别自动生成入口收敛）

### 当前事实
- 已修复 `InspectionServiceImpl.autoGenerateInspections`：当 `assetIds` 为空且传入 `assetCategoryId` 时，不再返回空列表，而是复用已存在的 `batchGenerateByCategory(assetCategoryId)` 按租户与类别生成检验记录。
- 新增 `InspectionServiceImplTest.autoGenerateInspectionsShouldGenerateByCategoryWhenAssetIdsAreEmpty`，覆盖类别下两台资产生成两条 `PERIODIC` / `PENDING` 检验记录，并断言租户、资产、检验日期、下次检验日期和编号。
- 变更范围只限检验/年检自动生成入口与对应单测；未改移动端、路由、前端或数据库结构。

### 最新验证
- GitNexus impact：`InspectionServiceImpl` upstream 风险 `LOW`，`direct=0`、`processes_affected=0`。
- Targeted 后端：`mvn test -Dtest=InspectionServiceImplTest -DfailIfNoTests=false` 通过，`1` 个测试通过。
- 后端全量：`mvn test` 通过，`583` 个测试，0 failure/error/skip。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:45 最新状态（Codex GAI2 计划与证据校准）

### 当前事实
- 已校准 `docs/TEST_RECOVERY_PLAN.md` 的最新验证记录：前端全量为 `85` 个测试文件、`861` 个测试通过；后端全量为 `582` 个测试通过；桌面浏览器回归为 `11/11` 通过。
- 已将 JaCoCo 从“仍需验证”改为“已验证非空”：`backend/target/jacoco.exec` 为 36,510,464 bytes，`backend/target/site/jacoco/jacoco.xml` 为 1,698,282 bytes，且 XML 顶层包含覆盖率 counter。
- 本次只更新计划/交接证据，没有改业务代码、测试代码、移动端代码或路由。

### 最新验证
- 文件证据：`backend/target/jacoco.exec`、`backend/target/site/jacoco/index.html`、`backend/target/site/jacoco/jacoco.xml` 均存在。
- XML 证据：`jacoco.xml` 顶层含 `INSTRUCTION`、`BRANCH`、`LINE` 等 counter，确认不是空报告。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:42 最新状态（Codex GAI2 CSV 导入解析兼容性收敛）

### 当前事实
- 已修复 `AssetController.parseImportFile` 的 CSV 解析：不再按行后简单 `split(",")`，改为一次性解析 CSV records，支持双引号包裹字段、字段内逗号、`""` 双引号转义，以及字段内换行。
- 新增 `AssetControllerTest.parseImportFileHandlesEscapedCsvFields`，覆盖导出端可能生成的逗号/引号字段再导入场景。
- 变更范围只限资产导入 CSV 预览解析；导入提交、资产创建、权限与导出接口未改。

### 最新验证
- GitNexus impact：`splitCsvLine` upstream 风险 `LOW`，直接调用者仅 `parseImportFile`，无受影响流程。
- Targeted 后端：`mvn test -Dtest=AssetControllerTest -DfailIfNoTests=false` 通过，`15` 个测试通过。
- 后端全量：`mvn test` 通过，`582` 个测试，0 failure/error/skip。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:38 最新状态（Codex GAI2 Webhook 权限口径收敛）

### 当前事实
- 已修复 Webhook 配置权限漂移：`WebhookConfigController` 不再使用未 seed 的裸 `system:config`，查询/detail 使用 `system:config:query`，创建/更新/删除使用 `system:config:edit`。
- 前端 `routePermissions` 中 `/settings/webhook` 改为允许 `system:config:query` 或 `system:config:edit`，与后端和 seed 权限一致。
- 新增 `WebhookConfigControllerTest` 反射锁定 controller `@PreAuthorize` 权限表达式；扩展 `routePermissions.test.ts` 覆盖 webhook 入口权限。

### 最新验证
- GitNexus impact：`WebhookConfigController` upstream 风险 `LOW`；`canAccessRoute` upstream 风险 `LOW`，直接影响 `AppLayout`、`GlobalSearch`、`routePermissions.test.ts`，无受影响流程。
- Targeted 后端：`mvn test -Dtest=WebhookConfigControllerTest -DfailIfNoTests=false` 通过，`1` 个测试通过。
- Targeted 前端：`npm test -- --run src/utils/routePermissions.test.ts --reporter=dot` 通过，`7` 个测试通过。
- 类型检查：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。
- 后端全量：`mvn test` 通过，`581` 个测试，0 failure/error/skip。
- 前端全量：`npm test -- --run --reporter=dot` 通过，`85` 个文件、`861` 个测试通过。
- 前端构建：`npm run build` 通过，仅保留既有 `three-Caxi2su_.js` 大 chunk warning。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:34 最新状态（Codex GAI2 附件预览 URL 收敛）

### 当前事实
- 已修复 `frontend/src/components/asset/AssetAttachmentUpload.tsx`：图片缩略图与预览打开不再直接拼接 `import.meta.env.VITE_API_BASE_URL`，避免未配置 `VITE_API_BASE_URL` 时生成 `undefined/...` URL。
- 新增 `resolveAssetAttachmentUrl`：完整 URL 原样保留，`/api/file/...` 原样保留，相对路径统一归一到 `/api/file/...`，空路径按附件 id 兜底。
- 新增 `frontend/src/components/asset/AssetAttachmentUpload.test.ts`，覆盖完整 URL、相对路径、已有 `/api/file` 路径和空路径 fallback。

### 最新验证
- GitNexus impact：`AssetAttachmentUpload` upstream 风险 `LOW`，`direct=0`、`processes_affected=0`。
- Targeted 前端：`npm test -- --run src/components/asset/AssetAttachmentUpload.test.ts --reporter=dot` 通过，`3` 个测试通过。
- 类型检查：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。
- 前端全量：`npm test -- --run --reporter=dot` 通过，`85` 个文件、`861` 个测试通过。
- 前端构建：`npm run build` 通过，仅保留既有 `three-Caxi2su_.js` 大 chunk warning。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:31 最新状态（Codex GAI2 资产导出筛选闭环）

### 当前事实
- 已修复桌面端 `frontend/src/pages/AssetImportExport/AssetImportExportPage.tsx`：导出资产时不再丢弃页面已选择的分类筛选，`categoryCodes` 改为传递当前选择的分类数组。
- 同页“资产状态”下拉框补齐 `label htmlFor` / `select id` 关联，让状态筛选既可测试也可被辅助技术识别。
- 新增 `frontend/src/pages/AssetImportExport/AssetImportExportPage.test.tsx`，覆盖选择分类与状态后调用导出 API 的请求参数。

### 最新验证
- GitNexus impact：`AssetImportExportPage` upstream 风险 `LOW`，`direct=0`、`processes_affected=0`。
- Targeted 前端：`npm test -- --run src/pages/AssetImportExport/AssetImportExportPage.test.tsx src/api/__tests__/assetImport.test.ts --reporter=dot` 通过，`2` 个文件、`2` 个测试通过。
- 类型检查：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。
- 前端全量：`npm test -- --run --reporter=dot` 通过，`84` 个文件、`858` 个测试通过。
- 前端构建：`npm run build` 通过，仅保留既有 `three-Caxi2su_.js` 大 chunk warning。
- 桌面浏览器回归：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。

### 剩余动作
- P0：原生 Docker/Nginx 验证仍无法在当前机器执行，`docker` 与 `nginx` 命令均不存在。
- P1：`.DS_Store` tracked 元数据清理仍需用户明确确认。
- P1：移动端继续冻结；不纳入当前桌面/后端质量闭环。

## 2026-06-09 20:26 最新状态（Codex GAI2 桌面浏览器验证补强）

### 当前事实
- 非移动端代码与部署配置最近提交仍是 `8cd95c821 docs: record database bootstrap policy`、`743c32f7f fix: make database bootstrap explicit`、`928d93505 fix: align split docker deployment checks`、`eb84fd139 fix: repair production web container routing` 等批次。
- 工作树当前仅保留 `.DS_Store` 与移动端冻结差异；移动端文件和 `frontend/src/router/index.tsx` 中移动相关改动继续不纳入本轮质量闭环。
- 前端 TypeScript 桌面/共享代码已补静态证据：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。

### 最新验证
- 桌面浏览器回归：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。
- 本次浏览器 smoke 覆盖 `/workflows` 两条关键路径：保存失败提示不误导，以及“新建模板流程会保存草稿并进入设计器”；同时覆盖赔偿、3D 大屏降级、盘点、闲置、资产/处置/报表/工单、审批、报表空态/权限拒绝态。
- 首次普通沙箱执行 Playwright 因无法监听 `127.0.0.1:5173` 返回 `listen EPERM`；按规则提权重跑同一命令后通过，判定为沙箱端口权限问题，不是业务失败。

### 剩余动作
- P0：仍需在有 Docker/Nginx 的机器上补原生镜像构建与容器 smoke；当前已有等价 Node 代理 smoke，但缺少真实 `docker build` / `docker compose build` 证据。
- P1：`.DS_Store` 仍为 tracked 本机元数据改动，是否 `git rm --cached .DS_Store` 需要用户明确确认。
- P1：移动端继续冻结；恢复移动端时应单独审计并提交，不要混入桌面/后端批次。

## 2026-06-09 20:22 最新状态（Codex GAI2 数据库启动策略收敛）

### 当前事实
- 已新增提交 `743c32f7f fix: make database bootstrap explicit`：后端默认不再在 Spring Boot 启动时执行完整 `schema.sql`，`spring.sql.init.mode` 改为 `${SQL_INIT_MODE:never}`，如需本地一次性初始化可显式设置 `SQL_INIT_MODE=always`。
- `application.yml` 去掉 `DB_PASSWORD:root` 弱默认，与 `application.properties` 的空默认保持一致；`ApplicationConfigValidator` 仍要求运行时注入 `DB_PASSWORD` 与 `JWT_SECRET`。
- `backend/src/main/resources/migration/README.md` 已改为当前真实策略：迁移脚本按 Flyway 风格保存，但应用默认关闭 SQL init 和 Flyway 自动迁移；Docker fresh install 由 MySQL 容器挂载 `schema.sql` 初始化，已有环境升级由部署流程/DBA/CI 手动编排。

### 最新验证
- `git diff --check` 通过。
- 后端 `mvn test` 通过，`580` 个测试通过，0 failure/error/skip。
- test profile 临时启动通过：`SPRING_PROFILES_ACTIVE=test` + 端口 `18082`，`GET /api/health` 返回 `200`。
- 提交前 `detect_changes(scope=staged)`：`risk_level=low`、`affected_processes=[]`。

### 剩余动作
- P0：仍需在有 Docker/Nginx 的机器上补原生镜像构建与容器 smoke。
- P1：`.DS_Store` 与移动端冻结差异仍未处理，保持不提交。

## 2026-06-09 20:15 最新状态（Codex GAI2 部署闭环继续推进）

### 当前事实
- 已新增提交 `eb84fd139 fix: repair production web container routing`：根 `Dockerfile` 从“Spring Boot 直接托管 dist”改为单容器 Nginx + Spring Boot 拓扑，Nginx 对外监听 `8080` 服务桌面 SPA 和 `/api/*` 反代，后端内部监听 `8081`；同时新增 `docker/single-container-nginx.conf` 与 `docker/single-container-entrypoint.sh`。
- 已新增提交 `928d93505 fix: align split docker deployment checks`：分体部署补齐 `frontend/Dockerfile` 的完整构建依赖安装，避免 `vite` 位于 devDependencies 时 Docker build 缺构建器；`backend/Dockerfile` 健康检查统一改为公开 `/api/health`。
- `frontend/nginx.conf` 已从完整 nginx 主配置改为合法的 `conf.d/default.conf` server 片段，并使用 `location ^~ /api/` 避免 API 路径被静态资源正则抢占。
- 移动端仍冻结，未纳入提交：`frontend/src/pages/mobile/**` 与 `frontend/src/router/index.tsx` 的移动相关改动仍留在工作树；`.DS_Store` 仍为本机元数据改动，未提交。

### 最新验证
- 反例验证：临时 Spring Boot 静态托管模式下，`/api/health` 为 `200`，但 `/` 为 `404`、`/api/` 与 `/api/index.html` 为 `401`，证明旧根 `Dockerfile` 健康检查会过但桌面前端不可用。
- 等价运行态 smoke：本地后端模拟容器内部端口 `18081`，临时 Node 代理模拟 Nginx 对外端口 `18080`；`/`、`/workflows`、真实 JS 资源 `/assets/index-*.js`、`/api/health` 均返回 `200`。
- 门禁复验：`sh -n docker/single-container-entrypoint.sh` 通过；后端 `mvn test` 通过，`580` 个测试通过，0 failure/error/skip；前端 `npm test -- --run` 通过，`83` 个测试文件、`857` 个测试通过；前端 `npm run build` 通过，仅保留既有大 chunk warning。
- 提交前审计：两次部署提交均执行 `detect_changes(scope=staged)`，结果均为 `risk_level=low`、`changed_symbols=[]`、`affected_processes=[]`；`git diff --check` 通过。

### 剩余动作
- P0：在有 Docker/Nginx 的机器上补原生验证：`docker build -t forthams:local .`、`docker compose build backend frontend`，并跑 `/`、`/workflows`、`/api/health`、一个真实鉴权 API smoke。本机当前无 `docker` 与 `nginx` 命令，无法完成该证据。
- P1：`.DS_Store` 已被 `.gitignore` 覆盖但当前仍有 tracked 修改；是否执行 `git rm --cached .DS_Store` 需要用户明确确认。
- P1：移动端继续冻结；后续若恢复移动端，应单独审计并提交 `frontend/src/pages/mobile/**` 与 `frontend/src/router/index.tsx`，不要混入桌面/后端批次。

## 2026-06-09 20:08 最新状态（Codex GAI2 继续推进）

### 当前事实
- 已新增提交 `4178cb375 fix: harden backend runtime operations`：后端运行时/调度/租户上下文/SLA/盘点/借用/工单/维修上传/全局异常日志降噪批次已落地。
- 已新增提交 `2e688c6b4 fix: align desktop frontend api contracts`：桌面端 API wrapper、AuthContext 统一入口、通知铃铛、全局搜索、盘点/入库/工单/资产导入导出等非移动契约批次已落地。
- 最新 GitNexus `detect_changes(scope=all)`：`risk_level=low`、`changed_count=39`、`affected_count=0`、`changed_files=9`。这比本轮早前的 high/critical 状态已明显收敛。
- 移动端仍冻结，未纳入提交：`frontend/src/pages/mobile/**` 和 `frontend/src/router/index.tsx` 中移动路由相关改动仍留在工作树。

### 最新验证
- 后端批次 gate：`mvn test -Dtest=GlobalExceptionHandlerTest,MigrationFileNamingTest,AssetBorrowServiceTest,InventoryServiceTest,SlaServiceTest,AssetServiceTest,MaintenanceExecutionServiceTest,WorkOrderServiceTest,AssetLifecycleServiceTest,CompensationServiceTest,DashboardServiceTest,EnergyServiceTest,IdleAssetServiceTest,IntakeOrderServiceTest,RetirementApplicationServiceTest,MyBatisPlusConfigTest -DfailIfNoTests=false` 通过，`125` 个测试通过。
- 前端全量 gate：`npm test -- --run` 通过，`83` 个测试文件、`857` 个测试通过。
- 前端构建 gate：`npm run build` 通过，仅保留 Vite 大 chunk warning。
- 两个新增批次提交前均已执行 `detect_changes(scope=staged)`；后端批次为 `medium`（40 文件、11 受影响流程，已由 targeted gate 覆盖），桌面前端批次为 `medium`（152 文件、3 受影响流程，已由全量 Vitest/build 覆盖）。

### 剩余动作
- 可提交的非移动剩余项：`.gitignore`、AGENTS/CLAUDE GitNexus 索引数字、`docs/TEST_RECOVERY_PLAN.md`、根 `Dockerfile`、本交接文件。
- 不建议本轮继续做：移动端页面/路由提交、`.DS_Store` 索引清理（需要用户明确确认）、动态菜单进一步产品化、供应商门户生产会话模型。

## 2026-06-09 09:30 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本段是在 09:10 状态后继续推进的结果。移动端仍冻结未推进；本轮重点处理蜂群旁路审计发现的若依菜单 seed、租户拦截白名单、供应商门户 token 边界、桌面菜单/搜索权限可见性，以及 `/workflows` 错误提示精度。

### 本轮新增完成
- `/workflows` 中心页错误提示修正：
  - `frontend/src/pages/workflow/WorkflowCenterPage.tsx`：初始化模板草稿失败时不再统一追加“页面仍展示本地草稿状态”，避免后端保存失败但本地未落草稿时误导用户。
  - `frontend/src/e2e/browser-regression-smoke.spec.ts`：新增断言，锁定初始化失败时不出现本地草稿后缀。
- 工作流若依菜单 seed 对齐：
  - `backend/src/main/resources/schema.sql`：工作流父菜单从旧 `workflow-definition/system/workflow/index/workflow:definition:list` 对齐到桌面路由 `workflows`、组件 `workflow/WorkflowCenterPage`、权限 `workflow:definition:query`，并增强 upsert 更新 path/component/perms。
  - 新增 `backend/src/main/resources/migration/V2_73__workflow_menu_alignment.sql`：修复已有库中的旧工作流菜单 path/component/perms，并确保 SUPER_ADMIN 绑定工作流菜单与 query/edit 权限。
  - `PermissionSeedSchemaTest` 覆盖 workflow 菜单 seed 与迁移存在性。
- 租户拦截白名单补洞：
  - `backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`：将 `sys_tenant`、`vendor`、`contract`、`workflow_node`、`workflow_edge` 加入租户拦截白名单，避免无 `tenant_id` 表被自动追加租户条件导致 SQL 异常。
  - `MyBatisPlusConfigTest` 锁定这些表的 `ignoreTable` 行为。
- 供应商门户 token 边界修复：
  - `backend/src/main/java/com/ams/controller/VendorPortalController.java`：登录不再签发 `default` tenant JWT，改为 `vendor-portal` 专用 token；合同/资料接口要求 `X-Vendor-Token` 与 `vendorId` 匹配。
  - `backend/src/main/java/com/ams/config/SecurityConfig.java`：`/vendor-portal/**` 从系统用户 JWT 鉴权链路中放行，由供应商门户控制器校验 `X-Vendor-Token`。
  - `frontend/src/pages/vendor-portal/VendorPortalPage.tsx`：供应商合同请求带上 `X-Vendor-Token`。
  - 新增 `VendorPortalControllerTest`，覆盖不再使用 `default` tenant、合同接口校验 vendor token、缺 token 拒绝。
- 租户旧值残留复查：
  - 运行时代码中未再发现 `T001` 硬编码；`default` 租户 token 已清掉。
  - 剩余 `T001/default` 命中主要是 `V2_70` 迁移用于归一历史数据，以及邮件模板 code suffix 的非租户含义。
- 桌面入口权限可见性收敛：
  - 新增 `frontend/src/utils/routePermissions.ts`，将桌面侧栏和 Cmd+K 搜索入口对齐到后端 `@ss.hasPermi(...)` 权限码；兼容 SUPER_ADMIN/ADMIN 与旧会话空权限数组。
  - `frontend/src/layouts/AppLayout.tsx`：侧栏主菜单、系统菜单、底部基础数据入口按用户权限过滤。
  - `frontend/src/components/GlobalSearch.tsx`：Cmd+K 页面入口按用户权限过滤，避免低权限用户从搜索跳到后端 403 页面。
  - 新增 `frontend/src/utils/routePermissions.test.ts`，覆盖工作流、采购/合同、SAM、设置子页、处置动作子路由等权限映射。
- `/menus/current` 动态菜单前置质量补强：
  - `backend/src/main/java/com/ams/mapper/SysMenuMapper.java`：当前用户菜单树查询补 `m.visible = 1`，避免隐藏菜单进入动态侧栏。
  - `backend/src/main/resources/schema.sql` 与新增 `V2_74__desktop_menu_route_metadata.sql`：补齐系统管理、资产、盘点、审批、报表、通知等桌面菜单 `path/component` 元数据，为后续接入 `/menus/current` 做数据准备。
  - `PermissionSeedSchemaTest` 覆盖桌面菜单元数据迁移和 hidden 菜单过滤。
- P0 影响流程测试补强：
  - `AssetControllerTest` 新增 `/assets/import/commit` 空数据拒绝、部分成功/行级失败测试，锁住 `commitImport -> createAsset` 主链路和字段转换。
  - `StocktakingServiceTest` 新增开始周期、分配任务、暂停/恢复、pending 阻止完成测试，覆盖盘点状态机主干。
  - 新增 `NotificationEventListenerTest`，覆盖审批通过非最终步骤创建下一步待办、已存在待办幂等跳过、驳回清理待办、提交 CC 邮件发送，并断言异步监听器恢复/清理 `TenantContext`。
  - `VendorPortalControllerTest` 继续补 profile/合同详情负向：错 vendor token、错 tenant token、profile 密码脱敏、合同详情跨供应商隔离。
  - `WorkflowDefinitionServiceTest` 新增 `saveDraft -> publish -> getDefinition` 持久化 roundtrip，锁住 `/workflows` 后端保存、发布、读取闭环。
- 测试日志可读性收敛：
  - `backend/src/test/resources/application-test.properties` 在 test profile 下关闭 `GlobalExceptionHandler` 与 `MaintenanceExecutionService` 的预期异常堆栈输出；生产日志不变，相关负向路径仍由断言覆盖。
- Flyway/schema P0 修复（2026-06-09 13:42）：
  - `backend/src/main/resources/migration/V2_36__asset_parent_child.sql`、`V2_58__inspection_template_and_record.sql` 已恢复到无 diff，避免改写已发布历史迁移导致 Flyway checksum mismatch。
  - `backend/src/main/resources/migration/V2_69__asset_detail_support_tables.sql` 增加 forward patch：已有旧 `asset_parent_child` 表会补齐 `quantity`、`remark`、`create_time`、`deleted`，将 `tenant_id` 调整为 `VARCHAR(64)`，并替换缺少 tenant 维度的旧 `uk_relation` 唯一索引。
  - `backend/src/main/resources/schema.sql` 的 `vendor` 快照补齐 `bank_account`、`tax_id`、`password`、`portal_enabled`，保证 fresh install 下供应商门户字段可用。
  - `PermissionSeedSchemaTest`、`TenantSchemaConsistencyTest` 更新断言：历史迁移保持 checksum，当前结构必须通过 V2_69 forward patch 收敛。
- 前端 typecheck P1 闭环（2026-06-09 13:48）：
  - 报表相关测试 mock 从旧 `ApiResponse<T>` 包装改为当前 http 拦截器解包后的直接类型，覆盖 `ReportsPage.test.tsx` 与旧兼容 `ReportPage.test.tsx`。
  - API wrapper 测试补齐真实必填 payload / 枚举类型：资产导入、资产父子关系、预算接口。
  - `WorkOrderDetailPage` 增加详情响应 type guard，避免 `attachments/approvalRecords` 被 index signature 推成 `unknown`；`WorkOrderFormPage` 将后端更宽的工单类型收敛到当前表单支持类型。
  - `AssetAssignment` 补可选 `reason` 兼容详情页展示；`noLegacyAppImports.test.ts` 改用 `split().join()` 兼容当前 TS lib。
- NotificationBell 未读数 P1 修复（2026-06-09 13:50）：
  - `frontend/src/components/NotificationBell.tsx` 打开下拉时不再把通知列表分页 `total` 写入未读角标；未读数继续以 `/notifications/unread-count` 为权威。
  - 下拉列表请求不再传后端未支持的 `isRead` 查询参数，避免前端以为拿到的是“未读列表”。
  - `NotificationBell.test.tsx` 将列表 `total` 设为 `99` 并断言角标仍保持 unread-count 的 `2`，锁住“总数不等于未读数”的契约。
- JWT 已有认证上下文租户错配 P1 修复（2026-06-09 13:54）：
  - `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java` 在 `SecurityContext` 已存在认证时仍先校验 bearer token，再校验已有 `LoginUser` 的 username/tenantId 与 token 是否一致。
  - 已有认证上下文与 token tenant 不一致时返回 `403`，并记录 `jwt_existing_auth_tenant_mismatch`，避免请求复用旧认证绕过 token tenant 绑定。
  - `JwtAuthenticationFilterTest` 覆盖“已有认证 tenant 不一致拒绝”和“已有认证 tenant 一致继续放行”，并断言 `TenantContext` 清理和 `userDetailsService` 不被重复调用。
- 系统 JWT filter 与公开/供应商门户边界对齐（2026-06-09 14:02）：
  - `JwtAuthenticationFilter` 的系统 JWT 保护范围补齐 `/vendor-portal/**`、`/health`、`/system/health`、`/system/info`、`/oauth2-mock/**`、`/sso/**`、`/api-docs/**`、`/swagger-ui/**` 旁路，避免 `SecurityConfig.permitAll` 路径在带陈旧 `Authorization` 头时仍被系统 JWT filter 提前拦截。
  - `JwtAuthenticationFilterTest` 新增参数化覆盖：公开边界即使带无效 bearer token，也不解析系统 JWT、不写 `TenantContext`、继续进入后续 filter chain。
  - 新增 `SecurityFilterChainBehaviorTest` 使用真实 `MockMvc + SecurityFilterChain` 验证：`/system/health` 带陈旧 bearer 仍 200；`/vendor-portal/contracts` 带陈旧 bearer 会到供应商门户自己的 `X-Vendor-Token` 边界；`/user-management/current` 仍需系统认证并返回 401。

### 最新验证结果
- GAI2 批次落地实绩（2026-06-09，本次 Codex 继续推进）：已从原混合工作树中拆出并提交 4 个自洽切片：`7c72fffc1 fix: harden tenant security chain`（D2b 租户/JWT/MyBatis/schema/迁移，含 amend 后的自洽依赖）、`9844fab60 fix: align workflow and vendor portal contracts`（A1 工作流保存/若依权限/供应商门户 token 契约）、`1dd0e48ff test: restore controller test coverage`（D1 controller 测试恢复与 surefire/Jacoco 配置）、`a82134889 fix: harden backend business workflows`（D2a 资产导入、盘点、ABC、审批/通知链路）。对应 gate：D2b 45+17 个后端测试通过；A1 后端 33 个、前端 4 个测试通过；D1 controller gate 230 个测试通过；D2a targeted gate 88 个测试通过；各批提交前均执行 `detect_changes(scope=staged)`，其中 D2b 为 low，A1/D2a 为 critical 但有 targeted gate 覆盖，D1 为 low。
- 最新剩余风险（2026-06-09，本次 Codex 复核）：当前 index 为空；`detect_changes(scope=all)` 已从早前 `critical` 降为 `high`，`changed_count=434`、`affected_count=14`、`changed_files=152`。剩余受影响流程集中在 `CreateWorkOrder`、`CommitImport -> createAsset`、`AssetRevaluation approve`、`MaintenanceExecution uploadPhoto`、`InventoryDetailPage` 等；下一批建议继续拆为后端运维/库存/工单链路、B/E 前端非移动端、F 部署配置、C 仓库卫生/文档。移动端 `frontend/src/pages/mobile/**` 仍保持冻结，不进入后续批次。
- D2b-core 可提交前收口审计（2026-06-09，本次 Codex 复核）：当前 staged 仍只包含 D2b-core 的 `13` 个文件，`git diff --cached --name-status` 与前次 allowlist 一致，`git diff --cached --check` 通过，未混入移动端、`.DS_Store`、controller rename 或 F-runtime 文件。GitNexus `detect_changes(scope=staged)` 复验仍为 `risk_level=low`、`changed_count=77`、`affected_count=0`、`changed_files=13`；但 `detect_changes(scope=all)` 仍为 `critical`、`changed_count=677`、`affected_count=59`、`changed_files=187`。结论：D2b-core 这个切片可进入提交评审；项目整体还不是 100 分，下一步应先提交/封存 D2b-core，随后从空 index 重组 A1/D1/D2a/B/E/F/C，逐批 staged-only 检测与 targeted gate。
- D2b-core staged-only 审计与复验（2026-06-09 19:36，已执行 index 重组）：已获授权执行 `git restore --staged :/` 清空旧的 31 个不完整 controller test rename 暂存项，随后仅将 D2b-core 安全链文件 stage。当前 staged 清单为 `JwtAuthenticationFilter.java`、`MyBatisPlusConfig.java`、`SecurityConfig.java`、`TenantContext.java`、`application.properties`、`schema.sql`、`JwtAuthenticationFilterTest.java`、`MyBatisPlusConfigTest.java`、`PermissionSeedSchemaTest.java`、`SecurityConfigTest.java`、`SecurityFilterChainBehaviorTest.java`、`TenantSchemaConsistencyTest.java`、`TenantServiceTest.java`，共 `13` 个文件；`git diff --cached --check` 通过。GitNexus `detect_changes(scope=staged)` 返回 `risk_level=low`、`changed_count=77`、`affected_count=0`、`changed_files=13`，不再是旧 staged-only 的假安全。首次普通沙箱运行 D2b gate 失败，原因是 Mockito inline / ByteBuddy 无法 self-attach 当前 JVM（`Could not initialize inline Byte Buddy mock maker`），非业务断言失败；按沙箱规则提权重跑同一命令后通过：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,MyBatisPlusConfigTest,TenantSchemaConsistencyTest,PermissionSeedSchemaTest,TenantServiceTest -DfailIfNoTests=false` 通过，`45` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`。下一批不能直接沿用旧 D2b/F 交叉文件，因 `application.properties` 已随 D2b-core staged；F-runtime 需剔除或重新评估该文件。
- 批次交叉矩阵审计（2026-06-09 16:31，草案未执行）：只读 `git status --porcelain=v1 -uall` 显示核心批次存在真实文件交叉，不能按旧 A/D2b/F manifest 直接重复 stage。当前 A 候选脏文件 `27` 个，D2b 候选脏文件 `13` 个，F 候选脏文件 `4` 个，D2a 候选脏文件 `19` 个。A+D2b 共享 `10` 个文件：`JwtAuthenticationFilter.java`、`MyBatisPlusConfig.java`、`SecurityConfig.java`、`schema.sql`、`JwtAuthenticationFilterTest.java`、`MyBatisPlusConfigTest.java`、`PermissionSeedSchemaTest.java`、`SecurityConfigTest.java`、`SecurityFilterChainBehaviorTest.java`、`TenantSchemaConsistencyTest.java`；D2b+F 共享 `application.properties`。因此后续真实 index 重组建议改为更小顺序：A1 工作流/供应商门户/菜单/schema 业务闭环（不含共享安全链文件，或只在确定 D2b 合并策略后纳入）-> D2b-core 租户/JWT/MyBatis 安全链（一次性纳入共享安全文件与 config 测试）-> F-runtime 构建/部署配置（`backend/pom.xml`、`docs/TEST_RECOVERY_PLAN.md`、根 `Dockerfile`，以及视 D2b 落地结果处理 `application.properties`）。F 批当前 tracked diff 为 `backend/pom.xml`、`backend/src/main/resources/application.properties`、`docs/TEST_RECOVERY_PLAN.md`，另有未跟踪根 `Dockerfile`；`backend/Dockerfile`、`frontend/Dockerfile`、`frontend/nginx.conf`、`docker-compose.yml` 当前无可见 diff。
- 当前 staged-only 阻断审计（2026-06-09 16:28，草案未执行）：`git diff --cached --name-status` 仍只有 `31` 个 `backend/src/test/java-excluded/com/ams/controller/*Test.java -> backend/src/test/java/com/ams/controller/*Test.java` 的 `R100` rename，`git diff --cached --check` 通过；但 `detect_changes(scope=staged)` 返回 `risk_level=none`、`changed_count=0`、`affected_count=0`，这是因为 staged 区只包含纯 rename，未包含真实 controller 测试内容修复，不能作为“低风险可提交”的证据。精确状态为：`25` 个 `RM`（rename 已 staged，但新位置内容修改仍 unstaged）、`6` 个纯 `R`、`1` 个已跟踪 controller 测试修改（`WorkflowDefinitionControllerTest.java`）和 `8` 个未跟踪 controller 测试。D1 若落地，必须从空 index 重新 stage：31 个 rename + 25 个 RM 的内容修改 + 1 个额外已跟踪 controller 测试修改 + 8 个未跟踪 controller 测试；若 A 批先落地 `WorkflowDefinitionControllerTest` 或 `VendorPortalControllerTest`，D1 manifest 需按实际已提交状态重新剔除交叉文件。
- 全量质量闸复跑（2026-06-09 16:26）：后端 `mvn test` 通过，`580` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`；前端 `npm test -- --run --reporter=dot` 通过，`83` 个测试文件、`857` 个测试通过；前端 `npm run build` 通过，仍仅有既有 `three-Caxi2su_.js` >1000 kB chunk warning。该证据证明最新工作树在后端全量、前端全量、前端生产构建三个质量闸上稳定；但它仍不能替代 staged-only `detect_changes(scope=staged)`、逐批 review、Docker/nginx/Flyway 真实部署 gate，也不改变移动端冻结策略。
- B/E 桌面前端 gate 复跑（2026-06-09 16:23）：B 批 `npx vitest run src/utils/routePermissions.test.ts src/components/NotificationBell.test.tsx src/api/__tests__/notification.test.ts src/api/__tests__/workflow.test.ts src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`5` 个文件、`20` 个测试通过；`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx playwright test --project=browser-regression-smoke --grep "workflows|模块验收 smoke|approvals|reports" --reporter=line` 通过，`5/5`。E 批 `npx vitest run src/__tests__/noLegacyAppImports.test.ts src/api/__tests__/*.test.ts src/components/comment/UserMentionAutocomplete.test.tsx src/components/depreciation/DepreciationCard.test.tsx src/components/fault-code/FaultCodeSelector.test.tsx src/pages/workorder/WorkOrderAcceptancePage.test.tsx src/pages/workorder/workOrderFormMapper.test.ts src/__tests__/ReportsPage.test.tsx src/__tests__/pages/ReportPage.test.tsx src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`36` 个文件、`93` 个测试通过。该证据覆盖 `/workflows` 草稿保存/设计器跳转、桌面模块 smoke、审批/报表空态与权限拒绝态、通知铃铛、routePermissions、API wrapper、legacy app 边界和非移动端组件契约；仍不覆盖移动端，也不能替代每批 stage 后的 `detect_changes(scope=staged)`。
- GitNexus detect changes（2026-06-09 16:18）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`。受影响流程继续集中在 `CommitImport`、`CreateCustomDefinition/Publish/UpdateStatus`、`Reclassify*`、`Stocktaking cycle`、`Approval`、`CurrentUserMenus`、`CreateWorkOrder`、`InventoryDetailPage` 等链路；这证明当前不能因 targeted/full test 通过就宣布 100 分，必须先按 A/D1/D2a/D2b/B/E/F/C 拆批 stage、逐批 `detect_changes(scope=staged)`、逐批 review 后再合并。
- D2b 租户/JWT/MyBatis 安全链 manifest 与复验（2026-06-09 16:20，草案未执行）：D2b 是全局安全链高风险批，不得与 D2a 普通业务链路混做。当前候选 tracked 修改为 `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`、`backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`、`backend/src/main/java/com/ams/config/SecurityConfig.java`、`backend/src/main/java/com/ams/context/TenantContext.java`、`backend/src/main/resources/application.properties`、`backend/src/main/resources/schema.sql`、`backend/src/test/java/com/ams/service/TenantServiceTest.java`；untracked 测试文件为 `backend/src/test/java/com/ams/config/JwtAuthenticationFilterTest.java`、`MyBatisPlusConfigTest.java`、`PermissionSeedSchemaTest.java`、`SecurityConfigTest.java`、`SecurityFilterChainBehaviorTest.java`、`TenantSchemaConsistencyTest.java`。`JwtAuthenticationFilter/SecurityConfig/MyBatisPlusConfig/schema.sql` 同时与 A 批安全/schema/供应商门户存在交叉，`application.properties` 同时与 F 批运行配置存在交叉；提交前必须根据先落地批次重新抽取 staged diff，不能简单重复 stage。D2b 复验命令 `mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,MyBatisPlusConfigTest,TenantSchemaConsistencyTest,PermissionSeedSchemaTest,TenantServiceTest,JwtUtilTest -DfailIfNoTests=false` 已通过，`47` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`。该 gate 覆盖系统 JWT 公开边界与 tenant mismatch、真实 Spring Security filter chain、MyBatis 租户拦截白名单/插入策略、权限 seed/schema 租户一致性、TenantService 与 JwtUtil；但它不能替代 staged-only `detect_changes` 与全量回归。
- D2a 后端业务链路 manifest 与复验（2026-06-09 16:17，草案未执行）：D2a 只覆盖普通后端业务链路，不包含 D2b 全局租户/JWT/MyBatis 安全链。当前候选 tracked 修改为 `backend/src/main/java/com/ams/controller/ABCClassificationController.java`、`backend/src/main/java/com/ams/controller/AssetController.java`、`backend/src/main/java/com/ams/controller/StocktakingCycleController.java`、`backend/src/main/java/com/ams/controller/StocktakingTaskController.java`、`backend/src/main/java/com/ams/service/ApprovalService.java`、`backend/src/main/java/com/ams/service/InAppChannel.java`、`backend/src/main/java/com/ams/service/StocktakingService.java`、`backend/src/main/java/com/ams/service/impl/ABCClassificationServiceImpl.java`、`backend/src/main/java/com/ams/service/impl/StocktakingServiceImpl.java`、`backend/src/test/java/com/ams/service/ABCClassificationServiceTest.java`、`backend/src/test/java/com/ams/service/ApprovalServiceTest.java`、`backend/src/test/java/com/ams/service/NotificationServiceTest.java`；`backend/src/test/java/com/ams/controller/AssetControllerTest.java` 当前是 `AM`，同时属于 D1 controller 测试恢复与 D2a 业务链路证据。D2a untracked 新文件为 `backend/src/main/java/com/ams/dto/StocktakingCycleStatsDTO.java`、`backend/src/test/java/com/ams/controller/ABCClassificationControllerTest.java`、`backend/src/test/java/com/ams/controller/StocktakingCycleControllerTest.java`、`backend/src/test/java/com/ams/controller/StocktakingPermissionControllerTest.java`、`backend/src/test/java/com/ams/event/NotificationEventListenerTest.java`、`backend/src/test/java/com/ams/service/StocktakingServiceTest.java`。D2a 与 D1 交叠文件包括 `AssetControllerTest`、`ABCClassificationControllerTest`、`StocktakingCycleControllerTest`、`StocktakingPermissionControllerTest`；若 D1 先提交，D2a stage manifest 必须从“测试恢复”角度剔除这些文件，只保留业务链路差异或按已落地状态重新复核。D2a 复验命令 `mvn test -Dtest=AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest,NotificationServiceTest -DfailIfNoTests=false` 已通过，`88` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`。D2a 当前禁止混入 `backend/src/main/java/com/ams/context/TenantContext.java`、`JwtAuthenticationFilter.java`、`MyBatisPlusConfig.java`、`application.properties`、`schema.sql` 等 D2b/A/F 全局安全或配置文件。
- D1 controller 测试恢复 manifest 与复验（2026-06-09 16:13，草案未执行）：当前 staged 仍是 `31` 个 `backend/src/test/java-excluded/com/ams/controller/*Test.java -> backend/src/test/java/com/ams/controller/*Test.java` 的 `R100` rename；其中 `ApprovalControllerTest`、`AssetCategoryControllerTest`、`AssetControllerTest`、`AuditDashboardControllerTest`、`AuthControllerTest`、`BigScreenControllerTest`、`BusinessCommentControllerTest`、`DashboardControllerTest`、`DeptControllerTest`、`EnergyControllerTest`、`FloorPlanControllerTest`、`IdleAssetControllerTest`、`InventoryControllerTest`、`MaintenanceControllerTest`、`MaintenanceExecutionControllerTest`、`NotificationControllerTest`、`NotificationPreferenceControllerTest`、`RetirementControllerTest`、`RoleControllerTest`、`SafetyChecklistControllerTest`、`StatsControllerTest`、`SystemHealthControllerTest`、`UserSearchControllerTest`、`VendorControllerTest`、`WorkOrderControllerTest`、`WorkflowDefinitionControllerTest` 还存在 unstaged 内容修改；`CompensationControllerTest`、`DepreciationControllerTest`、`DisposalControllerTest`、`LocationControllerTest`、`ReportControllerTest`、`UserManagementControllerTest` 是纯 rename。另有 untracked controller 测试：`ABCClassificationControllerTest`、`AssetRevaluationControllerTest`、`ControllerApiPrefixMappingTest`、`MockAuthorizationServerControllerTest`、`OAuth2ControllerTest`、`StocktakingCycleControllerTest`、`StocktakingPermissionControllerTest`、`VendorPortalControllerTest`。D1 若执行，必须从空 index stage 31 个 rename + 25 个新位置内容修改 + 8 个 untracked controller 测试，不能只提交当前 staged。D1 复验命令 `mvn test -Dtest='*ControllerTest,ControllerApiPrefixMappingTest,MockAuthorizationServerControllerTest' -DfailIfNoTests=false` 已通过，`230` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`。注意 `VendorPortalControllerTest` 与 A 批也有关联；若 A 批先提交，D1 manifest 需从 D1 中剔除该文件或接受 A/D 交叉的批次调整。
- A 批精确 stage manifest 与复验（2026-06-09 16:10，草案未执行）：A 批候选文件全部存在；其中 tracked 修改为 `AuditSchemaInitializer.java`、`JwtAuthenticationFilter.java`、`MyBatisPlusConfig.java`、`SecurityConfig.java`、`VendorPortalController.java`、`WorkflowDefinitionController.java`、`SysMenuMapper.java`、`schema.sql`、`WorkflowDefinitionControllerTest.java`、`WorkflowDefinitionServiceTest.java`、`application-test.properties`、`VendorPortalPage.tsx`；untracked 新文件为 `V2_69` 到 `V2_74` 迁移、`backend/src/test/java/com/ams/config/*` 七个配置/schema 测试、`VendorPortalControllerTest.java`、`VendorPortalPage.test.tsx`。A 批不包含移动端、不包含 `.DS_Store`、不包含当前 staged 的 D 批 controller rename。A 批复验命令已通过：后端 `mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false` 通过，`75` 个测试通过；前端 `npx vitest run src/pages/vendor-portal/VendorPortalPage.test.tsx --reporter=dot` 通过，`1` 个测试通过；前端 `npx tsc -p tsconfig.json --noEmit --pretty false` 通过。若获准执行 index 重组，A 批 stage 草案为：先 `git restore --staged :/`，再 `git add -- backend/src/main/java/com/ams/config/AuditSchemaInitializer.java backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java backend/src/main/java/com/ams/config/MyBatisPlusConfig.java backend/src/main/java/com/ams/config/SecurityConfig.java backend/src/main/java/com/ams/controller/VendorPortalController.java backend/src/main/java/com/ams/controller/WorkflowDefinitionController.java backend/src/main/java/com/ams/mapper/SysMenuMapper.java backend/src/main/resources/schema.sql backend/src/main/resources/migration/V2_69__asset_detail_support_tables.sql backend/src/main/resources/migration/V2_70__canonical_default_tenant_id.sql backend/src/main/resources/migration/V2_71__abc_permissions.sql backend/src/main/resources/migration/V2_72__sys_tenant_id_width.sql backend/src/main/resources/migration/V2_73__workflow_menu_alignment.sql backend/src/main/resources/migration/V2_74__desktop_menu_route_metadata.sql backend/src/test/java/com/ams/config/JwtAuthenticationFilterTest.java backend/src/test/java/com/ams/config/MigrationFileNamingTest.java backend/src/test/java/com/ams/config/MyBatisPlusConfigTest.java backend/src/test/java/com/ams/config/PermissionSeedSchemaTest.java backend/src/test/java/com/ams/config/SecurityConfigTest.java backend/src/test/java/com/ams/config/SecurityFilterChainBehaviorTest.java backend/src/test/java/com/ams/config/TenantSchemaConsistencyTest.java backend/src/test/java/com/ams/controller/VendorPortalControllerTest.java backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java backend/src/test/java/com/ams/service/WorkflowDefinitionServiceTest.java backend/src/test/resources/application-test.properties frontend/src/pages/vendor-portal/VendorPortalPage.tsx frontend/src/pages/vendor-portal/VendorPortalPage.test.tsx`；随后立即跑 `detect_changes(scope=staged)` 和上述 A 批 gate。
- 当前工作树批次落地手册（2026-06-09 16:08，草案未执行）：当前 `git status --short` 为 `291` 行，`git diff --cached --name-status` 仍是 `31` 个 controller 测试纯 rename，`git diff --name-status` 为 `212` 个 tracked diff，未跟踪 `79` 个；移动端冻结项仍为 `frontend/src/pages/mobile/**` 的 4 个修改与 3 个未跟踪。真正执行 index 重组时，第一步只能是 `git restore --staged :/` 清空 index 且不改工作树，然后按文件级 allowlist stage，严禁 `git add .`、`git add frontend/src`、`git add backend/src/test/java/com/ams/controller`。推荐落地顺序：A 后端安全/schema/工作流/供应商门户 -> D1 controller 测试恢复 -> D2a 后端业务链路测试/修复 -> D2b 租户安全链 -> B 桌面 workflow/通知/权限入口 -> E 前端非移动端 API/页面/组件 -> F 部署/配置 -> C 仓库卫生/文档。每批 stage 后必须跑 `detect_changes(scope=staged)`，再跑该批 targeted gate；最终每批合并前再跑必要全量 gate。A 批优先候选文件为 `AuditSchemaInitializer/JwtAuthenticationFilter/MyBatisPlusConfig/SecurityConfig/VendorPortalController/WorkflowDefinitionController/SysMenuMapper/schema.sql/V2_69-V2_74/config 测试/VendorPortalControllerTest/WorkflowDefinition*Test/application-test.properties`，并可带 `VendorPortalPage.tsx` 与其测试以保持供应商门户前后端契约闭环；D1 必须把当前 31 个 rename 与对应新位置文件的内容修改一起 stage，不能只提交 R100；D2a 纳入 `AssetController/Stocktaking*/ApprovalService/InAppChannel/ABCClassification*` 及对应 service/event/controller 测试；D2b 只处理 `TenantContext/JWT/MyBatis/default tenant` 这类全局安全链；B/E/F/C 按前文 allowlist 执行。`.DS_Store` 只有用户明确批准仓库卫生批时才 `git rm --cached .DS_Store`；根 `Dockerfile` 当前是未跟踪，F 批需先决定是否纳入生产拓扑或仅作为过渡文件。
- BDE 批可执行修复单（2026-06-09 16:06）：只读复核确认 `/settings/webhook` 权限三方漂移：`frontend/src/utils/routePermissions.ts:34-35` 使用裸 `system:config`；`WebhookConfigController:20/30/36/42/48` 也使用裸 `system:config`；但 `schema.sql:1212-1214` 与 `AuditSchemaInitializer:331-333` seed 的是 `system:config:query` / `system:config:edit`。建议修复：前端 `/settings/webhook` 可见性使用 `query` 或 `edit` 任一权限，后端 GET/list/detail 用 `query`，POST/PUT/DELETE 用 `edit`，补 routePermissions 和 controller 权限测试。资产导出分类筛选风险：`AssetImportExportPage:38-39` 使用中文 label 作为分类/状态选项，`handleExport:171-175` 把中文 label 传给 mutation，但 mutation 在 `:57-62` 对 `categoryCodes` 硬编码 `[]`；API wrapper `assetImport.ts:136-150` 只会把数字分类 code 转成 `categoryId`，现有 `assetImport.test.ts:39/52-56` 只覆盖 wrapper，不覆盖页面控件到请求的传递。建议先补页面级测试，再将页面选项改为 `{label,value}`，分类 value 必须是后端 categoryId 或从分类接口加载，状态 value 应使用后端枚举而非中文。附件 URL 风险：`AssetAttachmentUpload:154-156` 与 `:236-238` 直接拼 `VITE_API_BASE_URL + filePath`，在未配置 baseURL 时可能生成 `undefined/...`，在 baseURL 为 `/api` 且 filePath 已含 `/api/file` 时可能重复；`AttachmentList:92-97` 另有相对路径策略，`AssetGallery:71-73/118-120` 又直接用 raw `filePath`。建议抽共享 `resolveAttachmentUrl(filePath,id?)` 并覆盖完整 URL、`/api/file/...`、相对文件名、空 path + id 四种测试。CSV parser 风险：`AssetController:430-438` 导出会对逗号/引号/换行做 CSV 转义，但 `splitCsvLine:373-374` 只是 `line.split(",", -1)`，导出的含逗号/引号字段再导入会错列；现有 `AssetControllerTest:207-223` 只覆盖简单 CSV。建议用 Hutool CSV 或实现引号感知 parser，先补“导出格式可被导入解析”的回归测试。TenantContext/D2b 仍保持独立高危批，不与这些普通 BDE 修复混做。
- F 批部署 readiness 可执行修复单（2026-06-09 16:02）：只读复核确认 `frontend/Dockerfile:10` 使用 `npm ci --only=production`，但 `frontend/package.json:10` 的 build 是 `vite build`，且 `vite`/`@vitejs/plugin-react` 位于 `devDependencies`（`package.json:114`、`122`），因此前端 Docker build 会缺构建器依赖；`frontend/nginx.conf:1-49` 是完整 nginx 主配置，包含 `events` 与 `http`，但 `frontend/Dockerfile:31` 将它复制到 `/etc/nginx/conf.d/default.conf`，conf.d 下应是 `server { ... }` 片段；`backend/Dockerfile:40-41` 健康检查打 `/api/actuator/health`，而应用已有公开 `/api/health` 与 `/api/system/health`，根 `Dockerfile` 已使用 `/api/health`，两套 Dockerfile 健康语义不一致；`application.yml:32-43` 使用 `spring.sql.init.mode=always` + `continue-on-error=true` 且禁用 Flyway，`application.properties:126` 也禁用 Flyway，`backend/pom.xml` 未发现 `org.flywaydb` 依赖，但 `migration/README.md:5`、`:27` 写“Spring Boot 启动自动执行 Flyway”。本机 `command -v docker` 与 `command -v nginx` 均无输出，无法做真实容器/nginx smoke。F 批建议修复边界：前端 Dockerfile 改完整 install/build 后再进入 nginx runtime；nginx.conf 改为 conf.d server-only 或 Dockerfile 改复制到主配置；后端 Dockerfile healthcheck 对齐 `/api/health`；部署文档/配置明确“当前生产使用 schema.sql 初始化”或补 Flyway 依赖与 profile 策略，二者只能选一条主线。
- staged/unstaged 风险差异复核（2026-06-09 16:02）：`git status --short` 仍为 `291` 行；`git diff --cached --name-status` 为 `31` 个 staged 项，全部是 `backend/src/test/java-excluded/com/ams/controller/*Test.java` 到 `backend/src/test/java/com/ams/controller/*Test.java` 的 `R100` 纯 rename；`git diff --name-only` 为 `212` 个 tracked diff；`git ls-files --others --exclude-standard` 为 `79` 个未跟踪文件。GitNexus `detect_changes(scope=staged)` 返回 `changed_count=0`、`affected_count=0`、`risk_level=none`，而 `detect_changes(scope=unstaged)` 返回 `critical`、`changed_count=660`、`affected_count=59`、`changed_files=206`。结论：当前 index 不是可交付批次，真正影响流程的修复都在 unstaged；直接提交当前 index 会形成“只搬测试文件、不带修复内容”的半截提交。
- 全量无容器质量闸补记（2026-06-09 16:18）：后端完整 `mvn test` 通过，`580` 个测试通过，0 failure/error/skip，`BUILD SUCCESS`；前端完整 `npm test -- --run --reporter=dot` 通过，`83` 个测试文件、`857` 个测试通过；前端 `npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npm run build` 通过，仍仅有既有 `three-Caxi2su_.js` >1000 kB chunk warning；`git diff --check` 通过。该结果把 D 批通知正向契约测试纳入全量回归，但不改变 GitNexus 总体结论：当前 `detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`，核心阻断仍是变更面和暂存区切片，而不是测试失败。
- 无容器质量闸复跑（2026-06-09 15:55）：D 批审批/通知链路 `mvn test -Dtest=ApprovalServiceTest,NotificationEventListenerTest,NotificationServiceTest -DfailIfNoTests=false` 通过，`48` 个测试通过，0 failure/error/skip；F/Schema 静态门槛 `mvn test -Dtest=MigrationFileNamingTest,TenantSchemaConsistencyTest,PermissionSeedSchemaTest -DfailIfNoTests=false` 通过，`15` 个测试通过；前端 `npm run build` 通过，仍仅有既有 `three-Caxi2su_.js` >1000 kB warning；`application.yml` Ruby YAML parse 输出 `yaml-ok`；`git diff --check` 通过。该证据不能替代真实 Docker/nginx/compose/Flyway release gate。
- D 批通知链路 test-only 补强（2026-06-09 15:52）：GitNexus impact：`NotificationServiceTest` LOW，0 上游影响；新增 `inAppChannelCreatesUnpersistedRecord`，与既有 `inAppChannelSkipsPersistedRecord` 形成站内通知渠道正反契约。`mvn test -Dtest=NotificationServiceTest -DfailIfNoTests=false` 通过，`6` 个测试通过，0 failure/error/skip；`git diff --check` 针对 `NotificationServiceTest` 与 `goon.md` 通过。未改生产代码，未触碰移动端，未改 Git index。
- GAI2 蜂群 D/F 侧翼对账（2026-06-09 15:45）：D 侧翼结论为 `FAIL for current staged`，原因是当前 staged 只有 `31` 个 controller test 的 `R100` rename，未包含 `25` 个新位置测试文件的内容修改，也未保证 staged 版 `backend/pom.xml` 解除 controller test surefire 排除；因此 staged-only 不能证明“测试恢复”。F 侧翼结论为 `FAIL for production deployment readiness`：`frontend/Dockerfile` 仍需独立修复 `npm ci --only=production` 导致 Vite devDependencies 缺失的问题，且 `frontend/nginx.conf` 被复制到 `/etc/nginx/conf.d/default.conf` 时包含顶层 `events/http` 块，真实 nginx 容器可能无法启动；根 `Dockerfile` 单容器 Spring Boot 形态仍不应作为最终生产拓扑。两名侧翼 agent 已关闭，结果已收敛到本计划。
- GAI2 蜂群 F/BDE 侧翼设计复核（2026-06-09 16:06）：F 侧翼建议 `PASS for audit / FAIL for deployment readiness`，推荐生产拓扑为前后端分离；最小修复文件为 `frontend/Dockerfile`、`frontend/nginx.conf`、`docker-compose.yml`、`backend/Dockerfile`、配置/迁移文档，根 `Dockerfile` 只保留为过渡或另行大设计。BDE 侧翼建议先做低风险前端修复（资产导出分类、附件 URL helper），再做 webhook 前后端权限一致化，再补 `InAppChannel` 正向测试，再做 CSV parser，最后单独处理 TenantContext D2b。两名侧翼均未改文件、未触碰移动端、未执行 stage/reset。
- F 批基础设施/部署配置本地复核（2026-06-09 15:31）：`npm run build` 通过，仅保留既有 `three-Caxi2su_.js` >1000 kB warning；`mvn package -DskipTests` 通过，并生成 Spring Boot repackaged jar；`ruby -e 'require "yaml"; YAML.load_file("backend/src/main/resources/application.yml"); puts "yaml-ok"'` 输出 `yaml-ok`；`git diff --check` 通过；`command -v docker` 仍无输出，本机不能执行 `docker build`。本地审计结论不变：`frontend/nginx.conf` 的前后端分离部署与 `server.servlet.context-path=/api`、前端 `baseURL=/api` 是自洽的；根 `Dockerfile` 当前把 Vite dist 拷入 Spring Boot 运行镜像，但后端仍挂在 `/api` context-path 下，单容器根路径 `/`、`/workflows` 的 SPA fallback 仍缺真实证明，不应作为最终生产部署形态。
- E 批前端非移动端 API/页面/组件 reviewer 复核（2026-06-09 15:28）：`npx vitest run src/__tests__/noLegacyAppImports.test.ts src/api/__tests__/*.test.ts src/components/comment/UserMentionAutocomplete.test.tsx src/components/depreciation/DepreciationCard.test.tsx src/components/fault-code/FaultCodeSelector.test.tsx src/pages/workorder/WorkOrderAcceptancePage.test.tsx src/pages/workorder/workOrderFormMapper.test.ts src/__tests__/ReportsPage.test.tsx src/__tests__/pages/ReportPage.test.tsx src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`36` 个文件、`93` 个测试通过；`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`git diff --check` 通过。只读引用检查确认非 legacy 主路由只引用 `AssetImportExportPage`，未引用已删除的 `ImportTab/ExportTab/DragUploadArea/ExportFilterForm`；`noLegacyAppImports` 继续约束非 `src/app/**`、非移动端代码不得引入 `@/app/*`。
- B 批桌面 workflow/通知/权限入口 reviewer 复核（2026-06-09 15:26）：当前 B 批 targeted gate 通过，`npx vitest run src/utils/routePermissions.test.ts src/components/NotificationBell.test.tsx src/api/__tests__/notification.test.ts src/api/__tests__/workflow.test.ts src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`5` 个文件、`20` 个测试通过；`npx playwright test --project=browser-regression-smoke --grep "workflows|模块验收 smoke|approvals|reports" --reporter=line` 通过，`5/5`；`npx tsc -p tsconfig.json --noEmit --pretty false` 通过。只读审计发现 B 批 P1 权限码漂移：`frontend/src/utils/routePermissions.ts` 中 `/settings/webhook` 映射为 `system:config`，但后端 `SysConfigController` 与 schema seed 使用 `system:config:query/edit`；该修复属于行为修改，已触发 brainstorming gate，需用户批准设计后再改。
- A 批供应商门户前后端契约补强（2026-06-09 15:24）：新增 `frontend/src/pages/vendor-portal/VendorPortalPage.test.tsx`，覆盖已登录供应商进入合同页时 `/vendor-portal/contracts` 请求必须携带 `X-Vendor-Token`。`npx vitest run src/pages/vendor-portal/VendorPortalPage.test.tsx --reporter=dot` 通过，`1` 个测试通过；前端 `npx tsc -p tsconfig.json --noEmit --pretty false` 通过；后端 A 批 targeted gate 再次通过，`75` 个测试通过；`git diff --check` 通过。GitNexus impact：`VendorPortalContent` 风险 LOW，0 上游影响、0 流程影响。
- GitNexus detect changes（2026-06-09 15:26）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；最新 `goon.md` 文档边界补强未改变代码符号风险面。GitNexus 继续提示需 review 受影响流程，尤其 `CommitImport`、`CreateCustomDefinition/Publish/UpdateStatus`、`Reclassify*`、`Stocktaking cycle`、`Approval`、`CurrentUserMenus` 等流程。
- 全量回归复跑（2026-06-09 15:11）：后端 `mvn test` 通过，`579` 个测试通过，0 failure/error/skip；前端 `npm test -- --run --reporter=dot` 通过，`82` 个文件、`856` 个测试通过。后端测试数从此前 `571` 增加到 `579`，来自 A 批 `JwtAuthenticationFilterTest` 新增 `/api` context-path 公开边界覆盖。
- GitNexus detect changes（2026-06-09 15:11）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；全量回归通过证明当前工作树运行质量稳定，但 GitNexus critical 未解除，原因仍是累计变更面和跨批影响流程，而非测试失败。
- 仓库状态复核（2026-06-09 15:11）：`git diff --check` 通过；`git status --short` 为 `290` 行；`git diff --cached --name-only` 为 `31` 个 staged 文件；`git ls-files --others --exclude-standard` 为 `78` 个实际未跟踪文件。构建未引入 `frontend/dist` 或 `backend/target` 脏状态。
- 批次 F 基础设施/构建配置 gate 复跑（2026-06-09 15:09）：`npm run build` 通过，仅剩既有 `three-Caxi2su_.js` >1000 kB chunk warning；`mvn package -DskipTests` 通过，Spring Boot repackaged jar 生成成功；`ruby -e 'require "yaml"; YAML.load_file("backend/src/main/resources/application.yml"); puts "yaml-ok"'` 输出 `yaml-ok`。`command -v docker` 无输出，本机仍不能实际执行 `docker build`；构建未新增 `frontend/dist` 或 `backend/target` 脏状态，`git diff --check` 通过。
- 批次 E 前端非移动端 targeted gate 复跑（2026-06-09 15:08）：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx vitest run src/__tests__/noLegacyAppImports.test.ts src/api/__tests__/*.test.ts src/components/comment/UserMentionAutocomplete.test.tsx src/components/depreciation/DepreciationCard.test.tsx src/components/fault-code/FaultCodeSelector.test.tsx src/pages/workorder/WorkOrderAcceptancePage.test.tsx src/pages/workorder/workOrderFormMapper.test.ts src/__tests__/ReportsPage.test.tsx src/__tests__/pages/ReportPage.test.tsx src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`36` 个文件、`93` 个测试通过。该 gate 继续覆盖 legacy app 边界、API wrapper、报表/搜索、评论提及、折旧卡片、故障码选择器、工单验收与表单 mapper；移动端未纳入。
- 批次 B 前端桌面/workflow/通知/权限入口 targeted gate 复跑（2026-06-09 15:07）：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx vitest run src/utils/routePermissions.test.ts src/components/NotificationBell.test.tsx src/api/__tests__/*.test.ts --reporter=dot` 通过，`29` 个文件、`52` 个测试通过；`npx playwright test --project=browser-regression-smoke --grep "workflows|模块验收 smoke|approvals|reports" --reporter=line` 通过，`5/5`。该 gate 覆盖 `/workflows` 保存失败提示、新建模板草稿进入设计器、桌面模块验收、approvals/reports 空态与权限拒绝态，以及 NotificationBell/routePermissions/API wrapper 窄批。
- 批次 D 后端业务流程 targeted gate 复跑（2026-06-09 15:06）：`mvn test -Dtest=AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest -DfailIfNoTests=false` 通过，`82` 个测试通过，0 failure/error/skip。该证据覆盖当前已 staged 的 D 批 controller 测试迁移所服务的核心业务链路；但 index 仍需在提交前按批次重组，不能直接混入 A 批提交。
- 批次 A context-path 安全边界补强（2026-06-09 15:04）：只改测试 `JwtAuthenticationFilterTest`，未改生产 filter。新增 `/api` context-path 场景，覆盖 `/api/vendor-portal/contracts`、`/api/health`、`/api/system/health`、`/api/system/info`、`/api/oauth2-mock/login`、`/api/sso/callback`、`/api/api-docs/openapi.json`、`/api/swagger-ui/index.html` 在带无效 bearer header 时仍旁路系统 JWT；`JwtAuthenticationFilterTest` 单测通过，`20` 个测试通过，0 failure/error/skip。GitNexus impact：`JwtAuthenticationFilterTest` 风险 LOW，0 上游影响、0 流程影响。
- 批次 A targeted gate 复跑（2026-06-09 15:04）：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false` 通过，`75` 个测试通过，0 failure/error/skip。新增测试后 A 批证据从“无 context-path 公开边界”增强到“生产默认 `/api` context-path 公开边界”。
- GitNexus detect changes（2026-06-09 15:04）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；本轮 A 批 test-only 补强未扩大 GitNexus 统计的代码符号变更面，critical 继续来自累计大工作树。
- GAI2 蜂群侧翼只读审计（2026-06-09 15:00）：三路只读审计均未改文件。部署侧翼建议选择“前后端分离/网关代理”，因为当前 `server.servlet.context-path=/api`、前端 `baseURL=/api`、`frontend/nginx.conf` 的 SPA fallback/反代形态天然匹配分离部署；单 Spring Boot 容器内置 SPA 会牵动 context-path、安全链、JWT filter、SPA fallback 和静态资源放行。动态菜单侧翼建议 GO，但只做“后端驱动导航/搜索入口”，不做动态路由注册；`router/index.tsx` 继续作为路由权威，`/menus/current` 只决定侧栏和 Cmd+K 可见入口，并保留静态 fallback。批次边界侧翼确认 A-F 可作为 review 骨架但不能直接作为提交边界，且当前已存在 `31` 个 staged D 批 controller 测试 rename；提交前必须按批次文件级 allowlist 重置/组织 index，避免误提交。
- 索引/未跟踪复核（2026-06-09 15:00）：`git diff --cached --name-only` 为 `31` 个，全部是 `backend/src/test/java-excluded/com/ams/controller/*Test.java -> backend/src/test/java/com/ams/controller/*Test.java` 的 D 批测试迁移；`git diff --name-only` 为 `212` 个 tracked diff；`git ls-files --others --exclude-standard` 为 `78` 个未跟踪文件。前面 `git status --short` 的未跟踪 `72` 是因为未跟踪目录会折叠显示。
- 文件归属复核（2026-06-09 14:55）：`git status --short` 仍为 `290` 行、未跟踪 `72` 个；按路径粗分类为后端 `116`、前端非移动端 `160`、移动端冻结 `7`、文档 `1`、根部已知项 `6`、其他 `0`。这确认当前没有新的未知文件冒出，后续风险来自已知 A-F 批次体量，而不是遗漏分类。
- GitNexus detect changes（2026-06-09 14:54）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；本轮仅补充 A 批次证据与文档记录，未扩大代码符号变更面。当前继续阻塞“100 分完成”的不是测试闸失败，而是累计大工作树仍需按 A-F 批次 review/验收。
- 批次 A 后端安全/schema/工作流/供应商门户 targeted gate 复跑（2026-06-09 14:53）：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false` 通过，`67` 个测试通过，0 failure/error/skip。GitNexus impact 复核关键入口均为 LOW：`JwtAuthenticationFilter.doFilterInternal`、`SecurityConfig.securityFilterChain`、`MyBatisPlusConfig.mybatisPlusInterceptor`、`AuditSchemaInitializer.seedMenus`、`VendorPortalController.login/getContracts`、`WorkflowDefinitionController.saveDraft/publish`。
- 批次 E 前端非移动端边界复核（2026-06-09 14:50）：复查 legacy app 边界、API baseURL 和附件 URL 使用。`noLegacyAppImports.test.ts` 已纳入 E targeted gate，证明非 `src/app/**`、非 `pages/mobile/**` 代码不再引入 `@/app/*`。只读审计发现非阻断 P1：`AssetAttachmentUpload` 直接拼接 `import.meta.env.VITE_API_BASE_URL + filePath`，在未设置 `VITE_API_BASE_URL` 时会生成 `undefined/...`；同目录 `AttachmentList` 已有相对路径补 `/api/file` 的降级逻辑，后续应统一成共享附件 URL helper 并补预览测试。
- 批次 E 前端非移动端 targeted gate 复跑（2026-06-09 14:50）：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx vitest run src/__tests__/noLegacyAppImports.test.ts src/api/__tests__/*.test.ts src/components/comment/UserMentionAutocomplete.test.tsx src/components/depreciation/DepreciationCard.test.tsx src/components/fault-code/FaultCodeSelector.test.tsx src/pages/workorder/WorkOrderAcceptancePage.test.tsx src/pages/workorder/workOrderFormMapper.test.ts src/__tests__/ReportsPage.test.tsx src/__tests__/pages/ReportPage.test.tsx src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`36` 个文件、`93` 个测试通过。
- GitNexus detect changes（2026-06-09 14:51）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；本轮 E 批次只读复核、targeted gate 复跑和文档记录未扩大代码符号变更面。
- 批次 D 后端业务流程只读复核（2026-06-09 14:48）：GitNexus impact 复核关键符号：`AssetController.commitImport` risk LOW、无上游调用；`StocktakingService.startCycle` risk LOW，直接影响 `StocktakingCycleController.create` 与 `StocktakingServiceImpl.startCycle`；`ApprovalService.approve` risk LOW，直接影响 `ApprovalController.approve/reject`；`TenantContext` 引用面广，仍需靠 targeted/full test 兜底。只读审计发现非阻断 P1：`AssetController.exportAssets` 会对 CSV 字段做逗号/引号转义，但 `parseImportFile` 当前用简单 `split(",")`，含逗号的资产名称/备注会解析错列；该项属于行为修复，需按 brainstorming gate 确认后再改。
- 批次 D 后端业务流程 targeted gate 复跑（2026-06-09 14:48）：`mvn test -Dtest=AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest -DfailIfNoTests=false` 通过，`82` 个测试通过，0 failure/error/skip。
- GitNexus detect changes（2026-06-09 14:49）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；本轮 D 批次只读复核、targeted gate 复跑和文档记录未扩大代码符号变更面。
- 批次 F 基础设施/文档静态审计（2026-06-09 14:38）：修复未跟踪 `Dockerfile` 的镜像构建与探活问题：前端构建阶段改为 `npm ci`，避免 Vite/TypeScript devDependencies 缺失；运行镜像安装 `curl`；healthcheck 最终对齐到公开健康接口 `/api/health`。同步更新 `docs/TEST_RECOVERY_PLAN.md`，将 controller surefire 排除、forkCount/argLine、最新 `571/856` 测试证据写回计划。`git diff --check` 与行尾空白检查通过；本机无 `docker` 命令，Docker 镜像构建尚未实际验证。
- 批次 F 继续审计（2026-06-09 14:45）：`application.yml` 可被 Ruby YAML parser 正常解析；但部署拓扑仍有 P1 设计风险：后端默认 `server.servlet.context-path=/api`，Dockerfile 复制 Vite `dist` 到同一个 Spring Boot 进程后，静态资源也会受 servlet context 影响，根路径 `/` 未被证明能直接打开前端。该问题需要明确选择“单容器内置前端 + SPA fallback + API 前缀适配”或“前后端分离/网关代理”方案，不能用一行 Dockerfile 偷改。
- 批次归属复核（2026-06-09 14:47）：按当前 A-F 批次规则、移动端冻结规则和 `.DS_Store` 仓库卫生规则统计，当前变更无 `UNCLASSIFIED` 文件；归属为 A 后端安全/schema/工作流/供应商门户 `26` 个、D 后端业务/测试恢复 `87` 个、E 前端非移动端 `160` 个、F 基础设施/文档/配置 `9` 个、移动端冻结 `7` 个、`.DS_Store` `1` 个。风险从“未知散乱”收敛为“每批体量仍大，需要逐批验收/提交边界”。
- 批次 F 构建阶段模拟验证（2026-06-09 14:41）：无 Docker 环境下分别模拟 Dockerfile 两个构建阶段：`cd frontend && npm run build` 通过，仅剩既有 >1000 kB chunk warning（`three-Caxi2su_.js` 约 `1,067.12 kB`）；`cd backend && mvn package -DskipTests` 通过，JaCoCo report 可加载 `target/jacoco.exec` 并分析 `313` 个 classes，Spring Boot repackaged jar 生成成功。仍未覆盖真实 `docker build` 与容器内 `/`、`/workflows`、`/api/actuator/health` 路由 smoke。
- 批次 F 本地同进程 smoke（2026-06-09 14:45）：使用 `mvn spring-boot:run -Dspring-boot.run.classpathScope=test` 加载 `frontend/dist` 到 `spring.web.resources.static-locations`，服务成功在 `18080` 端口启动；`/api/health` 返回 `200`，因此 Dockerfile healthcheck 已改为 `/api/health` 并用本地实例验证通过。负向证据：`/` 与 `/workflows` 均返回 `404`，`/api/`、`/api/index.html`、`/api/assets/...` 均被安全链拦截为 `401`，证明当前“单 Spring Boot 进程直接服务桌面 SPA”仍不成立。
- GitNexus detect changes（2026-06-09 14:46）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`。本轮 Dockerfile/goon 修正未扩大代码符号风险，critical 仍来自累计大工作树和跨批业务变更。
- GitNexus detect changes（2026-06-09 14:38）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`；新增计数来自 F 批次 Dockerfile/文档/配置整理和累计工作树，仍需分批 review 收敛。
- 批次 E 前端非移动端 targeted gate（2026-06-09 14:35）：`npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx vitest run src/api/__tests__/*.test.ts src/components/comment/UserMentionAutocomplete.test.tsx src/components/depreciation/DepreciationCard.test.tsx src/components/fault-code/FaultCodeSelector.test.tsx src/pages/workorder/WorkOrderAcceptancePage.test.tsx src/pages/workorder/workOrderFormMapper.test.ts src/__tests__/ReportsPage.test.tsx src/__tests__/pages/ReportPage.test.tsx src/__tests__/GlobalSearch.test.tsx --reporter=dot` 通过，`35` 个文件、`92` 个测试通过；`npm run build` 通过，仅剩既有 >1000 kB chunk warning（`three-Caxi2su_.js` 约 `1,067.12 kB`）。该 gate 覆盖 API wrapper、报表、全局搜索、评论用户提及、折旧卡片、故障码选择器、工单验收与表单 mapper。
- 批次 D 后端业务流程 targeted gate（2026-06-09 14:31）：`mvn test -Dtest=AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest -DfailIfNoTests=false` 通过，`82` 个测试通过，0 failure/error/skip。该 gate 覆盖资产导入提交、盘点周期/权限、审批状态机、通知事件监听器、ABC 分类 controller/service。
- 后端全量回归（2026-06-09 14:25）：修复 `AuditSchemaInitializer` 工作流菜单旧 seed 后复跑 `mvn test` 通过，`571` 个测试通过，0 failure/error/skip。
- 变更面复核（2026-06-09 14:25）：全仓 `git diff --check` 通过；`git status --short` 为 `290` 行，未跟踪项 `72` 个；GitNexus `detect_changes(scope=all)` 仍为 `critical`，`changed_count=657`、`affected_count=59`、`changed_files=206`。当前 critical 仍来自累计大工作树，非本轮 initializer 修复单点风险。
- 前端桌面 targeted gate（2026-06-09 14:21）：主线程复跑 `npx tsc -p tsconfig.json --noEmit --pretty false` 通过；`npx vitest run src/utils/routePermissions.test.ts src/components/NotificationBell.test.tsx src/api/__tests__/*.test.ts --reporter=dot` 通过，`29` 个文件、`52` 个测试通过；`npx playwright test --project=browser-regression-smoke --grep "workflows|模块验收 smoke|approvals|reports" --reporter=line` 通过，`5/5`。该 gate 覆盖 `/workflows` 保存失败提示、新建模板草稿进入设计器、桌面模块验收、approvals/reports 空态与权限拒绝态。
- 蜂群只读审计与 P0 修复（2026-06-09 14:20）：后端审计发现 `AuditSchemaInitializer.seedMenus()` 仍会在非 test 启动时把工作流菜单覆盖回旧 `workflow-definition/system/workflow/index/workflow:definition:list`。已修复为 `workflows/workflow/WorkflowCenterPage/workflow:definition:query`，并在 `PermissionSeedSchemaTest` 增加 initializer 防回归断言；`PermissionSeedSchemaTest` 通过，`9` 个测试通过。
- 首批后端 review targeted gate（2026-06-09 14:19）：修复 initializer P0 后复跑 `mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false` 通过，`67` 个测试通过，0 failure/error/skip。
- GitNexus detect changes（2026-06-09 14:20）：`scope=all` 仍为 `critical`，`changed_count=657`、`affected_count=59`、`changed_files=206`；新增变化来自 `AuditSchemaInitializer` P0 修复。该符号 impact 为 LOW，`seedMenus` 直接调用者仅 `ensureRbacSchema`，再到启动 `run`，未命中业务执行流。
- 前端蜂群只读审计（2026-06-09 14:18）：前端桌面/workflow/NotificationBell/API wrapper 批次结论 `PASS`；审计员跑过 targeted Vitest `29` 个文件、`52` 个测试通过，并确认 `tsc --noEmit` 通过。非阻断 P2：`WorkflowDesignerPage` 错误 toast 关闭按钮当前清 `saveMsg` 而非 `saveErr`，需按 brainstorming gate 获得确认后再改。
- 首批后端 review targeted gate（2026-06-09 14:15）：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false` 通过，`66` 个测试通过，0 failure/error/skip。该 gate 覆盖系统 JWT/公开边界、供应商门户 token 边界、工作流权限与保存读取、迁移命名、租户/schema/menu seed、MyBatis Plus 租户白名单。
- 变更面复核（2026-06-09 14:10）：全仓 `git diff --check` 通过；`git status --short` 仍为 `289` 行，未跟踪项 `72` 个；GitNexus `detect_changes(scope=all)` 仍为 `critical`，`changed_count=655`、`affected_count=59`、`changed_files=205`。当前风险继续来自累计大工作树，不来自刚刚的前端复跑或文档更新。
- 前端最新质量闸复跑（2026-06-09 14:10）：`npx tsc --noEmit` 通过；`npm test -- --run --reporter=dot` 通过，`82` 个文件、`856` 个测试通过；`npm run build` 通过，仅剩既有 >1000 kB chunk warning（含 `three` chunk）；`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。其中 `/workflows` 保存失败提示与新建模板草稿进入设计器两条 smoke 均通过。
- 安全测试证明方式收敛（2026-06-09 14:05）：移除 `SecurityConfigTest` 中读取源码字符串断言 `/vendor-portal/**` 的弱测试，真实边界由 `SecurityFilterChainBehaviorTest` 承接；`mvn test -Dtest=SecurityConfigTest,SecurityFilterChainBehaviorTest,JwtAuthenticationFilterTest,VendorPortalControllerTest -DfailIfNoTests=false` 通过，`23` 个测试通过；相关 `git diff --check` 通过。注意 `backend/src/test/java/com/ams/config/` 当前仍是 untracked 目录，后续分批提交时必须显式纳入。
- 工作树噪声收口（2026-06-09 14:04）：全仓 `git diff --check` 通过；`.gitignore` 补 `frontend/.next/`，`frontend/.next/` 不再出现在 `git status --short` 未跟踪列表。当前 `git status --short` 仍为 `289` 行，未跟踪项约 `72` 个；`.DS_Store` 虽已被 ignore，但因历史 tracked 仍显示修改，后续应单独 `git rm --cached .DS_Store` 做仓库卫生处理。
- GitNexus detect changes（2026-06-09 14:04）：`scope=all` 仍为 `critical`，`changed_count=655`、`affected_count=59`、`changed_files=205`。新增 `changed_files` 来自 `.gitignore` 自身；整体 critical 仍来自累计大工作树。
- 后端全量回归（2026-06-09 14:02）：最新安全 filter 改动后复跑 `mvn test` 通过，`571` 个测试通过，0 failure/error/skip。
- 安全链 targeted 回归（2026-06-09 13:59）：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest -DfailIfNoTests=false` 通过，`24` 个测试通过；`git diff --check` 针对 JWT/security/goon 相关文件通过。
- GitNexus detect changes（2026-06-09 13:59）：`scope=all` 仍为 `critical`，`changed_count=655`、`affected_count=59`、`changed_files=204`。本次 `JwtAuthenticationFilter/isTenantProtectedRequest` impact 为 LOW，整体 critical 仍来自累计大工作树。
- JWT/security targeted 回归（2026-06-09 13:54）：`mvn test -Dtest=JwtAuthenticationFilterTest,SecurityConfigTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest -DfailIfNoTests=false` 通过，`14` 个测试通过；`git diff --check` 针对 JWT filter/test 文件通过。
- GitNexus detect changes（2026-06-09 13:54）：`scope=all` 仍为 `critical`，`changed_count=654`、`affected_count=59`、`changed_files=204`。JWT 定点修复已验证，但整体风险仍由累计大工作树驱动，后续必须继续分批验收。
- NotificationBell targeted 回归（2026-06-09 13:50）：`npm test -- --run src/components/NotificationBell.test.tsx src/api/__tests__/notification.test.ts --reporter=dot` 通过，`2` 个文件、`3` 个测试通过；`npx tsc --noEmit` 通过；前端全量 `npm test -- --run --reporter=dot` 再次通过，`82` 个文件、`856` 个测试通过。
- 前端类型/测试/构建闭环（2026-06-09 13:48）：`npx tsc --noEmit` 通过；targeted Vitest `6` 个文件、`37` 个测试通过；前端全量 `npm test -- --run --reporter=dot` 通过，`82` 个文件、`856` 个测试通过；`npm run build` 通过，仅剩既有大 chunk warning。
- GitNexus detect changes（2026-06-09 13:48）：`scope=all` 仍为 `critical`，`changed_count=656`、`affected_count=59`、`changed_files=204`。typecheck 修复增加了少量前端测试/类型符号，未降低整体 critical；下一步仍要靠分批 staging/review 收敛。
- 数据库/schema P0 targeted 回归（2026-06-09 13:42）：`mvn test -Dtest=PermissionSeedSchemaTest,MigrationFileNamingTest,TenantSchemaConsistencyTest,VendorPortalControllerTest,MyBatisPlusConfigTest -DfailIfNoTests=false` 通过，`24` 个测试通过；`git diff --check` 针对迁移/schema/test 文件通过；`V2_36`、`V2_58` 当前无 diff。
- GitNexus detect changes（2026-06-09 13:42）：`scope=all` 仍为 `critical`，`changed_count=647`、`affected_count=59`、`changed_files=202`。风险仍来自累计大工作树，但历史迁移恢复已将 changed_files 从 `204` 降到 `202`。
- 本轮前端质量闸复跑（2026-06-09 10:03）：`npm test -- --run --reporter=dot` 通过，`82` 个测试文件、`856` 个测试通过；`npm run build` 通过，仅剩既有大 chunk warning；`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。
- 后端目标回归：`mvn test -Dtest=MyBatisPlusConfigTest,VendorPortalControllerTest,SecurityConfigTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest` 通过，`16` 个测试通过。
- 后端全量测试：`mvn test` 通过，`538` 个测试通过，0 failure/error/skip。
- 前端全量测试：`npm test -- --run --reporter=dot` 通过，`82` 个测试文件、`856` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- `/workflows` 定向浏览器回归：`2/2` 通过。
- 浏览器回归 smoke：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。
- GitNexus 索引恢复：已执行 `node .gitnexus/run.cjs analyze --force`，重建结果 `44,377` nodes、`73,155` edges、`300` flows；`canAccessRoute` impact 恢复正常，风险 LOW，直接调用者为 `AppLayout`、`GlobalSearch`。
- GitNexus detect changes：重建后 `scope=all` 能识别 changed symbols/affected processes；由于本轮未提交工作树累计改动很大，最新返回 `risk_level=critical`、`changed_count=647`、`affected_count=59`、`changed_files=204`。后续继续改共享符号前必须按 HIGH/CRITICAL 谨慎路径执行 targeted impact 与验证。
- 菜单/导入/盘点目标回归：
  - `mvn test -Dtest=PermissionSeedSchemaTest,MigrationFileNamingTest` 通过，`7` 个测试通过。
  - `mvn test -Dtest=AuthServiceTest,SecurityConfigTest,PermissionSeedSchemaTest,MigrationFileNamingTest` 通过，`13` 个测试通过。
  - `mvn test -Dtest=AssetControllerTest,PermissionSeedSchemaTest,MigrationFileNamingTest` 通过，`21` 个测试通过。
  - `mvn test -Dtest=StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest` 通过，`15` 个测试通过。
  - `mvn test -Dtest=ApprovalServiceTest,NotificationEventListenerTest,NotificationServiceTest` 通过，`47` 个测试通过。
  - `mvn test -Dtest=VendorPortalControllerTest,SecurityConfigTest` 通过，`9` 个测试通过。
  - `mvn test -Dtest=WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest,NotificationEventListenerTest` 通过，`30` 个测试通过。
  - `mvn test -Dtest=GlobalExceptionHandlerTest,StatsControllerTest,MaintenanceExecutionServiceTest` 通过，`17` 个测试通过，且不再输出这两类预期异常堆栈。
- 后端全量测试：`mvn test` 在新增通知事件、供应商门户负向、工作流 roundtrip 验收和测试日志收敛后通过，`555` 个测试通过，0 failure/error/skip。

### 当前剩余风险
- 100 分差距判定（2026-06-09 15:45）：当前项目运行质量已有较强证据（后端全量 `579`、前端全量 `856`、多批 targeted gate 均通过），但不能判 100 分。阻塞项是 `scope=all` 仍为 GitNexus `critical`、工作区/未跟踪/当前 index 未完成可审计切片、D staged 不完整、F 生产部署链路未验证且存在 frontend Docker/nginx 阻断级风险。下一阶段必须先修复提交边界和部署阻断，再考虑动态菜单消费、CSV parser、附件 URL helper、资产导出筛选等行为修复。
- GitNexus 最新复核（2026-06-09 15:58）：`detect_changes(scope=all)` 仍为 `critical`，`changed_count=660`、`affected_count=59`、`changed_files=206`。关键候选修复的 upstream impact：`canAccessRoute` LOW，直接影响 `AppLayout`、`GlobalSearch`、`routePermissions.test.ts`；`AssetImportExportPage` LOW；`AssetAttachmentUpload` LOW；`AssetController.splitCsvLine` LOW，直接调用者 `parseImportFile`；`InAppChannel` LOW，当前测试已存在 `NotificationServiceTest.inAppChannelSkipsPersistedRecord`；`TenantContext` CRITICAL，`154` impacted、`91` direct。因此 D2b 租户安全链必须独立门禁，不得混入 D2a 普通业务修复。
- 文件边界复核（2026-06-09 15:24）：采用稳定口径重算后，tracked diff 为 `212` 个文件，其中后端 `86`、前端非移动端 `117`、移动端冻结 `4`、根/文档/配置 `5`；未跟踪文件为 `78` 个，其中后端 `30`、前端非移动端 `43`、移动端冻结 `3`、根/文档 `2`。移动端冻结项仍是 `frontend/src/pages/mobile/MobileAssetListPage.tsx`、`MobileDashboardPage.tsx`、`MobileLayout.tsx`、`MobileScanPage.tsx` 以及未跟踪的 `MobileAssetDetailPage.tsx`、`MobileNotificationsPage.tsx`、`MobileWorkOrdersPage.tsx`，当前没有任何移动端文件在 staged index 中。
- staged index 精确复核（2026-06-09 15:24）：`git diff --cached --name-status` 为 `31` 条，全部是 `R100` controller 测试迁移；但 `git status --short` 显示其中 `25` 条为 `RM`、`6` 条为纯 `R`。这意味着当前 index 只保存了 rename 形态，未保存 25 个新位置测试文件的内容修改。该状态不能用于任何提交，也不能作为 A/D 批通过证据。
- D1 精确边界建议：从空 index 开始，单独纳入 `backend/src/test/java-excluded/com/ams/controller/*Test.java` 到 `backend/src/test/java/com/ams/controller/*Test.java` 的 controller 测试恢复，并确保 `ApprovalControllerTest`、`AssetCategoryControllerTest`、`AssetControllerTest`、`AuditDashboardControllerTest`、`AuthControllerTest`、`BigScreenControllerTest`、`BusinessCommentControllerTest`、`DashboardControllerTest`、`DeptControllerTest`、`EnergyControllerTest`、`FloorPlanControllerTest`、`IdleAssetControllerTest`、`InventoryControllerTest`、`MaintenanceControllerTest`、`MaintenanceExecutionControllerTest`、`NotificationControllerTest`、`NotificationPreferenceControllerTest`、`RetirementControllerTest`、`RoleControllerTest`、`SafetyChecklistControllerTest`、`StatsControllerTest`、`SystemHealthControllerTest`、`UserSearchControllerTest`、`VendorControllerTest`、`WorkOrderControllerTest` 的内容修改与 rename 同时暂存；`CompensationControllerTest`、`DepreciationControllerTest`、`DisposalControllerTest`、`LocationControllerTest`、`ReportControllerTest`、`UserManagementControllerTest` 当前为纯 rename，可随 D1 一起纳入。
- D2 精确边界建议：后端业务链路修复和测试增强应独立于 D1，包括资产导入、盘点、审批、通知事件、ABC 分类、租户上下文、工单/库存/借用/SLA 等生产与测试文件；该批的已验证 targeted gate 是 `82` 个测试通过，但提交前仍需从空 index 按 allowlist 重新 stage 并跑 `detect_changes(scope=staged)`。
- E/F/C 精确边界建议：E 只纳入 `frontend/src/api/**` wrapper 与测试、非移动端页面/组件类型收敛、legacy app 边界测试和桌面组件测试，继续排除 `frontend/src/pages/mobile/**`；F 只纳入 `Dockerfile`、`backend/pom.xml`、`backend/src/main/resources/application*.properties`、AGENTS/CLAUDE/docs 等构建与运行配置；C 只处理 `.gitignore`、`goon.md`、`.DS_Store` 索引卫生，且 `.DS_Store` 需要用户明确确认后单独执行。
- 提交边界风险（2026-06-09 15:15）：当前 index 不是空的，且不是 A 批。`git diff --cached --name-status` 显示 `31` 个 D 批 controller 测试从 `backend/src/test/java-excluded/com/ams/controller/*Test.java` 到 `backend/src/test/java/com/ams/controller/*Test.java` 的 `R100` rename；但 `git status --short` 同时显示大量 `RM`，说明这些新位置测试文件还有未暂存内容修改。不能直接提交当前 index，否则会形成“只移动测试文件、未带入内容修复”的半截 D 批提交。
- 提交前安全顺序建议（需用户确认后执行 Git index 操作）：先 `git restore --staged :/` 清空 index（不改工作树），再按文件级 allowlist 重新 `git add`。禁止目录级 `git add .`、`git add frontend/src`、`git add backend/src/test/java/com/ams/controller`，否则容易混入移动端冻结项、`.DS_Store`、A/D/E/F 跨批文件或未审计内容。
- 批次 A 可作为第一提交候选，但必须从空 index 开始，只纳入后端安全/schema/工作流/供应商门户文件：
  - 生产/配置：`backend/src/main/java/com/ams/config/AuditSchemaInitializer.java`、`backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`、`backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`、`backend/src/main/java/com/ams/config/SecurityConfig.java`、`backend/src/main/java/com/ams/controller/VendorPortalController.java`、`backend/src/main/java/com/ams/controller/WorkflowDefinitionController.java`、`backend/src/main/java/com/ams/mapper/SysMenuMapper.java`、`backend/src/main/resources/schema.sql`、`backend/src/test/resources/application-test.properties`。
  - 前端供应商门户契约：`frontend/src/pages/vendor-portal/VendorPortalPage.tsx`、`frontend/src/pages/vendor-portal/VendorPortalPage.test.tsx`。原因：后端合同/profile/detail 接口已要求 `X-Vendor-Token`，A 批若只提交后端会造成供应商门户合同页断裂。
  - 新迁移：`backend/src/main/resources/migration/V2_69__asset_detail_support_tables.sql`、`V2_70__canonical_default_tenant_id.sql`、`V2_71__abc_permissions.sql`、`V2_72__sys_tenant_id_width.sql`、`V2_73__workflow_menu_alignment.sql`、`V2_74__desktop_menu_route_metadata.sql`。
  - 测试：`backend/src/test/java/com/ams/config/JwtAuthenticationFilterTest.java`、`MigrationFileNamingTest.java`、`MyBatisPlusConfigTest.java`、`PermissionSeedSchemaTest.java`、`SecurityConfigTest.java`、`SecurityFilterChainBehaviorTest.java`、`TenantSchemaConsistencyTest.java`、`backend/src/test/java/com/ams/controller/VendorPortalControllerTest.java`、`backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java`、`backend/src/test/java/com/ams/service/WorkflowDefinitionServiceTest.java`。
  - A 批提交前复验命令：`cd backend && mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false`；`cd frontend && npx vitest run src/pages/vendor-portal/VendorPortalPage.test.tsx --reporter=dot`；`cd frontend && npx tsc -p tsconfig.json --noEmit --pretty false`。最终已由 `mvn test` 全量 `579`、前端全量 `856` 通过兜底。
- 批次 D 不能直接使用当前 staged 状态提交，应拆为 D1/D2：
  - D1：controller 测试恢复与内容修改，必须同时纳入 `backend/src/test/java-excluded/com/ams/controller/*Test.java` 的删除/rename 和 `backend/src/test/java/com/ams/controller/*Test.java` 新位置的内容修改；当前 staged 只覆盖 rename，不完整。
  - D2：后端业务链路修复与测试增强，包含 `AssetController`、`Stocktaking*`、`ApprovalService`、`NotificationEventListener`、`ABCClassification*`、`TenantContext`、`AssetService`、`InventoryService`、`SlaService`、`WorkOrder*` 及对应 service/event/common 测试。D 批提交前复验命令仍是 `mvn test -Dtest=AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest -DfailIfNoTests=false`；已于 15:06 通过 `82` 个测试。
- 批次 B/E/F/C 提交边界：
  - B：桌面 workflow、NotificationBell、routePermissions、窄 API wrapper 与浏览器 smoke，不纳入动态 `/menus/current` 消费实现。
  - E：更宽的前端非移动端 API/页面/组件类型收敛，必须排除 `frontend/src/pages/mobile/**`，并把 `frontend/src/app/**` 只作为 legacy 边界例外处理。
  - F：Dockerfile、backend/frontend 构建配置、profile、文档；部署拓扑建议前后端分离/网关代理，真实 `docker build` 仍需有 Docker 的环境补验。
  - C：仓库卫生与交接，`.DS_Store` 只有用户明确确认后才单独 `git rm --cached .DS_Store`，不得混入业务批。
- 蜂群旧审计对账（2026-06-09 10:08）：此前指出的 workflow 写权限、workflow 菜单 seed、非 app/mobile 的 `@/app` 引用、`sys_tenant`/workflow node/edge 租户白名单、供应商门户 `default` tenant token、`/workflows` 本地草稿误导文案均已在当前工作树收敛，并由对应测试/`rg`/浏览器 smoke 覆盖。
- 当前最大风险不是单点功能，而是变更面：`git status --short` 约 `289` 条，未跟踪项约 `72` 个，tracked diff 约 `210` 个文件、`3449` insertions、`4743` deletions；GitNexus 仍判定 `critical`。下一阶段应优先分批验收和提交边界，不应继续混入大面积功能改动。
- 仓库卫生剩余点：`frontend/.next/` 已 ignore；`.DS_Store` 仍是历史 tracked 文件，需后续单独从 Git 索引移除，避免 macOS 元数据持续制造脏变更。
- 蜂群后端审计提出的 P0 “历史迁移被改写 / 旧库 asset_parent_child 不会补齐”已修复；剩余需继续验证的是 V2_69 在真实已执行旧 V2_36 的数据库上的执行效果（当前为静态 SQL + 单测证据）。
- 蜂群后端审计提出的 P1 已有认证上下文 JWT tenant mismatch 已修复；`SecurityConfig` 字符串/反射类断言薄弱点已补真实 `SecurityFilterChain` 行为测试，并修复了公开/供应商门户路径带陈旧系统 `Authorization` 头被 JWT filter 提前拦截的问题。
- 蜂群前端审计提出的 P1 `tsc --noEmit` 失败与 NotificationBell 未读数契约已修复；剩余前端风险集中在动态 `/menus/current` 接入前的权限源设计，以及全局 critical 变更面切片。
- E 批次附件预览 URL 仍有 P1 兼容风险：`AssetAttachmentUpload` 在未配置 `VITE_API_BASE_URL` 时会把图片预览/打开 URL 拼成 `undefined/...`；建议抽取共享 `resolveAttachmentUrl(filePath, id?)`，复用 `AttachmentList` 的相对路径策略。
- E 批次资产导出筛选仍有 P1 行为风险：`AssetImportExportPage` 读取了 `exportCategory` 并传入 `filters.categories`，但调用 `exportAssets` 时当前硬编码 `categoryCodes: []`，导致页面上的分类筛选不会进入 `/assets/export` 请求；`frontend/src/api/__tests__/assetImport.test.ts` 只覆盖 API wrapper 本身，未覆盖页面筛选传递。建议补页面级测试并将 `categoryCodes` 改为 `filters.categories`，但该项属于行为修复，需先经 brainstorming gate 批准。
- B 批次 `/settings/webhook` 权限不是单点前端问题，而是三方口径漂移：`frontend/src/utils/routePermissions.ts` 用裸 `system:config`；`WebhookConfigController` 也用裸 `system:config`；但 `schema.sql` 与 `AuditSchemaInitializer` 只 seed `system:config:query`、`system:config:edit`。推荐设计是后端 GET/list/test 类接口改为 `system:config:query`，保存/删除/触发类接口改为 `system:config:edit`，前端路由可见性使用 `query` 或 `edit` 任一权限，并补 controller/routePermissions 测试。该项属于权限行为修复，需用户批准后执行。
- GitNexus 本地索引已恢复；重建时仍有 `scripts/test_workflow_e2e.py` scope extraction warning，但整体索引成功。当前主要风险从“图谱不可用”转为“未提交变更面过大，需要分批 review/验收”。
- 供应商门户目前已从系统 JWT/默认租户中拆出，但仍是轻量门户 token 模型；若要达到生产级，需要进一步设计供应商会话、token 吊销、合同访问审计和供应商资源租户化。
- 桌面侧栏仍是硬编码 `NAV_GROUPS`，未完全消费 `/menus/current` 动态菜单；当前已增加静态权限过滤，并补齐动态菜单所需的 visible 过滤与核心桌面 path/component 元数据。下一轮可以做前端适配层，但要保留静态 fallback。
- `frontend/src/app/**` legacy tree 仍存在，已由边界测试防止非 app/mobile 引入；下一轮可继续归档未引用旧代码。
- Flyway 仍默认关闭；本轮新增迁移必须明确进入部署链路，或继续同步到 `schema.sql` 的新库路径。
- D 批次资产导入 CSV 解析仍有 P1 兼容性风险：导出端会转义含逗号/引号字段，但导入端简单按逗号切分；若用户把导出的 CSV 再导入，带逗号字段可能错列。修复需要设计 CSV parser 策略并补测试。
- D 批次通知链路契约已补强 test-only 证据：`InAppChannel` 现在有未持久化记录会 `notificationService.create`、已带 `record.id` 会跳过重复插入的双向测试。剩余若要改变“已带 id 直接跳过”的行为，必须作为产品/领域语义变更重新设计，不应在当前 D2a 顺手改。
- D 批次租户链路仍需最高级别门禁：`TenantContext`/JWT/MyBatis 租户拦截/默认租户迁移属于全局行为，侧翼 impact 给出 CRITICAL 级引用面（154 impacted / 91 direct）。D2 必须继续拆成 D2a 业务链路与 D2b 租户安全链，D2b 不得和资产导入、ABC、盘点等普通业务修复混在同一提交。
- F 批次部署链路仍有生产阻断：`frontend/Dockerfile`、`frontend/nginx.conf`、根 `Dockerfile`、Flyway/`schema.sql`/`spring.sql.init` 策略需要单独设计确认。推荐生产形态仍是“前端 nginx/CDN/网关服务 `/` + 反代 `/api/` 到后端 `/api` context-path”，并把根 `Dockerfile` 视为构建/过渡镜像，直到真实 Docker smoke 证明根路径、深链和 API 代理均可用。
- F 批次本地证据补强（2026-06-09 15:58）：`frontend/package.json` 的 `build` 是 `vite build`，`vite` 与 `@vitejs/plugin-react` 均只在 `devDependencies`；因此 `frontend/Dockerfile` 的 `npm ci --only=production` 与构建命令冲突。`frontend/nginx.conf` 当前包含顶层 `events`/`http`，但 Dockerfile 复制到 `/etc/nginx/conf.d/default.conf`，应改为 server-only conf.d 文件或改复制目标为完整 nginx 主配置。迁移文档写 Flyway 自动执行，但 `application.properties`/`application.yml` 均关闭 Flyway，`pom.xml` 未见 `flyway-core`，且 `application.yml` 的 `spring.sql.init.mode=always`、`continue-on-error=true` 不适合作为生产升级策略。
- 后端负向测试的大段预期异常堆栈已在 test profile 下压掉；剩余 WARN/INFO 主要是租户越权、缺租户等断言场景的结构化提示，后续可按需继续细化。

### GAI2 100 分路线（2026-06-09 15:45）
- current truth：功能测试层面已大幅恢复，但 `scope=all` 仍是 CRITICAL，当前 staged index 不是可提交状态，生产部署还不是 PASS。
- required change：先把当前工作树切成 A/D1/D2a/D2b/B/E/F/C 可审计批次；每批从空 index 按 allowlist stage，跑 `detect_changes(scope=staged)`、对应 targeted gate 和必要全量 gate；移动端文件继续冻结。
- write_scope：现阶段主线程只允许文档/审计记录；若继续写行为修复，需先确认对应设计：B1 `/settings/webhook` 权限码映射、E1 资产导出分类传递、E2 附件 URL helper、D3 CSV parser、F1 双容器部署拓扑与迁移策略。
- acceptance checks：最终 100 分必须同时满足后端全量、前端全量、前端 build、桌面 Playwright smoke、`git diff --check`、`detect_changes(scope=staged/compare)` 可解释、Docker/nginx/Flyway 策略有真实证据或明确不纳入生产。
- next executable path：先征得允许后执行 index 重组（`git restore --staged :/` 只清空 index、不改工作树），随后优先 stage/review A 批；并行开展 F1 部署方案修复，因为它当前是生产 readiness 的硬阻断。

### GAI2 蜂群 workcard（2026-06-09 14:12）
- 当前事实：后端全量 `571` 测试通过，前端 `tsc`/`856` Vitest/构建/`11` 条浏览器 smoke 通过；`/workflows` 新建模板流程和保存失败提示均已被 smoke 覆盖；后端蜂群发现的 `AuditSchemaInitializer` 工作流旧菜单 P0 已修复并由全量回归覆盖。移动端文件仍有历史脏变更，但本轮冻结，不再继续扩写。
- 目标差距：项目还不能判 100 分，原因不是单测失败，而是 `211` 个 diff 文件、`72` 个未跟踪项、GitNexus `critical` 的变更面仍未切片审计；动态 `/menus/current` 接入、供应商门户生产会话、仓库卫生仍未落地。
- write_scope：下一批建议 `allowlist`，仅允许文档/测试/桌面菜单适配相关文件；继续禁止编辑 `frontend/src/pages/mobile/**`。
- 蜂群结论：
  - `architecture-integration`：优先把当前巨大工作树拆成可审计批次，防止若依整合、租户、安全、前端 API wrapper、工作流修复互相掩盖。
  - `risk-security`：系统 JWT 与供应商门户边界已有真实 filter chain 测试，下一步不要继续扩供应商功能，先补访问审计/token 生命周期设计。
  - `delivery-minimal-change`：先做提交/验收切片，不继续混入新功能；`.DS_Store` 需单独仓库卫生提交，避免污染业务 diff。
  - `verification-ops`：当前证据足够支持“可进入分批 review”，但不足以支持“100 分完成”；每批必须绑定 targeted test + full smoke 的最小证据。
  - `product-ux`：桌面菜单动态化是正确方向，但会改变导航体验；推荐 A：后端 `/menus/current` 动态优先，静态菜单 fallback，Cmd+K 同步使用同一适配层。
- 下一动作门槛：若要继续写代码，需要确认动态菜单策略；若先做质量收敛，则直接进入“分批 review/提交清单”并只整理边界，不改变功能。
- 验收标准：每批都要有 GitNexus impact/detect、targeted 测试、必要的前端 `tsc/Vitest/build/smoke` 或后端 `mvn test` 证据；最后再做一次全仓 `git diff --check` 与全量回归。

### 首批 review 切片（2026-06-09 14:15）
- 批次 A：后端安全/schema/工作流/供应商门户，可先进入 review。
  - 范围：`JwtAuthenticationFilter`、`SecurityConfig`、`MyBatisPlusConfig`、`VendorPortalController`、`WorkflowDefinitionController`、`SysMenuMapper`、`schema.sql`、`V2_69` 到 `V2_74` 迁移、`application-test.properties` 中测试日志配置、相关 config/controller/service 测试。
  - 明确不纳入：移动端、前端动态 `/menus/current` 消费层、`.DS_Store` 仓库卫生、供应商门户生产会话模型。
  - 当前证据：后端全量 `mvn test` 已通过 `571`；蜂群审计发现的 `AuditSchemaInitializer` 工作流菜单旧 seed P0 已修复；首批 targeted gate `67` 测试已于 14:19 和 14:53 两次通过；全仓 `git diff --check` 通过；GitNexus 总体仍 `critical`，但该批关键符号此前逐项 impact 多为 LOW，剩余风险来自跨批混合工作树。
  - review 关注点：V2_69 forward patch 是否满足真实旧库；公开路径带陈旧 Authorization 的行为是否符合预期；供应商门户轻量 token 是否只作为阶段性方案；若依菜单 seed 的 path/component/perms 与桌面路由是否一致。
- 批次 B：前端桌面/typecheck/workflow/NotificationBell，下一批 review。
  - 范围：`WorkflowCenterPage`、`WorkflowDesignerPage`、`browser-regression-smoke.spec.ts`、`NotificationBell`、`routePermissions`、`AuthContext` re-export、API wrapper 类型与测试、非移动端页面类型收敛。
  - 当前证据：`npx tsc --noEmit` 通过；前端全量 `856` 测试通过；`npm run build` 通过；浏览器 smoke `11/11` 通过；桌面 targeted gate `tsc + 29` 个 Vitest 文件/`52` 测试 + Playwright 子集 `5/5` 通过。
  - 明确不纳入：`frontend/src/pages/mobile/**` 历史脏变更、动态菜单生产适配层。
  - 非阻断 P2：`WorkflowDesignerPage` 错误 toast 关闭按钮当前清 `saveMsg` 而非 `saveErr`；修复设计已明确，但按 brainstorming gate 需确认后再动。
- 批次 C：仓库卫生/提交组织，需单独处理。
  - 范围：`.gitignore` 的 `frontend/.next/`、`.DS_Store` 索引移除、`goon.md` 是否纳入仓库、文档与计划整理。
  - 门槛：`.DS_Store` 需要用户确认后才能 `git rm --cached`，避免擅自改变 tracked 文件状态。

### 分批 review allowlist（2026-06-09 14:30）
- 批次 A allowlist：后端安全/schema/工作流/供应商门户。
  - `backend/src/main/java/com/ams/config/AuditSchemaInitializer.java`
  - `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`
  - `backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`
  - `backend/src/main/java/com/ams/config/SecurityConfig.java`
  - `backend/src/main/java/com/ams/controller/VendorPortalController.java`
  - `backend/src/main/java/com/ams/controller/WorkflowDefinitionController.java`
  - `backend/src/main/java/com/ams/mapper/SysMenuMapper.java`
  - `backend/src/main/resources/schema.sql`
  - `backend/src/main/resources/migration/V2_69__asset_detail_support_tables.sql`
  - `backend/src/main/resources/migration/V2_70__canonical_default_tenant_id.sql`
  - `backend/src/main/resources/migration/V2_71__abc_permissions.sql`
  - `backend/src/main/resources/migration/V2_72__sys_tenant_id_width.sql`
  - `backend/src/main/resources/migration/V2_73__workflow_menu_alignment.sql`
  - `backend/src/main/resources/migration/V2_74__desktop_menu_route_metadata.sql`
  - `backend/src/test/java/com/ams/config/JwtAuthenticationFilterTest.java`
  - `backend/src/test/java/com/ams/config/MigrationFileNamingTest.java`
  - `backend/src/test/java/com/ams/config/MyBatisPlusConfigTest.java`
  - `backend/src/test/java/com/ams/config/PermissionSeedSchemaTest.java`
  - `backend/src/test/java/com/ams/config/SecurityConfigTest.java`
  - `backend/src/test/java/com/ams/config/SecurityFilterChainBehaviorTest.java`
  - `backend/src/test/java/com/ams/config/TenantSchemaConsistencyTest.java`
  - `backend/src/test/java/com/ams/controller/VendorPortalControllerTest.java`
  - `backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java`
  - `backend/src/test/java/com/ams/service/WorkflowDefinitionServiceTest.java`
  - `backend/src/test/resources/application-test.properties`
  - 验证命令：`cd backend && mvn test -Dtest=JwtAuthenticationFilterTest,SecurityFilterChainBehaviorTest,SecurityConfigTest,VendorPortalControllerTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,PermissionSeedSchemaTest,TenantSchemaConsistencyTest,MyBatisPlusConfigTest,MigrationFileNamingTest -DfailIfNoTests=false`；最终闸：`cd backend && mvn test`。
- 批次 B allowlist：前端桌面/typecheck/workflow/通知/API wrapper。
  - `frontend/src/pages/workflow/WorkflowCenterPage.tsx`
  - `frontend/src/pages/workflow/WorkflowDesignerPage.tsx`
  - `frontend/src/e2e/browser-regression-smoke.spec.ts`
  - `frontend/src/components/NotificationBell.tsx`
  - `frontend/src/components/NotificationBell.test.tsx`
  - `frontend/src/utils/routePermissions.ts`
  - `frontend/src/utils/routePermissions.test.ts`
  - `frontend/src/context/AuthContext.tsx`
  - `frontend/src/contexts/AuthContext.tsx`
  - `frontend/src/app/context/AuthContext.tsx`
  - `frontend/src/__tests__/noLegacyAppImports.test.ts`
  - `frontend/src/api/tenant.ts`
  - `frontend/src/api/notification.ts`
  - `frontend/src/api/workorder.ts`
  - `frontend/src/types/assignment.ts`
  - `frontend/src/pages/workorder/WorkOrderDetailPage.tsx`
  - `frontend/src/pages/workorder/WorkOrderFormPage.tsx`
  - 还需用 `git ls-files --others --exclude-standard frontend/src/api/__tests__/*.test.ts` 显式纳入新增 API wrapper 测试；不要用目录级 add，避免带入移动端。
  - B 批提交前需先处理或明确豁免的 P1：`frontend/src/utils/routePermissions.ts` 中 `/settings/webhook` 当前使用 `system:config`，与后端/seed 的 `system:config:query` 不一致；推荐改为 `['system:config:query', 'system:config:edit']` 并补 routePermissions 测试，但行为修改需先走 brainstorming 审批。
  - 验证命令：`cd frontend && npx tsc -p tsconfig.json --noEmit --pretty false`；`cd frontend && npx vitest run src/utils/routePermissions.test.ts src/components/NotificationBell.test.tsx src/api/__tests__/*.test.ts --reporter=dot`；`cd frontend && npx playwright test --project=browser-regression-smoke --grep "workflows|模块验收 smoke|approvals|reports" --reporter=line`；最终闸保留全量 `npm test -- --run --reporter=dot` 与 `npm run build`。
- 批次 C allowlist：仓库卫生/交接。
  - `.gitignore`
  - `goon.md`
  - `.DS_Store` 只在用户确认后处理：建议单独执行 `git rm --cached .DS_Store`，并确认 `.gitignore` 已覆盖 `.DS_Store`。
- 严禁混入：
  - `frontend/src/pages/mobile/**`
  - `frontend/.next/**`
  - `.DS_Store`，除非正在执行已确认的仓库卫生批次。

### 剩余未归属变更审计（2026-06-09 14:34）
- 从当前工作树剔除批次 A/B/C allowlist、移动端冻结目录、`.DS_Store` 后，仍有 `212` 个非移动端文件未归属：后端 `91`、前端 `117`、文档 `1`、基础设施 `3`。这些不能混入 A/B/C，需要继续拆 D/E/F 批次。
- 批次 D：后端业务流程与测试恢复。
  - 范围特征：`backend/src/test/java-excluded/** -> backend/src/test/java/**` 的控制器测试恢复；`AssetController` 导入、`Stocktaking*`、`ApprovalService`、`NotificationEventListener`、`ABCClassification*`、`TenantContext`、`AssetService`、`InventoryService`、`SlaService`、`WorkOrder*` 等业务链路修复和测试增强。
  - 代表文件：`backend/src/main/java/com/ams/controller/AssetController.java`、`backend/src/main/java/com/ams/service/StocktakingService.java`、`backend/src/main/java/com/ams/service/ApprovalService.java`、`backend/src/test/java/com/ams/controller/AssetControllerTest.java`、`backend/src/test/java/com/ams/service/StocktakingServiceTest.java`、`backend/src/test/java/com/ams/event/NotificationEventListenerTest.java`。
  - 验证证据：当前 `cd backend && mvn test` 已通过 `571`；D 批次 targeted gate 于 14:31 与 14:48 两次通过，均为 `82` 个测试：`AssetControllerTest,StocktakingServiceTest,StocktakingCycleControllerTest,StocktakingPermissionControllerTest,ApprovalServiceTest,NotificationEventListenerTest,ABCClassificationServiceTest,ABCClassificationControllerTest`。
  - 非阻断 P1：资产导出 CSV 已做字段转义，导入 CSV 仍简单按逗号切分；后续若批准行为修复，应补“导出含逗号字段再导入”的 roundtrip 测试。
- 批次 E：前端非移动端 API/页面/组件类型收敛与旧入口清理。
  - 范围特征：`frontend/src/api/**` wrapper 与测试、桌面页面类型修复、旧 `AssetImportExport` 未路由组件删除、评论/折旧/故障码/工单表单 mapper 组件测试、全局鉴权和路由兼容。
  - 代表文件：`frontend/src/api/asset.ts`、`frontend/src/api/assetImport.ts`、`frontend/src/api/reports.ts`、`frontend/src/pages/AssetImportExport/AssetImportExportPage.tsx`、删除的 `frontend/src/pages/AssetImportExport/ImportTab.tsx` 等旧组件、`frontend/src/pages/workorder/workOrderFormMapper.ts`、`frontend/src/components/fault-code/FaultCodeSelector.tsx`。
  - 验证证据：当前 `npx tsc` 通过；E 批次 targeted Vitest 已两轮通过，最新为 `36` 个文件、`93` 个测试通过，并包含 legacy app 边界测试；`npm run build` 通过；前端全量 `856` Vitest、浏览器 smoke `11/11` 也已通过。拆批 review 时仍应保留 `npx tsc -p tsconfig.json --noEmit --pretty false`、相关 `vitest` targeted、最终全量 `npm test -- --run --reporter=dot` 与 `npm run build`。
  - 非阻断 P1：`AssetAttachmentUpload` 附件图片预览直接拼 env base URL，未配置时会变成 `undefined/...`；后续应统一到附件 URL helper。
  - 禁止混入：`frontend/src/pages/mobile/**` 当前仍冻结，即使这些文件在 `git status` 中有修改/新增，也不属于 E 批次。
- 批次 F：基础设施/文档/运行配置。
  - 范围特征：`Dockerfile`、`backend/pom.xml`、`backend/src/main/resources/application.properties`、`backend/src/main/resources/application-dev.properties`、`AGENTS.md`、`CLAUDE.md`、`docs/TEST_RECOVERY_PLAN.md`。
  - 已处理：`Dockerfile` 前端构建阶段不再遗漏 devDependencies，运行镜像补 `curl`，healthcheck 对齐公开接口 `/api/health`；`TEST_RECOVERY_PLAN.md` 已更新到 2026-06-09 最新测试恢复和验证证据。
  - 风险点：这些文件跨环境影响大，需单独 review；尤其 `application.properties` 中 Flyway 默认关闭、CORS/JWT/默认租户配置必须与部署策略一起确认。`application-dev.properties` 的 mock SSO secret 仅适合本地 profile，不得作为生产默认。Dockerfile 当前仍未证明“根路径 `/` 打开 SPA、`/api/**` 打后端 API”的单容器体验成立，因为后端 servlet context-path 为 `/api`；推荐把根 Dockerfile 定位为构建产物验证/过渡镜像，而非最终生产运行拓扑。
  - 当前验证：`git diff --check` 与行尾空白检查通过；`npm run build` 与 `mvn package -DskipTests` 通过，证明 Dockerfile 前后端构建阶段的核心命令在本机成立；`application.yml` YAML 解析通过；本地同进程 smoke 证明 `/api/health` 可探活，但 `/` 与 `/workflows` 仍无法打开桌面 SPA；本机无 `docker` 命令，Docker 镜像构建未实际跑过。
  - 验证建议：在具备 Docker 的环境执行 `docker build -t forthams:local .`，再用容器 smoke 分别访问 `/`、`/workflows`、`/api/health` 与一个真实 `/api/**` 接口；后端全量 `mvn test`、前端全量 gates、必要时本地真实后端 smoke；配置类变更 review 时重点看生产/开发/test profile 分离。

### 下一步非移动端优先队列
1. P0：先处理 review/提交边界，不继续混入大功能。当前 index 已 staged `31` 个 D 批 controller 测试 rename；如果先验 A 批，必须先确认是否重组 index。禁止目录级 add，避免把移动端冻结项、`.DS_Store` 或跨批文件带入。
2. P0：按顺序验收 A -> D -> B -> E -> F -> C。A 后端安全/schema/工作流/供应商门户已有两轮 targeted gate 和后端全量证据，可先进入 review；D 因 staged 内容已存在，应紧随其后单独验收。
3. P1：桌面 `/menus/current` 接入方案采用“后端驱动导航/搜索入口，不做动态路由注册”。`router/index.tsx` 继续作为路由权威；新增菜单适配层供 `AppLayout` 和 `GlobalSearch` 共享；失败、空菜单、未知路径均回退静态菜单。该项会改变桌面交互，已触发 brainstorming gate，实施前需用户确认。
4. P1：生产部署拓扑推荐“前后端分离/网关代理”。保持后端 `server.servlet.context-path=/api`，前端 Nginx/CDN/网关提供根路径 SPA fallback 并反代 `/api/`。不推荐继续把根 `Dockerfile` 当作最终单容器生产形态，除非明确批准大改 context-path、安全链和 SPA fallback。
5. P1：供应商门户生产化：正式 vendor session、token 吊销/过期处理、合同接口审计，以及是否将 vendor/contract 纳入租户模型的决策。
6. P1：仓库卫生与提交切片：`.DS_Store` 需用户确认后单独从 Git 索引移除；`goon.md`、AGENTS/CLAUDE、Dockerfile/docs/config 不应混在同一个业务提交。
7. P1：继续归档 `frontend/src/app/**` 非移动端未引用旧体系，保持移动端冻结例外。
8. P2：继续压缩 Spring Boot slice 测试启动日志，或将长日志测试迁移为更轻的 slice/unit 测试以提升 CI 反馈速度。

## 2026-06-09 09:10 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续按“全量推进到 100 分”的目标执行，移动端继续冻结未推进。重点完成若依整合后的租户底座、流程保存权限、当前套餐可见性、旧桌面组件隔离和全量质量闸。

### 本轮已完成
- `/workflows` 新建流程保存链路：
  - `backend/src/main/java/com/ams/controller/WorkflowDefinitionController.java`：流程定义写接口从 `ADMIN/SUPER_ADMIN` 角色判断改为若依权限 `@ss.hasPermi('workflow:definition:edit')`，查询继续使用 `workflow:definition:query`。
  - `backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java`：新增反射测试锁定查询/编辑权限表达式。
  - `frontend/src/pages/workflow/WorkflowDesignerPage.tsx`：后端保存失败时不再显示成功式“已保存本地草稿”，改为明确提示“仅保存为本地草稿，后端未同步”。
  - `frontend/src/e2e/browser-regression-smoke.spec.ts`：新增 `/workflows` 草稿保存失败 smoke，锁定失败不跳转、不误报成功。
- 租户/套餐底座：
  - `backend/src/main/resources/schema.sql`：补齐 `sys_tenant` 建表，并幂等 seed `dept:1 / ENTERPRISE / ACTIVE`，避免 Flyway 关闭时新库缺租户表。
  - 新增 `backend/src/main/resources/migration/V2_72__sys_tenant_id_width.sql`：将 `sys_tenant.id` 扩到 `VARCHAR(64)`。
  - `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`：JWT token tenant 必须等于加载后的 `LoginUser.tenantId`，否则 403，防止伪造跨租户 token。
  - `backend/src/main/java/com/ams/service/TenantService.java`、`backend/src/main/java/com/ams/controller/TenantController.java`：新增当前租户读取链路 `GET /tenants/current`。
  - `frontend/src/api/tenant.ts`、`frontend/src/pages/profile/UserProfilePage.tsx`：个人信息页展示“当前套餐”。
- 迁移与 schema 质量闸：
  - `backend/src/main/resources/migration/V2_67__abc_permissions.sql` 改名为 `V2_71__abc_permissions.sql`，修复与既有 `V2_67__phase6_business_comment_likes.sql` 的 Flyway 版本冲突。
  - 新增/更新 `MigrationFileNamingTest`、`TenantSchemaConsistencyTest`、`PermissionSeedSchemaTest`，锁定迁移版本唯一、默认租户 seed、ABC 权限迁移存在。
  - `backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`：修复 `ignoreInsert` 逻辑，仅在 insert 列显式包含 `tenant_id` 时跳过自动注入；避免有 TenantContext 但插入列缺 tenant 时漏写 tenant。
- 通知与旧组件清理：
  - `frontend/src/components/NotificationBell.tsx` 从旧 `@/app/services/notificationApi` 迁移到权威 `@/api/notification`。
  - 新增 `frontend/src/components/NotificationBell.test.tsx`。
  - 删除未路由且含旧合同的 `frontend/src/pages/AssetImportExport/ImportTab.tsx`、`ExportTab.tsx`、`DragUploadArea.tsx`、`ExportFilterForm.tsx`，保留当前路由唯一入口 `AssetImportExportPage.tsx + @/api/assetImport`。
- Legacy app 边界：
  - 新增 `frontend/src/__tests__/noLegacyAppImports.test.ts`，锁定非 `src/app/**`、非移动端代码不得再 import `@/app/*`。
  - 新增 `frontend/src/app/README.md`，明确 `src/app` 仅作为 legacy compatibility tree，移动端冻结期间保留 `@/app/context/AuthContext` 兼容例外。

### 本轮验证结果
- GitNexus impact：本轮涉及符号均因索引数据库版本不匹配失败，风险 UNKNOWN；已用单测、全量测试、构建、mock 浏览器 smoke、真实后端 smoke 兜底。
- 后端全量测试：`mvn test` 通过，`531` 个测试通过，0 failure/error/skip。
- 前端全量测试：`npm test -- --run --reporter=dot` 通过，`81` 个测试文件、`849` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- 浏览器回归 smoke：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke --reporter=line` 通过，`11/11`。
- 真实后端 smoke：`npx playwright test src/e2e/real-backend-smoke.spec.ts --project=real-backend-smoke --reporter=line` 通过，`8/8`。
- 服务健康：`GET http://localhost:8080/api/system/health` 返回 200；`GET http://127.0.0.1:5173/workflows` 返回 200。

### 当前发现的剩余风险
- GitNexus 本地索引不可用：数据库文件版本 41，但当前 build storage version 40；继续严格图谱影响分析前需重建或升级索引。
- Flyway 仍默认关闭，当前通过 `schema.sql` 补齐新库底座；生产/测试环境若依赖手动迁移，需要明确迁移执行责任和顺序。
- `frontend/src/app/**` 旧体系仍存在，但已由测试锁定非 app/mobile 桌面代码不得引入 `@/app`；下一轮可在不碰移动端的前提下继续归档或拆除未引用代码。
- 历史租户样例中仍可见 `T001/default/1`，本轮已锁住主线 `dept:1`，后续继续清测试数据和非主线样例。
- 后端负向测试仍输出预期异常栈，测试结果不受影响，但 CI 日志可读性还有优化空间。

### 下一步非移动端优先队列
1. P1：继续清理/归档 `frontend/src/app/**` 未引用旧体系；保持 `@/app/context/AuthContext` 移动端兼容例外。
2. P1：继续收敛历史 `T001/default/1` 测试样例和旧种子数据，避免新同学误判租户口径。
3. P1：明确部署数据库策略：若继续 Flyway 关闭，则将所有必要迁移同步到 `schema.sql`；若恢复 Flyway，则整理 `migration/` 与 `db/migration/` 的单一路径。
4. P2：降低后端负向测试异常栈噪声，提升 CI 可读性。

## 2026-06-09 08:49 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：租户口径、OAuth2 登录租户、ABC 分类事务时序、前端鉴权上下文收敛。移动端继续冻结未推进。

### 本轮已完成
- OAuth2/若依租户对齐：
  - `backend/src/main/java/com/ams/controller/OAuth2Controller.java`：OAuth2 回调不再签发硬编码 `default` tenant，改为基于用户 `deptId` 签发 `dept:{deptId}`；缺少部门时跳回登录页并带 `oauth_tenant_missing`。
  - `backend/src/test/java/com/ams/controller/OAuth2ControllerTest.java`：新增 OAuth2 token tenant 为 `dept:42`、缺少部门不签发 token 的覆盖。
- 默认租户口径收敛：
  - 新增 `backend/src/main/resources/migration/V2_70__canonical_default_tenant_id.sql`，将 `sys_tenant.default`/`approval_record.T001` 收敛到 `dept:1`。
  - `backend/src/main/resources/application.properties`：默认租户从 `1` 改为 `dept:1`。
  - `backend/src/main/resources/schema.sql`：`approval_record.tenant_id` 默认值从 `T001` 改为 `dept:1`。
  - 更新 `TenantServiceTest`、`AssetBorrowServiceTest`、`StocktakingServiceTest` 等后端测试样例租户口径。
- ABC 分类事务时序修复：
  - `backend/src/main/java/com/ams/service/AssetService.java`：资产创建/更新后不再在未提交事务中直接触发 `REQUIRES_NEW` 分类，改为事务同步 `afterCommit` 后执行；无事务上下文时保持立即执行。
  - `backend/src/test/java/com/ams/service/AssetServiceTest.java`：新增 after-commit 调度与无事务立即分类覆盖。
- 前端鉴权上下文收敛：
  - 新增权威 `frontend/src/context/AuthContext.tsx`，统一使用 `@/utils/http`、`@/utils/auth` 和真实 `/user-management/current` 修复角色/权限。
  - `frontend/src/app/context/AuthContext.tsx`、`frontend/src/contexts/AuthContext.tsx` 改为兼容 re-export。
  - 桌面入口、路由、布局、个人中心、评论、闲置资产等非移动端引用迁移到 `@/context/AuthContext`。
  - `frontend/src/utils/auth.ts` 补齐 SSR/window guard。
- 已核验但未改：
  - `frontend/src/api/system.ts` 的 `/users/current` 可用，因为后端 `UserManagementController` 同时映射 `/user-management` 与 `/users`，当前不作为 bug 处理。

### 本轮验证结果
- GitNexus impact：本轮涉及符号均因索引数据库版本不匹配失败，风险 UNKNOWN；已用单测、真实后端 smoke、浏览器 smoke、全量构建/测试兜底。
- 后端目标回归：`mvn test -Dtest=TenantServiceTest,OAuth2ControllerTest,AssetBorrowServiceTest,StocktakingServiceTest` 通过。
- 后端目标回归：`mvn test -Dtest=AssetServiceTest,ABCClassificationServiceTest` 通过。
- 后端综合回归：`mvn test -Dtest=AssetServiceTest,AssetControllerTest,ABCClassificationServiceTest,ABCClassificationControllerTest,TenantServiceTest,ApprovalServiceTest,OAuth2ControllerTest,AssetBorrowServiceTest,StocktakingServiceTest` 通过，`75` 个测试通过。
- 前端定向测试：`npm test -- --run src/__tests__/CommentSection.test.tsx src/api/__tests__/notification.test.ts --reporter=dot` 通过，`11` 个测试通过。
- 前端全量测试：`npm test -- --run` 通过，`79` 个测试文件、`846` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- 真实后端 smoke：`npx playwright test --project=real-backend-smoke --reporter=line` 通过，`8/8`。
- 后端全量测试：`mvn test` 通过，`525` 个测试通过，0 failure/error/skip。

### 当前发现的剩余风险
- GitNexus 本地索引不可用：数据库文件版本 41，但当前 build storage version 40；继续严格图谱影响分析前需重建或升级索引。
- Flyway 当前配置默认关闭，`migration/` 新脚本是否会进入目标环境取决于部署链路；需要确认生产/测试库迁移机制，必要时同步到实际执行脚本。
- 租户 ID 已收敛主线默认值，但历史测试/旧数据仍可见 `T001` 样例；下一轮应继续缩小 `T001/default/1` 的非兼容使用面。
- `frontend/src/app/**` 已从鉴权上下文层面隔离，但目录仍保留旧体系；需继续判断主路由是否还有误引用风险，再做隔离/下线。
- 后端负向测试仍输出预期异常栈，CI 可读性噪声尚未处理。

### 下一步非移动端优先队列
1. P1：确认 Flyway/迁移执行链路，避免 `V2_70` 只停留在源码不进入真实库。
2. P1：继续清理 `frontend/src/app/**` 与裸 `fetch`/旧 Result 兼容残留，但保持移动端冻结。
3. P1：继续收敛后端 `T001/default/1` 历史租户口径，优先改真实业务默认和测试数据，不做盲目全局替换。
4. P2：降低后端负向测试异常栈噪声，提升 CI 可读性。

## 2026-06-09 08:31 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮完成真实后端环境下的核心闭环修复与全量质量闸，移动端继续冻结未推进。

### 本轮已完成
- 后端真实 smoke 修复：
  - `backend/src/main/java/com/ams/config/SecurityConfig.java`：默认 CORS origin 增加 `http://127.0.0.1:5173`，修复 Vite 本地真实登录被 CORS 拒绝。
  - `backend/src/main/java/com/ams/config/MyBatisPlusConfig.java`：补齐 `OptimisticLockerInnerInterceptor`，修复 `ApprovalProcess @Version` 更新时缺少 `MP_OPTLOCK_VERSION_ORIGINAL` 导致工单审批 500。
  - `backend/src/main/java/com/ams/service/ApprovalService.java`：审批列表过滤、关键字搜索和流程类型统计从旧 `business_type` 切到主列 `process_type`。
  - `backend/src/main/java/com/ams/service/InAppChannel.java`：站内信通道对已持久化通知幂等跳过，修复退役申请后通知二次插入同一主键导致事务回滚。
  - `backend/src/main/java/com/ams/service/impl/ABCClassificationServiceImpl.java`：ABC 自动分类独立事务兜底，避免资产创建主流程被分类辅助逻辑回滚。
- 后端 schema 补齐：
  - 新增 `backend/src/main/resources/migration/V2_69__asset_detail_support_tables.sql`，补齐资产详情真实接口依赖的父子关系、TCO、附件租户列、历史租户列、保险、领用、借用、巡检、入库等表/列。
  - `backend/src/main/resources/schema.sql` 同步上述结构，并补齐 `cycle_count_rule`。
- 前端真实 smoke 对齐：
  - `frontend/src/e2e/real-backend-smoke.spec.ts`：登录选择器、页面 heading、工作流/盘点/审批断言对齐当前桌面 UI。
  - `frontend/src/pages/auth/hooks/useLoginForm.ts`：登录后保存 roles/permissions 到 `user_info`，让若依权限整合后的前端权限判断可用。
  - `frontend/src/pages/asset/AssetListPage.tsx`：资产台账增加常驻搜索框并复用现有 keyword 状态。
  - `frontend/src/pages/asset/AssetDetailPage.tsx`：父资产为空时返回 `null`，避免 React Query 收到 `undefined`。

### 本轮新增/更新测试
- `backend/src/test/java/com/ams/config/SecurityConfigTest.java`
- `backend/src/test/java/com/ams/config/MyBatisPlusConfigTest.java`
- `backend/src/test/java/com/ams/service/ABCClassificationServiceTest.java`
- `backend/src/test/java/com/ams/service/ApprovalServiceTest.java`
- `backend/src/test/java/com/ams/service/NotificationServiceTest.java`
- `frontend/src/e2e/real-backend-smoke.spec.ts`

### 本轮验证结果
- GitNexus impact：本轮涉及符号均因索引数据库版本不匹配失败，风险 UNKNOWN；已用单测、真实后端 smoke、浏览器 smoke、全量构建/测试兜底。
- 真实后端 smoke：`npx playwright test --project=real-backend-smoke --reporter=line` 通过，`8/8`。
- 浏览器回归 smoke：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --reporter=line` 通过，`10/10`。
- 前端全量测试：`npm test -- --run` 通过，`79` 个测试文件、`846` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- 后端目标回归：`mvn test -Dtest=MyBatisPlusConfigTest,SecurityConfigTest,NotificationServiceTest,ApprovalServiceTest,RetirementApplicationServiceTest,WorkOrderServiceTest,ABCClassificationServiceTest,AssetServiceTest` 通过。
- 后端全量测试：`mvn test` 通过，`521` 个测试通过，0 failure/error/skip。

### 当前发现的剩余风险
- GitNexus 本地索引不可用：数据库文件版本 41，但当前 build storage version 40；后续若要继续严格图谱影响分析，需要先重建或升级 GitNexus 索引。
- `ABCClassificationServiceImpl.classifyAsset` 用 `REQUIRES_NEW` 避免辅助分类回滚资产创建，但新事务看不到未提交的新资产，当前会记录“资产不存在”警告；建议后续改成 after-commit 分类事件。
- `V2_69` 为兼容本地真实 smoke 给部分新增 `tenant_id` 列使用默认 `dept:1`；长期多租户语义仍需统一 `TenantContext` 写入策略。
- 租户 ID 口径仍混用 `dept:{deptId}`、`T001`、`default`、数字 `1`；真实 smoke 目前使用 `dept:1` 主线通过。
- 移动端文件存在历史变更，但本阶段不继续开发、不纳入质量目标。

### 下一步非移动端优先队列
1. P1：租户 ID 口径统一。先形成 `dept:{deptId}` vs `T001` 的迁移策略，再改实体写入、测试 profile、种子数据和真实 smoke。
2. P1：把 ABC 分类从同步/新事务调整为 after-commit 事件或事务同步，消除“创建成功但分类查不到未提交资产”的日志噪声。
3. P1：继续清理或隔离 `frontend/src/app/**` 与未路由旧组件，避免旧 `/api/v1`、旧 Result 包装合同被再次引用。
4. P2：后端负向测试仍会输出预期异常栈，建议改成更安静的断言/日志级别，降低 CI 可读性噪声。

## 2026-06-09 07:56 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：收敛可复用桌面组件中的旧直连 API 残留，避免若依整合后的鉴权、租户、Result 解包绕开统一 `http`。

### 本轮已完成
- `frontend/src/components/ExportPanel/FormatSelector.tsx`：
  - 默认导出路径从裸 `fetch('/api/v1/assets/export')` 改为复用 `@/api/assetImport.exportAssets`。
  - 下载动作复用 `@/utils/fileDownloader.downloadBlob`。
  - 当没有外部 `onExport` 且用户选择 `xlsx` 时，明确提示当前后端仅支持 CSV，避免伪装成可用 Excel 合同。
- `frontend/src/components/inventory/TaskList.tsx`：
  - 任务列表从裸 `fetch('/api/v1/inventory/tasks')` 改为统一 `http.get('/inventory/tasks')`。
  - 搜索参数修正为后端真实参数 `search`。
  - 增加后端 `InventoryTask` 实体到组件展示模型的兼容映射：`id/taskNo/totalCount/scannedCount/createTime` → `taskId/progress/createdAt` 等字段。
- `frontend/src/components/depreciation/DepreciationCard.tsx`：
  - 折旧查询从不存在的 `/api/v1/assets/{id}/depreciation` 改为当前后端真实的 `/depreciation/comparison/{assetId}`。
  - 按前端选择的 `straight_line/double_declining` 映射后端 `STRAIGHT_LINE/DOUBLE_DECLINING`，并转换月折旧、累计折旧、净值、折旧率等展示字段。
  - 兼容 Axios `CanceledError`，避免卸载/刷新时误展示错误。
- 新增 `frontend/src/components/depreciation/DepreciationCard.test.tsx`：
  - 锁定折旧对比响应转换逻辑。
  - 锁定请求路径、月份参数和统一 `http` 客户端。

### 本轮验证结果
- GitNexus impact：`FormatSelector/TaskList/DepreciationCard` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用构建、单测、浏览器 smoke 兜底。
- 目标文件扫描：`rg "\bfetch\(|/api/v1" frontend/src/components/ExportPanel/FormatSelector.tsx frontend/src/components/inventory/TaskList.tsx frontend/src/components/depreciation/DepreciationCard.tsx ...` 无命中。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- 前端定向测试：`npm test -- --run src/components/depreciation/DepreciationCard.test.tsx src/api/__tests__/assetImport.test.ts src/api/__tests__/inventory.test.ts` 通过，`3` 个测试文件、`6` 个测试通过。
- 前端全量测试：`npm test -- --run` 通过，`79` 个测试文件、`846` 个测试通过。
- Playwright 浏览器回归：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke` 通过，`10/10`。
- GitNexus detect changes：`scope=all` 返回 low，changed files 171，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 当前发现的剩余风险
- 真实后端 8080 当前未作为浏览器 E2E 目标启动，`/workflows`、资产导入导出、折旧/库存组件仍缺少真实数据库 E2E 证据。
- `frontend/src/pages/AssetImportExport/ImportTab.tsx`、`ExportTab.tsx`、`DragUploadArea.tsx` 等未路由旧组件仍有历史合同残留；当前桌面主路由不引用，但建议继续隔离或删除，避免误引用。
- `frontend/src/app/**` 旧应用目录仍存在若干 `/api/...` 前缀和旧合同写法；需要单独判断是否保留、迁移或下线。
- 移动端本阶段继续冻结，不纳入本轮修复范围。

### 下一步非移动端优先队列
1. P1：准备真实后端可启动环境，跑 `real-backend-smoke`：登录、`/workflows` 新建保存、资产导入导出 CSV、全局通知未读数。
2. P1：继续清理或隔离未路由旧组件，重点是 AssetImportExport 旧 tab/drag 组件与 `src/app/**` 旧体系。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 07:45 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：补齐 `/workflows` 浏览器回归证据，并修正 Playwright smoke 中若干已过时的 UI 断言。

### 本轮已完成
- `frontend/src/e2e/browser-regression-smoke.spec.ts`：
  - 新增 `/workflows 新建模板流程会保存草稿并进入设计器` 用例。
  - Mock `GET /workflows`、`PUT /workflows/ASSET_TRANSFER/draft`、`GET /workflows/ASSET_TRANSFER`、`GET /roles/all`、`GET /users/search`。
  - 断言“新建流程 -> 资产转移流程”会触发一次草稿保存，并跳转 `/workflow-designer?businessType=ASSET_TRANSFER`。
  - 同步修正库存、资产、审批、报表 smoke 中已过时的 heading/placeholder/tab/按钮文案断言，让浏览器回归重新对齐当前桌面 UI。

### 本轮验证结果
- 5173 前端服务：`curl -I http://localhost:5173/workflows` 返回 200。
- 8080 后端服务：当前未响应，真实后端 Playwright smoke 暂不能作为证据；后端能力继续以 MockMvc/单元/全量 Maven 测试兜底。
- Playwright workflow 定向：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke -g "/workflows"` 通过，`1/1`。
- Playwright 浏览器回归：`npx playwright test src/e2e/browser-regression-smoke.spec.ts --project=browser-regression-smoke` 通过，`10/10`。
- GitNexus detect changes：`scope=all` 返回 low，changed files 168，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 当前发现的剩余风险
- 真实后端 8080 未启动，无法在本轮直接跑 `real-backend-smoke`；若要覆盖真实 `/workflows` 保存，需要先启动后端依赖数据库/测试 profile，并准备可登录账号或接口登录数据。
- Browser smoke 目前使用 mock API，证明桌面 UI 路由、草稿保存调用和跳转链路，不等同真实数据库持久化证明。

### 下一步非移动端优先队列
1. P1：启动或准备真实后端环境，跑 `real-backend-smoke` 中 `/workflows`、资产导入导出、登录/核心导航闭环。
2. P1：清理或隔离资产导入导出、折旧、库存等未引用旧组件残留，防止后续误引用旧 `/api/v1` 或 `/api/asset/*` 合同。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 07:38 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：全局桌面布局与评论协作组件的若依整合漏点收敛。

### 本轮已完成
- `frontend/src/layouts/AppLayout.tsx`：
  - 未读通知数改为复用 `getUnreadCount()`。
  - 修复共享 `http` 已将 `/notifications/unread-count` 解包为数字后，布局仍读取 `res.data.count/res.count` 导致顶部未读徽标恒为 0 的问题。
- `frontend/src/components/comment/UserMentionAutocomplete.tsx`：
  - @mention 用户搜索改为统一走 `http.get('/users/mentions/search')`。
  - 修复组件手写 `fetch('/api/users/mentions/search')` 且读取旧 `access_token`，与当前 `auth_token` 登录体系不一致的问题。
  - 搜索结果直接消费共享 `http` 解包后的用户数组。
- 新增 `frontend/src/components/comment/UserMentionAutocomplete.test.tsx`：
  - 锁定 @mention 搜索使用统一 `http` 客户端、正确路径和 `keyword` 参数。

### 本轮验证结果
- GitNexus impact：`AppLayout/getUnreadCount/UserMentionAutocomplete/searchUsers` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用组件测试、评论区回归、通知 API 测试、构建和前端全量测试兜底。
- GitNexus detect changes：`scope=all` 返回 low，changed files 167，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。
- 通知定向测试：`npm test -- --run src/api/__tests__/notification.test.ts` 通过，`1` 个测试通过。
- 评论定向测试：`npm test -- --run src/components/comment/UserMentionAutocomplete.test.tsx src/__tests__/CommentSection.test.tsx` 通过，`2` 个测试文件、`11` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 前端全量测试：`npm test -- --run` 通过，`78` 个测试文件、`844` 个测试通过。

### 当前发现的剩余风险
- `frontend/src/components/depreciation/DepreciationCard.tsx`、`frontend/src/components/inventory/TaskList.tsx`、`frontend/src/components/ExportPanel/FormatSelector.tsx` 仍有直接 `fetch('/api/v1/...')` 残留，但当前桌面权威路由未引用；可列为后续旧组件隔离/删除专项。
- `frontend/src/hooks/useAuditLogs.ts` 仍有旧 `response.data` 读取，但当前权威桌面路由未直接引用，主要被 `src/app/**` 旧体系消费；应与旧 app 目录清理一起处理。

### 下一步非移动端优先队列
1. P1：清理或隔离资产导入导出、折旧、库存等未引用旧组件残留，防止后续误引用旧 `/api/v1` 或 `/api/asset/*` 合同。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：补浏览器/真实后端烟测：`/workflows` 新建保存、`/assets/import-export` CSV 模板/解析/导出、全局通知未读数。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 07:33 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：资产导入导出桌面主流程从“有页面无后端合同”推进到可保存/可解析/可导出闭环。

### 本轮已完成
- `backend/src/main/java/com/ams/controller/AssetController.java` 新增桌面资产导入导出端点：
  - `GET /assets/import/template`：返回 CSV 模板文件。
  - `POST /assets/import/parse`：接收 CSV，返回 `parseId/rows/errors` 预览结构；非 CSV 以受控 `Result` 错误返回。
  - `POST /assets/import/commit`：接收预览行并调用 `assetService.createAsset` 批量创建资产，返回导入成功/失败统计。
  - `POST /assets/export`：按资产查询条件导出 CSV 文件流。
- `frontend/src/pages/AssetImportExport/AssetImportExportPage.tsx`：
  - 导出改用 `exportAssets` 文件流接口并触发浏览器下载。
  - 导入限定 CSV，模板文案、文件名、上传 accept 和预览字段统一为 CSV 合同。
  - 预览行改读后端实际返回的 `assetName/categoryId/assetNo/status` 等字段。
- `frontend/src/api/assetImport.ts`：
  - `exportAssets` 将旧筛选数组映射为后端 `AssetQueryDTO` 支持的 `categoryId/status/keyword`。
- `frontend/src/api/__tests__/assetImport.test.ts` 与 `frontend/src/api/__tests__/asset.test.ts` 锁定导入模板、解析、提交、导出路径。
- `backend/src/test/java/com/ams/controller/AssetControllerTest.java` 补齐 CSV 模板、CSV 解析、非 CSV 拒绝、资产导出测试。

### 本轮验证结果
- GitNexus impact：`AssetController/AssetImportExportService/AssetImportExportPage/createAsset/getImportTemplate/parseImportFile` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用定向 controller 测试、API 契约测试、前后端全量测试兜底。
- GitNexus detect changes：`scope=all` 返回 low，changed files 166，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。
- 后端定向测试：`mvn test -Dtest=AssetControllerTest` 通过，`12` 个测试通过。
- 前端定向测试：`npm test -- --run src/api/__tests__/assetImport.test.ts src/api/__tests__/asset.test.ts` 通过，`2` 个测试文件、`2` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 前端全量测试：`npm test -- --run` 通过，`77` 个测试文件、`843` 个测试通过。
- 后端全量测试：`mvn test` 通过，`516` 个测试通过，0 failure/error/skip。

### 当前发现的剩余风险
- 导入导出主流程当前先落地 CSV；若要恢复 XLSX，需要新增 POI/解析策略和端到端文件测试。
- `frontend/src/pages/AssetImportExport/ImportTab.tsx`、`DragUploadArea.tsx`、`ExportTab.tsx`、`ExportFilterForm.tsx` 以及 `frontend/src/components/ExportPanel/FormatSelector.tsx` 仍有旧 `/api/asset/*` 或 `/api/v1/assets/export` 残留，但当前桌面路由未引用，不阻断 `/assets/import-export` 主页面。

### 下一步非移动端优先队列
1. P1：清理或隔离资产导入导出旧组件残留，避免后续误引用把旧 `/api/asset/*` 合同带回主流程。
2. P1：复核 `useAuditLogs/useAssetById/AssetLabelsPage/MaintenancePlanPage/ScopeSelector` 中剩余 `res.data` 是否为外层 Result 漂移还是业务字段。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:43 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：Budget/Revaluation 列表兼容层、Inspection 上传 URL、BigScreen stats 兼容层收敛。

### 本轮已完成
- `frontend/src/api/budget.ts`：
  - `getBudgets` 明确返回 `PageData<Budget>`。
  - `deleteBudget` 明确返回 `void`。
- `BudgetListPage`：
  - 去除 `res?.data` 兼容层，直接消费 `records/total`。
- `frontend/src/api/revaluation.ts`：
  - `getRevaluations` 明确返回 `PageData<AssetRevaluation>`。
  - `deleteRevaluation` 明确返回 `void`。
- `RevaluationListPage`：
  - 去除 `res?.data` 兼容层，直接消费 `records/total`。
- `InspectionFormPage`：
  - `/file/upload` 直接消费共享 http 解包后的字符串 URL，不再读取 `res.data`。
- `BigScreenPage` / `BigScreen3DPage`：
  - `normalizeStats` 去除 `{ data }` 外层 Result 兼容分支，只接收直接 stats，同时保留 fallback 字段填充。
- `BigScreenPage.test.tsx`：
  - mock 从 `{ code, data }` 改为直接业务 stats。

### 本轮新增测试
- `frontend/src/api/__tests__/budget.test.ts`
- `frontend/src/api/__tests__/revaluation.test.ts`

### 本轮验证结果
- GitNexus impact：`getBudgets/getRevaluations/PhotoUpload/normalizeStats` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 契约测试、页面测试、构建和全量前端测试兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/budget.test.ts src/api/__tests__/revaluation.test.ts src/__tests__/BigScreenPage.test.tsx` 通过，`3` 个测试文件、`3` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 前端全量测试：`npm test -- --run` 通过，`75` 个测试文件、`840` 个测试通过。

### 下一步非移动端优先队列
1. P1：复核 `useAuditLogs/useAssetById/AssetLabelsPage/MaintenancePlanPage/ScopeSelector` 中剩余 `res.data` 是否为外层 Result 漂移还是业务字段。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:39 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：报表/统计/退役/处置/资产父子关系 API 解包合同闭环。

### 本轮已完成
- `frontend/src/api/reports.ts` 去除外层 `ApiResponse`：
  - 汇总、分类、趋势、折旧月度、维保月度、退役月度、工单状态分布、部门待处理工单均直接返回业务对象/数组。
- `frontend/src/api/stats.ts`：
  - `getStatsOverview` 直接返回 `StatsOverview`。
- `frontend/src/hooks/useReports.ts`：
  - hooks 内部趋势查询直接返回 `ReportTrend[]`。
- `frontend/src/api/retirement.ts`：
  - 新建/详情/资产历史/审批/驳回直接返回后端业务对象。
  - 修复撤回路由：从不存在的 `/retirement/{id}/withdraw` 改为后端真实支持的 `/retirement/{id}/cancel`。
- `frontend/src/api/disposal.ts`：
  - 赔偿详情/更新、赔偿/报废/清退/调拨审批提交去除外层 `ApiResponse`。
  - 保留退役驱动的处置列表/详情/统计映射逻辑，不机械改业务字段。
- `frontend/src/api/assetParentChild.ts`：
  - 关系列表/新增/删除/树/更新均直接返回业务类型。
- `ReportsPage` / `ReportPage` 清理不再使用的 `ApiResponse` 类型导入。

### 本轮新增/更新测试
- 更新 `frontend/src/api/__tests__/reports.test.ts`，改为模拟共享 http 已解包后的业务对象，并补齐月度统计/工单统计端点。
- 新增：
  - `frontend/src/api/__tests__/stats.test.ts`
  - `frontend/src/api/__tests__/retirement.test.ts`
  - `frontend/src/api/__tests__/disposal.test.ts`
  - `frontend/src/api/__tests__/assetParentChild.test.ts`

### 本轮验证结果
- GitNexus impact：`getReportSummary/getStatsOverview/createRetirement/withdrawRetirement/getCompensationDetail/getRelations` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 契约测试、构建和全量前端测试兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/reports.test.ts src/api/__tests__/stats.test.ts src/api/__tests__/retirement.test.ts src/api/__tests__/disposal.test.ts src/api/__tests__/assetParentChild.test.ts` 通过，`5` 个测试文件、`16` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 前端全量测试：`npm test -- --run` 通过，`73` 个测试文件、`838` 个测试通过。

### 下一步非移动端优先队列
1. P1：清理 `Budget/Revaluation` 列表兼容层、`Inspection` 上传 URL 兼容层、`BigScreen` stats 兼容层。
2. P1：复核 `useAuditLogs/useAssetById/AssetLabelsPage/MaintenancePlanPage/ScopeSelector` 中剩余 `res.data` 是否为外层 Result 漂移还是业务字段。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:33 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：工单新建/编辑保存闭环、工单 API 解包合同、协作人 JSON 持久化。

### 本轮已完成
- `frontend/src/api/workorder.ts` 去除工单 API 外层 `ApiResponse` 类型：
  - 详情/新增/更新/提交/审批/驳回/取消/验收直接返回 `WorkOrder`
  - 删除返回 `void`
  - 挂起/恢复返回 `WorkOrderHoldRecord`
  - 列表继续返回分页对象 `PaginatedResponse<WorkOrderListItem>`
- `frontend/src/types/workorder.types.ts` 扩展 `CreateWorkOrderRequest`，补齐后端 `WorkOrderDTO` 已支持的字段：
  - `assetName/assetCode`
  - `assigneeId/assigneeName`
  - `plannedStartDate/plannedEndDate`
  - `estimatedCost/actualCost`
  - `completionNote/collaborators/attachments`
- 新增 `frontend/src/pages/workorder/workOrderFormMapper.ts`：
  - 桌面表单字段映射为后端 DTO：负责人、资产、计划截止时间、预估费用、协作人、附件、故障码
  - 工单详情回填编辑表单默认值
  - 统一 `date` / `datetime-local` 到后端 `LocalDateTime` 字符串
- `WorkOrderFormPage`：
  - 编辑态通过 `getWorkOrderDetail(id)` 拉取详情并回填表单、资产、协作人、附件、故障码
  - 提交时不再直接散布表单字段，而是通过 mapper 生成后端 DTO
  - 文件上传直接消费已解包后的字符串 URL
- `backend/src/main/java/com/ams/entity/WorkOrder.java`：
  - `@TableName(value = "work_order", autoResultMap = true)`
  - `collaborators` 从 `exist = false` 改为 `JacksonTypeHandler` JSON 字段，与迁移中的 `work_order.collaborators` 和 DTO 对齐

### 本轮新增测试
- `frontend/src/api/__tests__/workorder.test.ts`
- `frontend/src/pages/workorder/workOrderFormMapper.test.ts`

### 本轮验证结果
- GitNexus impact：`WorkOrder` 因索引数据库版本不匹配失败，风险 UNKNOWN；已用代码审计、后端合同审计、前后端测试兜底。
- 前端工单定向测试：`npm test -- --run src/api/__tests__/workorder.test.ts src/pages/workorder/workOrderFormMapper.test.ts src/pages/workorder/WorkOrderAcceptancePage.test.tsx` 通过，`3` 个测试文件、`6` 个测试通过。
- 前端全量测试：`npm test -- --run` 通过，`69` 个测试文件、`832` 个测试通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 后端工单/Schema 定向测试：`mvn test -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,SchemaCoverageTest` 通过，`15` 个测试通过。
- 后端全量测试：`mvn test` 通过，`503` 个测试通过，0 failure/error/skip。

### 下一步非移动端优先队列
1. P1：继续收敛 `reports/stats/retirement/disposal/assetParentChild` API 合同，区分业务 `data` 字段与外层 Result。
2. P1：清理 `Budget/Revaluation` 列表兼容层、`Inspection` 上传 URL 兼容层、`BigScreen` stats 兼容层。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:22 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：桌面 HTTP 解包合同继续收敛，覆盖领用/借用/入库、通知/搜索、工单执行组件、资产主 API。

### 本轮已完成
- `frontend/src/api/assignment.ts` 统一领用归还 API 返回类型：
  - 列表继续返回 `PaginatedResponse<AssetAssignment>`
  - 详情/新增/更新/提交/审批/驳回/签收/归还申请/归还审批/取消直接返回 `AssetAssignment`
  - 删除返回 `void`
- `AssignmentFormPage` / `AssignmentDetailPage` 不再读取 `detailRes.data || detailRes`，资产下拉直接消费分页 `records`。
- `frontend/src/api/borrow.ts` 统一借用 API 返回类型：
  - 列表继续返回 `PaginatedResponse<AssetBorrow>`
  - 详情/新增/更新/提交/审批/驳回/借出/归还/取消直接返回 `AssetBorrow`
  - 删除返回 `void`
- `BorrowFormPage` / `BorrowDetailPage` 不再读取 `detailRes.data || detailRes`，资产下拉直接消费分页 `records`。
- `frontend/src/api/intake.ts` 统一入库验收 API 返回类型：
  - 列表继续返回 `PaginatedResponse<IntakeOrder>`
  - 详情/新增/更新/提交/质检/验收/驳回/取消直接返回 `IntakeOrder`
  - 删除返回 `void`
- `IntakeFormPage` / `IntakeDetailPage` 不再读取入库详情外层 `data`。
- `frontend/src/api/notification.ts` 去除外层 `ApiResponse`，未读数返回 `number`，已读/全部已读/删除返回 `void`。
- `useNotifications` 直接消费分页对象和未读数字，不再读取 `listResponse.data/countResponse.data`。
- `frontend/src/api/search.ts` 去除外层 `ApiResponse`，`globalSearch` 直接返回 `SearchResult[]`。
- `GlobalSearch` / `SearchDropdown` 直接消费搜索数组，不再读取 `res.data`。
- `StepChecklist` / `TimeLogForm` 直接消费工单执行步骤、进度、工时数组；`PhotoUpload` 直接消费 `/file/upload` 返回的字符串 URL。
- `frontend/src/api/asset.ts` 去除资产主 API 的外层 `ApiResponse` 类型：
  - 资产详情/新增/更新返回 `Asset`
  - 删除返回 `void`
  - 导入解析/提交直接返回业务对象
  - 分类树返回 `AssetCategory[]`
  - 分类新增/更新返回 `AssetCategory`
  - 分类删除返回 `void`
  - 折旧排期返回 `DepreciationScheduleItem[]`
- `AssetListPage` 分类筛选直接消费分类树数组。
- `IntakeFormPage` 分类下拉直接消费分类树数组。
- `RevaluationFormPage` 资产查找直接消费 `Asset`，修复原先 `(res as any).data ?? (res as any).data` 恒为 undefined 的问题。

### 本轮新增测试
- `frontend/src/api/__tests__/assignment.test.ts`
- `frontend/src/api/__tests__/borrow.test.ts`
- `frontend/src/api/__tests__/intake.test.ts`
- `frontend/src/api/__tests__/notification.test.ts`
- `frontend/src/api/__tests__/search.test.ts`
- `frontend/src/api/__tests__/asset.test.ts`

### 本轮验证结果
- GitNexus impact：assignment/borrow/intake/notification/search/execution/asset 相关符号均因索引数据库版本不匹配失败，风险 UNKNOWN；已用代码审计、后端 controller 合同审计、API 契约测试、前端全量测试和构建兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/notification.test.ts src/api/__tests__/search.test.ts src/api/__tests__/assignment.test.ts src/api/__tests__/borrow.test.ts src/api/__tests__/intake.test.ts` 通过。
- 资产定向测试：`npm test -- --run src/api/__tests__/asset.test.ts src/api/__tests__/assignment.test.ts src/api/__tests__/borrow.test.ts src/api/__tests__/intake.test.ts src/api/__tests__/notification.test.ts src/api/__tests__/search.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`67` 个测试文件、`827` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 剩余桌面 HTTP 解包漂移仍存在：`workorder/reports/retirement/disposal/assetParentChild/stats` API 类型，`Budget/Revaluation` 列表兼容层，`Inspection/WorkOrder` 上传 URL 兼容层，`BigScreen` stats 兼容层等；其中折旧 `res.data` 已确认是业务字段，不能机械修改。

### 下一步非移动端优先队列
1. P1：收敛 `workorder.ts` 与工单表单字段映射/编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
2. P1：收敛 `reports/stats/retirement/disposal/assetParentChild` API 合同，区分业务 `data` 字段与外层 Result。
3. P1：清理 `Budget/Revaluation` 列表兼容层、`Inspection/WorkOrder` 上传 URL 兼容层、`BigScreen` stats 兼容层。
4. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
5. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:10 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：故障码 HTTP 解包合同闭环。

### 本轮已完成
- `frontend/src/api/faultCode.ts` 统一故障码 API 返回类型，匹配全局 `http` 拦截器已解包后的业务数据：
  - `getFaultCodeTree/getFaultCodeByLevel/getFaultCodeChildren` -> `FaultCode[]`
  - `getFaultCodeDetail/createFaultCode/updateFaultCode` -> `FaultCode`
  - `deleteFaultCode` -> `void`
- `FaultCodePage` 不再读取不存在的 `res.data`，直接使用 `FaultCode[]`。
- `FaultCodeTreePage` 不再读取不存在的 `res.data`，直接使用 `FaultCode[]`。
- `FaultCodeSelector` 已有的兼容解析保留，确保组件对旧 mock/异常形状仍具备防御性。

### 本轮新增/更新测试
- 新增 `frontend/src/api/__tests__/faultCode.test.ts`：
  - 锁定 `/fault-codes/tree`、`/level/{level}`、`/{id}/children`、详情、新增、更新、删除路径。
  - 锁定故障码调用不依赖外层 `ApiResponse`。
- 复跑既有 `FaultCodeSelector.test.tsx`，确认级联选择器继续支持已解包数组。

### 本轮验证结果
- GitNexus impact：故障码页与 API 函数均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 模块测试、组件测试和前端全量验证兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/faultCode.test.ts src/components/fault-code/FaultCodeSelector.test.tsx src/api/__tests__/reliability.test.ts src/api/__tests__/tenant.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/webhookConfig.test.ts src/api/__tests__/sam.test.ts src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`61` 个测试文件、`821` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 108，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：收尾扫描剩余桌面 HTTP 兼容层：BigScreen stats、资产导入导出解析、Inspection/Maintenance 部分兼容字段，区分真实漂移和业务字段。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:08 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：可靠性分析 HTTP 解包合同闭环，并完成折旧模块漂移复核。

### 本轮已完成
- `frontend/src/api/reliability.ts` 统一可靠性 API 返回类型，匹配全局 `http` 拦截器已解包后的业务数据：
  - `getReliabilitySummary` -> `ReliabilitySummary`
  - `getReliabilityTrend` -> `ReliabilityTrend[]`
  - `getReliabilityRanking` -> `ReliabilityRanking[]`
  - `getReliabilityByAsset` -> `AssetReliabilityDetail`
- `ReliabilityPage` 不再读取不存在的 `summaryRes.data/trendRes.data/rankingRes.data`，直接使用 API 返回对象。
- 折旧模块复核：
  - `DepreciationListPage` 的 `res.data` 是后端业务对象 `DepreciationSchedulePage.data`，不是外层 Result；本轮确认不能机械修改。
  - `useDepreciation` 仍有陈旧 `/assets/{id}/depreciation` 调用，但当前桌面路由未直接使用，且修复需要重新设计接口/数据形状；暂列后续专项，不在本轮解包合同中贸然改。

### 本轮新增测试
- `frontend/src/api/__tests__/reliability.test.ts`：
  - 锁定 `/reliability/summary`、`/trend`、`/ranking`、`/asset/{id}` 路径。
  - 锁定可靠性分析调用不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：可靠性页与 API 函数均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 模块测试和前端全量验证兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/reliability.test.ts src/api/__tests__/tenant.test.ts src/api/__tests__/webhookConfig.test.ts src/api/__tests__/sam.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`60` 个测试文件、`820` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 105，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：故障码 API 类型、BigScreen stats 兼容层、资产导入导出解析等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:06 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：系统租户管理 HTTP 解包合同闭环。

### 本轮已完成
- 新增 `frontend/src/api/tenant.ts`，集中租户管理 API 合同：
  - `listTenants`
  - `createTenant`
  - `updateTenant`
  - `suspendTenant`
  - `activateTenant`
- `TenantManagementPage` 不再裸调 `http`，统一通过 `api/tenant.ts` 获取/修改数据。
- `TenantManagementPage.fetchData()` 不再使用 `res.data || res`，直接读取解包后的 `{ records, total }`。
- 暂停/激活从拼接动作路径改为显式 typed API，方便后续多租户口径继续收敛。

### 本轮新增测试
- `frontend/src/api/__tests__/tenant.test.ts`：
  - 锁定 `/tenants` 列表、新增、更新、暂停、激活路径。
  - 锁定租户管理调用不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：`TenantManagementPage/TenantManagementContent` 因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 模块测试和前端全量验证兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/tenant.test.ts src/api/__tests__/webhookConfig.test.ts src/api/__tests__/sam.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`59` 个测试文件、`819` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 103，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：折旧、可靠性、故障码等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:04 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：Webhook 设置页 HTTP 解包合同闭环。

### 本轮已完成
- 新增 `frontend/src/api/webhookConfig.ts`，集中 Webhook 配置 API 合同：
  - `listWebhookConfigs`
  - `createWebhookConfig`
  - `updateWebhookConfig`
  - `deleteWebhookConfig`
- `WebhookConfigTab` 不再裸调 `http`，统一通过 `api/webhookConfig.ts` 获取数据。
- `WebhookConfigTab.fetchData()` 不再读取不存在的 `res.data.records/res.data.total`，直接使用解包后的 `{ records, total }`。
- 新增/编辑/删除也改走 typed API，避免页面继续散落裸路径。

### 本轮新增测试
- `frontend/src/api/__tests__/webhookConfig.test.ts`：
  - 锁定 `/webhook-configs` 列表、新增、更新、删除路径。
  - 锁定 Webhook 配置调用不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：`WebhookConfigTab` 因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 模块测试和前端全量验证兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/webhookConfig.test.ts src/api/__tests__/sam.test.ts src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`58` 个测试文件、`818` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 102，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：系统租户管理、折旧、可靠性、故障码等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:02 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：SAM 桌面 HTTP 解包合同闭环。

### 本轮已完成
- 新增 `frontend/src/api/sam.ts`，集中 SAM 合规 API 合同：
  - `runSamComplianceScan`
  - `getSamDashboard`
  - `getSamHistory`
  - `getSamScanDetails`
- `SamDashboardPage` 不再裸调 `http`，统一通过 `api/sam.ts` 获取数据。
- `SamDashboardPage` 移除 `res.data || res` 反模式：
  - 仪表盘直接使用 `SamDashboardData`
  - 历史记录直接使用 `PageData<SamComplianceScan>`
  - 扫描详情直接使用 `SamScanDetails`
- 页面类型从 API 模块导入，避免页面和接口合同分叉。

### 本轮新增测试
- `frontend/src/api/__tests__/sam.test.ts`：
  - 锁定 `/sam/dashboard`、`/sam/history`、`/sam/{id}/details`、`/sam/scan` 路径。
  - 锁定 SAM 调用不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：`SamDashboardPage` 因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、API 模块测试和前端全量验证兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/sam.test.ts src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`57` 个测试文件、`817` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 101，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：Webhook、系统租户管理、折旧、可靠性、故障码等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:00 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：桌面备件 HTTP 解包合同闭环。

### 本轮已完成
- `frontend/src/api/sparePart.ts` 统一备件 API 返回类型，匹配全局 `http` 拦截器已解包后的业务数据：
  - 列表：`PageData<SparePart>`
  - 详情/新增/更新：`SparePart`
  - 删除：`void`
  - 领用：`SparePartUsage`
  - 工单/备件领用记录：`SparePartUsage[]`
  - 低库存告警：`SparePart[]`
  - 采购建议：`PurchaseSuggestion[]`
- `SparePartListPage` 不再读取不存在的 `(res as any).data`，直接使用分页对象。
- `SparePartDetailPage` 不再读取不存在的 `detailRes.data/usageRes.data`，直接使用详情对象和领用记录数组。
- `SparePartUsageForm` 不再从分页对象里读取 `data.records`，工单详情页备件领用下拉可直接读取 `records`。
- `SafetyStockAlerts` 不再读取不存在的 `res.data`，低库存告警直接使用数组。

### 本轮新增测试
- `frontend/src/api/__tests__/sparePart.test.ts`：
  - 锁定 `/spare-parts`、详情、低库存、采购建议、工单/备件领用记录路径。
  - 锁定备件增删改查与领用不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：备件 API 函数与相关桌面组件均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、局部调用扫描和前端测试兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/sparePart.test.ts src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`56` 个测试文件、`816` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 100，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：SAM、Webhook、系统租户管理、折旧、可靠性、故障码等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 01:57 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：桌面采购单 HTTP 解包合同闭环。

### 本轮已完成
- `frontend/src/api/purchaseOrder.ts` 统一采购单 API 返回类型，匹配全局 `http` 拦截器已解包后的业务数据：
  - 列表：`PaginatedResponse<PurchaseOrder>`
  - 详情：新增 `PurchaseOrderDetail`
  - 明细：`PurchaseOrderItem[]`
  - 新增/更新/提交/审批/收货/取消：`PurchaseOrder`
  - 删除：`void`
  - 统计：`PurchaseOrderStats`
- `PurchaseOrderPage` 详情 query 不再读取不存在的 `res.data`，直接使用 `PurchaseOrderDetail`。
- `PurchaseOrderPage` 列表 query 不再读取不存在的 `res.data`，直接使用分页对象。
- `PurchaseOrderPage` KPI 统计 query 不再读取不存在的 `res.data`，直接使用统计对象。
- 采购单依赖的供应商下拉与上一轮供应商合同修复联动验证通过。

### 本轮新增测试
- `frontend/src/api/__tests__/purchaseOrder.test.ts`：
  - 锁定 `/purchase-orders`、`/purchase-orders/{id}`、`/items`、`/stats` 以及状态流转路径。
  - 锁定采购单增删改查与状态动作不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：采购单 API 函数与 `PurchaseOrderPage` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用后端 controller 合同审计、局部调用扫描和前端测试兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/purchaseOrder.test.ts src/api/__tests__/vendor.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`55` 个测试文件、`815` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 95，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：备件、折旧、可靠性、故障码、Webhook、系统租户管理、SAM 等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 01:55 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：桌面供应商 HTTP 解包合同闭环。

### 本轮已完成
- `frontend/src/api/vendor.ts` 统一供应商 API 返回类型，匹配全局 `http` 拦截器已解包后的业务数据：
  - `getVendorDetail` -> `Vendor`
  - `createVendor` -> `Vendor`
  - `updateVendor` -> `Vendor`
  - `deleteVendor` -> `void`
- `VendorsPage` 列表 query 不再读取不存在的 `res.data`，直接使用 `PaginatedResponse<Vendor>`。
- `VendorDetailSheet` 详情 query 不再读取不存在的 `res.data`，直接使用 `Vendor`。
- `IntakeFormPage` 供应商下拉去掉 `(res as any)` 兜底，改为明确读取 `PaginatedResponse.records`。
- `PurchaseOrderPage` 供应商下拉已是直接读取 `records`，本轮审计确认无需改动。

### 本轮新增测试
- `frontend/src/api/__tests__/vendor.test.ts`：
  - 锁定 `/vendors`、`/vendors/{id}` 路径均通过统一 `http` 调用。
  - 锁定供应商增删改查不依赖外层 `ApiResponse`。

### 本轮验证结果
- GitNexus impact：`getVendorList/getVendorDetail/createVendor/updateVendor/deleteVendor/VendorsPage/PurchaseOrderPage/IntakeFormPage` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用局部调用扫描和前端测试兜底。
- 前端定向测试：`npm test -- --run src/api/__tests__/vendor.test.ts` 通过。
- 前端回归定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`54` 个测试文件、`814` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- GitNexus detect changes：`scope=all` 返回 low，changed files 93，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：采购单、备件、折旧、可靠性、故障码、Webhook、系统租户管理等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:27 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：后台调度任务 TenantContext 补齐。

### 本轮已完成
- `StocktakingServiceImpl` 三个盘点调度入口补齐租户上下文：
  - `generateScheduledTasks`
  - `checkOverdueTasks`
  - `calculateCompletionRate`
- `InspectionServiceImpl` 三个检验调度入口补齐租户上下文：
  - `checkExpiringInspections`
  - `markOverdueInspections`
  - `generateInspectionStatistics`
- `InspectionTaskServiceImpl` 两个巡检任务调度入口补齐租户上下文：
  - `remindExpiringTasks`
  - `markOverdueTasks`
- `SafetyChecklistServiceImpl` 两个安全检查调度入口补齐租户上下文：
  - `checkExpiringSafetyChecklists`
  - `checkOverdueExecutions`
- `WorkOrderHoldService.scanOverdueHolds()` 补齐按租户设置/清理上下文，避免内部 `WorkOrderService` 读取缺租户。
- `AssetBorrowService.checkOverdue()` 从全局扫描改为按 `TenantService.getActiveTenantIds()` 分租户扫描，并按 `tenantId` 过滤借用记录；每个租户循环都 `try/finally` 清理上下文。

### 本轮新增/更新测试
- `StocktakingServiceTest`：新增调度逾期检查测试，验证 mapper 调用期间已绑定 `TenantContext=T001`，执行后上下文清空。
- `AssetBorrowServiceTest`：验证借用到期扫描按 active tenant 执行、更新逾期状态，并在结束后清理上下文。

### 本轮验证结果
- GitNexus impact：上述调度类均因索引数据库版本不匹配失败，风险 UNKNOWN；已用本地扫描与测试兜底。
- 后端定向测试：`mvn -q -Dtest=StocktakingServiceTest,AssetBorrowServiceTest test` 通过。
- 后端全量测试：`mvn -q test` 通过，退出码 0；日志中仍有既有负向用例刻意触发的异常栈。
- 前端未改动；上一轮前端全量测试与构建均已通过。
- GitNexus detect changes：`scope=all` 返回 low，changed files 90，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。
4. P2：降低后端测试中既有负向用例异常栈噪声，保留断言但减少误导。

## 2026-06-09 02:16 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：ABC 权限表达式与若依权限种子统一。

### 本轮已完成
- `ABCClassificationController` 从 Spring Security `hasAuthority('abc:*')` 统一改为若依口径：
  - 查询类：`@ss.hasPermi('abc:query')`
  - 重分类类：`@ss.hasPermi('abc:reclassify')`
- `schema.sql` 补齐 ABC 权限节点：
  - `300`：ABC 分类父节点，`abc:query`
  - `301`：ABC 查询，`abc:query`
  - `302`：ABC 重分类，`abc:reclassify`
- `schema.sql` 补齐 SUPER_ADMIN 与 `300/301/302` 的 `sys_role_menu` 绑定。
- 新增 `migration/V2_67__abc_permissions.sql`，为已有库保留 ABC 权限补种路径。

### 本轮新增测试
- `ABCClassificationControllerTest`：
  - 反射锁定所有 ABC controller 方法使用 `@ss.hasPermi(...)`。
  - 验证无 `abc:reclassify` 权限时写接口 403。
  - 验证有 `abc:query` 权限时统计接口可访问。
- `PermissionSeedSchemaTest`：
  - 锁定 `schema.sql` 包含 `abc:query/abc:reclassify` 以及 SUPER_ADMIN 绑定。
  - 锁定 `V2_67__abc_permissions.sql` 包含同样权限种子。

### 本轮验证结果
- GitNexus impact：`ABCClassificationController` 因索引数据库版本不匹配失败，风险 UNKNOWN；已用本地扫描与测试兜底。
- 后端定向测试：`mvn -q -Dtest=ABCClassificationControllerTest,PermissionSeedSchemaTest test` 通过。
- 后端全量测试：`mvn -q test` 通过，退出码 0；日志中仍有既有负向用例刻意触发的异常栈。
- 前端未改动；上一轮前端全量测试与构建均已通过。
- GitNexus detect changes：`scope=all` 返回 low，changed files 85，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
4. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。

## 2026-06-09 02:05 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P1：盘点周期列表/详情/stats 与桌面端 stocktaking API 合同闭环。

### 本轮已完成
- `StocktakingCycleController.list()` 不再返回 `null`，支持按 `status` 查询当前租户盘点周期。
- `StocktakingCycleController.get()` 不再返回 `null`，改为返回当前租户周期详情。
- 新增 `GET /stocktaking/cycles/{id}/stats`，返回 `totalCount/pendingCount/countedCount/adjustedCount/completedCount`。
- `StocktakingService` 补齐 `listCycles/getCycleById/getCycleStats`。
- `StocktakingServiceImpl` 对周期详情、统计、分配、暂停、恢复、完成增加当前租户校验；`adjustVariance` 也补齐任务租户校验。
- 新增 `StocktakingCycleStatsDTO`。
- 新增 `frontend/src/api/stocktaking.ts`，桌面端盘点周期列表、详情、表单、任务页全部改用统一 `http`，不再手写 `fetch('/api/...')`。
- 修复盘点详情页 `variance` 缺省时可能显示 `undefined` 的小展示问题。

### 本轮新增/更新测试
- `StocktakingCycleControllerTest`：覆盖列表、详情、stats 三个接口位于 `/api` context path 下的真实合同。
- `StocktakingPermissionControllerTest`：补充 `getStats` 权限断言。
- `StocktakingServiceTest`：覆盖 stats 聚合口径、跨租户周期读取拒绝、跨租户任务调账拒绝。
- `frontend/src/api/__tests__/stocktaking.test.ts`：锁定所有 stocktaking API 路径不再拼出 `/api/api/...`。

### 本轮验证结果
- GitNexus impact：`StocktakingCycleController`、`StocktakingService`、`StocktakingServiceImpl`、桌面盘点页符号均因索引数据库版本不匹配失败，风险 UNKNOWN；已用本地扫描、定向测试、全量测试兜底。
- 后端定向测试：`mvn -q -Dtest=StocktakingCycleControllerTest,StocktakingPermissionControllerTest,StocktakingServiceTest test` 通过。
- 前端定向测试：`npm test -- --run src/api/__tests__/stocktaking.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`53` 个测试文件、`813` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` 大 chunk warning。
- 后端全量测试：`mvn -q test` 通过，退出码 0；日志中仍有既有负向用例刻意触发的异常栈。
- GitNexus detect changes：`scope=all` 返回 low，changed files 85，changed symbols/affected processes 为空；受索引版本问题影响，仅作辅助参考。

### 下一步非移动端优先队列
1. P1：ABC controller 权限表达式与若依 `@ss.hasPermi(...)` 口径统一，并检查权限种子是否覆盖 `abc:*`。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
4. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
5. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。

## 2026-06-09 01:50 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 API 合同专项：处理 `/api` 双前缀路由漂移。

### 本轮已完成
- 统一移除以下 controller 类级 `@RequestMapping` 中多余的 `/api` 前缀，避免在全局 `server.servlet.context-path=/api` 下形成 `/api/api/...`：
  - `ABCClassificationController` -> `/abc`
  - `BarcodeController` -> `/barcodes`
  - `StocktakingCycleController` -> `/stocktaking/cycles`
  - `StocktakingTaskController` -> `/stocktaking/tasks`
  - `TestResultsController` -> `/test-results`
- `frontend/src/api/barcode.ts` 去掉业务路径中的 `/api` 前缀，匹配统一 `http` baseURL `/api`。
- `barcode.ts` 返回类型从外层 `ApiResponse<T>` 改为统一拦截器解包后的 `AssetLabel` / `AssetLabel[]`。
- 新增 `ControllerApiPrefixMappingTest`，反射锁定上述 controller 映射，防止 `/api` 前缀回潮。
- 新增 `frontend/src/api/__tests__/barcode.test.ts`，锁定 barcode API 不再拼出 `/api/api/...`。

### 本轮验证结果
- GitNexus impact：多次因索引数据库版本不匹配失败，风险 UNKNOWN；已用本地扫描与定向测试兜底。
- 后端定向测试：`mvn -q -Dtest=ControllerApiPrefixMappingTest,StocktakingPermissionControllerTest test` 通过。
- 前端定向测试：`npm test -- --run src/api/__tests__/barcode.test.ts` 通过。
- 前端全量测试：`npm test -- --run` 通过，`52` 个测试文件、`811` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有大 chunk warning。
- 后端全量测试：`mvn -q test` 通过，退出码 0。
- GitNexus detect changes：`scope=all` 返回 low，changed files 79，changed symbols/affected processes 为空；受索引版本问题影响，该结果只作辅助参考。

### 下一步非移动端优先队列
1. P1：盘点周期列表/详情实现缺口。当前 `StocktakingCycleController.list()` / `get()` 仍返回 `null`，详情页还调用 `/stocktaking/cycles/{id}/stats` 但后端没有对应接口。
2. P1：盘点桌面页仍使用原生 `fetch`，绕开统一 `http` 鉴权/错误处理，并存在 `data.data.records` 与实际数组返回结构不一致风险。
3. P1：ABC 权限表达式与若依 `@ss.hasPermi(...)` 口径统一，并检查权限种子。
4. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
5. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
6. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。

## 2026-06-09 01:27 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

本轮继续执行非移动端 P0：盘点 controller 若依权限补齐。

### 本轮已完成
- `StocktakingCycleController` 补齐方法级 `@PreAuthorize`：
  - 查询类：`stocktaking:cycle:query`。
  - 创建：`stocktaking:cycle:add`。
  - 分配、暂停、恢复、完成：`stocktaking:cycle:edit`。
- `StocktakingTaskController` 补齐方法级 `@PreAuthorize`：
  - 任务详情：`stocktaking:cycle:query`。
  - 扫码录入、差异调整：`stocktaking:cycle:edit`。
- 新增 `StocktakingPermissionControllerTest`：
  - 反射锁定所有 stocktaking handler 的权限表达式，防止后续漏删。
  - 局部关闭 test profile 的 `ams.security.method-permission-test-bypass`，真实验证无权限请求返回 403。
  - 验证拥有 `stocktaking:cycle:query` 时可访问任务详情并调用 service。

### 本轮验证结果
- GitNexus impact：`StocktakingCycleController` / `StocktakingTaskController` 均因索引数据库版本不匹配失败，风险 UNKNOWN；已用本地扫描与测试兜底。
- 后端定向测试：`mvn -q -Dtest=StocktakingPermissionControllerTest,InventoryControllerTest test` 通过。
- 后端全量测试：`cd backend && mvn -q test` 通过，退出码 0。
- GitNexus detect changes：`scope=all` 返回 low，changed files 75，changed symbols/affected processes 为空；受索引版本问题影响，该结果只作辅助参考。

### 新发现风险
- 少数 controller 自身 `@RequestMapping` 带 `/api/...`，而项目全局 `server.servlet.context-path=/api`，真实运行时可能形成 `/api/api/...` 路由。已确认涉及 `ABCClassificationController`、`BarcodeController`、`StocktakingCycleController`、`StocktakingTaskController`、`TestResultsController`，建议列入后续桌面端 API 路由漂移专项。

### 下一步非移动端优先队列
1. P0/P1：处理 `/api` 双前缀路由漂移，先从 stocktaking 与 ABC/Barcode/TestResults 建立兼容策略，再改映射或前端调用。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
4. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
5. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。

## 2026-06-09 01:21 最新推进状态（GAI2 蜂群全量推进 / 非移动端）

用户要求继续 GAI2 蜂群全量推进到 100 分，移动端暂不继续。本轮只处理后端/桌面端/安全配置闭环。

### 本轮已完成
- SSO mock 默认配置收口：
  - `application.properties` 不再默认启用 mock OAuth2 server，`sso.mock.enabled` 改为 `${SSO_MOCK_ENABLED:false}`。
  - MaxKey `client-id/client-secret/client-name` 与 provider URI 改为环境变量注入，默认指向真实 MaxKey 占位域名，不再把 localhost mock 与 `test-secret` 放在默认 profile。
  - 新增 `application-dev.properties`，仅本地 dev profile 显式启用 mock OAuth2 server 与 dev-only mock secret。
  - 新增 `MockAuthorizationServerControllerTest`，断言 test/default profile 下 mock 授权服务器 controller 不进入 Spring 容器。

### 本轮验证结果
- GitNexus impact：尝试分析 `MockAuthorizationServerControllerTest` 时仍因索引数据库版本不匹配失败，返回 UNKNOWN；本轮仅改配置和新增测试，未改业务符号。
- 后端定向测试：`mvn -q -Dtest=MockAuthorizationServerControllerTest,AuthControllerTest,WorkflowDefinitionControllerTest test` 通过。
- 后端全量测试：`cd backend && mvn -q test` 通过，退出码 0；日志中仍有既有负向用例刻意触发的异常栈。
- GitNexus detect changes：`scope=all` 返回 low，changed files 73，changed symbols/affected processes 为空；受索引版本问题影响，该结果只作辅助参考。

### 下一步非移动端优先队列
1. P0：盘点 controller 若依权限补齐。`StocktakingCycleController` / `StocktakingTaskController` 按权限种子补 `@PreAuthorize` 并加 403 测试。
2. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
3. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
4. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
5. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。

## 2026-06-08 23:44 最新推进状态（Codex /gai2-lite 更新）

本轮继续做“审计证据 → 低风险修复 → 验证”的小闭环，重点推进移动端交互和 SLA 业务逻辑。

### 本轮已完成并验证
- 修复移动端统一 HTTP 解包错误：
  - 项目 `http` 拦截器已经自动返回 `Result.data`，移动端页面原来还在读取 `res.data/res.code`，会导致接口成功但页面拿不到数据。
  - 已修复 `/m/index`、`/m/assets`、`/m/scan`、`/m/work-orders`、`/m/notifications` 的数据读取方式。
  - 已扫描移动端范围，未再发现 `res.data/res.code` 误用。
- 补齐移动端资产详情闭环：
  - 新增 `/m/assets/:id` 和 `MobileAssetDetailPage`，复用既有 `GET /mobile/assets/{id}`。
  - `/m/assets` 列表点击资产、`/m/scan` 查看完整详情，都改为留在移动端布局。
  - `/m/assets` 加载更多改为扩容式加载，不再翻页后丢失前一页。
- 加固 SLA 配置租户安全与可配置性：
  - `SlaService.listConfigs()` 会确保当前租户有 LOW/MEDIUM/HIGH/CRITICAL 四档配置；缺失时从全局默认配置补租户副本。
  - `SlaService.updateConfig()` 改为只允许更新当前租户配置，避免通过 id 修改其他租户 SLA。
  - 后端支持 SLA 配置部分更新，兼容前端设置页只提交变更字段的行为。
  - 增加 SLA 配置值校验：响应时限、解决时限必须大于 0，预警阈值必须在 0 到 1 之间。
- 新增 `SlaServiceTest` 覆盖：
  - 缺失租户配置时从全局默认补齐。
  - 拒绝跨租户更新。
  - 拒绝非法配置值。
  - 当前租户配置正常更新。

### 本轮验证结果
- GitNexus impact：
  - `MobileAssetListPage` LOW。
  - `MobileScanPage` LOW。
  - `router` LOW。
  - `SlaService` LOW，直接影响 `SlaMonitorJob` 与 `SlaConfigController`。
  - `SlaService.updateConfig` LOW，直接调用方 `SlaConfigController.updateConfig`。
- 前端全量测试：`49` 个测试文件，`808` 个测试全部通过。
- 前端构建：`npm run build` 通过；仍仅有大 chunk warning。
- 后端定向测试：`mvn -q -Dtest=SlaServiceTest,WorkOrderServiceTest test` 通过。
- 后端全量测试：`mvn -q test` 退出码 `0`。日志中仍有既有测试刻意触发的异常栈。
- 本地路由探活：`/m/assets`、`/m/assets/1`、`/m/scan` 均返回 `200 OK`。

### 下一步建议
- 继续 `/gai2-lite` 小闭环推进：
  1. 复核工单 SLA 运行态：创建工单后 deadline 是否展示、定时刷新后列表筛选和详情 Badge 是否同步。
  2. 浏览器登录态点击验证移动端 `/m/index -> /m/assets -> /m/assets/:id -> /m/scan`。
  3. 复核工单附件与故障代码在新建/编辑/详情中的展示和提交合同。

## 2026-06-08 23:31 最新推进状态（Codex 更新）

继续按 Phase 1 “复核现状后修复真实缺口”推进。本轮核查发现：SLA 配置页已经在系统设置中存在，前端 `SlaConfigTab` 与后端 `/sla-config` 合同已打通；移动端入口存在真实断裂，首页和顶部通知会跳到未注册或桌面端路由。

### 本轮已完成并验证
- 补齐移动端路由闭环：
  - `/m/work-orders` 已注册并接入 `MobileWorkOrdersPage`。
  - `/m/notifications` 已注册并接入 `MobileNotificationsPage`。
  - 移动端顶部标题增加“待办工单 / 消息通知”。
  - 首页“最近通知”更多入口从桌面 `/notifications` 改为移动端 `/m/notifications`。
- 新增移动端待办工单页：
  - 调用既有后端 `GET /mobile/work-orders`。
  - 展示总数、状态、优先级、资产信息。
  - 修复“加载更多”只显示下一页且 hasMore 判断不准的问题，改为扩容式加载。
- 新增移动端未读通知页：
  - 调用既有后端 `GET /mobile/notifications`。
  - 展示未读数量、通知类型、内容和创建时间。
  - 支持刷新；点击通知进入完整通知中心。

### 本轮验证结果
- GitNexus impact：
  - `MobileLayout` LOW。
  - `MobileDashboardPage` LOW。
  - `router` LOW。
- 前端构建：`npm run build` 通过；仍仅有大 chunk warning。
- 前端全量测试：`49` 个测试文件，`808` 个测试全部通过。

## 2026-06-09 01:14 最新推进状态（GAI2 蜂群全量推进）

用户明确要求：使用 GAI2 蜂群全量推进项目到 100 分；移动端都先不做。本轮已冻结移动端，不再继续开发/验证 `/m/**`。

### 本轮蜂群审计结论
- `verification-ops / architecture-integration`：前端 `http` 已自动解包 `Result.data`，但多个桌面页和 API 类型仍按 `ApiResponse<T>` / `.data` 消费，造成真实读空风险。
- `data-model / product-ux`：工单详情、验收、故障码、负责人/截止日期/协作人、编辑回填存在契约不齐；优先修直接影响创建/保存/详情展示的链路。
- `risk-security / business-integration`：若依整合下 P0 包括重估审批人可伪造、SSO mock 默认配置、盘点 controller 权限缺口；P1 包括租户 ID 口径与 scheduler TenantContext。

### 本轮已完成
- 工单详情页兼容后端当前 `GET /workorders/{id}` 直接返回 `WorkOrder` 的真实契约，不再因期待 `{ workOrder, approvalRecords }` 导致详情空白。
- 工单验收页同样兼容直接 `WorkOrder` 响应，提交验收/验收通过/驳回入口恢复可见。
- `WorkOrderDTO` 补 `faultCodeId`，维修工单选择故障码后可传入后端实体并持久化。
- `FaultCodeSelector` 修复 HTTP 解包问题，支持真实运行时返回 `FaultCode[]`，三级联动恢复。
- 重估审批安全修复：`AssetRevaluationController` 忽略前端 body 中的 `approvedBy`，改从 Spring Security `LoginUser`/principal 取当前用户 ID；前端不再传硬编码 `approvedBy: 1`。

### 本轮新增/更新测试
- `backend/src/test/java/com/ams/controller/AssetRevaluationControllerTest.java`：覆盖 body 伪造 `approvedBy=999` 时后端仍使用认证用户 `88`。
- `backend/src/test/java/com/ams/controller/WorkOrderControllerTest.java`：覆盖详情接口直接返回 `WorkOrder` 且包含 `faultCodeId`。
- `backend/src/test/java/com/ams/service/WorkOrderServiceTest.java`：覆盖创建工单时 `faultCodeId` 与附件进入 mapper insert。
- `frontend/src/components/fault-code/FaultCodeSelector.test.tsx`：覆盖解包后数组的三级故障码选择。
- `frontend/src/pages/workorder/WorkOrderAcceptancePage.test.tsx`：覆盖直接 `WorkOrder` 响应下验收页渲染。

### 验证结果
- 后端窄测：`mvn -q -Dtest=AssetRevaluationControllerTest,WorkOrderServiceTest,WorkOrderControllerTest test` 通过。
- 后端全量：`cd backend && mvn -q test` 通过，退出码 0。
- 前端全量：`cd frontend && npm test -- --run` 通过，`51` 个测试文件、`810` 个测试全部通过。
- 前端构建：`cd frontend && npm run build` 通过，仅剩既有大 chunk warning。
- GitNexus：后端早前工单类影响面曾返回 LOW/MEDIUM；后续 GitNexus MCP 多次因索引数据库版本不匹配报错。已尝试 `npx gitnexus analyze`，但 CLI 缺 `tree-sitter-swift` 失败。最终 `gitnexus_detect_changes(scope=all)` 返回 low，changed symbols 为空。

### 下一步非移动端优先队列
1. P0：SSO mock 默认配置收口。默认关闭 `sso.mock.enabled`，mock OAuth/`test-secret` 迁 dev/test profile 或改 env 注入。
2. P0：盘点 controller 若依权限补齐。`StocktakingCycleController` / `StocktakingTaskController` 按权限种子补 `@PreAuthorize` 并加 403 测试。
3. P1：租户 ID 口径统一。梳理 `dept:{deptId}`、`default`、`1`、`T001` 混用，先形成迁移策略再改。
4. P1：scheduler TenantContext。借用/巡检/盘点调度按 active tenants 遍历并 `try/finally` 设置/清理租户上下文。
5. P1：继续收敛桌面端 HTTP 解包漂移：采购、供应商、备件、可靠性、资产标签、故障码管理页、巡检上传等。
6. P1：工单表单字段映射与编辑闭环：`assigneeId/assigneeName`、`plannedEndDate`、协作人持久化策略、编辑路由与回填。

### 下一步建议
- 移动端已按用户要求冻结，后续不再推进 `/m/**`。
- 进入工单 SLA 运行态验证：设置页能配 SLA 不代表工单创建/延期/超时统计全链路都正确，需要从工单创建、状态推进、统计看板三处验证。
- 继续桌面端登录态浏览器点击验证：优先 `/workflows`、工单新建/编辑/详情/验收、盘点详情确认与调账闭环。

## 2026-06-08 23:22 最新推进状态（Codex 更新）

当前已进入 `ITERATION_OPTIMIZATION_PLAN.md` Phase 1 的“按现状复核后修复”阶段。旧计划中部分判断已过时：工单 SLA、工单状态机、工单附件、移动端/VendorPortal 路由都已有实现；本轮优先修复了仍真实断裂的“盘点差异确认/自动调账闭环”。

### 本轮已完成并验证
- 补齐前后端盘点确认接口合同：
  - 前端已有 `PATCH /inventory/tasks/{taskId}/assets/{detailId}/confirm` 与 `POST /inventory/tasks/{taskId}/assets/batch-confirm` 调用。
  - 后端 `InventoryController` 现已提供对应路由，并保留 `PATCH /inventory/tasks/{id}/status` 兼容前端状态更新。
- `InventoryDetailPage` 补齐资产明细选择列和逐条确认列；批量确认不再是“有状态栏但无法选择”的死交互。
- `InventoryService` 加固调账：
  - 单条/批量确认按当前任务与租户校验盘点明细。
  - 审批调账时盘亏/损坏资产更新增加租户条件，避免跨租户资产被错误更新。
  - 盘盈资产默认进入 `IDLE`，更符合“盘盈入账后待处置/分配”的业务语义。
  - 自动调账成功后写入 `inventory_adjustment_log`，形成审计闭环。
- `schema.sql` 同步完整快照：
  - 补入 `work_order.attachments/fault_code_id/sla_deadline/sla_status`、`sla_config` 默认表和种子数据。
  - 补入 `inventory_task` 审批/调账统计字段与 `inventory_adjustment_log` 表。

### 本轮验证结果
- GitNexus impact：
  - `InventoryService` LOW：直接依赖 `InventoryController`、`InventoryControllerTest`。
  - `InventoryController` LOW：无上游符号依赖。
  - `InventoryDetailPage` LOW：无上游符号依赖。
- 后端定向测试：`mvn -q -Dtest=InventoryServiceTest,InventoryControllerTest test` 通过。
- 后端编译：`mvn -q -DskipTests compile` 通过。
- 前端定向测试：`npm test -- --run src/api/__tests__/inventory.test.ts` 通过。
- 前端构建：`npm run build` 通过；仍仅有 `three` 等大 chunk warning。
- 前端全量测试：`49` 个测试文件，`808` 个测试全部通过。
- 后端全量测试：`mvn -q test` 退出码 `0`。
- 本地前端服务：`localhost:5173` 正在监听，`curl -I http://localhost:5173/inventory` 返回 `200 OK`。由于当前未暴露 in-app Browser 控制工具，本轮未完成登录态页面点击验证。

### 下一步建议
- 继续 Phase 1 复核式推进，而不是照旧计划重做：
  1. 浏览器验证 `/inventory` 盘点详情交互：逐条确认、批量确认、提交核准、审批调账。
  2. 复核移动端内部跳转，重点是 `/m/work-orders`、`/m/notifications` 是否有路由或是否应回到桌面端路由。
  3. 复核 SLA 配置页是否在系统设置中有入口；如果没有，补入口和前端配置页。
  4. 处理 JaCoCo `argLine` 与 `forkCount` 构建债务，建议独立小改。

## 2026-06-08 23:06 最新执行状态（Codex 更新）

当前主线已从“测试恢复待验证”推进到“全量测试已恢复 + workflows 保存修复 + 测试环境降噪”。

### 已完成并验证
- `/workflows` 新建/保存失败的高概率根因已修复：`WorkflowDefinitionController` 不再只依赖手动解析 `Authorization: Bearer ...`，而是优先从 Spring Security 的 `LoginUser` 读取 `userId`，兼容若依式 `@ss` 鉴权上下文；Bearer 解析保留为旧调用兜底。
- 已补 `WorkflowDefinitionControllerTest`：覆盖“无 Authorization Header，但已有 `LoginUser` 安全上下文时仍可保存草稿”。
- 已补 `frontend/src/api/__tests__/workflow.test.ts`：锁定 workflow 保存、创建自定义流程、发布、状态更新的前端 API 契约。
- 后端测试 profile 已禁用后台调度：`ams.scheduling.enabled=false`，避免 controller/service 测试期间扫描 `scheduled_report` 等可选表。
- 后端测试 profile 已禁用操作日志切面：`ams.oper-log.enabled=false`，避免未初始化 `sys_operate_log` 时污染测试日志；生产默认仍开启。
- `FaultCodeMapper.countChildren` 重复 XML/注解映射已清理，MyBatis 启动不再报 duplicate statement error。

### 验证结果
- 前端全量测试：`48` 个测试文件，`805` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩 chunk 体积 warning。
- 后端 workflow controller/service 定向测试通过。
- 后端全量测试：`mvn -q test` 退出码 `0`。

### 当前剩余噪声/风险
- 后端全量测试仍会输出部分“预期异常场景”的业务堆栈，例如全局异常处理、租户越权、维护执行回滚等测试刻意触发的错误路径。这类不再属于测试环境副作用，若要继续降噪，应单独评估测试日志级别或断言式日志捕获策略。
- 业务主线仍未达到 100 分，下一轮应进入 `ITERATION_OPTIMIZATION_PLAN.md` 的 Phase 1：工单 SLA 持久化、工单状态机统一、盘点差异闭环、工单附件、未注册路由激活。

> 用途：在 Cowork 会话里推进了 P0 安全修复 + P1 测试恢复 Wave 1，因沙箱限制（无 JDK/Maven、不能删/移文件、`.git/index.lock` 被占用）需切到 Claude Code 继续。
> 详细逐文件计划见 **`docs/TEST_RECOVERY_PLAN.md`**；执行脚本见 **`scripts/recover-tests-wave1.sh`**。

## 一句话现状
P0 三处安全修复已改好（待提交）；P1 Wave 1 的 20 个 service/enum 测试已**就地修好内容**，只差 `git mv` 进编译路径 + 用 Maven 验证。

---

## 已完成（改动在工作区，未 commit）

### P0 安全（3 个文件，已改）
- `backend/.../mapper/InspectionTaskMapper.java` — `batchUpdateStatus` 的 `${taskIds}` 拼接 → `List<Long>` + `<foreach>` 参数化（零调用方，低风险）
- `backend/src/main/resources/application.properties` — `management.endpoint.health.show-details=always` → `when-authorized`（properties 覆盖 yml，这才是真正泄露点）
- `backend/src/main/resources/application.yml` — JWT 弱默认值 → `${JWT_SECRET:}`（`ApplicationConfigValidator` 已在缺失时阻止启动，弱字面量本就休眠，此处消除）

### P1 Wave 1（20 个 service/enum 测试，内容就绪，仍在 `java-excluded`）
已就地编辑：
- 补 `@Mock`（修运行期 NPE）：`AssetServiceTest`(+2)、`RetirementApplicationServiceTest`(+3，含 2 import)、`WorkOrderServiceTest`(+1)、`BusinessCommentServiceImplTest`(+1，含 import)
- 去过时 `@Disabled`：`ABCClassificationServiceTest`、`ApprovalServiceTest`、`EnergyServiceTest`、`TenantServiceTest`、`WorkOrderServiceTest`、`BusinessCommentServiceImplTest`
- 无需改动可直接搬：`AssetCategory/AssetLifecycle/Auth/Compensation/Dashboard/Disposal/Graphify/IdleAsset/IntakeOrder/MaintenanceExecution/UserManagement`ServiceTest、`AssetStatusTest`

验证（无编译器下能做的）：导入预检 63/63 可解析；20 个文件 `@Disabled` 残留 = 0。**未经真编译器验证。**

---

## 立即要做（按顺序）
1. 解锁 git：确认无 git 进程后 `rm -f .git/index.lock`。
2. 跑 `bash scripts/recover-tests-wave1.sh`（删 8 个重复副本 + `git mv` 20 个文件）。
3. 验证 Wave 1：
   ```bash
   cd backend && mvn -q test-compile && mvn -q -Dtest='*ServiceTest,AssetStatusTest' test
   ```
   - 绿 → 方法论成立，再放量到 controller。
   - 个别红 → 按报错微调（service 单测多为缺 mock/断言，见计划第 4-5 节）。
4. Wave 2（31 个 controller）：`bash scripts/recover-tests-wave1.sh wave2` 自动处理 27 个 EASY + 解除 surefire `**/controller/**` 排除；剩 4 个手工：
   - `InventoryControllerTest` 一行：mock `submitTask(7L)` 取代 `updateTaskStatus(7L,"SUBMITTED")`
   - `NotificationControllerTest` 一行：断言 `isRead` 用 `.value(0)` 取代 `.value(false)`
   - `SafetyChecklistControllerTest`：`@WebMvcTest`→`@SpringBootTest`+`@AutoConfigureMockMvc(addFilters=false)`，去 `csrf()`
   - `UserSearchControllerTest`：多租户重构，mock `AssetService`+设 `TenantContext`+verify `searchUsersByDepts`
5. Wave 3（4 个重写/集成）：`CycleCountServiceTest`、`SafetyChecklistServiceTest`、`CommentIntegrationTest`(+解除 integration 排除)、`TenantIsolationIntegrationTest`(保留 @Disabled，先查 git 历史)。

## 构建配置 bug（建议独立 PR，需编译器验证）
- 🔴 **JaCoCo 覆盖率静默失效**：`backend/pom.xml` surefire 用 `${surefire.argLine}`，应改 `@{argLine}`（晚绑定），否则覆盖率报告为空。
- `forkCount=0` + `reuseForks=false` 是无效组合；改 `forkCount=1` 需与 `@{argLine}` 同改。

## 未提交改动清单（git 解锁后 stage）
- 改：上面 P0 的 3 个文件 + P1 的 10 个被编辑的测试文件（其余 10 个 Wave1 文件仅会被 `git mv`）
- 新增：`docs/TEST_RECOVERY_PLAN.md`、`scripts/recover-tests-wave1.sh`、`goon.md`

## 环境/规范注意
- 本会话 **GitNexus MCP 工具不可用**，P0 的 impact analysis 是用 grep 手工做的（确认 `batchUpdateStatus` 零调用方）。在 Claude Code 里按 `CLAUDE.md`：**改任何 symbol 前先 `gitnexus_impact`**，提交前 `gitnexus_detect_changes()`。
- 仓库根有不该入库的大文件（`backend.log` 9.3MB、`.aider.chat.history.md` 3.4MB）——属 P5，未处理。

## 后续大盘（P2–P6，未动）
P2 代码质量清理（`.backup`、空 catch、TODO、废弃定时任务）｜P3 架构（拆 God Class、瘦控制器）｜P4 前端（ESLint/Prettier、strict、图表库去重）｜P5 文档/SPEC 统一 + 大文件清理｜P6 CI（覆盖率门禁、Docker、分布式锁）。详见首轮扫描。
## 2026-06-09 02:46 最新执行状态（GAI2 全量推进 / Codex 更新）

### 本轮新增完成
- 工单新建/编辑保存闭环已补齐：前端提交 DTO 统一经 `workOrderFormMapper` 映射到后端字段，编辑页可回填详情，附件上传按已解包 URL 处理；后端 `WorkOrder.collaborators` 改为 JSON type handler 持久化。
- 桌面端 API 契约继续收敛：reports、stats、retirement、disposal、assetParentChild、budget、revaluation、inspection upload、bigscreen stats、asset label、asset detail hook、maintenance asset list、inventory scope tree 等位置去除错误的二次 `res.data` 包装假设。
- 已修正报废撤回路径：前端 `withdrawRetirement` 从不存在的 `/retirement/{id}/withdraw` 改为后端实际 `/retirement/{id}/cancel`。
- 新增/更新前端契约测试：workorder mapper/API、reports、stats、retirement、disposal、assetParentChild、budget、revaluation 等。

### 验证结果
- 前端全量测试：`75` 个测试文件，`840` 个测试全部通过。
- 前端构建：`npm run build` 通过；仅剩既有 `three` chunk 体积 warning。
- 后端定向测试：`WorkOrderServiceTest,WorkOrderControllerTest,SchemaCoverageTest` 通过。
- 后端全量测试：`mvn test` 通过，`503` 个测试，`0` failure/error/skip。

### 风险与约束
- GitNexus impact/detect 当前受本地索引 DB 版本不匹配影响，impact 均返回 `Database file version: 41, Current build storage version: 40`，因此本轮 symbol blast radius 记录为 `UNKNOWN`，以全量前后端测试和定向契约测试作为兜底证据。
- 移动端按用户要求暂停，本轮未主动推进移动端功能；工作区中已有 mobile 相关脏文件视为既有改动，不纳入本轮质量闭环。

## 2026-06-09 02:57 最新执行状态（GAI2 继续推进 / Codex 更新）

### 本轮新增完成
- 若依整合后的租户 SQL 底座补充回归保护：新增 `MyBatisPlusConfigTest`，锁定 MyBatis-Plus 拦截器顺序为数据权限、分页、租户过滤，并验证 `dept:42` 等字符串租户 ID、白名单表和 insert 策略。
- 修复工作流业务表单入口错位：`ASSET_COMPENSATION` 从失效的 `/disposals/compensation/new` 改为当前桌面路由 `/compensation/new`，避免工作流中心“查看业务表单”跳 404。
- 前后端自定义流程编码口径统一：前端 `isCustomBusinessType` 使用与后端 `CreateCustomDefinitionRequest` 一致的 `CUSTOM_` 正则，避免非法自定义流程被前端当作有效流程。
- 清理审批服务测试/运行日志噪声：`ApprovalService#batchResolveRoleNames` 不再向 Caffeine cache 写入 `null`，缺失角色名时跳过缓存；流程详情测试补充 `approverRoleName` 断言。

### 验证结果
- 前端工作流切片测试：`5` 个测试文件，`24` 个测试通过。
- 前端全量测试：`76` 个测试文件，`842` 个测试通过。
- 前端构建：`npm run build` 通过；仍仅有既有 `three` chunk 体积 warning。
- 后端定向测试：`MyBatisPlusConfigTest,TenantServiceTest,WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest` 共 `30` 个测试通过。
- 后端审批服务定向测试：`ApprovalServiceTest` 共 `36` 个测试通过，原 Caffeine null NPE 堆栈消失。
- 后端全量测试：`mvn test` 通过，`506` 个测试，`0` failure/error/skip。

### 当前剩余噪声/风险
- 后端全量测试仍会输出部分预期异常路径日志，例如 `GlobalExceptionHandler` 对业务异常/校验异常打印 ERROR 与堆栈、部分租户越权测试打印 WARN。这些不是失败，但会掩盖真正异常；下一轮建议优先收敛异常处理器日志级别与测试日志策略。
- GitNexus impact 仍受本地索引 DB 版本不匹配影响，新增/修改 symbol 的 blast radius 仍记录为 `UNKNOWN`，已用前后端全量测试兜底。

## 2026-06-09 03:03 最新执行状态（GAI2 异常日志降噪 / Codex 更新）

### 本轮新增完成
- 收敛全局异常处理器日志级别：`ConflictException`、`BusinessException`、参数校验异常、`BindException` 改为 `WARN`，且业务异常不再打印完整堆栈；数据库异常和未知异常继续保留 `ERROR` 堆栈，避免吞掉真正生产故障。
- 新增 `GlobalExceptionHandlerTest`：锁定业务异常、冲突异常、绑定校验异常、未知异常的响应 code/message 契约，避免后续降噪改动破坏前后端接口形态。
- 修正测试 `MessageSource` mock：消息码默认原样返回，确保单测验证的是异常响应契约，而不是 mock 默认 `null` 行为。

### 验证结果
- 后端定向测试：`GlobalExceptionHandlerTest,AuthControllerTest,UserManagementControllerTest,FloorPlanControllerTest` 共 `28` 个测试通过。
- 后端全量测试：`mvn test` 通过，`510` 个测试，`0` failure/error/skip。

### 当前剩余噪声/风险
- 后端测试仍会输出部分有意触发的未知异常 `ERROR` 堆栈，例如 Stats/维护执行等测试场景；这类属于“真实未知异常兜底路径”的保留行为。如要进一步减少控制台噪声，应转为测试内日志捕获/断言策略，而不是降低生产未知异常日志级别。
- Surefire 仍提示 `forkCount=0` 可能影响测试准确性；这是构建配置债务，建议与 JaCoCo `argLine` 晚绑定一起独立处理。
- GitNexus impact/detect 仍受本地索引 DB 版本不匹配影响，symbol blast radius 继续记录为 `UNKNOWN`，以定向测试和全量测试作为执行证据。

## 2026-06-09 03:06 最新执行状态（GAI2 构建质量闭环 / Codex 更新）

### 本轮新增完成
- 修复后端 Surefire/Jacoco 配置债务：`forkCount` 从 `0` 调整为 `1`，`reuseForks=true`，并将 Surefire `argLine` 改为 `@{argLine} ${surefire.argLine}`，让 Jacoco `prepare-agent` 的 javaagent 通过晚绑定进入测试 JVM。
- 后端测试不再输出 `forkCount should likely not be 0` 与 `useSystemClassLoader setting has no effect when not forking` 警告。
- 覆盖率链路恢复：`mvn test` 生成 `target/jacoco.exec`，`mvn jacoco:report -DskipTests` 可加载执行数据并分析 `313` 个类，输出 `target/site/jacoco/jacoco.xml` 和 HTML 报告。

### 验证结果
- 后端构建配置定向验证：`mvn test -Dtest=GlobalExceptionHandlerTest` 通过，`4` 个测试，`0` failure/error/skip；测试执行栈显示使用 `ForkedBooter`。
- 后端全量测试：`mvn test` 通过，`510` 个测试，`0` failure/error/skip。
- 覆盖率报告：`mvn jacoco:report -DskipTests` 通过，`jacoco.xml` 已生成，约 `1.6M`。

### 当前剩余噪声/风险
- 后端未知异常测试仍会输出保留的 `ERROR` 堆栈，属于生产告警行为；如要继续降噪，应在对应测试中做日志捕获或调整测试日志 profile。
- GitNexus impact/detect 仍因本地索引版本问题无法给出可靠 symbol 级 blast radius，继续以全量测试、定向测试和构建报告作为兜底证据。

## 2026-06-09 03:09 最新执行状态（GAI2 租户白名单收缩 / Codex 更新）

### 本轮新增完成
- 审计若依整合后的租户 ID 链路：JWT 写入/读取统一使用 `tenant_id` claim，SSO 以 `dept:{deptId}` 签发租户，`TenantContext` 与 MyBatis-Plus 租户表达式已支持字符串租户 ID。
- 收缩 MyBatis-Plus 租户白名单：`workflow_definition`、`workflow_instance`、`workflow_task` 从 ignore 表中移除，避免带 `tenant_id` 的工作流业务表绕过全局租户拦截。
- 更新 `MyBatisPlusConfigTest`：明确断言 `workflow_definition` 不应被租户拦截器忽略，防止后续回退。

### 验证结果
- GitNexus impact：`MyBatisPlusConfig` impact 因本地索引 DB 版本不匹配失败，blast radius 记录为 `UNKNOWN`，已按高谨慎路径执行定向 + 全量验证。
- 后端定向测试：`MyBatisPlusConfigTest,WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest` 共 `27` 个测试通过。
- 后端全量测试：`mvn test` 通过，`510` 个测试，`0` failure/error/skip。

### 当前剩余噪声/风险
- `TenantFilter` 类仍实现了旧版 `TenantLineHandler`，但当前 `MyBatisPlusConfig` 内部构建了实际注册的 handler；建议后续确认该 bean 是否已无调用方，再决定清理或保留兼容。
- 若未来工作流实例/任务表正式落库，需要继续确认实体、Mapper 和 Schema 是否全部带 `tenant_id` 并受全局拦截器保护。

## 2026-06-09 03:13 最新执行状态（GAI2 租户链路清理 / Codex 更新）

### 本轮新增完成
- 清理旧版 `TenantFilter`：该类实现了旧 `TenantLineHandler` 但未被 `MyBatisPlusInterceptor` 注册，实际租户处理已由 `MyBatisPlusConfig` 内部 handler 接管；已删除无调用方的 `backend/src/main/java/com/ams/config/TenantFilter.java`。
- 更新 `TenantContext` 注释，将请求入口说明从旧 `TenantFilter` 修正为当前实际入口 `JwtAuthenticationFilter`。
- 清理测试命名中的旧概念残留：`AssetBorrowServiceTest` 相关用例名移除 `TenantFilter`，避免误导后续排查。

### 验证结果
- 代码搜索：`rg "TenantFilter" backend/src/main/java backend/src/test/java` 无残留。
- 后端定向测试：`AssetBorrowServiceTest,MyBatisPlusConfigTest,JwtUtilTest` 共 `6` 个测试通过。
- 后端全量测试：`mvn test` 通过，`510` 个测试，`0` failure/error/skip。

### 当前剩余噪声/风险
- GitNexus impact 仍因本地索引 DB 版本不匹配失败，`TenantFilter`/`TenantContext` blast radius 记录为 `UNKNOWN`；本项已用无引用搜索、定向测试、后端全量测试兜底。
- 下一步继续围绕租户 ID 口径统一检查迁移 SQL，避免若依整合后 `dept:{id}` 字符串租户写入 `BIGINT tenant_id` 字段失败。

## 2026-06-09 03:18 最新执行状态（GAI2 租户 Schema 统一 / Codex 更新）

### 本轮新增完成
- 统一迁移 SQL 租户 ID 口径：`V2_36__asset_parent_child.sql`、`V2_58__inspection_template_and_record.sql` 中的 `tenant_id BIGINT` 已改为 `tenant_id VARCHAR(64)`，支持若依整合后 `dept:{id}` 字符串租户。
- 修复资产父子关系迁移与当前实体不一致的问题：`asset_parent_child` 从旧列 `sort_order/created_at/updated_at/deleted_at` 对齐为当前实体使用的 `quantity/remark/create_time/deleted`，并修正引用不存在 `deleted` 列导致的索引创建风险。
- 新增 `TenantSchemaConsistencyTest`：扫描所有 migration 中行首 `tenant_id` 列声明，要求统一为 `VARCHAR(64)`；同时锁定 `asset_parent_child` 迁移不得回退到旧列名。

### 验证结果
- GitNexus impact：`SchemaCoverageTest`、`AssetParentChild`、`InspectionTemplate`、`InspectionRecord`、`InspectionTask` 均因本地索引 DB 版本不匹配失败，blast radius 记录为 `UNKNOWN`，已按高谨慎路径执行文本扫描 + 定向 + 全量验证。
- 后端定向测试：`TenantSchemaConsistencyTest,MyBatisPlusConfigTest` 共 `5` 个测试通过。
- 后端资产关系切片：`AssetServiceTest,TenantSchemaConsistencyTest` 共 `4` 个测试通过。
- 后端全量测试：`mvn test` 通过，`512` 个测试，`0` failure/error/skip。

### 当前剩余噪声/风险
- 检验模块目前缺少专门服务/控制器测试，Schema 风险已由 migration 文本一致性测试兜底；后续若继续推进 100 分，可补检验模板/记录/任务的业务切片测试。
- 后端全量测试仍有少量“预期异常路径”日志输出，例如维护执行回滚场景保留 `ERROR` 堆栈；这是测试故意触发真实异常兜底路径，不影响通过结果。
