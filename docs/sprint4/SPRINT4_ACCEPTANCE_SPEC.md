# Sprint 4 收尾验收规格文档

## 1. 需求与背景

本 Sprint 4 收尾阶段聚焦于 Graphify 知识图谱的 **DeadCodeVisitor AST 分析器**核心交付物验收，涉及以下关键路径：

| 交付项 | 文件位置 | 状态 |
|--------|----------|------|
| DeadCodeVisitor 核心实现 | `scripts/ast_dead_code_check.py` | ✅ 已完成 |
| Docstring 全量补全 | 同上 | 🔲 待验收 |
| AC-001~AC-008 验收测试 | `tests/sprint4/test_docstring_coverage.py` | 🔲 进行中 |

**当前通过率**: 62.5% (5/8)，阻塞项为 AC-003、AC-006、AC-008。

---

## 2. 当前 Phase 对应实施目标

参照 `plan.md` Phase 4 拆解：

```
Phase 4.1: DeadCodeVisitor 核心实现     [✅ 完成]
Phase 4.2: docstring 全量补全            [🔲 本次核心任务]
Phase 4.3: AC-001/AC-005 验收测试        [🔲 逐项核查]
Phase 4.4: 模块 import 异常扫描          [🔲 循环引用检测]
```

### 2.1 DeadCodeVisitor 方法清单

| 方法签名 | 行号 | 类型 | Docstring 状态 |
|----------|------|------|----------------|
| `__init__()` | L176 | 公开 | 🔲 需补充 |
| `visit_Module()` | L230 | Visitor | 🔲 需补充 |
| `visit_FunctionDef()` | L290 | Visitor | 🔲 需补充 |
| `visit_AsyncFunctionDef()` | L299 | Visitor | 🔲 需补充 |
| `visit_ClassDef()` | L308 | Visitor | 🔲 需补充 |
| `visit_Name()` | L330 | Visitor | 🔲 需补充 |
| `visit_Call()` | L350 | Visitor | 🔲 需补充 |
| `_is_dead_code_candidate()` | L620 | 私有 | 🔲 需补充 |
| `_is_empty_function()` | L674 | 私有 | 🔲 需补充 |
| `_is_empty_class()` | L717 | 私有 | 🔲 需补充 |
| `get_dead_code()` | L769 | 公开 | 🔲 需补充 |
| `get_all_nodes()` | L792 | 公开 | 🔲 需补充 |
| `get_edges()` | L807 | 公开 | 🔲 需补充 |
| `get_graph_data()` | L822 | 公开 | 🔲 需补充 |
| `get_statistics()` | L843 | 公开 | 🔲 需补充 |

---

## 3. 边界约束

### 3.1 作用域边界

| 纳入范围 | 明确排除 |
|----------|----------|
| `scripts/ast_dead_code_check.py` 所有公开/私有方法 | `endless_daemon` 业务逻辑层 |
| `tests/sprint4/test_docstring_coverage.py` 验收测试 | 非 spec 指定的文件 |

### 3.2 Docstring 补全规范

#### 公开方法模板

```python
def method_name(self, param: Type) -> ReturnType:
    """[一句话描述方法功能].

    Args:
        param: 参数描述

    Returns:
        返回值类型及含义

    Raises:
        ExceptionType: 异常触发条件

    Example:
        >>> result = obj.method_name(arg)
    """
```

#### 私有方法模板

```python
def _helper_method(self, data: Dict) -> bool:
    """[简述辅助逻辑].

    Note:
        被 [调用方] 调用，副作用说明
    """
```

#### AST Visitor 方法模板

```python
def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
    """访问函数定义节点.

    Args:
        node: ast.FunctionDef AST 节点

    Visits:
        触发 _is_empty_function() 判定

    Side effect:
        向 self.nodes 添加函数节点
    """
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-3.2: 模块可正常 import

| 测试用例 | 物理期待 | 断言方式 |
|----------|----------|----------|
| `test_endless_daemon_imports_without_error` (L478) | `import endless_daemon` 无 `ModuleNotFoundError` | `try/except ImportError` 捕获 |
| `test_01_no_circular_imports` (L61) | 所有 `import` 语句不触发循环依赖 | 拓扑排序验证无环 |

### 4.2 ATB-1.1 & AC-005: 图结构返回值验证

| 测试用例 | 物理期待 | 断言字段 |
|----------|----------|----------|
| `test_analyze_file_returns_graph_structure` | 返回 `dict` | 包含 `nodes` (List)、`edges` (List) |
| `test_analyze_file_returns_graph_structure` | nodes 内每项为 `dict` | 含 `id`, `type`, `lineno`, `name` |
| `test_analyze_file_returns_graph_structure` | edges 内每项为 `dict` | 含 `source`, `target`, `type` |

### 4.3 AC-001: DeadCodeVisitor 完整方法覆盖

| 方法 | 物理期待 | 验证手段 |
|------|----------|----------|
| `visit_Module` | 初始化 `self.dead_code`, `self.current_scope` | 单元测试 Mock ast.Module |
| `visit_FunctionDef` | 识别函数定义，触发空函数检测 | fixture: 含空函数源码 |
| `visit_AsyncFunctionDef` | 与 FunctionDef 逻辑对齐 | fixture: 含 async def |
| `visit_ClassDef` | 调用 `_is_empty_class()` 判定 | fixture: 空类定义 |
| `visit_Call` | 记录函数调用边 | edge 列表验证 |
| `_is_dead_code_candidate` | 布尔判定逻辑 | 参数化测试边界条件 |
| `_is_empty_function` | 判定无函数体或仅 pass/... | 源码解析验证 |
| `_is_empty_class` | 判定无方法或全 pass | 源码解析验证 |
| `get_dead_code` | 返回 `List[Dict]` 死代码清单 | 与人工标注对比 |
| `get_all_nodes` | 返回完整节点列表 | 与 AST 遍历计数一致 |
| `get_statistics` | 返回统计摘要 `dict` | 含 `total_nodes`, `dead_code_count` |

---

## 5. 开发切入层级序列

### 5.1 L1: Docstring 补全（优先执行）

**执行顺序**（按依赖拓扑）：

```
[第一梯队 - 状态初始化]
1. __init__()           → 最先被调用，定义实例状态

