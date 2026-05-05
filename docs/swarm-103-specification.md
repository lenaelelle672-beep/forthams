# SWARM-103 遗留代码清理与 AC 验收准备 - 规格指导文档

## 需求与背景

| 维度 | 说明 |
|------|------|
| **任务编号** | SWARM-103 |
| **Iteration** | 9 |
| **任务类型** | 遗留代码清理 + Sprint 4 收尾验收 |
| **核心目标** | 移除废弃接口、补全 docstring、通过 AST 静态分析验证 |
| **涉及文件** | `endless_daemon.py` (L380-381), `sonner.tsx` (L6) |
| **Graphify 图谱线索** | `._index_properties()` 节点索引方法、`Toaster()` UI 组件存续状态待验证 |

**技术债务现状**：
- `endless_daemon.py` 中 `_index_properties()` 方法标注为"Index node properties for fast lookup"，需确认是否仍被调用
- `sonner.tsx` 中 `Toaster()` 组件位于 Figma 文档引用路径，React 组件生命周期状态需审计

**当前 AC 状态**：
| AC 编号 | 描述 | 状态 |
|---------|------|------|
| AC-001 | User Task: 遗留代码清理与 AC 验收准备 | ✅ 通过 |
| AC-002 | Graphify 知识图谱节点验证 | ✅ 通过 |
| AC-003 | AST 静态检查通过 | ✅ 通过 |
| AC-004 | Docstring 文档注释 | ✅ 通过 |
| AC-005 | 模块正常 import | ❌ **阻塞中** |

---

## 当前 Phase 对应实施目标

参照 Sprint 4 收尾验收阶段（Phase: `cleanup-deprecation`）：

| 子任务 | 对应 Phase | 优先级 | 状态 |
|--------|-----------|--------|------|
| T-1: 扫描废弃接口调用链 | Phase-1 废弃接口识别 | P0 | ✅ 完成 |
| T-2: 移除 `_index_properties()` 孤立调用 | Phase-2 清理执行 | P0 | ✅ 完成 |
| T-3: 补全 `endless_daemon.py` 所有公共方法 docstring | Phase-3 Docstring 补全 | P1 | ✅ 完成 |
| T-4: 审计 `Toaster()` 组件引用完整性 | Phase-3 组件健康检查 | P1 | ⏳ 待验证 |
| T-5: AST 静态分析通过验证 | Phase-4 验收门禁 | P0 | ✅ 通过 |
| T-6: **修复 AC-005 ImportError** | Phase-4 验收门禁 | P0 | 🔴 **进行中** |

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
└── 约束 C7: 修复 ImportError 时优先检查路由配置和入口文件
```

**图谱约束**：
- `._index_properties()` 属于 internal implementation，不暴露为 public API
- `Toaster()` 属于 UI 组件，community=38，需确认是否属于 deprecated UI stack

---

## AC-005 ImportError 修复指南

### 错误定位

根据 AC 验证报告，变更后的模块在 import 时存在导入路径或循环依赖问题。

**疑似问题文件**：
1. `frontend/src/app/routes.ts` - 路由配置中的 lazy loading 路径
2. `frontend/src/main.tsx` - 入口文件中的 mountApplication 函数

### 修复方案

#### 方案 A: 检查路由懒加载路径

```typescript
// frontend/src/app/routes.ts (L27)
const ApprovalPage = () => import("./pages/approval/ApprovalPage");
// 确保 "./pages/approval/ApprovalPage" 文件存在
```

#### 方案 B: 检查主入口 mountApplication

```typescript
// frontend/src/main.tsx (L43)
function mountApplication(): void {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found. Application cannot mount.");
    return;
  }
  // 验证 App 组件可以正常渲染
}
```

#### 方案 C: 验证循环依赖

检查是否存在模块间的循环引用：
```bash
# 检查循环依赖
npx madge --circular src/app/routes.ts
```

---

## 验收测试基准 (ATB)

### ATB-1: 废弃接口扫描

```bash
# 物理测试期待: 无孤立调用报告
pytest tests/sprint4/test_deprecated_cleanup.py -v -k "orphan_detection"
# 期待输出: 0 orphaned methods detected
```

### ATB-2: `_index_properties()` 清理验证

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 2.1 | `grep -rn "_index_properties" src/` | 返回空结果 |
| 2.2 | `python -m py_compile endless_daemon.py` | 编译成功，无 SyntaxError |
| 2.3 | `pytest tests/sprint4/test_deprecated_cleanup.py::test_index_properties_removed` | PASSED |

### ATB-3: Docstring 补全验证

```bash
# 物理测试期待: 所有公共方法均有 docstring
pylint endless_daemon.py --disable=all --enable=missing-docstring | grep -c "missing-docstring"
# 期待输出: 0
```

### ATB-4: `Toaster()` 组件审计

| 步骤 | 操作 | 物理测试期待 |
|------|------|-------------|
| 4.1 | `grep -r "Toaster" src/` | 列出所有引用点 |
| 4.2 | `grep -r "sonner" package.json` | 确认 sonner 依赖状态 |
| 4.3 | `npx tsc --noEmit` | TypeScript 编译通过 |

### ATB-5: AST 静态分析门禁

```bash
# 物理测试期待: 全部通过
bandit -r src/ --severity=medium --confidence=medium
ruff check src/ --select=E,F401,W503
mypy src/ --ignore-missing-imports

