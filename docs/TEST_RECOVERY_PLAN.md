# 测试恢复计划 (P1) — forthAMS backend

> 生成于 2026-06-08。本计划基于对 `src/test/java-excluded` 全部 63 个文件的逐文件诊断
> （3 个并行子代理）+ 导入可解析性预检（脚本验证：63/63 的 `com.ams.*` 导入全部可解析）。

## 0. 现状基线（已核实，纠正旧扫描）

| 指标 | 真实值 | 说明 |
|---|---|---|
| 活跃可编译测试文件 | **8** | 旧扫描"8 文件/86 测试"基本正确；中途"71/596"是误数（`find src/test` 把 java-excluded 也算进去了） |
| `java-excluded` 隔离文件 | **63**（505 个 @Test） | git 历史确认：第 4 轮修复时"移除非编译测试到 java-excluded" |
| Surefire 运行期排除 | `**/integration/**`、`**/tenant/**` | controller 测试已恢复运行；integration/tenant 仍按波次隔离 |

**关键发现**：63 个隔离文件中绝大多数被打了**过时的 `@Disabled` 标签**（"依赖已删除类"），但被引用的类**全部仍然存在**——导入预检 63/63 通过。所以多数是"假性不可编译"，实际是轻量恢复。

## 1. 执行约束（务必先读）

- **本机沙箱无 JDK/Maven**：无法编译/跑测试。所有"可编译/通过"的判断来自导入解析 + 签名交叉比对，**未经编译器验证**。
- **沙箱无法删除/移动文件**（`rm`/`mv` 报 Operation not permitted），且 `.git/index.lock` 被占用。因此**文件搬迁与删除必须在你本地环境执行**（见 `scripts/recover-tests-wave1.sh`）。
- 沙箱**可以修改文件内容**——所以 Wave 1 的内容修复已经**就地完成**（见下）。
- ⚠️ Java 测试编译是**全有或全无**：任何一个文件编译失败会导致整个测试套件不编译。因此按波次推进、每波后用编译器验证，是刻意的风险控制。

## 2. 本次已完成（内容已落盘，未搬迁）

Wave 1 的 20 个 service/enum 测试已就地修正于 `java-excluded`，**只差搬迁**：

- 去除过时 `@Disabled`（6 个）：`ABCClassificationServiceTest`、`ApprovalServiceTest`、`EnergyServiceTest`、`TenantServiceTest`、`WorkOrderServiceTest`、`BusinessCommentServiceImplTest`
- 补全缺失 `@Mock`（4 个，修运行期 NPE）：
  - `AssetServiceTest` → +`AssetParentChildService`、+`ABCClassificationService`
  - `RetirementApplicationServiceTest` → +`ApprovalRecordMapper`、+`AssetChangeLogMapper`、+`NotificationService`（含 2 个 import）
  - `WorkOrderServiceTest` → +`SlaService`
  - `BusinessCommentServiceImplTest` → +`BusinessCommentLikeRecordMapper`（含 import）
- 无需改动、可直接搬迁（11 个）：`AssetCategoryServiceTest`、`AssetLifecycleServiceTest`、`AuthServiceTest`、`CompensationServiceTest`、`DashboardServiceTest`、`DisposalServiceTest`、`GraphifyServiceTest`、`IdleAssetServiceTest`、`IntakeOrderServiceTest`、`MaintenanceExecutionServiceTest`、`UserManagementServiceTest`
- 纯枚举测试（无 Spring，直接搬迁）：`AssetStatusTest`

> 这些 20 个文件**不在** controller/integration/tenant 包下，搬到 `src/test/java` 后 Surefire 不会排除，**会真正运行**。

## 3. Wave 1 — service/enum（20 个，已就绪）

执行：`scripts/recover-tests-wave1.sh`（删 8 个重复 + `git mv` 20 个 + 提示验证）。
验证：
```bash
cd backend
mvn -q test-compile
mvn -q -Dtest='*ServiceTest,AssetStatusTest' test
```
预期：20 个全部编译；绝大多数通过。若个别红，按编译器/失败信息微调（这正是先验证 Wave 1、再放量到 controller 的目的）。

