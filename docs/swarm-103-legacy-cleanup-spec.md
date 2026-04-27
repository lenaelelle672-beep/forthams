# SWARM-103 遗留代码清理与 AC 验收准备规格文档

## 1. 需求与背景

### 1.1 业务上下文

| 字段 | 内容 |
|------|------|
| Sprint | Sprint 4 收尾阶段 |
| 任务代号 | SWARM-103 |
| 核心目标 | 遗留代码清理 + AC 验收通过 |
| 执行时间 | Sprint 4 收尾窗口 |

### 1.2 待处理资产

| 资产路径 | 类型 | 定位 | Community | 优先级 |
|----------|------|------|-----------|--------|
| `src/endless_daemon.py` | Python 模块 | `_index_properties()` 方法 | 1 (核心) | 🔴 CRITICAL |

### 1.3 当前 AC 状态

| AC ID | 状态 | 验证方法 | 阻塞原因 |
|-------|------|----------|----------|
| AC-001 | ❌ FAIL | static_analysis | tests/fixtures/dead_code_sample.py 死代码残留 |
| AC-002 | ✅ PASS | static_analysis | 9 个文件静态分析通过 |
| AC-003 | ✅ PASS | static_analysis | 9 个文件静态分析通过 |
| AC-004 | ❌ FAIL | static_analysis | tests/fixtures/dead_code_sample.py 缺失 docstring |
| AC-005 | ❌ FAIL | unit_test | ImportError 模块引用链断裂 |

**通过率**: 2/5 (40.0%)

### 1.4 已知问题模式

| 问题类型 | 位置 | 描述 |
|----------|------|------|
| 死代码残留 | `tests/fixtures/dead_code_sample.py` | 遗留测试夹具存在未清理的废弃代码 |
| Docstring 缺失 | 同上 | 部分函数缺少文档注释 |
| Import 链断裂 | 多个前端模块 | `frontend/src/app/types/flow.ts` 与 `inventoryService.ts` 引用异常 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 层级映射

```
Sprint 4 收尾验收
│
└── Phase 3: 代码质量保障
    │
    ├── [x] Phase 3.1: AST 静态分析环境搭建
    │   └── 依赖工具: ruff, pyright, eslint
    │
    ├── [ ] Phase 3.2: SWARM-103 遗留代码清理 ← 当前聚焦
    │   │
    │   ├── T-1: 清理 tests/fixtures/dead_code_sample.py 死代码
    │   ├── T-2: 补全 _index_properties() docstring
    │   └── T-3: 修复 ImportError 引用链
    │
    └── [ ] Phase 3.3: AC 验收文档归档
```

### 2.2 具体实施目标

| 编号 | 目标描述 | 交付物 | 验证方式 |
|------|----------|--------|----------|
| T-1 | 清理 `tests/fixtures/dead_code_sample.py` 废弃代码 | 删除或重构死代码函数 | `ruff check tests/fixtures/ --select=PLC,PLE` |
| T-2 | 补全 `src/endless_daemon.py` 的 `_index_properties()` docstring | 符合 Google Style 文档注释 | `ruff check src/ --select=D` |
| T-3 | 修复 `frontend/src/app/types/flow.ts` 导入引用 | 消除 ImportError | `npm run typecheck` |
| T-4 | 确保 AST 静态分析全量通过 | 无 Error 级输出 | `make lint-py && make lint-ts` |

---

## 3. 边界约束

### 3.1 作用域约束

```
✓ 允许修改:
  - src/endless_daemon.py
  - tests/fixtures/dead_code_sample.py
  - frontend/src/app/types/flow.ts
  - frontend/src/app/services/inventoryService.ts
  - tests/sprint4/*.py

✗ 禁止修改:
  - backend/src/main/java/* (Java 后端)
  - docs/figma/* (Figma 设计文档)
  - scripts/ast_dead_code_check.py (分析工具)
```

### 3.2 技术约束

| 约束项 | 标准 | 工具版本 |
|--------|------|----------|
| Python 风格 | PEP 8 + Google docstring | ruff>=0.1.0 |
| TypeScript 风格 | strict mode | pyright>=1.1.300, eslint>=8.0.0 |
| Docstring 规范 | Google Style (Python), JSDoc (TS) | pydocstyle, tsdoc |
| AST 分析 | 无 Error 级输出 | ruff check --select=E,F,W |

### 3.3 文档约束

- 所有修改的函数**必须**包含 docstring
- 变更记录**必须**写入 `CHANGELOG.md` 或 `docs/plan.md`
- Docstring 必须包含 `Args`, `Returns`, `Raises` 三区块 (Python)

### 3.4 影响范围约束

- 单次迭代最大影响文件数: ≤ 5 个
- 跨模块依赖解耦: 必须先提交影响评估 PR

---

## 4. 验收测试基准 (ATB)

### ATB-1: 死代码清理验证

```bash
# 步骤 1.1: 确认死代码位置
ruff check tests/fixtures/dead_code_sample.py --select=PLC,PLE

# 期待结果: exit_code = 0, 无告警

# 步骤 1.2: 执行 AST 深度扫描
python scripts/ast_dead_code_check.py tests/fixtures/

# 期待结果: 输出为空或不包含 dead_code_sample.py
```

### ATB-2: _index_properties Docstring 补全验证

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 2.1 | 检查 `src/endless_daemon.py:391` | 存在 Google Style docstring |
| 2.2 | `ruff check src/endless_daemon.py --select=D100,D104` | 无 missing-docstring 警告 |
| 2.3 | `pyright src/endless_daemon.py` | 无类型推断错误 |
| 2.4 | Docstring 包含 `Args:`, `Returns:`, `Raises:` | 三区块齐全 |

