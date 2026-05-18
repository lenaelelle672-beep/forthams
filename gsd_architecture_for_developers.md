# GSD 架构与机制说明

面向对象：开发人员、架构评审、技术分享。

本文说明当前 GSD 的真实架构、每个模块的职责、关键机制的方案选型，以及常见术语解释。

---

## 1. 一句话说明

GSD 是一个面向项目级自动开发的大流程引擎。

它不是简单的“把需求发给模型让它写代码”，而是把需求拆成一条可审计、可恢复、可回滚、可验证的工程流水线：

```text
需求输入
  -> 生成规格 / PRD
  -> 定位代码影响范围
  -> 生成变更契约
  -> 决定单核或团队执行
  -> FreecodeExecutor 执行代码修改
  -> 编译 / 测试 / 验收
  -> 状态打标 / WAL / 长期记忆归档
```

核心目标：

- 降低模型“凭空改代码”的漂移风险。
- 避免修改无关文件。
- 支持长任务中断恢复。
- 支持复杂任务分工并发。
- 让每一步都有状态、证据和回溯能力。

---

## 2. 总体架构

当前架构分成两大平面：

```text
控制平面 Control Plane
  - GsdOrchestrator
  - BuilderPlanRunner
  - GateEngine
  - ExecutionPolicyEngine
  - MutationContract
  - PlanStateStore
  - TaskStatusReporter
  - WAL

执行平面 Execution Plane
  - FreecodeExecutor
  - Freecode Team Mode
  - SwarmSupervisor
  - TestWriter
  - Evaluator
```

### 为什么分成控制平面和执行平面

早期问题是“执行器既决定改哪里，又决定怎么改，还直接写文件”。这种结构会导致：

- 目标文件漂移。
- 模型绕过保护直接改配置。
- 多 Agent 同时写同一文件。
- 回滚范围过大，误伤用户已有改动。
- 出错后无法知道失败发生在哪个步骤。

所以现在采用双平面：

- 控制平面负责决策、边界、状态和安全。
- 执行平面只负责在明确边界内完成代码修改。

---

## 3. 主链路

### 3.1 请求进入

入口：`GsdOrchestrator.execute_task(prompt)`

它做的第一件事不是写代码，而是启动项目级流程：

- 检查工作区状态。
- 启动状态 reporter。
- 启动 Graphify / RepoMap。
- 建立 WAL checkpoint。
- 进入 sprint / epoch 循环。

### 3.2 生成规格文档

模块：`GsdPlanner`

输出：`spec.md`

它负责把用户自然语言需求变成规格文档，内容包括：

- 需求与背景。
- 边界约束。
- 验收测试基准 ATB。
- 开发切入层级序列。

当前注意点：

- 它已经能生成规格文档。
- 后续还可以继续增强为结构化 PRD / user story / task DAG。

### 3.3 代码定位

模块：`GsdLocalizer`、`RepositoryMapMemory`

作用：告诉后续 Builder 应该关注哪些文件、类、方法。

当前支持：

- Python / JS / TS / TSX。
- Java class / interface / enum / record / method。

### 3.4 验收契约

模块：`ContractNegotiator`

作用：把需求变成验收标准。

后续 Evaluator 会根据这些标准判断是否完成。

### 3.5 BuilderPlanRunner

模块：`BuilderPlanRunner`

它是 Builder 执行前的控制平面。

职责：

- 从 spec 和上下文中提取目标文件。
- 归一化路径。
- 生成 `MutationContract`。
- 调用 `GateEngine` 检查工作区。
- 调用 `ExecutionPolicyEngine` 决定 solo / auto / team。
- 预加载目标文件内容。
- 生成 BuilderPlan artifact。

输出示例：

```json
{
  "target_files": ["backend/src/main/java/com/ams/controller/WorkOrderController.java"],
  "execution_policy": {"mode": "force_solo"},
  "mutation_contract": {"allowed_write_paths": ["..."]}
}
```

### 3.6 FreecodeExecutor 执行

模块：`FreecodeExecutor`

这是唯一主路径代码执行器。

它通过 XML 工具协议工作：

```xml
<read_file path="..." />
<replace file="...">
  <old>真实旧代码</old>
  <new>新代码</new>
</replace>
<write_file path="...">...</write_file>
<run_cmd cmd="..." />
<done>summary</done>
```

它不是一次性生成 patch，而是一个 agentic loop：

```text
模型输出一个工具调用
  -> 系统执行工具
  -> 返回结果给模型
  -> 模型继续下一步
  -> 直到 done 或 turn 用尽
```

### 3.7 验证

模块：`GsdEvaluator`

