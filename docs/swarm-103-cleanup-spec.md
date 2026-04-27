# SWARM-103 遗留代码清理与 AC 验收准备 - 规格指导文档

## 需求与背景

| 维度 | 说明 |
|------|------|
| **任务编号** | SWARM-103 |
| **任务类型** | 遗留代码清理 + Sprint 4 收尾验收 |
| **核心目标** | 移除废弃接口、补全 docstring、通过 AST 静态分析验证 |
| **Iteration** | 9 |
| **Phase** | `cleanup-deprecation` |
| **涉及 Graphify 节点** | `._index_properties()` (L380, community=1), `Toaster()` (L6, community=38) |

### 技术债务现状分析

根据 Localization Report 和 Checkpoint 摘要：

1. **AC-005 阻塞问题**：`pytest` 运行抛出 `ImportError`（Unknown Failure），表明变更后的模块存在循环引用或路径配置问题
2. **Graphify 节点状态**：
   - `._index_properties()`: 位于 `src/endless_daemon.py` L380-381，标注为 "Index node properties for fast lookup"，community=1
   - `Toaster()`: 位于 `docs/figma/src/app/components/ui/sonner.tsx` L6，community=38
3. **静态分析通过率**：4/5 (80.0%)，需修复 AC-005 使其达到 100%

---

## 当前 Phase 对应实施目标

### Sprint 4 收尾验收阶段任务分解

| 子任务 | 对应 Phase | 优先级 | 状态 |
|--------|-----------|--------|------|
| T-1: 修复 AC-005 ImportError | Phase-1 阻塞修复 | **P0** | 🔴 待修复 |
| T-2: 扫描废弃接口调用链 | Phase-2 废弃接口识别 | P0 | ✅ 已完成 |
| T-3: 移除 `_index_properties()` 孤立调用 | Phase-3 清理执行 | P0 | ✅ 已完成 |
| T-4: 补全 `endless_daemon.py` 所有公共方法 docstring | Phase-4 Docstring 补全 | P1 | ✅ 已完成 |
| T-5: 审计 `Toaster()` 组件引用完整性 | Phase-5 组件健康检查 | P1 | ✅ 已完成 |
| T-6: AST 静态分析通过验证 | Phase-6 验收门禁 | P0 | ✅ 已完成 |

### 候选修改文件清单

基于 Localization Report 的相关度排序：

| 文件路径 | 相关度 | 行数 | 修改必要性 |
|----------|--------|------|-----------|
| `frontend/src/app/routes.ts` | 6 | 213 | **P0 - 修复 ImportError** |
| `tests/sprint4/test_deprecated_cleanup.py` | 4 | 375 | P1 - 清理测试逻辑 |
| `tests/sprint4/test_static_analysis.py` | 3 | 750 | P1 - 静态分析验证 |
| `backend/src/main/java/com/ams/mapper/InventoryTaskMapper.java` | 3 | 84 | P2 - 引用完整性 |
| `frontend/src/main.tsx` | 2 | 59 | **P0 - 修复 ImportError** |

---

## 边界约束

```
┌─────────────────────────────────────────────────────────────────┐
│                        边界条件清单                              │
├─────────────────────────────────────────────────────────────────┤
│ 约束 C1: 不得删除仍被外部调用的公开 API                           │
│         → 需通过 call-graph 分析确认无外部引用边                  │
│                                                                  │
│ 约束 C2: Docstring 补全范围限定于 public method                  │
│         → _前缀方法（internal）无需补全                          │
│                                                                  │
│ 约束 C3: AST 分析仅覆盖 Python 源码（.py 文件）                  │
│         → TypeScript/React 组件使用 tsc --noEmit 验证            │
│                                                                  │
│ 约束 C4: Toaster() 组件若被移除，需同步清理 package.json 依赖     │
│         → 检查 sonner 包是否仍被其他组件引用                      │
│                                                                  │
│ 约束 C5: 所有变更必须保留 Git commit 可回滚性                    │
│         → 禁止使用 git push --force                              │
│                                                                  │
│ 约束 C6: 必须在完成代码修改后更新 plan.md 记账                    │
│         → 缺失记账将导致任务验收失败                              │
│                                                                  │
│ 约束 C7: AC-005 ImportError 修复优先级最高                       │
│         → 必须先于其他修改提交                                   │
└─────────────────────────────────────────────────────────────────┘
```

### ImportError 修复策略

根据 Checkpoint 摘要的 `routes.ts` 和 `main.tsx` 分析：

**问题链路**：
```
main.tsx → mountApplication() 
         → ReactDOM.createRoot(rootElement).render(<App />)
         → App 组件（未在 Localization Report 中明确）
         → routes.ts (可能存在循环依赖)
```

