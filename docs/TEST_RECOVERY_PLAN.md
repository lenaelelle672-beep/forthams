# 测试恢复计划 (P1) — forthAMS backend

> 生成于 2026-06-08。本计划基于对 `src/test/java-excluded` 全部 63 个文件的逐文件诊断
> （3 个并行子代理）+ 导入可解析性预检（脚本验证：63/63 的 `com.ams.*` 导入全部可解析）。

## 0. 现状基线（已核实，纠正旧扫描）

| 指标 | 真实值 | 说明 |
|---|---|---|
| 活跃可编译测试文件 | **8** | 旧扫描"8 文件/86 测试"基本正确；中途"71/596"是误数（`find src/test` 把 java-excluded 也算进去了） |
| `java-excluded` 隔离文件 | **63**（505 个 @Test） | git 历史确认：第 4 轮修复时"移除非编译测试到 java-excluded" |
| Surefire 运行期排除 | `**/controller/**`、`**/integration/**`、`**/tenant/**` | 编译但不运行 |

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

## 6. 构建配置修复（建议独立 PR，需编译器验证）

- 🔴 **JaCoCo 覆盖率当前是静默失效的**：`pom.xml` surefire 用 `<argLine>${surefire.argLine}</argLine>`，但 JaCoCo `prepare-agent` 注入的是 `argLine` 属性。应改为 `<argLine>@{argLine} -Xmx2048m -XX:+UseParallelGC</argLine>`（晚绑定），否则覆盖率报告为空。
- `forkCount=0` + `reuseForks=false`：`reuseForks` 在 `forkCount=0` 下是无效配置。改 `forkCount=1` 可隔离 `@SpringBootTest` 间的静态状态（如 `TenantContext` 泄漏），代价是构建变慢；**必须与上面的 `@{argLine}` 同时改**，否则覆盖率仍坏。
- 解除 3 条 surefire 排除（`controller`/`integration`/`tenant`）应分别在对应 wave 完成、且该波测试编译通过后再做。

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
| 重复清理 | 8 | 待脚本删除 |
| Wave 1 service/enum | 20 | **内容已就绪**，待 `git mv` + 验证 |
| Wave 2 controller | 31 | 已诊断；待去 @Disabled + 2 行修 + 2 重写 + 解除 surefire 排除 |
| Wave 3 集成/重写 | 4 | 已诊断；需逐个重写 |
| 构建配置 | — | JaCoCo/forkCount/surefire，独立 PR |
