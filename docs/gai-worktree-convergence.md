# GAI 工作区分拣与闭环证据

记录日期：2026-04-30

## 1. 当前结论

上一批主体功能可能已经完成：已有记录显示 WorkOrder 与 Retirement 相关链路曾通过后端、前端与 Python 轻量回归验证，并且 `git diff --check` 曾无输出。

但当前闭环仍不 OK，原因不是单个功能点缺失，而是工作区处于不可审计的 dirty tree 状态：

- 同时存在大量已修改文件、未跟踪文件、删除文件与 `.gsd` 运行状态产物。
- 变更横跨后端业务、前端页面/服务、测试、DDL、运行配置、脚本与文档，无法直接判定哪些属于上一批任务、哪些属于用户并行改动。
- `backend/src/main/resources/schema.sql`、`backend/src/main/resources/application.properties`、`.gsd/*`、`tests/test_ac_001.py` 等项目需要单独确认策略后才能闭环。
- 因此，不应直接 `git add .`、不应静默提交 env/secrets/配置/DDL，也不应在未分拣前继续扩大实现范围。

本文件的目标是提供可复用的工作区分拣表与闭环证据格式，用于把“功能可能完成”转换为“可审计、可确认、可提交”的状态。

## 2. 文件分拣类别与建议处置

| 类别 | 当前观察 | 建议处置 | 可推进性 |
| --- | --- | --- | --- |
| WorkOrder | `WorkOrderController`、`WorkOrderService`、`WorkOrderDTO`、`WorkOrder`、相关测试等存在修改/新增。 | 先按 WorkOrder 链路单独复核 DTO 兼容性、状态流转、审批回写与测试覆盖；确认后可作为独立提交候选。 | 需验证 |
| Retirement | `RetirementController`、`RetirementApplication*`、`retirementApi`、`retirementService`、相关测试等存在新增/修改。 | 单独复核申请、审批、资产状态变更、前后端字段一致性；与 DDL 策略解耦后再闭环。 | 需验证 |
| Approval / tenant / JWT | `ApprovalController`、`ApprovalService`、`JwtAuthenticationFilter`、`JwtUtil`、租户隔离测试等存在修改。 | 属于安全与隔离敏感区，需专项审计默认租户、认证失败行为、审批权限边界。 | 需用户确认后验证 |
| 安全 / 配置 / DDL | `.gitignore`、`application.properties`、`application-test.properties`、`schema.sql` 存在修改。 | 不直接提交 secrets/env；DDL 与运行配置必须由用户确认是生产策略、测试 bootstrap，还是需要迁移/回退。 | 不可直接推进 |
| 前端 | 多个页面、store、service、unit test、`vitest.config.ts` 存在修改。 | 按业务域拆分：WorkOrder、Retirement、Approval、Dashboard/Inventory 等；避免把 UI 扩展与后端闭环混合提交。 | 需验证 |
| 测试 | 后端/前端/Python 测试均有修改，且 `tests/test_ac_001.py` 为 deleted。 | 先确认删除是否有意；再运行与分拣类别匹配的最小测试集，记录失败基线。 | 需用户确认 |
| `.gsd` | `.gsd/plans/`、`.gsd/state.json`、`.gsd/wal.jsonl` 未跟踪。 | 视为流程状态产物；是否纳入版本控制、归档或忽略需用户明确，不在实现切片中静默修改。 | 不可直接推进 |
| 未知 / 风险 | `scripts/*`、`src/swarm_003/*`、`spec.md`、benchmark/e2e/sprint4 测试等存在大范围修改。 | 先归因到具体任务或用户改动；无归因前仅保留观察，不 stage。 | 需用户确认 |

## 3. 下一批优化队列（低风险优先）

建议先做“收敛型/证据型”优化，再做功能实现：

1. **工作区分拣确认（最低风险）**：用本文档表格把文件分到 WorkOrder、Retirement、Approval/tenant/JWT、配置/DDL、前端、测试、`.gsd`、未知/风险；仅让用户确认类别和处置策略，不改业务代码。
2. **最小验证基线**：针对用户确认的类别运行轻量命令，例如 `git diff --check`、后端指定测试类、前端指定 unit test；避免长时间全量测试。
3. **DDL / config 决策**：明确 `schema.sql` 与 `application*.properties` 的提交边界；如含 secrets/env 或生产敏感配置，必须排除或脱敏。
4. **legacy test 删除归因**：确认 `tests/test_ac_001.py` 删除是否为用户意图；未确认前不要提交删除。
5. **按域拆分提交候选**：先 WorkOrder 或 Retirement 二选一闭环；每个提交只包含已验证、已归因文件。

推荐下一步先执行第 1 项：只做分拣确认，不继续写业务代码。

## 4. 验证命令与结果

本次文档切片已执行的轻量检查：

