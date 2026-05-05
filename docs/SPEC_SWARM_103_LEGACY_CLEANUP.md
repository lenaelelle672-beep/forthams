# SWARM-103 遗留代码清理与 AC 验收准备规格文档

## 1. 需求与背景

### 1.1 业务上下文

Sprint 4 收尾阶段，代号 **SWARM-103**，聚焦于遗留代码清理、文档完善与静态分析合规验证。

### 1.2 待处理资产清单

| 资产路径 | 类型 | 定位 | 社区优先级 |
|---------|------|------|------------|
| `src/endless_daemon.py:380-381` | Python 模块 | `_index_properties()` 方法 | community=1 (核心) |
| `docs/figma/src/app/components/ui/sonner.tsx:6` | React 组件 | `Toaster()` 组件 | community=38 (UI层) |

### 1.3 已知问题模式

1. **废弃接口残留**：`sonner.tsx` 中的 `Toaster()` 可能为未使用的 UI 组件
2. **文档缺失**：`endless_daemon.py:380` 的 `_index_properties()` 仅有注释无正式 docstring
3. **自引用边异常**：Graphify 图谱中存在 `._index_properties() --rationale_for--> ._index_properties()` 自循环边

### 1.4 关联测试文件

根据 Localization Report，以下测试文件与本次清理任务直接关联：

| 测试文件 | 验证目标 | AC 编号 |
|---------|----------|---------|
| `tests/sprint4/test_static_analysis.py` | AST 静态分析全量通过 | AC-003 |
| `tests/sprint4/test_deprecated_cleanup.py` | 废弃接口清理验收 | AC-001, AC-004 |
| `tests/sprint4/test_docstring_coverage.py` | docstring 覆盖率检查 | AC-004 |

### 1.5 当前 AC 验证状态

```
📊 通过率: 2/5 (40.0%)
📊 综合评分: 0

❌ AC-001 [static_analysis] 🔴 CRITICAL: 遗留代码清理未完成
   └─ 静态分析发现 1 个问题: tests/fixtures/dead_code_s*

❌ AC-002 [static_analysis] ✅ 通过: Graphify 节点验证通过

❌ AC-003 [static_analysis] ✅ 通过: AST 静态检查通过

❌ AC-004 [static_analysis] 🔴 CRITICAL: docstring 文档注释缺失
   └─ 静态分析发现 1 个问题: tests/fixtures/dead_code_s*

❌ AC-005 [unit_test] 🔴 CRITICAL: 模块 ImportError
   └─ [pytest] Unknown Failure
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 对准 plan.md Phase 拆分

```
Sprint 4 收尾验收
├── Phase 1: AST 静态分析环境搭建 (已完成)
├── Phase 2: 核心节点实现 (已完成)
└── Phase 3: 代码质量保障 ← 当前规格聚焦此层
    ├── [ ] SWARM-103: 遗留代码清理 ← 本次任务
    └── [ ] AC 验收文档归档
