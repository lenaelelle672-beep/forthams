# SWARM-006 Sprint 4 收尾巡检规范

## 1. 概述

| 项目 | 内容 |
|------|------|
| 任务编号 | SWARM-006 |
| 任务类型 | `chore(evolve)` - Sprint 收尾巡检 |
| 执行分支 | `sprint-4` |
| 目标分支 | `main` |
| 执行限制 | **仅限** `backend/src/main/java/com/ams/service/*.java` |

### 1.1 本次 Sprint 交付物

| 交付物 | 路径 | 状态 |
|--------|------|------|
| AssetDetailModal 组件 | `frontend/src/app/components/AssetDetailModal.tsx` | ✅ 已完成 |
| CustomNodes 组件 | `frontend/src/app/components/flow/CustomNodes.tsx` | ✅ 已完成 |
| WorkflowDesigner 页面 | `frontend/src/app/pages/WorkflowDesigner.tsx` | ✅ 已完成 |
| EndlessDaemon 知识图谱 | `endless_daemon.py` | ✅ 已完成 |
| Sonner Toast 组件 | `frontend/src/app/components/ui/sonner.tsx` | ✅ 已完成 |

### 1.2 已知风险

> ⚠️ **[Graphify 知识图谱] No matching nodes found.**
>
> 此报错在 AC-002 验证中出现，虽 review 标记为通过，但需执行最终 verification 确认不存在假阳性判定。

---

## 2. 验收标准 (AC-001 至 AC-005)

### 2.1 AC-001: Sprint 4 收尾巡检完成

| 属性 | 值 |
|------|------|
| ID | AC-001 |
| 描述 | 执行 Sprint 4 收尾巡检 - 按照 SWARM-003 定义逐项完成 Phase 1-4 代码审查、单元测试、AST 静态分析及文档归档 |
| 验证方法 | `static_analysis` |
| 严重性 | **Critical** |
| 状态 | `pending` |

**验证动作**:
```bash
# 检查 plan.md 中 Sprint 4 状态已标记为 [x]
grep -E "Sprint 4.*\[x\]" plan.md
```

---

### 2.2 AC-002: Graphify 知识图谱节点匹配

| 属性 | 值 |
|------|------|
| ID | AC-002 |
| 描述 | `[Graphify 知识图谱] No matching nodes found.` - 确保知识图谱查询逻辑正确处理空结果场景 |
| 验证方法 | `static_analysis` |
| 严重性 | **Critical** |
| 状态 | `pending` |

**验证动作**:
```bash
# 验证 endless_daemon.py 中 GraphifyNodeRegistry.search_nodes 方法
python -c "
from endless_daemon import GraphifyNodeRegistry
registry = GraphifyNodeRegistry(tenant_id='test_tenant')
result = registry.search_nodes(query='non_existent')
assert result['totalCount'] == 0, '空结果场景应返回 totalCount=0'
print('AC-002 PASSED: 空结果处理正确')
"
```

---

### 2.3 AC-003: AST 静态分析合规

| 属性 | 值 |
|------|------|
| ID | AC-003 |
| 描述 | 代码变更不引入新的语法错误（AST 静态检查通过） |
| 验证方法 | `static_analysis` |
| 严重性 | **Critical** |
| 状态 | `pending` |

**验证动作**:
```bash
# Python AST 验证
python -m py_compile endless_daemon.py
python -m astroid endless_daemon.py

# Java AST 验证（针对 backend/src/main/java/com/ams/service/*.java）
cd backend
./mvnw compile -q
```

---

### 2.4 AC-004: 文档注释完整性

| 属性 | 值 |
|------|------|
| ID | AC-004 |
| 描述 | 所有修改的函数包含 docstring 文档注释 |
| 验证方法 | `static_analysis` |
| 严重性 | `Normal` |
| 状态 | `pending` |

**验证动作**:
```bash
# 检查 endless_daemon.py 关键类的 docstring
python -c "
import inspect
from endless_daemon import (
    GraphifyError, 
    NodeNotFoundError, 
    RelationshipNotFoundError,
    GraphifyNodeRegistry
)

classes = [GraphifyError, NodeNotFoundError, RelationshipNotFoundError, GraphifyNodeRegistry]
for cls in classes:
    doc = inspect.getdoc(cls)
    assert doc is not None and len(doc) > 10, f'{cls.__name__} 缺少 docstring'
    print(f'✓ {cls.__name__}: docstring 存在 ({len(doc)} chars)')
"
```

---

### 2.5 AC-005: 模块可正常导入

