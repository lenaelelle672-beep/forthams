# Workbench Platform Entry Matrix

Date: 2026-06-14
Branch: codex/workbench-platform-entry
Baseline: origin/codex/integrated-workbench-unmerged

## Product Direction

Workbench is the formal fixed-asset platform entry. Dashboard remains only as a transition route at `/dashboard`.

Formal Workbench routes:

| Surface | Route | Role |
| --- | --- | --- |
| Asset operations hub | `/fixed-assets/workbench?menu=home` | Formal entry and operating home |
| Smart manufacturing overview | `/fixed-assets/workbench?menu=home` | Manufacturing overview tab |
| Data monitoring center | `/fixed-assets/workbench/analytics?menu=energy` | Data and monitoring tab |
| Asset operations center | `/fixed-assets/workbench/assets?menu=asset` | Asset operations tab |
| Security posture workbench | `/fixed-assets/workbench/security?menu=alarm` | Security posture tab |
| Legacy dashboard | `/dashboard` | Transition-only entry |
| Design preview | `/workspace-preview` | Public design/demo preview only |

## Left Navigation Conclusions

| Menu | Product conclusion | Workbench route | Business target | Empty/error/permission behavior |
| --- | --- | --- | --- | --- |
| 运营首页 | Independent Workbench main view | `/fixed-assets/workbench?menu=home` | stays in Workbench | Shows operating KPI/posture; protected by Workbench route permission; no-data state is visual KPI zero/preview |
| 流程待办 | Embedded module plus prefilled jumps | `/fixed-assets/workbench?menu=todo` | `/approvals`, `/workorders/new`, `/maintenance` | Drawer explains target and prefill; no permission hides target from global nav and can show no-permission note |
| 资产总览 | Independent Workbench asset view | `/fixed-assets/workbench/assets?menu=asset` | `/assets`, `/asset-health` | Asset KPI and risk panels remain visible in Workbench; detail jumps use drawer |
| 设备管理 | Embedded module, no duplicate page | `/fixed-assets/workbench/assets?menu=device` | `/equipment` | Preview module lists online/temperature/latency; target is existing equipment route |
| 工单管理 | Embedded module plus prefilled work order jump | `/fixed-assets/workbench/assets?menu=orders` | `/workorders/new`, `/disposals` | Prefill drawer carries asset/risk/due date; existing list redirect is respected |
| 巡检管理 | Embedded module plus prefilled jump | `/fixed-assets/workbench/assets?menu=inspection` | `/inspections/new` | Prefill banner exists in InspectionFormPage |
| 备件管理 | Embedded module plus prefilled jump | `/fixed-assets/workbench/assets?menu=spares` | `/spare-parts/new` | Prefill banner exists in SparePartDetailPage |
| 数据监控 | Independent data monitoring tab | `/fixed-assets/workbench/analytics?menu=energy` | `/energy`, `/notifications` | Data anomalies open alert drawer with query params |
| 报表分析 | Embedded report module; no report big screen | `/fixed-assets/workbench/analytics?menu=report` | `/reports` | Carries Dashboard trend/category/dept/export intent |
| 告警中心 | Embedded security queue | `/fixed-assets/workbench/security?menu=alarm` | `/notifications` | Alert drawer carries severity/event/action |
| 组织策略 | Embedded governance module | `/fixed-assets/workbench/security?menu=policy` | `/risk-matrix`, `/system/roles` | Strategy preview explains governance and rule source |
| 基础维护 | Embedded maintenance/config module | `/fixed-assets/workbench/assets?menu=settings` | `/settings/sysconfig`, `/categories`, `/locations`, `/vendors` | Shows existing protected settings/basic-data routes |

Excluded duplicate menus: 报表大屏, 平台配置, 维保计划.

## Dashboard Capability Migration

| Dashboard capability | Workbench destination | Notes |
| --- | --- | --- |
| KPI cards | 运营首页 and 资产总览 | Manufacturing KPI plus asset KPI cards |
| Asset posture/category | 资产总览 | Asset category, health, risk and lifecycle panels |
| Pending approvals | 流程待办 | Route to `/approvals` with Workbench context |
| Recent work orders | 流程待办 and 工单管理 | Route to prefilled `/workorders/new` or existing work order targets |
| Maintenance warnings | 流程待办 and 工单管理 | Route to `/maintenance` or predictive work order prefill |
| Asset value trend | 报表分析 | Report module summarizes trend/reporting intent |
| Category distribution | 报表分析 and 资产总览 | Report module plus asset overview charts |
| Department asset stats | 报表分析 | Report target stays `/reports` |
| Export data | 报表分析 | Use report center as the formal export destination |

## Click Matrix

