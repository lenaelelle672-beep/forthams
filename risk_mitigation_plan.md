# 执行前风险分析与缓解方案

> 在实施 freecode_executor 之前，必须先有明确的风险应对策略
> 三个风险按严重程度排序，每个给出根因、触发条件、具体方案

---

## 风险一：Agentic Loop 发散（Phase 1 就会出现）

### 根因

```
Turn N:   <replace><old>猜测的内容</old>...</replace>
Result:   ERROR: exact old text not found
Turn N+1: <replace><old>略微不同的猜测</old>...
Result:   ERROR: exact old text not found
...重复到 40 turn 超限，任务失败
```

漂移来源：模型第一次 replace 之前没有 read_file，<old> 块是凭印象写的。
一旦失败，如果没有强制干预，模型会继续猜而不是去读文件。

### 已有的缓解（freecode 原有）

freecode 的 `replace` 工具失败时已经返回 fuzzy hint：

```
ERROR: exact old text not found. However, a similar block was found.
Here is the actual text from the file around that location:
```
def calculate_price(self, qty):     # ← 实际内容
    return qty * self.unit_price
```
Please use this exact text in your <old> block.
```

**这已经是最强的抗发散机制**：模型看到了真实内容，下一次 replace 能精确命中。
大多数情况下一次 fuzzy hint 就能自纠。

### 补充方案（处理模型质量差时的极端情况）

**方案 A：连续失败计数器（必做）**

```python
class FreecodeExecutor:

    def __init__(self, ...):
        self._replace_failures: dict[str, int] = {}  # {file_path: 失败次数}

    def _tool_replace(self, file: str, old: str, new: str) -> str:
        result = self._do_replace(file, old, new)

        if result.startswith("ERROR"):
            self._replace_failures[file] = self._replace_failures.get(file, 0) + 1

            # 连续失败 3 次：强制注入重置指令
            if self._replace_failures[file] >= 3:
                self._replace_failures[file] = 0
                return result + (
                    "\n\n[系统强制介入] 你对此文件已连续 replace 失败 3 次。"
                    "现在必须执行 <read_file> 重新读取文件完整内容，"
                    "确认实际内容后再构造 <old> 块。不允许再次 replace 直到你先 read_file。"
                )
        else:
            self._replace_failures[file] = 0  # 成功则重置
        return result
```

**方案 B：强制 pre-read 的 SYSTEM PROMPT（必做）**

```
MANDATORY PROTOCOL — 违反即任务失败:
1. 修改任何已有文件之前，必须先 <read_file> 读取该文件
2. <replace> 的 <old> 块必须是 read_file 返回结果中的原文，不允许凭印象写
3. replace 失败后必须重新 read_file，不允许直接再次 replace
```

**方案 C：per-file turn 预算（保底）**

```python
_file_turns: dict[str, int] = {}  # 记录每个文件消耗的 turn 数

# 在 loop 中
if current_file in _file_turns and _file_turns[current_file] > 10:
    # 单个文件占用超过 10 turn，说明卡住了
    return "<result>ERROR: 当前文件修改超过 10 turn 未完成，" \
           "请用 <done> 汇报当前状态，由上层系统接管。</result>"
```

### 风险残余

实施 A+B 后，发散概率极低。freecode 的 fuzzy hint + 强制 pre-read + 连续失败重置，
三层防护基本覆盖所有情况。

---

## 风险二：上下文注入后 Token 超限（Phase 1 就会出现）

### 根因

注入初始 message 时，如果把所有上下文全部塞进去：

```
spec（10KB）+ file_contents × N 个文件（40KB × 3 = 120KB）
+ ast_map（4KB）+ localization（3KB）+ method_signatures（2KB）
≈ 139KB ≈ 35,000 tokens
```

加上 Agentic loop 每 turn 积累 1-3KB，20 turn 后总 context 可能到 200KB+。
超过模型 context window 后，早期的 spec 和文件内容会被截断，模型失去任务方向。

### 核心解法：只注入当前目标文件，其余按需 read_file

