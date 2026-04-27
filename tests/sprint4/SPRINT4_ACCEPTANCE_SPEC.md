# Sprint 4 收尾验收规格指导

## 文档版本

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0.0 | 2024-XX-XX | Builder | 初始版本 |

## 1. 范围与目的

本文档定义 Sprint 4 收尾阶段针对 `tests/sprint4/test_static_analysis.py` 的验收测试规格，确保 Graphify 知识图谱模块的静态分析功能满足 AC-001、AC-004、AC-005 验收标准。

### 1.1 目标文件

```
tests/sprint4/test_static_analysis.py
```

### 1.2 关联验收标准

| AC ID | 描述 | 测试方法 | 优先级 |
|-------|------|----------|--------|
| AC-001 | 模块可正常 import | `test_endless_daemon_imports_without_error()` | CRITICAL |
| AC-004 | 模块 import 无异常 | `test_endless_daemon_imports_without_error()` | P0 |
| AC-005 | 循环依赖检测 | `test_01_no_circular_imports()` | P1 |

### 1.3 关联实现

根据 Localization Report，核心实现位于：

- **`src/endless_daemon.py`** (community=0, 931 行)
  - `DeadCodeVisitor` 类 (L176 起始)
  - `visit_Module()` (L386)
  - `visit_FunctionDef()` (L396)
  - `visit_ClassDef()` (L477)
  - `visit_Name()` (L514)
  - `visit_Call()` (L529)
  - `_is_dead_code_candidate()` (L549)
  - `_is_empty_function()` (L583)
  - `_is_empty_class()` (L626)
  - `get_dead_code()` (L656)
  - `get_all_nodes()` (L683)
  - `get_statistics()` (L732)

---

## 2. 验收测试规格 (ATB)

### ATB-3.2: 模块 Import 验证

**AC ID**: AC-001, AC-004

**物理期待**:
- `import endless_daemon` 执行无 `ModuleNotFoundError`
- `from scripts import ast_dead_code_check` 正常
- `DeadCodeVisitor` 类可访问

**测试方法签名**:
```python
def test_endless_daemon_imports_without_error(self):
    """
    ATB-3.2: 模块可正常 import
    
    物理期待:
    - import endless_daemon 无 ModuleNotFoundError
    - from scripts import ast_dead_code_check 正常
    - DeadCodeVisitor 类可访问
    """
```

**验收命令**:
```bash
pytest tests/sprint4/test_static_analysis.py::TestModuleImports::test_endless_daemon_imports_without_error -v
```

**失败判定**: 抛出 `ModuleNotFoundError` 或 `ImportError`

---

### ATB-3.2.1: 深度 Import 验证

**测试方法签名**:
```python
def test_ast_dead_code_check_imports(self):
    """
    ATB-3.2.1: 深度模块导入验证
    
    物理期待:
    - scripts.ast_dead_code_check 可导入
    - DeadCodeVisitor 类可实例化
    """
```

**验收命令**:
```bash
pytest tests/sprint4/test_static_analysis.py::TestModuleImports::test_ast_dead_code_check_imports -v
```

---

### ATB-5.1: 循环依赖检测

**AC ID**: AC-005

**物理期待**: `endless_daemon` 模块及其依赖链中无循环 import

**测试方法签名**:
```python
def test_01_no_circular_imports(self):
    """
    ATB-5.1: 循环依赖检测
    
    物理期待:
    - endless_daemon 模块无循环 import
    - 所有 import 语句可解析
    """
```

**验收命令**:
```bash
pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports -v
```

---

## 3. 边界约束

### 3.1 强制约束

| 约束类型 | 描述 | 违反后果 |
|----------|------|----------|
| `community=9` 保留 | `DeadCodeVisitor.get_dead_code()` 等方法为公共 API | 破坏外部依赖 |
| Import 隔离 | 每个测试方法须独立执行 import | 跨测试污染 |
| 异常捕获范围 | 仅捕获 `ModuleNotFoundError`, `ImportError` | 隐藏真实错误 |

