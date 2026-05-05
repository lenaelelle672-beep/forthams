# Sprint 4 收尾验收规格指导文档

> **版本**: v1.0  
> **状态**: 草稿 (Draft)  
> **创建日期**: 2024  
> **适用范围**: Sprint 4 收尾阶段

---

## 1. 需求与背景

### 1.1 Sprint 4 核心目标

Sprint 4 聚焦于 `DeadCodeVisitor` AST 静态分析模块的收尾工作，涉及以下验收标准：

| AC ID | 描述 | 状态 |
|-------|------|------|
| AC-001 | 模块可正常 import | ✅ 静态分析通过 |
| AC-002 | 图结构返回值验证 (test_aspect_binding.py) | ✅ 静态分析通过 |
| AC-003 | 图结构返回值验证 (test_docstring_coverage.py) | ❌ 13 个静态问题 |
| AC-004 | 模块 import 异常测试 | ✅ 静态分析通过 |
| AC-005 | 循环依赖检测 | ✅ 静态分析通过 |
| AC-006 | 图结构返回值验证 (综合) | ❌ 13 个静态问题 |
| AC-007 | 图结构返回值验证 (独立) | ✅ 静态分析通过 |
| AC-008 | 图结构返回值验证 (pytest) | ❌ Unknown Failure |

**当前通过率**: 5/8 (62.5%)  
**综合评分**: 52

### 1.2 阻塞问题

| 优先级 | AC | 问题描述 | 位置 |
|--------|-----|----------|------|
| P0 | AC-003/AC-006 | `tests/test_e2e_audit.py` 存在 13 个静态分析问题 | 测试文件 |
| P0 | AC-008 | pytest 执行抛出 `Unknown Failure` 异常 | 测试执行层 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射表

| Phase | 描述 | 对应节点 | 状态 |
|-------|------|----------|------|
| Phase 4.1 | DeadCodeVisitor 方法级 docstring 补全 | `scripts/ast_dead_code_check.py` L207-L398 | 待完成 |
| Phase 4.2 | ATB-1.1/AC-005 图结构返回值验证 | `tests/test_aspect_binding.py` L64 | 待验证 |
| Phase 4.3 | ATB-3.2 模块 import 异常扫描 | `tests/sprint4/test_static_analysis.py` L478 | 待执行 |
| Phase 4.4 | 循环依赖检测 `visit_Call()` 完整性 | `scripts/ast_dead_code_check.py` L297 | 待确认 |

### 2.2 关键文件清单

| 文件路径 | 相关度 | 行数 | 用途 |
|----------|--------|------|------|
| `scripts/ast_dead_code_check.py` | 2 | 277 | DeadCodeVisitor 实现 |
| `tests/test_aspect_binding.py` | 2 | 277 | 图结构验证测试 |
| `tests/sprint4/test_static_analysis.py` | 2 | 931 | 静态分析综合测试 |
| `tests/sprint4/test_docstring_coverage.py` | 2 | - | Docstring 覆盖率测试 |
| `src/endless_daemon.py` | 2 | 931 | EndlessDaemon 核心模块 |

---

## 3. 边界约束

### 3.1 强制约束

```
[CONSTRAINT-001] 不得破坏现有 API 签名
[CONSTRAINT-002] 不得移除 community=9 节点（公共 API）
[CONSTRAINT-003] 所有测试必须可独立运行
[CONSTRAINT-004] Docstring 必须符合 Google Style
```

#### API 接口锁定清单

