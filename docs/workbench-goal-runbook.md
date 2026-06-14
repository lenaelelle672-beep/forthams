# Workbench Goal Runbook

Date: 2026-06-14
Branch: `codex/workbench-platform-entry`
Source blueprint: `docs/workbench-navigation-blueprint.md`

This runbook stores follow-up `/goal` directives so later runs can reference a stable file instead of copying long prompts.

## How To Use

Round 1:

```text
/goal 按 docs/workbench-goal-runbook.md 的 Round 1 执行。必须先读取 docs/workbench-navigation-blueprint.md 和本 runbook，只执行 Round 1，不执行 Round 2。
```

Round 2:

```text
/goal 按 docs/workbench-goal-runbook.md 的 Round 2 执行。必须先读取 docs/workbench-navigation-blueprint.md 和本 runbook，只执行 Round 2，不回头重做 Round 1 已完成内容。
```

## Global Rules

These rules apply to every round.

1. Keep the existing Workbench shell, top bar, left navigation, four top tabs, route structure, and confirmed light-blue B-end visual system.
2. Do not rebuild the Workbench shell. Only improve the content area, action flows, states, assets, and evidence.
3. Do not touch `frontend/src/pages/mobile/**` or mobile routes.
4. Do not add duplicate first-level menus such as `报表大屏`, `平台配置`, or `维保计划`.
5. Do not use contact sheets, asset boards, login images, or static posters as page bodies.
6. New integrated pages must be designed through IMAGE2 assets plus Stitch page-level screens before React landing.
7. Every implemented page must support create/launch, search/filter, display/list, open detail, edit/maintain, no-permission feedback, empty/error states, and dangerous-action disabled or confirmation behavior.
8. Reuse existing business routes and APIs as real landings after Workbench preview/drawer interactions. Do not duplicate existing CRUD modules inside Workbench.
9. Do not output, search for, reuse, or commit token/key/password/secret values.
10. Before editing functions, classes, or methods, follow `AGENTS.md` and run GitNexus impact analysis.
11. Before committing, run `gitnexus_detect_changes(scope=staged)`.
12. Every round must end with `PASS`, `PARTIAL`, or `FAIL`, with evidence and remaining gaps.

## Round 1

Goal name:

```text
forthAMS Workbench P0 产品页落地冲刺
```

Objective:

Build the first batch of five high-priority Workbench content-area product pages from `docs/workbench-navigation-blueprint.md`. This round must prove the full method: IMAGE2 asset, Stitch page-level design, React content-area landing, operation flow, browser verification, and tests.

In scope:

1. 流程待办
2. 设备管理
3. 工单管理
4. 报表分析
5. 告警中心

Out of scope:

1. Reworking the Workbench shell, top bar, left nav, four top tabs, route shell, or global platform entry.
2. Touching mobile pages/routes.
3. Implementing all 12 menus.
4. Docs-only, manifest-only, test-only, or contract-only submissions.

Required sequence:

1. Read `docs/workbench-navigation-blueprint.md`.
2. Audit current Workbench implementation for the five P0 menus.
3. Define the five page-level information architectures and operation flows.
4. Generate or organize IMAGE2 assets under `frontend/public/mock/workspace-preview/asset-kit-v6/`.
5. Required module assets:
   - `module-flow-todo-console.png`
   - `module-device-ops-console.png`
   - `module-workorder-dispatch-console.png`
   - `module-report-analysis-console.png`
   - `module-alert-center-console.png`
6. Add needed detail assets, for example:
   - `todo-approval-flow-v1.png`
   - `device-telemetry-v1.png`
   - `report-export-lineage-v1.png`
   - `spare-maintenance-link-v1.png`
7. Use Stitch to generate page-level screens. If Stitch MCP returns `Auth required`, try:
   - `npm run stitch:auth`
   - `npm run stitch:projects`
   - `npm run stitch:proxy-check`
