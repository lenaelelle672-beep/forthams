# LOOP queue（08-21 08:00 停）

| id | status | ticket |
| --- | --- | --- |
| Q1 | done | 处置/工单新建表单 heading：5 passed（compensation/scrap/clearance/transfer/workorders/new） |
| Q2 | done | 复跑 `login-error.spec.ts` + `browser-regression-smoke.spec.ts`（红则修，禁 skip） |
| Q3 | done | 工作台 `menu=asset` 空表可见「新建资产」（扩现有 workbench 或独立 1 测） |
| Q4 | blocked | docker CLI 不可用（`command -v docker` 无）；3306 mysql 通、8080 API 不通。跳过 real-backend-smoke，未强起后端。 |
| Q5 | done | router 再扫：补 `/assets/import-export`、`/stocktaking-cycles/new` heading smoke；Card title 页不硬测 |
| Q6 | done | 已从 Q5 继续拆 Q7–Q11；剩余 Card title / 需专用 mock 的详情页不再硬测 heading |
| Q7 | done | 详情硬编码 h1：`/approvals/1` 工单审批详情 |
| Q8 | done | `/inventory/smart-report/INV-001` heading「盘点报告」 |
| Q9 | done | `/workorders/1` heading「工单详情」 |
| Q10 | done | `/inventory/tasks/1` heading「办公室盘点」；Array.isArray 防 locations 树崩溃 |
| Q11 | done | `/403` heading「无访问权限」 |
| Q12 | blocked | JWT 可用进程环境变量；Flyway 校验失败（本地缺 1.1、1.2 rbac 失败）。未 `repair`（破坏性，需用户确认）。真后端仍跳过。 |
| Q13 | done | 补硬编码 heading 列表：`/equipment` `/approvals` `/disposals` `/idle`（4 passed） |
| Q14 | done | `/assignments/1/edit`「编辑领用单」、`/borrows/1/edit`「编辑借用单」2 passed |
| Q15 | done | `login-error.spec.ts` 3 passed。再扫：Card title / 动态 / 需详情对象的页不硬测 |
| Q16 | done | `/assets/1/timeline` heading「资产履历时间线」；mock `/assets/:id/history` 为 []。1 passed |
| Q17 | done | 全量 `app-pages-smoke.spec.ts` 77 passed |
| Q18 | done | `/budgets/1` `/assignments/1` `/borrows/1` `/intake/1` 4 passed（paged 当详情仍出 heading） |
| Q19 | done | `/audit/1` `/workorders/1/acceptance` `/retirement/1` 3 passed |
| Q20 | done | `/compensation` `/compensation/1` `/equipment/1` 3 passed |
| Q21 | done | app-pages 87 + login-error 3 = 90 passed。剩余 Card title / i18n / 动态名 / 无 h1 |
| Q22 | done | `login-error.spec.ts` 3 passed。硬编码 heading 池已空 |
| Q23 | done | 守门：login-error 已绿；硬编码 heading 池空 |
| Q24 | done | `uv tool install` browser-harness 0.1.9；recordings disable。CDP 需 Chrome Allow，未 mac-approve（无用户确认）。Playwright 仍为 CI 合同。 |
| Q25 | done | Card：保险新建、检验模板、新增风险评估、开始安全检查。`/inspections/new` antd InputNumber 双 React hook 炸，未纳入 |
| Q26 | done | Card 5：cycle-count / insurances/1 / inspections/1 / upload / risk edit。修 InspectionDetail Descriptions 主包导入。99 passed |
| Q27 | done | `/disposals/1`「资产处置详情」+ `/test-results` mock json「测试结果」。101 passed |
| Q28 | done | `/stocktaking-cycles/1` heading「2026年度循环盘点」。102 passed |
| Q29 | done | `/workflow-designer`「资产转移流程」+ `/inventory/scan/RFID-1`「RFID扫描任务」。104 passed |
| Q30 | done | `/workflow-form/ASSET_CLEARANCE`「资产清退流程」。105 passed |
| Q31 | done | workflow-form SCRAP/COMPENSATION/RETIREMENT。108 passed |
| Q32 | done | InspectionForm InputNumber 主包；`/inspections/1/edit`「编辑检验记录」。109 passed。不测 new |
| Q33 | done | `/spare-parts/1` heading「E2E备件」。110 passed |
| Q34 | done | `/safety-checklists/execute/1`「安全检查执行」。111 passed |
| Q35 | done | smart-report 空态 + `/404`。113 passed |
| Q36 | done | `/profile` heading「E2E管理员」。114 passed |
| Q37 | done | `/403?reason=roles_missing`「用户信息不完整」。115 passed |
| Q38 | done | `/vendor-portal`「供应商门户」。116 passed |
| Q39 | done | `/sso-callback`「Token 缺失，SSO 登录失败」。117 passed |
| Q40 | done | Inspection Image 改 antd 主包。117 passed。硬编码 heading/Card 池空 |
| Q41 | done | `/assets/1`「E2E-ASSET」；attachments/折旧数组 mock。118 passed |
| Q42 | done | i18n 列表已在 core-routes；守门结束 |
| Q43 | done | R5 browser/core/publish + approval/retirement **20 passed** |
| Q44 | cancelled | 08:00 守门空转；用户改截止 10:00 |
| Q45 | done | `/inspections/new` `/assets/1/edit` workbenchv3 **3 passed**（InputNumber 主包后 new 可测） |
| Q46 | done | `/workflows-v2` iframe「流程定义 2」；settings 10 tab 复刻页 landmark；`/workflow-form/ASSET_TRANSFER`。app-pages **130 passed** |
| Q47 | done | `/forbidden`「无访问权限」、`/workspace-preview`「固定资产工作台设计」2 passed |
| Q48 | done | `/settings` `/settings-v2` `/workorders` 重定向落地 3 passed |
| Q49 | done | `/settings/system` `/settings/users` `/settings/departments` `/settings-v2/mail-template` 4 passed |
| Q50 | done | `/bigscreen`「资产运营分析平台」、`/bigscreen-3d`「固定资产智慧运营大屏」；stats 对象 mock。2 passed |
| Q51 | done | `/assets` `/inventory` `/analytics` 空表 heading。全量 **144 passed** |
| Q52 | done | `/m` 6 路径 heading。修 MobileLayout/Dashboard/Profile 用主 AuthContext；notifications 数组防护 |
| Q53 | done | `/m/assets/1`「资产详情」1 passed |
| Q54 | done | `/m/stocktaking-tasks/1`；去掉 html5-qrcode `require` 崩溃。全量 **152 passed** |
| Q55 | done | login-variants-smoke `/login2–5` **4 passed**（login5 用 region landmark） |
| Q56 | done | 未测路由 4 passed：`/m`→index、未知路径 404、`/system/tenants` 404、USER `/bigscreen` 403 |
| Q57 | done | 空态 8 passed：assets/fault-codes/notifications/gis/categories/retirement/insurances/m/assets |
| Q58 | done | 错误态 3 passed：energy/gis/categories API code 500「加载失败」 |
| Q59 | done | 空态再 8：spare-parts/inspections/assignments/revaluations/stocktaking-cycles/equipment/depreciation/vendors |
| Q60 | done | 空态扩到 energy/borrows/intake/maintenance/plans/budgets/m/work-orders；修 UpcomingAlert 非数组崩溃。36 passed |
| Q61 | done | ECC 数组 mock + 空态 m/notifications/audit/scheduled/timeline/purchase-orders。41 passed |
| Q62 | done | USER /system/users /analytics 403；未登录 /m→login。44 passed |
| Q63 | done | 空态 m/scan m/index contracts risk-matrix sam system/menus。50 passed |
| Q64 | done | 错误态 sam/assets/contracts；USER energy/workflows 403。empty-error **55 passed** |
| Q65 | done | 空态 custom-fields/tco/asset-health；USER /settings 403。59 passed |
| Q66 | done | USER gis/reports/audit 403；空态 analytics/health intake/1。64 passed |
| Q67 | done | USER inventory/disposals/approvals 403；空态 retirement/1 workorders/1。69 passed |
| Q68 | done | /m/assets/999 不存在、加载失败；USER /maintenance 403；未登录 /m/profile。73 passed |
| Q69 | done | USER 403 equipment/categories/vendors/spare-parts/insurances/inspections。79 passed |
| Q70 | done | USER 403 再 12 条。91 passed |
| Q71 | done | USER 403 再 11 条。102 passed |
| Q72 | done | USER /assets 有权空态、/retirement 无规则可进；403 workorders/posts/menus/safety/report-builder。109 passed |
| Q73 | done | USER /assets/new 403；未登录 m/scan/assets/work-orders/notifications。114 passed |
| Q74 | done | USER import-export 可进；403 designer/inspection-records/risk-matrix/scheduled；未登录 dashboard。120 passed |
| Q75 | done | USER 403 dashboard/tco/asset-health/custom-fields/workflow-form/test-results；未登录 retirement。127 passed |
| Q76 | done | USER 可进 workbench；403 reliability/health/fieldsets/abc/cycle-count/safety-history；未登录 approvals。135 passed |
| Q77 | done | USER 403 settings notif/mail/webhook/sla/safety-execute；未登录 inventory/disposals。142 passed |
| Q78 | done | 错误态 floorplans；USER 403 settings-v2/abc；未登录 equipment/analytics/gis。160 passed |
| Q79 | done | USER /profile 可见只读用户；未登录 reports/audit/settings/workflows/bigscreen。166 passed |
| Q80 | done | 未登录再 8 条。empty-error **174 passed**（workers=1） |
| Q81 | done | USER /m/index 可进；未登录再扩。empty-error **194 passed** |
| Q82 | done | 未登录大扩。empty-error **252 passed** |
| Q83 | done | USER 可进 m/assets/scan/work-orders/index/notifications |
| Q84 | done | 公开 /login 欢迎回来、/forbidden 无访问权限 |
| Q85 | done | 未登录未知路径与 /404 先跳 login |
| Q86 | done | 已认证 /403 /404 |
| Q87 | done | /login?expired=1 会话过期提示 |
| Q88 | done | USER /m/profile；empty-error **321 passed** |
| Q89 | done | login-variants 4 passed；empty-error+variants **366 passed** |
| Q90 | done | 公开 workspace-preview/vendor-portal/sso-callback；login2–5 停留 |
| Q91 | done | USER 403 详情/new 扩；未登录 settings tabs/详情；Array.isArray stocktaking tasks |
| Q92 | done | 空态 approvals/users/inventory；analytics Array.isArray；approvals 错误态；去 dashboard 伪错误态 |
| Q93 | done | USER workbenchv3 / workflows-v2 / m/assets/1；403 子路径扩 |
| Q94 | done | empty-error 全量 **423 passed** |
| Q95 | done | Dashboard/Analytics Array.isArray；dashboard heading 1 passed |
| Q96 | done | ReportsPage Array.isArray |
| Q97 | done | reports/approvals 错误态 2 passed |
| Q98 | done | AssetFormPage departments/categories Array.isArray |
| Q99 | done | CategoryManagerPage treeData Array.isArray；categories 空/错 2 passed |
| Q100 | done | 错误态 17 passed；assets/1 空态 3 passed |
| Q101 | done | core-routes-smoke 9 passed；maintenance heading 2 passed |
| Q102 | done | AssetCompensationFormPage dept Array.isArray |
| Q103 | done | AssetTimeline/HistoryTimeline Array.isArray；timeline 4 passed；assets/1 空态 4 passed |
| Q104 | done | 抽测空态/未登录/错误态绿 |
| Q105 | done | browser-smoke 5 + publish-smoke 4 passed（R5） |
| Q106 | done | empty-error 全量 **485 passed** |
| Q107 | done | 空态 69 + 403/失败 188 + 未登录 209 passed |
| Q108 | done | vendor-portal 清 localStorage 防并行串扰；4 passed |
| Q109 | done | empty-error 全量 **557 passed** |
| Q110 | done | empty-error 全量 **563 passed** |
| Q111 | done | empty-error 全量 **592 passed** |
| Q112 | done | empty-error 全量 **608 passed** |
| Q113 | done | empty-error 全量 **626 passed** |
| Q114 | done | empty-error 全量 **649 passed** |
| Q115 | done | empty-error 全量 **655 passed** |
| Q116 | done | empty-error 全量 **673 passed** |
| Q117 | done | empty-error 全量 **691 passed** |
| Q118 | done | 10:00 硬停；R5 绿；未 commit |
| Q119 | done | empty-error 全量 **679 passed**；随后增量至 **759 tests** 抽测绿；10:00 硬停 |
| Q120 | in_progress | 截止改 18:00。扩 API 失败态：vendor-portal/audit/workflows/asset-health/dashboard |