## 4. Wave 2 — controller（31 个）

**先决条件**：移除 `pom.xml` 中 surefire 的 `<exclude>**/controller/**/*Test.java</exclude>`（否则搬过去也不运行）。

- **27 个 EASY**（仅去 `@Disabled` 或直接搬迁，引用类均存在）：`ApprovalControllerTest`、`AssetCategoryControllerTest`、`AssetControllerTest`、`AuditDashboardControllerTest`、`AuthControllerTest`、`BigScreenControllerTest`、`BusinessCommentControllerTest`、`CompensationControllerTest`、`DashboardControllerTest`、`DepreciationControllerTest`、`DeptControllerTest`、`DisposalControllerTest`、`EnergyControllerTest`、`FloorPlanControllerTest`、`IdleAssetControllerTest`、`LocationControllerTest`、`MaintenanceControllerTest`、`MaintenanceExecutionControllerTest`、`NotificationPreferenceControllerTest`、`ReportControllerTest`、`RetirementControllerTest`、`RoleControllerTest`、`StatsControllerTest`、`SystemHealthControllerTest`、`UserManagementControllerTest`、`VendorControllerTest`、`WorkOrderControllerTest`
- **2 个一行修复**：
  - `InventoryControllerTest` → `shouldSubmitInventoryTask` 把 mock 由 `updateTaskStatus(7L,"SUBMITTED")` 改为 `submitTask(7L)`
  - `NotificationControllerTest` → 断言 `$.data.records[0].isRead` 的 `.value(false)` 改为 `.value(0)`（字段是 Integer）
- **2 个需重写**：
  - `SafetyChecklistControllerTest` → `@WebMvcTest` 改为 `@SpringBootTest` + `@AutoConfigureMockMvc(addFilters=false)`，去掉 `csrf()`（与其余测试一致，否则 `@ss` 安全 bean 不加载）
  - `UserSearchControllerTest` → 控制器已做多租户重构：需 mock `AssetService`、在 `@BeforeEach` 设置 `TenantContext`、并把 verify 改为 `searchUsersByDepts`

## 5. Wave 3 — 集成/重写（4 个）

- `CycleCountServiceTest` → 重写：误用 `@SpringBootTest` + `@Mock` 缺 `@ExtendWith(MockitoExtension.class)`；断言全是纯 POJO 逻辑，建议降级为纯单测或删除
- `SafetyChecklistServiceTest` → 补 `@Mock TenantService`；把 `mockStatic(TenantContext)` 从 `@BeforeEach` 移入每个 `@Test`（现在 try-with-resources 在测试运行前已关闭）
- `CommentIntegrationTest` → 编译干净；需同时移除 surefire `**/integration/**` 排除；`@BeforeAll` 用 H2 建表，注意共享内存库隔离
- `TenantIsolationIntegrationTest` → **保留 `@Disabled`**；先查 git 历史确认第 4 轮删了什么类，再决定恢复

## 6. 构建配置修复（已落地，覆盖率报告已验证）

- `pom.xml` 已改为 `<argLine>@{argLine} ${surefire.argLine}</argLine>`，恢复 JaCoCo `prepare-agent` 晚绑定入口。
- 2026-06-09 已验证 JaCoCo 输出非空：`backend/target/jacoco.exec` 为 36,510,464 bytes，`backend/target/site/jacoco/jacoco.xml` 为 1,698,282 bytes，且 XML 顶层存在 `INSTRUCTION`、`BRANCH`、`LINE` 等 counter。
- `forkCount=1` + `reuseForks=true` 已落地，用于隔离 `@SpringBootTest` 间的静态状态（如 `TenantContext` 泄漏）。
- `controller` surefire 排除已解除；`integration`、`tenant` 仍按波次保留排除，需分别完成重写/隔离验证后再解除。

## 7. 已删除的 8 个重复/被取代副本

字节相同（已有活跃副本）：`JwtUtilTest`、`SchemaCoverageTest`、`DoubleDecliningBalanceDepreciationTest`、`FloorPlanServiceTest`、`LocationServiceTest`、`NotificationServiceTest`。
被活跃版取代（excluded 副本是旧的错误版）：`WorkflowDefinitionControllerTest`、`WorkflowDefinitionServiceTest`。

