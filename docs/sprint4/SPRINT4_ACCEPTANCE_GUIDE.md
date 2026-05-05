# Sprint 4 收尾验收规格指导文档

> **文档版本**: v1.0  
> **制定日期**: 2024  
> **关联文件**: `scripts/ast_dead_code_check.py` (DeadCodeVisitor L176-L398)  
> **关联测试**: `tests/test_aspect_binding.py`, `tests/sprint4/test_static_analysis.py`, `tests/sprint4/test_docstring_coverage.py`

---

## 1. 背景与目标

### 1.1 Sprint 4 核心任务

本 Sprint 聚焦于 `DeadCodeVisitor` AST 静态分析模块的收尾工作，包括：

1. **AC-001/AC-005**: 模块可正常 import，图结构返回值验证
2. **AC-002**: 死代码检测逻辑完整性验证
3. **AC-003**: 循环依赖检测功能验证
4. **AC-004**: Docstring 覆盖率达标验证

### 1.2 当前实现状态

`DeadCodeVisitor` 类 (`scripts/ast_dead_code_check.py` L176) 已实现以下核心方法：

| 方法 | 行号 | Docstring 状态 | 优先级 |
|------|------|----------------|--------|
| `__init__()` | L207 | 待补充 Args/Returns | P0 |
| `get_dead_code()` | L390 | 待补充完整格式 | P0 |
| `get_statistics()` | L398 | 待补充完整格式 | P0 |
| `visit_Module()` | L224 | 待补充完整格式 | P1 |
| `visit_FunctionDef()` | L229 | 待补充完整格式 | P1 |
| `visit_AsyncFunctionDef()` | L258 | 待补充完整格式 | P1 |
| `visit_ClassDef()` | L263 | 待补充完整格式 | P1 |
| `visit_Name()` | L292 | 待补充完整格式 | P2 |
| `visit_Call()` | L297 | 待补充完整格式 | P2 |
| `_is_dead_code_candidate()` | L308 | 待补充完整格式 | P2 |
| `_is_empty_function()` | L341 | 待补充完整格式 | P2 |
| `_is_empty_class()` | L364 | 待补充完整格式 | P2 |
| `get_all_nodes()` | L394 | 待补充完整格式 | P1 |

---

## 2. 验收标准 (AC)

### 2.1 AC-001: 模块可正常 import

| 属性 | 值 |
|------|-----|
| **ID** | AC-001 |
| **描述** | 模块可正常 import |
| **验证方法** | static_analysis |
| **物理期待** | `import endless_daemon` 无 `ModuleNotFoundError` |
| **对应测试节点** | `tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error` (L478) |

**验收执行命令**:
```bash
cd /path/to/project && python -c "import endless_daemon; from scripts.ast_dead_code_check import DeadCodeVisitor; print('AC-001 PASSED')"
```

---

### 2.2 AC-002: 图结构返回值验证

| 属性 | 值 |
|------|-----|
| **ID** | AC-002 |
| **描述** | 图结构返回值验证 |
| **验证方法** | static_analysis |
| **物理期待** | 返回 `dict` 包含 `nodes` (list) 和 `edges` (list) |
| **对应测试节点** | `tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure` (L64) |

**验收执行命令**:
```bash
pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure -v
```

**物理验证标准**:
```python
result = analyze_file("dummy.py")
assert isinstance(result, dict)
assert "nodes" in result
assert "edges" in result
assert isinstance(result["nodes"], list)
assert isinstance(result["edges"], list)
```

---

### 2.3 AC-003: Docstring 覆盖率

| 属性 | 值 |
|------|-----|
| **ID** | AC-003 |
| **描述** | Docstring 覆盖率达标 |
| **验证方法** | static_analysis |
| **物理期待** | 所有公共方法具备 Google Style 格式 (Args/Returns/Raises) |
| **对应测试节点** | `tests/sprint4/test_docstring_coverage.py::test_analyze_file_returns_graph_structure` (L615) |

**验收执行命令**:
```bash
pytest tests/sprint4/test_docstring_coverage.py -v
```

---

### 2.4 AC-004: Import 异常扫描