| 属性 | 值 |
|------|------|
| ID | AC-005 |
| 描述 | 变更后的模块可被正常 import 不抛出 ImportError |
| 验证方法 | `unit_test` |
| 严重性 | **Critical** |
| 状态 | `pending` |

**验证动作**:
```bash
# Python 模块导入测试
python -c "
import sys
sys.path.insert(0, '.')
import endless_daemon
from endless_daemon import (
    GraphifyNodeRegistry,
    GraphifyError,
    NodeNotFoundError,
    RelationshipNotFoundError,
    DuplicateNodeError,
    InvalidOperationError
)
print('AC-005 PASSED: 所有类导入成功')
"

# Java 模块导入测试
cd backend
./mvnw test -Dtest=AssetCategoryServiceTest -q
```

---

## 3. Phase 执行流程

### 3.1 Phase 1: 代码审查

| 检查项 | 执行命令 | 判定标准 |
|--------|----------|----------|
| Python 语法 | `python -m py_compile endless_daemon.py` | 退出码 0 |
| 代码风格 | `flake8 endless_daemon.py --max-line-length=120` | 警告数 0 |
| Docstring | `pydocstyle endless_daemon.py` | 无 docstring 错误 |

### 3.2 Phase 2: 单元测试

| 测试范围 | 执行命令 | 覆盖率阈值 |
|----------|----------|------------|
| Backend Service | `./mvnw test -Dtest="*ServiceTest"` | ≥ 80% |
| Graphify 模块 | `pytest tests/test_graphify.py -v` | 100% |

### 3.3 Phase 3: AST 静态分析

| 分析工具 | 指标 | 阈值 |
|----------|------|------|
| `radon` | CC (循环复杂度) | < 10 |
| `lizard` | CHILD (继承深度) | < 5 |
| `mypy` | 类型检查 | 无错误 |

### 3.4 Phase 4: 文档归档

| 文档 | 动作 |
|------|------|
| `docs/changelog.md` | 添加 Sprint 4 变更记录 |
| `docs/api-changelog.md` | 记录 API 变更（如有） |
| **`plan.md`** | **标记 Sprint 4 状态为 [x] - [强制]** |

---

## 4. 强制执行检查清单

### 4.1 前置条件

- [ ] 已拉取最新 `sprint-4` 分支
- [ ] 已读取 `plan.md` 中 SWARM-006 上下文
- [ ] 已读取 SWARM-003 Phase 定义

### 4.2 Phase 1: 代码审查

- [ ] **ATB-001**: `python -m py_compile endless_daemon.py` 通过
- [ ] **ATB-002**: `flake8 endless_daemon.py` 无警告
- [ ] **ATB-003**: `pydocstyle endless_daemon.py` 无错误

### 4.3 Phase 2: 单元测试

- [ ] **ATB-004**: Backend Service 测试全部通过
- [ ] **ATB-005**: Graphify 模块测试全部通过
- [ ] **ATB-006**: 测试覆盖率 ≥ 80%

### 4.4 Phase 3: AST 静态分析

- [ ] **ATB-007**: `radon cc` 复杂度 < 10
- [ ] **ATB-008**: `mypy endless_daemon.py` 无错误

### 4.5 Phase 4: 文档归档

- [ ] **ATB-009**: `docs/changelog.md` 已更新
- [ ] **ATB-010**: **`plan.md` Sprint 4 状态已标记 [x]`**

### 4.6 验收标准确认

- [ ] **AC-001**: Sprint 4 收尾巡检完成
- [ ] **AC-002**: Graphify 知识图谱节点匹配验证通过
- [ ] **AC-003**: AST 静态分析合规
- [ ] **AC-004**: 文档注释完整
- [ ] **AC-005**: 模块可正常导入

---

## 5. 退出条件

> **⚠️ 强制提醒**: 完成以下验证后方可退出任务

```bash
# 必须执行
cat plan.md | grep -A2 "Sprint 4"

# 预期输出应包含:
# Sprint 4 ... [x] ... SWARM-006
```

若输出不包含 `[x]`，任务 **未完成**，不得退出。

---

## 6. 回滚预案

| 场景 | 回滚动作 |
|------|----------|
| 单元测试失败 | `git checkout HEAD~1 -- backend/src/main/java/com/ams/service/` |
| AST 分析失败 | `git revert <commit_hash>` |
| 文档更新错误 | `git checkout HEAD~1 -- docs/` |

---

**文档版本**: 1.0
**创建日期**: 2024
**状态**: [草稿]