## 8. 验证回路（每波必跑）

```bash
cd backend
mvn -q test-compile          # 全有或全无：先确保编译
mvn -q test                  # 跑全部启用的测试
# 定位单波： mvn -q -Dtest='*ControllerTest' test
```

## 9. 进度总览

| 波次 | 文件数 | 状态 |
|---|---|---|
| 重复清理 | 8 | 已处理（当前全量测试可编译运行） |
| Wave 1 service/enum | 20 | 已恢复并通过后端全量测试 |
| Wave 2 controller | 31 | 已恢复并通过后端全量测试 |
| Wave 3 集成/重写 | 4 | 集成/tenant 仍按 surefire 排除策略保留，未作为本轮全量启用范围 |
| 测试环境降噪 | — | 已配置 `ams.scheduling.enabled=false`、`ams.oper-log.enabled=false`；已清理 `FaultCodeMapper.countChildren` 重复映射 |
| 构建配置 | — | forkCount/argLine 已调整；JaCoCo 报告内容已验证非空 |

## 10. 2026-06-09 最新验证记录

- 前端全量测试：`89` 个测试文件，`883` 个测试全部通过。
- 前端构建：`npm run build` 通过，仅剩 chunk 体积 warning。
- 后端全量测试：`mvn test` 通过，`662` 个测试通过，0 failure/error/skip。
- 后端 D 批次 targeted gate 通过，覆盖资产导入、盘点、审批、通知事件与 ABC 分类，`82` 个测试通过。
- 前端 E 批次 targeted gate 通过，覆盖 API wrapper、报表、全局搜索、评论用户提及、折旧卡片、故障码选择器、工单验收与表单 mapper，`35` 个文件、`92` 个测试通过。
- workflow 保存链路已补充认证兼容测试、前端 API 契约测试、真实后端 E2E 保存草稿断言和旧库 `workflow_definition` patch-forward 迁移。
- 检验/年检自动生成入口已补齐类别分支：`autoGenerateInspections` 传 `assetCategoryId` 时会复用已存在的按类别批量生成逻辑，新增 targeted 单测覆盖。
- 检验模板复制闭环已补齐：后端新增 `/inspection-templates/{id}/copy` 与 service 复制逻辑，桌面模板页新增复制按钮，新增 service targeted 单测覆盖。
- 检验模板备用列表页已清除“复制功能开发中”占位，复用真实 `inspectionTemplateApi.copy` 并刷新列表。
- 审批通知待办已从占位 service 收敛为真实 `sys_todo` 持久化：补齐创建、分页、未读数、已读、完成、转交、按引用完成逻辑，并新增 `sys_todo` fresh install/schema 与迁移脚本。
- 资产借用到期提醒已接入站内通知：`checkOverdue` 标记 `OVERDUE` 后给借用人创建 `ASSET_BORROW` 通知，通知失败不回滚逾期状态。
- 检验任务即将到期提醒已接入站内通知：`remindExpiringTasks` 针对 `assignedTo` 创建 `INSPECTION_TASK` 通知，通知失败不阻断租户调度。
- 工单挂起/恢复审计操作者已从占位 `0L` 收敛为按当前登录用户名反查启用 `sys_user.id`，用于写入 `heldBy` / `resumedBy`，查不到用户时仍安全兜底 `0L`。
- 安全检查表照片上传已真实落盘到 `file.upload-dir`，附件路径写入 `/api/file/{filename}`；删除附件时同步清理物理文件，执行记录级联删除不再遗留照片文件。
- 桌面浏览器回归：`npm run e2e:browser-regression` 当前真实执行通过，`26 passed (36.3s)`；workflow 专项覆盖 `/workflows` 保存失败提示、新建模板流程保存草稿后进入设计器、列表只读权限、设计器直达只读且不保存。旧 `11/11` 为历史批次记录。
- 流程定义后端覆盖：`WorkflowDefinitionServiceTest` 当前 19 个测试，`WorkflowDefinitionControllerTest` 当前 7 个测试；发布流程由后端 service/controller 覆盖，真实后端浏览器 E2E 当前只断言保存草稿。
- 部署配置静态/CI 门禁已新增并更新：`DeploymentConfigConsistencyTest` 4 个测试通过，锁定根单容器 Nginx+Spring Boot 拓扑、分体前端 Nginx 反代、健康检查、SPA fallback、compose 端口、MySQL schema 初始化挂载、compose MySQL 应用用户创建，以及 GitHub Actions 的 Docker config/build/runtime smoke 命令；原生 `docker`/`nginx` 命令仍需在具备运行时的机器或 GitHub Actions 上补真实启动与 smoke 结果。
- CI/local gate 已补强：`scripts/ci-gate.sh` 串联 TypeScript、前端单测、浏览器回归 smoke 执行、后端部署/工作流 targeted gate、后端全量与工作树状态；`env SKIP_BUILD=1 ./scripts/ci-gate.sh` 已通过，`6 passed, 0 failed, 190s`。
- GitHub Actions 已补强：`.github/workflows/ci.yml` 把 Dockerfile、compose、`docker/**`、`scripts/**` 纳入触发路径，并新增 Playwright browser 安装、browser regression smoke 执行、后端部署/工作流 targeted gate，以及独立 `docker-config-build` job（`docker compose config --quiet`、`docker compose build backend frontend`、分体容器 runtime smoke、`docker build -t forthams-single:ci .`、单容器 runtime smoke）。
- 浏览器回归从清单升级为真实 smoke：`npm run e2e:browser-regression` 已通过，`26 passed (36.2s)`；本轮真实执行先发现 `/inventory` 标题选择器非精确匹配，已用 `exact: true` 最小修复。
- GAI2 子 agent 路由已按 Pro 策略更新并恢复受控编排：后续默认 `gpt-5.5`，存在性确认/汇总用 `low` 推理，旁路审计用 `medium`，高风险迁移/权限/安全复核用 `high/xhigh`；已补回原 Opencode GAI2 角色层，`gai2-orchestrator` 作为 Medium+ 必经调度器，`gai2-triage/audit/debate/drafter/refiner/builder/reviewer` 作为阶段/专家角色生效。专家子 agent 先映射到 S0-S4 档位，再套用该模型/推理配置。主线程 manager 可自主调度并行/串行子 agent，但按并发阈值、写权限隔离、模型路由和完成后关闭策略执行。本轮 Sagan、Turing、Fermat、Goodall 均为历史只读旁路审计，完成后关闭。
- JaCoCo 报告已验证生成：`backend/target/jacoco.exec`、`backend/target/site/jacoco/index.html`、`backend/target/site/jacoco/jacoco.xml` 均存在且 XML counter 非空。
- 当前剩余日志主要来自测试刻意触发的业务异常路径，不再是定时任务或操作日志切面对测试库的副作用。
- GAI2 拆批提交补充记录：已提交 `4178cb375 fix: harden backend runtime operations`、`2e688c6b4 fix: align desktop frontend api contracts`、`eb84fd139 fix: repair production web container routing`、`928d93505 fix: align split docker deployment checks`、`743c32f7f fix: make database bootstrap explicit`、`b7b523560 fix: preserve asset export category filter`、`b607c2b6c fix: normalize asset attachment preview urls`、`9d5f936c3 fix: align webhook config permissions`、`0e8cf71f9 fix: parse escaped asset import csv` 等批次。
- 最新 GitNexus `detect_changes(scope=all)` 已降为 `low`、`affected_count=0`；剩余可见工作树主要是移动端冻结文件、移动入口路由和 tracked `.DS_Store` 元数据改动。
- 仍未达到 100 分的外部阻断：当前机器无原生 `docker` 与 `nginx` 命令，不能补本机真实容器启动、Nginx 配置加载和 `/api/health`/SPA fallback smoke；CI 已新增真实镜像构建与运行态 smoke 门禁，但还需要 GitHub Actions 或具备 Docker/Nginx 的机器产出一次实际运行结果。`.DS_Store` 的 tracked 清理需要用户明确确认；移动端按用户要求暂不继续。
