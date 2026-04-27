# SWARM-001: DeadCodeVisitor AST 分析器性能基准测试与算法优化规格指导

## 需求与背景

### 问题陈述

`DeadCodeVisitor`（位于 `scripts/ast_dead_code_check.py`）作为 Python AST 分析器，负责检测代码库中的死代码（未使用函数、类、变量）。当前实现在中等规模代码库（>10,000 行）上表现出明显的性能瓶颈。

#### 已识别的性能热点

| 热点位置 | 现象 | 影响 |
|---------|------|------|
| `visit_FunctionDef()` (L329) | 深度嵌套 AST 节点冗余访问 | 遍历效率降低 |
| `_is_dead_code_candidate()` (L620) | 频繁调用导致 O(n²) 复杂度 | 候选函数重复计算 |
| `_get_node_id_for_name()` (L556) | 无效名称解析重复执行 | 名称解析开销大 |
| `get_graph_data()` (L873) | 完整图结构构建内存峰值高 | 内存占用过大 |

#### 优化目标

在不破坏现有 API 兼容性的前提下：
- 大规模代码库 AST 分析吞吐量提升 **≥3x**
- 内存峰值降低 **≥40%**

---

## 当前 Phase 对应实施目标

> **Phase 拆解依据**: 标准软件工程迭代流程（Plan.md Phase 规范）

| Phase | 名称 | 目标 | 交付物 | 状态 |
|-------|------|------|--------|------|
| **Phase 1** | 性能基准建立 | 建立量化基准，识别热点方法 | `benchmark_deadcode.py` + 瓶颈报告 | 🚧 **当前 Iteration** |
| **Phase 2** | 算法层优化 | 针对性优化热点路径 | 优化代码 + PR | 📋 待执行 |
| **Phase 3** | 验证与集成 | 回归测试与集成验证 | 全量测试通过 + 性能报告 | 📋 待执行 |

### Phase 1 详细任务分解

1. **T1.1**: 创建独立基准测试脚本 `benchmark_deadcode.py`
2. **T1.2**: 注入性能探针到 `DeadCodeVisitor`
3. **T1.3**: 使用 `cProfile` 生成热点分析报告
4. **T1.4**: 生成 `OPTIMIZATION_PROPOSAL.md` 优化建议文档

---

## 边界约束

### 功能约束

| 约束编号 | 描述 | 验证方式 |
|---------|------|----------|
| C-001 | 所有公共方法签名保持向后兼容 | `pytest tests/test_dead_code_removal.py::TestDeadCodeVisitor -v` |
| C-002 | 死代码检测结果与优化前完全一致（零误差容忍） | 回归测试全量通过 |
| C-003 | 语法错误/编码错误文件处理行为不变 | `tests/sprint4/test_static_analysis.py` 覆盖 |
| C-004 | `endless_daemon.py` 中的 `DeadCodeVisitor` (L115) 同步优化 | 保持双文件一致性 |

### 性能约束

| 指标 | 小型代码库 | 中型代码库 | 大型代码库 |
|------|-----------|-----------|-----------|
| 代码规模 | <1,000 行 | 1,000-10,000 行 | >10,000 行 |
| 时间限制 | <2 秒 | <20 秒 | <60 秒 |
| 内存限制 | <50 MB | <200 MB | <500 MB |

### 技术约束

- **Python 版本**: 3.10+
- **依赖限制**: 仅使用标准库 + `pytest`
- **代码规范**: 通过 `flake8` 和 `mypy --strict` 检查
- **禁止项**: 
  - 修改 `tests/` 目录测试断言逻辑
  - 引入外部 C 扩展或 Cython

---

## 验收测试基准 (ATB)

### ATB-1: 基准脚本可执行性

| 步骤 | 功能描述 | 物理测试期待 | 验证命令 |
|------|----------|--------------|----------|
| 1.1 | 基准脚本独立运行 | `--help` 输出帮助信息 | `python benchmark_deadcode.py --help` |
| 1.2 | 支持 `--target` 参数 | 正确解析并遍历目标目录 | `python benchmark_deadcode.py --target ./tests` |
| 1.3 | 支持 `--output` 参数 | 输出 JSON 格式报告 | `python benchmark_deadcode.py --output results.json` |
| 1.4 | JSON 输出字段完整 | 包含所有必需字段 | 验证 `benchmark_results.json` schema |

**输出 JSON Schema**:
```json
{
  "timestamp": "ISO8601",
  "target": "path/to/target",
  "elapsed_time": 12.34,
  "peak_memory_mb": 150.5,
  "nodes_visited": 1234,
  "lines_processed": 5678,
  "throughput_lines_per_sec": 459.2,
  "hotspots": [
    {"method": "visit_FunctionDef", "cumulative_time": 5.67, "call_count": 890}
  ]
}
```

