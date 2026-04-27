# SWARM-001 DeadCodeVisitor 性能基准测试与算法优化规格文档

**Iteration**: 2  
**Status**: Active  
**Component**: `scripts/ast_dead_code_check.py` DeadCodeVisitor (L67)  
**Phase**: Phase 2: 性能基线建立与热点分析

---

## 1. 需求与背景

### 1.1 业务目标
对 `DeadCodeVisitor` AST 分析器进行系统化性能基准测试，建立性能度量体系，识别热点算法并实施优化，使其能够高效处理大规模 Python 代码库：

| 场景 | 目标规模 | 性能要求 |
|------|----------|----------|
| 单文件分析 | >10,000 行 | < 500ms |
| 多模块项目 | >100,000 AST 节点 | < 2s |
| 内存效率 | 大规模代码库 | 峰值 < 500MB |

### 1.2 技术现状分析

**核心组件位置** (`scripts/ast_dead_code_check.py`):

| 组件 | 行号 | 描述 |
|------|------|------|
| `DeadCodeVisitor` 类 | L67 | 主 AST 访问器类 |
| `visit_Module` | L161 | 模块级入口遍历 |
| `visit_FunctionDef` | L194 | 函数定义访问 |
| `visit_AsyncFunctionDef` | L274 | 异步函数定义访问 |
| `visit_ClassDef` | L350 | 类定义访问 |
| `visit_Name` | L446 | 名称引用访问 (高频) |
| `visit_Call` | L483 | 函数调用访问 |
| `_is_empty_function` | L634 | 空函数检测 |
| `_is_dead_code_candidate` | L572 | 死代码候选判断 |
| `_analyze_dead_code` | L745 | 死代码分析汇总 |
| `get_graph_data` | L873 | 图数据获取 |
| `get_all_nodes` | L896 | 节点列表获取 |
| `get_edges` | L911 | 边列表获取 |

**已知性能痛点假设**:
1. `visit_Name` 中 `_get_node_id_for_name` 每次调用进行线性查找
2. `_is_dead_code_candidate` 每次调用正则编译
3. `_analyze_dead_code` 可能存在 O(n²) 嵌套循环
4. 重复的 AST 节点遍历导致缓存未命中

### 1.3 代码重复问题
⚠️ **风险**: `DeadCodeVisitor` 在两个文件中存在重复实现：
- `scripts/ast_dead_code_check.py` (L67-L896)
- `src/endless_daemon.py` (L115-L822)

**建议**: Phase 3 中统一重构，提取公共基类。

---

## 2. Phase 2 实施目标

### 2.1 Phase 定位

| Phase | 目标 | Iteration | 状态 |
|-------|------|-----------|------|
| Phase 1 | 基础功能验证 | Iteration 1 | ✅ 完成 |
| **Phase 2** | **性能基线建立与热点分析** | **Iteration 2 (当前)** | 🔄 进行中 |
| Phase 3 | 算法优化实施 | Iteration 3 | ⏳ 待开始 |
| Phase 4 | 大规模验证与回归 | Iteration 4 | ⏳ 待开始 |

### 2.2 Phase 2 核心交付物

```
docs/performance/
├── SWARM-001_Phase2_Performance_Spec.md     # 本文档
├── benchmark_results_YYYYMMDD.md             # 基线测试结果
└── hotspot_analysis.md                        # 热点分析报告

tests/sprint4/
├── test_static_analysis.py                    # 性能测试套件 (扩展)
└── benchmark/
    ├── __init__.py
    ├── fixtures/
    │   ├── __init__.py
    │   ├── generator.py                      # 大规模代码生成器
    │   ├── large_function.py                 # 10K 行函数
    │   ├── nested_classes.py                 # 100 层嵌套类
    │   └── mixed_async_sync.py               # 500 混合函数
    └── test_data/
        └── large_project/                    # 模拟 100K 节点项目
```

---

## 3. 边界约束

### 3.1 功能约束

| 约束项 | 要求 |
|--------|------|
| 准确性不降级 | 死代码检测准确率 ≥ 优化前 |
| API 兼容性 | 公共方法签名保持不变 |
| 测试覆盖 | 所有现有测试必须通过 |