| 属性 | 值 |
|------|-----|
| **ID** | AC-004 |
| **描述** | Import 异常扫描 |
| **验证方法** | static_analysis |
| **物理期待** | 无 `ModuleNotFoundError`、`ImportError` |
| **对应测试节点** | `tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error` (L478) |

---

### 2.5 AC-005: 循环依赖检测

| 属性 | 值 |
|------|-----|
| **ID** | AC-005 |
| **描述** | 循环依赖检测功能验证 |
| **验证方法** | static_analysis |
| **物理期待** | `visit_Call()` 能捕获函数调用关系 |
| **对应测试节点** | `tests/sprint4/test_static_analysis.py::test_01_no_circular_imports` (L61) |

---

## 3. ATB 测试基准

### 3.1 ATB-1.1: 图结构返回值验证

**测试用例**: `tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure`

```python
def test_analyze_file_returns_graph_structure():
    """
    AC-001/AC-005: 图结构返回值验证
    
    物理期待：
    - 返回 dict 类型
    - 包含 nodes 键 (list)
    - 包含 edges 键 (list)
    """
    result = analyze_file("dummy.py")  # 需创建测试文件
    assert isinstance(result, dict)
    assert "nodes" in result
    assert "edges" in result
    assert isinstance(result["nodes"], list)
    assert isinstance(result["edges"], list)
```

**对应方法**: 
- `DeadCodeVisitor.get_all_nodes()` (L394)
- `DeadCodeVisitor.get_dead_code()` (L390)

---

### 3.2 ATB-2.1: 死代码候选识别

**测试用例**: `_is_dead_code_candidate()` 逻辑验证

```python
def validate_dead_code_candidate():
    """
    ATB-2.1: test_dead_code_visitor_identifies_unused_methods()
    
    物理期待：
    - 非导出函数且无内部调用返回 True
    """
    visitor = DeadCodeVisitor()
    # 需构造无 import、无 call 依赖的 FunctionDef
    assert visitor._is_dead_code_candidate(target_node) in [True, False]
```

**对应方法**: `DeadCodeVisitor._is_dead_code_candidate()` (L308)

---

### 3.3 ATB-2.2: 空函数识别

**测试用例**: `_is_empty_function()` 逻辑验证

```python
def validate_empty_function():
    """
    ATB-2.2: 空函数识别
    
    物理期待：
    - 函数体仅含 Pass 或 Ellipsis 返回 True
    """
    visitor = DeadCodeVisitor()
    assert visitor._is_empty_function(empty_func_node) == True
    assert visitor._is_empty_function(func_with_body) == False
```

**对应方法**: `DeadCodeVisitor._is_empty_function()` (L341)

---

### 3.4 ATB-2.3: 空类识别

**测试用例**: `_is_empty_class()` 逻辑验证

```python
def validate_empty_class():
    """
    ATB-2.3: 空类识别
    
    物理期待：
    - 类体无有效方法定义返回 True
    """
    visitor = DeadCodeVisitor()
    # 需构造空类节点
    assert visitor._is_empty_class(empty_class_node) == True
```

**对应方法**: `DeadCodeVisitor._is_empty_class()` (L364)

---

### 3.5 ATB-3.1: 循环依赖检测

**测试用例**: `visit_Call()` 完整性验证

```python
def validate_visit_call():
    """
    ATB-3.1: 循环依赖检测
    
    物理期待：
    - visit_Call() 能捕获函数调用关系
    - 用于构建 call-graph
    """
    visitor = DeadCodeVisitor()
    visitor.visit_Call(call_node)
    # 验证调用关系已记录
```

**对应方法**: `DeadCodeVisitor.visit_Call()` (L297)

---

### 3.6 ATB-3.2: 模块可正常 import

**测试用例**: `tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error`

```python
def test_endless_daemon_imports_without_error():
    """
    AC-001: 模块可正常 import
    
    物理期待：
    - import endless_daemon 无 ModuleNotFoundError
    - from scripts import ast_dead_code_check 正常
    - DeadCodeVisitor 类可访问
    """
    try:
        import endless_daemon
        print("✅ AC-001 PASSED: import endless_daemon 成功")
    except ModuleNotFoundError as e:
        pytest.fail(f"AC-001 FAILED: {e}")
    except ImportError as e:
        pytest.fail(f"AC-001 FAILED: ImportError - {e}")
```

