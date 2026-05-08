# GSD × freecode 整合方案决策记录（历史参考）

> 状态：历史方案对比/决策记录，不作为当前实施路线图。
> 当前唯一主文档：`gsd_freecode_roadmap.md`。
> 当前结论：**Python GSD + FreecodeExecutor**，Rust 化只保留为远期专项评估。

---

## 一、问题诊断

### 当前 GSD 的漂移根因

GSD 的 Builder 有两条并存路径，都存在漂移问题：

**路径一（Orchestrator._run_builder）**
```
Tool Calling → apply_code_edit(hunks) → VibeExecutor.apply_hunks()
→ seek_sequence 4级模糊匹配 → 写文件
```
漂移原因：模型生成 `old_code` 时没有读取目标文件，凭空猜测文件内容，导致 hunk 匹配失败。

**路径二（SwarmAgency.SwarmRoleProxy.operate）**
```
LLM 生成 Opencode Patch 文本 → VibeExecutor.run_task() 解析
→ parse_opencode_patch() 正则解析 → apply_hunks()
```
漂移原因：Opencode patch 格式复杂，模型输出稍微偏移即触发解析失败，`*** Begin Patch` 协议脆弱。

**freecode 路径**
```
模型先 read_file → 看到真实内容 → 构造 <old> → <replace>
```
潜在漂移：无强制 pre-read 协议，模型可跳过 `read_file` 直接输出 `<replace>`，`<old>` 依然是猜的。

### 根本结论

**漂移只有一个根因：模型在修改文件时，没有被强制看到文件的真实内容。**

---

## 二、两个系统的能力全景（40 个机制）

### 执行层

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 1 | 代码修改协议 | XML 标签工具（`<replace>` `<write_file>`） | Opencode Patch（`*** Begin Patch`）| **freecode** — XML 结构幻觉少一个数量级 |
| 2 | Agentic 执行循环 | 自主 tool loop，最多 40 turn | Builder 单次 LLM + VibeExecutor 解析 | **freecode** — 自主循环自我纠错能力强 |
| 3 | 工具集 | run_cmd / read_file / read_outline / grep / find / ls / write_file / replace | 只有 write/patch | **freecode** — 工具丰富，模型不需要猜 |
| 4 | Pre-write 语法守卫 | Python py_compile（revert on fail） | Python AST + Java 括号 + TS 括号 | **GSD** — 更完整 |
| 5 | files_changed 守卫 | 有 — 调用 done 前必须有改动 | 有 — 类似逻辑 | 相当 |
| 6 | write_file 大文件限制 | >100 行拒绝，强制用 replace | 无 | **freecode** |
| 7 | 危险命令拦截 | 黑名单 + 用户确认 | Protected patterns（3 个文件） | **freecode** 更通用 |
| 8 | 上下文压缩 | 第 20 turn checkpoint summarization | 4 段式 Head-Knowledge-Summary-Tail + 焦虑检测（14 种模式）| **GSD** 更精细 |
| 9 | 多模型 fallback | OpenRouter 免费榜自动排序 | 多厂商路由 + 熔断器 + MINIONS 双管道 | **GSD** — 生产级 |

### 上下文注入层（漂移的关键）

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 10 | 目标文件内容预注入 | **无** — 靠模型自己 read_file | **有** — 每文件改前先读取（40KB），直接注入 prompt | **GSD** — 消灭漂移的核心 |
| 11 | 工作区 AST 骨架注入 | 无（只有单文件 read_outline） | **有** — graph_radar 全工作区扫描，class/def/行号 | **GSD** |
| 12 | 项目规范文件加载 | 无（AGENTS.md 未加载） | **有** — `.gsd/context/*.md` 自动注入 | **GSD** |
| 13 | 相关方法签名预读 | 无 | **有** — Controller/Service/Mapper 方法签名注入，防幻觉方法名 | **GSD** |
| 14 | 语言栈检测 + 约束 | 无 | **有** — pom.xml/Cargo.toml/go.mod 检测，注入语言约束 | **GSD** |
| 15 | 上轮 Evaluator 反馈注入 | 无 | **有** — 上一次评估失败信息注入 Builder | **GSD 独有** |

