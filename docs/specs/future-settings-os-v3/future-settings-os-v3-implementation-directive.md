# Future Settings OS v3 P0 实现指令

> 版本日期：2026-07-02  
> 指令角色：V3 后端管理前端实现的当前执行边界。后续上下文过大时，以本文档中的绝对路径、写入范围和验收口径恢复上下文。  
> 当前阶段：P0，先实现 `/fixed-assets/workbenchv3` 的顶部 6 类导航、左侧 44 项 IA 菜单、真实组件复用与建设中占位，不做权限控制，不动旧 Workbench。

## 1. 本轮目标

本轮全力推进 V3 后端管理壳的第一阶段可用骨架：

1. 在现有 V3 独立壳内补齐 **顶部导航 6 类**：流程平台、组织权限、基础资料、集成配置、消息与通知、系统参数。
2. 在左侧导航补齐 **44 个 IA 功能点**，切换顶部分类时只显示当前分类下的功能点。
3. 已登记真组件继续通过 `SystemPageHost activeMenu` 渲染。
4. 未登记真组件显示统一的“建设中 + 架构契约 + 后续接口”占位页，不跳回旧 Workbench。
5. 保持 Vector Engine 风格的浅蓝白玻璃后台壳、可折叠侧栏和 Inspector 交互方向。
6. 继续不做 `/fixed-assets/workbenchv3` 权限控制；权限后续专项处理。

## 2. 绝对路径：固化文档输入

| 文档 | 绝对路径 | 本轮用途 |
| --- | --- | --- |
| V3 扩展 PRD | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-expanded-prd.md` | 需求主基线。 |
| V3 后端设计方案 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-backend-design.md` | 后端契约、五链、风险与验收口径。 |
| V3 后端架构 IA | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-backend-architecture.md` | 顶部 6 类、左侧 44 项、35/9 边界的事实源。 |
| IA 主文档 | `/Users/feigao/project/Project/forthAMS/docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` | 44 项 / 6 组 single source of truth。 |
| V3 前端架构选型 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-frontend-architecture-selection.md` | 采用 V3 增强型 React/Vite 后台操作系统架构。 |
| V3 前端架构 HTML 演示 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-frontend-architecture-demo.html` | 可视化参考，不作为运行时代码依赖。 |
| V3 流程平台参考 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-process-platform-reference.md` | 流程平台 9 项的门户、设计、表单、监控分层。 |
| V3 流程引擎选型 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-workflow-engine-decision.md` | 短期不接外部引擎，继续 React Flow/Xyflow + forthAMS DSL + BPMN 兼容层。 |
| PRD 对比评分 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-prd-comparison-score.md` | NEW PRD 作为主基线的证据。 |
| V3 风格指南 | `/Users/feigao/project/Project/forthAMS/docs/workbench-v3-style-guide.md` | 视觉、路由、SystemPageHost、Inspector 和旧入口保护。 |

## 3. 绝对路径：本轮允许写入

| 类型 | 绝对路径 | 说明 |
| --- | --- | --- |
| V3 页面 | `/Users/feigao/project/Project/forthAMS/frontend/src/pages/workbench-v3/WorkbenchV3Page.tsx` | 主要实现文件。 |
| 合同测试 | `/Users/feigao/project/Project/forthAMS/frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts` | 先补红灯测试，再实现。 |
| 本指令文档 | `/Users/feigao/project/Project/forthAMS/docs/specs/future-settings-os-v3-implementation-directive.md` | 本轮执行边界与恢复上下文。 |

## 4. 禁止范围

- 不修改 `/Users/feigao/project/Project/forthAMS/frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx`。
- 不修改旧入口 `/fixed-assets/workbench`、旧默认跳转和旧 `WorkspacePreviewPage` base path。
- 不修改 `/Users/feigao/project/Project/forthAMS/frontend/src/pages/mobile/**`。
- 不修改 `/Users/feigao/project/Project/forthAMS/frontend/src/utils/routePermissions.ts`，本阶段仍不加 V3 route 权限。
- 不引入新前端框架，不整体迁移到 Next.js、TanStack Start、SvelteKit、Qwik、Astro 或微前端。
- 不接 Flowable、Camunda 或其他外部流程运行时引擎。
- 不复制或记录任何 password、token、secret、API key 原值。

## 5. P0 验收口径

1. 合同测试能证明 V3 页面包含 6 个顶部分类。
2. 合同测试能证明 V3 页面包含 44 个 IA 菜单 ID。
3. 合同测试能证明 V3 页面保留 `SystemPageHost activeMenu` 真组件复用。
4. 合同测试能证明未登记菜单有建设中占位能力。
5. 合同测试能证明 V3 未引入 route 权限规则且不引用旧 `WorkspacePreviewPage`。
6. V3 专项测试通过；构建通过或明确记录失败原因。
7. `gitnexus_detect_changes` 执行并记录结果；如果工作区已有大量脏改，需说明风险归因。
