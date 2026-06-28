# GAI x Groundwork Bridge Plan

> 状态：Phase 0-5 已按当前证据推进到安全终点；当前结论为 `no_go_do_not_enable_groundwork_hook`。不安装 Groundwork，不启用 Groundwork hook，不让 Groundwork 接管 GAI/GAI2。
> 调研日期：2026-06-27。
> 目标：评估 `@skastr0/groundwork-codex` 是否能作为 GAI/GAI2 的 policy、risk、provenance、session-evidence 补强层，而不是替代 GAI 调度器。

## 1. 结论

Groundwork runtime/hook 当前不能作为 GAI 的硬约束、写入保护层、orchestrator、子智能体生命周期管理器或第二套任务状态机。GAI/Gai2 只保留 native policy，以及 optional gated/skipped evidence fields。

推荐定位：

```text
GAI / GAI2
  owns: orchestration, role routing, builder/reviewer, MINIONS, closeout

Groundwork
  owns: hook-time policy check, destructive-command risk, provenance/session evidence

Codex App
  owns: thread, worktree, approvals, tools, visible execution state
```

当前 go/no-go 为 `no_go_do_not_enable_groundwork_hook`：Phase 0-5 已按当前证据推进到安全终点；Node gate 已过，但 AC-2.2 工具覆盖失败/未验证，AC-2.3 artifact 脱敏失败，因此 forthAMS 主目录、全局配置和长期线程中的 Groundwork 安装、启用、runtime/hook 接入均为 no-go。GAI/Gai2 仅保留 native policy，并在 Groundwork evidence fields 中记录 `skipped_with_reason(missing/failed isolated POC evidence)`。

## 2. 已确认事实

