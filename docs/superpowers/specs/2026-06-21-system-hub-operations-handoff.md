# 后台设置 / 资产运营中枢运营台式重排交接清单

## 目标

将后台设置里的资产运营中枢从展示型、多重卡片、信息嘈杂的页面，调整为更简洁、实用、易用的后台运营台。

重点场景：

- 人员约 7000+，不能依赖全量平铺展示。
- 部门约 200+，不能依赖全量平铺展示。
- 后台设置正式菜单 39 个，需要按导航页逐项检查。

## 已确认方案

采用 `A. 后台运营台式统一重排`。

原则：

- 搜索、筛选、分页、批量、保存、发布优先。
- 表格、树、列表、表单作为主承载。
- 审计、证据、预览、推荐、runbook 保留但降噪。
- 多重卡片改为薄边框、低阴影、紧凑行列表。
- 不碰移动端、不改后端 API、不增删菜单。

## 已改文件

实现相关：

- `frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx`
- `frontend/src/pages/workspace-preview/WorkspacePreviewPage.css`
- `frontend/src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts`

文档与证据相关：

- `docs/superpowers/specs/2026-06-21-system-hub-operations-redesign.md`
- `docs/superpowers/specs/2026-06-21-system-hub-operations-inspection-results.json`
- `docs/superpowers/specs/2026-06-21-system-hub-operations-verification-runbook.md`
- `docs/superpowers/specs/2026-06-21-system-hub-operations-url-checklist.md`
- `docs/superpowers/specs/2026-06-21-system-hub-operations-handoff.md`

## 实现摘要

TSX：

- 人员规模文案更新到 7000+ 量级。
- 部门规模文案更新到 200+ 量级。
- 部门树和组织权限页文案强调懒加载、命中节点、服务端分页语义。

CSS：

- 新增系统模式后台运营台骨架层。
- 覆盖 `admin-workbench / configurator / console / large-page` 四类后台页面形态。
- 统一 token、surface、navigation、data、state、accessibility 层。
- 降低卡片阴影、圆角和说明信息权重。
- 增强表格、树、日志、队列、ledger 的滚动承载。
- 补充关键控件 guardrails，避免搜索、筛选、分页、保存、发布、批量按钮被隐藏或截断。
- 保留审计、证据、推荐、runbook 信息，但限制高度、弱化视觉、允许滚动。

测试：

- 浏览器回归 smoke 中补充/调整了系统中枢相关断言和 218 部门预期。

## 已知权威来源

39 个正式后台设置菜单来自：

- `frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-usability-subpages-manifest.json`

该 manifest 共 40 条，其中：

- `system-hub-navigation-console` 是导航控制台。
- 其余 39 条为正式后台设置菜单。

正式分组：

- 组织权限 7
- 基础资料 6
- 流程平台 7
- 集成配置 5
- 消息与通知 8
- 系统参数 6

## 当前证据状态

已经具备：

- 设计方案文档。
- 真实 39 菜单清单。
- 逐页巡检 URL 清单。
- 机器可读巡检 JSON。
- 验证 runbook。

尚未具备：

- 当前构建结果。
- 当前系统中枢静态校验结果。
- 当前浏览器交互回归结果。
- 当前 39 页逐页巡检结果。
- 独立 reviewer/spec review 结果。

## 下一步命令

需要用户明确允许后运行：

```bash
npm --prefix frontend run build
npm --prefix frontend run verify:system-hub
npm --prefix frontend run verify:system-hub-interactions
```

命令结果需要回填：

- `docs/superpowers/specs/2026-06-21-system-hub-operations-inspection-results.json`

## 逐页巡检入口

使用：

- `docs/superpowers/specs/2026-06-21-system-hub-operations-url-checklist.md`

逐页结果回填：

- `docs/superpowers/specs/2026-06-21-system-hub-operations-inspection-results.json`

每页至少记录：

- 低噪声结构。
- 主操作首屏可见。
- 数据区可滚动或横向承载。
- 辅助信息未抢占主区。

## 失败修复策略

优先级：

1. 恢复关键控件可见性。
2. 收紧过宽 CSS 选择器。
3. 补局部 `min-width` / `min-height` / 单列布局。
4. 弱化辅助信息，而不是直接隐藏。
5. 对需要后端分页/API 的项标记范围外，不用 CSS 假装解决。

## 当前 GAI2 状态

- `classification`: Medium
- `scheduler`: gai2-orchestrator，由主线程执行
- `research`: skipped，本地 UI 改造，不依赖外部不稳定事实
- `subagents`: 未运行；当前工具策略要求用户明确授权 delegation/sub-agent
- `write_scope`: 后台预览 CSS、相关测试、spec 文档
- `verdict`: PARTIAL
- `gap_fingerprint`: system-hub-build-browser-inspection-missing

## 不能标记完成的原因

目标要求“每个导航页面看一下”，并且要证明页面更简洁、实用、易用。

当前虽然已完成设计、实现和证据模板，但还没有当前轮验证结果。没有构建、系统校验、浏览器回归和逐页巡检证据时，不能把目标标记 complete。
