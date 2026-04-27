# SWARM-001: DeadCodeVisitor AST 分析器性能基准测试与算法优化规格指导

## 版本信息

| 字段 | 值 |
|------|-----|
| **任务 ID** | SWARM-001 |
| **任务名称** | DeadCodeVisitor AST 分析器性能基准测试与算法优化 |
| **目标文件** | `scripts/ast_dead_code_check.py` |
| **核心类** | `DeadCodeVisitor` |
| **Iteration** | 1 / 3 |
| **Phase** | Phase 1: 性能基准建立与瓶颈定位 |
| **创建日期** | 2024 |

---

## 1. 需求与背景

### 1.1 问题陈述

`DeadCodeVisitor`（位于 `scripts/ast_dead_code_check.py`）是 Python AST 分析器的核心组件，负责检测代码库中的死代码（未使用函数、类、变量）。当前实现存在以下性能瓶颈：

| 瓶颈类型 | 具体表现 | 影响程度 |
|----------|----------|----------|
| **遍历效率** | `visit_*` 方法在深度嵌套 AST 节点上存在冗余访问 | 高 |
| **去重开销** | `_is_dead_code_candidate()` 频繁调用导致 O(n²) 复杂度 | 高 |
| **名称解析** | `._get_node_id_for_name()` 无效名称解析重复执行 | 中 |
| **内存占用** | `get_graph_data()` 在构建完整图结构时内存峰值过高 | 中 |

### 1.2 优化目标

在**不破坏现有 API 兼容性**的前提下：

- 大规模代码库（>10,000 行）AST 分析吞吐量提升 **≥3x**
- 内存峰值降低 **≥40%**
- 死代码检测准确性保持零误差

### 1.3 关键方法清单

| 方法名 | 行号 | 复杂度 | 优化优先级 |
|--------|------|--------|------------|
| `analyze()` | L67 | O(n) | 中 |
| `visit_FunctionDef()` | L329 | O(n) | **高** |
| `visit_Call()` | L485 | O(n) | **高** |
| `_is_dead_code_candidate()` | L620 | O(n²) | **高** |
| `_get_node_id_for_name()` | L556 | O(n) | 中 |
| `_analyze_dead_code()` | L745 | O(n) | 中 |
| `get_graph_data()` | L873 | O(n) | 中 |
| `get_statistics()` | L894 | O(1) | 低 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解总览

| Phase | 名称 | 目标 | 交付物 | 状态 |
|-------|------|------|--------|------|
| **Phase 1** | 性能基准建立 | 建立量化基准，识别热点方法 | `benchmark_deadcode.py` + 瓶颈报告 | **本期** |
| **Phase 2** | 算法层优化 | 针对性优化热点路径 | 优化代码 + PR | Iteration 2 |
| **Phase 3** | 验证与集成 | 回归测试与集成验证 | 全量测试通过报告 | Iteration 3 |

### 2.2 Phase 1 详细目标

**Iteration 1 交付物清单**：

| # | 交付物 | 文件路径 | 验收条件 |
|---|--------|----------|----------|
| 1 | 性能基准脚本 | `benchmark_deadcode.py` | ATB-1 通过 |
| 2 | 瓶颈分析报告 | `benchmark_results.json` | ATB-2 识别 3+ 热点 |
| 3 | 优化建议文档 | `OPTIMIZATION_PROPOSAL.md` | 列出 ≥5 可操作项 |
| 4 | 回归测试日志 | `regression_test.log` | ATB-3 全量通过 |

### 2.3 Phase 2 预告（Iteration 2）

- Level 2: 缓存层实现（`@lru_cache` + 节点 ID 缓存）
- Level 3: 遍历路径优化（短路无效 `visit_*` 调用）
- Level 4: 惰性求值（`get_graph_data()` 延迟构建）

---

## 3. 边界约束

### 3.1 功能约束

| 约束类型 | 具体要求 |
|----------|----------|
| **API 兼容性** | 所有公共方法签名必须保持向后兼容 |
| **分析准确性** | 死代码检测结果与优化前必须完全一致（零误差容忍） |
| **错误处理** | 语法错误文件、编码错误文件的行为保持不变 |

**必须保持的公共 API**：

```python
class DeadCodeVisitor:
    def analyze(self, path: str) -> 'DeadCodeVisitor': ...
    def analyze_file(self, filepath: str) -> 'DeadCodeVisitor': ...
    def get_dead_code(self) -> List[Dict[str, Any]]: ...
    def get_all_nodes(self) -> List[Dict[str, Any]]: ...
    def get_edges(self) -> List[Dict[str, Any]]: ...
    def get_graph_data(self) -> Dict[str, Any]: ...
    def get_statistics(self) -> Dict[str, int]: ...
```

### 3.2 性能约束

| 约束类型 | 具体要求 |
|----------|----------|
| **基准环境** | Python 3.10+，AST 模块标准库 |
| **外部依赖** | 禁止引入外部 C 扩展或 Cython 依赖 |
| **代码质量** | 优化代码必须通过 `flake8` 和 `mypy` 类型检查 |

