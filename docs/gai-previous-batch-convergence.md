# GAI 上一批任务收敛清单

记录时间：2026-04-30

## 已完成

- 已从 HEAD 恢复审计基线文件：`.gsd/context/architecture.md`、`.gsd/context/protected-files.md`。
- 已检查 `.gitignore` 的 Python 缓存规则；现包含 `__pycache__/`、`*.pyc`、`*.py[cod]`、`.pytest_cache/`。
- 已定位 `WorkOrderDTO.java` 实际路径：`backend/src/main/java/com/ams/dto/WorkOrderDTO.java`。
- 已收集 pyc 噪音现状：当前可见 pyc 变更均为 tracked/modified，未做删除以避免破坏历史跟踪状态。

## 未完成

- 未执行业务测试或构建；本切片仅做审计基线恢复、仓库卫生记录和风险清单收敛。
- 未处理大量既有业务改动、未跟踪新文件、schema/application 配置变更。
- 未恢复或改动 `tests/test_ac_001.py` 的 deleted 状态；该项需要单独确认是否为用户业务意图。

## 假闭环

- 多处前后端与测试文件存在大范围未提交修改，仅凭当前状态不能判定上一批任务真正完成。
- WorkOrder 相关改动涉及 DTO、Controller、Service、Entity、schema 和测试，但尚未在本切片验证端到端一致性。
- pyc 已被 ignore 规则覆盖，但仓库中仍存在 tracked pyc；仅添加 ignore 不能自动解除已跟踪文件。

## 高风险待修

- `backend/src/main/java/com/ams/dto/WorkOrderDTO.java` 属于受保护/核心工单 DTO 风险点；当前 diff 扩展字段并移除 `(Long id, String status)` 构造器，可能影响调用方兼容性。本切片未扩大该修改。
- `backend/src/main/resources/schema.sql`、`application.properties` 存在修改，涉及数据结构/运行配置风险；按约束未做迁移或认证链路重构。
- `JwtAuthenticationFilter`、`JwtUtil`、`AssetService` 等存在租户/认证相关改动，需后续单独审计。
- tracked pyc 文件处于 modified 状态，应通过独立仓库卫生切片评估是否 `git rm --cached`，避免本切片混入删除噪音。

## 无关变更

- 根目录存在运行产物、缓存、临时目录和历史规格文件；本切片未清理以避免误删用户资料。
- `.gsd/plans/`、`.gsd/state.json`、`.gsd/wal.jsonl` 为未跟踪 GSD 状态产物，需确认是否应纳入版本控制或加入忽略规则。
- 前端页面、服务、单测和后端新增 controller/service/entity/test 文件均非本切片范围。

## 下一切片建议

1. 审计 WorkOrder 变更链：DTO/Entity/Service/Controller/schema/tests，先判定兼容性风险，再做最小修复。
2. 单独处理 tracked pyc：列清单、确认历史原因，再决定是否 `git rm --cached` 并保留 ignore 规则。
3. 审计认证/租户相关改动：避免默认 tenant、请求过滤和 TenantContext 引入造成隔离绕过。
4. 对 `tests/test_ac_001.py` deleted 状态做归因，确认是否恢复或归档。
5. 在业务修复切片前先跑最小相关测试集，并记录失败基线。

## 本轮补充收敛

- 已审计并收敛 WorkOrder 链路：`submitWorkOrder` 现在会创建/更新 `WORK_ORDER` 待审批流程，通用 `ApprovalService.approve` 对 `WORK_ORDER` 按单步审批完成并回写工单状态。
- 已恢复 `WorkOrderDTO(Long id, String status)` 构造器，降低历史调用方兼容风险。
- 已新增/更新 WorkOrder/Approval 单元测试，覆盖工单提交生成审批流程与审批回写工单。
- 已确认 `.pyc` 为历史 tracked 文件污染；当前仍不做 `git rm --cached`，需独立仓库卫生切片处理。
- 已确认 `tests/test_ac_001.py` 在 HEAD 中存在且当前为 deleted；文件内容为旧 Django 多租户测试，当前 `pytest.ini` 未收集，仍需确认删除是否有意。

## 本轮测试基线

- `mvn test -f backend/pom.xml`：65 passed。
- `npm test -- --run`：14 files / 634 passed。
- `npm run build`：通过，仅 Vite chunk size warning。
- `pytest -q`：83 passed。
- `git diff --check`：无输出。