[第二梯队 - AST 遍历入口]
2. visit_Module()       → 遍历入口

[第三梯队 - Visitor 方法组（可并行）]
3. visit_FunctionDef
4. visit_AsyncFunctionDef
5. visit_ClassDef
6. visit_Name
7. visit_Call

[第四梯队 - 私有辅助方法（被上方调用）]
8.  _is_dead_code_candidate
9.  _is_empty_function
10. _is_empty_class

[第五梯队 - 结果输出方法]
11. get_dead_code
12. get_all_nodes
13. get_edges
14. get_graph_data
15. get_statistics
```

### 5.2 L2: 验收测试补充

**顺序**：

1. 补充 `test_analyze_file_returns_graph_structure` 字段完整性断言
2. 补充 `test_endless_daemon_imports_without_error` import 保护
3. 补充循环导入检测用例

### 5.3 L3: 异常扫描规则

```python
# 伪代码
for module in all_python_files:
    try:
        import module
    except ModuleNotFoundError as e:
        log(f"Missing: {e.name}")
    except ImportError as e:
        if "circular" in str(e).lower():
            log(f"Circular import detected in {module}")
```

---

## 6. AC 逐条验收清单

| AC ID | 描述 | 验证方法 | 当前状态 | 阻塞原因 |
|-------|------|----------|----------|----------|
| AC-001 | 模块可正常 import | static_analysis | ✅ 通过 | - |
| AC-002 | test_analyze_file_returns_graph_structure | static_analysis | ✅ 通过 | - |
| AC-003 | test_analyze_file_returns_graph_structure | static_analysis | ❌ 失败 | 14 个静态分析问题 |
| AC-004 | test_endless_daemon_imports_without_error | static_analysis | ✅ 通过 | - |
| AC-005 | test_01_no_circular_imports | static_analysis | ✅ 通过 | - |
| AC-006 | 图结构返回值验证 | static_analysis | ❌ 失败 | 14 个静态分析问题 |
| AC-007 | test_analyze_file_returns_graph_structure | static_analysis | ✅ 通过 | - |
| AC-008 | 图结构返回值验证 | unit_test | ❌ 失败 | pytest Unknown Failure |

### 6.1 阻塞项修复优先级

```
[P0 - 立即修复]
AC-006: 图结构返回值格式不匹配
        → 检查 get_graph_data() 返回 dict 是否包含 nodes、edges

[P1 - 紧急修复]
AC-003: 静态分析发现 14 个问题
        → 重点检查 tests/test_e2e_audit.py 引用一致性

AC-008: pytest Unknown Failure
        → 排查依赖缺失或 mock 失败
```

---

## 7. 档案落地指令

完成上述开发任务后，**必须**执行以下操作：

1. 打开项目根目录 `plan.md` 或 `docs/plan.md`
2. 定位到 **Phase 4.x** 对应条目
3. 将状态标记为 `[x]` 完成
4. 补充签署记录：

```markdown
## Sprint 4 收尾签署

- [x] AC-001: 模块可正常 import ✅
- [x] AC-002: test_analyze_file_returns_graph_structure ✅
- [x] AC-003: test_analyze_file_returns_graph_structure ✅
- [x] AC-004: test_endless_daemon_imports_without_error ✅
- [x] AC-005: test_01_no_circular_imports ✅
- [x] AC-006: 图结构返回值验证 ✅
- [x] AC-007: test_analyze_file_returns_graph_structure ✅
- [x] AC-008: pytest 执行验证 ✅

签署人: __________
日期: __________
```

---

## 8. 附录：DeadCodeVisitor 结构图

```
DeadCodeVisitor (ast.NodeVisitor)
├── __init__()
│   └── 初始化: nodes, edges, dead_code, current_scope, statistics
│
├── visit_Module(node)
│   └── 遍历模块级定义
│
├── visit_FunctionDef(node) / visit_AsyncFunctionDef(node)
│   └── 记录函数定义节点
│   └── 调用 _is_empty_function() 判定
│
├── visit_ClassDef(node)
│   └── 记录类定义节点
│   └── 调用 _is_empty_class() 判定
│
├── visit_Name(node)
│   └── 记录变量引用
│
├── visit_Call(node)
│   └── 记录函数调用边
│
├── _is_dead_code_candidate(node) [私有]
│   └── 判定是否为死代码候选
│
├── _is_empty_function(node) [私有]
│   └── 判定空函数体
│
├── _is_empty_class(node) [私有]
│   └── 判定空类定义
│
├── get_dead_code()
│   └── 返回死代码清单 List[Dict]
│
├── get_all_nodes()
│   └── 返回完整节点列表
│
├── get_edges()
│   └── 返回边列表
│
├── get_graph_data()
│   └── 返回 {nodes: [...], edges: [...]} 字典
│
└── get_statistics()
    └── 返回统计摘要 dict
```

---

*本文档由 Graphify 知识图谱项目组编制，用于 Sprint 4 收尾阶段验收指导。*