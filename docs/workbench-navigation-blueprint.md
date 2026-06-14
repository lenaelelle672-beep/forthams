# Workbench Navigation Blueprint

Date: 2026-06-14
Branch: `codex/workbench-platform-entry`
Scope: navigation, capability, gap, and delivery blueprint only. No React implementation in this round.

## Directive

This blueprint recalibrates the forthAMS Workbench formal-entry work. The existing Workbench shell, top navigation, left navigation, four top tabs, and confirmed light-blue B-end visual system stay in place. Future work should improve them, not restart them.

New integrated pages and functions must be designed as real Workbench content-area experiences with IMAGE2 and Stitch page-level design artifacts before React implementation. They must not be reduced to route lists, detached contact sheets, static posters, or isolated demo pages.

Product navigation decision: the four top tabs are independent platform scene views, not one-to-one mappings of the left navigation. The left navigation is the formal business first-level menu set; deeper capabilities such as create, query, detail, dispatch, export, subscription, approval, and maintenance should appear as second-level pages, embedded modules, or drawers under the relevant left-nav menu.

## Evidence Sources

| Evidence | Path |
| --- | --- |
| Workbench formal routes and legacy dashboard transition | `frontend/src/router/index.tsx` |
| Existing Workbench shell, menu model, route targets, action drawer, CRUD matrix | `frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx` |
| Existing Workbench visual system and shell layout | `frontend/src/pages/workspace-preview/WorkspacePreviewPage.css` |
| Desktop global navigation ordering | `frontend/src/layouts/AppLayout.tsx` |
| Route permission model | `frontend/src/utils/routePermissions.ts` |
| Existing dashboard page capabilities | `frontend/src/pages/dashboard/DashboardPage.tsx` |
| Dashboard API calls | `frontend/src/api/asset.ts` |
| Work order API capabilities | `frontend/src/api/workorder.ts` |
| Backend dashboard permission and API endpoints | `backend/src/main/java/com/ams/controller/DashboardController.java` |
| Backend Workbench menu seed | `backend/src/main/resources/migration/V2_84__workbench_platform_menu_entry.sql` |
| Existing Workbench entry matrix | `docs/workbench-platform-entry-matrix.md` |
| Current Stitch/IMAGE2 manifest | `frontend/public/mock/workspace-preview/stitch-suite/delivery-manifest.json` |
| Existing Workbench contract tests | `frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts` |
| Existing visual asset contract tests | `frontend/src/__tests__/workbenchVisualAssetContract.test.ts` |
| Existing browser regression smoke | `frontend/src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts` |

## Non-Movable Boundaries

| Area | Boundary | Allowed improvement |
| --- | --- | --- |
| Formal entry | Workbench remains the formal fixed-asset platform entry at `/fixed-assets/workbench*`. `/dashboard` remains a legacy transition route only. | Clarify text, empty states, and permission feedback. |
| Public preview | `/workspace-preview` remains public design/demo preview only. It is not the formal business entry. | Improve design governance and artifact review only. |
| Global nav | `资产运营中枢` stays before `旧版仪表板` in the global overview group. | Minor icon or wording polish only. |
| Workbench shell | Existing dark brand/top bar, left navigation, context strip, and light-blue B-end layout stay. | Improve density, hover/focus, responsive behavior, and microstructure. |
| Top tabs | Keep `智能制造总览`, `数据监控中心`, `资产运维中心`, `安全态势工作台` as independent scene views. Do not replace these approved main pages with left-menu product pages. | Improve only when necessary to expose entry points or context. |
| Left nav | Keep the 12 formal business menus below. Do not add duplicate first-level menus. | Add second-level pages, embedded modules, quick actions, drawers, and state handling inside content. |
| Formal/preview split | The formal route must not expose `设计稿` or Stitch production workflow. | Formal content may consume final IMAGE2/Stitch assets and evidence. |
| Permissions | Do not bypass `ProtectedRoute`, `canAccessRoute`, or route-level permission rules. | Add Workbench-internal button/menu permission matrix where useful. |
| Mobile scope | Do not touch `frontend/src/pages/mobile/**` or mobile routes. | None in this round. |