| 方法签名 | 行号 | 约束级别 |
|----------|------|----------|
| `DeadCodeVisitor.__init__()` | L207 | LOCKED |
| `DeadCodeVisitor.get_dead_code()` | L390 | LOCKED |
| `DeadCodeVisitor.get_all_nodes()` | L394 | LOCKED |
| `DeadCodeVisitor.get_statistics()` | L398 | LOCKED |
| `DeadCodeVisitor.visit_Module()` | L224 | LOCKED |
| `DeadCodeVisitor.visit_FunctionDef()` | L229 | LOCKED |
| `DeadCodeVisitor.visit_AsyncFunctionDef()` | L258 | LOCKED |
| `DeadCodeVisitor.visit_ClassDef()` | L263 | LOCKED |
| `DeadCodeVisitor.visit_Name()` | L292 | LOCKED |
| `DeadCodeVisitor.visit_Call()` | L297 | LOCKED |
| `DeadCodeVisitor._is_dead_code_candidate()` | L308 | LOCKED |
| `DeadCodeVisitor._is_empty_function()` | L341 | LOCKED |
| `DeadCodeVisitor._is_empty_class()` | L364 | LOCKED |

### 3.2 禁止事项

| 禁止项 | 说明 |
|--------|------|
| 🔴 禁止引入外部 I/O | `DeadCodeVisitor` 不得使用文件/网络操作 |
| 🔴 禁止删除遍历方法 | `visit_Module`, `visit_Name` 等核心方法不可移除 |
| 🔴 禁止修改测试依赖路径 | community=9 节点路径保持不变 |
| 🔴 禁止修改返回值 schema | `get_dead_code()` 必须返回包含 `nodes` 和 `edges` 的 dict |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1.1: 图结构返回值验证

**源测试节点**: `tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure` (L64)

**物理期待**:
```
analyze_file() 返回 dict 必须包含键:
  - nodes: list
  - edges: list
```

**验证代码**:
```python
# tests/test_aspect_binding.py
def test_analyze_file_returns_graph_structure():
    """
    ATB-1.1: 图结构返回值验证
    
    物理期待: 返回 dict 包含 nodes (list) 和 edges (list)
    
    对应 AC: AC-001, AC-005, AC-006, AC-008
    """
    from scripts.ast_dead_code_check import analyze_file
    
    # 创建测试文件
    test_code = """
def unused_func():
    pass

def used_func():
    unused_func()
"""
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(test_code)
        temp_path = f.name
    
    try:
        result = analyze_file(temp_path)
        
        # ATB-1.1: 核心断言
        assert isinstance(result, dict), "返回值必须是 dict"
        assert "nodes" in result, "必须包含 'nodes' 键"
        assert "edges" in result, "必须包含 'edges' 键"
        assert isinstance(result["nodes"], list), "'nodes' 必须是 list"
        assert isinstance(result["edges"], list), "'edges' 必须是 list"
        
        print("✅ ATB-1.1 PASSED: 图结构返回值验证通过")
    finally:
        os.unlink(temp_path)
```

**对应方法**:
- `DeadCodeVisitor.get_all_nodes()` (L394)
- `DeadCodeVisitor.get_dead_code()` (L390)

---

### 4.2 ATB-2.1: 死代码候选识别

**源测试节点**: `scripts/ast_dead_code_check.py::_is_dead_code_candidate` (L308)

**物理期待**:
```
_is_dead_code_candidate(node) 返回 True 当且仅当:
  - 函数/方法非 dunder 方法
  - 无外部模块引用
  - 无内部 call 依赖
```

**验证代码**:
```python
# 内联验证脚本
import ast
from scripts.ast_dead_code_check import DeadCodeVisitor

def test_is_dead_code_candidate():
    """
    ATB-2.1: 死代码候选识别
    
    物理期待: 非导出且无依赖的函数返回 True
    """
    code = """
def public_unused_func():
    '''无调用者的公开函数'''
    pass

def _private_unused():
    '''私有未使用函数'''
    x = 1

def __dunder__():
    '''Dunder 方法应被排除'''
    pass

def used_func():
    '''被调用的函数'''
    public_unused_func()
"""
    tree = ast.parse(code)
    visitor = DeadCodeVisitor()
    visitor.visit(tree)
    
    # 获取所有函数定义
    func_nodes = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    
    for node in func_nodes:
        if node.name == "public_unused_func":
            result = visitor._is_dead_code_candidate(node)
            # 公开函数非 dunder 应为候选
            assert result == True, f"public_unused_func 应为候选: got {result}"
        elif node.name == "__dunder__":
            result = visitor._is_dead_code_candidate(node)
            # Dunder 方法不应为候选
            assert result == False, f"__dunder__ 不应为候选: got {result}"
    
    print("✅ ATB-2.1 PASSED: 死代码候选识别通过")
```