| Button text | Clickable | Target | Prefill/context | Empty/error/no-permission handling |
| --- | --- | --- | --- | --- |
| 旧版仪表板 | Yes | `/dashboard` | Transition entry only | Protected by `/dashboard` rule |
| 资产运营中枢 | Yes | `/fixed-assets/workbench?menu=home` | Resets to operating home | Protected by Workbench route rule |
| 查看产线全景 | Yes | `/fixed-assets/workbench?menu=home` | In-Workbench route | No external dependency |
| 查看流程待办 | Yes | `/approvals?source=workbench&status=PENDING` | Approval/work order/maintenance summary | Drawer displays target and no-permission note if applicable |
| 查看资产清单 | Yes | `/assets` | Asset overview context | Existing protected route handles list/empty state |
| 查看设备状态 | Yes | `/equipment` | Device status context | Existing protected route |
| 查看预测工单 | Yes | `/workorders/new?...` | Asset/risk/due date prefill | WorkOrderFormPage shows Workbench prefill banner |
| 查看巡检计划 | Yes | `/inspections/new?...` | Inspection prefill | InspectionFormPage shows Workbench prefill banner |
| 查看备件库存 | Yes | `/spare-parts/new?...` | Spare request prefill | Spare part page shows Workbench prefill banner |
| 查看数据链路 | Yes | `/energy` | Data monitoring context | Existing protected route |
| 生成经营报表 | Yes | `/reports` | Dashboard migration context | Existing report route handles empty state |
| 查看告警队列 | Yes | `/notifications?...` | Alert severity/event/action | NotificationsPage shows Workbench context banner |
| 查看策略规则 | Yes | `/risk-matrix` | Strategy/risk context | Existing protected route |
| 打开基础维护 | Yes | `/settings/sysconfig` | Config/basic maintenance context | Existing protected settings route |
| 搜索/通知/用户 icon | Yes | Search opens global search; notification routes to `/notifications`; user routes to `/profile` | Workbench topbar utility actions | Disabled actions are not silent; unsupported full-screen/text controls show preview feedback |

## Browser Verification Record

Validated locally on 2026-06-14 with the Vite dev server at `http://127.0.0.1:5173/`.

| Check | Result |
| --- | --- |
| Formal Workbench entry | `/fixed-assets/workbench?menu=home` opened behind auth and rendered the Workbench shell |
| Left navigation | `运营首页`, `流程待办`, `资产总览`, `设备管理`, `工单管理`, `巡检管理`, `备件管理`, `数据监控`, `报表分析`, `告警中心`, `组织策略`, `基础维护` were visible |
| Top entries | `旧版仪表板` and `资产运营中枢` were visible; `资产运营中枢` stayed in Workbench home |
| Duplicate menu guard | No `报表大屏`, `平台配置`, or `维保计划` menu appeared in Workbench |
| Layout | 1280x720 viewport had no horizontal overflow |
| Flow todo drawer | An operations user with `approval:process:query` opened `查看流程待办`; drawer displayed `/approvals?source=workbench&status=PENDING` with no no-permission warning |
| Report drawer | An operations user with `report:query` opened `生成经营报表`; drawer displayed `/reports?source=workbench&view=operations` with no no-permission warning |
| No-permission drawer | A read-only user with only `dashboard:query` could enter Workbench but report action showed `/reports?source=workbench&view=operations`, the no-permission warning, and disabled primary label `暂无权限` |
| Route-level permission guard | A logged-in user with only `report:query` was blocked from `/fixed-assets/workbench?menu=home` by `无访问权限`; Workbench shell did not render |
| Legacy dashboard transition | `旧版仪表板` targets `/dashboard`; in local smoke it is still protected and the legacy page's backend 401 path can redirect to `/login` with a fake token |
| Browser console | No browser `error` logs during Workbench smoke checks |

Continuation verification on 2026-06-14 used the Vite dev server at `http://127.0.0.1:5177/` with Playwright and mocked backend responses only for `/api/*` requests.

| Check | Result |
| --- | --- |
| Desktop global sidebar | `/dashboard` rendered `资产运营中枢` as the first overview entry and kept `旧版仪表板` as the legacy transition entry |
| Workbench formal jump | Clicking `资产运营中枢` navigated to `/fixed-assets/workbench?menu=home` and rendered `运营首页` |
| Workbench shell | `运营首页`, `流程待办`, `基础维护`, and the four top tabs were visible |
| Legacy transition | Clicking Workbench `旧版仪表板` navigated back to `/dashboard` |
| Todo view | `/fixed-assets/workbench?menu=todo` rendered the `流程待办` view |
| Screenshot evidence | `/tmp/forthams-workbench-verification-20260614/dashboard-sidebar-entry.png`, `/tmp/forthams-workbench-verification-20260614/workbench-home.png`, `/tmp/forthams-workbench-verification-20260614/workbench-todo.png` |
| Browser console | No relevant console/page errors after API mock shape matched Dashboard data contracts |