---

### ATB-2: 热点方法识别准确性

| 步骤 | 功能描述 | 物理测试期待 | 判定标准 |
|------|----------|--------------|----------|
| 2.1 | 识别 `visit_FunctionDef` 热点 | 累计时间 ≥ 整体 15% | `cProfile` 输出验证 |
| 2.2 | 识别 `_is_dead_code_candidate` 冗余调用 | 调用计数 ≥ 10000（10k 行场景） | `py-spy` 或 `cProfile` 验证 |
| 2.3 | 识别 `_get_node_id_for_name` 重复解析 | 同一名称重复解析 ≥ 100 次 | 缓存命中率统计 |
| 2.4 | 瓶颈报告生成 | 输出 `OPTIMIZATION_PROPOSAL.md` | 文件存在且包含 ≥5 优化项 |

**验证命令**:
```bash
python -m cProfile -s cumulative benchmark_deadcode.py --target tests/fixtures/large_project 2>&1 | head -50
```

---

### ATB-3: 现有功能回归验证

| 步骤 | 测试文件 | 验证内容 | 期望结果 |
|------|---------|----------|----------|
| 3.1 | `tests/test_dead_code_removal.py` | `DeadCodeVisitor` 公共 API | 全量通过 (15 tests) |
| 3.2 | `tests/test_ast_analyzer.py` | AST 分析边界情况 | 全量通过 (20 tests) |
| 3.3 | `tests/sprint4/test_static_analysis.py` | 静态分析集成 | 全量通过 (10 tests) |
| 3.4 | `tests/sprint4/test_deprecated_cleanup.py` | 废弃清理功能 | 全量通过 |

**验证命令**:
```bash
pytest tests/test_dead_code_removal.py tests/test_ast_analyzer.py \
       tests/sprint4/test_static_analysis.py tests/sprint4/test_deprecated_cleanup.py \
       -v --tb=short
```

---

### ATB-4: 性能基线记录

| 阶段 | 指标 | 基线值 (优化前) | 目标值 (优化后) |
|------|------|-----------------|-----------------|
| 小型 | 吞吐量 | X lines/s | ≥ 3X lines/s |
| 小型 | 内存峰值 | Y MB | ≤ 0.6Y MB |
| 中型 | 吞吐量 | X lines/s | ≥ 3X lines/s |
| 中型 | 内存峰值 | Y MB | ≤ 0.6Y MB |

**注**: X, Y 为实际测量基线值，待 ATB-1 执行后填入。

---

## 开发切入层级序列

### Level 1: 探针注入（基准建立）

**目标**: 无侵入式地采集性能数据

**修改文件**: `scripts/ast_dead_code_check.py`

```python
class DeadCodeVisitor:
    def __init__(self, ...):
        # 新增性能探针
        self._perf_metrics = {
            "visit_counts": defaultdict(int),
            "method_times": defaultdict(float),
            "name_resolution_cache": {},
            "caller_cache_hits": 0,
            "caller_cache_misses": 0
        }
        
    def _record_visit(self, node_type: str) -> None:
        """记录节点访问"""
        self._perf_metrics["visit_counts"][node_type] += 1
        
    def _get_perf_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        total_calls = sum(self._perf_metrics["visit_counts"].values())
        return {
            "total_nodes_visited": total_calls,
            "visit_breakdown": dict(self._perf_metrics["visit_counts"]),
            "cache_hit_rate": (
                self._perf_metrics["caller_cache_hits"] / 
                max(1, self._perf_metrics["caller_cache_hits"] + self._perf_metrics["caller_cache_misses"])
            )
        }
```

---

### Level 2: 缓存层实现（消除冗余计算）

**目标**: 消除 O(n²) 冗余路径

**优化点 A**: `_get_node_id_for_name()` (L556)

```python
import functools

class DeadCodeVisitor:
    @functools.lru_cache(maxsize=1024)
    def _cached_resolve_name(self, name: str, scope: str) -> Optional[str]:
        """带缓存的名称解析"""
        # 原有的名称解析逻辑
        ...
```

**优化点 B**: `_is_dead_code_candidate()` (L620)