8. Record Stitch evidence or the exact auth blocker without secrets.
9. Update manifest mapping so each P0 menu maps to its IMAGE2 and Stitch evidence.
10. Implement React content-area components only inside existing Workbench structure.
11. Each page must include:
    - page title and business positioning
    - IMAGE2 visual integrated into the operation layout
    - operation console
    - filters/search
    - processable queue or list
    - detail drawer
    - create/launch action
    - edit/maintain action
    - empty state
    - error state
    - no-permission state
    - dangerous action disabled or confirmation behavior
12. Browser-verify these routes:
    - `/fixed-assets/workbench?menu=todo`
    - `/fixed-assets/workbench/assets?menu=device`
    - `/fixed-assets/workbench/assets?menu=orders`
    - `/fixed-assets/workbench/analytics?menu=report`
    - `/fixed-assets/workbench/security?menu=alarm`
13. Run targeted Workbench tests, browser regression, `npm run build`, and `gitnexus_detect_changes(scope=staged)`.
14. Commit and push to `origin/codex/workbench-platform-entry`.

Expected commit message:

```text
Build workbench P0 product pages
```

Round 1 closeout must include:

1. Verdict: `PASS`, `PARTIAL`, or `FAIL`.
2. Completed pages.
3. IMAGE2 assets.
4. Stitch status and evidence.
5. React files.
6. Browser verification paths.
7. Test/build/GitNexus results.
8. Remaining gaps.
9. Round 2 recommendation.

## Round 2

Goal name:

```text
forthAMS Workbench 剩余菜单与深层业务模块补全
```

Objective:

After Round 1 has established the product-page method, complete the remaining Workbench menus and deeper operational modules from `docs/workbench-navigation-blueprint.md`. Do not restart completed Round 1 pages unless a defect blocks integration.

In scope:

Remaining formal menus:

1. 运营首页
2. 资产总览
3. 巡检管理
4. 备件管理
5. 数据监控
6. 组织策略
7. 基础维护

Deepened operational modules:

1. 资产处置发起台
2. 使用流转工作台
3. 批量数据操作中心
4. 配置治理中心
5. 预测维保与备件保障

Required sequence:

1. Read `docs/workbench-navigation-blueprint.md`.
2. Inspect Round 1 closeout and do not redo completed evidence.
3. Define menu-level gaps for the remaining seven menus.
4. Define embedded module placement so no new first-level menus are added.
5. Generate or organize remaining IMAGE2 `asset-kit-v6` module/detail assets.
6. Required detail candidates:
   - `disposal-approval-chain-v1.png`
   - `usage-flow-return-v1.png`
   - `config-governance-v1.png`
   - `spare-maintenance-link-v1.png`
7. Generate Stitch page-level screens or embedded module screens for remaining menus/modules.
8. Land React content-area improvements without changing the Workbench shell.
9. Expand browser regression to all 12 formal menus.
10. Add or update tests/contracts so 12 menus have:
    - operation matrix
    - IMAGE2 asset mapping
    - Stitch evidence or auth-blocker record
    - empty/error/no-permission states
    - real business landing routes
11. Run targeted Workbench tests, browser regression, `npm run build`, and `gitnexus_detect_changes(scope=staged)`.
12. Commit and push to `origin/codex/workbench-platform-entry`.

Expected commit message:

```text
Complete workbench remaining product modules
```

Round 2 closeout must include:

1. Verdict: `PASS`, `PARTIAL`, or `FAIL`.
2. Completed remaining menus.
3. Completed deep modules.
4. IMAGE2 assets.
5. Stitch evidence.
6. React files.
7. 12-menu browser verification.
8. Test/build/GitNexus results.
9. Remaining product or visual gaps.
10. Recommendation for final polish or release review.

## Final Readiness Gate

The Workbench product-page effort is not complete until all of the following are true:

1. All 12 formal menus have Workbench-native content, not just route references.
2. All priority and remaining pages have IMAGE2/Stitch evidence or a documented, accepted Stitch auth blocker.
3. Browser regression covers all 12 menu routes.
4. No duplicate first-level menus are added.
5. `/dashboard` remains a legacy transition route.
6. `/workspace-preview` remains public design/demo preview only.
7. Mobile files remain untouched.
8. Sensitive-value scan is clean.
9. Build and targeted tests pass.
10. GitNexus staged change audit reports expected scope before each commit.
