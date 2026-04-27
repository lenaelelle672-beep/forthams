# SWARM-001 DeadCodeVisitor 性能基准测试与算法优化规格文档

**Iteration**: 2  
**Status**: Active  
**Component**: `scripts/ast_dead_code_check.py` DeadCodeVisitor

---

## 需求与背景

### 业务目标
对 `DeadCodeVisitor` AST 分析器进行系统化性能基准测试，建立性能度量体系，识别热点算法并实施优化，使其能够高效处理大规模 Python 代码库（目标：单文件 >10,000 行，多模块项目 >100,000 行 AST 节点）。

### 技术现状
- **核心类**: `DeadCodeVisitor` (L67)
- **主要遍历方法**: `visit_Module`, `visit_FunctionDef`, `visit_AsyncFunctionDef`, `visit_ClassDef`, `visit_Name`, `visit_Call`
- **热点方法** (待验证): `_is_empty_function`, `_is_dead_code_candidate`, `_analyze_dead_code`
- **数据获取方法**: `get_graph_data`, `get_all_nodes`, `get_edges`, `get_dead_code`, `get_statistics`

### 性能痛点假设
1. 重复的 AST 节点遍历（函数体被多次访问）
2. `visit_Name` 中 name-to-id 映射的低效查询
3. `_is_dead_code_candidate` 的冗余模式匹配
4. `_analyze_dead_code` 在大数据集上的 O(n²) 复杂度

---

## 当前 Phase 对应实施目标

### Phase 定位（参照 plan.md）
本次 Iteration 2 对应 **Phase 2: 性能基线建立与热点分析**

| Phase | 目标 | Iteration |
|-------|------|-----------|
| Phase 1 | 基础功能验证 | Iteration 1 |
| **Phase 2** | **性能基线建立与热点分析** | **Iteration 2 (当前)** |
| Phase 3 | 算法优化实施 | Iteration 3 |
| Phase 4 | 大规模验证与回归 | Iteration 4 |

### Phase 2 核心交付物
1. **性能基准测试套件**: 可重复的性能测试用例，覆盖单文件、多模块、大规模场景
2. **热点分析报告**: 基于 cProfile/snakeviz 的函数级性能分析
3. **优化前 baseline 数据**: 关键指标的时间/空间基准值

---

## 边界约束

### 功能约束
- **准确性不降级**: 死代码检测准确率在优化后必须 ≥ 优化前（通过现有测试用例回归）
- **API 兼容性**: 公共方法签名与返回值结构保持不变
- **测试覆盖**: 所有现有单元测试必须通过

### 性能约束
| 指标 | 当前基线 (待测量) | 目标 | 测量方法 |
|------|-------------------|------|----------|
| 单文件解析时间 | TBD | ≤ 原基线的 80% | `time.perf_counter()` |
| 内存峰值 | TBD | ≤ 原基线的 75% | `tracemalloc` |
| 10K 行代码遍历 | TBD | < 500ms | pytest-benchmark |
| 100K 节点图构建 | TBD | < 2s | pytest-benchmark |

### 环境约束
- Python 3.9+
- 标准库 AST 模块 + `ast` 内建遍历器
- 禁止引入第三方性能分析库（仅使用 `cProfile`, `tracemalloc`, `pytest-benchmark`）

### 范围约束
- **In Scope**: 性能测试、算法优化、基准数据建立
- **Out of Scope**: 新的死代码检测规则、UI/报告功能、并行化改造

---

## 验收测试基准 (ATB)

### ATB-1: 基准测试框架建立
**功能**: 提供可重复执行的性能基准测试基础设施

| 测试用例 | 物理测试命令 | 成功标准 |
|----------|--------------|----------|
| `test_benchmark_single_file_small` | `pytest tests/sprint4/test_static_analysis.py::test_perf_single_file_small -v` | 多次执行时间标准差 < 5% |
| `test_benchmark_single_file_large` | `pytest tests/sprint4/test_static_analysis.py::test_perf_single_file_large -v` | 执行时间记录到基准数据库 |
| `test_benchmark_multi_module` | `pytest tests/sprint4/test_static_analysis.py::test_perf_multi_module -v` | 支持跨模块死代码分析计时 |
| `test_memory_baseline` | `pytest tests/sprint4/test_static_analysis.py::test_memory_baseline -v` | tracemalloc 峰值记录 |

### ATB-2: 热点分析方法
**功能**: 识别 DeadCodeVisitor 的性能热点函数

| 测试用例 | 物理测试命令 | 成功标准 |
|----------|--------------|----------|
| `test_profile_visit_module` | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_module --profile` | cProfile 输出显示 top 5 热点 |
| `test_profile_visit_name` | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_name --profile` | `_get_node_id_for_name` 调用次数 ≤ 预期 |
| `test_identify_algorithm_bottleneck` | `pytest tests/sprint4/test_static_analysis.py::test_identify_algorithm_bottleneck -v` | 输出瓶颈函数列表 |

### ATB-3: 现有功能回归验证
**功能**: 确保优化不破坏现有检测能力