### 3.2 禁止事项

- 禁止在测试方法内修改 `sys.path`
- 禁止使用 `mock.patch` 绕过实际 import
- 禁止删除 `test_endless_daemon_imports_without_error` 方法

---

## 4. 执行序列

### 4.1 验收测试执行顺序

```bash
# Step 1: 先执行 import 测试 (AC-001/AC-004)
pytest tests/sprint4/test_static_analysis.py::TestModuleImports::test_endless_daemon_imports_without_error -v

# Step 2: 执行深度 import 验证
pytest tests/sprint4/test_static_analysis.py::TestModuleImports::test_ast_dead_code_check_imports -v

# Step 3: 执行循环依赖检测 (AC-005)
pytest tests/sprint4/test_static_analysis.py::test_01_no_circular_imports -v

# Step 4: 执行完整测试类
pytest tests/sprint4/test_static_analysis.py::TestModuleImports -v
```

### 4.2 独立验证命令

```bash
# 独立 Python 验证
cd /path/to/project && python -c "
import endless_daemon
print('✅ endless_daemon imported successfully')

from scripts.ast_dead_code_check import DeadCodeVisitor
print('✅ DeadCodeVisitor accessible')

v = DeadCodeVisitor()
print('✅ DeadCodeVisitor instantiated')
"
```

---

## 5. 里程碑检查清单

| # | 检查项 | 验证方法 | 状态 |
|---|--------|----------|------|
| 1 | `test_endless_daemon_imports_without_error` 通过 | `pytest -v` | ⬜ |
| 2 | `test_ast_dead_code_check_imports` 通过 | `pytest -v` | ⬜ |
| 3 | `test_01_no_circular_imports` 通过 | `pytest -v` | ⬜ |
| 4 | `import endless_daemon` 无异常 | Python CLI | ⬜ |
| 5 | `DeadCodeVisitor` 可实例化 | Python CLI | ⬜ |
| 6 | 无 `ModuleNotFoundError` | 全部测试通过 | ⬜ |

---

## 6. 已知限制

### 6.1 当前阻塞问题

根据 AC Criteria 报告:

| AC ID | 问题描述 | 状态 |
|-------|----------|------|
| AC-003 | `test_e2e_audit.py` 存在 13 个静态分析问题 | 待修复 |
| AC-006 | 图结构返回值与预期 schema 不匹配 | 待修复 |
| AC-008 | pytest 执行抛出 `Unknown Failure` | 待排查 |

> **注**: `AC-003/006/008` 问题集中在 `tests/test_e2e_audit.py`，不在本文档范围内。

### 6.2 依赖项

- Python 3.8+
- `ast` (标准库)
- `pytest` 7.0+

---

## 7. 参考资料

### 7.1 相关文件

| 文件 | 说明 |
|------|------|
| `src/endless_daemon.py` | 核心实现文件 (DeadCodeVisitor) |
| `scripts/ast_dead_code_check.py` | AST 静态分析脚本 |
| `tests/test_aspect_binding.py` | 图结构验证测试 |
| `tests/sprint4/test_docstring_coverage.py` | Docstring 覆盖率测试 |

### 7.2 AC 验收状态

根据最近一次验收报告:

```
通过率: 5/8 (62.5%)
综合评分: 52
```

**待通过项**: AC-003, AC-006, AC-008

---

## 8. 附录: 测试模板

### 8.1 Import 测试标准模板

```python
class TestModuleImports:
    """ATB-3.2: 模块可正常 import"""
    
    def test_endless_daemon_imports_without_error(self):
        """
        AC-001: 模块可正常 import
        
        物理期待:
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

### 8.2 循环依赖检测模板

```python
def test_01_no_circular_imports():
    """
    AC-005: 循环依赖检测
    
    物理期待:
    - endless_daemon 模块无循环 import
    - 所有 import 语句可解析
    """
    # 实现循环依赖检测逻辑
    pass
```

---

**文档结束**