负责：

- 编译检查。
- 测试运行。
- AC 验收。
- 失败信息提炼。

Java 项目会走 Maven，前端项目会走 npm，Python 项目走 pytest。

---

## 4. 核心机制

## 4.1 MutationContract：变更契约

问题：模型经常会改错路径，甚至修改配置、锁文件、环境文件。

方案：在 Builder 之前生成明确的变更契约。

它包含：

- `allowed_write_paths`：允许写入的文件。
- `required_read_paths`：修改前必须读取的文件。
- `blocked_paths`：禁止自动修改的高风险文件。
- `path_aliases`：路径别名映射，例如 `src/main/java/...` 自动归一到 `backend/src/main/java/...`。

为什么选这个方案：

- 比硬编码 protected patterns 更灵活。
- 能针对每轮任务动态生成边界。
- 执行器只要检查白名单即可。
- 可以避免路径漂移。

---

## 4.2 GateEngine：入口安全门

问题：工作区本来就可能有用户改动，自动化系统如果直接改，会混在一起。

方案：`GateEngine` 检查 `git status --porcelain`。

当前策略：

- 工作区 dirty：执行策略倾向 `force_solo`。
- `GSD_WORKER_MODE=1`：跳过主进程 dirty gate。
- 不再默认 `git stash` 用户改动。

为什么不自动 stash：

- stash 会隐藏用户正在做的改动。
- 失败恢复时容易把 spec / wal / 用户文件一起影响。
- 自动化系统不应该偷偷移动用户工作区。

---

## 4.3 ExecutionPolicyEngine：执行策略

作用：决定本轮是单核执行还是团队执行。

模式：

- `force_solo`：强制单核。
- `auto`：允许执行器根据复杂度决定是否升级 team。
- `force_team`：强制团队模式。

当前判断因素：

- 工作区是否 dirty。
- 是否包含 DTO / Entity / Service 接口等基础共享文件。
- 是否包含高风险配置文件。
- 文件数量。
- 可并行分组数量。
- 是否包含测试文件。

为什么不是默认多 Agent：

- 多 Agent 最大风险是文件冲突和上下文不一致。
- Controller / Service / DTO 强耦合任务并行可能互相覆盖。
- 小任务并发收益低于协调成本。

---

## 4.4 Freecode XML 工具协议

早期方案：Opencode Patch。

问题：

- 模型必须输出复杂 patch 格式。
- `old_code` 经常凭空猜测。
- 正则解析容易失败。
- replace 找不到旧代码后容易发散。

当前方案：XML 工具协议 + 强制 pre-read。

规则：

- 修改已有文件前必须 `<read_file>`。
- `<replace><old>` 必须来自真实文件内容。
- 每轮只允许一个工具调用。
- replace 失败后必须重新 read。

为什么选 XML：

- 结构比自然语言稳定。
- 比 patch 格式更容易解析。
- 可以逐步纠错。
- 模型不需要一次性完成全部修改。

---

## 4.5 Attempt 级回滚

早期方案：`git checkout -- .`

问题：

- 会误伤用户已有改动。
- 会回滚 `.gsd/wal.jsonl`、`spec.md` 等状态文件。
- 多 Agent 时更危险。

当前方案：FreecodeExecutor 记录本轮 touched files 的 preimage。

机制：

- 写文件前记录原始内容。
- 编译失败后只恢复本轮 touched files。
- 不再 repo 级回滚。

为什么这么选：

- 回滚范围最小。
- 不影响用户改动。
- 和 MutationContract 白名单天然配合。

---

## 4.6 TaskStatusReporter：后台状态线程

问题：主链路太长，如果每一步都内联打标，异常路径容易漏写状态。

当前方案：独立后台状态线程。

模块：`TaskStatusReporter`

技术实现：

```python
threading.Thread(name="gsd-task-status-reporter")
queue.Queue()
```

职责：

- 消费状态事件。
- 写 `.gsd/plans/...state.json`。
- 写 `.gsd/wal.jsonl`。

事件类型：

- `step_started`
- `step_done`
- `step_failed`
- `mark_step`

为什么用独立线程：

- 主链路很长，避免漏标。
- worker 完成可以异步上报。
- 状态写入逻辑集中管理。
- 后续小任务 DAG 可以直接复用。

为什么不用模型：

- 状态打标是确定性 IO，不需要 LLM。
- 不消耗 token。
- 不受模型 429 / 超时影响。

---

## 4.7 WAL：Write-Ahead Log

WAL 是追加式日志。

文件：`.gsd/wal.jsonl`

作用：