| 命令 | 结果 |
| --- | --- |
| `git status --short` | 有大量 modified/deleted/untracked 文件；确认 dirty tree 不可直接审计。 |
| `git diff --stat` | 74 个已跟踪文件存在 diff，约 3596 insertions / 2028 deletions；未跟踪文件另计。 |
| `git diff --check` | 无输出，未发现当前已跟踪 diff 的空白错误。 |

后续按类别闭环时建议补充：

```bash
git status --short
git diff --check
# 后端示例：mvn test -f backend/pom.xml -Dtest=WorkOrderServiceTest,WorkOrderControllerTest
# 前端示例：npm test -- --run frontend/tests/unit/retirementService.test.ts
```

说明：本次未运行长时间全量测试，原因是当前任务为低风险文档收敛，且边界要求保护用户改动、避免扩大影响范围。

## 5. 安全提交规则

- 不要提交 secrets、`.env`、本地凭据、token、私钥或未经脱敏的运行配置。
- 不要盲目执行 `git add .` 或 `git add -A`。
- 不要在未确认前 stage `.gsd/state.json`、`.gsd/wal.jsonl`、`.gsd/plans/`。
- 不要把 DDL、运行配置、业务功能、测试修复、文档收敛混成一个不可审计提交。
- 每个提交候选必须能回答：属于哪个类别、为什么需要、如何验证、是否包含用户并行改动。

## 6. 闭环判定模板

对每一类变更，建议使用以下模板记录证据：

```text
类别：
文件范围：
用户确认：是/否/不需要
风险级别：低/中/高
验证命令：
验证结果：
是否可提交：是/否
阻塞项：
```

只有当“文件范围明确、用户确认完成、验证通过、无 secrets/env/未确认 DDL”同时满足时，才可进入提交阶段。

## 7. 本轮复核补充

本轮在 GAI 清理缓存噪音后复核：

| 检查项 | 结果 | 影响 |
| --- | --- | --- |
| `git status --short -- '*__pycache__*' '*.pyc'` | 无输出 | tracked `.pyc` 工作区噪音已清，不再阻塞分拣。 |
| `git status --short -- '.env*' '*secret*' '*credential*' '*key*'` | 无输出 | 当前状态未暴露明显 env/secret/credential/key 文件变更；提交前仍需按实际 staged 文件复查。 |
| `git status --short` | 仍有大范围 modified/deleted/untracked | dirty tree 未收敛，仍不可整体提交。 |
| `git diff --name-status` | `tests/test_ac_001.py` 仍为 deleted | 删除意图未确认，不能混入业务提交。 |

## 8. 可执行分批提交候选

以下是按当前工作区观察整理的候选切片。它们不是提交指令，只是后续进入实现/提交前的归属边界。

| 候选切片 | 文件范围 | 当前状态 | 阻塞项 | 最小验证 |
| --- | --- | --- | --- | --- |
| WorkOrder 后端闭环 | `WorkOrder.java`、`WorkOrderDTO.java`、`WorkOrderService.java`、`WorkOrderController.java`、`ApprovalService.java`、`WorkOrder*Test.java`、`ApprovalServiceTest.java` | 已有实现与测试通过记录 | 需确认是否允许触碰 protected `WorkOrderDTO.java`；需和 DDL 策略解耦 | `mvn test -f backend/pom.xml -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest` |
| Retirement 后端闭环 | `RetirementController.java`、`RetirementApplication*.java`、`RetirementApplyDTO.java`、`RetirementApplicationMapper.java`、相关测试、前端 retirement API 文件 | 新增/修改较集中 | 依赖 `retirement_application` 表策略；审批结果与资产状态回写需二次审计 | `mvn test -f backend/pom.xml -Dtest=RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest` |
| Asset lifecycle 状态统一 | `AssetStatus.java`、`AssetLifecycleService.java`、`DisposalService.java`、`AssetService.java`、`DashboardService.java`、`AssetLifecycleServiceTest.java`、前端 `assetStatus.ts` / 资产台账展示 | 业务价值明确 | 需确认状态枚举 canonical 值与前端/历史数据兼容策略 | `mvn test -f backend/pom.xml -Dtest=AssetStatusTest,AssetLifecycleServiceTest` + `npm test -- --run` |
| Tenant/JWT 安全审计 | `JwtAuthenticationFilter.java`、`JwtUtil.java`、`Asset.java`、`AssetService.java`、`TenantIsolationIntegrationTest.java` | 当前仅资产域手动隔离 | 默认 `tenant_id=default`、无用户-租户绑定、无全局 tenant interceptor、测试描述与实现不完全一致 | `mvn test -f backend/pom.xml -Dtest=TenantIsolationIntegrationTest` |
| Frontend enterprise pages | `frontend/src/app/pages/*`、`frontend/src/app/services/*`、`frontend/src/app/components/*`、相关 unit tests | 大范围 UI/API 收敛 | 需拆 WorkOrder/Retirement/Inventory/Dashboard，避免一次提交太大 | `npm test -- --run` + `npm run build` |
| Python Sprint4 / benchmark | `scripts/*`、`tests/sprint4/*`、`tests/benchmark/*`、`src/swarm_003/*` | 与 Java/React 主线不同域 | 需确认是否属于上一批还是并行 Python 任务 | `pytest -q` |
| GSD 状态产物 | `.gsd/state.json`、`.gsd/wal.jsonl`、`.gsd/plans/` | 未跟踪 | 需确认纳管、归档还是 ignore | 无；这是流程策略决策 |
| Legacy Django test 删除 | `tests/test_ac_001.py` | deleted | 需确认恢复、归档还是保留删除 | 若恢复，需另建 legacy 测试策略；当前 `pytest.ini` 不收集 |