| 测试用例 | 物理测试命令 | 成功标准 |
|----------|--------------|----------|
| `TestDeadCodeVisitor` 全量 | `pytest tests/test_dead_code_removal.py -v` | 全部通过 |
| `TestASTAnalyzer` 全量 | `pytest tests/test_ast_analyzer.py -v` | 全部通过 |
| `TestASTAnalysisEdgeCases` | `pytest tests/sprint4/test_static_analysis.py::TestASTAnalysisEdgeCases -v` | 全部通过 |

### ATB-4: 优化效果验证
**功能**: 验证优化后性能提升

| 测试用例 | 物理测试命令 | 成功标准 |
|----------|--------------|----------|
| `test_optimization_speedup_visit_function` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_visit_function -v` | 优化后时间 < 优化前 × 0.8 |
| `test_optimization_speedup_dead_code_analysis` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_dead_code_analysis -v` | `_analyze_dead_code` 减少循环次数 |
| `test_optimization_memory_reduction` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_memory_reduction -v` | 峰值内存 < 优化前 × 0.75 |

### ATB-5: 准确性对比
**功能**: 优化前后检测结果一致性

| 测试用例 | 物理测试命令 | 成功标准 |
|----------|--------------|----------|
| `test_accuracy_unchanged_empty_functions` | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_empty_functions -v` | 空函数检测结果完全一致 |
| `test_accuracy_unchanged_dead_code` | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_dead_code -v` | 死代码标记结果集相同 |

---

## 开发切入层级序列

### Level 1: 测试基础设施构建（第 1-2 天）

```
scripts/
└── benchmark/
    ├── __init__.py
    ├── fixtures/
    │   ├── __init__.py
    │   ├── large_function.py          # 10K 行函数代码
    │   ├── nested_classes.py          # 100 层嵌套类
    │   └── mixed_async_sync.py        # 500 异步/同步函数混合
    └── test_data/
        └── large_project/             # 模拟 100K 节点项目
            ├── module_a.py
            ├── module_b.py
            └── ...
```

**关键测试文件**: `tests/sprint4/test_static_analysis.py`
- 位置: `tests/sprint4/test_static_analysis.py` (新增 L1-L200)
- 依赖: `pytest-benchmark`, `tracemalloc` (Python 内置)

### Level 2: 热点分析实施（第 3-4 天）

**切入点顺序**:
1. `visit_Module` (L161) → 模块级入口，计时起点
2. `visit_FunctionDef` / `visit_AsyncFunctionDef` (L194, L274) → 函数遍历
3. `visit_Name` (L446) → 名称引用解析（高频调用）
4. `_is_empty_function` (L634) → 空函数检测
5. `_analyze_dead_code` (L745) → 死代码分析汇总

**分析工具**:
```python
import cProfile
import pstats
from io import StringIO

def profile_visitor(code: str) -> dict:
    profiler = cProfile.Profile()
    profiler.enable()
    visitor = DeadCodeVisitor()
    visitor.visit(ast.parse(code))
    profiler.disable()
    
    stats = pstats.Stats(profiler)
    # 输出热点函数
    return stats
```

### Level 3: 算法优化实施（第 5-7 天）

**优化优先级矩阵**:

| 优先级 | 方法 | 当前复杂度 | 目标复杂度 | 优化策略 |
|--------|------|------------|------------|----------|
| P0 | `_get_node_id_for_name` (L556) | O(n) 线性查找 | O(1) 哈希查找 | 引入 `node_id_cache: Dict[str, int]` |
| P0 | `_is_dead_code_candidate` (L572) | 每次调用正则 | 预编译模式 | 静态编译正则表达式 |
| P1 | `visit_Name` (L446) | 无条件全量访问 | 条件过滤 | 增加早期返回条件 |
| P1 | `_analyze_dead_code` (L745) | O(n²) 嵌套循环 | O(n) 单遍 | 合并为单一 pass |
| P2 | `get_graph_data` (L873) | 每次重建 | 增量更新 | 添加脏标记机制 |

### Level 4: 验证与文档化（第 8-10 天）

**交付物清单**:
```
docs/
└── performance/
    ├── benchmark_results_YYYYMMDD.md
    ├── hotspot_analysis.md
    └── optimization_proposals.md
```

**回归测试执行**:
```bash
# 全量回归
pytest tests/test_dead_code_removal.py tests/test_ast_analyzer.py tests/sprint4/test_static_analysis.py -v --tb=short

# 性能回归
pytest tests/sprint4/test_static_analysis.py -k "perf_" --benchmark-only
```

---

## 附录: 关键代码位置索引

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

## 性能基准 Fixture 规格

### large_function.py 规格
- **行数目标**: 10,000+ 行
- **函数数量**: 500+ 个函数定义
- **嵌套深度**: 最大 20 层
- **代码模式**:
  - 50% 空函数（死代码候选）
  - 30% 简单函数（1-10 行）
  - 20% 复杂函数（100+ 行）
- **节点数量**: 预计 50,000+ AST 节点

### nested_classes.py 规格
- **类定义数量**: 100 个嵌套类
- **继承深度**: 最大 10 层
- **方法数量**: 每个类 5-10 个方法

### mixed_async_sync.py 规格
- **异步函数**: 250 个
- **同步函数**: 250 个
- **混合调用模式**: 模拟真实项目中的 async/await 混合场景

---

**文档版本**: 1.0  
**最后更新**: Iteration 2 Phase 2  
**审核状态**: 待 review