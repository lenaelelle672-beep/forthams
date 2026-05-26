# Sprint 4 收尾验收规格指导文档

> **版本**: v1.0  
> **生成日期**: 2024  
> **状态**: DRAFT  
> **责任节点**: DeadCodeVisitor (src/endless_daemon.py L300)

---

## 1. 概述与背景

Sprint 4 核心任务为完成 `DeadCodeVisitor` AST 静态分析模块的收尾工作，涵盖：

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | 模块可正常 import | static_analysis | pending |
| AC-002 | 图结构返回值验证 | static_analysis | pending |
| AC-003 | 死代码检测逻辑完整性验证 | static_analysis | pending |
| AC-004 | Docstring 覆盖率达标验证 | static_analysis | pending |
| AC-005 | Graphify 图谱结构一致性验证 | static_analysis | pending |

当前 `DeadCodeVisitor` 已实现基础遍历框架，需补充文档、完成 import 异常扫描、并建立验收基准。

---

## 2. 当前 Phase 对应实施目标

| Phase | 描述 | 对应节点 | 状态 |
|-------|------|----------|------|
| Phase 4.1 | DeadCodeVisitor 方法级 docstring 补全 | `src/endless_daemon.py` L300-L732 | 待完成 |
| Phase 4.2 | ATB-1.1/AC-005 图结构返回值验证 | `tests/test_aspect_binding.py` L64 | 待验证 |
| Phase 4.3 | ATB-3.2 模块 import 异常扫描 | `tests/sprint4/test_static_analysis.py` L478 | 待执行 |
| Phase 4.4 | 循环依赖检测 `visit_Call()` 完整性 | `src/endless_daemon.py` L529 | 待确认 |

---

## 3. 边界约束

### 3.1 强制约束

1. **不得破坏现有 API 签名**: `DeadCodeVisitor.__init__()`, `get_dead_code()`, `get_all_nodes()`, `get_statistics()` 接口保持不变
2. **community 非零节点** (`get_dead_code` L656, `get_statistics` L732, `get_all_nodes` L683, `visit_ClassDef` L477) 属于公共 API，禁止移除
3. **测试文件独立运行**: 所有 `pytest` 测试用例须可在项目根目录独立执行
4. **docstring 格式**: 使用 Google Style，必须包含 Args/Returns/Raises 三段

### 3.2 禁止事项

- 禁止在 `DeadCodeVisitor` 中引入外部 I/O 操作
- 禁止删除 `visit_Module()`, `visit_Name()` 等核心遍历方法
- 禁止修改 `tests/test_aspect_binding.py` 中已验证通过的测试用例

---

## 4. 验收测试基准 (ATB)

### ATB-1.1: 图结构返回值验证

**AC**: AC-001 / AC-005  
**物理测试期待**: `analyze_file()` 返回 `dict` 必须包含键 `nodes` (list) 和 `edges` (list)

```python
# tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure
def test_analyze_file_returns_graph_structure():
    result = analyze_file("dummy.py")
    assert isinstance(result, dict)
    assert "nodes" in result
    assert "edges" in result
    assert isinstance(result["nodes"], list)
    assert isinstance(result["edges"], list)
```

**对应方法**: `DeadCodeVisitor.get_all_nodes()` (L683), `get_dead_code()` (L656)

---

### ATB-1.2: 图数据完整性

**物理测试期待**: 返回的节点包含 `id`, `type`, `docstring` 字段

```python
def test_graph_node_structure():
    result = analyze_file("dummy.py")
    for node in result["nodes"]:
        assert "id" in node
        assert "type" in node  # 'function', 'class', 'module'
        assert "docstring" in node or node.get("docstring") is None
```

---

### ATB-2.1: 死代码候选识别 `_is_dead_code_candidate()`

**AC**: AC-003  
**物理测试期待**: 非导出函数且无内部调用返回 `True`

**源码定位**: `src/endless_daemon.py` L549

```python
def _is_dead_code_candidate(self, node: ast.FunctionDef) -> bool:
    """
    判断函数是否为死代码候选。
    
    死代码候选条件：
    - 函数名不以 _ 开头（非私有方法）
    - 非 __init__ 等 dunder 方法
    - 函数体为空或是纯 pass/ellipsis
    """
```

**验证点**:
- [ ] 私有方法 (`_private_func`) 不标记为死代码
- [ ] dunder 方法 (`__init__`) 不标记为死代码
- [ ] 空函数体 (`pass` / `...`) 标记为死代码候选
- [ ] 有实际代码的函数不标记为死代码候选

---

### ATB-2.2: 空函数识别 `_is_empty_function()`

**源码定位**: `src/endless_daemon.py` L583