**最关键的认知转变：**
不需要把所有文件内容预注入。
- 需要预注入的：**当前正在编辑的文件**（防止 <old> 猜错）
- 不需要预注入的：其他文件（让模型用 `<read_file>` 按需获取）

```
初始 message 内容（总量控制在 12,000 tokens 以内）：

SPEC（最高优先，3000 tokens 上限）
当前目标文件完整内容（4000 tokens 上限，超出则注入 AST outline）
localization_report（1500 tokens 上限）
ast_map（1000 tokens 上限）
method_signatures（800 tokens 上限）
project_rules（600 tokens 上限）
prev_feedback（500 tokens 上限）
ac（700 tokens 上限）
────────────────────────────────
合计上限：12,100 tokens
```

**实现：优先级截断器**

```python
def _build_initial_message(self, context: dict, target_file: str) -> str:
    PRIORITIES = [
        ("spec",             3000),
        ("current_file",     4000),   # 仅注入 target_file 的内容
        ("localization",     1500),
        ("ast_map",          1000),
        ("method_signatures", 800),
        ("project_rules",     600),
        ("prev_feedback",     500),
        ("ac",                700),
    ]
    parts = []
    for key, token_limit in PRIORITIES:
        if key == "current_file":
            content = context.get("file_contents", {}).get(target_file, "")
            label = f"[当前目标文件: {target_file}]\n"
        else:
            content = context.get(key, "")
            label = f"[{key}]\n"

        if not content:
            continue

        char_limit = token_limit * 4  # 粗估：1 token ≈ 4 chars
        if len(content) > char_limit:
            content = content[:char_limit] + "\n...[内容过长，已截断。请用 read_file 获取完整内容]"

        parts.append(label + content)

    return "\n\n---\n\n".join(parts)
```

**大文件特殊处理（> 40KB）：**

```python
# 文件超大时，注入 AST outline 而不是全文
if len(file_content) > 40000:
    outline = self._tool_read_outline(target_file)
    file_context = (
        f"[{target_file}] 文件较大（{len(file_content)} 字符），"
        f"已注入 AST 骨架。修改前必须用 read_file 加载具体行范围。\n\n"
        f"{outline}"
    )
else:
    file_context = f"[{target_file}]\n{file_content}"
```

**Loop 中接入现有 ContextOptimizer（已有机制，直接复用）：**

```python
# freecode_executor.py 的 agentic loop 内
# ContextOptimizer 已有：COMPACT_THRESHOLD=15000, RESET_THRESHOLD=80000

action = self.context_optimizer.should_compact_or_reset(
    messages=messages,
    current_tokens=sum(len(m["content"]) for m in messages) // 4
)

if action == "RESET":
    summary = await self.context_optimizer.extract_checkpoint_summary(
        self.llm_client, str(messages)
    )
    messages = [
        {"role": "user", "content": f"[上下文已压缩]\n{summary}\n\n继续未完成的任务。"}
    ]
elif action == "COMPACT":
    # 保留首条（初始 message）+ 最近 10 条
    messages = messages[:1] + messages[-10:]
```

### 风险残余

单文件注入 + ContextOptimizer 接入后，Token 超限概率极低。
唯一残余风险：极大文件（> 40KB）的 outline 仍不够精确。
缓解：outline + line-range read_file 组合，足以让模型精确定位。

---

## 风险三：并行 Agent 文件冲突（Phase 3 才会出现，Phase 1/2 无此风险）

### 根因

```
Agent-A 负责 AssetService.java：
  Turn 0: read_file AssetService.java → 读到内容 V0
  Turn 15: replace AssetService.java → 写入 V1

Agent-B 也被分配修改 AssetService.java：
  Turn 0: read_file AssetService.java → 读到 V0（此时 A 还没写）
  Turn 20: replace AssetService.java → 基于 V0 写入 V1'
  结果：A 的修改被 B 覆盖，B 的 <old> 块也可能不匹配
```

### 根本解法：分派时保证文件不重叠