## 9. 必须先确认的决策

1. DDL 策略：`schema.sql` 是否作为本地/测试 bootstrap 事实源提交；若不能改 DDL，需要迁移到测试专用 SQL 或回退这部分 diff。
2. `.gsd` 策略：`.gsd/state.json`、`.gsd/wal.jsonl`、`.gsd/plans/` 是否版本化；若不版本化，应单独加入 ignore 或清理工作区。
3. `tests/test_ac_001.py`：确认删除是否有意；未确认前不应 stage 删除。
4. WorkOrderDTO protected 文件：确认当前字段扩展与构造器恢复是否满足 protected-file 例外条件。
5. 租户隔离范围：当前只覆盖 Asset 域；是否扩展到 WorkOrder、Retirement、Approval、Inventory 等全业务表。

## 10. 推荐下一步

先选择一个可审计、可验证的小切片推进：

1. 若目标是尽快形成可提交业务闭环：优先 WorkOrder 后端闭环。
2. 若目标是降低生产风险：优先 DDL/config 策略决策。
3. 若目标是安全性：优先 Tenant/JWT 安全审计。

不建议的下一步：直接 `git add .`、把 `.gsd` 状态、DDL、前端大页面、Python benchmark 和业务代码混在同一提交候选里。

## 11. WorkOrder / Retirement 后端闭环结果

本轮已对两个高价值后端切片执行闭环验证，结果如下：

| 切片 | 验证命令 | 结果 | 证据文档 |
| --- | --- | --- | --- |
| WorkOrder 后端闭环 | `cd backend && mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest test` | 通过 | `docs/testing/workorder-retirement-closure.md` |
| Retirement 后端闭环 | `cd backend && mvn -q -Dtest=RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test` | 通过 | `docs/testing/workorder-retirement-closure.md` |
| 后端编译基线 | `cd backend && mvn -q -DskipTests compile` | 通过 | `docs/testing/workorder-retirement-closure.md` |
| 后端全量测试基线 | `cd backend && mvn -q test` | 通过 | `docs/testing/workorder-retirement-closure.md` |

当前结论：WorkOrder 与 Retirement 可以作为后续“可提交候选”继续分拣，但仍不应直接提交整个工作区。进入提交前仍需确认 DDL/config、`.gsd`、Python benchmark/Sprint4、legacy test 删除等非 AMS 主线内容的处置策略。

## 12. 最新验证补充

记录日期：2026-05-01

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| 后端全量测试 | `cd backend && mvn test` | 89 个测试通过 |
| 前端单元测试 | `cd frontend && npm run test -- --run` | 14 个测试文件，634 个测试通过 |
| 前端覆盖率门禁 | `cd frontend && npm run test:coverage -- --run` | 14 个测试文件，634 个测试通过，行覆盖率 100% |
| 前端构建 | `cd frontend && npm run build` | 通过 |
| Mock 浏览器 E2E | `cd frontend && npm run e2e -- --reporter=line` | 14 个测试通过 |
| 真实后端 E2E | `cd frontend && npm run e2e:real -- --reporter=line` | 2 个测试通过 |
| 空白错误检查 | `git diff --check` | 无输出 |

本轮认证闭环测试发现并修复了退出登录问题：点击退出后 URL 已变为 `/login`，但受保护布局仍停留在页面上。修复方式为移除 `AuthContext#logout` 内的直接 `redirectToLogin()`，让 auth state 清空后由 `ProtectedRoute` 统一执行 `<Navigate to="/login">`。

当前新增判断：`frontend/src/router/index.ts` 中的占位 `PermissionGuard` 属于未被当前入口使用的旧路由树；当前入口为 `frontend/src/main.tsx -> frontend/src/app/App.tsx -> frontend/src/app/routes.ts`。因此该占位不是当前运行时权限保护路径，不应在本轮扩大修改。

仍需确认的提交前阻塞项不变：DDL/config 生产策略、`.gsd` 是否纳管、Python/Sprint4/benchmark 变更归属、legacy 测试删除意图，以及是否将多租户隔离继续升级为全局 MyBatis-Plus tenant interceptor。
