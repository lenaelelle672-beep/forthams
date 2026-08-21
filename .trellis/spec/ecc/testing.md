# Testing Rules (ECC distilled)

## Coverage

- Minimum 80% line coverage on service/domain logic
- Skip trivial getters/config classes; focus effort on critical paths and complex logic
- Three levels, all expected for real features: unit, integration, E2E (critical flows)

## TDD loop (used with the `tdd` skill)

1. Write the failing test first (RED) — confirm it fails
2. Write minimal implementation (GREEN) — confirm it passes
3. Refactor belongs to the review stage, not the red-green cycle
4. One seam, one test, one minimal implementation per cycle — vertical slices,
   never "all tests first, then all code"

## What a good test is

- Verifies behavior through public interfaces, not implementation details
- Expected values come from an independent source of truth (spec, worked example),
  never recomputed the same way the code computes them
- Survives refactors: if a test breaks when behavior didn't change, it's coupled
  to implementation — fix the test

## Structure and naming

- Arrange-Act-Assert structure
- Names describe behavior: `returns empty array when no markets match query`,
  `throws error when API key is missing`

## When tests fail

- Check test isolation and mock correctness first
- Fix the implementation, not the test — unless the test itself is wrong
- Never delete or skip a failing test to make the suite green

## Start the stack (do not wait for the human)

See `.trellis/spec/dwk/dev-runtime.md`. Probe health, start missing frontend/backend from README, then test. Browser visual paths may use Browser Harness; Playwright stays the CI contract.

## Playwright E2E (forthAMS)