### 规划层（战略智能）

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 16 | Spec 生成（Planner） | 无 — 直接执行 prompt | **有** — LLM 生成结构化 spec（需求/阶段/ATB/边界约束）| **GSD 独有** |
| 17 | 3 阶段定位器（Localizer） | 无 — 靠模型自己 ls/grep | **有** — 文件→函数→行，keyword 匹配，压缩到 10 个文件 | **GSD 独有** |
| 18 | ContractNegotiator | 无 | **有** — 3 轮 AC 协商，模糊词审计，verification_method 强绑定 | **GSD 独有** |
| 19 | TestWriter（TDD 前置）| 无（system prompt 鼓励 TDD）| **有** — 独立 Agent，先生成测试再让 Builder 实现 | **GSD 独有** |
| 20 | SwarmAgency（并行 Agent）| 无 — 单线程串行 | **有** — 动态 spawn，TDD 双波执行，6 并发 | **GSD 独有** |
| 21 | Sprint 循环（最多 20 轮）| 无 — 40 turn 直接结束 | **有** — 评估→反馈→重新规划→再建造 | **GSD 独有** |
| 22 | 连续失败追踪 + 终止 | 无 | **有** — 3 次连续失败触发 Investigator | **GSD 独有** |
| 23 | Git stash/rollback 保护 | 无 | **有** — 任务前 stash，compile 失败自动 checkout | **GSD 独有** |

### 评估层（质量门）

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 24 | AC 逐条验证 | 无 — 执行完就 `<done>` | **有** — 每条 AC 独立验证，加权评分，critical AC 死刑 | **GSD 独有** |
| 25 | N-of-M 抗 flaky 策略 | 无 | **有** — 每个 AC 跑 3 次，≥67% 通过算 pass | **GSD 独有** |
| 26 | 8 种失败分类 | 无 | **有** — PASS/CODE_FAIL/TEST_FAIL/INFRA_FAIL/CONTAINER_ENV_DRIFT/FLAKY/NO_SIGNAL | **GSD 独有** |
| 27 | 沙箱 + Host 仲裁 | 无 | **有** — 沙箱失败→同步到 Host 重跑，防 CI 误判 | **GSD 独有** |
| 28 | JSONL 审计日志 | 仅 .freecode.log（文本）| **有** — JSONL 格式，可查询 | **GSD** |

### 记忆与学习层

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 29 | 向量记忆（LanceDB）| 无 | **有** — 历史 sprint 语义搜索，注入 Planner | **GSD 独有** |
| 30 | Investigator + Vaccine | 无 | **有** — 死路诊断，生成 vaccine 存 LanceDB，防重蹈覆辙 | **GSD 独有** |
| 31 | 上下文焦虑检测 | 无 | **有** — 14 种模式检测 token 压力，自动压缩 | **GSD 独有** |
| 32 | 工作区 AST 地图缓存 | 无 | **有** — graph_radar 缓存 symbols，避免重复扫描 | **GSD 独有** |

### 基础设施层

| # | 机制 | freecode | GSD | 优势方 |
|---|---|---|---|---|
| 33 | LLM 路由（多厂商）| OpenRouter 免费榜 | GLM/Kimi/MiniMax/OpenRouter/本地 + 角色→模型映射 | **GSD** — 生产级 |
| 34 | 熔断器 | 无 | **有** — 每个模型 5 次失败熔断 + 全局熔断 | **GSD 独有** |
| 35 | MINIONS 双管道 | 无 | **有** — 本地 draft → 云端 verify，降成本 | **GSD 独有** |
| 36 | Event Bus（SSE）| 无 | **有** — 全流程 vib_bus.emit 状态广播 | **GSD 独有** |
| 37 | EventStore（hash chain）| 无 | **有** — 不可变事件链 + outbox | **GSD 独有** |
| 38 | Token 成本追踪 | 无 | **有** — 每次任务报告 token 用量 | **GSD 独有** |

> **统计：freecode 优势 9 个，GSD 独有/更好 29 个**
>
> freecode 的核心价值在执行协议（XML tool loop），GSD 的核心价值在战略智能（29 个机制）。

---

## 三、六种整合方案

---

### 方案一：Subprocess 黑盒调用

**架构**
```
GSD Python
├─ Planner → Localizer → ContractNegotiator
├─ 构建大 prompt（spec + file_contents + ast_map + localization + ac）
└─ subprocess: echo '{"cwd":"...","prompt":"..."}' | freecode
               ↓ 独立执行 40 turns（黑盒）
               ↓ 写 .freecode.log + 修改文件

GSD Python
└─ 读 git diff → Evaluator → Memory
```