Explicitly excluded first-level menus: `报表大屏`, `平台配置`, `维保计划`.

## Navigation Finalization

The formal Workbench left navigation is fixed at 12 business menus:

1. 运营首页
2. 流程待办
3. 资产总览
4. 设备管理
5. 工单管理
6. 巡检管理
7. 备件管理
8. 数据监控
9. 报表分析
10. 告警中心
11. 组织策略
12. 基础维护

`设计稿` may exist only in preview/governance contexts and must not appear as a formal Workbench business menu.

## Dashboard Capability Migration

The legacy `/dashboard` page is not the target experience, but it is a factual source for what Workbench must carry.

| `/dashboard` capability | Existing fact | Workbench destination | Design implication |
| --- | --- | --- | --- |
| KPI cards | Total assets, in-use assets, idle assets, pending approvals. | 运营首页, 资产总览, 流程待办 | KPI must be clickable or explain its target filter, not just display numbers. |
| Asset value trend | 12-month total/net value trend chart. | 报表分析, 运营首页 | Provide report preview, export/subscription actions, and metric lineage. |
| Category distribution | Asset category pie/donut. | 资产总览, 报表分析 | Link category slices to filtered asset list/report context. |
| Recent work orders | Work order table with row click and "view all". | 工单管理, 流程待办 | Show status/SLA queue and detail drawer before jumping. |
| Maintenance warnings | Warning list and "view all" asset status filter. | 流程待办, 设备管理, 工单管理, 告警中心 | Convert warnings into actionable repair/inspection/work-order flows. |
| Department asset stats | Top department asset counts. | 报表分析, 基础维护 | Support report filters and organization/config review. |
| Export data | CSV export for KPI, trend, department, category. | 报表分析, 批量数据操作中心 | Provide export format, filters, permission state, and export history. |
| Refresh view | React Query invalidation. | 运营首页, data-bearing pages | Add visible refresh/loading/error behavior per page. |

## Existing Business Capability Facts

| Capability area | Existing capability | Workbench design use |
| --- | --- | --- |
| Asset ledger | Asset list, detail, create, edit, delete, timeline, depreciation schedule, attachments, import/export exist through asset pages/APIs. | 资产总览 keeps its position; add quick filters, side drawer, new asset entry, edit/maintenance actions, and dangerous-operation confirmation. |
| Approval center | Approval list, detail, pending filter, approve/reject/cancel paths exist. | 流程待办 must become a mixed approval queue, not only a link to `/approvals`. |
| Work orders | Work order create/detail/update/delete, submit/approve/reject/cancel, hold/resume, acceptance APIs exist. | 工单管理 should present prediction, dispatch, execution, acceptance, and closed-loop states. |
| Asset disposal | Transfer, clearance, scrap, and approval-driven disposal flows exist. | Add an asset-disposal launch desk as an integrated Workbench module. |
| Retirement | Draft, submit, approve, reject, complete, cancel, history, and statistics exist. | Include retirement and scrap approval queues in disposal/workflow views. |
| Assignment/borrow | Assignment, borrow, return, approval, reject, lend-out, cancel flows exist. | Add a usage-flow workspace for assignment, borrow, return, idle claim, and due-date queues. |
| Idle assets | Publish, claim, approve/reject claim, cancel, and delete exist. | Fold into usage-flow or asset operations as an actionable adjustment queue. |
| Import/export | Import parsing, preview, error handling, confirmation, template download, and export filters exist. | Add a batch data operations center with error-row repair and export history. |
| Reports | Summary/category/trend/depreciation/maintenance/retirement reports and PDF export exist. | 报表分析 should support template selection, subscription, export, lineage, and retry. |
| Maintenance/spares | Maintenance records/plans and spare-part inventory/low-stock/work-order links exist. | Add predictive maintenance and spare-parts support content with risk-to-work-order flow. |
| Config/governance | Asset models, categories, settings, risk matrix, system roles, org data, vendors, and locations exist. | 基础维护 and 组织策略 should present configuration health and role/permission-aware actions. |
| Permissions | Workbench is protected by `dashboard:query` or `asset:ledger:query`; business routes have finer permissions. | Every new Workbench module needs no-permission and disabled-action states. |

