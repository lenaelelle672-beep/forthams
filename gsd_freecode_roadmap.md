# GSD × freecode 整合主文档

> 当前唯一主线：**Python GSD + FreecodeExecutor**
> 本文整合 `freecode_integration_plan.md` 的决策结论和本路线图的实施计划；`freecode_integration_plan.md` 仅保留为历史方案对比。
> 原则：每阶段跑稳再进下一阶段，不跳步。

---

## 总览

```
Phase 1  FreecodeExecutor 核心（单 Agent）      → 消灭漂移根因
Phase 2  SwarmRoleProxy 上下文注入修复           → 修复蜂群上下文饥饿
Phase 3  文件分区锁 + 安全并发                   → 开启多 Agent 并发
Phase 4  Loop 稳定性加固                        → 防止发散和 Token 超限
Phase 5  工具集扩展                             → 提升执行能力上限
```

---

## 当前架构结论

| 决策点 | 当前结论 | 原因 |
|---|---|---|
| 主体架构 | GSD 继续作为 Python 控制面 | GSD 负责 workflow、contract、gate、state、trace、audit、artifact recovery |
| 执行器 | `FreecodeExecutor` 是唯一代码执行器 | 用 XML tool loop + pre-read 协议替换 `VibeExecutor`，降低 patch/old_code 漂移 |
| freecode 形态 | 移植执行范式，不黑盒调用 Rust CLI | 黑盒 subprocess/HTTP 会丢失 LLM 路由、熔断器、MINIONS、token 追踪、ContextOptimizer 和共享状态 |
| Rust 化 | 当前不作为主线 | 当前瓶颈是 LLM/API 延迟、上下文控制和验收闭环，不是 Python 执行速度 |
| 并发策略 | 先共享上下文，再文件分区并发 | 没有文件边界和写权限约束前，不开放裸并发 |
| 验收策略 | 每阶段独立验收 | 不做一次性全量重写，不靠 prompt 承担安全边界 |

一句话：**GSD 管边界和验收，FreecodeExecutor 在边界内写代码；Rust 化只作为远期专项评估，不进入当前 roadmap。**

---

## Phase 1：FreecodeExecutor 核心（单 Agent）

### 目标

用 XML 工具协议 + Agentic Loop 替换 VibeExecutor，消灭代码漂移的三层根因：
- 协议层：XML 替换 Opencode Patch
- 上下文层：Loop 内强制 pre-read，模型看到真实文件内容
- 架构层：有纠错循环，replace 失败模型可重试

### 交付物

**新增文件：`src/agents/freecode_executor.py`（~350 行）**

```
class FreecodeExecutor:
    __init__(workspace, llm_client, context_optimizer)
    run(context: dict, max_turns=40) → dict
        {
          "changed_files": [...],
          "summary": "...",
          "turns_used": N,
          "success": bool
        }

    # 工具实现（8个）
    _tool_read_file(path, start, end) → str
    _tool_replace(file, old, new) → str        # 含 fuzzy hint
    _tool_write_file(path, content) → str      # >100行拒绝
    _tool_run_cmd(cmd) → str                   # 危险命令拦截
    _tool_grep(pattern, path) → str
    _tool_find(name, path) → str
    _tool_ls(path) → str
    _tool_read_outline(path) → str             # AST 骨架

    # 内部机制
    _parse_tool_call(response) → dict | None   # XML 解析
    _pre_write_syntax_check(path, code) → (bool, str)  # 复用 Orchestrator
    _is_dangerous(cmd) → bool
    _build_system_prompt() → str
    _build_initial_message(context) → str
```

**SYSTEM_PROMPT 核心规则（强制 pre-read 协议）：**
```
MANDATORY PROTOCOL:
1. Before ANY <replace> on existing file: MUST <read_file> first
2. One tool per turn, wait for <result> before next
3. <replace> failure = read again, fix <old> block, retry
4. <done> requires at least one file change
```