**修复方案**：
1. 检查 `frontend/src/main.tsx` L43 的 `mountApplication()` 是否正确引用 App 组件
2. 检查 `frontend/src/app/routes.ts` L27 的 `ApprovalPage` 懒加载路径是否正确
3. 验证 `frontend/src/app/types/flow.ts` L128 的 `createFlowEdge()` 不引入循环 import

---

## 验收测试基准 (ATB)

### ATB-1: ImportError 修复验证

```bash
# 物理测试期待: 无 ImportError 报告
cd tests/sprint4
pytest test_deprecated_cleanup.py -v -k "import"

# 期待输出:
# test_deprecated_cleanup.py::test_module_imports PASSED
# 0 errors, 0 warnings
```

### ATB-2: 废弃接口扫描

```bash
# 物理测试期待: 无孤立调用报告
pytest tests/scan/test_dead_code.py -v -k "orphan_detection"

# 期待输出: 
# ===== 0 orphaned methods detected =====
```

### ATB-3: `_index_properties()` 清理验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 3.1 | `grep -rn "_index_properties" src/` | 返回空结果 |
| 3.2 | `python -m py_compile endless_daemon.py` | 编译成功，无 SyntaxError |
| 3.3 | `pytest tests/test_endless_daemon.py::test_index_properties_removed` | PASSED |

### ATB-4: Docstring 补全验证

```bash
# 物理测试期待: 所有公共方法均有 docstring
pylint endless_daemon.py --disable=all --enable=missing-docstring

# 期待输出:
# missing-docstring: 0
```

### ATB-5: `Toaster()` 组件审计

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 5.1 | `grep -r "Toaster" src/` | 列出所有引用点 |
| 5.2 | `grep -r "sonner" package.json` | 确认 sonner 依赖状态 |
| 5.3 | `npx tsc --noEmit` | TypeScript 编译通过 |

### ATB-6: AST 静态分析门禁

```bash
# 物理测试期待: 全部通过
bandit -r src/ --severity=medium --confidence=medium
ruff check src/ --select=E,F401,W503
mypy src/ --ignore-missing-imports

# 期待输出:
# No issues found.
```

---

## 开发切入层级序列

```
执行顺序层级图

  L1: ImportError 根因分析 ─────────────────────────────────────────┐
  │   读取 main.tsx L43, routes.ts L27, flow.ts L128              │
  │   绘制 import 依赖树                                             │
  │   定位循环引用或路径断裂点                                       │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
  L2: Call-Graph 静态分析 ─────────────────────────────────────────┐
  │   使用 pydeps 或 pycallgraph 绘制 endless_daemon.py 调用依赖树 │
  │   关键节点: _index_properties() 是否存在外部引用边              │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
  L3: ImportError 修复 ───────────────────────────────────────────┐
  │   修复 frontend/src/app/routes.ts 的 lazy import 路径          │
  │   修复 frontend/src/main.tsx 的 App 组件引用                   │
  │   验证 TypeScript 类型声明 (src/vite-env.d.ts)                  │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
  L4: 废弃接口移除 (按 Graphify EDGE 关系定向删除) ─────────────────┐
  │   确认 _index_properties() 无外部依赖边 → 安全删除              │
  │   更新 Graphify 知识图谱，移除该 NODE                           │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
  L5: Docstring 补全 ──────────────────────────────────────────────┐
  │   使用 pydocstyle 自动补全模板                                  │
  │   手动补充业务语义说明（参照 L380-L381 Graphify 标注）          │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
  L6: 验收门禁执行 ───────────────────────────────────────────────┐
  │   按 ATB-1 ~ ATB-6 顺序执行全部物理测试                        │
  │   全部 PASSED 后触发 plan.md 记账更新                          │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
```

### L1-L6 执行原则

| 层级 | 原则 |
|------|------|
| **L1** | 必须先于 L3 执行，确保 ImportError 根因明确后再修复 |
| **L2** | 可与 L1 并行执行，独立分析调用依赖 |
| **L3** | L1 完成后立即执行，解除阻塞 |
| **L4** | 可与 L3 并行执行（独立文件） |
| **L5** | 可与 L3/L4 并行执行（独立文件） |
| **L6** | 作为最终门禁，必须在所有修改 commit 后执行 |

---

## 精准修复指南

### 修复 `frontend/src/app/routes.ts` (L27)

**问题**：`ApprovalPage` 懒加载路径可能指向不存在的模块

**当前代码**：
```typescript
const ApprovalPage = () => import("./pages/approval/ApprovalPage");
```

**修复方案**：
```typescript
/**
 * Approval page lazy loading component
 * Route: /approval
 * 
 * @see {@link RoutePath.APPROVAL}
 */
const ApprovalPage = React.lazy(() => import("./pages/approval/ApprovalPage"));
```

### 修复 `frontend/src/main.tsx` (L43-56)

**问题**：`mountApplication()` 函数可能未正确处理 App 组件引用

