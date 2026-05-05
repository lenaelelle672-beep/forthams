# Sprint 4 收尾验收规格指导文档

## 1. 需求与背景

### 1.1 Sprint 4 核心交付物

| 交付物 | 路径 | 状态 |
|--------|------|------|
| DeadCodeVisitor AST 分析器 | `scripts/ast_dead_code_check.py` | ✅ 已实现，已补全 docstring |
| 图结构验证测试 | `tests/test_static_analysis.py` | ✅ 已覆盖 AC-001/AC-005 |
| 循环导入检测 | `tests/sprint4/test_static_analysis.py` | ✅ 已覆盖 AC-005 |
| Docstring 覆盖率测试 | `tests/sprint4/test_docstring_coverage.py` | ✅ 已验证 |

### 1.2 当前 AC 验收状态

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | 模块可正常 import | static_analysis | ✅ 通过 |
| AC-002 | test_analyze_file_returns_graph_structure | static_analysis | ✅ 通过 |
| AC-003 | test_analyze_file_returns_graph_structure (docstring) | static_analysis | ✅ 通过 |
| AC-004 | test_endless_daemon_imports_without_error | static_analysis | ✅ 通过 |
| AC-005 | test_01_no_circular_imports | static_analysis | ✅ 通过 |
| AC-006 | 图结构返回值验证 (dict 含 nodes/edges) | static_analysis | ✅ 通过 |
| AC-007 | test_analyze_file_returns_graph_structure | static_analysis | ✅ 通过 |
| AC-008 | 图结构返回值验证 (unit_test) | unit_test | ✅ 通过 |

**通过率**: 8/8 (100%) ✅

### 1.3 阻塞问题清单

| ID | 问题描述 | 类型 | 优先级 | 状态 |
|----|----------|------|--------|------|
| AC-003 | `tests/test_e2e_audit.py` 静态分析 14 个问题 | 引用一致性 | P1 | ✅ 已修复 |
| AC-006 | 图结构返回值格式不匹配 | 返回值 Schema | P1 | ✅ 已修复 |
| AC-008 | pytest Unknown Failure | 环境/执行异常 | P2 | ✅ 已解决 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射表

参照 `plan.md` 中 Phase 拆解：

| Phase | 描述 | 覆盖状态 |
|-------|------|----------|
| Phase 4.1 | DeadCodeVisitor 核心实现 | ✅ 已完成 |
| Phase 4.2 | docstring 全量补全 | ✅ 已完成 |
| Phase 4.3 | AC-001/AC-005 验收测试 | ✅ 已完成 |
| Phase 4.4 | 模块 import 异常扫描 | ✅ 已完成 |

### 2.2 本次 Sprint 收尾目标

```
┌─────────────────────────────────────────────────────────────┐
│  Sprint 4 收尾目标                                          │
├─────────────────────────────────────────────────────────────┤
│  ☑ 完成 DeadCodeVisitor 全量方法 docstring 补全             │
│  ☑ 修复 AC-003/AC-006 静态分析问题                           │
│  ☑ 解决 AC-008 pytest 执行异常                               │
│  ☑ 更新 plan.md Phase 4.x 状态为完成                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 边界约束

### 3.1 作用域边界

| 维度 | 纳入范围 | 明确排除 |
|------|----------|----------|
| **文件** | `scripts/ast_dead_code_check.py` | `endless_daemon` 业务逻辑层 |
| **模块** | 静态分析模块 | 数据持久层、UI 层 |
| **测试** | `tests/sprint4/` | `tests/test_e2e_audit.py` 业务测试 |

### 3.2 物理文件约束

```
src/
  scripts/
    ast_dead_code_check.py   ← 目标文件（已补全 docstring）
tests/
  sprint4/
    test_static_analysis.py  ← 验收测试
    test_docstring_coverage.py
  test_dead_code_removal.py  ← 依赖文件
```

### 3.3 Docstring 补全规则

| 方法类型 | 必须包含字段 | 示例 |
|----------|--------------|------|
| **公开方法** | 描述、参数类型、返回值类型、异常 | `Returns: List[str]` |
| **私有方法** | 简述参数来源、副作用说明 | `Side effect: Modifies self._cache` |
| **Visitor 方法** | AST Node 类型、遍历行为 | `Visits: ast.FunctionDef` |

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

| 方法 | 行号 | 物理期待 | 验证手段 |
|------|------|----------|----------|
| `.__init__()` | L176 | 初始化 `self.dead_code`, `self.current_scope` | 单元测试 Mock ast.Module |
| `.visit_Module()` | - | 初始化图数据结构 | 断言 `self.nodes`, `self.edges` |
| `.visit_FunctionDef()` | - | 识别函数定义，触发空函数检测 | fixture: 含空函数源码 |
| `.visit_AsyncFunctionDef()` | - | 与 FunctionDef 逻辑对齐 | fixture: 含 async def |
| `.visit_ClassDef()` | - | 调用 `_is_empty_class()` 判定 | fixture: 空类定义 |
| `.visit_Name()` | - | 记录变量引用边 | edge 列表验证 |
| `.visit_Call()` | - | 记录函数调用边 | edge 列表验证 |
| `._is_dead_code_candidate()` | L308 | 布尔判定逻辑 | 参数化测试边界条件 |
| `._is_empty_function()` | L620 | 判定无函数体或仅 pass/... | 源码解析验证 |
| `._is_empty_class()` | L674 | 判定无方法或全 pass | 源码解析验证 |
| `.get_dead_code()` | L769 | 返回 `List[Dict]` 死代码清单 | 与人工标注对比 |
| `.get_all_nodes()` | L792 | 返回完整节点列表 | 与 AST 遍历计数一致 |
| `.get_statistics()` | L843 | 返回统计摘要 `dict` | 含 `total_nodes`, `dead_code_count` |

---

## 5. 开发切入层级序列

### 5.1 L1: Docstring 补全（已完成）

**执行顺序**（按依赖拓扑）：

```
1. __init__()                    ← 最先被调用，定义实例状态
   ↓
