# Workbench Round 2 Stitch Prompt

Create seven desktop page-level Stitch screens for the forthAMS / UNIVIEW fixed asset Workbench formal entry. Reuse the existing approved Workbench shell: dark blue top bar, slim left navigation, four independent top scene tabs, light blue B-end content surface, compact enterprise density. Redesign only the left-navigation business page content area.

Navigation rule:

- The four top tabs are independent scene views and must keep their existing approved main-page role.
- These seven screens are left-navigation business pages or second-level operational pages, not replacements for the top-tab main views.
- Do not add first-level menus beyond the existing Workbench menu set.

Global constraints:

- Device: desktop, 1440px wide B-end operations platform.
- Visual style: professional intelligent manufacturing / fixed asset operations, blue-white precision UI, compact information density, 1px pale-blue borders, 8px radius, restrained shadows.
- Must not create a login page, marketing landing page, big-screen dashboard, contact sheet, poster, or detached asset board.
- Every screen must show filters/search, processable list or table, create/launch action, open-detail action, edit/maintain action, a right-side drawer or inspector, empty/error/no-permission state blocks, and a disabled dangerous action or confirmation hint.
- Use short Chinese UI labels only. Do not include secrets, tokens, passwords, or key-like strings.

Screens to generate:

1. `workbench-menu-home-v1`
   - Route reference: `/fixed-assets/workbench?menu=home`
   - Page: `运营首页`
   - Content: KPI drilldown cards, pending approvals, recent work orders, maintenance warnings, asset health, quick launch, refresh state, operation insight drawer.

2. `workbench-menu-asset-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=asset`
   - Page: `资产总览`
   - Content: asset ledger filters, health/lifecycle/category panels, asset table, risk TOP, asset detail drawer, new/edit asset, generate risk work order, disposal/usage-flow entry.

3. `workbench-menu-inspection-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=inspection`
   - Page: `巡检管理`
   - Content: route calendar, route/point filters, QR scan verification, checklist execution, abnormal queue, evidence upload, transfer to work order, route detail drawer.

4. `workbench-menu-spares-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=spares`
   - Page: `备件管理`
   - Content: inventory filters, low-stock alerts, supplier ETA, related work orders, spare request, purchase/issue status, cost writeback, spare detail drawer.

5. `workbench-menu-energy-v1`
   - Route reference: `/fixed-assets/workbench/analytics?menu=energy`
   - Page: `数据监控`
   - Content: MES/IoT chain status, collection latency, device points, anomaly stream, subscription/export, source health, event detail drawer, retry/refresh.

6. `workbench-menu-policy-v1`
   - Route reference: `/fixed-assets/workbench/security?menu=policy`
   - Page: `组织策略`
   - Content: risk rules, role policy, approval boundary matrix, threshold filters, strategy hits, high-risk review queue, policy detail drawer, edit/review actions.

7. `workbench-menu-settings-v1`
   - Route reference: `/fixed-assets/workbench/assets?menu=settings`
   - Page: `基础维护`
   - Content: categories, locations, vendors, asset models, numbering rules, integration sources, system config health, config detail drawer, change confirmation.

Output expectation:

- Produce page-level screens named as above or visibly titled with those page names.
- Each screen should look like a usable Workbench product page and support React implementation in the existing Workbench content area.