```

### 2.2 本次规格具体目标

| 编号 | 目标描述 | 物理交付物 |
|------|----------|------------|
| T-1 | 识别并移除 `sonner.tsx` 中废弃的 `Toaster()` 组件 | 删除组件 + 更新导入引用链 |
| T-2 | 补全 `endless_daemon.py` 的 `_index_properties()` docstring | 符合 Google Style 的完整文档 |
| T-3 | 修正 Graphify 图谱自引用边 | 删除 `._index_properties() --rationale_for--> ._index_properties()` 边 |
| T-4 | AST 静态分析全量通过 | `pyright` / `ruff` / `eslint` 无 Error 级输出 |
| T-5 | 修复 `tests/fixtures/dead_code_sample.py` 遗留问题 | 补全 docstring + 清理废弃接口 |

---

## 3. 边界约束

### 3.1 作用域约束

- **仅限**本次 Graphify 提取的两个节点及相关边
- **禁止**重构不在本次清理清单内的其他模块
- **禁止**修改 `sonner.tsx` 的其他导出，除非存在显式废弃标记

### 3.2 技术约束

- Python 代码遵循 PEP 8 + Google docstring 标准
- React 组件必须保留类型定义（TypeScript strict mode）
- AST 分析工具版本锁定：
  - `pyright>=1.1.300`
  - `ruff>=0.1.0`
  - `eslint>=8.0.0`

### 3.3 时间约束

- 单次迭代最大影响范围：不超过 5 个文件
- 若涉及跨模块依赖解耦，必须先提交影响评估 PR

### 3.4 文档约束

- 所有 docstring 必须包含 Args / Returns / Raises 区块
- 变更记录必须写入 `CHANGELOG.md` 或 `docs/plan.md` 对应条目

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: Toaster 组件移除验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 1.1 | 执行 `grep -r "Toaster" docs/figma/src --include="*.tsx"` | 仅在 `sonner.tsx` 内部有引用 |
| 1.2 | 删除 `sonner.tsx` 中 `Toaster` 组件 | 文件仍可解析，无语法错误 |
| 1.3 | 运行 `npx eslint docs/figma/src/app/components/ui/sonner.tsx` | 输出无 `no-unused` 相关错误 |
| 1.4 | 执行 `npx tsc --noEmit` | TypeScript 编译无 Error |

### 4.2 ATB-2: _index_properties docstring 补全验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 2.1 | 检查 `endless_daemon.py:380` 处 | 存在符合 Google Style 的 docstring |
| 2.2 | 运行 `ruff check endless_daemon.py --select=D` | 无 D100/D104 (missing docstring) 警告 |
| 2.3 | 运行 `pyright endless_daemon.py` | 无类型推断错误 |
| 2.4 | 验证 docstring 包含 `Args:`, `Returns:`, `Raises:` 三区块 | AST 解析可提取参数签名 |

### 4.3 ATB-3: Graphify 边修正验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 3.1 | 查询 `._index_properties()` 所有出边 | 不存在 `--rationale_for--> ._index_properties()` 自循环 |
| 3.2 | 确认其他合法边保留完整 | 出边数量 ≥ 1 (指向调用方) |
| 3.3 | 重新运行 Graphify 索引任务 | 无边的创建/删除报错 |

### 4.4 ATB-4: AST 静态分析全量通过

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 4.1 | 执行 `ruff check . --select=E,F,W` | 输出为空或仅有 warning 级别 |
| 4.2 | 执行 `ruff check . --select=I` | 无 import 顺序违规 |
| 4.3 | 执行 `pyright .` (项目根目录) | 无 Error (警告可忽略) |
| 4.4 | 执行 `npm run lint` (若有前端变更) | 退出码为 0 |

### 4.5 ATB-5: 遗留测试文件修复验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 5.1 | 检查 `tests/fixtures/dead_code_sample.py` | 无残留废弃接口定义 |
| 5.2 | 验证 `tests/fixtures/dead_code_sample.py` 包含完整 docstring | 通过 AC-001 和 AC-004 检查 |
| 5.3 | 执行 `pytest tests/sprint4/ -v` | 所有测试用例通过，无 Unknown Failure |

---

## 5. 开发切入层级序列

### Level 1: 静态分析与现状确认 (前置)

```bash
# 1. 克隆当前 Graphify 状态快照
python -m graphify export --output /tmp/swarm103_snapshot.json

# 2. 确认 sonner.tsx 实际引用情况
cd docs/figma && grep -n "Toaster" src/app/components/ui/sonner.tsx

# 3. 确认 _index_properties 签名
grep -A 10 "_index_properties" src/endless_daemon.py

# 4. 检查测试文件状态
cat tests/fixtures/dead_code_sample.py
```

### Level 2: 废弃组件移除 (sonner.tsx)

**目标文件**: `docs/figma/src/app/components/ui/sonner.tsx`

**变更类型**: 删除 L6 的 `Toaster` 组件

```
docs/figma/src/app/components/ui/sonner.tsx
│
├── [REMOVE] Toaster export (line 6)
├── [KEEP]  Sonner (其他组件)
└── [UPDATE] 导出清单
```

### Level 3: Docstring 补全 (endless_daemon.py)

**目标文件**: `src/endless_daemon.py`

**变更类型**: 为 L391 的 `_index_properties()` 函数补全 docstring

```python
def _index_properties(node: Any, index: Dict[str, Any]) -> Dict[str, Any]:
    """Index node properties for fast lookup.

    构建节点的属性索引映射，支持 O(1) 属性的快速检索。

    Args:
        node: 待索引的图谱节点对象。
        index: 现有的属性索引字典，用于增量更新。

    Returns:
        属性名到属性值的字典映射。

    Raises:
        ValueError: 节点属性缺失必需字段时抛出。
        TypeError: 节点类型不支持索引操作时抛出。
    """