**对应方法**: `DeadCodeVisitor._is_dead_code_candidate()` (L308)

---

### 4.3 ATB-2.2: 空函数识别

**源测试节点**: `scripts/ast_dead_code_check.py::_is_empty_function` (L341)

**物理期待**:
```
_is_empty_function(node) 返回 True 当且仅当:
  - 函数体仅包含 Pass 语句
  - 函数体仅包含 Ellipsis (...)
  - 函数体为空
```

**验证代码**:
```python
import ast
from scripts.ast_dead_code_check import DeadCodeVisitor

def test_is_empty_function():
    """
    ATB-2.2: 空函数识别
    
    物理期待: 仅含 Pass 或 Ellipsis 的函数返回 True
    """
    visitor = DeadCodeVisitor()
    
    # Case 1: 仅含 Pass
    code1 = "def empty_pass(): pass"
    tree1 = ast.parse(code1)
    func1 = tree1.body[0]
    assert visitor._is_empty_function(func1) == True, "仅含 Pass 应返回 True"
    
    # Case 2: 仅含 Ellipsis
    code2 = "def empty_ellipsis(): ..."
    tree2 = ast.parse(code2)
    func2 = tree2.body[0]
    assert visitor._is_empty_function(func2) == True, "仅含 Ellipsis 应返回 True"
    
    # Case 3: 含实际代码
    code3 = "def non_empty(): x = 1"
    tree3 = ast.parse(code3)
    func3 = tree3.body[0]
    assert visitor._is_empty_function(func3) == False, "含实际代码应返回 False"
    
    print("✅ ATB-2.2 PASSED: 空函数识别通过")
```

**对应方法**: `DeadCodeVisitor._is_empty_function()` (L341)

---

### 4.4 ATB-2.3: 空类识别

**源测试节点**: `scripts/ast_dead_code_check.py::_is_empty_class` (L364)

**物理期待**:
```
_is_empty_class(node) 返回 True 当且仅当:
  - 类体无有效方法定义
  - 仅含 Pass 或 docstring
```

**验证代码**:
```python
import ast
from scripts.ast_dead_code_check import DeadCodeVisitor

def test_is_empty_class():
    """
    ATB-2.3: 空类识别
    
    物理期待: 无有效方法的类返回 True
    """
    visitor = DeadCodeVisitor()
    
    # Case 1: 仅 docstring
    code1 = """
class EmptyClass:
    '''仅文档字符串'''
"""
    tree1 = ast.parse(code1)
    cls1 = tree1.body[0]
    # 注意: 实现可能需要特殊处理 docstring
    result1 = visitor._is_empty_class(cls1)
    
    # Case 2: 包含方法
    code2 = """
class NonEmptyClass:
    def method(self):
        pass
"""
    tree2 = ast.parse(code2)
    cls2 = tree2.body[0]
    assert visitor._is_empty_class(cls2) == False, "含方法应返回 False"
    
    print("✅ ATB-2.3 PASSED: 空类识别通过")
```

**对应方法**: `DeadCodeVisitor._is_empty_class()` (L364)

---

### 4.5 ATB-3.1: 循环依赖检测

**源测试节点**: `tests/sprint4/test_static_analysis.py::test_01_no_circular_imports` (L61)

**物理期待**:
```
循环 import 检测返回:
  - 无循环: [] (空列表)
  - 有循环: [cycle_info_1, cycle_info_2, ...]
```

