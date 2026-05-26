# SWARM-103 遗留代码清理与 AC 验收准备规格指导

## 需求与背景

| 维度 | 说明 |
|------|------|
| **任务编号** | SWARM-103 |
| **任务类型** | 遗留代码清理 + Sprint 4 收尾验收 |
| **Iteration** | 9 |
| **核心目标** | 移除废弃接口、补全 docstring、通过 AST 静态分析验证 |
| **涉及文件** | `endless_daemon.py` (L380-381), `sonner.tsx` (L6), `InventoryTaskMapper.java` |

**Graphify 知识图谱关键节点**：

| 节点 | 文件位置 | Community | 状态 |
|------|----------|-----------|------|
| `._index_properties()` | `src/endless_daemon.py` L380 | 1 | 待清理 |
| `Toaster()` | `docs/figma/src/app/components/ui/sonner.tsx` L6 | 38 | 待评估 |

**技术债务现状**：
- `endless_daemon.py` 中 `_index_properties()` 方法标注为"Index node properties for fast lookup"，需确认是否仍被调用
- `sonner.tsx` 中 `Toaster()` 组件位于 Figma 文档引用路径，React 组件生命周期状态需审计

---

## 当前 Phase 对应实施目标

参照 Sprint 4 收尾验收阶段（Phase: `cleanup-deprecation`）：

| 子任务 | 对应 Phase | 优先级 | 候选文件 |
|--------|-----------|--------|----------|
| T-1: 扫描废弃接口调用链 | Phase-1 废弃接口识别 | P0 | `tests/sprint4/test_deprecated_cleanup.py` |
| T-2: 移除 `_index_properties()` 孤立调用 | Phase-2 清理执行 | P0 | `src/endless_daemon.py` |
| T-3: 补全 `endless_daemon.py` 所有公共方法 docstring | Phase-3 Docstring 补全 | P1 | `src/endless_daemon.py` |
| T-4: 审计 `Toaster()` 组件引用完整性 | Phase-3 组件健康检查 | P1 | `docs/figma/src/app/components/ui/sonner.tsx` |
| T-5: AST 静态分析通过验证 | Phase-4 验收门禁 | P0 | `tests/sprint4/test_static_analysis.py` |
| T-6: 路由层健康检查 | Phase-3 路由适配 | P1 | `frontend/src/app/routes.ts` |
| T-7: 入口点验证 | Phase-3 入口点检查 | P1 | `frontend/src/main.tsx` |

---

## 边界约束

```
边界条件清单
├── 约束 C1: 不得删除仍被外部调用的公开 API（需通过 call-graph 分析确认）
├── 约束 C2: Docstring 补全范围限定于 public method（_前缀方法除外）
├── 约束 C3: AST 分析仅覆盖 Python 源码（.py 文件），不涉及 TypeScript
├── 约束 C4: Toaster() 组件若被移除，需同步清理 package.json 依赖（sonner）
├── 约束 C5: 所有变更必须保留 Git commit 可回滚性，不使用 --force
├── 约束 C6: 必须在完成代码修改后更新 plan.md 进度标记
└── 约束 C7: 修改 InventoryTaskMapper.java 需同步更新对应的 XML mapper
```

**图谱约束**：
- `._index_properties()` 属于 internal implementation，不暴露为 public API
- `Toaster()` 属于 UI 组件，community=38，需确认是否属于 deprecated UI stack

---

## 验收测试基准 (ATB)

### ATB-1: 废弃接口扫描

```bash
# 物理测试期待: 无孤立调用报告
pytest tests/sprint4/test_deprecated_cleanup.py -v
# 期待输出: 0 orphaned methods detected
```

**功能对应**：`get_target_methods()` 函数读取 Graphify 知识图谱节点清单，验证 `._index_properties()` 和 `Toaster()` 的存续状态。

