# SWARM-001 DeadCodeVisitor 性能基准测试与算法优化规格文档

**Iteration**: 2  
**Status**: Active  
**Component**: `scripts/ast_dead_code_check.py` DeadCodeVisitor  
**Phase**: Phase 2 - 性能基线建立与热点分析

---

## 需求与背景

### 业务目标

对 `DeadCodeVisitor` AST 分析器进行系统化性能基准测试，建立性能度量体系，识别热点算法并实施优化，使其能够高效处理大规模 Python 代码库：

| 场景 | 目标规模 | 性能要求 |
|------|----------|----------|
| 单文件分析 | >10,000 行 | < 500ms |
| 多模块项目 | >100,000 AST 节点 | < 2s |
| 内存峰值 | 任意规模 | < 原基线的 75% |

### 技术现状分析

**核心类**: `DeadCodeVisitor` (L67)

| 方法分类 | 具体方法 | 行号 | 预估调用频率 |
|----------|----------|------|--------------|
| 遍历入口 | `visit_Module` | L161 | 每文件 1 次 |
| 函数遍历 | `visit_FunctionDef` | L194 | 每函数 1 次 |
| 异步遍历 | `visit_AsyncFunctionDef` | L274 | 每异步函数 1 次 |
| 类遍历 | `visit_ClassDef` | L350 | 每类 1 次 |
| **名称解析** | `visit_Name` | L446 | **高频 (每名称引用)** |
| 调用解析 | `visit_Call` | L483 | 每调用 1 次 |
| 空函数检测 | `_is_empty_function` | L634 | 每函数 1 次 |
| 死代码判断 | `_is_dead_code_candidate` | L572 | 每节点多次 |
| 死代码汇总 | `_analyze_dead_code` | L745 | 每文件 1 次 |
| 图数据获取 | `get_graph_data` | L873 | 按需 |

### 性能痛点假设（待验证）

| 编号 | 痛点假设 | 证据来源 | 优先级 |
|------|----------|----------|--------|
| P1 | `visit_Name` 中 `_get_node_id_for_name` 线性查找导致 O(n) 复杂度 | 高频调用 × 线性查找 | P0 |
| P2 | `_is_dead_code_candidate` 每次调用正则匹配 | 节点级频繁调用 | P0 |
| P3 | `_analyze_dead_code` 嵌套循环导致 O(n²) 复杂度 | 大规模代码库表现 | P1 |
| P4 | `visit_FunctionDef` 重复遍历函数体 | AST 结构特点 | P1 |
| P5 | `get_graph_data` 每次重建完整图结构 | 无缓存机制 | P2 |

---

## 当前 Phase 对应实施目标

### Phase 定位矩阵（参照 plan.md）

| Phase | 目标 | Iteration | 状态 |
|-------|------|-----------|------|
| Phase 1 | 基础功能验证与知识图谱化 | Iteration 1 | ✅ 完成 |
| **Phase 2** | **性能基线建立与热点分析** | **Iteration 2 (当前)** | 🔄 进行中 |
| Phase 3 | 算法优化实施 | Iteration 3 | ⏳ 待开始 |
| Phase 4 | 大规模验证与回归 | Iteration 4 | ⏳ 待开始 |

### Phase 2 核心交付物清单

```
docs/sprint4/
├── SPEC_SWARM001_Iteration2_PerformanceBenchmark.md    # 本规格文档
├── benchmark/
│   ├── benchmark_results_baseline_YYYYMMDD.json        # 原始性能数据
│   ├── hotspot_analysis_YYYYMMDD.md                    # 热点分析报告
│   └── optimization_proposals.md                       # 优化建议文档
├── fixtures/
│   ├── large_function.py                               # 10K 行函数
│   ├── nested_classes.py                               # 100 层嵌套类
│   └── mixed_async_sync.py                             # 500 混合函数
└── test_data/
    └── large_project/                                  # 模拟 100K 节点项目
```

---

## 边界约束

### 功能约束

| 约束项 | 描述 | 验证方法 |
|--------|------|----------|
| **准确性不降级** | 死代码检测准确率优化后 ≥ 优化前 | 现有测试用例 100% 通过 |
| **API 兼容性** | 公共方法签名与返回值结构保持不变 | 回归测试 |
| **向后兼容** | 现有调用方式无需修改 | 集成测试 |