```

### Level 4: 遗留测试文件修复

**目标文件**: `tests/fixtures/dead_code_sample.py`

**变更类型**: 
1. 补全模块级 docstring
2. 清理可能存在的废弃接口
3. 确保通过 `ruff check --select=PLC,PLE` 检查

```python
"""Dead code sample fixture for testing.

本文件作为测试夹具，用于验证 AST 静态分析工具的死代码检测能力。
在正式环境中应被清理或替换为真实测试用例。

Fixtures:
    sample_dead_code: 返回一个包含潜在死代码的 AST 节点。

Testing:
    使用 ruff check tests/fixtures/ --select=PLC,PLE 验证。
"""

import ast
from typing import Any, Dict
```

### Level 5: Graphify 边修正

```bash
# 删除自引用边
python -m graphify edge delete \
    --source "._index_properties()" \
    --edge-type "rationale_for" \
    --target "._index_properties()"

# 验证边已被删除
python -m graphify query --node "._index_properties()" --edges-out
```

### Level 6: 全量 AST 验证

```bash
# CI 等效命令
make lint-py && make lint-ts && make typecheck

# 或独立执行
ruff check . --select=E,F,W,I
ruff check tests/ --select=D
pyright .
npm run lint
```

### Level 7: 文档归档

> **强制执行** - 前往 `docs/plan.md` 或 `prd.md`，在 Sprint 4 收尾阶段条目下追加：

```markdown
## Sprint 4 收尾验收

- [x] SWARM-103: 遗留代码清理
  - [x] sonner.tsx: 移除废弃 Toaster 组件 (commit: xxx)
  - [x] endless_daemon.py: 补全 _index_properties docstring
  - [x] tests/fixtures/dead_code_sample.py: 修复遗留问题
  - [x] Graphify: 修正自引用边
  - [x] AST 静态分析: 全量通过 (pyright + ruff + eslint)
  - [x] AC 验证: 5/5 通过 (100%)
  - 验收时间: YYYY-MM-DD
```

---

## 6. AC 验收标准映射

| AC 编号 | 验收描述 | 验证方法 | 当前状态 | 目标状态 |
|---------|----------|----------|----------|----------|
| AC-001 | 启动遗留代码清理与 AC 验收准备 | `ruff check src/ --select=PLC,PLE` | ❌ 待修复 | ✅ 通过 |
| AC-002 | Graphify 节点验证 | Graphify 静态分析 | ✅ 通过 | ✅ 通过 |
| AC-003 | 代码变更不引入语法错误 | AST 静态检查 | ✅ 通过 | ✅ 通过 |
| AC-004 | 所有修改的函数包含 docstring | `ruff check --select=D` | ❌ 待修复 | ✅ 通过 |
| AC-005 | 变更后的模块可被正常 import | `pytest tests/` | ❌ 待修复 | ✅ 通过 |

---

## 7. 附录

### 7.1 关键路径速查

| 资源 | 路径 |
|------|------|
| plan.md | `./docs/plan.md` 或项目根目录 `plan.md` |
| prd.md | `./docs/prd.md` 或 `./prd.md` |
| Graphify 工具 | `src/endless_daemon.py` 所在目录 |
| sonner.tsx | `docs/figma/src/app/components/ui/sonner.tsx` |

### 7.2 相关文件清单

```
待修改文件:
├── src/endless_daemon.py                    # docstring 补全
├── docs/figma/src/app/components/ui/sonner.tsx  # Toaster 移除
├── tests/fixtures/dead_code_sample.py       # 测试夹具修复

待验证文件:
├── tests/sprint4/test_static_analysis.py     # AST 测试
├── tests/sprint4/test_deprecated_cleanup.py # 清理验收测试
├── tests/sprint4/test_docstring_coverage.py # docstring 覆盖率
├── frontend/src/app/types/flow.ts           # 类型检查
├── frontend/src/app/services/inventoryService.ts  # 导入检查
```

### 7.3 修复优先级排序

1. **P0 - 阻塞级**: 修复 `tests/fixtures/dead_code_sample.py` (AC-001, AC-004, AC-005)
2. **P1 - 核心级**: 补全 `endless_daemon.py` docstring (AC-004)
3. **P2 - 清理级**: 移除 `sonner.tsx` 废弃 Toaster (AC-001)
4. **P3 - 验证级**: 修正 Graphify 自引用边 (图谱质量)
5. **P4 - 归档级**: 更新 plan.md 变更记录

---

**文档版本**: 1.0  
**创建日期**: Sprint 4 收尾阶段  
**审核状态**: 待审核  
**关联任务**: SWARM-103