**思路：在 spawn 之前就确保每个 Agent 负责的文件集合互不相交。**
有交叉的任务放入下一批次串行执行。

```python
class FilePartitionScheduler:
    """
    输入：多个 Agent 的任务，每个任务有 target_files 列表
    输出：分批次的执行计划，同批次内文件不相交
    """

    def partition(self, assignments: list[dict]) -> list[list[dict]]:
        """
        贪心算法：
        1. 遍历所有 assignment
        2. 已占用文件集合 used_files
        3. 当前 assignment 的文件与 used_files 无交叉 → 加入当前批次
        4. 有交叉 → 放入下一批次
        5. 重复直到所有 assignment 分配完毕
        """
        batches = []
        remaining = list(assignments)

        while remaining:
            current_batch = []
            used_in_batch = set()
            next_round = []

            for assignment in remaining:
                files = set(assignment.get("target_files", []))
                if files.isdisjoint(used_in_batch):
                    current_batch.append(assignment)
                    used_in_batch |= files
                else:
                    next_round.append(assignment)

            batches.append(current_batch)
            remaining = next_round

        return batches
```

**关键前提：Orchestrator 在分派 Agent 时必须明确 target_files**

现有 `_draft_agency_manifest()` 用 LLM 生成 manifest，但没有明确文件分配。
需要在生成 manifest 后，结合 Localizer 输出，为每个 role 明确分配文件：

```python
# swarm_agency.py - _draft_agency_manifest() 之后

# 1. 从 Localizer 结果中提取文件列表
all_target_files = self._extract_files_from_localization(localization_report)

# 2. 按 role 分配文件（简单均分或按关键词匹配）
file_assignments = self._assign_files_to_roles(roles_manifest, all_target_files)

# 3. 注入到每个 role 的 manifest
for i, role in enumerate(roles_manifest):
    role["target_files"] = file_assignments[i]
```

**文件分配策略（按层划分，天然不冲突）：**

```python
def _assign_files_to_roles(self, roles, files) -> list[list[str]]:
    """
    Java 项目：按层划分
    - controller 角色 → *Controller.java
    - service 角色 → *Service.java, *ServiceImpl.java
    - mapper/dao 角色 → *Mapper.java, *.xml
    - frontend 角色 → *.tsx, *.vue

    Python 项目：按模块划分
    - api 角色 → api/*.py, routes/*.py
    - service 角色 → services/*.py, domain/*.py
    - test 角色 → tests/*.py, *_test.py
    """
    LAYER_KEYWORDS = {
        "controller": ["Controller", "router", "api", "route"],
        "service":    ["Service", "ServiceImpl", "service", "domain"],
        "mapper":     ["Mapper", "Repository", "mapper", "repo", ".xml"],
        "test":       ["test", "Test", "spec", "Spec"],
        "frontend":   [".tsx", ".vue", ".jsx", ".ts"],
    }
    # 按角色名的关键词匹配文件层
    ...
```

**asyncio.Lock 作为二级保护（兜底）：**

```python
class FreecodeExecutorPool:
    def __init__(self, ...):
        self._file_locks: dict[str, asyncio.Lock] = {}

    def _get_file_lock(self, path: str) -> asyncio.Lock:
        if path not in self._file_locks:
            self._file_locks[path] = asyncio.Lock()
        return self._file_locks[path]

    # 在 FreecodeExecutor._tool_replace() 中
    async def _tool_replace_safe(self, file, old, new):
        lock = self.pool._get_file_lock(file)
        async with lock:
            return self._tool_replace(file, old, new)
```

**注意：FilePartition 是主防线，Lock 只是兜底。**
如果 FilePartition 正确工作，Lock 永远不会真正产生竞争。

### Phase 3 额外风险：Git 命令冲突

多个 Agent 并发执行 `git add`、`git checkout` 会破坏 git 状态。

**解法：Agent 禁止 git 命令，只有 Orchestrator 操作 git**