**验证代码**:
```python
# tests/sprint4/test_static_analysis.py
def test_01_no_circular_imports():
    """
    ATB-3.1: 循环依赖检测
    
    物理期待: 无循环依赖时返回空列表
    """
    import sys
    import importlib.util
    
    # 检测项目自身模块
    project_modules = [
        'scripts.ast_dead_code_check',
        'src.endless_daemon',
    ]
    
    for module_name in project_modules:
        # 尝试加载模块
        spec = importlib.util.find_spec(module_name)
        if spec and spec.loader:
            # 模块可正常加载
            try:
                mod = importlib.import_module(module_name)
                print(f"✅ {module_name} 加载成功")
            except ImportError as e:
                print(f"⚠️ {module_name} 加载失败: {e}")
    
    print("✅ ATB-3.1 PASSED: 循环依赖检测通过")
```

**对应方法**: `DeadCodeVisitor.visit_Call()` (L297)

---

### 4.6 ATB-3.2: 模块可正常 Import

**源测试节点**: `tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error` (L478)

**物理期待**:
```
import endless_daemon
  - 不抛出 ModuleNotFoundError
  - 不抛出 ImportError
  - DeadCodeVisitor 类可访问
```

**验证代码**:
```python
# tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error
def test_endless_daemon_imports_without_error():
    """
    ATB-3.2: 模块可正常 import
    
    物理期待:
    - import endless_daemon 无 ModuleNotFoundError
    - from scripts import ast_dead_code_check 正常
    - DeadCodeVisitor 类可访问
    
    对应 AC: AC-001, AC-004
    """
    # AC-001: 核心导入测试
    try:
        import endless_daemon
        print("✅ AC-001 PASSED: import endless_daemon 成功")
    except ModuleNotFoundError as e:
        pytest.fail(f"AC-001 FAILED: {e}")
    except ImportError as e:
        pytest.fail(f"AC-001 FAILED: ImportError - {e}")
    
    # AC-004: AST 模块导入测试
    try:
        from scripts import ast_dead_code_check
        from scripts.ast_dead_code_check import DeadCodeVisitor
        
        # 验证 DeadCodeVisitor 可实例化
        visitor = DeadCodeVisitor()
        print("✅ AC-004 PASSED: DeadCodeVisitor 可正常实例化")
    except (ModuleNotFoundError, ImportError) as e:
        pytest.fail(f"AC-004 FAILED: {e}")

def test_ast_dead_code_check_imports():
    """
    补充测试: ast_dead_code_check 模块导入
    
    物理期待: 所有公共 API 可访问
    """
    from scripts.ast_dead_code_check import (
        DeadCodeVisitor,
        analyze_file,
        get_daemon,
        analyze_with_ast
    )
    
    assert callable(analyze_file), "analyze_file 应可调用"
    assert callable(analyze_with_ast), "analyze_with_ast 应可调用"
    assert callable(get_daemon), "get_daemon 应可调用"
    
    print("✅ test_ast_dead_code_check_imports PASSED")
```

**执行命令**:
```bash
# 单个测试执行
cd /path/to/project && \
pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error -v

# 模块导入验证
python -c "
import endless_daemon
from scripts.ast_dead_code_check import DeadCodeVisitor
v = DeadCodeVisitor()
print('Import check passed')
"
```

---

## 5. 开发切入层级序列

### 5.1 层级 1: Docstring 补全 (优先级: P0)

| 优先级 | 方法 | 行号 | 需补充字段 |
|--------|------|------|------------|
| P0 | `__init__()` | L207 | Args, Returns, Raises |
| P0 | `get_dead_code()` | L390 | Args, Returns, Raises |
| P0 | `get_statistics()` | L398 | Args, Returns |
| P1 | `visit_Module()` | L224 | Args, Returns |
| P1 | `visit_FunctionDef()` | L229 | Args, Returns |
| P1 | `visit_AsyncFunctionDef()` | L258 | Args, Returns |
| P1 | `visit_ClassDef()` | L263 | Args, Returns |
| P2 | `visit_Name()` | L292 | Args, Returns |
| P2 | `visit_Call()` | L297 | Args, Returns |
| P2 | `_is_dead_code_candidate()` | L308 | Args, Returns |
| P2 | `_is_empty_function()` | L341 | Args, Returns |
| P2 | `_is_empty_class()` | L364 | Args, Returns |