# 全部期待: 0 issues found
```

### ATB-6: AC-005 ImportError 验证

```bash
# 物理测试期待: 无 ImportError
python -c "from frontend.src.app.routes import router"
npx tsc --noEmit --project frontend/tsconfig.json

# 期待输出: 无错误输出
```

---

## 开发切入层级序列

```
层级序列 (L1 → L2 → L3 → L4 → L5 → L6)
│
├─ L1: 图谱依赖分析
│   └─ 读取 Graphify 知识图谱，确认 ._index_properties() 和 Toaster() 的 community 归属
│
├─ L2: Call-Graph 静态分析
│   └─ 使用 pydeps 或 pycallgraph 绘制 endless_daemon.py 的调用依赖树
│   └─ 关键节点: _index_properties() 是否存在外部引用边
│
├─ L3: 废弃接口移除 (按 Graphify EDGE 关系定向删除)
│   └─ 若 _index_properties() 无外部依赖边 → 安全删除
│   └─ 更新 Graphify 知识图谱，移除该 NODE
│
├─ L4: Docstring 补全
│   └─ 使用 pydocstyle 自动补全模板
│   └─ 手动补充业务语义说明（参照 L380-L381 的 Graphify 标注）
│
├─ L5: 组件引用审计
│   └─ 验证 Toaster() 组件的所有引用点
│   └─ 确认 package.json 依赖一致性
│
└─ L6: 验收门禁执行
    └─ 按 ATB-1 ~ ATB-6 顺序执行全部物理测试
    └─ 全部 PASSED 后触发 plan.md 记账更新
```

**执行顺序原则**：
- L1 必须先于 L3 执行，确保 Graphify 图谱数据一致性
- L4 可与 L3 并行执行（独立文件）
- L6 作为最终门禁，必须在所有修改 commit 后执行
- **优先修复 AC-005**，否则无法完成 Sprint 4 验收

---

## 核心业务流入口分析

根据 Localization Report，提供以下核心入口点供参考：

| 文件路径 | 函数/类 | 行号 | 用途 |
|----------|---------|------|------|
| `frontend/src/app/routes.ts` | `ApprovalPage` (lazy load) | L27 | 审批页面路由 |
| `frontend/src/app/routes.ts` | `createAppRouter()` | L179 | 路由工厂函数 |
| `frontend/src/app/routes.ts` | `router` | L188 | 默认路由导出 (deprecated) |
| `frontend/src/app/types/flow.ts` | `createFlowEdge()` | L128 | 流程边创建 |
| `frontend/src/main.tsx` | `mountApplication()` | L43 | 应用挂载入口 |
| `tests/sprint4/test_deprecated_cleanup.py` | `get_target_methods()` | L65 | 目标方法元数据获取 |

---

## 强制归档要求

> ⚠️ **军律警告**：完成 L1-L6 全部层级后，**必须**执行以下记账操作：
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

## 后续行动项

| 优先级 | 行动项 | 负责人 | 截止日期 |
|--------|--------|--------|----------|
| P0 | 定位并修复 AC-005 ImportError | Builder | Iteration-9 |
| P1 | 完成 Toaster() 组件引用审计 | Builder | Iteration-9 |
| P2 | 更新 Graphify 知识图谱元数据 | Owner | Iteration-9 |
| P3 | 执行全量回归测试 | QA | Iteration-9 |

---

*文档生成时间: Iteration-9*
*版本: v1.0*
*状态: 🔴 进行中 (AC-005 阻塞)*