### 3.2 性能约束

| 指标 | 当前基线 | 目标 | 测量方法 |
|------|----------|------|----------|
| 单文件解析时间 | TBD | ≤ 80% 基线 | `time.perf_counter()` |
| 内存峰值 | TBD | ≤ 75% 基线 | `tracemalloc` |
| 10K 行代码遍历 | TBD | < 500ms | pytest-benchmark |
| 100K 节点图构建 | TBD | < 2s | pytest-benchmark |

### 3.3 环境约束

- Python 3.9+
- 标准库: `ast`, `cProfile`, `tracemalloc`, `pytest`, `pytest-benchmark`
- **禁止**: 引入第三方性能分析库

### 3.4 范围约束

**In Scope**:
- ✅ 性能基准测试套件开发
- ✅ 热点函数分析方法
- ✅ 优化前基线数据建立
- ✅ 现有功能回归验证

**Out of Scope**:
- ❌ 新的死代码检测规则
- ❌ UI/报告功能
- ❌ 并行化改造
- ❌ 代码重构（Phase 3）

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 基准测试框架建立

| ID | 测试用例 | 命令 | 成功标准 |
|----|----------|------|----------|
| ATB-1.1 | `test_benchmark_single_file_small` | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_single_file_small -v` | 时间标准差 < 5% |
| ATB-1.2 | `test_benchmark_single_file_large` | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_single_file_large -v` | 记录到基准数据库 |
| ATB-1.3 | `test_benchmark_multi_module` | `pytest tests/sprint4/test_static_analysis.py::test_benchmark_multi_module -v` | 跨模块计时 |
| ATB-1.4 | `test_memory_baseline` | `pytest tests/sprint4/test_static_analysis.py::test_memory_baseline -v` | tracemalloc 峰值记录 |

### 4.2 ATB-2: 热点分析方法

| ID | 测试用例 | 命令 | 成功标准 |
|----|----------|------|----------|
| ATB-2.1 | `test_profile_visit_module` | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_module --profile` | 输出 top 5 热点 |
| ATB-2.2 | `test_profile_visit_name` | `pytest tests/sprint4/test_static_analysis.py::test_profile_visit_name --profile` | `_get_node_id_for_name` 调用计数 |
| ATB-2.3 | `test_identify_algorithm_bottleneck` | `pytest tests/sprint4/test_static_analysis.py::test_identify_algorithm_bottleneck -v` | 瓶颈函数列表 |

### 4.3 ATB-3: 现有功能回归验证

| ID | 测试用例 | 命令 | 成功标准 |
|----|----------|------|----------|
| ATB-3.1 | `TestDeadCodeVisitor` | `pytest tests/test_dead_code_removal.py -v` | 全部通过 |
| ATB-3.2 | `TestASTAnalyzer` | `pytest tests/test_ast_analyzer.py -v` | 全部通过 |
| ATB-3.3 | `TestASTAnalysisEdgeCases` | `pytest tests/sprint4/test_static_analysis.py::TestASTAnalysisEdgeCases -v` | 全部通过 |

### 4.4 ATB-4: 优化效果验证 (Phase 3)

| ID | 测试用例 | 命令 | 成功标准 |
|----|----------|------|----------|
| ATB-4.1 | `test_optimization_speedup_visit_function` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_visit_function -v` | < 80% 基线 |
| ATB-4.2 | `test_optimization_speedup_dead_code_analysis` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_speedup_dead_code_analysis -v` | 减少循环次数 |
| ATB-4.3 | `test_optimization_memory_reduction` | `pytest tests/sprint4/test_static_analysis.py::test_optimization_memory_reduction -v` | < 75% 基线 |

### 4.5 ATB-5: 准确性对比验证

| ID | 测试用例 | 命令 | 成功标准 |
|----|----------|------|----------|
| ATB-5.1 | `test_accuracy_unchanged_empty_functions` | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_empty_functions -v` | 结果一致 |
| ATB-5.2 | `test_accuracy_unchanged_dead_code` | `pytest tests/sprint4/test_static_analysis.py::test_accuracy_unchanged_dead_code -v` | 结果一致 |