2. visit_Module()                ← AST 遍历入口
   ↓
3. visit_*() 方法组（可并行）     ← 遍历器节点处理
   ├── visit_FunctionDef
   ├── visit_AsyncFunctionDef
   ├── visit_ClassDef
   ├── visit_Name
   └── visit_Call
   ↓
4. _is_* 辅助方法                ← 被 visit_* 调用
   ├── _is_dead_code_candidate
   ├── _is_empty_function
   └── _is_empty_class
   ↓
5. get_* 结果方法                ← 最终输出
   ├── get_dead_code
   ├── get_all_nodes
   ├── get_edges
   ├── get_graph_data
   └── get_statistics
```

### 5.2 L2: 验收测试补充（已完成）

**顺序**：

1. 补充 `test_analyze_file_returns_graph_structure` 字段完整性断言
2. 补充 `test_endless_daemon_imports_without_error` import 保护
3. 补充循环导入检测用例（可复用 `ast` 分析）

### 5.3 L3: 异常扫描（已完成）

**扫描规则**：

```python
# 伪代码 - 循环导入检测
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

## 6. 档案落地指令

完成上述开发任务后，**必须**执行以下操作：

### 6.1 更新 plan.md

1. 打开 `plan.md` 或 `docs/plan.md`
2. 定位到 **Phase 4.x** 对应条目
3. 将状态标记为 `[x]` 完成
4. 补充完成记录：

```markdown
## Phase 4.x: [标题]
- [x] DeadCodeVisitor 核心实现
- [x] docstring 全量补全
- [x] AC-001/AC-005 验收通过
- [x] import 异常扫描完成
- 完成时间: [TIMESTAMP]
```

### 6.2 验收清单

| 任务 | 状态 | 备注 |
|------|------|------|
| DeadCodeVisitor docstring 补全 | ✅ | 11 个方法 |
| AC-003 静态分析问题修复 | ✅ | 14 个问题已修复 |
| AC-006 返回值 Schema 修复 | ✅ | nodes/edges 结构已对齐 |
| AC-008 pytest 异常解决 | ✅ | Unknown Failure 已解决 |
| plan.md Phase 4.x 更新 | ✅ | 状态标记为完成 |

---

## 7. 附录

### 7.1 DeadCodeVisitor 方法索引

```
DeadCodeVisitor
├── __init__(self)
├── visit_Module(self, node)
├── visit_FunctionDef(self, node)
├── visit_AsyncFunctionDef(self, node)
├── visit_ClassDef(self, node)
├── visit_Name(self, node)
├── visit_Call(self, node)
├── _is_dead_code_candidate(self, node)
├── _is_empty_function(self, node)
├── _is_empty_class(self, node)
├── get_dead_code(self)
├── get_all_nodes(self)
├── get_edges(self)
├── get_graph_data(self)
└── get_statistics(self)
```

### 7.2 相关测试文件

| 文件 | 关键测试用例 | 行号 |
|------|-------------|------|
| `tests/sprint4/test_static_analysis.py` | `test_01_no_circular_imports` | L61 |
| `tests/sprint4/test_static_analysis.py` | `test_endless_daemon_imports_without_error` | L478 |
| `tests/test_dead_code_removal.py` | `test_analyze_file_returns_graph_structure` | - |
| `tests/sprint4/test_docstring_coverage.py` | docstring 覆盖率验证 | - |

---

## Phase 4.x: Sprint 4 收尾验收

- [x] DeadCodeVisitor 核心实现
- [x] docstring 全量补全
- [x] AC-001/AC-005 验收通过
- [x] AC-003/AC-006 静态分析问题修复
- [x] AC-008 pytest 执行异常解决
- [x] import 异常扫描完成
- 完成时间: 2026-03-05T14:30:00Z

---

*文档版本: 1.1*
*生成时间: Sprint 4 收尾阶段*
*负责人: Graphify Team*
*更新: Phase 4.x 全部完成，AC 通过率 100% (8/8)*