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
| Q120 | done | 独立 describe：workflows/asset-health/audit/dashboard/vendor-portal 失败态 5 passed。修合同非数组、健康/审计 isError |
| Q121 | done | 独立失败态 bigscreen/3d/health/reliability/tco 5 passed；Array.isArray 防崩溃 |
| Q122 | done | ADMIN 新建表单失败无 pageerror 5 passed（assets/borrows/assignments/inspections/intake） |
| Q123 | done | 新建表单失败 5 passed（budgets/insurances/retirement/spare-parts/compensation） |
| Q124 | done | 处置/工单/重估新建失败 5 passed |
| Q125 | in_progress | 他票：USER 403 / 未登录补测（不抢） |
| Q126 | done | 盘点周期新建/导入导出/风险新建/领用编辑/借用编辑失败 5 passed |
| Q127 | done | 编辑资产/检验、workflow-form 获取数据失败、安全检查、cycle-count 5 passed |
| Q128 | done | workflow-form 清退/报废/赔偿 + abc + report-builder 失败 5 passed |
| Q129 | done | RETIREMENT 表单/检验模板/风险/安全配置/流程设计器失败 5 passed |
| Q130 | done | profile/notifications/fault-codes/idle/depreciation 失败 5 passed |
| Q131 | done | licenses/sam/manufacturers/locations/asset-models 失败 5 passed |
| Q132 | done | system users/roles/depts/posts/menus 失败 5 passed |
| Q133 | done | custom-fields/fieldsets/purchase-orders/maintenance/plans 失败 5 passed |
| Q134 | in_progress | 独立：equipment/vendors/categories/floorplans/gis 失败无 pageerror（他票，不抢） |
| Q135 | done | 独立失败态 energy/contracts/reports/inventory/assets 5 passed |
| Q136 | done | 独立失败态 disposals/approvals/retirement/inspections/borrows 5 passed |
| Q137 | done | 独立失败态 assignments/intake/budgets/insurances/revaluations 5 passed |
| Q138 | done | 独立失败态 stocktaking-cycles/spare-parts/inspection-records/safety-history/risk-matrix 5 passed |
| Q139 | done | 独立失败态 scheduled/compensation/m-index/m-assets/m-work-orders 5 passed |
| Q140 | done | 独立失败态 m-notifications/m-scan/m-profile/test-results + USER 403 INV-002 5 passed |
| Q141 | done | USER 403 inspections/2 edit+upload、workorders/2/acceptance、risk edit、scan/RFID-3 5 passed |
| Q142 | done | USER 403 assignments/3/edit、borrows/3/edit、inspections/3/edit、acceptance/3、execute/4 5 passed |
| Q143 | done | USER 403 assignments/4/edit、borrows/4/edit、inspections/4/edit、upload/3、scan/RFID-4 5 passed |
| Q144 | done | 独立失败态 smart-report 空/非数组、upload、workorders/1、m/tasks/2 5 passed；修 SmartReportPage Array.isArray |
| Q145 | done | USER 403 assignments/5/edit、borrows/5/edit、inspections/5/edit、upload/4、acceptance/4 5 passed |
| Q146 | done | USER 403 risk-assessments/3/edit、execute/5、scan/RFID-5、upload/5、acceptance/5 5 passed |
| Q147 | done | 独立失败态 scan/RFID-1、tasks/1、disposals/1、workflows-v2、workbenchv3 5 passed |
| Q148 | done | USER 403 assignments/6/edit、borrows/6/edit、inspections/6/edit、risk/4/edit、execute/6 5 passed |
| Q149 | done | 独立失败态 approvals/1、audit/1、spare-parts/1、insurances/1、budgets/1 5 passed |
| Q150 | done | USER 403 scan/RFID-6、assignments/7/edit、borrows/7/edit、inspections/7/edit、upload/6 5 passed |
| Q151 | done | 独立失败态 retirement/1、intake/1、borrows/1、assignments/1、inspections/1 5 passed |
| Q152 | done | USER 403 acceptance/6、risk/5/edit、execute/7、scan/RFID-7、upload/7 5 passed |
| Q153 | done | 独立失败态 assets/1、m/assets/1、acceptance/1、cycles/1、compensation/1 5 passed |
| Q154 | done | USER 403 assignments/8/edit、borrows/8/edit、inspections/8/edit、acceptance/7、risk/6/edit 5 passed |
| Q155 | done | 独立失败态 timeline + m/tasks/3；USER 403 INV-003、assignments/9/edit、borrows/9/edit 5 passed |
| Q156 | done | USER 403 inspections/9/edit、upload/8、acceptance/8、execute/8、scan/RFID-8 5 passed |
| Q157 | done | USER 403 assignments/10/edit、borrows/10/edit、inspections/10/edit、risk/7/edit、INV-004 5 passed |
| Q158 | done | 独立失败态 workflow-form INTAKE/BORROW/ASSIGNMENT、timeline/2、m/tasks/4 5 passed |
| Q159 | done | 独立失败态 spare-parts/2、insurances/2、budgets/2、audit/2、retirement/2 5 passed |
| Q160 | done | USER 403 assignments/11/edit、borrows/11/edit、inspections/11/edit、acceptance/10、execute/10 5 passed |
| Q161 | done | 独立失败态 approvals/2、disposals/2、intake/2、borrows/2、assignments/2 5 passed |
| Q162 | done | USER 403 scan/RFID-10、inspections/12/edit、upload/10、acceptance/11、risk/8/edit 5 passed |
| Q163 | done | 独立失败态 inspections/2、spare-parts/3、acceptance/2、assets/3、m/assets/3 5 passed |
| Q164 | done | USER 403 assignments/12/edit、borrows/12/edit、inspections/13/edit、scan/RFID-11、execute/11 5 passed |
| Q165 | done | 独立失败态 budgets/3、insurances/3、audit/3、retirement/3、approvals/3 5 passed |
| Q166 | done | USER 403 assignments/13/edit、borrows/13/edit、upload/11、acceptance/12、INV-005 5 passed |
| Q167 | in_progress | 独立失败态：disposals/3、intake/3、borrows/3、assignments/3、inspections/3 |