**修改文件：`src/core/gsd_orchestrator.py`（~15 行变化）**
```python
# __init__ 中
- self.vibe_executor = VibeExecutor(workspace_path)
+ self.builder = FreecodeExecutor(workspace_path, self.llm_client, self.context_optimizer)

# _run_builder() 中
- [删除] 两阶段 Tool Calling + VibeExecutor 调用（~200 行）
+ [替换] result = await self.builder.run(context)  # context 从现有逻辑组装
```

**修改文件：`src/core/swarm_agency.py`（~5 行变化）**
```python
# SwarmRoleProxy.__init__ 中
- self.vibe_executor = VibeExecutor(workspace_path)
+ self.executor = FreecodeExecutor(workspace_path, self.llm)

# operate() 中
- raw_out = await asyncio.to_thread(self.llm._sync_generate, ...)
- success = await self.vibe_executor.run_task(raw_out)
+ result = await self.executor.run(context)
+ success = result.get("success", False)
```

**退役文件：`src/agents/vibe_executor.py`（归档，不删除）**

### 上下文组装（复用现有逻辑，不重新开发）

```python
context = {
    "spec": spec_content,                    # 来自 Planner（已有）
    "file_contents": {                       # 来自 _run_builder file_context（已有）
        "path/to/file": "实际内容..."
    },
    "ast_map": topology_context,            # 来自 graph_radar（已有）
    "localization": localization_report,     # 来自 Localizer（已有）
    "ac": contract_md,                       # 来自 ContractNegotiator（已有）
    "project_rules": project_context,        # 来自 .gsd/context/（已有）
    "language_constraints": lang_constraint, # 来自 _detect_project_languages（已有）
    "prev_feedback": evaluator_feedback,     # 来自上轮 Evaluator（已有）
    "method_signatures": preload_sigs,       # 来自 _preload_related_signatures（已有）
}
```

### 验收标准

- [ ] 单个文件修改任务：replace 成功率 ≥ 90%（对比 VibeExecutor 基线）
- [ ] 3 文件 CRUD 任务：串行完成，无 parse failure
- [ ] Loop 内出现 replace 失败时：模型能自动 read_file 重试并成功
- [ ] VibeExecutor 的 4 级模糊匹配不再被触发（彻底下线）
- [ ] 所有现有 Evaluator 测试通过（回归）

---

## Phase 2：SwarmRoleProxy 上下文注入修复

### 目标

修复蜂群 Agent 的上下文饥饿问题。当前 SwarmRoleProxy 只收到 spec + assignment，缺失所有关键上下文，导致蜂群 Agent 必然漂移。

### 问题根因（代码验证）

```python
# swarm_agency.py 当前实现 - 上下文严重不足
query = (
    f"Your Specific Assignment is: {self.assignment}\n\n"
    f"Global Spec:\n{spec_content}"   # ← 仅此而已
)
# 缺失：file_contents、localization、ast_map、method_signatures、ac
```

### 交付物

**修改文件：`src/core/swarm_agency.py`**

SwarmSupervisor 在 spawn Agent 前，将完整 context 传递给每个 SwarmRoleProxy：

```python
# SwarmSupervisor.execute_swarm() 中增加 context 构建
async def execute_swarm(self, user_prompt, spec_file_path, full_context: dict = None):
    # full_context 由 Orchestrator 传入，包含所有已组装好的上下文

    for rm in roles_manifest[:3]:
        proxy = SwarmRoleProxy(
            role_name=rm["role_name"],
            assignment=rm["specific_assignment"],
            workspace_path=self.workspace_path,
            shared_context=full_context,         # ← 新增
            target_files=rm.get("target_files")  # ← 新增：每个 Agent 的目标文件列表
        )
```

**SwarmRoleProxy.operate() 重构：**

```python
async def operate(self, global_spec_path: str) -> bool:
    # 1. 从 shared_context 取出已有的上下文（不重复计算）
    context = {**self.shared_context}

    # 2. 根据 self.target_files 过滤 file_contents（只给自己负责的文件）
    if self.target_files:
        context["file_contents"] = {
            k: v for k, v in context.get("file_contents", {}).items()
            if k in self.target_files
        }

    # 3. 注入角色专属信息
    context["assignment"] = self.assignment
    context["role_name"] = self.role_name

    # 4. 调用 FreecodeExecutor
    result = await self.executor.run(context)
    return result.get("success", False)
```