```python
def _is_empty_function(self, node: ast.FunctionDef) -> bool:
    """
    判断函数体是否为空。
    
    空函数定义：
    - 仅包含 pass 语句
    - 仅包含 ... (Ellipsis)
    - 函数体为空列表
    """
```

**验证用例**:
```python
# 验证命令
pytest tests/sprint4/test_static_analysis.py -k "test_dead_code" -v
```

---

### ATB-2.3: 空类识别 `_is_empty_class()`

**源码定位**: `src/endless_daemon.py` L626

```python
def _is_empty_class(self, node: ast.ClassDef) -> bool:
    """
    判断类是否为空。
    
    空类定义：
    - 无有效方法定义
    - 仅包含 pass 或 docstring
    """
```

---

### ATB-3.1: 循环依赖检测 `visit_Call()`

**AC**: AC-005  
**源码定位**: `src/endless_daemon.py` L529

```python
def visit_Call(self, node: ast.Call) -> None:
    """
    访问函数调用节点。
    
    标记被调用的函数为活跃代码，用于构建 call-graph。
    """
    # 记录函数调用关系，构建 edges
    self.generic_visit(node)
```

**对应测试**: `tests/sprint4/test_static_analysis.py::test_01_no_circular_imports`

---

### ATB-3.2: 模块可正常 import

**AC**: AC-001  
**源码定位**: `tests/sprint4/test_static_analysis.py` L177

```python
class TestModuleImports:
    """ATB-3.2: 模块可正常 import"""
    
    def test_endless_daemon_imports_without_error(self):
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
```

**执行命令**:
```bash
cd /path/to/project && python -c "import endless_daemon"
pytest tests/sprint4/test_static_analysis.py::TestModuleImports -v
```

---

### ATB-4.1: Docstring 覆盖率

**AC**: AC-004  
**源码定位**: `tests/sprint4/test_docstring_coverage.py`

**检查范围**:
- `src/endless_daemon.py` L300-L732 所有公共方法
- `scripts/ast_dead_code_check.py` L176-L440

**验收标准**:
```python
# Google Style Docstring 检查
def test_docstring_format():
    """公共方法必须包含 Args, Returns, Raises 三段"""
    for method in PUBLIC_METHODS:
        doc = method.__doc__
        assert "Args:" in doc
        assert "Returns:" in doc
```

---

## 5. 开发切入层级序列

### 层级 1: Docstring 补全 (src/endless_daemon.py L300-L732)

| 优先级 | 方法 | 行号 | 需补充字段 |
|--------|------|------|------------|
| P0 | `__init__()` | L323 | Args, Returns |
| P0 | `get_dead_code()` | L656 | Args, Returns, Raises |
| P0 | `get_statistics()` | L732 | Args, Returns |
| P1 | `visit_Module()` | L386 | Args, Returns |
| P1 | `visit_FunctionDef()` | L396 | Args, Returns |
| P1 | `visit_AsyncFunctionDef()` | L438 | Args, Returns |
| P1 | `visit_ClassDef()` | L477 | Args, Returns |
| P2 | `visit_Name()` | L514 | Args, Returns |
| P2 | `visit_Call()` | L529 | Args, Returns |
| P2 | `_is_dead_code_candidate()` | L549 | Args, Returns |
| P2 | `_is_empty_function()` | L583 | Args, Returns |
| P2 | `_is_empty_class()` | L626 | Args, Returns |

### 层级 2: 验收测试执行

```bash
# 顺序执行
pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure -v
pytest tests/sprint4/test_static_analysis.py::TestModuleImports -v
pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports -v
pytest tests/sprint4/test_docstring_coverage.py -v
```

### 层级 3: Import 异常扫描

```bash
# 全模块 import 检查
python -c "
import endless_daemon
from src.endless_daemon import DeadCodeVisitor
print('Import check passed')
"

# 验证 DeadCodeVisitor 可实例化
python -c "
from src.endless_daemon import DeadCodeVisitor
import ast
v = DeadCodeVisitor()
print('DeadCodeVisitor instantiated OK')
"
```

---

## 6. 关键方法文档模板

### 6.1 `DeadCodeVisitor.__init__()`

```python
def __init__(self, source_code: str = None, audit_callback: Callable = None) -> None:
    """
    初始化 DeadCodeVisitor AST 访问器。

    Args:
        source_code (str, optional): 源代码字符串。如果提供，将直接解析。
        audit_callback (Callable, optional): 审计回调函数，用于记录访问的每个节点。

    Returns:
        None

    Raises:
        SyntaxError: 如果 source_code 无法被解析为有效 AST

    Note:
        - 如果提供 source_code，将自动调用 _parse() 解析
        - audit_callback 接收 ast.AST 节点作为参数
    """
```

