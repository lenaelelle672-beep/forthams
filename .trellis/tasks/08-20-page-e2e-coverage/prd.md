# AppLayout 真页 Playwright 补测

## Goal

把 LOOP 未覆盖的 AppLayout 真页列表纳入 `src/e2e` mock 冒烟：认证后 heading 可见、无 pageerror。不换皮、不生成设计稿、不用 ui-replica。

## Background

- `core-routes-smoke` / `browser-smoke` 只锁 9 条路由（workbench 落地、资产/设备/盘点/闲置/处置/审批/分析）。
- `router/index.tsx` 还有退役、折旧、领用、借用、维保、检验、备件、保险、能耗、报表、系统管理等真页。
- 工作台菜单合同已在 `workbench-platform-entry.browser-regression-smoke.spec.ts`。本任务补 **AppLayout 直达路径**。

## Requirements

- R1 新增 `frontend/src/e2e/app-pages-smoke.spec.ts`，覆盖未在 core-routes 中的主要列表/仪表盘路径。
- R2 断言 `getByRole('heading')` 与源码硬编码 h1 / PageHeader title 一致；禁止 mock 抽屉文案。
- R3 `auth_token` + `user_info` 种子；`mockApi` 遵守 ECC：`/energy/dashboard` 对象、`/risk-assessments/matrix` 与 `/categories/tree` 数组，列表默认 `paged([])`。
- R4 禁止 `test.skip` 做绿；禁止改 `.env`；无新设计稿故不走 visual-design / ui-replica。
- R5 现有 browser/core/publish 冒烟不得变红。

## Acceptance Criteria

- [x] AC1 `npx playwright test src/e2e/app-pages-smoke.spec.ts src/e2e/login-error.spec.ts --workers=2` → 118 passed（超出原 47）。
- [x] AC2 覆盖退役、折旧、重估、预算、领用、借用、入库、采购、合同、维保/计划、备件、保险、检验、循环盘点、风险矩阵、能耗、GIS、许可证、审计、报表、通知、工作流、分类/厂商/供应商/位置、系统菜单/岗位/自定义字段。
- [x] AC3 无新增 skip；修了 `MaintenancePlanPage` 重复 import、`RetirementListPage` 列 key 冲突，以及数组 mock 形状。

## Out of scope

- 全站换皮、Grok Image、ui-replica、移动端 `/m`、login2–5、workbenchv3 默认入口。
- 表单提交/审批闭环（已有 approval/retirement-ui-loop）。
- git commit（用户已授权 LOOP 内 Phase 3.4 提交本任务文件）。
