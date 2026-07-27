# forthAMS Workbench V3 无人值守推进指令

> 版本日期：2026-07-02  
> 文档角色：GAI2 GOAL 长任务执行指令。  
> 使用方式：让执行 agent 先读取本文，再进入 `/gai2:goal` 或 goal runner 持续推进。  
> 真实性红线：本文是执行指令，不等于功能已完成；任何“已完成”“已通过”“已实现”都必须由代码、测试、构建或审计证据证明。

## 1. 启动指令

把下面这段作为任务入口：

```text
/gai2:goal 请读取 docs/specs/future-settings-os-v3-unattended-goal-directive.md，并严格按其中的无人值守执行指令推进 forthAMS Workbench V3 / Future Settings OS P0 实现。
```

如需外部 runner 持续续跑：

```sh
python ~/.config/opencode/skills/gai2/scripts/goal_runner.py \
  --project-root /Users/feigao/project/Project/forthAMS
```

## 2. 总目标

进入长任务无人值守模式，持续推进 forthAMS Workbench V3 / Future Settings OS 的 P0 实现，使当前代码与已裁决的 V3 PRD、IA、后端设计、前端架构选型、style guide 和 implementation directive 对齐。

本任务不是只分析，不是只给计划，也不是只输出建议。审计完成后必须选择最小正确切片进入实现，并持续循环：审计、缺口、选切片、impact、测试、实现、验证、review、下一切片。

## 3. 停止规则

除非遇到硬阻塞，否则不要停止在分析、计划或建议。

硬阻塞只包括：

- 缺少必须由用户裁决的业务决策。
- 关键文档或关键文件不存在，且无法从现有事实安全推断。
- 测试或构建环境不可用，且无法用更小验证替代。
- 当前改动会和用户已有改动直接冲突。
- 需要执行破坏性操作或需要用户授权的外部操作。
- 同一失败指纹在多轮修复后无进展。

不算硬阻塞的情况：

- 实现方案选择。
- 文件位置选择。
- 测试方式选择。
- 缺口优先级排序。
- 是否继续下一切片。

这些情况必须基于 V3 文档、当前代码模式和验证成本自行裁决。

## 4. 必读事实源

开始实现前必须读取并使用这些文档：

1. `docs/specs/future-settings-os-v3-implementation-directive.md`
2. `docs/specs/future-settings-os-v3-expanded-prd.md`
3. `docs/specs/future-settings-os-v3-backend-design.md`
4. `docs/specs/future-settings-os-v3-backend-architecture.md`
5. `docs/specs/future-settings-os-v3-frontend-architecture-selection.md`
6. `docs/workbench-v3-style-guide.md`
7. `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md`
8. `docs/specs/future-settings-os-v3-prd-comparison-score.md`
9. `docs/specs/future-settings-os-v3-process-platform-reference.md`
10. `docs/specs/future-settings-os-v3-workflow-engine-decision.md`

如果某个文档缺失，不得伪造已读结论。记录缺失状态，并从仍存在的事实源继续推进可安全执行的切片。

## 5. 固定架构底座

前端技术架构默认以 V3 最终选型为底座：V3 增强型 React/Vite 后台操作系统架构。

执行要求：

- 不要从零重选 Next.js、TanStack、微前端、SvelteKit、Astro 或 Qwik。
- 新需求先映射到现有底座能力：`SystemPageHost`、registry、route/menu contract、Inspector、URL state、data contract、permission/safety/test registry。
- 底座不足时优先增强底座，而不是替换底座。
- 只有替代方案在适配度上明显更优时，才允许挑战底座。
- 最优方案按“最适合”裁决，不按“最简单”裁决。
- 实现难度只能作为交付风险记录，不能替代适配度、长期治理能力、IA 承载力、权限安全、交互复杂度和可验证性裁决。

## 6. 禁止范围

执行期间必须遵守：

- 不修改 `frontend/src/pages/mobile/**`。
- 不复制、暴露、记录 secrets、token、password、API key。
- 不执行 `git reset --hard`、`git checkout --` 等破坏性操作。
- 不提交 commit，除非用户明确要求。
- 不为了顺手优化重构无关代码。
- 不把 demo、HTML、Stitch、截图当作正式实现完成证据。
- 不把当前 registry 覆盖范围当作最终 IA 范围。
- 不随意扩大权限范围。
- 不改无关旧页面，除非 implementation directive 明确允许。
- 不回滚或覆盖用户已有改动。

## 7. 无人值守执行流程

### 阶段一：事实审计

先审计当前状态，不直接写代码。

必须审计：

- V3 路由入口是否存在。
- `SystemPageHost` 是否存在，职责和输入输出是什么。
- `systemRealPageRegistry`、`systemModuleRegistry`、`settingsOsRegistry` 等 registry 当前覆盖哪些页面。
- 已有真页面、占位页、mock HTML、workspace preview、workbench-v3 页面分别在哪里。
- 当前权限、菜单、`routePermissions`、i18n、API contract 是否覆盖 P0。
- 当前测试有哪些：contract test、unit test、e2e、browser smoke、backend tests。
- 后端 controller、service、mapper、entity、dto、schema/migration 是否已支撑对应 P0。

审计产物必须形成矩阵：

- 已完成。
- 部分完成。
- 未完成。
- 待核查。
- 当前阶段不做。

审计完成后不要停止，进入缺口裁决。

### 阶段二：缺口裁决

对照 IA 和 implementation directive，把缺口按优先级排序。

优先选择：

- P0 范围。
- 文档明确要求的范围。
- 已有代码底座可承接的范围。
- 能用测试验证的范围。
- 不需要用户额外业务决策的范围。
- 不会触碰移动端和无关旧页面的范围。

每次只选择一个最小正确切片推进。