| 项 | 事实 |
|---|---|
| npm package | `@skastr0/groundwork-codex@0.2.1` |
| npm modified | `2026-06-12T10:59:53.867Z` |
| license | MIT |
| engine | Node `>=24` |
| package shape | `.codex-plugin/plugin.json`、hook config file、shell/cmd wrapper、`dist/groundwork-codex-hook.mjs` |
| core dependency | `@skastr0/groundwork-core@0.2.1` |
| core areas | policy、provenance、context、risk、session |
| hook phases | `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`Stop` |
| tool matcher | `^Bash$|^apply_patch$|^Edit$|^Write$` |
| destructive guard | session-scoped block-once：首次 exact command deny，精确重试 warn，但不授予 Codex permission |

## 2.1 Phase 0/1 Execution Report

Phase 0/1 已完成为只读审计和策略映射；没有安装或启用 Groundwork hook。

| 项 | 执行结果 |
|---|---|
| Node gate | 本机 Node 为 `v24.18.0`；已满足 `@skastr0/groundwork-codex@0.2.1` 与 `@skastr0/groundwork-core@0.2.1` 的 Node `>=24` 要求。Node gate 已过不等于 Groundwork 可用；hook POC 和启用仍被 matcher、artifact 脱敏、rollback、timeout/failure 与 Codex App hook 覆盖验证门槛阻断。 |
| package pin | `@skastr0/groundwork-codex@0.2.1`，MIT，modified `2026-06-12T10:59:53.867Z`，integrity `sha512-hKmZgrNwUxzJwTuIv8nVlYO5Rzsjx0j1YkoUHXgnEvdQg/P+2J5rh2T7GwJe3GXdBmSDM1v2q9aB8zSXzl2TwQ==`，tarball `https://registry.npmjs.org/@skastr0/groundwork-codex/-/groundwork-codex-0.2.1.tgz`。 |
| core pin | `@skastr0/groundwork-core@0.2.1`，MIT，modified `2026-06-12T10:59:44.343Z`，integrity `sha512-88SK/1cjeZaeLvI1Op5vk2aM/0ulaItJmqLryqNP4jVQiLLwxZPCAAEx+D76GYvowvUg6MrMLIfjh+a7UkavmQ==`。 |
| hook phases | `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`Stop`，hook timeout 为 30s。 |
| tool matcher | `^Bash$|^apply_patch$|^Edit$|^Write$`；Codex App `functions.exec_command` 是否标准化匹配为 `Bash` 仍未验证。 |
| Node<24 wrapper behavior | wrapper 在 Node `<24` 时只输出 `systemMessage` 并 `exit 0`，不能视为真实策略保护。 |
| artifact | 预期 artifact 为 `<root>/.groundwork/sessions/<session-id-hash>/{state.json,events.jsonl}`；pending tool args 可能进入 artifact，存在敏感信息风险，必须先验证脱敏和清理策略。 |
| risk/block-once | 风险规则覆盖 `rm -rf`、`git checkout --`、`git reset --hard`、`git clean -f`、`git restore --worktree`、`git push --force`、`docker`、`kubectl`、磁盘操作等；block-once exact retry 进入 `warn_after_block_once`，但 warn 不等于 approval。 |
| go/no-go | 已被 Phase 2-5 收口结论取代：当前为 `no_go_do_not_enable_groundwork_hook`。Phase 0/1 只支持把 Groundwork 写成 optional gated/skipped evidence rules；Node gate 已过，但 tool matcher、artifact 脱敏、rollback、timeout/failure、Codex App hook 覆盖未通过，因此不安装、不启用 hook。 |

来源：

- npm `@skastr0/groundwork-codex`: https://www.npmjs.com/package/@skastr0/groundwork-codex
- npm `@skastr0/groundwork-core`: https://www.npmjs.com/package/@skastr0/groundwork-core
- GitHub repository: https://github.com/skastr0/groundwork

## 3. 复盘：遗漏与修正

### 3.1 Runtime 前置条件

遗漏：原计划没有把 Node `>=24` 当成硬门槛。

修正：

- POC 前先检查 Node 版本。
- Node 不满足时不启用 hook，只保留规则映射。
- 版本 pin 到 `0.2.1`，禁止 floating latest。

### 3.2 Hook 覆盖面

遗漏：原计划把 Groundwork 当作“写入前检查器”，但它实际是全线程 hook 层。

修正：

- 必须评估 `SessionStart` 和 `UserPromptSubmit` 是否会记录 prompt/context。
- 必须评估 `PreToolUse`、`PermissionRequest`、`PostToolUse` 是否捕获 command/tool args。
- 必须评估 `Stop` 是否写 session artifact。
- 每个 hook 的 30s timeout 要作为交互性能风险。

### 3.3 Tool matcher 兼容性

遗漏：当前 Codex App 工具在模型侧显示为 `functions.exec_command`、`functions.apply_patch`，Groundwork matcher 使用 `Bash`、`apply_patch`、`Edit`、`Write`，两者是否同源标准化未验证。

修正：

- POC 第一验收项必须验证 `exec_command` 是否触发 `Bash` matcher。
- 验证 `apply_patch` 是否触发。
- 验证子 agent 内部工具调用是否触发或完全不可见。
- 不覆盖当前工具面时，Groundwork 不能算 GAI 的有效写入保护层。

### 3.4 Session artifact

遗漏：原计划没有定义 `.groundwork` artifact 的位置、内容、脱敏和清理策略。

修正：

- 确认 artifact 是否默认写入项目根 `.groundwork`。
- 确认是否污染 git status，是否需要 `.gitignore`。
- 确认 artifact 是否包含 prompt、tool args、命令、路径、风险记录。
- 确认是否可能保存 secrets。
- 确认多线程/worktree 是否互相覆盖 state。
- 确认 cleanup 策略和人工清理流程。

### 3.5 block-once 语义

遗漏：原计划没有区分 `warn`、`deny` 和真实授权。

修正：

| Groundwork 状态 | GAI 解释 |
|---|---|
| `blocked` / deny | 不允许继续，除非用户明确变更指令 |
| `warn_after_exact_retry` | 只能作为风险证据，不等于 approval |
| `executed_after_warning` | reviewer 必须标风险，不能默认 PASS |

### 3.6 Supply chain / trust

遗漏：原计划没有写供应链边界。

修正：

- pin `@skastr0/groundwork-codex@0.2.1` 与 integrity。
- POC 只在临时 worktree 或无关沙箱 repo。
- 不在主线程全局启用。
- 不自动升级。
- 先审 `hooks.json`、wrapper、policy/risk/session 关键行为。
- 必须有 disable/uninstall/cleanup 回滚路径。

## 4. borrow / adapt / reject

| 项 | 处理 | 理由 |
|---|---|---|
| policy/risk hook | borrow | 可补 GAI 写入范围、风险命令、规则文件变更门禁 |
| provenance/session artifact | adapt | 可作为 GAI closeout evidence，但不能恢复 `.omc` runtime |
| destructive guard | borrow | 对 `rm -rf`、`git reset --hard`、`git clean -f` 等有实际保护价值 |
| UserPromptSubmit hook | cautious adapt | 只有确认脱敏与 artifact 内容后才启用 |
| Groundwork session ownership | reject | GAI/Codex native thread 继续是状态权威 |
| Groundwork orchestrator | reject | GAI2 orchestrator 继续负责调度、角色、MINIONS、closeout |
| 全局启用 | reject | 先项目/worktree POC |
| 子 agent 生命周期管理 | reject | 继续由 GAI2/GAI3 lifecycle ledger 管理 |

## 5. GAI 映射字段

Groundwork 集成后，只允许进入 GAI closeout 和 reviewer schema 的证据字段，不允许改变 GAI 主流程。

建议新增字段：

```yaml
groundwork:
  enabled: true | false
  version: "@skastr0/groundwork-codex@0.2.1"
  node_version_ok: true | false
  hook_phases_seen:
    - SessionStart
    - UserPromptSubmit
    - PreToolUse
    - PermissionRequest
    - PostToolUse
    - Stop
  tool_matcher_coverage:
    exec_command: covered | not_covered | unknown
    apply_patch: covered | not_covered | unknown
    subagent_tools: covered | not_covered | unknown
  policy_check:
    verdict: pass | warn | block | unavailable
    rule_ids: []
  risk_check:
    verdict: pass | warn | block | unavailable
    risk_ids: []
  provenance_ref:
    artifact_path: ""
    redacted: true | false
  session_artifact:
    path: ""
    git_ignored: true | false
    contains_prompt: true | false | unknown
    contains_tool_args: true | false | unknown
    contains_secrets: false | unknown
  failure_mode:
    hook_timeout: true | false
    hook_error: true | false
    fallback: gai_native_policy | blocked | none
