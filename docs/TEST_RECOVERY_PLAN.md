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

## 6. 构建配置修复（已部分落地，需继续验证覆盖率报告）

- `pom.xml` 已改为 `<argLine>@{argLine} ${surefire.argLine}</argLine>`，恢复 JaCoCo `prepare-agent` 晚绑定入口；仍需后续显式跑覆盖率报告确认生成内容非空。
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
| 构建配置 | — | forkCount/argLine 已调整；JaCoCo 报告内容仍需单独验证 |

## 10. 2026-06-09 最新验证记录

- 前端全量测试：`83` 个测试文件，`857` 个测试全部通过。
- 前端构建：`npm run build` 通过，仅剩 chunk 体积 warning。
- 后端全量测试：`mvn test` 通过，`571` 个测试通过，0 failure/error/skip。
- 后端 D 批次 targeted gate 通过，覆盖资产导入、盘点、审批、通知事件与 ABC 分类，`82` 个测试通过。
- 前端 E 批次 targeted gate 通过，覆盖 API wrapper、报表、全局搜索、评论用户提及、折旧卡片、故障码选择器、工单验收与表单 mapper，`35` 个文件、`92` 个测试通过。
- workflow 保存链路已补充认证兼容测试和前端 API 契约测试。
- 当前剩余日志主要来自测试刻意触发的业务异常路径，不再是定时任务或操作日志切面对测试库的副作用。
- GAI2 拆批提交补充记录：已提交 `4178cb375 fix: harden backend runtime operations` 与 `2e688c6b4 fix: align desktop frontend api contracts`；最新 GitNexus `detect_changes(scope=all)` 已降为 `low`，`changed_count=39`、`affected_count=0`、`changed_files=9`。剩余改动主要是移动端冻结文件、路由中的移动入口、仓库元文件与交接记录。