- 记录 checkpoint。
- 记录 epoch 完成。
- 记录 task 完成。
- 记录 step started / done / failed。
- 支持崩溃恢复。

为什么要 WAL：

- JSON state 文件可能只保存最后状态。
- WAL 可以知道系统是怎么走到当前状态的。
- 崩溃后可以根据最后 checkpoint 恢复。

当前 WAL 写入加了 `threading.Lock`，避免状态线程和主线程同时写造成 seq 混乱。

---

## 4.8 PlanStateStore：计划状态文件

文件位置：

```text
.gsd/plans/<task_id>/iteration-<n>-state.json
.gsd/plans/<task_id>/iteration-<n>-builder-plan.json
```

作用：

- 给人看当前任务走到哪一步。
- 给系统做恢复。
- 给演示 / 调试 / 审计提供证据。

示例：

```json
{
  "task_id": "main",
  "iteration": 0,
  "steps": [
    {"id": "planner", "status": "done", "artifact": "spec.md"},
    {"id": "builder_plan", "status": "done"},
    {"id": "worker:t1:implementer", "status": "done"},
    {"id": "evaluator", "status": "done"}
  ]
}
```

---

## 4.9 记忆层

记忆层分三类。

### 短期记忆

模块：`ContextOptimizer`

作用：

- 检测上下文过长。
- 检测模型上下文焦虑。
- 必要时压缩历史消息。

### 图记忆 / 中间层

模块：`GraphifySkill`、`RepositoryMapMemory`

作用：

- Graphify 处理外部知识 / 碎片资料。
- RepoMap 生成项目 AST 结构图。
- Builder 可以看到项目骨架。

### 长期记忆

模块：`LanceDBMemory`

路径：

```text
<workspace>/.gsd/memory/lancedb
```

作用：

- 任务开始前召回相关经验。
- 任务成功 / 失败后沉淀经验。
- 连续失败时写入 vaccine 记忆。

为什么用 LanceDB：

- 支持向量语义检索。
- 比关键词匹配更适合“相似经验召回”。
- 本地持久化，适合项目级知识库。
- 依赖不可用时可降级 JSON 关键词检索。

---

## 5. MINIONS 双推理机制

## 5.1 什么是 MINIONS

MINIONS 是当前系统中的双推理策略。

含义可以理解为：

```text
Local Draft -> Cloud Verify
本地模型先打草稿 -> 云端强模型检查和修正
```

这里的 “minion” 不是一个具体模型名称，而是一种协作模式：本地小兵先干粗活，云端主力做审查。

## 5.2 为什么需要双推理

单纯云端模型的问题：

- 成本高。
- 延迟高。
- 频繁调用容易触发 429。
- 简单任务也要走重模型，不划算。

单纯本地模型的问题：

- 格式稳定性差。
- 复杂代码推理能力弱。
- 容易输出不合法 XML。
- 容易漏需求。

双推理的目标：

- 本地模型降低成本和等待时间。
- 云端模型提高最终答案质量。
- 本地失败时可降级纯云端。
- 云端失败时可保留本地草稿。

## 5.3 当前触发条件

`FreecodeExecutor._infer()` 里判断 `needs_dual`。

触发双推理的情况：

- 目标是代码文件，例如 `.java`、`.py`、`.ts`。
- 上一轮是 `<write_file>` 或 `<replace>`。
- 上一轮结果包含错误。
- 已经多轮探索且有明确目标文件。

不触发双推理的情况：

- 简单探索。
- 简单配置 / markdown。
- 还没有明确目标文件。

## 5.4 方案选型对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 只用云端强模型 | 质量高，格式稳定 | 成本高，慢，容易 429 | 不适合高频工具循环 |
| 只用本地模型 | 成本低，快 | 复杂任务质量不稳，XML 易漂移 | 不适合最终代码提交 |
| 本地 draft + 云端 verify | 成本和质量平衡，失败可降级 | 架构稍复杂 | 当前采用 |
| 多云模型投票 | 稳定性更高 | 成本和延迟很高 | 暂不采用 |

## 5.5 为什么最终选 MINIONS

因为 GSD 的执行器是 tool loop，不是一次性生成。

一次任务可能有 10 到 40 个 turn，如果每个 turn 都用强云端模型，成本和 429 风险会放大。

MINIONS 让系统在关键代码修改时仍有云端校验，而简单探索可以快速通过。

---

## 6. Team Mode 与 Swarm

## 6.1 Freecode Team Mode

这是 `FreecodeExecutor` 内部团队模式。

它会把复杂任务拆成最多 3 个 `TaskNode`：