```

## 6. Phase 推进计划

### Phase 0: 只读包审计

目标：不安装、不启用 hook，仅确认包结构和运行边界。

任务：

- 检查 Node 版本是否满足 `>=24`。
- 读取 `package.json`、`.codex-plugin/plugin.json`。
- 读取 `hooks/hooks.json`。
- 抽样审计 wrapper：`groundwork-codex-hook.sh`、`groundwork-codex-hook.cmd`、loader。
- 抽样审计 core：policy config、risk rules、session artifact。
- 记录版本、integrity、hook phases、tool matcher、timeout。

验收：

- AC-0.1：确认 Node 门槛。
- AC-0.2：确认 hook 覆盖面。
- AC-0.3：确认 artifact 可能位置。
- AC-0.4：确认是否存在不可接受的全局写入或隐式安装行为。

退出条件：

- 如果 Node 不满足，停止在只读设计阶段。
- 如果 hook 会默认写全局状态，停止，不进入 POC。

### Phase 1: GAI Policy Mapping

目标：把 GAI 规则映射为 Groundwork 可检查的策略草案。

映射范围：

- `write_scope`: readonly / allowlist / unrestricted。
- denied paths: `.env*`、secrets、未授权移动端路径、无关 repo。
- protected guidance: `AGENTS.md`、`SKILL.md`、`references/*.md`。
- destructive commands: `rm -rf`、`git reset --hard`、`git clean -f`、`git checkout --`、`git restore --worktree`、`git push --force`。
- required evidence: reviewer verdict、commands_run、subagent ledger、redaction status、Groundwork provenance。

验收：

- AC-1.1：每条 GAI 硬规则有 Groundwork 映射或明确 `not_supported`。
- AC-1.2：`warn` 不被映射成 approval。
- AC-1.3：Groundwork 不承担 GAI orchestrator、builder、reviewer 职责。

### Phase 2: 隔离 POC

目标：在隔离环境验证 hook 是否适合 Codex App。

边界：

- 新 worktree 或临时 repo。
- 不碰 forthAMS 主目录。
- 不启用全局长期配置。
- 不接入当前长期 GAI 线程。

测试矩阵：

| 测试 | 预期 |
|---|---|
| SessionStart | hook 运行且不泄露敏感内容 |
| UserPromptSubmit | 可确认是否记录 prompt；若记录，需有脱敏策略 |
| exec_command | 明确是否匹配 `Bash` |
| apply_patch | 明确是否匹配 `apply_patch` |
| destructive command | 首次 deny，精确重试 warn，且 GAI 不把 warn 视为 approval |
| artifact | `.groundwork` 内容可审计，可清理，不污染提交 |
| timeout | hook 不导致 Codex App 明显卡顿 |

验收：

- AC-2.1：hook phases 可观测。
- AC-2.2：当前 Codex App 工具名被正确覆盖或明确不覆盖。
- AC-2.3：artifact 无 secrets，或可证明敏感值被脱敏。
- AC-2.4：失败时可禁用/移除。

#### Phase 2 POC Execution Report

日期：2026-06-27（Asia/Shanghai）。

临时目录：`/tmp/gai-groundwork-poc-uKYyT4`。

Node 版本：`v24.18.0`。

包版本：`@skastr0/groundwork-codex@0.2.1`，通过 `npm pack @skastr0/groundwork-codex@0.2.1` 获取；未使用 floating `latest`。

边界执行情况：

- 未在 forthAMS 主目录安装或启用 Groundwork。
- 未写入全局或项目级 Codex 配置。
- 未启用真实 Codex plugin/hook。
- 只在 `/tmp/gai-groundwork-poc-uKYyT4` 内解包、生成 synthetic payload、运行 wrapper。
- 只使用假敏感标记 `FAKE_SECRET_[REDACTED]`；未读取、复制或输出真实 secret/token/password。

关键命令：

```sh
node -v
npm pack @skastr0/groundwork-codex@0.2.1
tar -xzf skastr0-groundwork-codex-0.2.1.tgz
git init
node run-poc.mjs
node run-risk-nontmp.mjs
PLUGIN_ROOT=/tmp/gai-groundwork-poc-uKYyT4/package sh /tmp/gai-groundwork-poc-uKYyT4/package/hooks/groundwork-codex-hook.sh < /tmp/gai-groundwork-poc-uKYyT4/pretool_bash_destructive_fake_secret.json
rg -n "FAKE_SECRET_[REDACTED]" /tmp/gai-groundwork-poc-uKYyT4/sandbox/.groundwork
find /Users/feigao/project/Project/forthAMS -maxdepth 2 -name .groundwork -print
find /Users/feigao/project/Project/forthAMS -maxdepth 3 -name .codex-plugin -print
```

测试矩阵：

| 测试 | Synthetic payload / evidence | 结果 |
|---|---|---|
| `hooks/hooks.json` | 读取 `package/hooks/hooks.json` | 声明 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`Stop`；`PreToolUse`/`PermissionRequest`/`PostToolUse` matcher 为 `^Bash$|^apply_patch$|^Edit$|^Write$`；timeout 为 30s。 |
| `SessionStart` | `session_start.json` 经 wrapper 执行 | 成功，stdout 返回 `hookSpecificOutput.hookEventName=SessionStart`。 |
| `UserPromptSubmit` | `user_prompt_secret.json` 经 wrapper 执行 | 进程成功退出但无 stdout；未观察到 prompt 反馈。 |
| `PreToolUse` / `Bash` safe | `pretool_bash_safe.json` | 成功退出但无反馈，符合无风险命令无输出。 |
| `PreToolUse` / `Bash` destructive under `/tmp` | `pretool_bash_destructive.json` | 未触发 deny；原因是默认 `GROUNDWORK_DESTRUCTIVE_GUARD_ALLOW_TMP_RM_RF=true` 放行 `/tmp`/`/var/tmp` recursive force rm。 |
| `PreToolUse` / `Bash` destructive non-`/tmp` | `pretool_bash_destructive_nontmp.json` | 成功触发 `permissionDecision=deny`，规则为 `rm.recursive-force`。命令只在 payload 中被检查，未执行。 |
| block-once retry | `pretool_bash_destructive_nontmp_retry.json` | 精确重试返回 warning/systemMessage，不再 deny。 |
| `PermissionRequest` retry | `permission_bash_destructive_nontmp_retry.json` | 返回 warning，并明确 `Groundwork risk is warning only here; it is not granting or denying the Codex permission request.` |
| `PostToolUse` retry | `posttool_bash_destructive_nontmp_retry.json` | 返回 warning 后执行记录：`Unsafe command executed after prior block-once warning`；不能撤销副作用。 |
| `PreToolUse` / `apply_patch` | `pretool_apply_patch_secret.json` | 成功退出但无反馈；dist 入口可接受 `apply_patch` 名称并映射为 edit，但未配置 policy 时无可见阻断证据。 |
| `PreToolUse` / `functions.exec_command` | `pretool_functions_exec_command.json` | 成功退出但无反馈；dist 入口不把 `functions.exec_command` 当作 `Bash`。Codex App 内部是否会标准化为 `Bash` 未真实验证。 |
| `PreToolUse` / `functions.apply_patch` | `pretool_functions_apply_patch.json` | 成功退出但无反馈；hooks matcher 不包含 `functions.apply_patch`。Codex App 内部是否会标准化为 `apply_patch` 未真实验证。 |
| `Stop` | `stop.json` | 成功，stdout 为 `{}`。 |
| artifact 创建 | `find /tmp/gai-groundwork-poc-uKYyT4/sandbox/.groundwork` | 创建 `.groundwork/sessions/<session-id-hash>/state.json`；未观察到 `events.jsonl`。 |
| artifact 脱敏 | fake secret in risky Bash command payload | 失败：`state.json` 的 `commandPreview` 和 `segmentPreview` 原样保存假敏感标记原文。 |
| forthAMS 污染检查 | `find /Users/feigao/project/Project/forthAMS -maxdepth 2 -name .groundwork -print` | 无输出；forthAMS 主目录未创建 `.groundwork`。 |
| Codex plugin 配置检查 | `find /Users/feigao/project/Project/forthAMS -maxdepth 3 -name .codex-plugin -print` | 无输出；forthAMS 未创建 `.codex-plugin`。临时解包目录内存在 `package/.codex-plugin`，但未安装/启用。 |
| timeout/failure | `run-poc.mjs` 与 `run-risk-nontmp.mjs` 记录 elapsed | 单次 synthetic hook 约 167-183ms，明显低于 30s。 |

AC 结果：

| AC | 结果 | 证据 / 说明 |
|---|---|---|
| AC-2.1 hook phases 可观测 | partial | `hooks/hooks.json` 声明 6 个 phase；`SessionStart`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`Stop` 有 wrapper/dist 触发证据；`UserPromptSubmit` 成功退出但无可见输出。 |
| AC-2.2 当前 Codex App 工具名覆盖 | failed / not_verified | `Bash` synthetic 可触发风险规则；`apply_patch` synthetic 可进入 dist 但无阻断反馈；`functions.exec_command` 与 `functions.apply_patch` 未被 dist 识别为 `Bash`/`apply_patch`，且未真实验证 Codex App 内部 tool matcher 标准化；子 agent 内部工具不可验证，记为 `not_verified`。 |
| AC-2.3 artifact 脱敏 | failed | `.groundwork` artifact 已创建；假敏感标记进入 `state.json` 的 `commandPreview` 和 `segmentPreview`，redaction not proven / failed。 |
| AC-2.4 失败时可禁用/移除 | pass for isolated POC only | 本次没有安装或启用 plugin；清理路径为删除临时目录 `/tmp/gai-groundwork-poc-uKYyT4` 或其中 `sandbox/.groundwork`。forthAMS 主目录无 `.groundwork` / `.codex-plugin`。 |
| AC-2.5 destructive guard/block-once | partial | 非 `/tmp` 假目标 `rm -rf` 首次 deny、精确重试 warn、PermissionRequest 不授予 permission、PostToolUse 记录 warning 后执行；但默认允许 `/tmp` recursive force rm，需要额外策略明确。 |
| AC-2.6 timeout/failure | pass for synthetic wrapper runs | synthetic hook 单次运行约 167-183ms，明显低于 30s；未验证真实 Codex App hook 调度延迟。 |

Go/no-go：

`no_go_do_not_enable_groundwork_hook`。

原因：

- AC-2.2 未通过：当前 Codex App 显示的 `functions.exec_command`、`functions.apply_patch` 是否会被 hook dispatcher 标准化为 `Bash`、`apply_patch` 仍为 `not_verified`，不能声明工具覆盖。
- AC-2.3 未通过：`.groundwork` artifact 会保存包含假敏感标记的 command preview，脱敏失败。
- AC-2.5 仅 partial：默认允许 `/tmp` 下的 `rm -rf`，需要单独策略关闭或解释。

GAI/GAI2 当前策略继续维持：

```yaml
groundwork:
  enabled: false
  version: "@skastr0/groundwork-codex@0.2.1"
  node_version_ok: true
  failure_mode: skipped_with_reason(missing/failed isolated POC evidence)
```

在 AC-2.2 与 AC-2.3 被重新验证并通过前，Groundwork 不得在 forthAMS 主目录或全局 Codex App 中启用，也不得作为 GAI/GAI2 的有效写入保护层。

#### Phase 3-5 Execution Report

日期：2026-06-27（Asia/Shanghai）。

Phase 3：GAI/Gai2 skill 增强已完成为 gated/skipped 规则，不启用 Groundwork，不把 Groundwork 当写入保护层。相关规则文件已更新并通过 quick validate：

- `/Users/feigao/.codex/skills/gai/SKILL.md`
- `/Users/feigao/.codex/skills/gai/references/directive-flow.md`
- `/Users/feigao/.codex/skills/gai/references/closeout-template.md`
- quick_validate：通过；规则要求 Node `<24`、missing/failed isolated POC evidence、Phase 2 no-go、unverified Codex App tool matcher coverage、artifact redaction failed/not proven 均记录为 `skipped_with_reason`，并继续使用 GAI native policy。

Phase 4：失败与回滚策略已形成。hook timeout、hook error、hook unavailable、matcher 不覆盖均降级为 GAI native policy；artifact 泄露或脱敏失败进入安全阻断/FAIL，且不得被计为 PASS 证据。本次没有启用全局或项目 hook，因此没有可卸载的 Groundwork runtime/hook；隔离 POC 临时证据清理路径为 `/tmp/gai-groundwork-poc-uKYyT4`。

Phase 5：长期使用判定为 `no_go_do_not_enable_groundwork_hook`。Node gate 通过，但不足以启用；AC-2.2 当前 Codex App matcher coverage failed/not_verified，AC-2.3 artifact redaction failed/not_proven，因此 Groundwork runtime/hook 不进入长期接入。GAI/Gai2 当前只保留 native policy + optional skipped evidence fields。

### Phase 3: GAI Skill 增强

目标：在 POC 通过后，把 Groundwork 作为可选 policy evidence 写进 GAI。

当前执行状态：已完成为 gated/skipped 规则；不是可用接入。Groundwork 不启用，相关 closeout/reviewer 字段只能记录 `skipped_with_reason(missing/failed isolated POC evidence)` 或 future verified evidence。

变更内容：

- Medium+ 写入前声明 Groundwork 是否可用。
- builder 写入前参考 Groundwork policy/risk。
- builder 写入后引用 Groundwork provenance。
- reviewer closeout 增加 `groundwork_policy_check`、`groundwork_risk_check`、`groundwork_provenance_ref`、`groundwork_redaction_status`。
- Groundwork 不可用时不阻塞 GAI，但必须写 `skipped_with_reason`。

验收：

- AC-3.1：GAI 不依赖 Groundwork 才能运行。
- AC-3.2：Groundwork 可用时，GAI closeout 能引用其证据。
- AC-3.3：Groundwork block/warn 语义被正确映射。

### Phase 4: 失败与回滚策略

目标：保证 Groundwork 出问题时不拖垮 GAI/Codex App。

当前执行状态：已完成。失败、timeout、unavailable、matcher 不覆盖均降级为 GAI native policy；artifact 泄露/脱敏失败进入安全阻断。本次无全局/项目 hook 可卸载，临时 POC 清理路径为 `/tmp/gai-groundwork-poc-uKYyT4`。

策略：

- hook timeout：降级为 GAI native policy，记录 `groundwork.failure_mode.hook_timeout=true`。
- hook 输出不稳定：禁用 Groundwork，保留 GAI 原生规则。
- artifact 泄露风险：立即禁用、清理 `.groundwork`、标记 `FAIL` 或安全阻断。
- tool matcher 不覆盖：不把 Groundwork 算作写入保护，只作为旁路提示。
- UI/线程异常：不递归 spawn agent，不把 Groundwork 接入子 agent lifecycle。

验收：

- AC-4.1：存在明确 disable/uninstall 流程。
- AC-4.2：`.groundwork` 可清理。
- AC-4.3：Groundwork failure 不会导致 GAI 误报 PASS。

### Phase 5: 长期使用判定

只有满足以下条件，才进入长期接入：

- Node 运行时稳定满足 `>=24`。
- hook 覆盖当前 Codex App 关键工具。
- artifact 无敏感值或可证明脱敏。
- hook timeout 不影响日常交互。
- 可项目级启停，不需要全局接管。
- 不产生子 agent/HUD/线程 UI 残留。
- GAI closeout 能稳定引用 Groundwork 证据。

若任一条件不满足，Groundwork 只保留为研究对象，不进入 GAI 主规则。

当前执行状态：已完成判定。当前长期接入结论为 `no_go_do_not_enable_groundwork_hook`；Node gate 通过但不足以启用，AC-2.2/AC-2.3 失败或未验证阻断长期接入。

## 7. 风险清单

| 风险 | 严重性 | 处理 |
|---|---:|---|
| Node gate 回退或运行时漂移 | 高 | 低于 Node `>=24` 时不启用 hook；重新标记 `skipped_with_reason` |
| UserPromptSubmit 保存敏感 prompt | 高 | 不启用或要求脱敏证明 |
| tool matcher 不覆盖 Codex App 工具 | 高 | 不作为 GAI 保护层 |
| `.groundwork` 污染 git status | 中 | `.gitignore` 或临时目录策略 |
| hook timeout 影响交互 | 中 | 降级为 GAI native policy |
| block-once warn 被误判为批准 | 高 | reviewer schema 明确 warn 不等于 approval |
| supply chain / bundle 不透明 | 中 | pin version + integrity，隔离 POC |
| Groundwork 接管状态 | 高 | 明确 reject |

## 8. 下一步

当前不继续接入 Groundwork runtime/hook；GAI2 不应把 Groundwork 作为写入保护层、长期 hook 或必需证据来源。后续只有在 Groundwork 修复/证明 Codex App matcher coverage 与 artifact redaction 后，才可另开新的隔离 POC；仍然不得在 forthAMS 主目录安装或启用 hook。

1. 等待或取得 Codex App `functions.exec_command` / `functions.apply_patch` 到 Groundwork matcher 的覆盖证明。
2. 等待或取得 `.groundwork` artifact 对 prompt、tool args、command preview、segment preview 的脱敏证明。
3. 若上述两项都有可验证修复，再在新的临时 repo/worktree 重新执行隔离 POC，并重新验证 rollback、timeout/failure、hook coverage 与清理路径。
4. 只有新的隔离 POC 全部通过后，才允许重新评估 optional evidence bridge；在此之前只能记录 `skipped_with_reason(missing/failed isolated POC evidence)`。

Phase 0-5 当前状态已收口为 `no_go_do_not_enable_groundwork_hook`；不得声称 Groundwork 可用、已安装、可长期使用或已完成接入。

## 9. GAI2-native Guard 替代方向

Groundwork hook 维持 `no_go_do_not_enable_groundwork_hook` 后，新增替代方向为项目级 `plugins/gai2-native-guard` hook-bearing candidate。该插件只实现 Codex 原生 hook 的最小硬拦截：`PreToolUse` 对危险命令、敏感路径、protected guidance/config、冻结的 `frontend/src/pages/mobile/**` 返回 deny；`PermissionRequest` 与 `PostToolUse` 仅返回 warning/systemMessage，不授予权限、不声称回滚副作用。

该方向不启用 Groundwork runtime，不创建 `.groundwork` 或长期 session artifact，不保存 prompt、完整命令、完整 patch、secret/token 值。允许输出的证据限于 `rule_id`、`severity`、`tool_name`、`path_category`、`action_hash` 和简短 reason。

项目级 marketplace 只可声明为 `AVAILABLE`，不得 `INSTALLED_BY_DEFAULT`，也不得写入全局 `~/.codex`、`~/.agents` 或 Codex App 全局配置。当前状态仍是未自动启用；用户必须显式审阅、安装或启用后才会进入运行路径。

`plugins/gai2-native-guard/.codex-plugin/plugin.json` 现在包含 `"hooks": "./hooks/hooks.json"`，指向 runtime hook manifest。当前本地 `validate_plugin.py` 会把 hook-bearing manifest 的 `hooks` 字段判为 unexpected field；这是本地 validator 与 hook plugin manifest 的不适配，不应当记录为 runtime 失败。

真实准入/启用验证以 `codex plugin marketplace add /Users/feigao/project/Project/forthAMS`、`codex plugin add gai2-native-guard@forthams-project`，以及安装后新线程 runtime 拦截测试为准。安装和新线程拦截测试完成前，状态只能标为 hook-bearing candidate，不得声称已启用。