### 性能约束

| 指标 | 当前基线 (待测量) | 目标值 | 测量方法 | 临界值 |
|------|-------------------|--------|----------|--------|
| 单文件解析时间 (10K 行) | TBD | ≤ 原基线的 80% | `time.perf_counter()` | 500ms |
| 内存峰值 | TBD | ≤ 原基线的 75% | `tracemalloc` | 50MB |
| 100K 节点图构建 | TBD | < 2s | pytest-benchmark | 2000ms |
| 名称解析延迟 | TBD | < 原基线的 50% | `cProfile` | TBD |

### 环境约束

| 约束项 | 要求 |
|--------|------|
| Python 版本 | 3.9+ |
| 依赖限制 | 仅使用标准库 + `pytest-benchmark` |
| 禁止引入 | `line_profiler`, `memory_profiler`, `numba` 等外部性能库 |

### 范围约束

| In Scope | Out of Scope |
|----------|--------------|
| 性能基准测试 | 新的死代码检测规则 |
| 算法复杂度优化 | UI/报告功能 |
| 内存使用优化 | 多进程/并行化改造 |
| 基准数据建立 | 分布式分析支持 |

---

## 验收测试基准 (ATB)

### ATB-1: 基准测试框架建立

**目的**: 提供可重复执行的性能基准测试基础设施

| 测试用例 ID | 测试用例名称 | 物理测试命令 | 成功标准 |
|-------------|--------------|--------------|----------|
| ATB-1.1 | 小文件基准测试 | `pytest tests/sprint4/test_performance.py::test_benchmark_single_file_small -v` | 多次执行时间标准差 < 5% |
| ATB-1.2 | 大文件基准测试 | `pytest tests/sprint4/test_performance.py::test_benchmark_single_file_large -v` | 执行时间记录到 `benchmark_results_baseline.json` |
| ATB-1.3 | 多模块基准测试 | `pytest tests/sprint4/test_performance.py::test_benchmark_multi_module -v` | 跨模块分析计时完成 |
| ATB-1.4 | 内存基线测试 | `pytest tests/sprint4/test_performance.py::test_memory_baseline -v` | tracemalloc 峰值记录到基准数据 |
| ATB-1.5 | 嵌套深度基准 | `pytest tests/sprint4/test_performance.py::test_benchmark_nested_depth -v` | 100 层嵌套处理时间记录 |

### ATB-2: 热点分析方法验证

**目的**: 验证热点分析工具链能够正确识别性能瓶颈

| 测试用例 ID | 测试用例名称 | 物理测试命令 | 成功标准 |
|-------------|--------------|--------------|----------|
| ATB-2.1 | 完整热点分析 | `pytest tests/sprint4/test_performance.py::test_profile_full_visitor -v --profile` | cProfile 输出 top 5 热点函数 |
| ATB-2.2 | visit_Module 热点 | `pytest tests/sprint4/test_performance.py::test_profile_visit_module --profile` | 模块级入口时间占比记录 |
| ATB-2.3 | visit_Name 热点 | `pytest tests/sprint4/test_performance.py::test_profile_visit_name --profile` | `_get_node_id_for_name` 调用计数 |
| ATB-2.4 | 死代码分析热点 | `pytest tests/sprint4/test_performance.py::test_profile_analyze_dead_code --profile` | `_analyze_dead_code` 循环次数统计 |
| ATB-2.5 | 瓶颈识别报告 | `pytest tests/sprint4/test_performance.py::test_generate_bottleneck_report -v` | 输出瓶颈函数排序列表 |

### ATB-3: 现有功能回归验证

**目的**: 确保优化过程不破坏现有检测能力

| 测试用例 ID | 测试用例名称 | 物理测试命令 | 成功标准 |
|-------------|--------------|--------------|----------|
| ATB-3.1 | 空函数检测回归 | `pytest tests/test_dead_code_removal.py::TestDeadCodeVisitor -v` | 全部通过 |
| ATB-3.2 | 图结构完整性 | `pytest tests/test_ast_analyzer.py::TestASTAnalyzer -v` | 全部通过 |
| ATB-3.3 | 边界用例验证 | `pytest tests/sprint4/test_static_analysis.py::TestASTAnalysisEdgeCases -v` | 全部通过 |
| ATB-3.4 | 统计数据准确性 | `pytest tests/sprint4/test_performance.py::test_accuracy_statistics -v` | 优化前后统计数据一致 |