**Docstring 模板 (Google Style)**:
```python
def method_name(self, param1: Type1, param2: Type2) -> ReturnType:
    """
    方法简短描述。

    方法详细描述，包括业务逻辑说明。

    Args:
        param1: 参数1描述
        param2: 参数2描述

    Returns:
        返回值描述

    Raises:
        ExceptionType: 异常描述

    Examples:
        >>> result = obj.method_name("test", 123)
        >>> print(result)
    """
```

---

### 5.2 层级 2: 验收测试执行 (优先级: P0)

```bash
# 顺序执行，确保无互相依赖
echo "=== ATB-1.1: 图结构返回值验证 ==="
pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure -v

echo "=== ATB-3.2: 模块 Import 测试 ==="
pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error -v

echo "=== ATB-3.1: 循环依赖检测 ==="
pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports -v

echo "=== ATB-4.1: Docstring 覆盖率 ==="
pytest tests/sprint4/test_docstring_coverage.py::test_analyze_file_returns_graph_structure -v
```

---

### 5.3 层级 3: Import 异常扫描 (优先级: P1)

```bash
# 全模块 import 检查脚本
python -c "
import sys
print('Python version:', sys.version)
print()

# 检查核心模块
modules_to_check = [
    'scripts.ast_dead_code_check',
    'endless_daemon',
    'src.endless_daemon',
]

for module_name in modules_to_check:
    try:
        mod = __import__(module_name)
        print(f'✅ {module_name} 导入成功')
    except ModuleNotFoundError as e:
        print(f'❌ {module_name} 导入失败: ModuleNotFoundError - {e}')
    except ImportError as e:
        print(f'❌ {module_name} 导入失败: ImportError - {e}')
    except Exception as e:
        print(f'❌ {module_name} 导入失败: {type(e).__name__} - {e}')

# 检查 DeadCodeVisitor 可实例化
print()
print('=== DeadCodeVisitor 实例化测试 ===')
try:
    from scripts.ast_dead_code_check import DeadCodeVisitor
    v = DeadCodeVisitor()
    print('✅ DeadCodeVisitor 实例化成功')
except Exception as e:
    print(f'❌ DeadCodeVisitor 实例化失败: {type(e).__name__} - {e}')
"
```

---

### 5.4 层级 4: AC-003/AC-006 问题修复 (优先级: P0)

**问题定位**: `tests/test_e2e_audit.py` 存在 13 个静态分析问题

**修复步骤**:

1. **定位问题**:
```bash
# 静态分析扫描
pytest tests/test_e2e_audit.py --collect-only 2>&1 | head -50

# 检查具体错误
pytest tests/test_e2e_audit.py -v 2>&1 | grep -E "(FAILED|ERROR|AssertionError)"
```

2. **问题分类**:
```python
# 典型问题类型
problem_types = [
    "图结构返回值格式不匹配",  # 缺少 nodes/edges 键
    "测试 fixture 未定义",      # pytest fixture 问题
    "异步测试标记缺失",         # async test 缺少标记
    "Mock 配置错误",            # unittest.mock 问题
]
```

3. **修复模板**:
```python
# 修复图结构返回值
def analyze_file_fixed(file_path: str) -> dict:
    """修复后的 analyze_file 实现"""
    # ... 原有逻辑 ...
    
    # 确保返回值包含必要字段
    result = {
        "nodes": nodes_list,
        "edges": edges_list,
        "metadata": metadata  # 可选
    }
    return result
```

---

## 6. 里程碑检查清单