## Execute 收敛复核（2026-04-30）

### 上一批范围识别

- `.gsd/state.json` 与 `.gsd/plans/forthAMS-P0-backend/iteration-0-builder-plan.json` 指向上一批 `forthAMS-P0-backend`：WorkOrder 字段/list 查询补全、Retirement 后端接口/实体/服务补全。
- 当前 dirty tree 还包含审计/租户/审批/前端页面/Python 静态分析等大量变更；本次 Execute 不扩展新功能，仅复核并记录收敛状态。

### 阻塞项处理状态

- `.gsd` 状态未闭环：`iteration-0-state.json` 中 `epoch`、`test_writer`、`builder` 仍为 running，`builder_result` 为 failed（max turns reached or loop interrupted）。该状态是否应修正/纳入版本控制需要用户确认。
- tracked `.pyc` 污染仍存在：`scripts/__pycache__/*`、`tests/**/__pycache__/*` 为已跟踪文件的 modified 状态；已由 `.gitignore` 覆盖未来缓存，但是否 `git rm --cached` 需要独立仓库卫生决策。
- `tests/test_ac_001.py` 当前为 deleted；该文件不在当前 `pytest.ini` 收集路径内，但删除是否为业务意图仍需用户确认。
- `schema.sql` / `application.properties` 已修改，涉及 DDL/运行配置；若存在“禁止 DDL”或迁移策略约束，需要用户明确采用 schema.sql、迁移脚本还是仅测试内建表。
- 前端仍可见 mock/权限占位：例如 `frontend/src/router/index.ts` 的 `PermissionGuard` TODO、`frontend/src/mocks/inventoryHandlers.ts` MSW mock、`AssetTransferForm.tsx` mock applicant。未在本次切片中实现替换。

### 本次验证证据

- `mvn test`（backend）：BUILD SUCCESS，65 tests passed。
- `npm test -- --run`（frontend）：14 files / 634 tests passed。
- `pytest -q`（repo root）：83 passed。
- `git diff --check`：无输出。

### 结论

- 上一批核心 WorkOrder/Retirement 收敛具备回归测试通过证据。
- 但仓库状态、`.gsd` 状态、tracked pyc、`tests/test_ac_001.py` 删除意图、DDL/config 策略仍未关闭；因此不建议开始下一批“实现型”优化。
- 可以进入下一批“调研型”优化候选梳理，但应先由用户确认上述阻塞项处置策略，再转入代码实施。

### 下一批优化候选（仅调研，不实施）

1. 仓库卫生与状态闭环：`.gsd` 纳管策略、tracked pyc 清理、deleted legacy test 归因。
2. 数据库变更策略：明确 schema.sql、迁移脚本、测试 schema 的边界与生产 DDL 禁区。
3. 认证/租户隔离复核：`JwtAuthenticationFilter`、`JwtUtil`、`TenantContext` 默认值与测试覆盖。
4. 前端权限与 mock 去占位：路由权限守卫、MSW mock 与真实 API 的切换策略。

## Execute previous-batch convergence 复核补充（2026-04-30 晚）

- 已将当前可见的 tracked `.pyc` 工作区修改恢复到 HEAD，仅清除生成物噪音；未执行 `git rm --cached`，因此未改变历史跟踪关系。
- `git status --short -- '*__pycache__*' '*.pyc'`：无输出，当前工作树不再保留可见 `.pyc` / `__pycache__` meaningful 变更。
- `mvn test -f backend/pom.xml`：BUILD SUCCESS，65 tests passed；覆盖 `WorkOrderControllerTest`、`WorkOrderServiceTest`、`RetirementControllerTest`、`RetirementApplicationServiceTest` 等后端相关测试。
- `git diff --check`：无输出。
- `schema.sql` 仍含 `work_order`、`retirement_application` 建表和 `asset.tenant_id` DDL diff；这与 `spec.md` 的“禁止修改数据库 DDL”约束冲突，未静默视为 OK，需用户确认保留 schema bootstrap、迁移到测试专用 SQL，或回退 DDL。
- `tests/test_ac_001.py` 仍为 deleted；证据显示 HEAD 中存在且内容为旧 Django 多租户测试，当前未发现删除为 accidental 的直接证据，故未恢复。
- `.gsd/state.json`、`.gsd/wal.jsonl`、`.gsd/plans/` 仍未跟踪；因疑似工具运行状态产物/可能受流程保护，本次未纳入或删除。