**执行流**
1. GSD 收集所有上下文拼成字符串
2. stdin JSON 传给 freecode 子进程
3. freecode 独立执行，GSD 阻塞等待
4. freecode 结束，GSD 读 `.freecode.log` + `git diff`
5. Evaluator 做 AC 验证

**40 个机制影响**

| 类别 | 状态 | 受影响机制 |
|---|---|---|
| 彻底丢失 | ❌ 7个 | LLM多厂商路由、熔断器、MINIONS双管道、ContextOptimizer、Token追踪、SwarmAgency质量、上下文焦虑检测 |
| 明显降级 | ⚠️ 10个 | 目标文件注入（字符串注入 vs 内存传递）、AST注入、JSONL审计、Event Bus实时性、Investigator信息量、语法守卫、危险命令、TestWriter、Protected patterns、Vaccine精度 |
| 完整保留 | ✅ 23个 | 所有规划层、评估层、记忆层（GSD 侧不变） |

**核心缺陷**：6 个并发 SwarmAgency Agent = 6 个独立 freecode 进程，互不共享记忆和上下文，资源极重。GSD 的 LLMClient 对 freecode 内部的每一次 LLM 调用完全失效。

**适用场景**：快速验证 freecode 比 VibeExecutor 好多少，不适合生产长期。

---

### 方案二：Python 执行内核移植（FreecodeExecutor）⭐ 推荐短期

**架构**
```
GSD Python（统一进程，所有上下文内存共享）
│
├─ Planner → Localizer → ContractNegotiator → TestWriter
│    ↓ 内存传递（零序列化开销）
│
├─ FreecodeExecutor（新增 ~300 行 Python）
│   ├─ SYSTEM prompt：强制 pre-read 协议
│   ├─ 初始 message（内存直接注入）：
│   │   ├─ spec.md 内容
│   │   ├─ 目标文件真实内容（GSD 现有逻辑 _run_builder file_context）
│   │   ├─ 工作区 AST（graph_radar.generate_ast_map()）
│   │   ├─ localization_report
│   │   ├─ contract / AC 列表
│   │   ├─ .gsd/context/*.md 项目规范
│   │   ├─ 语言栈约束
│   │   └─ prev_evaluator_feedback（上轮失败信息）
│   ├─ Agentic loop（每 turn 一工具）：
│   │   ├─ 调用 GSD LLMClient（熔断器 + MINIONS + 多厂商路由全部生效）
│   │   ├─ XML 工具分发（replace/write_file/read_file/read_outline/grep/find/ls/run_cmd）
│   │   ├─ GSD ContextOptimizer 嵌入 loop（每 turn 检测 token 压力）
│   │   ├─ GSD Event Bus emit（每 turn 实时广播）
│   │   ├─ GSD JSONL 审计记录（每 tool call 入库）
│   │   └─ pre-write 语法守卫（Python/Java/TS，复用 _pre_write_syntax_check）
│   └─ 返回 {"changed_files": [...], "summary": "..."}
│
├─ Evaluator（AC 验证，不变）
├─ Investigator + Vaccine（不变，信息量更丰富）
└─ LanceDB Memory（不变）
```

**执行流**
1. Sprint 开始，Planner/Localizer/ContractNegotiator 正常运行（不变）
2. Orchestrator 读取目标文件内容（复用现有 `file_context` 逻辑）
3. Orchestrator 生成 AST 地图（`graph_radar.generate_ast_map()`）
4. 构建 FreecodeExecutor 初始 message（所有上下文内存传递，零序列化）
5. FreecodeExecutor 进入 agentic loop：
   - 调用 `llm_client.generate(prompt, role="builder")` → 享有熔断器、MINIONS
   - 解析 XML 工具标签（`<replace>`, `<read_file>`, `<run_cmd>` 等）
   - 执行工具，结果追加 `<result>...</result>` 到 messages
   - 每 20 turn 触发 ContextOptimizer 压缩（4 段式）
   - 检测到 `<done>` 退出 loop
6. 返回变更文件列表
7. Evaluator 验证，若分数 < 90 注入 feedback 进入下一 sprint

**40 个机制影响**

