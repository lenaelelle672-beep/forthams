# Workbench P0 Stitch Prompt

Create five desktop page-level Stitch screens for the forthAMS / UNIVIEW fixed asset Workbench formal entry. Reuse the existing Workbench shell concept: dark blue top bar, compact left navigation, four top tabs, light blue B-end content surface, and enterprise operation density. Redesign only the page content area.

Navigation rule: the four top tabs are independent scene views and must keep their existing approved main-page role. These five screens are left-navigation business pages or second-level operational pages, not replacements for the top-tab main views.

Global constraints:

- Device: desktop, 1440px wide B-end operations platform.
- Visual style: professional intelligent manufacturing / fixed asset operations, blue-white precision UI, compact information density, 1px pale-blue borders, 8-12px radius, no heavy card shadows.
- Must not create a login page, marketing landing page, big-screen dashboard, contact sheet, poster, or detached asset board.
- Must not add first-level menus beyond the existing Workbench menus.
- Every screen must show filters/search, processable list or table, create/launch action, open-detail action, edit/maintain action, a right-side drawer or inspector, empty/error/no-permission state blocks, and a disabled dangerous action or confirmation hint.
- Use short Chinese UI labels only. Do not include secrets, tokens, passwords, or key-like strings.

Screens to generate:

1. `workbench-menu-todo-v1`
   - Route reference: `/fixed-assets/workbench?menu=todo`
   - Page: `流程待办`
   - Content: mixed queue for pending approvals, predictive maintenance dispatch, inspection exceptions, low spare stock, SLA ranking, priority tags, batch processing, detail drawer, approve/reject preview.

2. `workbench-menu-device-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=device`
   - Page: `设备管理`
   - Content: online devices, temperature, vibration, location, IoT collection latency, abnormal device queue, telemetry detail drawer, create work order, create inspection.

3. `workbench-menu-orders-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=orders`
   - Page: `工单管理`
   - Content: predictive work orders, dispatch, execution, acceptance, SLA, spare readiness, status lanes, work-order list, acceptance drawer.

4. `workbench-menu-report-v1`
   - Route reference: `/fixed-assets/workbench/analytics?menu=report`
   - Page: `报表分析`
   - Content: report templates, asset value trend, category distribution, department asset stats, export, subscription, export history, failure retry, audit lineage drawer.

5. `workbench-menu-alert-v1`
   - Route reference: `/fixed-assets/workbench/security?menu=alarm`
   - Page: `告警中心`
   - Content: severity filters, alert queue, strategy hit panel, recommendation, transfer to work order, review drawer, closure progress, risk rule link.

Output expectation:

- Produce page-level screens named as above or visibly titled with those page names.
- Each screen should look like a usable Workbench product page and support React implementation in the existing Workbench content area.