### ATB-3: Import 链修复验证

```bash
# 步骤 3.1: 验证 flow.ts 可正常解析
npx tsc --noEmit frontend/src/app/types/flow.ts

# 步骤 3.2: 验证 inventoryService.ts 可正常解析
npx tsc --noEmit frontend/src/app/services/inventoryService.ts

# 步骤 3.3: 全量 TypeScript 检查
cd frontend && npm run typecheck

# 期待结果: 退出码为 0, 无 Error
```

### ATB-4: AC 全量通过验证

| AC ID | 验证命令 | 期待结果 |
|-------|----------|----------|
| AC-001 | `ruff check src/ tests/ --select=PLC,PLE` | exit_code = 0 |
| AC-002 | `ruff check src/ --select=E,F,W` | 无 Error |
| AC-003 | `pyright src/endless_daemon.py` | 无 Error |
| AC-004 | `ruff check tests/ --select=D` | 无 D100/D104 |
| AC-005 | `python -c "from src.endless_daemon import *"` | 无 ImportError |

---

## 5. 开发切入层级序列

### Level 1: 静态分析现状确认

```bash
# 1. 导出当前 AC 状态快照
python -m pytest tests/sprint4/test_deprecated_cleanup.py -v --tb=short > /tmp/ac_status.txt

# 2. 确认 _index_properties 当前状态
grep -n "_index_properties" src/endless_daemon.py

# 3. 确认死代码位置
ruff check tests/fixtures/dead_code_sample.py --select=PLC,PLE
```

### Level 2: Docstring 补全 (src/endless_daemon.py)

**目标函数**: `_index_properties()` at line 391

**当前状态** (疑似仅有注释，无正式 docstring):

```python
def _index_properties(node: Any) -> Dict[str, Any]:
    # TODO: 需要补充 docstring
    pass
```

**目标状态** (Google Style):

```python
def _index_properties(node: Any) -> Dict[str, Any]:
    """Index node properties for fast property-based lookup.

    构建节点的属性索引映射，支持按属性名快速检索节点。
    此函数是 PropertyIndex 类的辅助函数，用于批量索引操作。

    Args:
        node: 待索引的图谱节点对象，需包含 properties 属性。

    Returns:
        属性名到属性值的字典映射。

    Raises:
        AttributeError: 节点对象不包含 properties 属性时抛出。
        TypeError: 节点 properties 不是字典类型时抛出。

    Example:
        >>> node = MockNode(properties={"name": "test", "type": "asset"})
        >>> result = _index_properties(node)
        >>> assert result == {"name": "test", "type": "asset"}
    """
```

### Level 3: 死代码清理 (tests/fixtures/dead_code_sample.py)

**处理策略**: 根据 `ast_dead_code_check.py` 输出结果

```bash
# 识别死代码模式
python scripts/ast_dead_code_check.py tests/fixtures/dead_code_sample.py

# 根据输出，执行以下之一:
# 策略 A: 删除完全废弃的函数/类
# 策略 B: 保留函数骨架 + 补全 docstring (若存在调用依赖)
```

### Level 4: Import 链修复 (前端模块)

**文件**: `frontend/src/app/types/flow.ts`

**问题**: `createFlowEdge` 函数 (L131) 引用链异常

**修复方向**:

```typescript
// 确保所有 import 路径正确
import type { FlowNodeData, FlowEdge } from "./flow";  // 避免自我引用
import { inventoryService } from "../services/inventoryService";
```

### Level 5: 全量验证

```bash
# Python 静态分析
make lint-py

# TypeScript 静态分析
cd frontend && npm run lint && npm run typecheck

# 验收测试
python -m pytest tests/sprint4/ -v
```

### Level 6: 文档归档

**目标文件**: `docs/plan.md`

```markdown
## Sprint 4 收尾验收

- [x] SWARM-103: 遗留代码清理
  - [x] src/endless_daemon.py: 补全 _index_properties() docstring
  - [x] tests/fixtures/dead_code_sample.py: 清理死代码
  - [x] frontend/src/app/types/flow.ts: 修复 ImportError
  - [x] AC 验收: 全量通过 (5/5)
  - 验收时间: YYYY-MM-DD
  - 审核人: [Reviewer Name]
```

---

## 附录

### A. 关键文件路径速查

| 资源 | 路径 |
|------|------|
| 核心文件 | `src/endless_daemon.py` |
| 死代码夹具 | `tests/fixtures/dead_code_sample.py` |
| 前端类型 | `frontend/src/app/types/flow.ts` |
| 前端服务 | `frontend/src/app/services/inventoryService.ts` |
| AST 分析工具 | `scripts/ast_dead_code_check.py` |
| 验收测试 | `tests/sprint4/test_deprecated_cleanup.py` |
| 计划文档 | `docs/plan.md` |

### B. 验收工具命令速查

```bash
# Python 死代码检查
ruff check src/ tests/ --select=PLC,PLE

# Python Docstring 检查
ruff check src/ --select=D100,D104

# Python 类型检查
pyright src/endless_daemon.py

# TypeScript 类型检查
cd frontend && npx tsc --noEmit

# 全量测试
python -m pytest tests/sprint4/ -v
```

### C. Graphify 节点信息

| 节点 | 文件 | 行号 | Community |
|------|------|------|-----------|
| `._index_properties()` | `src/endless_daemon.py` | 391 | 1 (核心) |