- `frontend/playwright.config.ts` collects `src/e2e` and `tests/e2e`. Loadability (`playwright test --list`) is not the same as a green suite.
- Specs that cannot parse, mix vitest with Playwright, or import missing/Graphify modules go in `testIgnore`. Do not add fake modules to satisfy imports.
- Anchor selectors to routed pages (`src/router/index.tsx` → `src/pages/**`), not unmounted `src/app/pages/**`.
- Auth seed must write `auth_token` / `user_info` (`src/utils/auth.ts`). Seeding only `ams_auth_token` leaves the guard on `/login`.
- Login: heading `欢迎回来` (desktop) / `登录系统` (narrow); username `#username`; submit `登录系统`. Never `getByLabel('用户名')`.
- Post-login land is `/fixed-assets/workbench?menu=home`, not `/dashboard`. Approval list is `/approvals` with h1 `审批中心`. Asset list h1 is `资产台账`.
- Workbench 真页 heading 合同（`workbench-platform-entry.browser-regression-smoke.spec.ts`）：home `运营首页`、todo `审批中心`、asset `/资产/`、device `重要设备管理`、orders `资产处置管理`、inspection `检验/年检管理`、spares `备品备件管理`、energy `能耗管理`、report `报表中心`、alarm `通知中心`、policy `风险矩阵`、settings `资产分类管理`。禁止再断言 mock 列表/抽屉文案。
- 该 spec 用 `--workers=1`。多 worker 会触发 Vite `Failed to fetch dynamically imported module`（尤其 `EnergyDashboardPage`）。
- `mockApi` 默认 `paged([])` 不能喂给：`/energy/dashboard`（对象 `{byType,trend,assetRanking,total}`）、`/risk-assessments/matrix`（数组）、`/categories/tree`（数组）。否则真页无 heading 或 `forEach` 崩溃。`assetRanking`、备件详情 `usages`、检验详情 `history` 必须 `Array.isArray` 再 `.map`。能耗 `byType`/`trend` 喂数组时当 `{}`。风险矩阵、自定义字段 `fieldOptions`、转移单 `depts/tree` 纯对象不崩。TCO mock 用 `**/api/**/tco/**`，勿拦 Vite `TcoPage` chunk。
- AppLayout 列表补测 `src/e2e/app-pages-smoke.spec.ts`：下列路径必须是 **数组** 不是 paged：`/contracts/expiring`、`/stocktaking/cycles`、`/menus/admin/tree`、`/fault-codes/tree`、`/reliability/trend|ranking`、`/asset-health/unhealthy`、`/gis/assets`、`/manufacturers/options`、`/system/custom-fieldsets/all`、`/maintenance/upcoming`。`/reliability/summary`、`/gis/stats`、`/licenses/summary` 必须是对象（喂数组不崩）。`/fault-codes/tree`、`/reliability/trend|ranking`、`/asset-health/unhealthy`、`/licenses/expiring` 喂纯对象不崩。报表构建器 stats `.slice/.map` 前 `Array.isArray`。ReportsPage `/reports/depreciation-stats|maintenance-stats|retirement-stats` 与 `/workorders/status-distribution|dept-pending` 喂纯对象不崩（`.map` 前 `Array.isArray`）。AnalyticsPage `/dashboard/maintenance-stats` 期望对象，喂数组当 undefined。`useGisAssets`、RFID `surplusItems`/`deficitItems`、审计 `changes`、工单 `attachments` 非数组时先 `Array.isArray`。资产详情 `log.changes`、转移单 `assignees/preview` 的 `nodes`/`missingFields`、设备页 `/maintenance/upcoming` 同理。测转移单 preview 须同时 mock `start-availability` `canStart: true`，否则 query 不发。风险矩阵编辑 `probabilityDimension`/`severityDimension`/`levelMapping` 与导入导出 `asset-categories/tree`、`asset-locations/cascade` 的 `children` 喂对象不崩。个人资料 `roles`/`permissions`、平面图 `/floor-plans/:id/assets` 喂对象不崩。`/workorders/1`、`/budgets/1` 的 `page.route` 只用 `**/api/**`，勿拦文档导航。
- 空态/403/失败态：`src/e2e/app-pages-empty-error.spec.ts`。失败态只测页面会渲染「加载失败」的路径；Dashboard KPI 失败不显示该文案，不要硬断言。桌面 `/inspection-templates`、`/inventory/cycle-count`、`/inventory/abc-classification` 空表文案分别为「暂无检验模板」「暂无循环盘点规则」「暂无资产分类数据」（antd `locale.emptyText`）。`/sam` 另有「暂无扫描历史」。`/contracts` 须点 tab「即将到期」才见「暂无即将到期合同」，点「时间轴视图」才见「暂无时间线数据」；`/budgets` 须点「超支告警」才见「暂无超支告警」，点「执行率」才见「暂无执行率数据」。`/inventory/smart-report/:id` 空态为「暂无差异资产，盘点结果正常」。`/inventory/tasks/*/summary` 必须喂对象 `{surplusCount,deficitCount,surplusItems,deficitItems}`，默认 `paged([])` 会让 DonutChart 收到 NaN（console warning）。`/assets/:id` 「暂无 TCO 数据」须把 `/tco/asset/:id` mock 成 `null`（paged 对象为 truthy 会走成本构成而非该空态）；TCO 路由用 `**/api/**/tco/**` 勿拦 Vite `TcoPage` chunk。`/approvals` 须点「发起申请」才见「暂无可发起的流程」。`/audit/:id` 默认 paged 详情仍渲染「暂无变更记录」（normalizeAuditLog 不带 changes）。采购无独立 `/purchase-orders/:id` 路由：列表 mock 一条再点行，详情须 `{order, items:[]}` 才见「暂无明细」。检验历史在 `/inspection-records`（不是 `/inspections`）点「历史」，列表须有 `assetId`。`/disposals/clearance/new` 默认「暂未选择资产」，点「添加资产」才见「暂无匹配资产」。`/purchase-orders` 须 mock 一条订单再点行，详情 `{order, items:[]}` 才见「暂无明细」。`/inspection-records` 须 mock 一条含 `assetId` 的检验再点「历史」才见「暂无历史记录」。`/gis` 点「资产定位管理」默认关联模式见「暂无可关联的资产」。`/sam` 图表区另有「暂无数据」。DonutChart 计数须 `Number(x) || 0`。`/assets/:id` 默认 paged TCO 为 truthy 时趋势列见「暂无趋势数据」。`/workflows` 预定义流程无 server 时详情见「暂无发布快照」。`/reports` 点「资产分类统计」（role=button）才见「暂无图表数据」；「资产汇总表」在 summary 为 paged 对象时会拼出 4 个点，不是空态。`/intake/:id` 默认 paged 详情可见「暂无入库资产」。`/system/custom-fieldsets` 须 mock 一条再点「查看字段」才见「该字段集暂无字段」。`/audit` 须点「筛选」才见「暂无筛选项」。`/vendor-portal` 是独立登录非 AppLayout，admin 会话看不到「暂无合同数据」。`/audit` 趋势按 7 天补零，`trendData.length` 恒为 7，「暂无趋势数据」不可达。`/maintenance/plans` 「暂无维保计划数据」须点日历视图。`/disposals` 默认清退 tab；点「资产调拨」「报废转让」才见对应 emptyText。`/compensation/new` 在 `/depts/tree` 为空时见「暂无可选部门」。`/sam` 须 mock 一条 `/sam/history` 再点「查看详情」，`/sam/:id/details` 喂 `{details:[]}` 才见「暂无详情」。`/system/roles` 须 mock `/roles/list` 一条再点「菜单权限」才见「暂无菜单数据」，点「数据权限」才见「暂无部门数据」（DialogTitle console 忽略）。`/assets/:id/timeline` 另有「该资产暂无任何履历事件」。`/floorplans` 另有「请新建平面图」。领用/借用新建「请选择资产」是 hidden option，不可见。`/assets` EmptyState 另有「未找到符合条件的资产记录，请调整筛选条件或新建资产」。`/approvals` EmptyState 另有「当前没有待处理的审批事项」。`/notifications` 全部 tab 另有「所有通知都会显示在这里」；点「系统通知」见「当前筛选条件下没有通知」。`/gis` 另有「没有已定位的资产可在地图上显示」。`/energy` dashboard 空对象时另有「尚未采集到能耗数据」。`/sam` 图表描述另有「执行合规扫描后显示许可类型分布」「执行合规扫描后显示席位使用率」「所有许可合规运行」。`/fault-codes` 另有「点击「新增根节点」创建第一级故障现象」。`/categories` 另有「点击上方按钮添加根分类」。`/reports` 点资产分类统计另有「当前报表暂无可用数据」；资产状态分布有图点不是空态。`/report-builder` 未选字段见「将字段拖拽到此处，或点击左侧字段添加」。`/assets/import-export` 点导出 tab 见「请选择资产分类」；TreeSelect 用 `treeCheckable` 不是 `treeCheck`。`/locations` 空树可见「新增顶级位置」。`/assets/import-export` 导出 tab 另有「请选择资产状态（可多选）」「请选择存放位置」。`/system/depts` 空树可见「新增部门」。`/assets/import-export` 导入 tab 见「将 .xlsx 文件拖到此处，或点击选择文件」「支持 .xlsx 格式，文件大小不超过 10MB」。`/system/posts` 空表可见「新增岗位」。`/assets/import-export` 导入 tab 另有「下载导入模板」。`/system/menus` 空树可见「新增菜单」。`/system/depts` 另有「请选择一个部门查看详情」。`/spare-parts` 可见「新增备件」。`/insurances` 可见「新增保险」。`/borrows` 可见「新建借用单」。`/assignments` 可见「新建领用单」。`/intake` 可见「新建验收单」。`/assets` EmptyState 可见「新建资产」。`/budgets` 可见「新增预算」。`/revaluations` 可见「新增减值/重估」。`/retirement` 可见「新建退役申请」。`/inspections` 可见「新增检验」。`/maintenance` 可见「新增维保」。`/stocktaking-cycles` 可见「新建周期」。`/maintenance/plans` 可见「新建计划」。`/vendors` 可见「新增供应商」。`/purchase-orders` 可见「新增采购单」。`/manufacturers` 可见「新增制造商」。`/contracts` 可见「新增合同」。`/asset-models` 可见「新增模型」。`/licenses` 可见「新增许可证」。`/fault-codes` 可见「新增根节点」。`/floorplans` 可见按钮「新建」。`/inventory` 可见「新建任务」。`/inventory/cycle-count` 可见「新增规则」。`/categories` 可见「添加根分类」（EmptyState 内「添加分类」因 action 形状不对不可达）。`/inspection-templates` 可见「新增模板」。`/reports/scheduled` 可见「新建定时报表」。`/inspection-records` 可见「新增检验」。`/disposals` 默认清退 tab 可见「新建资产清退」。`/risk-assessments` 可见「新增评估」。`/safety-checklists/config` 可见「新增模板」。`/disposals` 点「资产调拨」见「新建资产调拨」，点「报废转让」见「新建报废转让」，点「资产赔偿」见「新建资产赔偿」，点「工单管理」见「新建工单管理」。`/workflows` 可见「新建流程」。`/equipment` 可见「新建维保」；点后 dialog 见「新建维保记录」（DialogTitle console 忽略）。`/sam` 可见「触发合规扫描」。`/reports/scheduled` 另有「点击"新建定时报表"开始创建」。`/gis` 点「资产定位管理」可见「新建资产定位」「关联已有资产」。`/notifications` 可见「全部已读」。`/gis` 定位弹窗关联模式见台账提示与搜索 placeholder；点「新建资产定位」见临时数据提示与名称/编号/纬度/经度/位置 placeholder 及「确认创建」。关联模式见「标注坐标」「取消」。`/depreciation` 可见「批量计算折旧」。`/inventory/abc-classification` 可见「批量重新分类」。`/idle` 可见副标题「闲置资产公告发布与认领流程管理」。`/inventory/abc-classification` 另有「根据资产原值和分类规则自动分类。」。`/depreciation` 另有「待计算资产」「刷新」。`/inventory/abc-classification` 另有「未分类资产」「导出报告」「未匹配任何规则的资产会标记为未分类。」。空表无法点「批量计算折旧」确认框。`/inventory/abc-classification` 另有「A 类资产」；点「批量重新分类」见「确认批量重新分类」。`/idle` 可见「闲置总量」。`/inventory/abc-classification` 另有「B 类资产」「C 类资产」；确认框正文「此操作将根据当前的循环盘点规则重新分类所有资产。」。ABC 确认框另有「操作可能需要较长时间，请确认是否继续？」；卡片可见「总价值」。`/idle` 列可见「闲置天数」。`/bigscreen` 可见「资产运营分析平台」「值班领导」「值班经理」「资产运行分析」「今日资产信息」「资产异常分析」（WebGL console 忽略）。
- 登录变体：`src/e2e/login-variants-smoke.spec.ts`。`/login5` 走 `Login4Page` 且 h1 可能不是 role=heading，用 `region` landmark「UNIVIEW 固定资产平台登录」。
- `locations`/`departments` 树展平必须 `Array.isArray` 再 `for...of`（`InventoryDetailPage`）；`paged({})` 当树会 `items is not iterable`。桌面 `/locations`、`/system/menus`、`/system/depts` tree 与 `/stocktaking/cycles` 喂纯对象时 heading 仍在、无 pageerror；`/gis/stats` 喂数组时同理。树节点 `children` 为对象时（locations/categories/fault-codes/depts/assets）须先 `Array.isArray` 再递归。预算 `alerts`/`execRates` 同理。
- 列表页 `data.records` 必须 `Array.isArray` 后再给表格（许可证/设备/备件/供应商/领用/借用/入库/采购/制造商/检验/折旧/合同/报表/菜单树/部门树）。`records` 为对象时 heading 仍在、无 pageerror。桌面 e2e：`app-pages-smoke` grep `records 非数组`（不含 `/m`）。`/asset-models` 的 `manufacturers/options` 与 `categories/all`、入库详情 `checkItems`/`intakeAssets`、采购详情 `items` 同样先 `Array.isArray`。
