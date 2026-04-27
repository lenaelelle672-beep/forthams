# SWARM-103 规格指导文档

## 需求与背景

| 项目 | 说明 |
|------|------|
| 任务编号 | SWARM-103 |
| 任务名称 | 启动遗留代码清理与 AC 验收准备 |
| Sprint | Sprint 4 收尾阶段 |
| 当前迭代 | Iteration 4 |
| 目标文件 | `scripts/ast_dead_code_check.py` |

**核心需求**：
- 移除废弃接口（已识别的 Dead Code）
- 完成所有遗留模块的 docstring 补全
- 确保 AST 静态分析通过率为 100%

**已识别废弃节点**（来自 Graphify 分析）：
- `._index_properties()` - endless_daemon.py L380 (community=1)
- `Toaster()` - sonner.tsx L6 (community=38)

**当前 AC 状态**：通过率 40% (2/5)
- ❌ AC-001: 静态分析发现问题
- ✅ AC-002: 静态分析通过
- ✅ AC-003: AST 检查通过
- ❌ AC-004: 缺少 docstring
- ❌ AC-005: ImportError

---

## 当前 Phase 对应实施目标

| Phase | 描述 | 本次覆盖 |
|-------|------|----------|
| Phase 1 | 废弃代码识别与影响分析 | ✅ 已完成 |
| Phase 2 | 废弃接口移除与依赖修复 | 🔄 本次重点 |
| Phase 3 | Docstring 覆盖率提升至 95%+ | 🔄 本次重点 |
| Phase 4 | AST 静态分析全量通过 | 🔄 本次重点 |
| Phase 5 | Sprint 4 验收文档归档 | 📋 待执行 |

---

## 边界约束

### 禁止事项
- ❌ 不得在未确认调用链的情况下直接删除任何函数/类
- ❌ 不得移除存在动态调用（`eval`、`getattr`）的代码路径
- ❌ 不得破坏已通过的现有测试用例
- ❌ 不得跳过 `plan.md` 中的 checkpoint 归档步骤

### 约束条件
| 约束项 | 阈值 |
|--------|------|
| Docstring 覆盖率 | ≥ 95% |
| AST 静态分析通过率 | 100% |
| 测试回归通过率 | 100% |
| 废弃接口移除后需保留兼容桩 | 保留 1 个 Sprint 过渡期 |

### 输出物约束
- 所有清理操作必须记录在 `docs/refactoring_log.md`
- 每个废弃接口移除前必须生成影响分析报告
- 最终交付必须包含 `sprint4_acceptance_report.md`

---

## 验收测试基准 (ATB)

### ATB-1：废弃接口移除验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-1.1 | `._index_properties()` 移除验证 | `grep -r "._index_properties" src/` 返回空结果 |
| ATB-1.2 | `Toaster()` 组件移除验证 | `grep -r "Toaster" docs/figma/` 返回空结果 |
| ATB-1.3 | 调用链影响分析 | `python scripts/impact_analysis.py --node "._index_properties"` 输出无下游依赖 |

### ATB-2：Docstring 补全验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-2.1 | Docstring 覆盖率检查 | `interrogate src/` 显示 ≥ 95% |
| ATB-2.2 | `ast_dead_code_check.py` docstring 验证 | 所有类/函数包含规范 docstring |

### ATB-3：AST 静态分析验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-3.1 | pyflakes 无错误 | `pyflakes scripts/ast_dead_code_check.py` 输出为空 |
| ATB-3.2 | pylint 评分 | `pylint scripts/ast_dead_code_check.py` 最终评分 ≥ 8.0 |
| ATB-3.3 | AST 解析完整性 | `python -m py_compile scripts/ast_dead_code_check.py` 成功 |

### ATB-4：回归测试验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-4.1 | `ast_dead_code_check.py` 模块可导入 | `python -c "from scripts.ast_dead_code_check import *"` 无 ImportError |
| ATB-4.2 | DeadCodePattern 类功能验证 | `pytest tests/test_dead_code_removal.py` 全部通过 |

---

## 开发切入层级序列

### 阶段 1：影响分析（第 1 天上午）

```
层级 L1: 静态调用链分析
├── 执行: python scripts/ast_dead_code_check.py --src src/ --fmt md
├── 执行: python scripts/impact_analysis.py --target "._index_properties"
└── 产出: docs/impact_report_._index_properties.md

层级 L2: 动态引用扫描
├── 执行: grep -rn "eval\|getattr\|__import__" scripts/
└── 产出: docs/dynamic_refs_audit.md
```

### 阶段 2：`ast_dead_code_check.py` Docstring 补全（第 1 天）

```
层级 L3: Docstring 补全
├── 优先级 P0: DeadCodePattern 类 (L32)
├── 优先级 P0: DeadCodeVisitor 类 (L98)
├── 优先级 P1: analyze_file (L234)
├── 优先级 P1: analyze_directory (L293)
├── 优先级 P1: format_output (L351)
└── 优先级 P1: main (L443)

层级 L4: ImportError 修复
├── 检查: import 语句路径正确性
├── 检查: 依赖模块存在性
└── 验证: python -c "import scripts.ast_dead_code_check"
```

### 阶段 3：AST 静态分析通过（第 2 天）

```
层级 L5: 错误修复
├── Pylint: 逐一修复 W/E 级别问题
├── Pyflakes: 确保零错误
└── AST 解析: python -m py_compile 逐文件验证

层级 L6: 自动化检查集成
├── 配置: .github/workflows/static_analysis.yml
└── 执行: 完整 ATB-3 测试套件
```

### 阶段 4：最终验收（第 3 天）

```
层级 L7: 回归测试
├── 执行: pytest tests/test_dead_code_removal.py -v
└── 产出: test_results_sprint4_final.json

层级 L8: 文档归档
├── 更新: docs/plan.md Phase 4 标记 [x]
├── 生成: docs/sprint4_acceptance_report.md
└── 记录: docs/refactoring_log.md
```

---

## 执行检查点清单

- [ ] `scripts/ast_dead_code_check.py` 所有类/函数包含完整 docstring
- [ ] `scripts/ast_dead_code_check.py` 模块可正常 import
- [ ] `pyflakes scripts/ast_dead_code_check.py` 零错误
- [ ] `pylint scripts/ast_dead_code_check.py` 评分 ≥ 8.0
- [ ] `python -m py_compile scripts/ast_dead_code_check.py` 成功
- [ ] `pytest tests/test_dead_code_removal.py` 全部通过
- [ ] `interrogate scripts/` 覆盖率 ≥ 95%
- [ ] `docs/plan.md` Phase 4 状态更新
- [ ] `docs/sprint4_acceptance_report.md` 生成完成