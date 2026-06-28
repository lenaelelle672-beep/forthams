# GAI2 子智能体模型路由设计

> 适用范围：forthAMS 在 Codex 中使用 GAI2/蜂群推进桌面端与后端质量闭环。全局契约以 `/Users/feigao/.codex/skills/gai/SKILL.md` 为唯一权威来源；每个 GAI2 agent 的 Dedicated Role Instruction Contracts / 专属角色指令合同也以该全局文件为准。本文只覆盖 forthAMS 的模型路由、GitNexus 门禁、冻结范围和项目级调度细节。移动端当前冻结：禁止子智能体写入或路由变更，但允许只读边界审计以确认冻结未被破坏。

## 1. 调研结论

当前外部资料结论记录于 2026-06-13；后续若涉及“最新模型/社区项目/官方文档/价格/计划/限制”等不稳定事实，必须重新走 `gai2-research` 并刷新来源日期。

官方与社区主流做法都不是“所有 agent 都上同一个强模型”，而是把 agent 当作可调度资源：

- OpenAI Codex 模型文档推荐复杂编码、研究、知识工作从 `gpt-5.5` 起步；同时说明 `gpt-5.4-mini` 适合更轻、更快的编码任务或 subagents，`gpt-5.3-codex-spark` 是面向 Pro 的近实时迭代研究预览。参考：[Codex Models](https://developers.openai.com/codex/models)。
- OpenAI API Reasoning 文档说明 `reasoning.effort` 可按模型支持设置为 `none/minimal/low/medium/high/xhigh`，低推理偏速度和 token 经济性，高推理偏质量。参考：[Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)。
- Codex 帮助中心确认 Codex 包含在 Free、Go、Plus、Pro、Business、Edu、Enterprise 等计划中，但不同计划的使用限制不同；本项目按用户明确的 Pro 策略提高模型利用率。参考：[Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-getting-started-with-codex)。
- OpenAI Agents SDK 把 `model`、`model_settings`、tools、handoffs、guardrails 作为 agent 的基础配置，并推荐两类多 agent 模式：中心 manager 调用子 agent，或 handoff 给专门 agent 接管。参考：[OpenAI Agents SDK - Agents](https://openai.github.io/openai-agents-python/agents/)。
- AutoGen 使用 `model_client` 给每个 agent 指定模型客户端，并显式提供工具循环上限 `max_tool_iterations`；同时提醒带内部状态的 agent/team tool 不应并行调用，以免并发状态冲突。参考：[AutoGen AgentChat - Agents](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/agents.html)。
- CrewAI 允许每个 agent 配置 `llm`、`function_calling_llm`、`max_iter`、`max_rpm`、`max_execution_time`、`reasoning` 等，并推荐用 YAML 维护 agent 配置。参考：[CrewAI - Agents](https://docs.crewai.com/en/concepts/agents)。
- 近期研究也支持资源化调度：AgentRM 把 agent 看成类似 OS 资源，强调 admission control、zombie reaping、上下文生命周期；AMRO-S 强调用轻量意图推断做路由；Agent Capsules 强调把 agent 粒度和质量门禁绑定，能合并就合并，质量不够再拆分。参考：[AgentRM](https://arxiv.org/abs/2603.13110)、[AMRO-S](https://arxiv.org/abs/2603.12933)、[Agent Capsules](https://arxiv.org/abs/2605.00410)。

因此，forthAMS 的 GAI2 蜂群采用“主线程 `gai2-orchestrator` + 硬分工子 agent”的策略：主线程只负责调度、分诊、模型路由、子 agent admission、等待/消费/关闭结果、MINIONS adjudication 和最终汇总；凡 GAI2 实现/修复/文档规则落地且需要写文件，必须交给 `gai2-builder`，在 Codex 中映射为 `worker` 子 agent，并带明确 allowlist。Medium+ 和任何声称 `PASS` 的 GAI2 closeout 必须消费独立 `gai2-reviewer` verdict。

补充校准：原 Opencode GAI2 的角色命名必须保留，不能只用泛化专家名替代。此前文档把 `gai2-orchestrator` 折叠成“主线程 manager”，这是调研遗漏；自本节起，forthAMS 明确恢复 `gai2-orchestrator` 作为必经调度角色。

### 编排项目调研补充（2026-06-13 / 2026-06-26）

本轮在继续落地 GAI2 前，已先调研当前主流多智能体/蜂群编排项目；结论是：成熟项目普遍采用“中心调度 + 明确状态 + 有界上下文 + 质量门禁”，而不是无条件大量并发。

2026-06-26 已为本轮硬分工规则校准刷新/补充外部编排证据；2026-06-13 的历史调研说明继续保留。

| 来源 | 可借鉴点 | forthAMS/Codex 落地 |
|---|---|---|
| [OpenAI Agents SDK Orchestration](https://developers.openai.com/api/docs/guides/agents/orchestration) / [Multi-agent](https://openai.github.io/openai-agents-python/multi_agent/) | 区分 manager 调用子 agent 与 handoff 接管；建议只在 instructions/tools/policy/trace 真不同的时候拆 agent | GAI2 默认采用 `gai2-orchestrator` supervisor 模式；handoff 只在专家需要接管下一轮用户交互时使用 |
| [LangChain Multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent) / [LangGraph Swarm](https://github.com/langchain-ai/langgraph-swarm-py) | 不是所有复杂任务都要多 agent；重点是 context engineering、checkpoint/store、handoff payload 控制 | 子 agent 默认 `fork_context:false`，只回传结构化摘要；长目标用 native goal + state_pack 记录连续性 |
| [CrewAI Docs](https://docs.crewai.com/) / [Flows](https://docs.crewai.com/en/concepts/flows) | agents/flows 分层，guardrails、memory、observability、state、callbacks、human-in-loop | GAI2 closeout 必须有 AC 证据、gap_history、policy_state 和 reviewer verdict；不是靠“已执行”证明完成 |
| [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/) / [Orchestrations](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/) | graph workflow、type-safe routing、checkpoint、pause/resume、human-in-loop；内置 sequential/concurrent/handoff/group chat/Magentic | 明确模式选择：supervisor/subagents、handoff、workflow/checkpoint、council/swarm；按任务选择，不固定套一种 |
| [Claude Code Subagents](https://code.claude.com/docs/en/agent-sdk/subagents) | 子 agent 隔离上下文、并行、专门 instructions | GAI2 用 sidecar 降低主线程上下文压力；消费结果后必须关闭并记录 close status |
| [Mastra Multi-agent Systems](https://mastra.ai/guides/concepts/multi-agent-systems) | 当 context/tools/responsibility/guardrails 不同或可并行时才拆；supervisor、handoff、workflow、council 可组合 | swarm 只在高风险/模糊/用户明确要求时启用；显式 swarm 至少两个独立 lens，单一 debate 不算蜂群 |

### 借鉴 / 适配 / 拒绝清单

| 类别 | 内容 | 决策 |
|---|---|---|
| 外部成熟项目 | supervisor/subagents 默认、handoff 例外、workflow/checkpoint 状态、council/swarm 多视角、context filtering、observability/evidence | 借鉴，并写入全局 `gai` skill 的 pattern selection 规则 |
| Opencode GAI2 | 角色名、workcard、stage artifact、review truth source、repair budget、gap fingerprint、write_scope guard、permission/trace redaction | 适配为 Codex-native workcard、coordination ledger、state_pack、reviewer schema 和 closeout 门禁 |
| Opencode runner/plugin | `.omc/gai2/**` 运行态、`goal_runner.py` unattended loop、`gai2-goal.js` session idle resume、plugin lock、permission autoallow script | 不直接迁移；Codex native goal/thread 状态负责持续性，工具权限由 Codex 工具面负责，GAI2 只记录策略和证据 |
| auto/flash 家族 | `gai2-auto-*`、`gai2-flash-*`、sticky auto mode、fallback direct route | 不照搬 agent 家族；保留 `mode_intent` / `model route` 字段，用 `gpt-5.5` 默认和 reasoning_effort 分层表达速度/深度 |
| artifact 文件强制落盘 | Opencode 要求 `.omc/gai2/*.json` read-verify | 不强制落盘；但必须有等价结构化 evidence。若某任务要求文件产物，则要 read-verify |
| 权限与安全 | 只读角色不能写、写入 worker 必须 allowlist、敏感路径/API key 不可复制、工具 trace 需脱敏 | 借鉴为硬规则：delegated prompt 必须写 allowed/denied actions，closeout 必须有 tool trace/redaction check |
| Opencode 硬分工与真实产物链 | `gai2-orchestrator` 只调度，`gai2-builder` 写入，`gai2-reviewer` 判定完成；MINIONS 有 drafter/refiner 真实产物链 | 借鉴角色边界和产物链；适配为 Codex `worker`/独立 reviewer 子 agent、coordination ledger 和 reviewer verdict；拒绝主线程自写自评、文本模拟 MINIONS、`.omc` runtime 迁移 |

本机 Opencode GAI2 补充证据：专属角色指令位于 `/Users/feigao/.config/opencode/agent/gai2*.md`。`gai2.md` 是入口，`gai2-orchestrator.md` 是 `mode: subagent` 调度器，`gai2-drafter.md`/`gai2-refiner.md` 负责 MINIONS 真实链路，`gai2-builder.md` 明确 builder 不自批，`gai2-reviewer.md` 核验 drafter -> refiner -> adjudication -> builder/reviewer 链路，`gai2-audit.md`、`gai2-triage.md`、`gai2-debate.md` 也都是专属 role MD。未发现独立 `gai2-research.md`；它是 Codex 扩展角色。Codex 自定义 agent 适配器不等于完整 Opencode 角色文件，因此后续 handoff 必须显式携带 role identity、权限边界、模型/推理和产物要求。

### Codex-native 状态与证据包

forthAMS 不创建 Opencode `.omc` runtime，但每次 Medium+ GAI2 需要保留等价结构化记录：

- `state_pack`：directive、iteration、budget_notes、mode_intent、auto_resume_intent、policy_state、abort_or_blocker、stagnation_signal、gap_history、acceptance_evidence、next_action。
- `pattern_selection`：external_research_date、sources_consulted、selected_pattern、skipped_patterns、borrow、adapt、reject、Codex-native landing、safety_notes。
- `swarm_lens`：lens、role_id、findings、risks、evidence_needed、recommendation、open_questions、verdict。
- `repair_iteration`：iteration、prior_gap_fingerprint、repair_scope、changed_or_new_evidence、progress_signal、remaining_gap、next_action。
- `adjudication`：selected_source、preserved_items、rejected_items、builder_directives、write_intent_preserved、degradation_detected、repair_path。
- `tool_trace_summary`：tools/sources used、commands run、failures/timeouts、redaction status、sensitive values omitted。

`policy_state` 允许值建议使用：`CONTINUE`、`VERIFY_GOAL`、`BUDGET_LIMIT`、`COOLDOWN`、`ABORT_REQUESTED`、`BLOCKED`、`COMPLETED`。这不是第二套 goal 状态，只是 closeout 和续跑时的压缩事实。

## 1.1 Goal 续跑硬触发

forthAMS 的 native goal 如果在 objective 中包含 `GAI2`、`gai2`、`$gai`、`/gai`、`/gai2`、`蜂群`、`swarm`、`subagent`、`子 agent` 或 `multi-agent`，则每次续跑都必须先进入 GAI2-lite，而不是按普通 Codex goal 直接执行。

固定启动动作：

1. 读取 `/Users/feigao/.codex/skills/gai/SKILL.md`；Medium+ 工作继续读取 `references/directive-flow.md`，收尾前读取 `references/closeout-template.md`。
2. 输出 `GAI2 Continuation Boot`：说明当前 goal 已启用 GAI2，建立 `gai2-orchestrator` 为当前调度器，分类本轮工作，保持原始目标不缩小。
3. 写出当前事实 vs 需要变化。
4. 建立或刷新 workcard：`write_scope`、allowed paths、`research_decision`、`research_plan`、delegation、acceptance checks、evidence、open risks、GitNexus gates。
5. 先做调研 gate：由 `gai2-orchestrator` 自主判断调研是 required/useful/skip；当任务涉及外部资料、社区/竞品、最新信息、官方文档、上游仓库、论文、模型/工具选型、不稳定事实，或要修改 GAI2 编排规则本身时，优先创建只读 `gai2-research`，并在落地前输出 borrow/adapt/reject。
6. 默认开启自主分配：由 `gai2-orchestrator` 自主决定是否创建子智能体。调研/事实确认用 S1/S2，旁路审计用 S2，高风险复核用 S4；所有 GAI2 写入型实现/修复/文档规则落地必须由 `gai2-builder` 作为 `worker` 执行，且只用于明确 allowlist 文件。
7. 输出“调度判定”：分类、当前事实、需要变化、本地主线程动作、子智能体判定、选中/跳过角色及理由、并发预算/当前并发/依据、调研判定/来源/预算、编排模式/借鉴判定、模型/推理/fork_context、写入范围、policy_state/gap_history、等待点、关闭点、下一步。
8. 子 agent 结果被消费后必须关闭，并在交接记录里登记中文别名、agent id、工具 nickname、模型、推理强度、结果、是否采纳和是否关闭。

这条规则解决的问题是：目标里写了 GAI2/蜂群时，后续 goal 续跑不能只把它当作普通文字背景；它必须改变执行流程和子 agent 调度方式。

## 1.2 中文显示协议

forthAMS 的 GAI2 进度展示默认使用简体中文，包括进度更新、计划项、workcard、协调台账、子智能体任务描述、结果摘要和 closeout。

保留原始角色 id 作为技术标识，但用户可见名称使用中文：

| 角色 id | 中文显示名 |
|---|---|
| `gai2-orchestrator` | 调度器 |
| `gai2-triage` | 分诊员 |
| `gai2-research` | 调研员 |
| `gai2-audit` | 审计员 |
| `gai2-debate` | 辩手 |
| `gai2-drafter` | 起草员 |
| `gai2-refiner` | 精修员 |
| `gai2-builder` | 执行员 |
| `gai2-reviewer` | 审查员 |

如果 Codex 子 agent 工具自动返回英文 nickname，调度器必须立即分配中文别名，例如 `审查员一号（工具名 Beauvoir）`，并在后续进度、协调台账、结果摘要和 closeout 中使用中文别名。工具 nickname 只能作为技术备注；子智能体 handoff 必须包含短身份头，回包第一行必须写 `我是<中文别名>，role_id: <role>`，标题、verdict、acceptance status 和 evidence summary 使用简体中文。

## 1.3 自主子智能体分配默认开启

forthAMS 的 GAI2 使用“默认开启、自主分配、受控回收”的子智能体策略。只要用户触发 GAI2、`$gai`、`/gai`、`/gai2`、蜂群、swarm、subagent、子 agent，或 active goal 命中 GAI2 触发词，就视为授权 `gai2-orchestrator` 自主分配合适的子智能体。

默认开启不等于每轮都硬开 agent。调度器必须执行 admission control：

- 非 GAI2、纯只读、低风险小问题可以由主线程本地回答；GAI2 写入工作即使简单，也必须走 `gai2-builder` worker + allowlist，除非工具不可用并记录降级。
- 审计、事实确认、复核、辩论、起草、精修可自主创建只读子智能体。
- 涉及外部、最新、社区、官方、上游、模型/工具选型或不稳定事实时，可自主创建只读 `gai2-research`；纯本地、机械、已有证据或稳定事实可跳过，但必须记录跳过原因。
- 写入型 worker 只允许在明确 allowlist、文件 ownership 不重叠、不会触碰冻结移动端范围时创建；没有 worker 时，主线程本地降级不得声称 `PASS`，除非用户显式接受本地执行。
- forthAMS GAI2 写入默认只使用 `readonly` 或 `allowlist`；`unrestricted` 必须由用户在当前任务中显式授权。
- 改任何函数、类、方法或共享符号前，workcard 必须记录 GitNexus impact 结果；提交前必须记录 `gitnexus_detect_changes` 结果。
- 不为 read-only reviewer/audit/debate/drafter/refiner 额外询问用户确认。
- 如果写入范围不清、需要扩大 scope、涉及破坏性操作或跨越冻结范围，必须先停止并报告。
- 每个子智能体必须记录中文别名、agent id、工具 nickname、role id、模型、推理强度、结果首行是否使用中文别名、是否采纳和是否关闭。

## 1.4 调度判定与上下文卫生

主线程允许扮演 `gai2-orchestrator`，但必须真正履行调度职责。Medium+ GAI2 执行前必须输出调度判定：

```text
调度判定：
- 分类：
- 当前事实：
- 需要变化：
- 本地主线程动作：
- 子智能体判定：
- 选中角色：
- 跳过角色：
- 并发预算/当前并发/依据：
- 调研判定/来源/预算：
- 编排模式/借鉴判定：
- 模型/推理/fork_context：
- 写入范围：
- policy_state/gap_history：
- 等待点：
- 关闭点：
- 下一步：
```

如果没有创建子智能体，必须说明原因。不能只写“主线程扮演调度器”但没有调度判定。

子智能体用于保护主线程上下文：

- 宽范围文件巡检、调研、事实确认、风险审计、reviewer 复核、方案辩论、MINIONS 起草/精修，默认优先考虑只读 sidecar。
- 子智能体的中间上下文不展开塞回主线程；主线程只消费结构化摘要、文件/行号证据、verdict、风险和下一步。
- 子智能体任务单必须要求紧凑结构化输出，默认不超过 20 行、证据不超过 8 条，禁止倾倒长篇原文；优先返回路径、行号、结论和建议，而不是复制文件正文。
- 最终综合判断和高耦合调度仍由主线程承担；紧急阻塞写入和高耦合编辑在 GAI2 下仍必须交给 `gai2-builder` worker。工具不可用时只能记录本地降级，closeout 不超过 `PARTIAL`，除非用户显式接受本地执行。
- Medium+ 宽范围审计/探索/复核如果没有创建 sidecar，必须在调度判定中解释为什么主线程更快且不会撑大上下文。

## 2. 当前 Codex 能力

`spawn_agent` 当前支持以下关键参数：

- `agent_type`: `explorer` 适合只读代码问题，`worker` 适合有清晰 ownership 的实现任务，`default` 用于普通任务。
- `model`: 可覆盖父线程模型。可用模型包括 `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.3-codex-spark`。
- `reasoning_effort`: 可按任务设置 `low`、`medium`、`high`、`xhigh`。
- `fork_context`: 只有需要继承当前长上下文时才开启；摘要、文档审计、独立检索默认关闭。
- `service_tier`: 默认继承，不主动改，除非用户明确要求。

默认原则：当前账号按 Pro 资源使用策略处理，forthAMS 自主 GAI2 子 agent 默认从 `gpt-5.5` 起步；MINIONS 双推理例外，固定使用真实 `gai2-drafter` 和 `gai2-refiner` 子 agent 链：`gai2-drafter` 用 `gpt-5.4 + xhigh` 起草，`gai2-refiner` 用 `gpt-5.5 + high` 精修，随后由 `gai2-orchestrator` 只做 adjudication。成本、速度和深度主要通过 `reasoning_effort` 分层控制：机械确认和汇总用 `low`，旁路审计用 `medium`，迁移、权限、安全、跨模块 reviewer 用 `high/xhigh`。用户已明确确认 Codex 全局和 forthAMS 覆盖 Opencode 的 Spark lane + inherit-current-session-model 默认，不再把 Spark lane 写成 MINIONS 默认；因此以下路由表作为后续 GAI2 执行依据。

执行口径：轻任务不再默认使用 spark/mini 或 `gpt-5.4`；默认使用 `gpt-5.5 + low`。`gpt-5.4` 的常规默认用途是 MINIONS drafter。只有强实时、极低风险、可由主线程马上复核的任务才考虑 `gpt-5.4-mini` 或 `gpt-5.3-codex-spark`。

## 3. 路由表

| 档位 | 适用任务 | 推荐 agent_type | 推荐模型 | 推理强度 | 写入范围 | 超时 |
|---|---|---|---|---|---|---:|
| S0 汇总/确认 | 总结测试输出、确认文件/结果是否存在、命令结果归纳、状态表整理 | `explorer` | `gpt-5.5` | `low` | `readonly` | 30-60s |
| S1 窄范围探索 | 查某条链路、找文件/引用、对比文档与源码 | `explorer` | `gpt-5.5` | `low` 或 `medium` | `readonly` | 60-120s |
| S1/S2 调研 | 官方文档、上游仓库、社区/竞品、模型/工具选型、最新或不稳定事实核验 | `explorer` | `gpt-5.5` | `low` 或 `medium` | `readonly` | 60-180s |
| S2 旁路审计 | 验证主线程补丁风险、查遗漏测试、发布清单复核 | `explorer` | `gpt-5.5` | `medium` | `readonly` | 120s |
| S3 独立实现 | 明确 ownership、互不冲突的代码补丁 | `worker` | `gpt-5.5` | `medium` 或 `high` | `allowlist` | 5-10min |
| S4 高风险复核 | 数据迁移、安全权限、跨模块 API、提交前 reviewer | `explorer` | `gpt-5.5` | `high` 或 `xhigh` | `readonly` | 3-5min |

禁止项：

- 不给 S0/S1 开 `fork_context=true`，除非任务必须依赖当前长上下文。
- 不把调度和最终综合外包给子 agent；但 GAI2 关键修复只要写文件，仍必须由 `gai2-builder` worker 在 allowlist 内执行。工具不可用时记录降级，closeout 不超过 `PARTIAL`，除非用户显式接受本地执行。
- 不同时开启多个写入型 worker，除非文件 ownership 完全不重叠。
- 不让子 agent 碰 `frontend/src/pages/mobile/**` 或移动端路由，直到用户解除移动端冻结。

## 4. 创建前决策流程

每次创建子 agent 前，主线程先完成 9 个判断：

1. **必要性**：这个任务是否真的需要 agent？如果是非 GAI2、纯只读、低风险检查，且主线程 1-2 个 `rg/sed` 就能完成，可以不创建；GAI2 写入、PASS 审查和 MINIONS 强制链路不适用此豁免。
2. **并行性**：它是否能与主线程下一步并行？如果主线程必须等结果才能继续，仍按角色门禁判断：只读小检查可本地完成，写入交 `gai2-builder`，PASS 审查交 `gai2-reviewer`，工具不可用则记录降级。
3. **边界**：是否能用 1-3 个文件、路径、命令或问题定义清楚？不能定义清楚就先缩小问题。
4. **调研**：是否涉及外部资料、社区/竞品、最新信息、官方文档、上游仓库、论文、模型/工具选型或不稳定事实？如果是，创建或模拟 `gai2-research`，并记录来源预算；如果跳过，记录原因。
5. **编排模式**：如果任务要改 GAI2/蜂群/模型路由/子 agent 规则，先选择 supervisor/subagents、handoff、workflow/checkpoint、council/swarm 或 hybrid，并输出 borrow/adapt/reject；不能先落地再补调研。
6. **风险**：是否涉及写文件、迁移、权限、安全、提交？风险越高，模型和推理强度越高。
7. **身份头**：handoff 是否包含 role_id、中文别名、一句话职责、权限边界和首行输出要求？
8. **产物**：输出是否有固定格式？必须要求文件路径、证据、结论、建议动作，避免泛泛审计。
9. **回收**：是否有明确等待点和关闭点？创建时就要知道什么时候 `wait_agent`、什么时候 `close_agent`。

注意：GAI2 下这些判断由调度器自主完成，不需要每次向用户请示是否创建子智能体。请示只发生在写入范围、破坏性操作、冻结范围或外部权限不清时。

上下文策略：如果一个子任务会读取大量文件、产生大量中间推理或只是旁路审计，就优先交给只读子智能体；主线程只接收压缩后的证据和结论，避免主线程上下文过大。

## 5. 标准任务单模板

```text
你是 GAI2 <role>。工作区：/Users/feigao/project/Project/forthAMS。
任务类型：readonly | allowlist。
允许范围：<paths/globs>。
禁止范围：frontend/src/pages/mobile/** 写入、移动端路由变更、无关文件。允许只读检查冻结边界是否被破坏。
目标：<一个具体问题>。
身份头：
你是 GAI2 <中文角色名>，role_id: <role id>。
你的中文别名是 <如 审查员一号>。
你的职责是：<一句话职责>。
权限边界：readonly | allowlist；<只读角色不得修改文件 / builder 只能写入 allowlist>。
输出第一行必须写：我是<中文别名>，role_id: <role id>。
调研判定：required | useful | skipped；来源预算：<官方/上游/社区/本地路径/网页数量>；跳过原因：<如适用>。
编排模式：supervisor/subagents | handoff | workflow/checkpoint | council/swarm | hybrid | n/a。
工具与权限：允许的工具/动作；禁止的工具/动作；敏感值必须脱敏，不得复制 API key/token/password。
验收项：AC-1 <...>；AC-2 <...>。
请输出中文：
1) 中文别名 / role_id / 档位 / model / reasoning / fork_context；
2) acceptance_status：逐项列 AC-1/AC-2 的 PASS/PARTIAL/FAIL；
3) research_evidence_map：如果调研 required/useful，列来源、日期/版本/路径、可信度和结论；
4) evidence_map：每个 AC 对应文件路径、命令、行号或结果；
5) policy_state / gap_history / write_scope_check；
6) tool_trace_summary：列工具/命令、失败/超时、redaction status，不包含敏感值；
7) gaps / risks；
8) repair_recommendation / 最小下一步；
9) verdict：PASS/PARTIAL/FAIL。
默认不超过 20 行、证据不超过 8 条；不要倾倒长篇原文。
不要修改文件，除非本任务明确给出 allowlist 写入范围。
```

写入型 worker 追加：

```text
你不是独占工作区；不要回滚他人改动。
只能修改：<allowlist>。
完成后列出 changed files、测试命令、未验证项。
```

## 6. 生命周期控制

1. **Admission control**：活跃子 agent 数量由任务拆分决定，不设固定硬上限。普通任务以 1-2 个作为保守起点；当子任务彼此独立、并行有收益、无重复工作、符合工具/资源限制，并且调度判定写清等待点和关闭点时，可以扩大并发。多个写入型 worker 仅在 allowlist ownership 完全不重叠时允许。
2. **No duplicate work**：同一个未解决问题只能有 1 个子 agent；后续问题优先 `send_input` 复用。
3. **Wait sparingly**：只有主线程被结果阻塞时才 `wait_agent`；否则主线程继续做不重叠工作。
4. **收束策略**：超时或输出发散时，立即 `send_input(interrupt=true)`，要求“停止扩展读取，返回当前证据”。
5. **关闭策略**：子 agent 完成或被判定无效后立刻 `close_agent`，避免侧栏累计和资源占用。
6. **升级策略**：低档 agent 返回 `PARTIAL` 时，只允许一次升级重试；仍不足则进入 repair、blocked、用户输入或工具缺口 `PARTIAL`，不得让主线程静默接管 builder/reviewer 职责。
7. **质量门禁**：没有文件/命令/行号证据的结论不能作为完成证据，只能作为线索。
8. **独立审查**：Medium+ closeout 和任何声称 `PASS` 的 GAI2 run 必须创建并消费独立 `gai2-reviewer` verdict；如果工具不可用，必须记录原因且 verdict 不能超过 `PARTIAL`，除非用户显式接受本地审查。
9. **策略状态**：每次 Medium+ closeout 记录 `policy_state` 和 `gap_history`；同一 `gap_fingerprint` 多次重复且无新证据时，不继续盲目派 agent，转为 repair、blocked 或请求用户输入。
10. **脱敏审计**：如果读取配置、日志、插件、权限文件或命令输出中出现密钥/令牌/密码，只总结存在性与风险，不复制值；closeout 必须记录 redaction status。

## 7. Opencode GAI2 角色映射

| 原 Opencode 角色 | 中文显示 | Codex/forthAMS 适配 | 默认模型/推理 |
|---|---|---|---|
| `gai2` | GAI2 总入口 | `gai` 技能 + Codex native goal；不创建独立 agent | 主线程 |
| `gai2-orchestrator` | GAI2 调度器 | 必经调度角色；默认由主线程扮演，只负责分诊、阶段推进、模型路由、子 agent admission、等待/消费/关闭结果、MINIONS adjudication 和最终汇总；不得实现业务/规则文件改动、不得把自己的工具调用或测试当完成证据、不得自评 `PASS` | 主线程或 `gpt-5.5` / `high` |
| `gai2-triage` | 分诊专家 | 判断复杂度、范围、风险、write_scope 和证据需求 | `gpt-5.5` / `low` 或 `medium` |
| `gai2-research` | 调研专家 | 只读调研外部/最新/社区/官方/上游/论文/模型工具证据，或确认可跳过调研并说明原因 | `gpt-5.5` / `low` 或 `medium` |
| `gai2-audit` | 实施前审计专家 | 审计当前代码、测试、配置、GitNexus 风险与用户脏改 | 模型 `gpt-5.5`；推理 `medium` |
| `gai2-debate` | 方案辩论专家 | 对 2-3 个方案做取舍，给出推荐与风险 | 模型 `gpt-5.5`；推理 `medium` |
| `gai2-drafter` | MINIONS 起草专家 | 真实子 agent；起草方案、补丁草图、测试策略或文档结构，并产出可消费 artifact/result | `gpt-5.4` / `xhigh` |
| `gai2-refiner` | MINIONS 精修专家 | 真实子 agent；反驳/精修 drafter 输出，压缩范围、补证据和边界，并产出可消费 artifact/result；`gai2-refine` 只作为此 role id 的别名 | `gpt-5.5` / `high` |
| `gai2-builder` | 执行变更专家 | Codex `worker` 子 agent；在明确 allowlist 下执行代码/测试/文档变更 | 模型 `gpt-5.5`；推理 `medium` 或 `high` |
| `gai2-reviewer` | 最终审查专家 | 独立只读子 agent；closeout 前做 PASS/PARTIAL/FAIL、gap fingerprint、证据映射；`PASS` 必须消费其 verdict | `gpt-5.5` / `high` 或 `xhigh` |

注意：Codex 当前优先采用“主线程 orchestrator + 扁平子 agent”的模式，避免嵌套调度失控。`gai2-orchestrator` 必须出现在 Medium+ workcard 中；它可以是主线程逻辑角色，不必每次实际创建一个同名子 agent。GAI2 触发后，调度器默认拥有自主分配子智能体的权限，但不能接管 builder/reviewer，也不能用文本声明替代 MINIONS drafter/refiner 真实链路。

## 8. forthAMS 领域专家映射

专家子 agent 的分配也基于本路由生效：先按问题选择 GAI2 专家角色，再映射到 S0-S4 档位，最后由档位决定 `model`、`reasoning_effort`、`write_scope` 和是否允许并行。

| 领域 lens | 默认档位 | 默认模型/推理 | 用途 |
|---|---|---|---|
| `verification-ops` | S0/S2 | `gpt-5.5` / `low` 或 `medium` | 汇总测试、核对报告、查证据漂移 |
| `external-research` | S1/S2 | `gpt-5.5` / `low` 或 `medium` | 官方文档、上游仓库、社区/竞品、最新事实、模型/工具选型证据 |
| `data-model` | S2/S4 | 模型 `gpt-5.5`；推理 `medium` 或 `high` | SQL、迁移、schema/fresh install 一致性 |
| `risk-security` | S4 | `gpt-5.5` / `high` 或 `xhigh` | 权限、认证、越权、审计日志 |
| `product-ux` | S1/S2 | `gpt-5.5` / `low` 或 `medium` | 桌面端路径、只读/失败提示、入口可达 |
| `delivery-minimal-change` | S2/S3 | 模型 `gpt-5.5`；推理 `medium` 或 `high` | 检查补丁是否过宽，或做窄范围实现 |
| `architecture-integration` | S3/S4 | `gpt-5.5` / `high` | 跨模块接口、若依整合、服务边界 |

命名 lens 落地示例：

```text
lens: delivery-minimal-change
GAI2 role: gai2-debate 或 gai2-reviewer
档位: S2 readonly，必要时升级 S3 allowlist worker
prompt: 检查补丁是否超过 AC-1/AC-2 的最小范围，返回 evidence_map 和 repair_recommendation
ledger: 中文别名、agent id/nickname、role id、档位、model/reasoning、fork_context、verdict、是否关闭、是否采纳
close: 结果消费后立即 close_agent；PARTIAL 只允许一次升级，仍不足则进入 repair、blocked、用户输入或工具缺口 PARTIAL
```

## 9. 示例

### 结果存在性确认

```json
{
  "agent_type": "explorer",
  "model": "gpt-5.5",
  "reasoning_effort": "low",
  "fork_context": false
}
```

适用：确认某个测试结果、文件、配置项、报告数字是否存在；要求输出文件路径、命令或行号证据。

### 后端迁移审计

```json
{
  "agent_type": "explorer",
  "model": "gpt-5.5",
  "reasoning_effort": "high",
  "fork_context": false
}
```

适用：检查 MySQL 迁移幂等性、fresh schema 一致性、租户字段默认值。

### 独立文件补丁

```json
{
  "agent_type": "worker",
  "model": "gpt-5.5",
  "reasoning_effort": "medium",
  "fork_context": false
}
```

适用：明确 allowlist 的单模块测试补齐或文档规则落地。只有任务必须继承当前长上下文时才改为 `fork_context:true`，并在调度判定中说明理由。worker 返回后主线程只消费结果、汇总证据和调度后续 reviewer；完成权威来自独立 `gai2-reviewer` verdict。

## 10. 记录指标

每次 GAI2 蜂群在交付记录中最少记录：

- 中文别名 / role
- agent id / nickname
- role id / 档位
- model / reasoning_effort
- write_scope
- 是否 fork_context
- AC-ID acceptance_status
- research_decision / research_evidence_map（当调研 required/useful）
- pattern_selection / borrow-adapt-reject（当 GAI2 编排、模型路由、蜂群或子 agent 规则发生变化）
- state_pack / policy_state / gap_history
- identity_header_check / Chinese alias check（当创建子 agent）
- evidence_map
- tool_trace_summary / redaction status
- 结果：PASS/PARTIAL/FAIL
- 结果首行是否使用中文别名
- 是否关闭
- 主线程是否采纳其结论

这能避免“看起来开了很多 agent，但没有价值产出”的问题，也能逐步沉淀哪些任务适合低模型，哪些必须升级。

### 当前已启用样例

以下为历史实际调用记录，保留当时使用的模型以便审计。自 2026-06-12 本配置确认后，新建普通子 agent 默认按 `gpt-5.5 + reasoning_effort` 分层执行；MINIONS 双推理按 `gpt-5.4 -> gpt-5.5` 执行。

| 时间 | 中文别名 / agent | role / 档位 | model / reasoning | write_scope | fork_context | 结果 | 关闭 | 采纳 |
|---|---|---|---|---|---|---|---|---|
| 2026-06-12 | 验证员一号（工具名 Sagan，`019ebc05-f987-75e1-ab20-c655b5c6beda`） | `verification-ops` / S0-S1 | `gpt-5.4` / `low` | `readonly` | `false` | `PARTIAL`，完成 CI gate 配置旁路审计，但锁文件、Playwright project、测试类存在性由主线程补证 | 已关闭 | 部分采纳，作为线索后由主线程验证 |
| 2026-06-12 | 验证员二号（工具名 Turing，`019ebc10-f8af-7723-b84d-15532f7a7b83`） | `verification-ops` / S2 | `gpt-5.4` / `low` | `readonly` | `false` | `PARTIAL`，确认 browser regression 可升真实执行，但需补 Playwright browser 安装与命名调整 | 已关闭 | 采纳，主线程已实测 26/26 并升级 gate |

## 11. 对当前项目的执行建议

从当前轮起采用：

- 文档同步、测试结果整理、存在性确认：S0，`gpt-5.5` + `low`。
- 外部资料、社区/竞品、官方/上游、模型/工具选型、最新事实核验：S1/S2，`gpt-5.5` + `low/medium`，优先只读 `gai2-research`。
- 桌面路径可达性和只读 UX 审计：S1/S2，`gpt-5.5` + `low/medium`。
- SQL 迁移、若依权限、安全边界：S4，`gpt-5.5` + `high/xhigh`。
- 主线程保留最终调度、整合、MINIONS adjudication 和汇总；不保留 GAI2 写入实现、完成审查或自评 `PASS` 权限。所有 GAI2 写入实现/修复/文档规则落地由 `gai2-builder` worker 在明确 allowlist、ownership 不重叠且不触碰冻结范围时执行；Medium+ 和任何 `PASS` 由独立 `gai2-reviewer` 按 AC-ID 证据映射给出。