合格切片示例：

- 一个 IA 菜单从占位升级为真实页面。
- 一个真实页面接入 registry。
- 一个 route/menu contract 补齐。
- 一个权限、菜单或 i18n contract 对齐。
- 一个 API/data contract 补齐。
- 一个页面的 loading、empty、error、permission 状态补齐。
- 一个 V3 合同测试补齐并通过。

### 阶段三：实施前保护

修改任何函数、类、方法前，必须先运行 GitNexus impact：

```text
impact({ target: "<symbol>", direction: "upstream" })
```

如果风险为 HIGH 或 CRITICAL，必须记录风险，并优先尝试选择更小切片。只有改动必要且可验证时才继续。

如果修改 API route handler，必须先做 API impact。

如果是功能或 bugfix，必须先写测试或补 contract test。

如果当前区域没有测试，先补最小 contract test 或 smoke test。

不要跳过 TDD，除非只是文档或纯配置移动。

### 阶段四：实现

实现时坚持小步推进。

前端优先复用：

- React/Vite。
- `SystemPageHost`。
- registry。
- route/menu contract。
- existing UI components。
- existing API layer。
- existing i18n structure。
- existing tests。

后端优先复用：

- controller/service/mapper/entity/dto 分层。
- schema/migration 既有方式。
- existing permission/audit/notification/workflow conventions。
- existing tests。

代码风格必须贴合当前文件，不做格式化大清洗。

每个切片只改必要文件。不要顺手修无关问题；发现无关问题可以记录为后续风险。

### 阶段五：验证

每完成一个切片，立刻运行最相关验证。

如果改前端：

- 运行对应 unit 或 contract test。
- 必要时运行 frontend build 或 targeted test。
- 如果涉及页面可用性，运行相关 smoke/e2e 或现有验证脚本。

如果改后端：

- 运行对应单测或集成测试。
- 如果涉及 schema/migration，验证相关启动或迁移路径。

如果改前后端契约：

- 同时验证 API 类型、调用层和页面消费。

每轮验证必须记录命令、退出结果和关键输出。不能用“应该通过”“看起来正确”替代验证证据。

### 阶段六：review 与下一切片

每个切片完成后必须进入 reviewer 关闭流程。

reviewer 必须核验：

- 本切片是否符合 PRD、IA 和 implementation directive。
- 是否触碰禁止范围。
- 是否完成 impact 或 API impact。
- 是否有测试或合理验证。
- `commands_run` 是否真实记录命令和结果。
- 是否存在残留风险。

如果 reviewer 返回 PASS，继续选择下一切片。

如果 reviewer 返回 PARTIAL 或 FAIL，根据 `repair_recommendation` 修复，不要直接 closeout。

## 8. 状态记录要求

无人值守过程中必须持续维护 `.omc/gai2/**` 状态。

建议产物：

- `.omc/gai2/goal-state.json`
- `.omc/gai2/sessions/<session-id>/workcard.json`
- `.omc/gai2/sessions/<session-id>/audit.json`
- `.omc/gai2/sessions/<session-id>/debate.json`，仅当存在有意义方案分歧时需要。
- `.omc/gai2/sessions/<session-id>/changes.json`
- `.omc/gai2/sessions/<session-id>/review.json`

`workcard.json` 至少包含：

- directive。
- current_truth。
- change_intent。
- write_scope。
- delegation_plan。
- acceptance_checks。
- evidence_to_collect。
- open_risks。
- coordination_ledger。

本任务是代码实现目标，默认 `write_scope` 可为 `unrestricted`，但仍必须遵守禁止范围。

## 9. 验收标准

本轮或每个切片的验收必须映射到具体证据。

最低验收：

- 与 V3 PRD、IA、implementation directive 对齐。
- 新增或修改的页面有 route、registry、权限或 contract 证据。
- 前端改动有对应测试、构建或 smoke 证据。
- 后端改动有对应单测、集成测试或迁移验证证据。
- 未验证项明确标记为风险，不写成完成。
- 收尾前运行 GitNexus `detect_changes()`，确认影响范围符合预期。

不能把以下内容当作完成证据：

- 只读过文档。
- 只输出计划。
- 只生成 demo。
- 只通过人工直觉判断。
- 只说“应该没问题”。

## 10. 每轮输出格式

每轮 closeout 使用这个结构：

```markdown
## 本轮结论

状态：PASS / PARTIAL / FAIL

## 已执行范围

- <切片名称>
- <涉及模块>

## 修改文件

- `<path>`：<改动原因>

## 验证证据

- `<command>`：<结果>

## 验收映射

- <验收项>：PASS / PARTIAL / FAIL，证据：<文件/命令/测试>

## 剩余缺口

- <缺口或风险>

## 下一步

- <下一个最小正确切片>
```

## 11. 首轮推荐切入

首轮不要直接大面积实现。推荐先做 V3 当前状态审计，并产出缺口矩阵。

然后从最小 P0 切片开始，例如：

- route/menu/registry contract 对齐。
- 一个高优先级系统页从占位升级为真实页。
- 一个已有真实页接入 V3 page host 和 registry。
- 一个权限、i18n 或 API data contract 补齐。
- 一个覆盖 V3 registry 的 contract test 补齐。

选择切片后立即进入 impact、测试、实现、验证闭环。

## 12. 最终完成条件

只有同时满足以下条件，才可以声明目标完成：

1. P0 范围逐项有 PASS 证据。
2. 禁止范围未被触碰。
3. 所有新增或修改行为都有测试、构建、审计或人工验收证据。
4. `review.json` verdict 为 PASS。
5. GitNexus `detect_changes()` 结果符合预期。
6. 剩余问题仅为明确记录的 P1/P2 或外部阻塞，不影响 P0 验收。