---

## 5. 开发切入层级序列

### Level 1: 测试基础设施 (第 1-2 天)

#### 5.1.1 目录结构创建

```
tests/sprint4/benchmark/
├── __init__.py
├── fixtures/
│   ├── __init__.py
│   └── generator.py          # 代码生成器
└── test_data/
    └── large_project/         # 100K 节点项目
        ├── __init__.py
        ├── module_a.py
        ├── module_b.py
        └── ...
```

#### 5.1.2 大规模代码生成器 (`generator.py`)

```python
class LargeCodeGenerator:
    """生成大规模测试代码"""
    
    def generate_large_function(self, lines: int = 10000) -> str:
        """生成大型函数"""
        
    def generate_nested_classes(self, depth: int = 100) -> str:
        """生成嵌套类"""
        
    def generate_mixed_async(self, count: int = 500) -> str:
        """生成混合异步/同步函数"""
        
    def generate_large_project(self, modules: int = 20) -> dict:
        """生成大型项目结构"""
```

### Level 2: 热点分析实施 (第 3-4 天)

#### 5.2.1 切入点优先级

| 优先级 | 方法 | 行号 | 原因 |
|--------|------|------|------|
| P0 | `_get_node_id_for_name` | L556 | 线性查找变 O(1) |
| P0 | `_is_dead_code_candidate` | L572 | 正则预编译 |
| P1 | `visit_Name` | L446 | 高频调用 |
| P1 | `_analyze_dead_code` | L745 | 可能 O(n²) |
| P2 | `get_graph_data` | L873 | 增量更新 |

#### 5.2.2 分析工具模板

```python
import cProfile
import pstats
from io import StringIO

def profile_visitor(code: str) -> dict:
    """分析 DeadCodeVisitor 性能热点"""
    profiler = cProfile.Profile()
    profiler.enable()
    
    visitor = DeadCodeVisitor()
    visitor.visit(ast.parse(code))
    
    profiler.disable()
    
    # 统计输出
    stream = StringIO()
    stats = pstats.Stats(profiler, stream=stream)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # top 20
    
    return {
        'total_time': stats.total_tt,
        'hotspots': stream.getvalue()
    }
```

### Level 3: 算法优化 (第 5-7 天) - Phase 3

#### 5.3.1 优化策略矩阵

| 方法 | 当前 | 优化后 | 策略 |
|------|------|--------|------|
| `_get_node_id_for_name` | O(n) | O(1) | 引入 `node_id_cache: Dict[str, int]` |
| `_is_dead_code_candidate` | 每次编译 | 预编译 | 模块级静态 `re.compile()` |
| `visit_Name` | 无条件 | 早期返回 | 增加 `if not self.tracking_names` |
| `_analyze_dead_code` | O(n²) | O(n) | 单一 pass 合并 |

### Level 4: 验证与文档 (第 8-10 天)

#### 5.4.1 回归测试命令

```bash
# 全量回归
pytest tests/test_dead_code_removal.py tests/test_ast_analyzer.py tests/sprint4/test_static_analysis.py -v --tb=short

# 性能回归
pytest tests/sprint4/test_static_analysis.py -k "perf_" --benchmark-only
```

#### 5.4.2 交付物清单

- [ ] `docs/performance/benchmark_results_YYYYMMDD.md`
- [ ] `docs/performance/hotspot_analysis.md`
- [ ] `tests/sprint4/test_static_analysis.py` (扩展)
- [ ] `tests/sprint4/benchmark/` (基础设施)

---

## 6. 附录

### 6.1 关键代码位置索引

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
| 测试用例 | `tests/test_dead_code_removal.py` | L34+ |
| 测试用例 | `tests/test_ast_analyzer.py` | L76+ |
| 边界测试 | `tests/sprint4/test_static_analysis.py` | L885+ |

### 6.2 参考资料

- Python AST 模块文档: `help(ast)`
- pytest-benchmark: `pytest --help | grep benchmark`
- tracemalloc: `python -m tracemalloc`

---

**文档版本**: 1.0  
**创建日期**: 2024  
**Phase**: 2/4  
**状态**: 🔄 Active