### ATB-4: 优化效果量化验证

**目的**: 验证优化实施后性能提升达到预期目标

| 测试用例 ID | 测试用例名称 | 物理测试命令 | 成功标准 |
|-------------|--------------|--------------|----------|
| ATB-4.1 | 速度提升验证 | `pytest tests/sprint4/test_performance.py::test_optimization_speedup -v` | 优化后时间 < 优化前的 80% |
| ATB-4.2 | 内存降低验证 | `pytest tests/sprint4/test_performance.py::test_optimization_memory -v` | 峰值内存 < 优化前的 75% |
| ATB-4.3 | 名称解析优化 | `pytest tests/sprint4/test_performance.py::test_optimization_name_lookup -v` | `_get_node_id_for_name` 降为 O(1) |
| ATB-4.4 | 正则匹配优化 | `pytest tests/sprint4/test_performance.py::test_optimization_regex -v` | 预编译正则生效 |
| ATB-4.5 | 综合性能回归 | `pytest tests/sprint4/test_performance.py -k "perf_" --benchmark-compare=master` | 不低于 master 分支性能 |

### ATB-5: 准确性对比验证

**目的**: 验证优化前后检测结果完全一致

| 测试用例 ID | 测试用例名称 | 物理测试命令 | 成功标准 |
|-------------|--------------|--------------|----------|
| ATB-5.1 | 空函数检测一致 | `pytest tests/sprint4/test_performance.py::test_accuracy_empty_functions -v` | 结果集完全相同 |
| ATB-5.2 | 死代码标记一致 | `pytest tests/sprint4/test_performance.py::test_accuracy_dead_code -v` | 死代码节点列表完全相同 |
| ATB-5.3 | 边检测一致 | `pytest tests/sprint4/test_performance.py::test_accuracy_edges -v` | 边列表完全相同 |
| ATB-5.4 | 统计值一致 | `pytest tests/sprint4/test_performance.py::test_accuracy_statistics -v` | 所有统计字段相等 |

---

## 开发切入层级序列

### Level 1: 测试基础设施构建（第 1-2 天）

#### 1.1 目录结构创建

```
scripts/benchmark/
├── __init__.py
├── fixtures/
│   ├── __init__.py
│   ├── large_function.py          # 生成 10K 行函数代码
│   ├── nested_classes.py          # 生成 100 层嵌套类
│   └── mixed_async_sync.py        # 生成 500 混合函数
└── generators.py                   # 测试数据生成器
```

#### 1.2 核心测试文件创建

**文件**: `tests/sprint4/test_performance.py`

```python
# 主要测试类结构 (L1-L200)
class TestPerformanceBaseline:
    """性能基准测试基类"""
    
class TestHotspotAnalysis:
    """热点分析方法测试"""
    
class TestOptimizationValidation:
    """优化效果验证测试"""
    
class TestAccuracyComparison:
    """准确性对比测试"""
```

#### 1.3 依赖分析

| 依赖 | 用途 | 导入方式 |
|------|------|----------|
| `pytest` | 测试框架 | `import pytest` |
| `pytest-benchmark` | 性能基准 | `import pytest_benchmark` |
| `tracemalloc` | 内存分析 | `import tracemalloc` |
| `cProfile` | CPU 分析 | `import cProfile` |
| `pstats` | 性能统计 | `import pstats` |

### Level 2: 热点分析实施（第 3-4 天）

#### 2.1 性能数据采集

**切入点顺序**（按调用频率排序）:

| 优先级 | 方法 | 行号 | 分析重点 |
|--------|------|------|----------|
| 🔴 P0 | `visit_Name` | L446 | 名称引用解析频率 |
| 🔴 P0 | `_get_node_id_for_name` | L556 | 线性查找瓶颈 |
| 🟠 P1 | `_is_dead_code_candidate` | L572 | 正则匹配开销 |
| 🟠 P1 | `_analyze_dead_code` | L745 | 循环嵌套复杂度 |
| 🟡 P2 | `visit_FunctionDef` | L194 | 函数体重复遍历 |

#### 2.2 cProfile 分析脚本