### ATB-2: `_index_properties()` 清理验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 2.1 | `grep -rn "_index_properties" src/` | 返回空结果 |
| 2.2 | `python -m py_compile endless_daemon.py` | 编译成功，无 SyntaxError |
| 2.3 | `pytest tests/sprint4/test_deprecated_cleanup.py::test_index_properties_removed` | PASSED |

**功能对应**：验证 `PropertyIndex._normalize_value()` 和 `index_node()` 方法是否已重构，消除对 `_index_properties()` 的依赖。

### ATB-3: Docstring 补全验证

```bash
# 物理测试期待: 所有公共方法均有 docstring
pylint src/endless_daemon.py --disable=all --enable=missing-docstring | grep -c "missing-docstring"
# 期待输出: 0
```

**功能对应**：补全以下类的公共方法 docstring：
- `NodeMetadata` (L41)
- `IndexEntry` (L128)
- `NodeRegistry` (L191)
- `PropertyIndex` (L332)
- `GraphifyDaemon` (L524)

### ATB-4: `Toaster()` 组件审计

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 4.1 | `grep -r "Toaster" docs/figma/src/` | 列出所有引用点 |
| 4.2 | `grep -r "sonner" package.json` | 确认 sonner 依赖状态 |
| 4.3 | `npx tsc --noEmit` | TypeScript 编译通过 |

**功能对应**：审计 `docs/figma/src/app/components/ui/sonner.tsx` 中 `Toaster()` 组件是否被 `ApprovalPage` (L27) 或其他路由页面引用。

### ATB-5: AST 静态分析门禁

```bash
# 物理测试期待: 全部通过
bandit -r src/ --severity=medium --confidence=medium
ruff check src/ --select=E,F401,W503
mypy src/ --ignore-missing-imports

# 全部期待: 0 issues found
```

**功能对应**：`scripts/ast_dead_code_check.py` 中的 `DeadCodePattern` 和 `DeadCodeVisitor` 类执行 AST 遍历，识别死代码模式。

### ATB-6: 路由层健康检查

```bash
# 物理测试期待: 所有路由可正常解析
npx tsc frontend/src/app/routes.ts --noEmit
# 期待输出: 无编译错误
```

**功能对应**：`createAppRouter()` 函数 (L179) 生成 React Router 配置，`router` 导出 (L188) 的 `deprecated` 标记需在清理后移除。

### ATB-7: 入口点验证

```bash
# 物理测试期待: 入口点正确挂载
npx vitest run frontend/src/main.tsx
# 期待输出: PASSED
```

**功能对应**：`mountApplication()` 函数 (L43) 通过 `document.getElementById("root")` 挂载 React 应用。

---

## 开发切入层级序列

```
层级序列 (L1 → L2 → L3 → L4 → L5)
│
├─ L1: 图谱依赖分析
│   ├─ 读取 Graphify 知识图谱，确认 ._index_properties() 和 Toaster() 的 community 归属
│   └─ 确认 InventoryTaskMapper.java 的数据库操作是否涉及废弃字段
│
├─ L2: Call-Graph 静态分析
│   ├─ 使用 pydeps 或 pycallgraph 绘制 endless_daemon.py 的调用依赖树
│   ├─ 关键节点: _index_properties() 是否存在外部引用边
│   └─ 使用 jdepend 或 IntelliJ 依赖分析检查 InventoryTaskMapper.java
│
├─ L3: 废弃接口移除 (按 Graphify EDGE 关系定向删除)
│   ├─ 若 _index_properties() 无外部依赖边 → 安全删除
│   ├─ 更新 Graphify 知识图谱，移除该 NODE
│   ├─ 审计 Toaster() 组件引用完整性
│   └─ 清理 InventoryTaskMapper.java 中未使用的查询方法
│
├─ L4: Docstring 补全
│   ├─ 使用 pydocstyle 自动补全模板
│   ├─ 手动补充业务语义说明（参照 L380-L381 的 Graphify 标注）
│   └─ 补全 frontend/src/main.tsx 和 frontend/src/app/routes.ts 的 TypeScript docstring
│
└─ L5: 验收门禁执行
    ├─ 按 ATB-1 ~ ATB-7 顺序执行全部物理测试
    ├─ 全部 PASSED 后触发 plan.md 记账更新
    └─ 强制归档: git commit with "docs: update plan.md - SWARM-103 cleanup completed"
```