```json
{
  "id": "t1",
  "role": "test_writer",
  "files": ["tests/test_a.py"],
  "assignment": "write tests",
  "depends_on": [],
  "wave": 1
}
```

执行特点：

- wave 1 先测试。
- wave 2 再实现。
- 同 wave 内文件不冲突则并发。
- 文件冲突则串行。
- 每个 worker 有独立 context window。
- 每个 worker 完成后通过 `TaskStatusReporter` 打标。

## 6.2 SwarmSupervisor

Swarm 是外层多角色分工。

它只在 prompt 中包含 `[SWARM]` 时触发。

特点：

- LLM 先生成角色清单。
- 每个角色用 `SwarmRoleProxy`。
- 每个角色内部仍然走 `FreecodeExecutor`。
- 每个角色强制 `team_mode=force_solo`，避免蜂群套蜂群。
- 使用 `FilePartitionScheduler` 避免同批次文件冲突。

---

## 7. 重要方案选型总结

## 7.1 为什么不继续用 VibeExecutor

VibeExecutor 的核心是 Opencode Patch。

问题：

- 模型输出格式脆弱。
- patch 解析复杂。
- replace old_code 经常不是文件真实内容。
- 修复失败后容易发散。

所以主路径切到 `FreecodeExecutor`。

VibeExecutor 目前只作为 legacy 保留。

## 7.2 为什么不用 subprocess 调 freecode

可选方案：把 Rust freecode 当外部命令调用。

优点：

- 接入快。
- 隔离强。

缺点：

- GSD 的 LLM 路由失效。
- 熔断器失效。
- MINIONS 失效。
- EventBus 实时性下降。
- Swarm 状态难共享。
- 记忆层难注入。

所以当前采用 Python 内核移植：`FreecodeExecutor`。

## 7.3 为什么状态打标用后台线程

可选方案：

- 主链路内联打标。
- 后台状态线程。
- 外部数据库队列。

选择后台状态线程的原因：

- 比内联可靠，减少漏标。
- 比外部队列轻量，不引入新基础设施。
- 可以统一写 PlanState 和 WAL。
- 适合当前单进程架构。

## 7.4 为什么 WAL + state 两套都要有

`state.json` 或 plan state 是当前状态。

WAL 是历史事件。

两者区别：

| 类型 | 作用 |
|---|---|
| PlanState | 给人看当前每个 step 的状态 |
| WAL | 给系统恢复和审计完整事件序列 |

---

## 8. 当前仍可优化的方向

### 8.1 需求拆解上移到控制平面

现在 PRD/spec 有，BuilderPlan 有，但结构化需求树还不完整。

后续可新增：

- `RequirementPlanner`
- `TaskPlanner`
- `PlanTask`

目标链路：

```text
PRD
  -> user stories
  -> plan tasks
  -> task DAG
  -> worker 分发
  -> task-level 状态打标
```

### 8.2 FreecodeExecutor 进一步变纯执行器

现在 `_decompose_tasks()` 还在 `FreecodeExecutor` 内部。

理想状态：

- 控制平面负责拆任务。
- FreecodeExecutor 只负责执行明确 assignment。

### 8.3 Evaluator Java 编译失败应更强硬

当前主链路已有 compile gate。

但 Evaluator 自身也应该把 Java compile failure 视作 fatal，而不是 warning。

---

## 9. GSD 怎么知道任务做到哪了

这是 GSD 和普通一次性 Code Agent 的关键区别之一。

普通 Agent 往往只知道“当前对话到了哪”，但 GSD 需要知道：

- 当前任务进行到第几个 iteration。
- 当前 iteration 走到哪个阶段。
- 哪些 step 已完成。
- 哪些 step 失败了。
- 哪些 worker 已经完成。
- 崩溃后从哪里恢复。
- 哪些 artifact 可以作为证据回看。

所以 GSD 用的是多层状态机制，而不是只靠 roadmap。

### 9.1 Roadmap 不负责运行时进度

Roadmap 是设计路线图，回答的是：

```text
系统未来要做什么
模块按什么阶段演进
哪些能力还没实现
```

它不回答：

```text
这一次任务现在跑到哪里了
planner 是否完成
builder 是否失败
第几个 worker 已经 done
崩溃后应该从哪恢复
```

运行时进度由下面几套机制负责。

---

### 9.2 Checkpoint：粗粒度恢复点

文件：

```text
.gsd/state.json
```

作用：记录当前任务的粗粒度断点。

示例：

```json
{
  "task_id": "main",
  "iteration": 2,
  "prompt": "实现资产报废流程",
  "spec_path": "/project/spec.md",
  "ts": 1234567890.0
}
```

它能回答：

