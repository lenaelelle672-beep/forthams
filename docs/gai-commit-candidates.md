# GAI 提交候选清单

## 当前原则

- 不执行 `git add .` 或 `git add -A`。
- 不把 `.gsd/**`、Python benchmark/Sprint4、legacy test 删除与 AMS Java/React 主线混在同一提交。
- `schema.sql` 与 `application.properties` 需要单独确认，避免把 DDL 和运行配置静默混入业务提交。
- 每个候选提交必须有对应验证命令和通过结果。

## 候选 1：AMS 后端 WorkOrder / Retirement 闭环

建议用途：优先形成一个可审计的后端业务闭环提交。

已验证：通过。

验证命令：

```bash
cd backend
mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest test
mvn -q -Dtest=RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test
mvn -q -DskipTests compile
mvn -q test
```

核心候选文件：

| 范围 | 文件 |
| --- | --- |
| WorkOrder | `backend/src/main/java/com/ams/entity/WorkOrder.java` |
| WorkOrder | `backend/src/main/java/com/ams/dto/WorkOrderDTO.java` |
| WorkOrder | `backend/src/main/java/com/ams/service/WorkOrderService.java` |
| WorkOrder | `backend/src/main/java/com/ams/controller/WorkOrderController.java` |
| WorkOrder 测试 | `backend/src/test/java/com/ams/service/WorkOrderServiceTest.java` |
| WorkOrder 测试 | `backend/src/test/java/com/ams/controller/WorkOrderControllerTest.java` |
| Retirement | `backend/src/main/java/com/ams/controller/RetirementController.java` |
| Retirement | `backend/src/main/java/com/ams/dto/RetirementApplyDTO.java` |
| Retirement | `backend/src/main/java/com/ams/entity/RetirementApplication.java` |
| Retirement | `backend/src/main/java/com/ams/mapper/RetirementApplicationMapper.java` |
| Retirement | `backend/src/main/java/com/ams/service/RetirementApplicationService.java` |
| Lifecycle | `backend/src/main/java/com/ams/enums/AssetStatus.java` |
| Lifecycle | `backend/src/main/java/com/ams/service/AssetLifecycleService.java` |
| Approval 联动 | `backend/src/main/java/com/ams/service/ApprovalService.java` |
| Retirement 测试 | `backend/src/test/java/com/ams/controller/RetirementControllerTest.java` |
| Retirement 测试 | `backend/src/test/java/com/ams/service/RetirementApplicationServiceTest.java` |
| Lifecycle 测试 | `backend/src/test/java/com/ams/service/AssetLifecycleServiceTest.java` |
| Approval 测试 | `backend/src/test/java/com/ams/service/ApprovalServiceTest.java` |
| 证据文档 | `docs/testing/workorder-retirement-closure.md` |
| 证据汇总 | `docs/testing/test-coverage-summary.md` |
| 收敛记录 | `docs/gai-worktree-convergence.md` |

进入提交前需确认：

- `schema.sql` 是否一并提交，或拆成 DDL/迁移候选。
- `application.properties` 是否排除，或先脱敏/调整默认值策略。
- `ApprovalService.java` 是否只包含 WorkOrder/Retirement 所需修复，还是混有更大审批域变更。

## 候选 2：AMS 前端与浏览器 E2E

建议用途：在后端闭环稳定后，提交真实 API 接入、页面交互和 E2E 证据。

已验证：前端单测、覆盖率门禁、构建、mock 浏览器冒烟、真实后端 E2E 均通过。

验证命令：

```bash
cd frontend
npm test -- --run
npm run test:coverage -- --run
npm run build
npm run e2e -- --reporter=line
npm run e2e:real -- --reporter=line
```

候选范围：

- `frontend/src/app/pages/**`
- `frontend/src/app/services/**`
- `frontend/src/services/**`
- `frontend/src/api/**`
- `frontend/src/e2e/**`
- `frontend/src/app/context/AuthContext.tsx`
- `frontend/vite.config.ts`
- `docs/testing/browser-smoke-report.md`
- `docs/testing/real-backend-e2e-report.md`
- `docs/testing/module-*.md`

进入提交前需确认：

- 是否把所有页面改造一次提交，还是按模块拆分。
- `frontend/src/app/constants/**` 是否属于状态枚举统一切片。
- 认证闭环修复属于前端/E2E 候选：退出登录改为由 auth state 驱动 `ProtectedRoute` 跳转。
- Playwright 运行产物保持忽略，不纳入提交。

## 候选 3：Tenant / JWT 安全隔离

建议用途：单独提交安全边界，降低审计风险。

已验证：后端全量测试、租户隔离测试、WorkOrder/Approval 租户隔离和主业务租户隔离扩展测试通过。

候选范围：

- `backend/src/main/java/com/ams/context/TenantContext.java`
- `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java`
- `backend/src/main/java/com/ams/utils/JwtUtil.java`
- `backend/src/main/java/com/ams/service/AuthService.java`
- `backend/src/main/java/com/ams/entity/Asset.java`
- `backend/src/main/java/com/ams/service/AssetService.java`
- `backend/src/main/java/com/ams/service/ApprovalService.java`
- `backend/src/main/java/com/ams/service/WorkOrderService.java`
- `backend/src/main/java/com/ams/service/InventoryService.java`
- `backend/src/main/java/com/ams/service/CompensationService.java`
- `backend/src/main/java/com/ams/service/IdleAssetService.java`
- `backend/src/main/java/com/ams/service/MaintenanceService.java`
- `backend/src/main/java/com/ams/service/DashboardService.java`
- `backend/src/test/java/com/ams/tenant/TenantIsolationIntegrationTest.java`
- `backend/src/test/java/com/ams/service/CompensationServiceTest.java`
- `docs/testing/prd-tenant-isolation-coverage.md`

进入提交前需确认：

- 业务表租户隔离是否按当前已扩展范围提交，还是继续升级为全局 MyBatis-Plus tenant interceptor。
- `schema.sql` 中 `tenant_id` DDL 是否归入该切片。

## 暂不纳入 AMS 主线提交

| 范围 | 原因 |
| --- | --- |
| `.gsd/**` | 流程状态产物，是否版本化未确认。 |
| `scripts/**` | Python/分析脚本域，和 AMS Java/React 主线不同。 |
| `src/swarm_003/**` | Python 服务域，和 AMS Java/React 主线不同。 |
| `tests/benchmark/**` | benchmark 域，需单独归因。 |
| `tests/sprint4/**` | Sprint4 静态分析/文档测试域，需单独归因。 |
| `tests/e2e/test_export_ui.py` | Python E2E 域，需单独归因。 |
| `pytest.ini`、`requirements-dev.txt` | Python 测试配置，需单独归因。 |
| `spec.md` | 需求/规格变更，需确认来源。 |

## 需要用户决策

1. 先提交哪个候选：后端闭环、前端/E2E、Tenant/JWT，还是先处理 DDL/config。
2. `schema.sql` 是作为项目事实源提交，还是拆成 migration/测试 bootstrap。
3. `application.properties` 是否允许保留当前默认 fallback，还是先脱敏/改成示例配置。
4. `.gsd/**` 是忽略、归档，还是版本化。
