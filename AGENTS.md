<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **forthams** (32650 symbols, 48373 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/forthams/context` | Codebase overview, check index freshness |
| `gitnexus://repo/forthams/clusters` | All functional areas |
| `gitnexus://repo/forthams/processes` | All execution flows |
| `gitnexus://repo/forthams/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# GSD Project Notes

## Key Rules

### GSD Task Prompt Precision (2026-05-07)

**教训：GSD 任务 prompt 必须精确到 SPEC 交付物级别。**

- 禁止笼统描述（如"补全前端页面"）
- 每个 US 必须明确：目标交付物文件路径 + 验收标准 + SPEC 子目标 ID
- 提交前必须检查已有文件清单，区分"已有需修复"和"缺失需新建"
- Prompt 模板：`[SPEC-ID] 交付物: 文件路径. 功能: X. 验收: Y. 技术栈: Z. 参考: 已有文件 A(需修复), B(缺失需新建)`

### GSD Console

- 启动命令见下方 Critical Context
- 重启前必须等待当前任务边界（score= 或 执行完毕）
- 两个 uvicorn 进程同时存在时必须 kill -9 两者再启动新实例

### GSD Verification-Only Flow (2026-05-08)

**教训：验证命令不能走 TestWriter/Builder 开发流程。**

- `npm run build`、`npx vitest run`、`mvn test`、交付物路径检查属于 verification-only 任务
- verification-only 任务只执行真实命令或文件存在性检查，按 exit code / 检查结果直接判定 `score=100` 或失败
- verification-only 任务禁止生成 `tests/test_ac_*.py`，禁止进入 TDD/TestWriter/Builder，禁止让 MutationContract 介入
- 只有真实 build/test/check 失败时，才生成修复任务；修复任务必须精确到 SPEC 交付物路径
- Graphify、MemoryCoordinator、命令执行、交付物检查必须绑定真实项目根目录，不能误扫 GSD sandbox/worktree
- 测试辅助代码只能写入 GSD 临时 harness 目录，不能为了过验收向业务仓库写 `SPEC.py`、`deliverable_checker.py`、`code_analyzer.py`
- React/Java 项目的交付物检查应使用路径存在性、源码搜索、真实 npm/mvn 测试，不应使用 Python `importlib` 导入 TS/TSX/Java 模块

### forthAMS 项目

- Sprint: SWARM-052 Iteration 3 — 审批流程前端集成
- 后端: Spring Boot 3.2.5 + MyBatis-Plus, `mvn compile` 已通过
- 前端: React + TypeScript + Vite, `npm run build` 已通过
- SPEC 路径: `/Users/feigao/project/Project/forthAMS/sprints/SWARM-052/Iteration-3/SPEC.md`
- 禁止 Python/FastAPI/Django 代码