## IMAGE2 / Stitch Asset Governance

Existing product assets live under `frontend/public/mock/workspace-preview/` and are referenced by `WorkspacePreviewPage.tsx`.

## Menu Governance Continuation

The formal Workbench entry is now also represented in the desktop global navigation and backend menu metadata:

| Surface | Implementation | Governance note |
| --- | --- | --- |
| Desktop global sidebar | `AppLayout` 概览 group first item: `资产运营中枢` -> `/fixed-assets/workbench?menu=home` | Makes Workbench the formal first entry outside the legacy dashboard shell |
| Backend menu seed | `V2_84__workbench_platform_menu_entry.sql` ids `310/311` | Adds Workbench as a visible menu child of 报表统计 without creating a duplicate page |
| Legacy dashboard | id `186` renamed to `旧版仪表板` and sorted after Workbench | Keeps `/dashboard` as transition-only |

Naming/use policy for new or refreshed assets:

| Asset group | Naming | Size target | Use |
| --- | --- | --- | --- |
| Module images | `asset-kit-v4/modules/module-*.png` | 16:9 or module card crop | Workbench module cards |
| Detail images | `asset-kit-v5/details/*-v1.png` | 1:1 or 4:3 | Drawer, signal cards, detail panels |
| Stitch suite | `stitch-suite/*.png` | Screen or contact-sheet size | Design overview only |
| QA shots | `qa-shots/workbench-platform-*.png` | Browser viewport | Verification evidence |

This iteration reuses the confirmed visual direction and existing assets first. Generate new IMAGE2/Stitch assets only for missing product visuals that cannot be covered by the current kit.

Visual asset contract automation:

| Asset contract | Automated evidence |
| --- | --- |
| Workbench references | `frontend/src/__tests__/workbenchVisualAssetContract.test.ts` reads `WorkspacePreviewPage.tsx` helper calls and verifies each referenced `/mock/workspace-preview/**` asset exists |
| IMAGE2 module package | Verifies `asset-kit-v4/modules/module-*.png` naming and readable dimensions for Workbench module cards |
| IMAGE2 detail package | Verifies `asset-kit-v5/details/*-v1.png` naming, square format, and high-resolution detail-card dimensions |
| Stitch suite package | Verifies manifest and `stitch-suite` image references exist while keeping the current `Auth required` MCP status explicit |
| Login product hero | Verifies `scene/login5-stitch-factory-cn-v4.png` remains a high-resolution product image source |

## Continuation Contract Automation

2026-06-14 continuation added `frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts` so the formal-entry decision is protected by automated checks instead of only manual screenshots.

2026-06-14 continuation also added `frontend/src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts` so the browser verification record is repeatable through the existing Playwright `browser-regression-smoke` project.

| Contract area | Automated evidence |
| --- | --- |
| Desktop formal entry | `AppLayout` keeps `资产运营中枢` before `旧版仪表板` |
| Formal route governance | `/fixed-assets/workbench` routes stay protected while `/workspace-preview` remains the public design preview |
| Left navigation scope | Required Workbench menu labels exist and duplicate menu labels `报表大屏`, `平台配置`, `维保计划` remain absent |
| Dashboard migration | Pending approvals, work orders, inspections, spare parts, reports, policies, and basic maintenance target real project routes |
| Backend menu governance | Schema and V2_84 migration keep ids `310/311`, query param `menu=home`, and legacy dashboard id `186` |
| Evidence hygiene | Matrix sections for navigation conclusions, click matrix, browser verification, and IMAGE2/Stitch governance remain present |

Playwright browser regression evidence:

| Browser path | Automated evidence |
| --- | --- |
| Legacy dashboard transition | `/dashboard` exposes `资产运营中枢` and `旧版仪表板`; clicking `资产运营中枢` lands on `/fixed-assets/workbench?menu=home` |
| Workbench shell | Formal Workbench renders `运营首页`, `流程待办`, `基础维护`, the four approved top tabs, and excludes `报表大屏`, `平台配置`, `维保计划` |
| Business action closure | `查看流程待办` opens the operation drawer with `/approvals?source=workbench&status=PENDING`, prefill fields, and enabled primary navigation |
| No-permission handling | A user with only Workbench access can open Workbench but sees the report drawer warning and disabled `暂无权限` primary action for `/reports?source=workbench&view=operations` |
| Route guard | A user with `report:query` but without Workbench permissions gets `无访问权限`; the Workbench shell does not render |

Stitch MCP preflight on 2026-06-14 returned `Auth required` for `list_projects`, so this continuation does not claim a new Stitch generation. Existing `stitch-suite` and `asset-kit-v4/v5` assets remain the current visual source of truth until Stitch authentication is restored.