## 12-Menu Page And Function Matrix

| Menu | Preserve existing | New design requirement | Operations to expose | True capability landing | Gap priority |
| --- | --- | --- | --- | --- | --- |
| 运营首页 | Keep existing Workbench home, four-center overview, shell, and style. | Do not restart the page; add operation-ready cards and dashboard KPI migration. | KPI drilldown, quick launch, refresh/loading/error, pending summary. | Workbench sections, `/dashboard` as legacy reference, `/assets`, `/reports`. | P1 |
| 流程待办 | Keep current menu and route semantics. | Redesign as mixed approval/work-order/inspection/spare queue. | Pending approval, dispatch, SLA sort, batch handling, detail drawer, approve/reject preview. | `/approvals`, `/approvals/:id`, `/workorders/new`, `/maintenance`. | P0 |
| 资产总览 | Keep confirmed asset overview position and visual direction. | Add asset operation drawer and quick-open detail rather than replacing the page. | Filter list, open detail, new asset, edit, risk work order, dangerous-operation confirmation. | `/assets`, `/assets/new`, `/assets/:id`, `/assets/:id/edit`, `/asset-health`. | P0 |
| 设备管理 | Keep as Workbench asset-operations menu, no duplicate first-level page. | Redesign content as device operations console. | Online/temperature/vibration/location filters, telemetry panel, abnormal device queue, work-order/inspection launch. | `/equipment`, `/workorders/new`, `/inspections/new`. | P0 |
| 工单管理 | Keep within asset operations; do not create duplicate first-level nav. | Redesign predictive maintenance closed-loop page. | New work order, search/filter, open detail, dispatch, acceptance, hold/resume, disabled dangerous action. | `/workorders/new`, `/workorders/:id`, `/workorders/:id/acceptance`, `/disposals` where list redirect applies. | P0 |
| 巡检管理 | Keep existing menu. | Redesign inspection route/point/exception page. | Generate inspection, execute checklist, upload evidence, abnormal item reassignment, detail drawer. | `/inspections/new`, `/inspections/:id`, `/inspections/:id/upload`, `/safety-checklists/execute`. | P1 |
| 备件管理 | Keep existing menu. | Redesign low-stock and spare support page. | Low-stock filter, request spare, supplier ETA, related work order, cost writeback. | `/spare-parts`, `/spare-parts/new`, `/spare-parts/:id`, `/maintenance`. | P1 |
| 数据监控 | Keep analytics tab and data-monitoring concept. | Redesign MES/IoT chain and anomaly operations area. | Link status, latency, anomaly subscription, open event, alert/work-order linkage. | `/energy`, `/notifications`, `/reports`. | P1 |
| 报表分析 | Keep as report module, not report big-screen. | Redesign business report operations page. | Template selection, trend/category/dept reports, export, subscription, failure retry, audit lineage. | `/reports`, `/reports/scheduled`, `/report-builder`. | P0 |
| 告警中心 | Keep security/workbench menu. | Redesign as alert queue, not big-screen map. | Severity filter, strategy hit, recommendation, transfer to work order, review drawer. | `/notifications`, `/workorders/new`, `/risk-matrix`. | P1 |
| 组织策略 | Keep governance module. | Redesign risk-rule and approval-boundary workspace. | Rule review, threshold edit entry, role policy, high-risk approval boundary. | `/risk-matrix`, `/risk-assessments/new`, `/system/roles`. | P1 |
| 基础维护 | Keep as base maintenance, not platform configuration. | Redesign config governance and base-data health page. | System config, categories, models, vendors, locations, integration source, no-permission state. | `/settings/sysconfig`, `/categories`, `/asset-models`, `/vendors`, `/locations`, `/system/*`. | P1 |