```python
def profile_dead_code_visitor(source_code: str) -> dict:
    """对 DeadCodeVisitor 进行性能剖析"""
    import cProfile
    import pstats
    from io import StringIO
    import ast
    
    profiler = cProfile.Profile()
    profiler.enable()
    
    visitor = DeadCodeVisitor()
    visitor.visit(ast.parse(source_code))
    
    profiler.disable()
    
    # 输出到字符串
    stream = StringIO()
    stats = pstats.Stats(profiler, stream=stream)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # top 20
    
    return {
        'string_stats': stream.getvalue(),
        'stats_object': stats
    }
```

#### 2.3 tracemalloc 内存分析

```python
def measure_memory_peak(source_code: str) -> dict:
    """测量 DeadCodeVisitor 内存峰值"""
    import tracemalloc
    
    tracemalloc.start()
    
    visitor = DeadCodeVisitor()
    visitor.visit(ast.parse(source_code))
    
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    return {
        'current_mb': current / 1024 / 1024,
        'peak_mb': peak / 1024 / 1024
    }
```

### Level 3: 算法优化实施（第 5-7 天）

#### 3.1 优化优先级矩阵

| 优先级 | 方法 | 当前实现 | 优化方案 | 预期收益 |
|--------|------|----------|----------|----------|
| **P0-A** | `_get_node_id_for_name` (L556) | O(n) 线性查找 | 引入 `node_id_cache: Dict[str, int]` | 100x 提升 |
| **P0-B** | `_is_dead_code_candidate` (L572) | 动态正则编译 | 模块级预编译正则 | 10x 提升 |
| **P1-A** | `visit_Name` (L446) | 无条件处理 | 早期返回条件过滤 | 2x 提升 |
| **P1-B** | `_analyze_dead_code` (L745) | O(n²) 嵌套 | 单遍扫描算法 | 5x 提升 |
| **P2-A** | `get_graph_data` (L873) | 每次重建 | 增量缓存机制 | 依赖触发 |

#### 3.2 优化实施代码模板

**优化 A: 名称缓存 (P0-A)**

```python
# scripts/ast_dead_code_check.py L556
class DeadCodeVisitor:
    def __init__(self, ...):
        # 新增缓存
        self._node_id_cache: Dict[str, int] = {}
        self._node_id_cache_valid = False  # 脏标记
    
    def _get_node_id_for_name(self, name: str, ctx: str = 'load') -> int:
        """优化: 使用缓存实现 O(1) 查找"""
        cache_key = f"{name}:{ctx}"
        
        # 检查缓存
        if hasattr(self, '_node_id_cache') and cache_key in self._node_id_cache:
            return self._node_id_cache[cache_key]
        
        # 原逻辑计算
        node_id = self._compute_node_id(name, ctx)
        
        # 更新缓存
        if hasattr(self, '_node_id_cache'):
            self._node_id_cache[cache_key] = node_id
        
        return node_id
```

**优化 B: 正则预编译 (P0-B)**

```python
# scripts/ast_dead_code_check.py 模块级
import re

# 模块级预编译正则（替换 L572 动态编译）
_DEAD_CODE_PATTERNS = {
    'placeholder': re.compile(r'^_+$|^temp\d*$|^unused\d*$'),
    'dunder': re.compile(r'^__[a-z]+__$'),
    'private': re.compile(r'^_[a-z].*$'),
}

class DeadCodeVisitor:
    def _is_dead_code_candidate(self, name: str) -> bool:
        """优化: 使用预编译正则"""
        # 直接使用预编译正则
        return bool(
            _DEAD_CODE_PATTERNS['placeholder'].match(name) or
            _DEAD_CODE_PATTERNS['dunder'].match(name) or
            _DEAD_CODE_PATTERNS['private'].match(name)
        )
```

#### 3.3 优化验证测试

```python
def test_optimization_name_lookup(benchmark):
    """验证名称查找优化效果"""
    code = generate_large_code(names_count=10000)
    
    result = benchmark.pedantic(
        target=analyze_code,
        args=(code,),
        iterations=10,
        rounds=5
    )
    
    assert result.time < 0.5, f"解析时间 {result.time}s 超过 500ms"
```

### Level 4: 验证与文档化（第 8-10 天）

#### 4.1 交付物清单