```python
# freecode_executor.py
FORBIDDEN_IN_AGENT_CONTEXT = [
    "git add", "git commit", "git checkout", "git reset",
    "git stash", "git merge", "git rebase", "git push",
]

def _is_git_command(self, cmd: str) -> bool:
    return any(forbidden in cmd for forbidden in FORBIDDEN_IN_AGENT_CONTEXT)

def _tool_run_cmd(self, cmd: str) -> str:
    if self._is_git_command(cmd):
        return "ERROR: Agent 不允许执行 git 命令。git 操作由 Orchestrator 统一管理。"
    ...
```

### 风险残余

FilePartition + asyncio.Lock + git 禁令三层保护下，并发冲突概率接近零。
唯一残余：FilePartition 分配逻辑本身有 bug，导致分配出现重叠。
缓解：分配完成后做一次校验，有重叠则报错退出而不是带病运行。

---

## 补充风险：超大文件处理（> 40KB）

未在三大风险中列出，但代码中明确存在：

```python
# gsd_orchestrator.py 现有代码
_FILE_CONTENT_CHAR_LIMIT = 40000
if len(existing_content) > _FILE_CONTENT_CHAR_LIMIT:
    truncated = existing_content[:_FILE_CONTENT_CHAR_LIMIT]
    # 截断后注入
```

**问题**：如果要修改的代码在文件的第 41KB 处，截断后注入的内容里没有这段，
模型的 `<old>` 块会凭空捏造 → replace 失败 → 发散。

**方案**：

```python
def _prepare_file_context(self, file_path: str, target_hint: str = "") -> str:
    """
    target_hint：来自 localization_report 的目标函数名/行号

    策略：
    1. 文件 ≤ 40KB：全文注入
    2. 文件 > 40KB：
       a. 注入 AST outline（全文骨架，含行号）
       b. 如果 localization 提供了目标行号：额外注入目标函数 ±50 行
       c. 其余内容：Agent 用 read_file(start, end) 按需获取
    """
    content = self._read_file_raw(file_path)

    if len(content) <= 40000:
        return f"[文件完整内容]\n```\n{content}\n```"

    outline = self._tool_read_outline(file_path)
    result = f"[文件过大（{len(content)} 字符），已注入 AST 骨架。" \
             f"修改前必须用 read_file(start=N, end=M) 读取具体行范围。]\n\n{outline}"

    # 如果有目标行号，额外注入目标区域
    if target_line := self._extract_target_line(target_hint):
        snippet = self._tool_read_file(file_path, target_line - 30, target_line + 50)
        result += f"\n\n[目标区域预览（第 {target_line} 行附近）]\n{snippet}"

    return result
```

---

## 风险汇总与阶段对应

| 风险 | 出现阶段 | 主方案 | 备用方案 | 实施位置 |
|---|---|---|---|---|
| Loop 发散 | Phase 1 起 | SYSTEM PROMPT 强制 pre-read | 连续失败计数器 + per-file turn 预算 | `freecode_executor.py` |
| Token 超限 | Phase 1 起 | 只注入当前目标文件 + 优先级截断 | 接入 ContextOptimizer（已有）| `freecode_executor.py` |
| 超大文件 | Phase 1 起 | AST outline + 目标区域预览 | read_file 按需加载 | `freecode_executor.py` |
| 并行文件冲突 | Phase 3 起 | FilePartition 预分配 | asyncio.Lock 兜底 | `freecode_executor_pool.py` |
| Git 命令冲突 | Phase 3 起 | Agent 禁止 git 命令 | — | `freecode_executor.py` |

**Phase 1 必须实施的风险缓解：**
- Loop 发散（A+B 两层：强制 pre-read prompt + 连续失败计数器）
- Token 超限（只注入当前目标文件 + 优先级截断器 + 接入 ContextOptimizer）
- 超大文件（AST outline 策略）

**Phase 3 才需要实施的风险缓解：**
- FilePartition 文件分区
- asyncio.Lock 兜底
- git 命令禁令

---

*文档版本：v1.0 — 2026-04-27*
*基于 freecode tools.rs、GSD ContextOptimizer、SwarmAgency 源码分析*