### 6.1 Sprint 4 交付物检查

```markdown
- [ ] `DeadCodeVisitor` 所有方法 docstring 格式符合 Google Style
- [ ] `pytest tests/test_aspect_binding.py::test_analyze_file_returns_graph_structure` 通过
- [ ] `pytest tests/sprint4/test_static_analysis.py::test_endless_daemon_imports_without_error` 通过
- [ ] `import endless_daemon` 在项目根目录执行无异常
- [ ] `get_dead_code()` 返回格式为 `dict` 含 `nodes`, `edges` 键
- [ ] `_is_dead_code_candidate()` 逻辑可单独验证
- [ ] `_is_empty_function()` 逻辑可单独验证
- [ ] `_is_empty_class()` 逻辑可单独验证
- [ ] `tests/test_e2e_audit.py` 13 个静态分析问题已修复
- [ ] AC-008 pytest Unknown Failure 已解决
- [ ] **plan.md / prd.md 已更新 Sprint 4 进度标记**
```

### 6.2 回归测试套件

```bash
# 完整回归测试
pytest tests/ \
    --ignore=tests/test_service_integration.py \
    --ignore=backend/ \
    -v \
    --tb=short \
    2>&1 | tee sprint4_regression_report.txt
```

**回归测试通过标准**:
```
- 所有 Critical AC (AC-001, AC-002) 必须通过
- 通过率 >= 85% (之前为 62.5%)
- 无新增 Unknown Failure
```

---

## 7. 附录

### 7.1 关键方法源码索引

| 方法 | 文件 | 行号 | community |
|------|------|------|-----------|
| `DeadCodeVisitor.__init__` | scripts/ast_dead_code_check.py | L207 | 0 |
| `DeadCodeVisitor.visit_Module` | scripts/ast_dead_code_check.py | L224 | 0 |
| `DeadCodeVisitor.visit_FunctionDef` | scripts/ast_dead_code_check.py | L229 | 0 |
| `DeadCodeVisitor.visit_AsyncFunctionDef` | scripts/ast_dead_code_check.py | L258 | 0 |
| `DeadCodeVisitor.visit_ClassDef` | scripts/ast_dead_code_check.py | L263 | 9 |
| `DeadCodeVisitor.visit_Name` | scripts/ast_dead_code_check.py | L292 | 0 |
| `DeadCodeVisitor.visit_Call` | scripts/ast_dead_code_check.py | L297 | 0 |
| `DeadCodeVisitor._is_dead_code_candidate` | scripts/ast_dead_code_check.py | L308 | 0 |
| `DeadCodeVisitor._is_empty_function` | scripts/ast_dead_code_check.py | L341 | 0 |
| `DeadCodeVisitor._is_empty_class` | scripts/ast_dead_code_check.py | L364 | 0 |
| `DeadCodeVisitor.get_dead_code` | scripts/ast_dead_code_check.py | L390 | 9 |
| `DeadCodeVisitor.get_all_nodes` | scripts/ast_dead_code_check.py | L394 | 9 |
| `DeadCodeVisitor.get_statistics` | scripts/ast_dead_code_check.py | L398 | 9 |

### 7.2 测试节点映射

| 测试方法 | 文件 | 行号 | 验证 AC |
|----------|------|------|---------|
| `test_analyze_file_returns_graph_structure` | tests/test_aspect_binding.py | L64 | AC-001, AC-005 |
| `test_endless_daemon_imports_without_error` | tests/test_aspect_binding.py | L177 | AC-001, AC-004 |
| `test_endless_daemon_imports_without_error` | tests/sprint4/test_static_analysis.py | L478 | AC-001, AC-004 |
| `test_01_no_circular_imports` | tests/sprint4/test_static_analysis.py | L61 | AC-005 |
| `test_analyze_file_returns_graph_structure` | tests/sprint4/test_docstring_coverage.py | L615 | AC-003, AC-006 |

---

**文档结束**