```
docs/sprint4/performance/
├── benchmark_results_baseline_YYYYMMDD.json    # 原始性能数据
├── benchmark_results_optimized_YYYYMMDD.json  # 优化后性能数据
├── hotspot_analysis.md                         # 热点分析报告
├── optimization_proposals.md                   # 优化提案
└── regression_report.md                        # 回归测试报告
```

#### 4.2 基准数据格式

```json
{
  "metadata": {
    "date": "YYYY-MM-DD",
    "python_version": "3.9+",
    "commit_hash": "xxx"
  },
  "baseline": {
    "single_file_10k_lines": {
      "time_ms": 450.5,
      "memory_mb": 35.2,
      "iterations": 10
    },
    "multi_module_100k_nodes": {
      "time_ms": 1850.3,
      "memory_mb": 120.5,
      "iterations": 5
    }
  },
  "hotspots": [
    {"function": "_get_node_id_for_name", "cumulative_time_ms": 120.5, "calls": 50000},
    {"function": "_is_dead_code_candidate", "cumulative_time_ms": 80.3, "calls": 30000}
  ]
}
```

#### 4.3 回归测试执行

```bash
# 全量回归
pytest tests/test_dead_code_removal.py \
       tests/test_ast_analyzer.py \
       tests/sprint4/test_static_analysis.py \
       tests/sprint4/test_performance.py \
       -v --tb=short

# 性能回归（对比基准）
pytest tests/sprint4/test_performance.py \
       -k "perf_" \
       --benchmark-compare=master \
       --benchmark-autosave

# 准确性对比
pytest tests/sprint4/test_performance.py::TestAccuracyComparison -v
```

---

## 附录

### A. 关键代码位置索引

| 用途 | 文件 | 行号 | 备注 |
|------|------|------|------|
| DeadCodeVisitor 主类 | `scripts/ast_dead_code_check.py` | L67 | 核心分析器 |
| 遍历入口 | `scripts/ast_dead_code_check.py` | L161 | 模块级入口 |
| 函数遍历 | `scripts/ast_dead_code_check.py` | L194, L274 | FunctionDef/AsyncFunctionDef |
| 类遍历 | `scripts/ast_dead_code_check.py` | L350 | ClassDef |
| 名称解析 | `scripts/ast_dead_code_check.py` | L446 | **热点 P0** |
| 调用解析 | `scripts/ast_dead_code_check.py` | L483 | Call |
| 导入处理 | `scripts/ast_dead_code_check.py` | L533, L574 | Import/ImportFrom |
| 死代码判断 | `scripts/ast_dead_code_check.py` | L572 | **热点 P0** |
| 空函数检测 | `scripts/ast_dead_code_check.py` | L634 | 辅助方法 |
| 空类检测 | `scripts/ast_dead_code_check.py` | L717 | 辅助方法 |
| 死代码汇总 | `scripts/ast_dead_code_check.py` | L745 | **热点 P1** |
| 名称 ID 映射 | `scripts/ast_dead_code_check.py` | L556 | **热点 P0** |
| 图数据获取 | `scripts/ast_dead_code_check.py` | L873 | **热点 P2** |
| 统计数据 | `scripts/ast_dead_code_check.py` | L843 | 统计输出 |

### B. 测试文件位置

| 文件 | 用途 | 行数 |
|------|------|------|
| `tests/test_dead_code_removal.py` | 核心功能测试 | 701 |
| `tests/test_ast_analyzer.py` | AST 分析测试 | 854 |
| `tests/sprint4/test_static_analysis.py` | 静态分析边界测试 | 619 |
| `tests/sprint4/test_performance.py` | 性能基准测试 (待创建) | ~400 |
| `tests/fixtures/dead_code_sample.py` | 测试数据 | 1141 |

### C. 相关文档

| 文档 | 路径 |
|------|------|
| 迭代 1 规格文档 | `docs/sprint3/SPEC_SWARM001_Iteration1.md` |
| 性能基准结果 | `docs/sprint4/performance/` |
| 优化提案 | `docs/sprint4/performance/optimization_proposals.md` |

---

**文档版本**: 1.0  
**创建日期**: 2024  
**Phase**: Phase 2  
**审核状态**: 待 review  
**下一步**: 创建 `tests/sprint4/test_performance.py` 测试基础设施