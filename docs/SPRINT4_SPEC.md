# SWARM-001 DeadCodeVisitor 性能基准测试与算法优化规格文档

**Iteration**: 2  
**Phase**: Phase 2 - 性能基线建立与热点分析  
**Status**: Active  
**Component**: `scripts/ast_dead_code_check.py` DeadCodeVisitor

---

## 1. 需求与背景

### 1.1 业务目标
对 `DeadCodeVisitor` AST 分析器进行系统化性能基准测试，建立性能度量体系，识别热点算法并实施优化，使其能够高效处理大规模 Python 代码库。

**性能目标**:
- 单文件 >10,000 行代码
- 多模块项目 >100,000 行 AST 节点
- 单文件遍历 < 500ms
- 100K 节点图构建 < 2s

### 1.2 技术现状
- **核心类**: `DeadCodeVisitor` (L67)
- **主要遍历方法**: `visit_Module`, `visit_FunctionDef`, `visit_AsyncFunctionDef`, `visit_ClassDef`, `visit_Name`, `visit_Call`
- **热点方法** (待验证): `_is_empty_function`, `_is_dead_code_candidate`, `_analyze_dead_code`
- **数据获取方法**: `get_graph_data`, `get_all_nodes`, `get_edges`, `get_dead_code`, `get_statistics`

### 1.3 性能痛点假设
1. 重复的 AST 节点遍历（函数体被多次访问）
2. `visit_Name` 中 name-to-id 映射的低效查询
3. `_is_dead_code_candidate` 的冗余模式匹配
4. `_analyze_dead_code` 在大数据集上的 O(n²) 复杂度

---

## 2. 边界约束

### 2.1 功能约束
| 约束类型 | 要求 |
|----------|------|
| 准确性不降级 | 死代码检测准确率在优化后必须 ≥ 优化前 |
| API 兼容性 | 公共方法签名与返回值结构保持不变 |
| 测试覆盖 | 所有现有单元测试必须通过 |

### 2.2 性能约束
| 指标 | 当前基线 (待测量) | 目标 | 测量方法 |
|------|-------------------|------|----------|
| 单文件解析时间 | TBD | ≤ 原基线的 80% | `time.perf_counter()` |
| 内存峰值 | TBD | ≤ 原基线的 75% | `tracemalloc` |
| 10K 行代码遍历 | TBD | < 500ms | pytest-benchmark |
| 100K 节点图构建 | TBD | < 2s | pytest-benchmark |

### 2.3 环境约束
- Python 3.9+
- 标准库 `ast` 模块 + 内建遍历器
- 允许使用: `cProfile`, `tracemalloc`, `pytest-benchmark`

### 2.4 范围约束
- **In Scope**: 性能测试、算法优化、基准数据建立
- **Out of Scope**: 新的死代码检测规则、UI/报告功能、并行化改造

---

## 3. 验收测试基准 (ATB)

### ATB-1: 基准测试框架建立
| 测试用例 ID | 物理测试命令 | 成功标准 |
|-------------|--------------|----------|
| ATB-1.1 | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_single_file_small -v` | 时间标准差 < 5% |
| ATB-1.2 | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_single_file_large -v` | 记录基准时间 |
| ATB-1.3 | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_multi_module -v` | 跨模块计时 |
| ATB-1.4 | `pytest tests/sprint4/test_static_analysis.py::test_memory_baseline -v` | 记录内存峰值 |

### ATB-2: 热点分析方法
| 测试用例 ID | 物理测试命令 | 成功标准 |
|-------------|--------------|----------|
| ATB-2.1 | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_module --profile` | 输出 top 5 热点 |
| ATB-2.2 | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_name --profile` | 记录调用次数 |
| ATB-2.3 | `pytest tests/sprint4/test_static_analysis.py::test_identify_algorithm_bottleneck -v` | 输出瓶颈列表 |

### ATB-3: 现有功能回归验证
| 测试用例 ID | 物理测试命令 | 成功标准 |
|-------------|--------------|----------|
| ATB-3.1 | `pytest tests/test_dead_code_removal.py -v` | 全部通过 |
| ATB-3.2 | `pytest tests/test_ast_analyzer.py -v` | 全部通过 |
| ATB-3.3 | `pytest tests/sprint4/test_static_analysis.py::TestASTAnalysisEdgeCases -v` | 全部通过 |

### ATB-4: 优化效果验证
| 测试用例 ID | 物理测试命令 | 成功标准 |
|-------------|--------------|----------|
| ATB-4.1 | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_visit_function -v` | 时间 < 基线 × 0.8 |
| ATB-4.2 | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_dead_code_analysis -v` | 减少循环次数 |
| ATB-4.3 | `pytest tests/sprint4/test_static_analysis.py::test_optimization_memory_reduction -v` | 内存 < 基线 × 0.75 |

### ATB-5: 准确性对比
| 测试用例 ID | 物理测试命令 | 成功标准 |
|-------------|--------------|----------|
| ATB-5.1 | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_empty_functions -v` | 检测结果一致 |
| ATB-5.2 | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_dead_code -v` | 标记结果集相同 |

---

## 4. 开发切入层级序列

### Level 1: 测试基础设施 (第 1-2 天)

```
scripts/
└── benchmark/
    ├── __init__.py
    ├── fixtures/
    │   ├── __init__.py                    # 本文件
    │   ├── large_function.py              # 10K 行函数代码
    │   ├── nested_classes.py              # 100 层嵌套类
    │   └── mixed_async_sync.py             # 500 异步/同步函数混合
    └── test_data/
        └── large_project/                 # 模拟 100K 节点项目
            ├── module_a.py
            ├── module_b.py
            └── ...