| 类别 | 状态 | 说明 |
|---|---|---|
| 根本改善 | ✅ 2个 | 代码修改协议（XML替换Opencode patch）、Agentic loop（新增）|
| 完整保留且增强 | ✅ 22个 | 目标文件预注入（内存传递更精准）、AST地图（loop中可实时re-read）、LLM路由、熔断器、MINIONS、ContextOptimizer（嵌入loop每turn检测）、Token追踪、SwarmAgency（asyncio协程共享内存）、Event Bus实时性、JSONL审计（每tool call记录）、Investigator信息量（可分析每个决策）、Vaccine精度、TestWriter |
| 完整保留不变 | ✅ 16个 | Planner、Localizer、ContractNegotiator、Sprint循环、连续失败追踪、Git stash、Evaluator AC验证、N-of-M flaky、8种失败分类、沙箱Host仲裁、LanceDB记忆、上下文焦虑检测、EventStore、.gsd/context/加载、语言约束、相关签名预读 |
| 丢失 | ❌ 0个 | — |

**代码改动清单**

```
新增：
  src/agents/freecode_executor.py  (~300 行)
    - SYSTEM prompt（强制 pre-read 协议）
    - XML 工具解析器（parse_tool_call）
    - 工具实现（run_cmd/read_file/read_outline/grep/find/ls/write_file/replace）
    - Agentic loop（run_loop，最多 40 turn）
    - files_changed 守卫（done 前必须有文件变更）
    - write_file 大文件限制（>100 行拒绝）
    - 危险命令合并拦截

修改：
  src/core/gsd_orchestrator.py
    _run_builder(): 删除 apply_code_edit Tool Calling + VibeExecutor 调用
                    替换为 FreecodeExecutor.run(context) 调用（约 50 行变化）

  src/core/swarm_agency.py
    SwarmRoleProxy.operate(): 用 FreecodeExecutor 替换 VibeExecutor 调用（约 10 行变化）

退役（保留归档）：
  src/agents/vibe_executor.py
```

**工程量**：1–2 周
**零损耗**：40 个机制全部保留或增强

---

### 方案三：结构化文件协议（Task Manifest）

**架构**
```
GSD Python（Phase 1 — 战略层）
├─ Planner → Localizer → ContractNegotiator → TestWriter
└─ 输出 .gsd/task_manifest.json：
   {
     "cwd": "...",
     "target_files": ["src/api/main.py", ...],
     "spec": "...",
     "file_contents": {"src/api/main.py": "...实际内容..."},
     "ast_map": "...",
     "acceptance_criteria": [...],
     "prev_feedback": "...",
     "language_constraints": "Java 项目，禁止生成 Python 代码"
   }

freecode Rust（Phase 2 — 执行层，需改造读取 manifest）
├─ 启动时读取 .gsd/task_manifest.json
├─ 将 manifest 内容注入初始 message
├─ 执行 40 turn tool loop
└─ 输出 .gsd/execution_report.json：
   {
     "files_changed": [...],
     "turns_used": 28,
     "done_summary": "..."
   }

GSD Python（Phase 3 — 评估层）
└─ 读取 execution_report.json + git diff → Evaluator → Memory
```

**40 个机制影响**

| 类别 | 状态 | 说明 |
|---|---|---|
| 根本改善 | ✅ 1个 | 代码修改协议（XML）|
| 可行但次优 | ⚠️ 6个 | 目标文件注入（通过 manifest 文件，比方案一好，但执行期无法动态更新）、AST注入、规范文件、语言约束、相关签名、上轮反馈 |
| 彻底丢失 | ❌ 6个 | LLM路由、熔断器、MINIONS、ContextOptimizer、Token追踪、上下文焦虑检测 |
| 严重降级 | ⚠️ 1个 | SwarmAgency（多 freecode 进程独立，无共享状态）|
| 完整保留 | ✅ 26个 | GSD 战略层 + 评估层 + 记忆层 |

**与方案一的核心区别**：manifest 文件让 freecode 能读到结构化的 file_contents 和 ast_map，比方案一的大字符串 prompt 更精准。但黑盒问题依然存在（LLM路由、熔断器、MINIONS 依然丢失）。

**freecode 需要改造**：支持启动时读取 `task_manifest.json`，结束时写 `execution_report.json`（约 50 行 Rust 改动）。

**适用场景**：需要保持 freecode 作为独立 Rust 工具存在（开源、社区），同时希望与 GSD 有更好的上下文共享。

---

### 方案四：freecode 本地 HTTP 服务（流式 API）