## New Or Deepened Workbench Modules

These modules should be designed in the Workbench content area. They should not become new first-level menus unless a later product decision explicitly changes the IA.

| Module | Purpose | Suggested menu placement | Why it matters |
| --- | --- | --- | --- |
| 流程待办 / 审批处理队列 | Unified pending approval, work-order, inspection, disposal, retirement, and spare low-stock queue. | 流程待办 | Highest leverage for daily work and operational action. |
| 资产处置发起台 | Transfer, clearance, scrap, retirement, approval-chain preview, and validation. | 资产总览, 工单管理, 流程待办 | Existing disposal/retirement capabilities need a practical launch point. |
| 使用流转工作台 | Assignment, borrow, return, idle claim, due reminders, and approval actions. | 资产总览 or 流程待办 as a second-level block | Existing assignment/borrow/idle flows are not visible in the 12-menu first level. |
| 批量数据操作中心 | Import parsing, error-row repair, confirmation, export filters, and export history. | 报表分析 or 资产总览 | Turns import/export from a buried route into an operational tool. |
| 配置治理中心 | Categories, models, settings, risk policies, org/role constraints, and no-permission state. | 基础维护, 组织策略 | Makes governance usable without adding `平台配置`. |
| 预测维保与备件保障 | Risk asset to work order, low-stock spare linkage, maintenance execution, acceptance, cost writeback. | 工单管理, 备件管理, 设备管理 | Connects Dashboard warnings to real maintenance action. |

## Current Gaps

| Priority | Gap | Impact | Required repair |
| --- | --- | --- | --- |
| P0 | 12 menus do not all have page-level IMAGE2 + Stitch evidence. | The product suite cannot be accepted as a complete Workbench page set. | Either produce one Stitch page per menu or explicitly define and test a "4 top pages + 12 menu states" acceptance model. |
| P0 | Stitch MCP direct access still records `Auth required`. | New page-generation evidence may not be reproducible through the current MCP tool path. | Restore Stitch auth or use the documented OAuth/proxy path with retrievable screen/export evidence. |
| P0 | Some menu conclusions still read as route references. | Risks repeating the previous "path list instead of product page" failure. | Each menu needs Workbench-native operation content, IMAGE2 asset, Stitch screen, state model, and then real route landing. |
| P1 | Browser regression covers only 5 page-level CRUD matrices. | 12-menu completion is not fully proven. | Extend browser smoke to all 12 menus and include operation matrix checks. |
| P1 | 运营首页 operation behavior is under-proven. | Home can still look like a passive dashboard. | Add home quick-action, drilldown, empty/error/no-permission checks. |
| P1 | State handling is mostly text matrix. | Empty/error/no-permission may not be real enough for operation UX. | Add triggerable or mockable states per menu. |
| P1 | Workbench-internal permissions are coarse. | Users may see actions they cannot perform until route-level denial. | Add button-level permission matrix and disabled feedback. |
| P1 | Backend menu seed only creates the main Workbench entry. | Formal admin menu governance for 12 internal menus is ambiguous. | Decide whether 12 menus are frontend-internal or need sys_menu child entries. |
| P2 | Screenshot evidence is fragmented between temp files and committed QA shots. | Final proof is hard to audit. | Create a final screenshot evidence index and commit only canonical screenshots. |
| P2 | IMAGE2 map is package-level, not menu-level. | It is unclear which asset proves each menu. | Add 12-menu asset map with module/detail/stitch/screenshot columns. |
| P2 | Final fidelity is still marked partial in manifest. | Visual readiness is not fully signed off. | Run final visual audit for icons, card microstructure, overflow, focus, and broken assets. |

## IMAGE2 Asset Plan

New assets should live under `frontend/public/mock/workspace-preview/asset-kit-v6/` in later implementation rounds.