**Orchestrator 传递 context 到 SwarmAgency：**

```python
# gsd_orchestrator.py - execute_task 中
if use_swarm:
    swarm_result = await self.swarm_supervisor.execute_swarm(
        user_prompt=enhanced_prompt,
        spec_file_path=spec_file,
        full_context=self._build_full_context()  # ← 新增，复用已有组装逻辑
    )
```

### 验收标准

- [ ] SwarmRoleProxy 的每次 LLM 调用包含 file_contents 和 localization
- [ ] 蜂群模式下单个 Agent 的漂移率与单 Agent 模式相当
- [ ] 多 Agent 场景下，每个 Agent 只看到自己负责文件的内容（不超过 Token 预算）

---

## Phase 3：文件分区锁 + 安全并发

### 目标

确保并行 Agent 不写同一个文件，实现真正安全的多 Agent 并发。这是开启并发的前提，没有这个不能并发。

### 交付物

**新增：`src/agents/freecode_executor_pool.py`（~120 行）**

```python
class FilePartition:
    """确保文件无交叉的分组算法"""

    @staticmethod
    def partition(assignments: list[dict]) -> list[list]:
        """
        输入: [{"executor": ..., "context": ..., "target_files": [...]}]
        输出: 可并发的分组，同组内文件集合不相交

        算法：贪心分配
        - 维护已占用文件集合
        - 新 assignment 的文件与已占用无交叉 → 加入当前并发组
        - 有交叉 → 放入下一批次
        """

class FreecodeExecutorPool:
    """asyncio 并发池，不用 ThreadPoolExecutor"""

    def __init__(self, workspace, llm_client, context_optimizer,
                 max_concurrent: int = 3):
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def execute(self, assignments: list[dict]) -> list[dict]:
        """
        1. FilePartition 分组（无交叉的放同批次）
        2. 同批次 asyncio.gather 并发执行
        3. 有交叉的批次串行
        4. 返回所有结果
        """
        groups = FilePartition.partition(assignments)
        all_results = []

        for group in groups:
            tasks = [self._run_one(a) for a in group]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_results.extend(results)

        return all_results

    async def _run_one(self, assignment: dict) -> dict:
        async with self._semaphore:
            executor = FreecodeExecutor(
                self._workspace,
                self._llm_client,
                self._context_optimizer
            )
            return await executor.run(assignment["context"])
```

**修改：`src/core/swarm_agency.py`**

```python
# 替换现有 asyncio.gather 裸调用
# 改为通过 FreecodeExecutorPool 执行，获得文件分区保护
pool = FreecodeExecutorPool(workspace, llm, context_optimizer, max_concurrent=3)
results = await pool.execute(assignments)
```

### 验收标准

- [ ] 6 个 Agent 同时修改 6 个不同文件：无冲突，全部成功
- [ ] 2 个 Agent 被分配到同一个文件：系统自动串行执行，无覆盖丢失
- [ ] 并发场景下 git diff 显示所有预期文件的变更（无丢失）
- [ ] 多文件 CRUD 任务（Controller + Service + Mapper）并发完成时间 < 串行的 50%

---

## Phase 4：Loop 稳定性加固

### 目标

解决 Agentic Loop 的三个已知不稳定点：发散、Token 超限、无响应挂起。

### 交付物

**4.1 防发散机制（`freecode_executor.py` 内）**

```python
# 连续失败计数器
_consecutive_replace_failures = 0

# 在 loop 中检测
if tool == "replace" and result.startswith("ERROR"):
    _consecutive_replace_failures += 1
    if _consecutive_replace_failures >= 3:
        # 强制注入重置指令
        messages.append({
            "role": "user",
            "content": "<result>ERROR: 连续 3 次 replace 失败。"
                       "强制执行：先用 <read_file> 重新读取目标文件，"
                       "确认实际内容后再构造 <replace>。</result>"
        })
        _consecutive_replace_failures = 0
else:
    _consecutive_replace_failures = 0
```

**4.2 Token 预算管理（`freecode_executor.py` 内）**