**验收执行命令**:
```bash
pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error -v
```

---

## 4. Docstring 补全规范

### 4.1 Google Style 格式要求

所有公共方法必须采用以下格式：

```python
def method_name(self, param1: Type1, param2: Type2) -> ReturnType:
    """
    方法简短描述。

    方法详细说明（可选）。

    Args:
        param1: 参数1描述
        param2: 参数2描述

    Returns:
        返回值描述

    Raises:
        ExceptionType: 异常描述（如果有）
    """
```

### 4.2 方法级补全优先级

#### P0 (必须完成)

| 方法 | 行号 | 需补充字段 |
|------|------|------------|
| `__init__()` | L207 | Args, Returns |
| `get_dead_code()` | L390 | Args, Returns, Raises |
| `get_statistics()` | L398 | Args, Returns |

#### P1 (应当完成)

| 方法 | 行号 | 需补充字段 |
|------|------|------------|
| `visit_Module()` | L224 | Args, Returns |
| `visit_FunctionDef()` | L229 | Args, Returns |
| `visit_AsyncFunctionDef()` | L258 | Args, Returns |
| `visit_ClassDef()` | L263 | Args, Returns |
| `get_all_nodes()` | L394 | Args, Returns |

#### P2 (建议完成)

| 方法 | 行号 | 需补充字段 |
|------|------|------------|
| `visit_Name()` | L292 | Args, Returns |
| `visit_Call()` | L297 | Args, Returns |
| `_is_dead_code_candidate()` | L308 | Args, Returns |
| `_is_empty_function()` | L341 | Args, Returns |
| `_is_empty_class()` | L364 | Args, Returns |

---

## 5. 验收测试执行序列

### 5.1 单元测试执行顺序

```bash
# Step 1: 图结构验证
pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure -v

# Step 2: 模块 import 测试
pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error -v

# Step 3: 循环依赖检测
pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports -v

# Step 4: Docstring 覆盖率
pytest tests/sprint4/test_docstring_coverage.py::test_analyze_file_returns_graph_structure -v

# Step 5: 全量静态分析测试
pytest tests/sprint4/test_static_analysis.py -v
```

### 5.2 Import 异常扫描命令

```bash
# 全模块 import 检查
python -c "
import scripts.ast_dead_code_check as adc
import endless_daemon
print('Import check passed')
"

# 检查 DeadCodeVisitor 可实例化
python -c "
from scripts.ast_dead_code_check import DeadCodeVisitor
v = DeadCodeVisitor()
print('DeadCodeVisitor instantiated OK')
"

# 检查返回值结构
python -c "
from scripts.ast_dead_code_check import DeadCodeVisitor
import ast

code = '''
def unused_func():
    pass

def used_func():
    unused_func()
'''
tree = ast.parse(code)
visitor = DeadCodeVisitor()
visitor.visit(tree)
result = visitor.get_dead_code()
print(f'nodes: {result.get(\"nodes\", [])}')
print(f'edges: {result.get(\"edges\", [])}')
"
```

---

## 6. 里程碑检查清单

### 6.1 Docstring 补全

- [ ] `DeadCodeVisitor.__init__()` docstring 符合 Google Style (Args/Returns)
- [ ] `get_dead_code()` docstring 完整 (Args/Returns/Raises)
- [ ] `get_statistics()` docstring 完整 (Args/Returns)
- [ ] `visit_Module()` docstring 完整
- [ ] `visit_FunctionDef()` docstring 完整
- [ ] `visit_AsyncFunctionDef()` docstring 完整
- [ ] `visit_ClassDef()` docstring 完整
- [ ] `visit_Name()` docstring 完整
- [ ] `visit_Call()` docstring 完整
- [ ] `_is_dead_code_candidate()` docstring 完整
- [ ] `_is_empty_function()` docstring 完整
- [ ] `_is_empty_class()` docstring 完整
- [ ] `get_all_nodes()` docstring 完整

### 6.2 验收测试通过

- [ ] `pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure` 通过
- [ ] `pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error` 通过
- [ ] `pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports` 通过
- [ ] `pytest tests/sprint4/test_docstring_coverage.py` 通过