```text
当前任务跑到第几个 epoch / iteration 了
崩溃后从第几轮恢复
```

但它不适合回答更细的问题，例如 builder 内部哪个 worker 完成了。

---

### 9.3 WAL：事件级历史

文件：

```text
.gsd/wal.jsonl
```

WAL 是 Write-Ahead Log，追加写入。

每一行是一条事件，例如：

```json
{"type":"checkpoint","iteration":0}
{"type":"step_started","step_id":"planner"}
{"type":"step_done","step_id":"planner"}
{"type":"step_started","step_id":"builder"}
{"type":"step_failed","step_id":"compile_gate","reason":"compile failed"}
```

它能回答：

```text
系统经历过哪些步骤
每一步开始/结束的顺序是什么
最后一个成功 checkpoint 是哪个
任务是否已经 task_done
```

为什么要 WAL：

- 崩溃恢复时，最终 state 文件可能还没写完。
- WAL 是 append-only，更适合恢复。
- 可以审计系统做过什么。

---

### 9.4 PlanState：当前可读状态

文件：

```text
.gsd/plans/<task_id>/iteration-<n>-state.json
```

它是给人和系统直接看的“当前进度表”。

示例：

```json
{
  "task_id": "main",
  "iteration": 0,
  "steps": [
    {"id": "epoch", "status": "running"},
    {"id": "planner", "status": "done", "artifact": "spec.md"},
    {"id": "localizer", "status": "done"},
    {"id": "builder_plan", "status": "done", "artifact": ".gsd/plans/main/iteration-0-builder-plan.json"},
    {"id": "worker:t1:implementer", "status": "done"},
    {"id": "compile_gate", "status": "failed", "reason": "compile failed"}
  ]
}
```

它能回答：

```text
现在做到哪一步了
哪个阶段 done
哪个阶段 failed
失败原因是什么
相关 artifact 在哪里
```

---

### 9.5 BuilderPlan Artifact：执行前计划证据

文件：

```text
.gsd/plans/<task_id>/iteration-<n>-builder-plan.json
```

它记录 Builder 执行前控制平面的决定。

包含：

- 本轮目标文件。
- MutationContract。
- ExecutionPolicy。
- WorkspaceGate。
- 预加载文件列表。

它能回答：

```text
为什么这一轮只允许改这些文件
为什么选择 force_solo / force_team
当时工作区是不是 dirty
```

---

### 9.6 TaskStatusReporter：后台状态线程

模块：`TaskStatusReporter`

它是 GSD 当前专门负责“做到哪了”的后台线程。

主链路不会直接到处写状态，而是投递事件：

```text
step_started(planner)
step_done(planner)
step_started(builder)
step_failed(compile_gate)
worker:t1:implementer done
```

后台线程消费事件后写：

```text
PlanStateStore
WALWriter
```

为什么要独立线程：

- 主链路很长，内联写状态容易漏。
- worker 并发完成时，需要统一收口。
- 状态写入不应该依赖 LLM 是否正常。
- 即使模型失败，也要能记录失败位置。

---

### 9.7 Metrics：任务级统计

文件：

```text
metrics/metrics.jsonl
```

它记录任务级指标，例如：

- 任务耗时。
- token 用量。
- evaluator score。
- API 调用次数。
- 模型错误次数。

它回答的是：

```text
任务跑得怎么样
成本是多少
成功率如何
耗时多少
```

但它不是精确进度源。

---

### 9.8 这几套状态的关系

可以这样理解：

| 机制 | 粒度 | 作用 | 给谁看 |
|---|---|---|---|
| Roadmap | 产品 / 架构阶段 | 系统未来怎么演进 | 人 |
| Checkpoint | iteration | 崩溃后从哪恢复 | 系统 |
| WAL | 事件流 | 发生过什么 | 系统 + 审计 |
| PlanState | step / worker | 当前做到哪了 | 人 + 系统 |
| BuilderPlan artifact | 执行前决策 | 为什么这样执行 | 人 + 调试 |
| Metrics | 任务统计 | 跑得好不好 | 人 + Dashboard |

一句话：

```text
Roadmap 说明“系统计划做什么”。
PlanState / WAL 说明“当前任务做到哪了”。
```

---

### 9.9 当前能追踪到什么粒度

当前已经能追踪：

- epoch running / done。
- planner started / done。
- localizer started / done。
- repo_map started / done。
- contract started / done。
- test_writer started / done / skipped / failed。
- builder started / done / failed。
- builder_result done / failed。
- compile_gate done / failed。
- evaluator started / done / failed。
- Freecode Team worker done / failed。

下一步可以继续增强：