| Asset | Size target | Use |
| --- | --- | --- |
| `asset-kit-v6/modules/module-flow-todo-console.png` | 1024x640 | 流程待办 operation module, queue and SLA node visual. |
| `asset-kit-v6/modules/module-device-ops-console.png` | 1024x640 | 设备管理 online, telemetry, temperature/vibration visual. |
| `asset-kit-v6/modules/module-workorder-dispatch-console.png` | 1024x640 | 工单管理 prediction-dispatch-execution-acceptance visual. |
| `asset-kit-v6/modules/module-report-analysis-console.png` | 1024x640 | 报表分析 trend/export/subscription/audit visual. |
| `asset-kit-v6/modules/module-alert-center-console.png` | 1024x640 | 告警中心 severity, recommendation, and work-order linkage visual. |
| `asset-kit-v6/details/todo-approval-flow-v1.png` | 1254x1254 | Approval drawer and process-node detail visual. |
| `asset-kit-v6/details/device-telemetry-v1.png` | 1254x1254 | Device telemetry detail drawer visual. |
| `asset-kit-v6/details/report-export-lineage-v1.png` | 1254x1254 | Report data lineage/export detail visual. |
| `asset-kit-v6/details/disposal-approval-chain-v1.png` | 1254x1254 | Asset disposal approval-chain detail visual. |
| `asset-kit-v6/details/usage-flow-return-v1.png` | 1254x1254 | Assignment/borrow/return detail visual. |
| `asset-kit-v6/details/config-governance-v1.png` | 1254x1254 | Base maintenance and governance detail visual. |
| `asset-kit-v6/details/spare-maintenance-link-v1.png` | 1254x1254 | Predictive maintenance and spare support detail visual. |

IMAGE2 rules:

- Use blue-white industrial precision styling, not a marketing hero or poster.
- Keep imagery secondary to lists, filters, state cards, and actions.
- Every asset must have a concrete Workbench menu, page section, and UI purpose.
- Contact sheets and visual boards are governance evidence only, never page bodies.
- Login or factory hero images are out of scope for Workbench page content.

## Stitch Page Plan

Stitch must generate page-level designs, not detached asset sheets.

| Stitch screen | Required content | Primary Workbench route |
| --- | --- | --- |
| `workbench-menu-todo-v1` | Mixed queue, filters, SLA ranking, operation drawer, empty/error/no-permission states. | `/fixed-assets/workbench?menu=todo` |
| `workbench-menu-device-v1` | Device table, telemetry panel, anomaly queue, work-order/inspection actions. | `/fixed-assets/workbench/assets?menu=device` |
| `workbench-menu-orders-v1` | Work-order status lanes, list, dispatch/detail/acceptance drawer. | `/fixed-assets/workbench/assets?menu=orders` |
| `workbench-menu-report-v1` | Report templates, trend preview, export/subscription drawer, failure retry. | `/fixed-assets/workbench/analytics?menu=report` |
| `workbench-menu-alert-v1` | Alert severity filters, event table, recommendation panel, transfer drawer. | `/fixed-assets/workbench/security?menu=alarm` |
| `workbench-module-disposal-v1` | Disposal launch desk and approval chain. | Embedded under asset/orders/todo menus |
| `workbench-module-usage-flow-v1` | Assignment, borrow, return, idle-claim queues. | Embedded under asset/todo menus |
| `workbench-module-batch-data-v1` | Import parsing, error repair, export filtering. | Embedded under asset/report menus |
| `workbench-module-config-governance-v1` | Category/model/settings/risk-policy governance. | Embedded under settings/policy menus |
| `workbench-module-maintenance-spares-v1` | Predictive work order and spare linkage. | Embedded under orders/spares/device menus |

Stitch prompt constraints:

- "Reuse the Workbench shell, top tabs, side navigation, context strip, density, and light-blue B-end style."
- "Redesign only the page content area as an operational business page."
- "Include filters, list/table rows, primary/secondary actions, drawer, state matrix, and permission-disabled controls."
- "Do not create a landing page, login page, poster, big-screen dashboard, or contact sheet."