### 6.3 Import 验证

- [ ] `import endless_daemon` 无异常
- [ ] `from scripts.ast_dead_code_check import DeadCodeVisitor` 无异常
- [ ] `DeadCodeVisitor()` 可正常实例化
- [ ] `get_dead_code()` 返回格式为 dict 含 `nodes`, `edges` 键

### 6.4 文档更新

- [ ] `plan.md` Sprint 4 进度已更新为 Completed
- [ ] `prd.md` 相关 AC 状态已更新为 Verified

---

## 7. 边界约束

### 7.1 强制约束

1. **不得破坏现有 API 签名**: `__init__()`, `get_dead_code()`, `get_all_nodes()`, `get_statistics()` 接口保持不变
2. **社区归属非零节点**: `community=9` 的节点 (`get_dead_code` L390, `get_statistics` L398, `get_all_nodes` L394, `visit_ClassDef` L263) 属于公共 API，禁止移除
3. **测试文件独立运行**: 所有 `pytest` 测试用例须可在项目根目录独立执行
4. **docstring 格式**: 使用 Google Style，必须包含 Args/Returns/Raises 三段（如适用）

### 7.2 禁止事项

- 禁止在 `DeadCodeVisitor` 中引入外部 I/O 操作
- 禁止修改 `community=9` 节点的测试依赖路径
- 禁止删除 `visit_Module()`, `visit_Name()` 等核心遍历方法

---

## 8. 附录

### 8.1 相关文件路径

| 文件 | 描述 |
|------|------|
| `scripts/ast_dead_code_check.py` | DeadCodeVisitor 实现 (L176-L398) |
| `tests/test_aspect_binding.py` | 图结构验证测试 (L64) |
| `tests/sprint4/test_static_analysis.py` | 静态分析测试 (L61, L478) |
| `tests/sprint4/test_docstring_coverage.py` | Docstring 覆盖率测试 (L615) |
| `src/endless_daemon.py` | 辅助模块 (ASTAnalyzer, GraphVisualizer, DeadCodeAnalyzer) |

### 8.2 关键行号索引

| 方法 | 文件 | 行号 |
|------|------|------|
| DeadCodeVisitor 类 | `scripts/ast_dead_code_check.py` | L176 |
| `__init__()` | `scripts/ast_dead_code_check.py` | L207 |
| `visit_Module()` | `scripts/ast_dead_code_check.py` | L224 |
| `visit_FunctionDef()` | `scripts/ast_dead_code_check.py` | L229 |
| `visit_AsyncFunctionDef()` | `scripts/ast_dead_code_check.py` | L258 |
| `visit_ClassDef()` | `scripts/ast_dead_code_check.py` | L263 |
| `visit_Name()` | `scripts/ast_dead_code_check.py` | L292 |
| `visit_Call()` | `scripts/ast_dead_code_check.py` | L297 |
| `_is_dead_code_candidate()` | `scripts/ast_dead_code_check.py` | L308 |
| `_is_empty_function()` | `scripts/ast_dead_code_check.py` | L341 |
| `_is_empty_class()` | `scripts/ast_dead_code_check.py` | L364 |
| `get_dead_code()` | `scripts/ast_dead_code_check.py` | L390 |
| `get_all_nodes()` | `scripts/ast_dead_code_check.py` | L394 |
| `get_statistics()` | `scripts/ast_dead_code_check.py` | L398 |

### 8.3 AC 状态追踪

| AC ID | 描述 | 状态 | 验证日期 |
|-------|------|------|----------|
| AC-001 | 模块可正常 import | Pending | - |
| AC-002 | 图结构返回值验证 | Pending | - |
| AC-003 | Docstring 覆盖率 | Pending | - |
| AC-004 | Import 异常扫描 | Pending | - |
| AC-005 | 循环依赖检测 | Pending | - |
| AC-006 | 图结构返回值验证 (扩展) | Pending | - |
| AC-007 | 单元测试覆盖 | Pending | - |
| AC-008 | 图结构一致性 | Pending | - |

---

*本文档由 Agentless 三阶段分层定位 Pipeline 生成，聚焦 `scripts/ast_dead_code_check.py` 的 Sprint 4 收尾验收工作。*