- Requirement task 级 DAG。
- 每个 user story 的状态。
- 每个 acceptance criteria 的状态。
- Swarm role worker 状态统一接入 reporter。

---

## 10. 上下文与记忆层对比

GSD 的记忆层不是为了“把所有东西都塞给模型”。

真正目标是：

```text
在正确的时间，把正确的上下文放进模型窗口。
```

### 10.1 GSD 的三层记忆

| 层级 | 模块 | 解决的问题 |
|---|---|---|
| 短期记忆 | `ContextOptimizer` | 单次任务上下文膨胀、模型遗忘最初目标 |
| 项目结构记忆 | `RepositoryMapMemory` / `GraphifySkill` | 模型不知道项目结构、入口、类和方法位置 |
| 长期经验记忆 | `LanceDBMemory` | 历史踩坑、成功经验、失败疫苗无法复用 |

### 10.2 需求不匹配怎么处理

需求不匹配不是靠一个 prompt 解决，而是靠多层校验：

```text
用户需求
  -> Planner 生成 spec.md
  -> ContractNegotiator 生成验收标准
  -> Localizer 定位代码
  -> MutationContract 限定可改文件
  -> Evaluator 验收
```

| 问题 | 拦截机制 |
|---|---|
| spec 缩水、省略需求 | spec shrink 检测 |
| 改错文件 | MutationContract |
| 路径漂移 | ProjectProfile 路径归一 |
| 没实现验收条件 | Evaluator / AC |
| 编译失败 | compile gate |
| 连续失败 | Investigator + vaccine memory |
| 上下文丢失 | ContextOptimizer checkpoint |

### 10.3 做错了怎么办

GSD 的错误处理是分层修复。

1. 工具级自纠

```text
replace 找不到 old text
  -> 返回 fuzzy hint
  -> 模型重新 read_file
  -> 再 replace
```

2. Attempt 级回滚

```text
只恢复本轮 touched files
不执行 git checkout -- .
不误伤用户已有改动
```

3. 编译 gate

```text
编译失败
  -> 恢复本轮修改
  -> 注入失败反馈
  -> 下一次 Builder 重试
```

4. 连续失败疫苗

```text
连续失败
  -> RootCauseInvestigator 总结死路
  -> 写入 LanceDB vaccine
  -> 下次相似需求召回
```

### 10.4 和主流 IDE / Code Agent 的上下文管理对比

| 系统 | 上下文策略 | 优点 | 缺点 |
|---|---|---|---|
| Cursor | 项目索引、打开文件、当前光标、embedding 检索、后台压缩 | IDE 体验好，响应快 | 任务级 WAL / 可恢复状态较弱 |
| GitHub Copilot | 当前文件、邻近上下文、IDE 语义信息 | 补全强，延迟低 | 项目级规划和验收弱 |
| ChatGPT / GPT Coding | 当前对话、当前文件/选区、工具结果、系统指令预算 | 泛化强 | 长任务状态需要外部系统承接 |
| Claude Code | agentic tool loop、read/search/edit、长上下文、压缩 | 长任务能力强 | 持久化状态和项目级验收需要外部机制 |
| GSD | RepoMap + Graphify + LanceDB + WAL + PlanState + ContextOptimizer | 项目级流程、可恢复、可审计 | 架构复杂，执行成本更高 |

### 10.5 Cursor 类系统如何管理上下文

Cursor 一类 IDE Agent 通常会维护项目索引：

```text
文件索引
符号索引
embedding 检索
后台上下文压缩
当前编辑区域优先
```

它的特点：

- 当前光标附近代码权重高。
- 当前打开文件权重高。
- 后台索引线程持续更新项目语义。
- 对话过长时用摘要替代完整历史。

这类方案非常适合 IDE 内的实时协作。

但它通常不天然提供：

- 每个任务 step 的 WAL。
- 每个 worker 的完成状态。
- 编译失败后的 attempt 级回滚。
- 项目级长期 vaccine 记忆。

### 10.6 GPT 类系统如何管理上下文

GPT 类 coding agent 更偏当前对话窗口。

常见策略可以理解为：

```text
系统指令预算
当前用户请求
当前文件或选区
最近工具结果
历史对话摘要
```

有些系统会给系统 prompt、工具协议、安全规则预留固定预算，例如 5% 到 10%。

你可以把它理解成：

```text
模型窗口不是全部给业务上下文，必须预留一部分给规则和工具协议。
```

### 10.7 Claude Code 类系统如何管理上下文

Claude Code 这类 agent 的强项是工具循环：

- read file。
- grep / search。
- edit。
- run tests。
- 失败后继续修。

它的优势是模型可以边探索边修改。