### 6.2 `DeadCodeVisitor.get_dead_code()`

```python
def get_dead_code(self) -> Dict[str, List[Dict]]:
    """
    获取分析得到的死代码节点列表。

    Returns:
        Dict[str, List[Dict]]: 包含以下键的字典：
            - 'nodes': 死代码节点列表，每个节点包含 id, type, name, reason
            - 'edges': 节点间的调用关系边列表
            - 'statistics': 统计信息汇总

    Raises:
        RuntimeError: 如果在调用前未执行 analyze()

    Example:
        >>> visitor = DeadCodeVisitor(source_code="def unused(): pass")
        >>> visitor.analyze()
        >>> dead_code = visitor.get_dead_code()
        >>> print(dead_code['nodes'])
        [{'id': 'unused', 'type': 'function', 'name': 'unused', 'reason': 'empty_body'}]
    """
```

### 6.3 `DeadCodeVisitor._is_dead_code_candidate()`

```python
def _is_dead_code_candidate(self, node: ast.FunctionDef) -> bool:
    """
    判断函数是否为死代码候选。

    死代码候选的判定条件（需同时满足）：
    1. 函数名不以单下划线 _ 开头（非私有方法）
    2. 不是 dunder 方法（不以 __ 开头且不以 __ 结尾）
    3. 函数体为空或是纯 pass/ellipsis

    Args:
        node (ast.FunctionDef): AST 函数定义节点

    Returns:
        bool: 如果是死代码候选返回 True，否则返回 False

    Note:
        - dunder 方法如 __init__, __str__ 永远不是死代码候选
        - 私有方法 _private_func 永远不是死代码候选
    """
```

---

## 7. 里程碑检查清单

### Sprint 4 收尾验收清单

- [ ] `src/endless_daemon.py` DeadCodeVisitor 所有方法 docstring 格式符合 Google Style
- [ ] `tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure` 通过
- [ ] `tests/sprint4/test_static_analysis.py::TestModuleImports::test_endless_daemon_imports_without_error` 通过
- [ ] `import endless_daemon` 无 ModuleNotFoundError
- [ ] `from src.endless_daemon import DeadCodeVisitor` 无 ImportError
- [ ] `get_dead_code()` 返回格式为 `dict` 含 `nodes`, `edges` 键
- [ ] `_is_dead_code_candidate()` 逻辑可单独验证
- [ ] `_is_empty_function()` 返回值正确
- [ ] `_is_empty_class()` 返回值正确
- [ ] `visit_Call()` 正确记录函数调用关系
- [ ] **plan.md / prd.md 已更新 Sprint 4 进度标记**

---

## 8. 附录

### A. 关键源码索引

| 文件 | 行号范围 | 描述 |
|------|----------|------|
| `src/endless_daemon.py` | L300-L732 | DeadCodeVisitor 类完整定义 |
| `src/endless_daemon.py` | L386-L394 | visit_Module 方法 |
| `src/endless_daemon.py` | L396-L435 | visit_FunctionDef 方法 |
| `src/endless_daemon.py` | L438-L475 | visit_AsyncFunctionDef 方法 |
| `src/endless_daemon.py` | L477-L512 | visit_ClassDef 方法 |
| `src/endless_daemon.py` | L514-L527 | visit_Name 方法 |
| `src/endless_daemon.py` | L529-L547 | visit_Call 方法 |
| `src/endless_daemon.py` | L549-L581 | _is_dead_code_candidate 方法 |
| `src/endless_daemon.py` | L583-L624 | _is_empty_function 方法 |
| `src/endless_daemon.py` | L626-L654 | _is_empty_class 方法 |
| `src/endless_daemon.py` | L656-L681 | get_dead_code 方法 |
| `src/endless_daemon.py` | L683-L730 | get_all_nodes 方法 |
| `src/endless_daemon.py` | L732-L767 | get_statistics 方法 |

### B. 测试用例映射

| 测试用例 | 源文件 | 行号 | 覆盖 ATB |
|----------|--------|------|----------|
| `test_analyze_file_returns_graph_structure` | `tests/test_aspect_binding.py` | L64 | ATB-1.1, ATB-1.2 |
| `test_endless_daemon_imports_without_error` | `tests/sprint4/test_static_analysis.py` | L177 | ATB-3.2 |
| `test_01_no_circular_imports` | `tests/sprint4/test_static_analysis.py` | L61 | ATB-3.1 |
| `test_analyze_file_returns_graph_structure` | `tests/sprint4/test_docstring_coverage.py` | L615 | ATB-1.1 |
| `test_dead_code_visitor_identifies_unused_methods` | `tests/sprint4/test_static_analysis.py` | - | ATB-2.1, ATB-2.2, ATB-2.3 |

---

**文档结束**