```python
# 初始 message 构建时做 Token 预算分配
TOKEN_BUDGET = 12000  # 留 4K 给对话历史

def _build_initial_message(self, context: dict) -> str:
    parts = []
    budget = TOKEN_BUDGET

    # 优先级从高到低注入
    for key, limit in [
        ("spec",              3000),
        ("file_contents",     4000),  # 按优先级截断
        ("localization",      1500),
        ("ast_map",           1500),
        ("method_signatures", 1000),
        ("project_rules",      800),
        ("prev_feedback",      500),
        ("ac",                 700),
    ]:
        content = context.get(key, "")
        if not content:
            continue
        estimated = len(content) // 4  # 粗估 token 数
        if estimated > limit:
            content = content[:limit * 4] + "\n... [truncated]"
        parts.append(content)
        budget -= min(estimated, limit)
        if budget <= 0:
            break

    return "\n\n".join(parts)
```

**4.3 Turn 级超时（`freecode_executor.py` 内）**

```python
# 每个 turn 的 LLM 调用加超时保护
try:
    response = await asyncio.wait_for(
        self.llm_client.generate(prompt, role="builder"),
        timeout=120  # 单 turn 最长 2 分钟
    )
except asyncio.TimeoutError:
    # 记录并跳过，不让单次超时拖垮整个任务
    self.logger.warning(f"Turn {turn} 超时，跳过")
    break
```

### 验收标准

- [ ] 模拟 replace 连续失败场景：系统自动重置而不是跑满 40 turn
- [ ] 大文件场景（单文件 > 40KB）：自动截断，不超过 Token 预算
- [ ] LLM API 超时（网络问题）：单 turn 超时不导致整个任务挂起
- [ ] 40 turn 用尽但任务未完成：正常退出，Sprint 循环接管重试

---

## Phase 5：工具集扩展

### 目标

在 FreecodeExecutor 稳定运行后，扩展工具集提升执行能力上限。

### 交付物

| 工具 | 作用 | 实现方式 |
|---|---|---|
| `<run_test path="..."/>` | 执行特定测试文件，结果反馈给模型 | subprocess pytest/mvn -Dtest=... |
| `<git_diff/>` | 查看当前所有变更，帮助模型确认改了什么 | subprocess git diff |
| `<ast_outline path="..."/>` | 单文件完整 AST（class/def/方法签名）| 复用 read_outline 逻辑 |
| `<search_symbol symbol="..."/>` | 全工作区搜索符号定义 | 复用 graph_radar |

### 验收标准

- [ ] `<run_test>` 返回 pytest 输出，模型能根据失败信息自动修复
- [ ] `<git_diff>` 帮助模型避免重复修改已改过的代码
- [ ] 工具扩展后 40 turn 使用量下降（因为更高效的探索）

---

## 里程碑与验收

| 阶段 | 核心指标 | 对比基线 |
|---|---|---|
| Phase 1 完成 | 单 Agent replace 成功率 | VibeExecutor 当前成功率 |
| Phase 2 完成 | 蜂群单 Agent 漂移率 | 与 Phase 1 单 Agent 持平 |
| Phase 3 完成 | 多文件 CRUD 并发无冲突 | Phase 2 串行时间 × 0.5 |
| Phase 4 完成 | 连续 10 次任务无挂起/发散 | Phase 3 稳定性基线 |
| Phase 5 完成 | 平均 turn 数下降 | Phase 4 平均 turn 数 |

---

## 不做什么

| 项目 | 原因 |
|---|---|
| Rust 化（方案 6）| 当前瓶颈是 LLM/API 延迟、上下文控制、contract/gate 权威状态和 trace/audit 闭环；Python 执行层不是已验证瓶颈 |
| ThreadPoolExecutor | LLMClient 无锁，多线程共享有竞态；asyncio.gather 完全够用 |
| Blackboard（v1）| 初始上下文注入已覆盖 90% 需求，等 Phase 3 稳定后再评估 |
| 一次性全量重写 | 每阶段独立验收，确保稳定才推进 |

---

*文档版本：v1.1 — 2026-05-05*
*基于 GSD vib-coding-harness 源码独立验证；整合历史方案文档 `freecode_integration_plan.md`*
