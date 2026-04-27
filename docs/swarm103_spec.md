# SWARM-103 规格指导文档

## 需求与背景

| 项目 | 说明 |
|------|------|
| 任务编号 | SWARM-103 |
| 任务名称 | 启动遗留代码清理与 AC 验收准备 |
| Sprint | Sprint 4 收尾阶段 |
| 当前迭代 | Iteration 4 |

**核心需求**：
- 移除废弃接口（已识别的 Dead Code）
- 完成所有遗留模块的 docstring 补全
- 确保 AST 静态分析通过率为 100%
- 为 Sprint 4 验收交付准备完整的 AC（Acceptance Criteria）验证包

**已识别废弃节点**（来自 Graphify 分析）：
- `._index_properties()` - endless_daemon.py L380 (community=1)
- `Toaster()` - sonner.tsx L6 (community=38)

---

## 当前 Phase 对应实施目标

参照 plan.md 的 Phase 拆解：

| Phase | 描述 | 本次覆盖 |
|-------|------|----------|
| Phase 1 | 废弃代码识别与影响分析 | ✅ 已完成（Graphify 节点提取） |
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
| 废弃接口移除后需保留兼容桩（stub） | 保留 1 个 Sprint 的过渡期 |

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

```bash
# pytest 命令
pytest tests/refactoring/test_dead_code_removal.py -v -k "test_legacy_removal"
```

### ATB-2：Docstring 补全验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-2.1 | Docstring 覆盖率检查 | `interrogate -v src/` 显示 ≥ 95% |
| ATB-2.2 | 新增模块 docstring 存在性 | `pytest tests/docs/test_docstrings.py -v` 全部通过 |

```bash
# 覆盖率扫描命令
interrogate src/ --fail-under=95 --exclude=test_*.py
```

### ATB-3：AST 静态分析验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-3.1 | pyflakes 无错误 | `pyflakes src/ .` 输出为空 |
| ATB-3.2 | pylint 评分 | `pylint src/ --score=y` 最终评分 ≥ 8.0 |
| ATB-3.3 | AST 解析完整性 | `python -m ast src/**/*.py` 所有文件成功解析 |

```bash
# 完整静态分析命令
pyflakes src/ && pylint src/ --disable=all --enable=E,F && echo "AST_PASS"
```

### ATB-4：回归测试验证

| 测试编号 | 测试描述 | 物理测试期待 |
|----------|----------|--------------|
| ATB-4.1 | 全量测试通过 | `pytest tests/ -x -q` 零失败 |
| ATB-4.2 | 集成测试覆盖 | `pytest tests/integration/ -v` 全部通过 |

---

## 开发切入层级序列

### 阶段 1：影响分析（第 1 天上午）

```
层级 L1: 静态调用链分析
├── 执行: python scripts/graphify/extract_nodes.py --src src/ --fmt md
├── 执行: python scripts/impact_analysis.py --target "._index_properties"
└── 产出: docs/impact_report_._index_properties.md

层级 L2: 动态引用扫描
├── 执行: grep -rn "eval\|getattr\|__import__" src/
└── 产出: docs/dynamic_refs_audit.md
```

### 阶段 2：废弃接口移除（第 1 天下午）

```
层级 L3: 代码移除操作
├── 文件: src/endless_daemon.py
│   └── 移除: ._index_properties() 方法 (L380-L381)
├── 文件: docs/figma/src/app/components/ui/sonner.tsx
│   └── 移除: Toaster 组件引用 (L6)
└── 操作后: 运行 ATB-1 测试验证

层级 L4: 兼容桩（Stub）创建
├── 创建: src/legacy_stubs.py
│   └── 保留: def _index_properties_stub(): pass
└── 有效期: Sprint 5 结束前保留
```

### 阶段 3：Docstring 补全（第 2 天）

```
层级 L5: 缺失文档扫描
├── 执行: interrogate src/ -v --fail-under=95
└── 识别: 低于阈值的模块列表

层级 L6: 文档补全
├── 优先级 P0: 公共 API（被外部 import 的模块）
├── 优先级 P1: 内部核心模块（community=1）
└── 优先级 P2: UI 组件文档

层级 L7: 验证
└── 执行: ATB-2 测试
```

### 阶段 4：静态分析通过（第 2 天天下午）

```
层级 L8: 错误修复
├── Pylint: 逐一修复 W/E 级别问题
├── Pyflakes: 确保零错误
└── AST 解析: python -m py_compile 逐文件验证

层级 L9: 自动化检查集成
├── 配置: .github/workflows/static_analysis.yml
└── 执行: 完整 ATB-3 测试套件
```

### 阶段 5：最终验收（第 3 天）

```
层级 L10: 回归测试
├── 执行: pytest tests/ -x --tb=short
└── 产出: test_results_sprint4_final.json

层级 L11: 文档归档
├── 更新: docs/plan.md Phase 4 标记 [x]
├── 生成: docs/sprint4_acceptance_report.md
└── 记录: docs/refactoring_log.md
```

---

## 执行检查点清单

- [ ] 确认 `._index_properties()` 无下游依赖
- [ ] 确认 `Toaster()` 组件无使用引用
- [ ] `grep` 验证两个节点已从代码库移除
- [ ] `interrogate` 覆盖率 ≥ 95%
- [ ] `pyflakes` + `pylint` 零 Error/Fatal
- [ ] `pytest tests/` 全部通过
- [ ] `docs/plan.md` Phase 4 状态更新
- [ ] `docs/sprint4_acceptance_report.md` 生成完成