GSD 借鉴的是这类 agentic loop 思路，但额外补了：

- MutationContract。
- ExecutionPolicy。
- PlanState。
- WAL。
- LanceDB 长期记忆。
- 后台 TaskStatusReporter。

一句话对比：

```text
Cursor / Copilot 更像聪明的副驾驶。
GSD 更像带施工日志、验收标准、回滚机制和长期记忆的自动施工队。
```

---

## 11. 其他已采用但前文容易漏讲的机制

### 11.1 ProjectProfile：项目画像

模块：`ProjectProfile`

负责识别：

- 后端根目录。
- 前端根目录。
- Java / Python / JS / TS 等语言。
- Maven / npm / pytest 等测试框架。
- 路径归一规则。

为什么重要：

- 避免 Java 项目里生成 Python 后端代码。
- 避免 `src/main/java/...` 漂到错误根目录。
- 自动生成正确测试命令。

### 11.2 TestWriter：TDD 前置

TestWriter 会在 Builder 动手前尝试生成测试。

作用：

- 把需求变成可执行失败用例。
- Builder 的目标从“写功能”变成“让测试变绿”。
- 减少主观验收。

### 11.3 文件漂移检测

Builder 执行后会检查新增未声明文件。

作用：

- 发现模型偷偷创建无关文件。
- 辅助判断是否偏离 spec / localization。

### 11.4 危险命令和 Git 命令拦截

`FreecodeExecutor` 会阻断危险命令，例如：

- `rm`
- `sudo`
- `git reset`
- `git checkout`
- `git add`
- `git commit`
- `git push`

原因：

- Agent 不应该直接控制 Git 历史。
- Git 操作必须由 Orchestrator 统一管理。
- 避免模型执行破坏性命令。

### 11.5 文件分区调度

模块：`FilePartitionScheduler`

作用：

- 同一批并发 worker 的目标文件不能重叠。
- 未知边界任务按高风险处理，自动串行。
- worktree / merge 只做兜底，不做第一防线。

### 11.6 多候选保留

失败时会保留当前得分最高候选 artifact：

```text
.gsd/candidates/best_epoch.diff
.gsd/candidates/best_epoch_untracked/
```

注意：

- 现在只保留 artifact。
- 不再自动 `git checkout -- .`。
- 不再自动重放 diff。

### 11.7 Metrics 与 Prometheus

模块：`MetricsCollector`

作用：

- 记录任务耗时。
- 记录 token 用量。
- 记录 evaluator score。
- 记录 API 调用和错误。
- 如果安装 Prometheus client，可导出指标。

---

## 12. 技术栈与参考资料

### 12.1 项目内部固化文档

这些是当前设计演进的内部依据：

- `freecode_integration_plan.md`：GSD 与 freecode 整合方案、40 个机制对比、六种方案选型。
- `gsd_freecode_roadmap.md`：FreecodeExecutor 分阶段实施路线图。
- `risk_mitigation_plan.md`：Agentic loop 发散、token 超限、并行冲突等风险缓解。
- `implementation_plan.md`：Tool Calling / schema enforcement 的设计动机。
- `gsd_architecture_for_developers.md`：当前面向开发者的架构说明。

### 12.2 外部项目与技术参考

| 主题 | 参考 |
|---|---|
| GSD workflow / gate / hook / state 思想 | https://github.com/gsd-build/get-shit-done |
| freecode XML tool loop 思路 | https://github.com/vibecode/freecode |
| opencode / agent 工具协议参考 | https://github.com/sst/opencode |
| Claude Code / agentic coding 形态 | https://docs.anthropic.com/en/docs/claude-code |
| OpenAI function calling / tools | https://platform.openai.com/docs/guides/function-calling |
| HTTP 429 Too Many Requests | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429 |
| Server-Sent Events / SSE | https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events |
| LanceDB 向量数据库 | https://lancedb.github.io/lancedb/ |
| Sentence Transformers embedding | https://www.sbert.net/ |
| Prometheus metrics | https://prometheus.io/docs/introduction/overview/ |
| Maven | https://maven.apache.org/ |
| pytest | https://docs.pytest.org/ |
| Circuit Breaker 模式 | https://martinfowler.com/bliki/CircuitBreaker.html |

### 12.3 论文 / 思想参考

| 主题 | 在 GSD 中的对应机制 |
|---|---|
| Agentic loop | FreecodeExecutor 工具循环 |
| Task graph / DAG | Freecode Team `TaskNode.depends_on` |
| TDD | TestWriter + Evaluator |
| Write-ahead log | WALWriter / WALReader |
| Vector retrieval / RAG | LanceDBMemory |
| Context compaction | ContextOptimizer |
| File partition / conflict avoidance | FilePartitionScheduler |