```python
class DeadCodeVisitor:
    def __init__(self, ...):
        self._caller_cache = {}  # 新增：候选函数缓存
        
    def _is_dead_code_candidate(self, node: ast.FunctionDef) -> bool:
        """优化：使用缓存消除重复计算"""
        node_id = id(node)
        if node_id in self._caller_cache:
            self._perf_metrics["caller_cache_hits"] += 1
            return self._caller_cache[node_id]
        
        self._perf_metrics["caller_cache_misses"] += 1
        result = self._compute_dead_code_candidate(node)
        self._caller_cache[node_id] = result
        return result
    
    def _compute_dead_code_candidate(self, node: ast.FunctionDef) -> bool:
        """提取原始计算逻辑"""
        # 原有的 _is_dead_code_candidate 逻辑
        ...
```

---

### Level 3: 遍历路径优化（减少无效访问）

**目标**: 减少无效 `visit_*` 方法调用次数

**优化点 C**: `visit_Call()` (L485)

```python
def visit_Call(self, node: ast.Call) -> None:
    """优化：短路非名称调用"""
    # 跳过 lambda, attr, subscript 等调用类型
    if not isinstance(node.func, ast.Name):
        self.generic_visit(node)
        return
    
    # 只处理直接函数调用
    self.generic_visit(node)
```

**优化点 D**: `visit_Name()` (L459)

```python
def visit_Name(self, node: ast.Name) -> None:
    """优化：仅在引用场景记录"""
    if isinstance(node.ctx, ast.Load):
        # 仅记录 Load 上下文
        ...
    self.generic_visit(node)
```

---

### Level 4: 惰性求值（延迟非关键计算）

**目标**: 降低内存峰值

**优化点 E**: `get_graph_data()` (L873)

```python
class DeadCodeVisitor:
    def __init__(self, ...):
        self._graph_data_cache = None  # 惰性求值缓存
        self._statistics_cache = None
        
    def get_graph_data(self) -> Dict[str, Any]:
        """优化：惰性计算图数据"""
        if self._graph_data_cache is None:
            self._graph_data_cache = self._build_graph_data()
        return self._graph_data_cache
    
    def get_statistics(self) -> Dict[str, Any]:
        """优化：惰性计算统计信息"""
        if self._statistics_cache is None:
            self._statistics_cache = self._compute_statistics()
        return self._statistics_cache
```

---

## 交付物清单

| 交付物 | 文件路径 | 验收条件 | 状态 |
|--------|----------|----------|------|
| 性能基准脚本 | `benchmark_deadcode.py` | ATB-1 全部通过 | ⬜ 待创建 |
| 瓶颈分析报告 | `benchmark_results.json` | ATB-2 识别 3+ 热点 | ⬜ 待创建 |
| 优化建议文档 | `OPTIMIZATION_PROPOSAL.md` | 包含 ≥5 可操作项 | ⬜ 待创建 |
| 回归测试日志 | `regression_test.log` | ATB-3 全量通过 | ⬜ 待生成 |

---

## 后续迭代预告

### Iteration 2 (Phase 2): 算法优化实施

| 任务 | 优先级 | 预期收益 |
|------|--------|----------|
| 实现 Level 2 缓存层 | P0 | 消除 O(n²) 路径 |
| 实现 Level 3 遍历优化 | P0 | 减少 30% 无效访问 |
| 实现 Level 4 惰性求值 | P1 | 降低内存峰值 40% |
| 同步优化 `endless_daemon.py` | P1 | 双文件一致性 |

### Iteration 3 (Phase 3): 验证与交付

| 任务 | 验收指标 |
|------|----------|
| 全量回归测试 | `pytest` 全量通过 |
| 性能复测 | 吞吐量 ≥3x, 内存 ≤60% |
| 文档更新 | `CHANGELOG.md` + `README.md` |

---

## 附录

### A. 相关文件列表

| 文件 | 关键类/函数 | 行号 |
|------|-----------|------|
| `scripts/ast_dead_code_check.py` | `DeadCodeVisitor` | L67 |
| `src/endless_daemon.py` | `DeadCodeVisitor` | L115 |
| `tests/test_dead_code_removal.py` | `TestDeadCodeVisitor` | L31 |
| `tests/test_ast_analyzer.py` | `TestASTAnalyzer` | L31 |

### B. 参考工具

- **cProfile**: Python 内置性能分析器
- **py-spy**: 实时火焰图生成
- **memory_profiler**: 内存分析
- **pytest-benchmark**: 基准测试框架

### C. 术语表

| 术语 | 定义 |
|------|------|
| 死代码 | 定义但从未被调用的函数、类或变量 |
| AST | Abstract Syntax Tree，Python 代码的抽象语法树 |
| 热点方法 | 执行时间或调用频率显著高于平均值的方法 |
| 惰性求值 | 直到首次访问时才计算结果的策略 |