### 3.3 测试数据规模

| 规模 | 代码行数 | 文件数量 | 预期耗时 | 预期内存 |
|------|----------|----------|----------|----------|
| 小型 | <1,000 行 | <50 | <2 秒 | <50 MB |
| 中型 | ~10,000 行 | 50-200 | <20 秒 | <200 MB |
| 大型 | ~100,000 行 | >500 | 参考基线 | 参考基线 |

### 3.4 禁止事项

- ❌ 禁止修改 `tests/` 目录下任何测试文件的断言逻辑
- ❌ 禁止修改 `DeadCodeVisitor` 的公共方法签名
- ❌ 禁止引入非标准库依赖

---

## 4. 验收测试基准 (ATB)

### ATB-1: 基准建立脚本可执行性

| 步骤 | 功能描述 | 物理测试期待 | 验证命令 |
|------|----------|--------------|----------|
| 1.1 | 基准脚本独立运行 | `python benchmark_deadcode.py --help` 输出帮助信息 | `exit code = 0` |
| 1.2 | 支持 `--target` 参数 | 脚本正确解析并遍历目标目录 | 参数正确传递 |
| 1.3 | 支持 `--output` 参数 | 输出 JSON 格式性能报告 | 文件生成成功 |
| 1.4 | 输出完整性 | 报告包含 `elapsed_time`, `peak_memory`, `nodes_visited`, `lines_processed` 字段 | JSON schema 验证 |

**ATB-1 验收测试命令**：

```bash
python benchmark_deadcode.py --target tests/fixtures/dead_code_sample.py --output benchmark_results.json
cat benchmark_results.json | jq '.elapsed_time, .peak_memory, .nodes_visited, .lines_processed'
```

---

### ATB-2: 热点方法识别准确性

| 步骤 | 功能描述 | 物理测试期待 | 验证命令 |
|------|----------|--------------|----------|
| 2.1 | 识别 `visit_FunctionDef` 热点 | cProfile 输出显示该方法累计时间 ≥ 整体 15% | `grep -c "visit_FunctionDef"` |
| 2.2 | 识别 `_is_dead_code_candidate` 调用链 | 调用计数 ≥ 10000 次（10k 行代码场景） | `ncalls` 字段验证 |
| 2.3 | 识别 `._get_node_id_for_name()` 冗余 | 同一名称重复解析次数 ≥ 100 次 | 日志分析 |
| 2.4 | 瓶颈报告生成 | JSON 输出 Top 5 热点方法 | 验证 JSON 结构 |

**ATB-2 验收测试命令**：

```bash
python -m cProfile -s cumulative benchmark_deadcode.py \
    --target tests/fixtures/dead_code_sample.py 2>&1 | head -50
```

**预期输出示例**：

```json
{
  "hotspots": [
    {"method": "visit_FunctionDef", "cumulative_time": 1.234, "percentage": 18.5},
    {"method": "_is_dead_code_candidate", "cumulative_time": 0.987, "percentage": 14.8},
    {"method": "visit_Call", "cumulative_time": 0.654, "percentage": 9.8}
  ]
}
```

---

### ATB-3: 现有功能回归验证

| 步骤 | 功能描述 | 物理测试期待 | 验证命令 |
|------|----------|--------------|----------|
| 3.1 | `DeadCodeVisitor` 公共 API 兼容性 | `pytest tests/test_dead_code_removal.py -v` 全量通过 | `exit code = 0` |
| 3.2 | `DeadCodeVisitor` 边界情况处理 | `pytest tests/test_ast_analyzer.py -v` 全量通过 | `exit code = 0` |
| 3.3 | Sprint 4 静态分析集成 | `pytest tests/sprint4/test_static_analysis.py -v` 全量通过 | `exit code = 0` |
| 3.4 | 死代码检测准确性验证 | 检测结果与预期一致，无误报/漏报 | 对比测试 |

**ATB-3 验收测试命令**：

```bash
pytest tests/test_dead_code_removal.py \
       tests/test_ast_analyzer.py \
       tests/sprint4/test_static_analysis.py \
       -v --tb=short
```

---

### ATB-4: 性能基线记录

| 步骤 | 功能描述 | 物理测试期待 |
|------|----------|--------------|
| 4.1 | 小型代码库基准 | 处理 1,000 行代码耗时 < 2 秒，内存 < 50 MB |
| 4.2 | 中型代码库基准 | 处理 10,000 行代码耗时 < 20 秒，内存 < 200 MB |
| 4.3 | 基准报告生成 | `benchmark_results.json` 包含所有 ATB-1 字段及时间戳 |

---

## 5. 开发切入层级序列

### Level 1: 探针注入（基准建立）

**目标**：无侵入式地采集性能数据

**实现位置**：`scripts/ast_dead_code_check.py` - `DeadCodeVisitor.__init__()`