**架构**
```
freecode Rust HTTP Server（改造，监听 localhost:7878）
  POST /run → 接受 task_manifest JSON
           → 流式返回每个 tool call 事件：
             {"event":"tool_call","tool":"read_file","path":"..."}
             {"event":"tool_result","content":"..."}
             {"event":"file_changed","path":"...","old":"...","new":"..."}
             {"event":"done","files_changed":[...],"summary":"..."}

GSD Python
├─ POST /run（发送完整上下文）
├─ 消费 streaming response：
│   ├─ 每个 tool_call → vib_bus.emit（实时前端推送）
│   ├─ 每个 file_changed → JSONL 审计记录
│   └─ 每个事件 → Investigator 可分析
└─ done → Evaluator 验证
```

**相比方案一/三的改进**
- GSD 能实时观测 freecode 每个 tool call（解决黑盒问题）
- Event Bus 实时推送（前端能看到逐步执行）
- Investigator 信息量大幅提升

**依然丢失**：LLM路由、熔断器、MINIONS、Token追踪、SwarmAgency质量（多进程独立）

**额外代价**
- freecode 需要实现 HTTP server（axum/hyper，增加 ~200 行 Rust）
- 两个进程的生命周期管理复杂
- freecode 从"简单工具"变为"服务"，违背其 ~300 行设计哲学
- 网络层 IPC 增加调试难度

**适用场景**：对 freecode 独立性有强要求，且需要实时可观测性，但不愿意做 Python 移植。

---

### 方案五：freecode 作为主体，GSD 组件作为 Rust 调用插件

**架构**
```
freecode Rust（主体，大幅增强）
│
├─ 检测复杂任务 → spawn: python gsd_planner.py → 读 spec.md
├─ 定位文件 → spawn: python gsd_localizer.py → 读 localization.md
├─ 自主执行 tool loop
├─ spawn: python gsd_evaluator.py → 读 evaluation.json → 决定重试
└─ 失败 → spawn: python gsd_investigator.py → 读 vaccine.json
```

**致命问题**
- GSD 各模块依赖 `GsdOrchestrator` 全局状态（LanceDB 连接、LLMClient 实例、Event Bus、图记忆缓存），拆成独立脚本需要每次重新初始化（每个 Python 子进程约 2–5 秒启动开销）
- `SwarmAgency` 依赖 asyncio 共享状态，在这个模型下完全无法工作
- LanceDB 在多个 Python 进程中并发访问需要额外锁机制
- Token 追踪、熔断器、Event Bus 跨进程无法共享状态

**结论**：理论上有趣，工程上代价极高，GSD 40 个机制能正常工作的不超过 15 个。

---

### 方案六：方案二立即执行 + 渐进式 Rust 化（历史备选，当前不作为主线）

> 2026-05-05 更新：当前架构结论已收敛到 **Python GSD + FreecodeExecutor**。Rust 化只保留为历史备选/远期专项评估，不进入当前 roadmap，也不作为长期默认路径。原因见 `gsd_freecode_roadmap.md` 的“不做什么”。

**这是一条演进路径，分三个阶段：**

#### 阶段一（现在，1–2 周）：执行方案二

Python FreecodeExecutor 替换 VibeExecutor，40 个机制全保留，漂移根因消灭。

#### 阶段二（仅在专项评估证明收益后）

将 FreecodeExecutor 从 Python 移植回 Rust，通过 **PyO3** 暴露为 Python 扩展：

```python
# GSD Python 代码完全不变，底层执行变 Rust
import freecode_rs  # PyO3 扩展

result = await freecode_rs.run(
    cwd=workspace,
    initial_message=context,
    llm_callback=gsd_llm_client.generate  # GSD LLMClient 作为回调传入
)
```

该路径不再默认推进；只有当本地 profiling 证明 Python 执行层成为瓶颈，且迁移不会削弱 GSD 的 workflow/gate/state/audit 能力时再重新评估。

#### 阶段三（当前冻结）：按收益顺序迁移各模块到 Rust

| 迁移顺序 | 模块 | Rust 优势 | 关键依赖 |
|---|---|---|---|
| 1 | LanceDB 记忆层 | Rust 原生 API 更好，比 Python wrapper 性能更高 | `lancedb` crate |
| 2 | SwarmAgency 并发 | Tokio 真多线程，无 GIL，6 Agent 真并发 vs Python 假并发 | `tokio::task::spawn` |
| 3 | Localizer（3 阶段）| 纯逻辑，Rust 性能敏感 | `regex` crate |
| 4 | ContextOptimizer | 文本处理 + LLM 调用 | genai crate |
| 5 | Planner / ContractNegotiator | LLM 调用 + 业务逻辑 | genai crate |
| 6 | Evaluator | subprocess 执行 + 文本解析 | tokio::process |
| 7 | Sentence embeddings | 语义搜索 | `fastembed-rs`（支持 all-MiniLM-L6-v2）|