**执行顺序原则**：
- L1 必须先于 L3 执行，确保 Graphify 图谱数据一致性
- L4 可与 L3 并行执行（独立文件）
- L5 作为最终门禁，必须在所有修改 commit 后执行

---

## 候选修改文件详细清单

### 1. `frontend/src/app/routes.ts` (相关度: 6)

| 行号 | 函数/类 | 修改内容 |
|------|---------|----------|
| L27 | `arrow_fn ApprovalPage` | 检查 ApprovalPage 路由是否引用 Toaster 组件 |
| L179 | `function createAppRouter` | 验证路由配置正确性 |
| L188 | `router` | 移除 deprecated 标记（如存在） |

### 2. `tests/sprint4/test_deprecated_cleanup.py` (相关度: 4)

| 行号 | 函数/类 | 修改内容 |
|------|---------|----------|
| L65 | `def get_target_methods` | 更新 Graphify 节点清单中的 `._index_properties()` 和 `Toaster()` 状态 |
| L70-74 | 注释 | 更新文档注释中的节点表格 |

### 3. `tests/sprint4/test_static_analysis.py` (相关度: 3)

| 行号 | 函数/类 | 修改内容 |
|------|---------|----------|
| - | - | 确认 AST 静态分析覆盖 endless_daemon.py 和 InventoryTaskMapper.java |

### 4. `backend/src/main/java/com/ams/mapper/InventoryTaskMapper.java` (相关度: 3)

| 行号 | 函数/类 | 修改内容 |
|------|---------|----------|
| L84 | - | 审计是否涉及废弃字段查询，清理未使用的 SQL 方法 |

### 5. `frontend/src/main.tsx` (相关度: 2)

| 行号 | 函数/类 | 修改内容 |
|------|---------|----------|
| L43 | `function mountApplication` | 验证入口点挂载逻辑，补充 docstring |

---

## 强制归档要求

> ⚠️ **军律警告**：完成 L1-L5 全部层级后，**必须**执行以下记账操作：
>
> ```bash
> # 前往 plan.md 或 prd.md 所在目录
> cd $(git rev-parse --show-toplevel)
> vim docs/plan.md
> # 定位到 Sprint 4 Phase: cleanup-deprecation
> # 添加完成标记：[x] SWARM-103 遗留代码清理完成
> # 记录: Iteration-9 完成时间戳
> git add docs/plan.md && git commit -m "docs: update plan.md - SWARM-103 cleanup completed"
> ```
>
> **禁止**出现"代码写完不记账即退出"的行为。

---

## AC Criteria 核对清单

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | SWARM-103 遗留代码清理与 AC 验收准备 | static_analysis | 待验证 |
| AC-002 | Graphify 知识图谱 NODE 验证 | static_analysis | 待验证 |
| AC-003 | AST 静态检查通过（无语法错误） | static_analysis | 待验证 |
| AC-004 | 所有修改的函数包含 docstring | static_analysis | 待验证 |
| AC-005 | 模块可正常 import | unit_test | 待验证 |

---

## 附录：Graphify 知识图谱节点详情

### NODE: `._index_properties()`

```
{
  "id": "node_index_properties",
  "name": "._index_properties()",
  "file": "src/endless_daemon.py",
  "line": 380,
  "community": 1,
  "type": "method",
  "description": "Index node properties for fast lookup",
  "status": "pending_cleanup"
}
```

### NODE: `Toaster()`

```
{
  "id": "node_toaster",
  "name": "Toaster()",
  "file": "docs/figma/src/app/components/ui/sonner.tsx",
  "line": 6,
  "community": 38,
  "type": "component",
  "description": "Sonner toast notification component",
  "status": "pending_audit"
}
```