```python
class DeadCodeVisitor:
    def __init__(self, ...):
        # === 新增：性能探针 ===
        self._perf_metrics = {
            "visit_counts": defaultdict(int),
            "method_times": defaultdict(float),
            "name_resolution_cache": {}
        }
```

**探针采集点**：

| 位置 | 采集指标 |
|------|----------|
| `visit_FunctionDef()` 入口 | 方法调用次数 + 时间戳 |
| `visit_Call()` 入口 | 方法调用次数 + 时间戳 |
| `_is_dead_code_candidate()` 入口 | 调用次数 + 节点 ID |
| `._get_node_id_for_name()` 入口 | 名称解析缓存命中率 |

---

### Level 2: 缓存层实现（消除冗余计算）

**目标**：消除 O(n²) 冗余路径

**优化点 1**: `_get_node_id_for_name()` 缓存

```python
import functools

class DeadCodeVisitor:
    @functools.lru_cache(maxsize=1024)
    def _cached_resolve_name(self, name: str, scope: str) -> Optional[str]:
        """缓存名称解析结果，避免重复计算"""
        return self._resolve_name_impl(name, scope)
```

**优化点 2**: `_is_dead_code_candidate()` 结果缓存

```python
def _is_dead_code_candidate(self, node: ast.FunctionDef) -> bool:
    """优化：使用节点 ID 作为缓存键"""
    if not hasattr(self, '_dead_code_cache'):
        self._dead_code_cache = {}
    node_id = id(node)
    if node_id in self._dead_code_cache:
        return self._dead_code_cache[node_id]
    result = self._compute_dead_code_candidate(node)
    self._dead_code_cache[node_id] = result
    return result
```

---

### Level 3: 遍历路径优化（减少 AST 节点访问）

**目标**：减少无效 `visit_*` 方法调用次数

**优化点**: `visit_Call()` 短路逻辑

```python
def visit_Call(self, node: ast.Call) -> None:
    """优化：跳过非名称调用 (如 lambda, attr)"""
    # 短路：只处理直接函数调用
    if not isinstance(node.func, ast.Name):
        return
    # ... 原有逻辑
```

**优化点**: `visit_Name()` 短路逻辑

```python
def visit_Name(self, node: ast.Name) -> None:
    """优化：仅处理 Load 上下文的名称引用"""
    if not isinstance(node.ctx, ast.Load):
        return
    # ... 原有逻辑
```

---

### Level 4: 惰性求值（延迟非关键计算）

**目标**：降低内存峰值

**优化点**: `get_graph_data()` 延迟构建

```python
class DeadCodeVisitor:
    def __init__(self, ...):
        self._graph_data_cache = None
    
    def get_graph_data(self) -> Dict[str, Any]:
        """优化：惰性求值，仅在首次访问时构建"""
        if self._graph_data_cache is None:
            self._graph_data_cache = self._build_graph_data()
        return self._graph_data_cache
```

---

## 6. 交付物清单

| # | 交付物 | 文件路径 | 状态 | 验收条件 |
|---|--------|----------|------|----------|
| 1 | 性能基准脚本 | `benchmark_deadcode.py` | **待创建** | ATB-1 通过 |
| 2 | 瓶颈分析报告 | `benchmark_results.json` | **待生成** | ATB-2 识别 3+ 热点 |
| 3 | 优化建议文档 | `OPTIMIZATION_PROPOSAL.md` | **待创建** | 列出 ≥5 可操作项 |
| 4 | 回归测试日志 | `regression_test.log` | **待生成** | ATB-3 全量通过 |

---

## 7. 后续迭代预告

### Iteration 2 (Phase 2) 目标

| 目标 | 预期提升 |
|------|----------|
| 中型代码库吞吐量 | ≥3x 提升 |
| 内存峰值 | ≥40% 降低 |
| 热点方法优化 | 3+ 个 `visit_*` 方法优化 |

### Iteration 3 (Phase 3) 目标

- 全量回归测试通过
- 性能指标达标验证
- 文档更新与知识沉淀

---

## 附录 A: 测试文件参考

| 文件路径 | 用途 |
|----------|------|
| `tests/fixtures/dead_code_sample.py` | 测试数据.fixture |
| `tests/test_dead_code_removal.py` | 公共 API 回归测试 |
| `tests/test_ast_analyzer.py` | 边界情况测试 |
| `tests/sprint4/test_static_analysis.py` | Sprint 4 集成测试 |

---

## 附录 B: 性能度量指标定义

| 指标 | 定义 | 采集方法 |
|------|------|----------|
| `elapsed_time` | 端到端分析耗时（秒） | `time.perf_counter()` |
| `peak_memory` | 峰值内存占用（MB） | `tracemalloc.get_traced_memory()` |
| `nodes_visited` | 访问的 AST 节点总数 | `visit_counts` 探针 |
| `lines_processed` | 处理的代码行数 | AST 统计 |
| `throughput` | 吞吐量（行/秒） | `lines_processed / elapsed_time` |

---

*文档版本: 1.0.0 | 最后更新: Iteration 1 Phase 1*