**历史设想**：单一 Rust 二进制，GSD 全部 40 个机制，无 Python runtime 依赖。当前不采用该目标。

**Rust 化的理论收益与当前判断**

| 目标 | Rust 带来什么 |
|---|---|
| 稳定 | 内存安全（无 panic、无 use-after-free）、单二进制分发（无 pip/venv/runtime）|
| 高质量 | SwarmAgency 真并发（Tokio 无 GIL）、LanceDB 原生更可靠 |
| 高效 | 执行速度提升、fastembed-rs 本地 embedding 比 Python SentenceTransformer 更快 |

当前判断：这些收益没有被本地 profiling 证明是当前瓶颈，且 Rust/PyO3 会引入双 runtime、FFI、分发和调试复杂度。因此该路径只保留为远期专项评估。

---

## 四、综合决策矩阵

| 评估维度 | 方案一 | 方案二 | 方案三 | 方案四 | 方案五 | 方案六（历史备选） |
|---|---|---|---|---|---|---|
| 漂移消灭 | ✅ 基本 | ✅ 彻底 | ✅ 基本 | ✅ 基本 | ✅ 基本 | ✅ 彻底（不优先于方案二） |
| 40 机制保留率 | 23/40 | **40/40** | 25/40 | 28/40 | 15/40 | 仅在完整保留 GSD 控制面时成立 |
| LLM 路由 + 熔断器 | ❌ | ✅ | ❌ | ❌ | ❌ | ✅→✅ |
| MINIONS 双管道 | ❌ | ✅ | ❌ | ❌ | ❌ | ✅→✅ |
| SwarmAgency 质量 | ❌ 多进程 | ✅ 协程共享 | ❌ 多进程 | ❌ 多进程 | ❌ 不可用 | 理论增强，未作为当前目标 |
| 实时可观测性 | ❌ | ✅ | ❌ | ✅ | ⚠️ | ✅→✅ |
| Token 成本可控 | ❌ | ✅ | ❌ | ❌ | ❌ | ✅→✅ |
| freecode 独立性 | ✅ | ❌ | ✅ | ✅ | ✅ | 条件成立，代价高 |
| 工程量（执行）| 小 | **中** | 中 | 大 | 极大 | 大 |
| 长期稳定性 | 差 | 中 | 中 | 中 | 差 | 未证实 |
| 风险 | 低 | **低** | 低 | 高 | 极高 | 中→高 |

---

## 五、决策

### 当前决策：选方案二，Rust 化不作为主线

**现在做**：新建 `src/agents/freecode_executor.py`，移植 freecode 的 XML 执行协议和 agentic loop，替换 `VibeExecutor`。GSD 的 40 个机制全部天然接入，漂移从根因消灭，1–2 周内可生产就绪。

**为什么不选方案一/三/四**：这三个方案的本质都是"subprocess 调用 freecode"，代价是永久丢失 LLM路由、熔断器、MINIONS、SwarmAgency 质量、Token 追踪、ContextOptimizer 这 6 个核心机制。"奔着长久去" 意味着这些机制必须完整保留。

**为什么不选方案五**：GSD 各模块依赖 Orchestrator 全局状态，无法拆成独立脚本，SwarmAgency 在这个模型下完全无法工作。

**为什么不默认做 Rust 化**：当前主要瓶颈是 LLM/API 延迟、上下文控制、contract/gate 权威状态、artifact recovery 和 trace/audit，而不是 Python 执行速度。Rust 化可能增加双 runtime、FFI、分发和调试复杂度，不能直接解决当前漂移与证据闭环问题。

### 执行顺序

```
第 1 步（现在）：
  新建 FreecodeExecutor（Python，~300 行）
  修改 gsd_orchestrator._run_builder() 调用 FreecodeExecutor
  修改 swarm_agency.SwarmRoleProxy.operate() 调用 FreecodeExecutor
  退役 VibeExecutor

第 2 步（当前主线）：
  继续强化 Python FreecodeExecutor 的 contract/gate/artifact/trace/audit/lifecycle 能力

第 3 步（仅远期专项评估）：
  若 profiling 证明 Python 执行层成为瓶颈，再独立评估 Rust/PyO3 或局部 Rust 模块
```

---

*文档生成时间：2026-04-27*
*基于 GSD vib-coding-harness + freecode v0.12.1 分析*