### 12.4 为什么文档里要附链接

面向开发人员演讲时，很多概念不是 GSD 独创，而是工程界已有成熟思想。

附链接的作用：

- 方便听众会后深入了解。
- 避免把通用工程机制讲成黑盒玄学。
- 说明 GSD 是把这些机制组合到自动编码场景里。

---

## 13. 术语表

### GSD

Get Shit Done 的缩写。这里指当前自动化开发引擎。

### Harness

Harness 原意是“马具 / 约束装置”。

在软件里常指“测试或执行框架”，负责把被测对象包起来运行、观察和控制。

本项目里的 `vib-coding-harness` 可以理解为：

```text
把模型、代码仓库、测试、记忆、状态、执行器全部串起来的自动编码运行框架
```

### Agent

能根据目标自主调用工具完成任务的模型执行单元。

### Agentic Loop

模型不是一次性输出最终答案，而是循环执行：

```text
思考下一步 -> 调工具 -> 看结果 -> 再调工具 -> done
```

### Control Plane

控制平面。负责决策、策略、安全、状态。

### Execution Plane

执行平面。负责真正执行代码修改、命令运行。

### MutationContract

变更契约。规定这一轮允许写哪些文件、禁止写哪些文件。

### Gate

安全门。执行前或执行后的一道检查，例如 dirty workspace gate、compile gate。

### WAL

Write-Ahead Log，预写日志。

先把事件写入日志，再认为状态变化发生。用于崩溃恢复和审计。

### PRD

Product Requirements Document，产品需求文档。

### ATB

Acceptance Test Benchmark，验收测试基准。

简单说就是：做到什么程度才算完成。

### AC

Acceptance Criteria，验收条件。

### RepoMap

代码仓库结构图。提取文件、类、方法，给模型一个项目骨架。

### Graphify

把散落知识、文档、资料转成图谱化上下文的中间层。

### LanceDB

本地向量数据库。用于长期记忆和语义召回。

### Vector Memory

向量记忆。把文本转成 embedding 向量，用相似度搜索历史经验。

### Embedding

把文本变成数字向量的过程。语义相近的文本，向量距离更近。

### MINIONS

本项目里的双推理机制：

```text
Local Draft -> Cloud Verify
```

本地模型先生成草稿，云端模型再验证修正。

### 429

HTTP 状态码，表示 Too Many Requests。

意思是请求太频繁，被服务端限流。

在 LLM API 中常见原因：

- 单位时间请求太多。
- token 用量超过限制。
- 账号额度或并发限制。

### Token

模型处理文本的基本单位。中文、英文、符号都会被切成 token。

LLM 计费和上下文窗口通常按 token 算。

### Context Window

模型一次能看到的最大上下文长度。

超过后，早期内容可能被裁剪或遗忘。

### Context Anxiety

上下文焦虑。模型意识到上下文快满了，开始提前总结、省略或停止。

### Circuit Breaker

熔断器。某个模型连续失败后，临时停止调用它，避免继续浪费时间。

### Fallback

降级策略。主方案失败时自动切换到备用方案。

### Dirty Workspace

工作区存在未提交或未跟踪改动。

### Preimage

修改前的文件内容快照。

用于 attempt 级回滚。

### Swarm

蜂群模式。多个角色或 Agent 并发协作完成任务。

### Team Mode

FreecodeExecutor 内部团队模式。把复杂任务拆成多个 `TaskNode` worker。

### TaskNode

一个可执行的小任务节点，包含角色、文件范围、任务说明和依赖。

### Worker

执行某个 TaskNode 的子执行器。

### FilePartition

文件分区。确保同一批并发任务不会写同一个文件。

### XML Tool Protocol

XML 工具协议。模型通过 XML 标签调用工具，例如 `<read_file />`、`<replace>`。

---

## 14. 演讲时可以强调的主线

可以按这个顺序讲：

1. 传统 AI 写代码的问题不是“模型不够聪明”，而是没有工程控制面。
2. GSD 把自动开发拆成控制平面和执行平面。
3. 控制平面决定边界、策略、状态、安全。
4. 执行平面只在契约内修改代码。
5. Freecode XML loop 解决了 patch 漂移。
6. MINIONS 双推理解决了成本和质量平衡。
7. WAL + PlanState + 后台 reporter 解决了长链路状态丢失。
8. LanceDB + RepoMap + Graphify 解决了长期记忆和项目上下文。
9. 未来会把需求拆解进一步控制平面化，形成完整 task DAG。
