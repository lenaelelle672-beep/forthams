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