## Future React Landing Plan

This round does not implement React. Later implementation should follow this sequence.

| Step | Work | Exit evidence |
| --- | --- | --- |
| 1 | Add or update the menu-level blueprint and asset manifest for 12 menus. | Docs and manifest map every menu to assets/screens/status. |
| 2 | Generate IMAGE2 `asset-kit-v6` module/detail assets for the first priority page slice. | Assets exist with readable dimensions and usage notes. |
| 3 | Generate Stitch page-level screens for priority pages. | Screen IDs/exports/screenshots recorded; direct MCP or OAuth/proxy path documented. |
| 4 | Add React page-level components inside the existing Workbench content area. | No shell/nav/topbar/mobile rewrites; components render under active menu. |
| 5 | Add real operation rows, filters, drawers, state handling, and permission-disabled actions. | Browser can trigger or inspect create/search/open/edit/danger/no-permission paths. |
| 6 | Extend browser regression to all 12 menus. | All 12 menus prove operation matrix, states, assets, and route previews. |
| 7 | Run visual QA across desktop viewport and capture canonical screenshots. | Committed QA-shot index replaces temp-only evidence. |
| 8 | Run tests/build/GitNexus staged change audit. | Passing targeted tests, build, and expected low/known risk. |

## Acceptance Criteria For The Next Implementation Goal

The next implementation goal should not be considered complete unless all items below have evidence.

| AC | Requirement | Evidence |
| --- | --- | --- |
| AC-01 | Workbench shell, top tabs, left nav, and route/permission boundaries remain unchanged except for approved polish. | Diff review and contract tests. |
| AC-02 | 12 formal menus remain fixed and no duplicate first-level menus are added. | Contract test and browser smoke. |
| AC-03 | Each changed/new menu has Workbench-native content, not just a path list. | Browser screenshot and component inspection. |
| AC-04 | IMAGE2 assets are menu/module-specific and mapped in manifest. | Asset contract test and manifest map. |
| AC-05 | Stitch outputs are page-level route screens with operation content. | Stitch export/screenshot evidence. |
| AC-06 | Priority pages include create/search/open/detail/edit/danger/no-permission handling. | Browser regression. |
| AC-07 | Dashboard capabilities are migrated into Workbench destinations while `/dashboard` remains transition-only. | Matrix, route checks, browser checks. |
| AC-08 | Existing business CRUD routes are used as landings after Workbench previews/drawers, not copied as duplicate pages. | Route target matrix and browser checks. |
| AC-09 | Empty, error, no-permission, loading, and disabled states are visible or triggerable. | Browser regression and screenshots. |
| AC-10 | No mobile files or mobile routes are touched. | Diff review. |
| AC-11 | No secret/token/key/password content is added to docs, prompts, manifests, or logs. | Sensitive-pattern scan. |
| AC-12 | Pre-commit GitNexus staged change audit confirms the affected scope is expected. | `gitnexus_detect_changes(scope=staged)` result. |

## Immediate Next Steps

1. Commit this blueprint as the product and delivery gate.
2. Start the next implementation goal with a narrow first slice: `流程待办`, `设备管理`, `工单管理`, `报表分析`, and `告警中心`.
3. Generate `asset-kit-v6` assets for that slice.
4. Generate Stitch page-level screens for that slice.
5. Land React content-area components only after assets and Stitch evidence exist.
6. Extend tests from 5 page cases toward 12 menu cases.
7. Run final browser visual verification with an authorized Workbench session or a documented mocked-auth Playwright session.

## Closeout For This Blueprint Round

Verdict target: `PASS` when this document is committed and pushed.

Known residual risks:

- Runtime browser inspection on `http://127.0.0.1:5173/dashboard` can show `无访问权限` without a session that has `dashboard:query`.
- Stitch MCP direct tool access may still require authentication; future generation must use a working auth path and record evidence.
- Current GitNexus index/tooling may be stale or have local version friction; for code edits, rerun impact and staged change audit at implementation time.