**当前代码**：
```typescript
function mountApplication(): void {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    console.error("Root element not found. Application cannot mount.");
    return;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

**修复方案**：添加错误边界和 Suspense
```typescript
/**
 * Mount the React application to the DOM
 * 
 * @remarks
 * Uses React 18 createRoot API for concurrent mode support.
 * Wraps App in StrictMode for development best practices.
 * 
 * @throws {Error} If root element is not found
 * @see {@link https://react.dev/reference/react-dom/client/createRoot}
 * @see {@link https://react.dev/reference/react/StrictMode}
 */
function mountApplication(): void {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error(
      "Fatal: Root element 'root' not found in DOM. " +
      "Ensure index.html contains <div id='root'></div>"
    );
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <React.Suspense fallback={<div>Loading...</div>}>
        <App />
      </React.Suspense>
    </React.StrictMode>
  );
}

mountApplication();
```

---

## 强制归档要求

> ⚠️ **军律警告**：完成 L1-L6 全部层级后，**必须**执行以下记账操作：

### 记账流程

```bash
# 步骤 1: 进入项目根目录
cd $(git rev-parse --show-toplevel)

# 步骤 2: 定位 plan.md
vim docs/plan.md

# 步骤 3: 定位到 Sprint 4 Phase: cleanup-deprecation
# 添加完成标记：
[x] SWARM-103 遗留代码清理完成
    - AC-001: ✅ 静态分析通过
    - AC-002: ✅ Graphify 节点验证通过
    - AC-003: ✅ AST 语法检查通过
    - AC-004: ✅ Docstring 补全完成
    - AC-005: ✅ ImportError 修复完成
    - Iteration: 9
    - Completion: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 步骤 4: 提交记账变更
git add docs/plan.md
git commit -m "docs: update plan.md - SWARM-103 legacy cleanup completed

- Fix AC-005 ImportError in routes.ts and main.tsx
- Verify all AST static analysis passes
- Complete docstring coverage for public methods
- Iteration: 9

Closes: SWARM-103"
```

### 禁止行为

| 禁止项 | 说明 |
|--------|------|
| 🚫 代码写完不记账即退出 | 将导致任务验收失败 |
| 🚫 使用 --force 强制推送 | 破坏 Git 历史可追溯性 |
| 🚫 跳过 ATB-1 ~ ATB-6 任意步骤 | 必须全量验证 |
| 🚫 在 L6 失败后提交 | 必须全部 PASSED 才可 commit |

---

## AC 逐条验收矩阵

| AC ID | 描述 | 验证方法 | 状态 | 修复责任人 |
|-------|------|----------|------|-----------|
| AC-001 | User Task: SWARM-103 启动遗留代码清理与 AC 验收准备 | static_analysis | ✅ PASSED | - |
| AC-002 | 验证 Graphify 知识图谱节点 | static_analysis | ✅ PASSED | - |
| AC-003 | 代码变更不引入新的语法错误 | static_analysis | ✅ PASSED | - |
| AC-004 | 所有修改的函数包含 docstring | static_analysis | ✅ PASSED | - |
| AC-005 | 变更后的模块可被正常 import | unit_test | 🔴 FAILED | **Builder** |

### AC-005 修复验证命令

```bash
# 在执行修复后，运行以下命令验证 AC-005
cd tests/sprint4
pytest test_deprecated_cleanup.py::test_module_imports -v
pytest test_static_analysis.py::test_import_chain -v

# 期待输出:
# test_module_imports PASSED
# test_import_chain PASSED
```

---

## 工作区状态摘要

### 当前通过率

| 指标 | 数值 |
|------|------|
| 通过率 | 4/5 (80.0%) |
| 综合评分 | 0 |
| 阻塞项 | AC-005 ImportError |

### 需要 Builder 关注的问题

1. **🔴 CRITICAL**: AC-005 ImportError - 需修复 `frontend/src/app/routes.ts` 和 `frontend/src/main.tsx` 的导入链路
2. **⚠️ WARNING**: Checkpoint 摘要指出 `InventoryTaskMapper.java` 在 Java 层面的引用完整性需验证
3. **📋 PENDING**: 修复后需重新运行所有静态分析 + 单元测试组合，确保无副作用

---

## 参考文档

| 文档 | 路径 | 用途 |
|------|------|------|
| Graphify 知识图谱 | `src/endless_daemon.py` L380-381 | `_index_properties()` 节点定义 |
| Toaster 组件 | `docs/figma/.../sonner.tsx` L6 | UI 组件存续状态 |
| 路由配置 | `frontend/src/app/routes.ts` | React Router 懒加载配置 |
| 入口文件 | `frontend/src/main.tsx` | React 18 createRoot 挂载逻辑 |
| 流程类型 | `frontend/src/app/types/flow.ts` L128 | `createFlowEdge()` 边缘创建 |

---

**文档版本**: 1.0  
**创建时间**: Iteration-9  
**任务编号**: SWARM-103  
**状态**: 🔴 待修复 AC-005