```

### Level 2: 热点分析实施 (第 3-4 天)

**切入点顺序**:
1. `visit_Module` (L161) → 模块级入口，计时起点
2. `visit_FunctionDef` / `visit_AsyncFunctionDef` (L194, L274) → 函数遍历
3. `visit_Name` (L446) → 名称引用解析（高频调用）
4. `_is_empty_function` (L634) → 空函数检测
5. `_analyze_dead_code` (L745) → 死代码分析汇总

### Level 3: 算法优化实施 (第 5-7 天)

**优化优先级矩阵**:

| 优先级 | 方法 | 当前复杂度 | 目标复杂度 | 优化策略 |
|--------|------|------------|------------|----------|
| P0 | `_get_node_id_for_name` (L556) | O(n) 线性查找 | O(1) 哈希查找 | 引入 `node_id_cache` |
| P0 | `_is_dead_code_candidate` (L572) | 每次调用正则 | 预编译模式 | 静态编译正则表达式 |
| P1 | `visit_Name` (L446) | 无条件全量访问 | 条件过滤 | 增加早期返回 |
| P1 | `_analyze_dead_code` (L745) | O(n²) 嵌套循环 | O(n) 单遍 | 合并为单一 pass |
| P2 | `get_graph_data` (L873) | 每次重建 | 增量更新 | 添加脏标记机制 |

---

## 5. 关键代码位置索引

| 用途 | 文件 | 行号 |
|------|------|------|
| DeadCodeVisitor 主类 | `scripts/ast_dead_code_check.py` | L67 |
| 遍历方法入口 | `scripts/ast_dead_code_check.py` | L161 |
| 函数定义访问 | `scripts/ast_dead_code_check.py` | L194, L274 |
| 类定义访问 | `scripts/ast_dead_code_check.py` | L350 |
| 名称引用访问 | `scripts/ast_dead_code_check.py` | L446 |
| 函数调用访问 | `scripts/ast_dead_code_check.py` | L483 |
| 空函数检测 | `scripts/ast_dead_code_check.py` | L634 |
| 死代码候选判断 | `scripts/ast_dead_code_check.py` | L572 |
| 死代码分析汇总 | `scripts/ast_dead_code_check.py` | L745 |
| 图数据获取 | `scripts/ast_dead_code_check.py` | L873 |
| 测试用例位置 | `tests/test_dead_code_removal.py` | L34+ |
| 测试用例位置 | `tests/test_ast_analyzer.py` | L76+ |
| 边界测试位置 | `tests/sprint4/test_static_analysis.py` | L885+ |

---

## 6. 基准测试夹具规格

### 6.1 大规模函数 (large_function.py)
- **目的**: 测试单函数体巨大时的遍历性能
- **规格**: 10,000+ 行 Python 代码，单个函数体
- **内容**: 包含变量赋值、表达式计算、条件分支、循环结构
- **预期 AST 节点数**: ~50,000 节点

### 6.2 嵌套类 (nested_classes.py)
- **目的**: 测试深层次类嵌套对图构建的影响
- **规格**: 100 层类嵌套，每层包含方法、属性
- **内容**: 多层继承、嵌套函数、闭包
- **预期 AST 节点数**: ~30,000 节点

### 6.3 混合异步同步 (mixed_async_sync.py)
- **目的**: 测试 visit_FunctionDef 与 visit_AsyncFunctionDef 的分支性能
- **规格**: 500 个函数定义，异步/同步混合
- **内容**: async def、await 调用、Task 创建
- **预期 AST 节点数**: ~25,000 节点

---

**文档版本**: 1.0  
**创建日期**: Iteration 2  
**审核状态**: 待 review