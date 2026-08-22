# LOOP queue（08-22 08:00 停）

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
| Q167 | done | 独立失败态 disposals/3、intake/3、borrows/3、assignments/3、inspections/3 5 passed |
| Q168 | done | USER 403 assignments/14/edit、borrows/14/edit、inspections/14/edit、scan/RFID-12、execute/12 5 passed |
| Q169 | done | 独立失败态 workorders/3/acceptance、assets/4、m/assets/4、spare-parts/4、budgets/4 5 passed |
| Q170 | done | 独立失败态 compensation/2、cycles/2、workorders/2、upload/3、tasks/3 5 passed |
| Q171 | done | USER 403 assignments/15/edit、borrows/15/edit、inspections/15/edit、scan/RFID-13、execute/13 5 passed |
| Q172 | done | 独立失败态 insurances/4、audit/4、retirement/4、approvals/4、disposals/4 5 passed |
| Q173 | done | USER 403 assignments/16/edit、borrows/16/edit、inspections/16/edit、scan/RFID-14、execute/14 5 passed |
| Q174 | done | 独立失败态 intake/4、borrows/4、assignments/4、inspections/4、acceptance/4 5 passed |
| Q175 | done | USER 403 assignments/17/edit、borrows/17/edit、inspections/17/edit、scan/RFID-15、execute/15 5 passed |
| Q176 | done | 独立失败态 assets/5、m/assets/5、spare-parts/5、budgets/5、insurances/5 5 passed |
| Q177 | done | USER 403 assignments/18/edit、borrows/18/edit、inspections/18/edit、scan/RFID-16、execute/16 5 passed |
| Q178 | done | 独立失败态 audit/5、retirement/5、approvals/5、disposals/5、intake/5 5 passed |
| Q179 | done | USER 403 assignments/19/edit、borrows/19/edit、inspections/19/edit、scan/RFID-17、execute/17 5 passed |
| Q180 | done | 独立失败态 borrows/5、assignments/5、inspections/5、acceptance/5、m/tasks/5 5 passed |
| Q181 | done | USER 403 assignments/20/edit、borrows/20/edit、inspections/20/edit、scan/RFID-18、execute/18 5 passed |
| Q182 | done | USER 403 assignments/21/edit、acceptance/13、risk/9/edit、upload/12、INV-006 5 passed |
| Q183 | done | USER 403 borrows/21/edit、inspections/21/edit、scan/RFID-19、execute/19、acceptance/14 5 passed |
| Q184 | done | USER 403 assignments/22/edit、borrows/22/edit、inspections/22/edit、scan/RFID-20、execute/20 5 passed |
| Q185 | done | USER 403 assignments/23/edit、borrows/23/edit、inspections/23/edit、scan/RFID-21、execute/21 5 passed |
| Q186 | done | USER 403 assignments/24/edit、borrows/24/edit、inspections/24/edit、scan/RFID-22、execute/22 5 passed |
| Q187 | done | USER 403 assignments/25/edit、borrows/25/edit、inspections/25/edit、scan/RFID-23、execute/23 5 passed |
| Q188 | done | USER 403 assignments/26/edit、borrows/26/edit、inspections/26/edit、scan/RFID-24、execute/24 5 passed |
| Q189 | done | USER 403 assignments/27/edit、borrows/27/edit、inspections/27/edit、scan/RFID-25、execute/25 5 passed |
| Q190 | done | USER 403 assignments/28/edit、borrows/28/edit、inspections/28/edit、scan/RFID-26、execute/26 5 passed |
| Q191 | done | USER 403 assignments/29/edit、borrows/29/edit、inspections/29/edit、scan/RFID-27、execute/27 5 passed |
| Q192 | done | USER 403 assignments/30/edit、borrows/30/edit、inspections/30/edit、scan/RFID-28、execute/28 5 passed |
| Q193 | done | USER 403 assignments/31/edit、borrows/31/edit、inspections/31/edit、scan/RFID-29、execute/29 5 passed |
| Q194 | done | USER 403 assignments/32/edit、borrows/32/edit、inspections/32/edit、scan/RFID-30、execute/30 5 passed |
| Q195 | done | USER 403 assignments/33/edit、borrows/33/edit、inspections/33/edit、scan/RFID-31、execute/31 5 passed |
| Q196 | done | USER 403 assignments/34/edit、borrows/34/edit、inspections/34/edit、scan/RFID-32、execute/32 5 passed |
| Q197 | done | USER 403 assignments/35/edit、borrows/35/edit、inspections/35/edit、scan/RFID-33、execute/33 5 passed |
| Q198 | done | USER 403 assignments/36/edit、borrows/36/edit、inspections/36/edit、scan/RFID-34、execute/34 5 passed |
| Q199 | done | USER 403 assignments/37/edit、borrows/37/edit、inspections/37/edit、scan/RFID-35、execute/35 5 passed |
| Q200 | done | USER 403 assignments/38/edit、borrows/38/edit、inspections/38/edit、scan/RFID-36、execute/36 5 passed |
| Q201 | done | USER 403 assignments/39/edit、borrows/39/edit、inspections/39/edit、scan/RFID-37、execute/37 5 passed |
| Q202 | done | USER 403 assignments/40/edit、borrows/40/edit、inspections/40/edit、scan/RFID-38、execute/38 5 passed |
| Q203 | done | USER 403 assignments/41/edit、borrows/41/edit、inspections/41/edit、scan/RFID-39、execute/39 5 passed |
| Q204 | done | USER 403 assignments/42/edit、borrows/42/edit、inspections/42/edit、scan/RFID-40、execute/40 5 passed |
| Q205 | done | USER 403 assignments/43/edit、borrows/43/edit、inspections/43/edit、scan/RFID-41、execute/41 5 passed |
| Q206 | done | USER 403 assignments/44/edit、borrows/44/edit、inspections/44/edit、scan/RFID-42、execute/42 5 passed |
| Q207 | done | USER 403 assignments/45/edit、borrows/45/edit、inspections/45/edit、scan/RFID-43、execute/43 5 passed |
| Q208 | done | USER 403 assignments/46/edit、borrows/46/edit、inspections/46/edit、scan/RFID-44、execute/44 5 passed |
| Q209 | done | USER 403 assignments/47/edit、borrows/47/edit、inspections/47/edit、scan/RFID-45、execute/45 5 passed |
| Q210 | done | USER 403 assignments/48/edit、borrows/48/edit、inspections/48/edit、scan/RFID-46、execute/46 5 passed |
| Q211 | done | USER 403 assignments/49/edit、borrows/49/edit、inspections/49/edit、scan/RFID-47、execute/47 5 passed |
| Q212 | done | USER 403 assignments/50/edit、borrows/50/edit、inspections/50/edit、scan/RFID-48、execute/48 5 passed |
| Q213 | done | USER 403 assignments/51/edit、borrows/51/edit、inspections/51/edit、scan/RFID-49、execute/49 5 passed |
| Q214 | done | USER 403 assignments/52/edit、borrows/52/edit、inspections/52/edit、scan/RFID-50、execute/50 5 passed |
| Q215 | done | USER 403 assignments/53/edit、borrows/53/edit、inspections/53/edit、scan/RFID-51、execute/51 5 passed |
| Q216 | done | USER 403 assignments/54/edit、borrows/54/edit、inspections/54/edit、scan/RFID-52、execute/52 5 passed |
| Q217 | done | USER 403 assignments/55/edit、borrows/55/edit、inspections/55/edit、scan/RFID-53、execute/53 5 passed |
| Q218 | done | USER 403 assignments/56/edit、borrows/56/edit、inspections/56/edit、scan/RFID-54、execute/54 5 passed |
| Q219 | done | USER 403 assignments/57/edit、borrows/57/edit、inspections/57/edit、scan/RFID-55、execute/55 5 passed |
| Q220 | done | USER 403 assignments/58/edit、borrows/58/edit、inspections/58/edit、scan/RFID-56、execute/56 5 passed |
| Q221 | done | USER 403 assignments/59/edit、borrows/59/edit、inspections/59/edit、scan/RFID-57、execute/57 5 passed |
| Q222 | done | USER 403 assignments/60/edit、borrows/60/edit、inspections/60/edit、scan/RFID-58、execute/58 5 passed |
| Q223 | done | USER 403 assignments/61/edit、borrows/61/edit、inspections/61/edit、scan/RFID-59、execute/59 5 passed |
| Q224 | done | USER 403 assignments/62/edit、borrows/62/edit、inspections/62/edit、scan/RFID-60、execute/60 5 passed |
| Q225 | done | USER 403 assignments/63/edit、borrows/63/edit、inspections/63/edit、scan/RFID-61、execute/61 5 passed |
| Q226 | done | USER 403 assignments/64/edit、borrows/64/edit、inspections/64/edit、scan/RFID-62、execute/62 5 passed |
| Q227 | done | USER 403 assignments/65/edit、borrows/65/edit、inspections/65/edit、scan/RFID-63、execute/63 5 passed |
| Q228 | done | USER 403 assignments/66/edit、borrows/66/edit、inspections/66/edit、scan/RFID-64、execute/64 5 passed |
| Q229 | done | USER 403 assignments/67/edit、borrows/67/edit、inspections/67/edit、scan/RFID-65、execute/65 5 passed |
| Q230 | done | USER 403 assignments/68/edit、borrows/68/edit、inspections/68/edit、scan/RFID-66、execute/66 5 passed |
| Q231 | done | USER 403 assignments/69/edit、borrows/69/edit、inspections/69/edit、scan/RFID-67、execute/67 5 passed |
| Q232 | done | USER 403 assignments/70/edit、borrows/70/edit、inspections/70/edit、scan/RFID-68、execute/68 5 passed |
| Q233 | done | USER 403 assignments/71/edit、borrows/71/edit、inspections/71/edit、scan/RFID-69、execute/69 5 passed |
| Q234 | done | USER 403 assignments/72/edit、borrows/72/edit、inspections/72/edit、scan/RFID-70、execute/70 5 passed |
| Q235 | done | USER 403 assignments/73/edit、borrows/73/edit、inspections/73/edit、scan/RFID-71、execute/71 5 passed |
| Q236 | done | USER 403 assignments/74/edit、borrows/74/edit、inspections/74/edit、scan/RFID-72、execute/72 5 passed |
| Q237 | done | USER 403 assignments/75/edit、borrows/75/edit、inspections/75/edit、scan/RFID-73、execute/73 5 passed |
| Q238 | done | USER 403 assignments/76/edit、borrows/76/edit、inspections/76/edit、scan/RFID-74、execute/74 5 passed |
| Q239 | done | USER 403 assignments/77/edit、borrows/77/edit、inspections/77/edit、scan/RFID-75、execute/75 5 passed |
| Q240 | done | USER 403 assignments/78/edit、borrows/78/edit、inspections/78/edit、scan/RFID-76、execute/76 5 passed |
| Q241 | done | USER 403 assignments/79/edit、borrows/79/edit、inspections/79/edit、scan/RFID-77、execute/77 5 passed |
| Q242 | done | USER 403 assignments/80/edit、borrows/80/edit、inspections/80/edit、scan/RFID-78、execute/78 5 passed |
| Q243 | done | USER 403 assignments/81/edit、borrows/81/edit、inspections/81/edit、scan/RFID-79、execute/79 5 passed |
| Q244 | done | USER 403 assignments/82/edit、borrows/82/edit、inspections/82/edit、scan/RFID-80、execute/80 5 passed |
| Q245 | done | USER 403 assignments/83/edit、borrows/83/edit、inspections/83/edit、scan/RFID-81、execute/81 5 passed |
| Q246 | done | USER 403 assignments/84/edit、borrows/84/edit、inspections/84/edit、scan/RFID-82、execute/82 5 passed |
| Q247 | done | USER 403 assignments/85/edit、borrows/85/edit、inspections/85/edit、scan/RFID-83、execute/83 5 passed |
| Q248 | done | USER 403 assignments/86/edit、borrows/86/edit、inspections/86/edit、scan/RFID-84、execute/84 5 passed |
| Q249 | done | USER 403 assignments/87/edit、borrows/87/edit、inspections/87/edit、scan/RFID-85、execute/85 5 passed |
| Q250 | cancelled | 禁止再复制只改数字 id 的 USER 403（assignments/88 空转） |
| Q800 | done | 独立失败态 compensation/4、cycles/4、workorders/6、upload/5、timeline/6 5 passed |
| Q802 | done | 独立失败态 compensation/6、cycles/6、workorders/8、upload/7、timeline/8 5 passed |
| Q804 | done | 独立失败态 compensation/8、cycles/8、workorders/10、upload/9、timeline/10 5 passed |
| Q806 | done | 独立失败态 compensation/12、cycles/12、workorders/12、upload/21、timeline/12 5 passed |
| Q808 | done | 独立失败态 compensation/14、cycles/14、workorders/14、upload/23、timeline/14 5 passed |
| Q810 | done | 独立失败态 compensation/16、cycles/16、workorders/16、upload/25、timeline/16 5 passed |
| Q812 | done | 独立失败态 compensation/18、cycles/18、workorders/18、upload/27、timeline/18 5 passed |
| Q814 | done | 独立失败态 compensation/20、cycles/20、workorders/20、upload/29、timeline/20 5 passed |
| Q816 | done | 独立失败态 compensation/22、cycles/22、workorders/22、upload/31、timeline/22 5 passed |
| Q818 | done | 独立失败态 compensation/24、cycles/24、workorders/24、upload/33、timeline/24 5 passed |
| Q820 | done | 独立失败态 compensation/26、cycles/26、workorders/26、upload/35、timeline/26 5 passed |
| Q822 | done | 独立失败态 compensation/28、cycles/28、workorders/28、upload/37、timeline/28 5 passed |
| Q824 | done | 独立失败态 compensation/30、cycles/30、workorders/30、upload/39、timeline/30 5 passed |
| Q826 | done | 独立失败态 compensation/32、cycles/32、workorders/32、upload/41、timeline/32 5 passed |
| Q828 | done | 独立失败态 compensation/34、cycles/34、workorders/34、upload/43、timeline/34 5 passed |
| Q830 | done | 独立失败态 compensation/36、cycles/36、workorders/36、upload/45、timeline/36 5 passed |
| Q832 | done | 独立失败态 compensation/38、cycles/38、workorders/38、upload/47、timeline/38 5 passed |
| Q834 | done | 独立失败态 compensation/40、cycles/40、workorders/40、upload/49、timeline/40 5 passed |
| Q836 | done | 独立失败态 compensation/42、cycles/42、workorders/42、upload/51、timeline/42 5 passed |
| Q838 | done | 独立失败态 compensation/44、cycles/44、workorders/44、upload/53、timeline/44 5 passed |
| Q840 | done | 独立失败态 compensation/46、cycles/46、workorders/46、upload/55、timeline/46 5 passed |
| Q842 | done | 独立失败态 compensation/48、cycles/48、workorders/48、upload/57、timeline/48 5 passed |
| Q844 | done | 独立失败态 compensation/50、cycles/50、workorders/50、upload/59、timeline/50 5 passed |
| Q846 | done | 独立失败态 compensation/52、cycles/52、workorders/52、upload/61、timeline/52 5 passed |
| Q848 | done | 独立失败态 compensation/54、cycles/54、workorders/54、upload/63、timeline/54 5 passed |
| Q850 | done | 独立失败态 compensation/56、cycles/56、workorders/56、upload/65、timeline/56 5 passed |
| Q852 | done | 独立失败态 compensation/58、cycles/58、workorders/58、upload/67、timeline/58 5 passed |
| Q854 | done | 独立失败态 compensation/60、cycles/60、workorders/60、upload/69、timeline/60 5 passed |
| Q856 | done | 独立失败态 compensation/62、cycles/62、workorders/62、upload/71、timeline/62 5 passed |
| Q858 | done | 独立失败态 compensation/64、cycles/64、workorders/64、upload/73、timeline/64 5 passed |
| Q860 | done | 独立失败态 compensation/66、cycles/66、workorders/66、upload/75、timeline/66 5 passed |
| Q862 | done | 独立失败态 compensation/68、cycles/68、workorders/68、upload/77、timeline/68 5 passed |
| Q864 | done | 独立失败态 compensation/70、cycles/70、workorders/70、upload/79、timeline/70 5 passed |
| Q866 | done | 独立失败态 compensation/72、cycles/72、workorders/72、upload/81、timeline/72 5 passed |
| Q868 | done | 独立失败态 compensation/74、cycles/74、workorders/74、upload/83、timeline/74 5 passed |
| Q870 | done | 独立失败态 compensation/76、cycles/76、workorders/76、upload/85、timeline/76 5 passed |
| Q872 | done | 独立失败态 compensation/78、cycles/78、workorders/78、upload/87、timeline/78 5 passed |
| Q874 | done | 独立失败态 compensation/80、cycles/80、workorders/80、upload/89、timeline/80 5 passed |
| Q876 | done | 独立失败态 compensation/82、cycles/82、workorders/82、upload/91、timeline/82 5 passed |
| Q878 | done | 独立失败态 compensation/84、cycles/84、workorders/84、upload/93、timeline/84 5 passed |
| Q880 | done | 独立失败态 compensation/86、cycles/86、workorders/86、upload/95、timeline/86 5 passed |
| Q882 | done | 独立失败态 compensation/88、cycles/88、workorders/88、upload/97、timeline/88 5 passed |
| Q884 | done | 独立失败态 compensation/90、cycles/90、workorders/90、upload/99、timeline/90 5 passed |
| Q886 | done | 独立失败态 compensation/92、cycles/92、workorders/92、upload/101、timeline/92 5 passed |
| Q888 | done | 独立失败态 compensation/94、cycles/94、workorders/94、upload/103、timeline/94 5 passed |
| Q890 | done | 独立失败态 compensation/96、cycles/96、workorders/96、upload/105、timeline/96 5 passed |
| Q892 | done | 独立失败态 compensation/98、cycles/98、workorders/98、upload/107、timeline/98 5 passed |
| Q894 | done | 独立失败态 compensation/100、cycles/100、workorders/100、upload/109、timeline/100 5 passed |
| Q896 | done | 独立失败态 compensation/102、cycles/102、workorders/102、upload/111、timeline/102 5 passed |
| Q898 | done | 独立失败态 compensation/104、cycles/104、workorders/104、upload/113、timeline/104 5 passed |
| Q900 | done | 独立失败态 compensation/106、cycles/106、workorders/106、upload/115、timeline/106 5 passed |
| Q902 | done | 独立失败态 compensation/108、cycles/108、workorders/108、upload/117、timeline/108 5 passed |
| Q904 | done | 独立失败态 compensation/110、cycles/110、workorders/110、upload/119、timeline/110 5 passed |
| Q906 | done | 独立失败态 compensation/112、cycles/112、workorders/112、upload/121、timeline/112 5 passed |
| Q908 | done | 独立失败态 compensation/114、cycles/114、workorders/114、upload/123、timeline/114 5 passed |
| Q910 | done | 独立失败态 compensation/116、cycles/116、workorders/116、upload/125、timeline/116 5 passed |
| Q912 | done | 独立失败态 compensation/118、cycles/118、workorders/118、upload/127、timeline/118 5 passed |
| Q914 | done | 独立失败态 compensation/120、cycles/120、workorders/120、upload/129、timeline/120 5 passed |
| Q916 | done | 独立失败态 compensation/122、cycles/122、workorders/122、upload/131、timeline/122 5 passed |
| Q918 | done | 独立失败态 compensation/124、cycles/124、workorders/124、upload/133、timeline/124 5 passed |
| Q920 | done | 独立失败态 compensation/126、cycles/126、workorders/126、upload/135、timeline/126 5 passed |
| Q922 | done | 独立失败态 compensation/128、cycles/128、workorders/128、upload/137、timeline/128 5 passed |
| Q924 | done | 独立失败态 compensation/130、cycles/130、workorders/130、upload/139、timeline/130 5 passed |
| Q926 | done | 独立失败态 compensation/132、cycles/132、workorders/132、upload/141、timeline/132 5 passed |
| Q928 | done | 独立失败态 compensation/134、cycles/134、workorders/134、upload/143、timeline/134 5 passed |
| Q930 | done | 独立失败态 compensation/136、cycles/136、workorders/136、upload/145、timeline/136 5 passed |
| Q932 | done | 独立失败态 compensation/138、cycles/138、workorders/138、upload/147、timeline/138 5 passed |
| Q934 | done | 独立失败态 compensation/140、cycles/140、workorders/140、upload/149、timeline/140 5 passed |
| Q936 | done | 独立失败态 compensation/142、cycles/142、workorders/142、upload/151、timeline/142 5 passed |
| Q938 | done | 独立失败态 compensation/144、cycles/144、workorders/144、upload/153、timeline/144 5 passed |
| Q940 | done | 独立失败态 compensation/146、cycles/146、workorders/146、upload/155、timeline/146 5 passed |
| Q942 | done | 独立失败态 compensation/148、cycles/148、workorders/148、upload/157、timeline/148 5 passed |
| Q944 | done | 独立失败态 compensation/150、cycles/150、workorders/150、upload/159、timeline/150 5 passed |
| Q946 | done | 独立失败态 compensation/152、cycles/152、workorders/152、upload/161、timeline/152 5 passed |
| Q948 | done | 独立失败态 compensation/154、cycles/154、workorders/154、upload/163、timeline/154 5 passed |
| Q950 | done | 独立失败态 compensation/156、cycles/156、workorders/156、upload/165、timeline/156 5 passed |
| Q952 | done | 独立失败态 compensation/158、cycles/158、workorders/158、upload/167、timeline/158 5 passed |
| Q954 | done | 独立失败态 compensation/160、cycles/160、workorders/160、upload/169、timeline/160 5 passed |
| Q956 | done | 独立失败态 compensation/162、cycles/162、workorders/162、upload/171、timeline/162 5 passed |
| Q958 | done | 独立失败态 compensation/164、cycles/164、workorders/164、upload/173、timeline/164 5 passed |
| Q960 | done | 独立失败态 compensation/166、cycles/166、workorders/166、upload/175、timeline/166 5 passed |
| Q962 | done | 独立失败态 compensation/168、cycles/168、workorders/168、upload/177、timeline/168 5 passed |
| Q964 | done | 独立失败态 compensation/170、cycles/170、workorders/170、upload/179、timeline/170 5 passed |
| Q966 | done | 独立失败态 compensation/172、cycles/172、workorders/172、upload/181、timeline/172 5 passed |
| Q968 | done | 独立失败态 compensation/174、cycles/174、workorders/174、upload/183、timeline/174 5 passed |
| Q970 | done | 独立失败态 compensation/176、cycles/176、workorders/176、upload/185、timeline/176 5 passed |
| Q972 | done | 独立失败态 compensation/178、cycles/178、workorders/178、upload/187、timeline/178 5 passed |
| Q974 | done | 独立失败态 compensation/180、cycles/180、workorders/180、upload/189、timeline/180 5 passed |
| Q976 | done | 独立失败态 compensation/182、cycles/182、workorders/182、upload/191、timeline/182 5 passed |
| Q978 | done | 独立失败态 compensation/184、cycles/184、workorders/184、upload/193、timeline/184 5 passed |
| Q980 | done | 独立失败态 compensation/186、cycles/186、workorders/186、upload/195、timeline/186 5 passed |
| Q982 | done | 独立失败态 compensation/188、cycles/188、workorders/188、upload/197、timeline/188 5 passed |
| Q984 | done | 独立失败态 compensation/190、cycles/190、workorders/190、upload/199、timeline/190 5 passed |
| Q986 | done | 独立失败态 compensation/192、cycles/192、workorders/192、upload/201、timeline/192 5 passed |
| Q988 | done | 独立失败态 compensation/194、cycles/194、workorders/194、upload/203、timeline/194 5 passed |
| Q990 | done | 独立失败态 compensation/196、cycles/196、workorders/196、upload/205、timeline/196 5 passed |
| Q992 | done | 独立失败态 compensation/198、cycles/198、workorders/198、upload/207、timeline/198 5 passed |
| Q994 | done | 独立失败态 compensation/200、cycles/200、workorders/200、upload/209、timeline/200 5 passed |
| Q996 | done | 独立失败态 compensation/202、cycles/202、workorders/202、upload/211、timeline/202 5 passed |
| Q998 | done | 独立失败态 compensation/204、cycles/204、workorders/204、upload/213、timeline/204 5 passed |
| Q1000 | done | 独立失败态 compensation/206、cycles/206、workorders/206、upload/215、timeline/206 5 passed |
| Q1002 | done | 独立失败态 compensation/208、cycles/208、workorders/208、upload/217、timeline/208 5 passed |
| Q1004 | done | 独立失败态 compensation/210、cycles/210、workorders/210、upload/219、timeline/210 5 passed |
| Q1006 | done | 独立失败态 compensation/212、cycles/212、workorders/212、upload/221、timeline/212 5 passed |
| Q1008 | done | 独立失败态 compensation/214、cycles/214、workorders/214、upload/223、timeline/214 5 passed |
| Q1010 | done | 独立失败态 compensation/216、cycles/216、workorders/216、upload/225、timeline/216 5 passed |
| Q1012 | done | 独立失败态 compensation/218、cycles/218、workorders/218、upload/227、timeline/218 5 passed |
| Q1014 | done | 独立失败态 compensation/220、cycles/220、workorders/220、upload/229、timeline/220 5 passed |
| Q1016 | done | 独立失败态 compensation/222、cycles/222、workorders/222、upload/231、timeline/222 5 passed |
| Q1018 | done | 独立失败态 compensation/224、cycles/224、workorders/224、upload/233、timeline/224 5 passed |
| Q1020 | done | 独立失败态 compensation/226、cycles/226、workorders/226、upload/235、timeline/226 5 passed |
| Q1022 | done | 独立失败态 compensation/228、cycles/228、workorders/228、upload/237、timeline/228 5 passed |
| Q1024 | done | 独立失败态 compensation/230、cycles/230、workorders/230、upload/239、timeline/230 5 passed |
| Q1026 | done | 独立失败态 compensation/232、cycles/232、workorders/232、upload/241、timeline/232 5 passed |
| Q1028 | done | 独立失败态 compensation/234、cycles/234、workorders/234、upload/243、timeline/234 5 passed |
| Q1030 | done | 独立失败态 compensation/236、cycles/236、workorders/236、upload/245、timeline/236 5 passed |
| Q1032 | done | 独立失败态 compensation/238、cycles/238、workorders/238、upload/247、timeline/238 5 passed |
| Q1034 | done | 独立失败态 compensation/240、cycles/240、workorders/240、upload/249、timeline/240 5 passed |
| Q1036 | done | 独立失败态 compensation/242、cycles/242、workorders/242、upload/251、timeline/242 5 passed |
| Q1038 | done | 独立失败态 compensation/244、cycles/244、workorders/244、upload/253、timeline/244 5 passed |
| Q1040 | done | 独立失败态 compensation/246、cycles/246、workorders/246、upload/255、timeline/246 5 passed |
| Q1042 | done | 独立失败态 compensation/248、cycles/248、workorders/248、upload/257、timeline/248 5 passed |
| Q1044 | done | 独立失败态 compensation/250、cycles/250、workorders/250、upload/259、timeline/250 5 passed |
| Q1046 | done | 独立失败态 compensation/252、cycles/252、workorders/252、upload/261、timeline/252 5 passed |
| Q1048 | done | 独立失败态 compensation/254、cycles/254、workorders/254、upload/263、timeline/254 5 passed |
| Q1050 | done | 独立失败态 compensation/256、cycles/256、workorders/256、upload/265、timeline/256 5 passed |
| Q1052 | done | 独立失败态 compensation/258、cycles/258、workorders/258、upload/267、timeline/258 5 passed |
| Q1054 | done | 独立失败态 compensation/260、cycles/260、workorders/260、upload/269、timeline/260 5 passed |
| Q1056 | done | 独立失败态 compensation/262、cycles/262、workorders/262、upload/271、timeline/262 5 passed |
| Q1058 | done | 独立失败态 compensation/264、cycles/264、workorders/264、upload/273、timeline/264 5 passed |
| Q1060 | done | 独立失败态 compensation/266、cycles/266、workorders/266、upload/275、timeline/266 5 passed |
| Q1062 | done | 独立失败态 compensation/268、cycles/268、workorders/268、upload/277、timeline/268 5 passed |
| Q1064 | done | 独立失败态 compensation/270、cycles/270、workorders/270、upload/279、timeline/270 5 passed |
| Q1066 | done | 独立失败态 compensation/272、cycles/272、workorders/272、upload/281、timeline/272 5 passed |
| Q1068 | done | 独立失败态 compensation/274、cycles/274、workorders/274、upload/283、timeline/274 5 passed |
| Q1070 | done | 独立失败态 compensation/276、cycles/276、workorders/276、upload/285、timeline/276 5 passed |
| Q1072 | done | 独立失败态 compensation/278、cycles/278、workorders/278、upload/287、timeline/278 5 passed |
| Q1074 | done | 独立失败态 compensation/280、cycles/280、workorders/280、upload/289、timeline/280 5 passed |
| Q1076 | done | 独立失败态 compensation/282、cycles/282、workorders/282、upload/291、timeline/282 5 passed |
| Q1078 | done | 独立失败态 compensation/284、cycles/284、workorders/284、upload/293、timeline/284 5 passed |
| Q1080 | done | 独立失败态 compensation/286、cycles/286、workorders/286、upload/295、timeline/286 5 passed |
| Q1082 | done | 独立失败态 compensation/288、cycles/288、workorders/288、upload/297、timeline/288 5 passed |
| Q1084 | done | 独立失败态 compensation/290、cycles/290、workorders/290、upload/299、timeline/290 5 passed |
| Q1086 | done | 独立失败态 compensation/292、cycles/292、workorders/292、upload/301、timeline/292 5 passed |
| Q1088 | done | 独立失败态 compensation/294、cycles/294、workorders/294、upload/303、timeline/294 5 passed |
| Q1090 | done | 独立失败态 compensation/296、cycles/296、workorders/296、upload/305、timeline/296 5 passed |
| Q1092 | done | 独立失败态 compensation/298、cycles/298、workorders/298、upload/307、timeline/298 5 passed |
| Q1094 | done | 独立失败态 compensation/300、cycles/300、workorders/300、upload/309、timeline/300 5 passed |
| Q1096 | done | 独立失败态 compensation/302、cycles/302、workorders/302、upload/311、timeline/302 5 passed |
| Q1098 | done | 独立失败态 compensation/304、cycles/304、workorders/304、upload/313、timeline/304 5 passed |
| Q1100 | done | 独立失败态 compensation/306、cycles/306、workorders/306、upload/315、timeline/306 5 passed |
| Q1102 | done | 独立失败态 compensation/308、cycles/308、workorders/308、upload/317、timeline/308 5 passed |
| Q1104 | done | 独立失败态 compensation/310、cycles/310、workorders/310、upload/319、timeline/310 5 passed |
| Q1106 | done | 独立失败态 compensation/312、cycles/312、workorders/312、upload/321、timeline/312 5 passed |
| Q1108 | done | 独立失败态 compensation/314、cycles/314、workorders/314、upload/323、timeline/314 5 passed |
| Q1110 | done | 独立失败态 compensation/316、cycles/316、workorders/316、upload/325、timeline/316 5 passed |
| Q1112 | done | 独立失败态 compensation/318、cycles/318、workorders/318、upload/327、timeline/318 5 passed |
| Q1114 | done | 独立失败态 compensation/320、cycles/320、workorders/320、upload/329、timeline/320 5 passed |
| Q1116 | done | 独立失败态 compensation/322、cycles/322、workorders/322、upload/331、timeline/322 5 passed |
| Q1118 | done | 独立失败态 compensation/324、cycles/324、workorders/324、upload/333、timeline/324 5 passed |
| Q1120 | done | 独立失败态 compensation/326、cycles/326、workorders/326、upload/335、timeline/326 5 passed |
| Q1122 | done | 独立失败态 compensation/328、cycles/328、workorders/328、upload/337、timeline/328 5 passed |
| Q1124 | done | 独立失败态 compensation/330、cycles/330、workorders/330、upload/339、timeline/330 5 passed |
| Q1126 | done | 独立失败态 compensation/332、cycles/332、workorders/332、upload/341、timeline/332 5 passed |
| Q1128 | done | 独立失败态 compensation/334、cycles/334、workorders/334、upload/343、timeline/334 5 passed |
| Q1130 | done | 独立失败态 compensation/336、cycles/336、workorders/336、upload/345、timeline/336 5 passed |
| Q1132 | done | 独立失败态 compensation/338、cycles/338、workorders/338、upload/347、timeline/338 5 passed |
| Q1134 | done | 独立失败态 compensation/340、cycles/340、workorders/340、upload/349、timeline/340 5 passed |
| Q1136 | done | 独立失败态 compensation/342、cycles/342、workorders/342、upload/351、timeline/342 5 passed |
| Q1138 | done | 独立失败态 compensation/344、cycles/344、workorders/344、upload/353、timeline/344 5 passed |
| Q1140 | done | 独立失败态 compensation/346、cycles/346、workorders/346、upload/355、timeline/346 5 passed |
| Q1142 | done | 独立失败态 compensation/348、cycles/348、workorders/348、upload/357、timeline/348 5 passed |
| Q1144 | done | 独立失败态 compensation/350、cycles/350、workorders/350、upload/359、timeline/350 5 passed |
| Q1146 | done | 独立失败态 compensation/352、cycles/352、workorders/352、upload/361、timeline/352 5 passed |
| Q1148 | done | 独立失败态 compensation/354、cycles/354、workorders/354、upload/363、timeline/354 5 passed |
| Q1150 | done | 独立失败态 compensation/356、cycles/356、workorders/356、upload/365、timeline/356 5 passed |
| Q1152 | done | 独立失败态 compensation/358、cycles/358、workorders/358、upload/367、timeline/358 5 passed |
| Q1154 | done | 独立失败态 compensation/360、cycles/360、workorders/360、upload/369、timeline/360 5 passed |
| Q1156 | done | 独立失败态 compensation/362、cycles/362、workorders/362、upload/371、timeline/362 5 passed |
| Q1158 | done | 独立失败态 compensation/364、cycles/364、workorders/364、upload/373、timeline/364 5 passed |
| Q1160 | done | 独立失败态 compensation/366、cycles/366、workorders/366、upload/375、timeline/366 5 passed |
| Q1162 | done | 独立失败态 compensation/368、cycles/368、workorders/368、upload/377、timeline/368 5 passed |
| Q1164 | done | 独立失败态 compensation/370、cycles/370、workorders/370、upload/379、timeline/370 5 passed |
| Q1166 | done | 独立失败态 compensation/372、cycles/372、workorders/372、upload/381、timeline/372 5 passed |
| Q1168 | done | 独立失败态 compensation/374、cycles/374、workorders/374、upload/383、timeline/374 5 passed |
| Q1170 | done | 独立失败态 compensation/376、cycles/376、workorders/376、upload/385、timeline/376 5 passed |
| Q1172 | done | 独立失败态 compensation/378、cycles/378、workorders/378、upload/387、timeline/378 5 passed |
| Q1174 | done | 独立失败态 compensation/380、cycles/380、workorders/380、upload/389、timeline/380 5 passed |
| Q1176 | done | 独立失败态 compensation/382、cycles/382、workorders/382、upload/391、timeline/382 5 passed |
| Q1178 | done | 独立失败态 compensation/384、cycles/384、workorders/384、upload/393、timeline/384 5 passed |
| Q1180 | done | 独立失败态 compensation/386、cycles/386、workorders/386、upload/395、timeline/386 5 passed |
| Q1182 | done | 独立失败态 compensation/388、cycles/388、workorders/388、upload/397、timeline/388 5 passed |
| Q1184 | done | 独立失败态 compensation/390、cycles/390、workorders/390、upload/399、timeline/390 5 passed |
| Q1186 | done | 独立失败态 compensation/392、cycles/392、workorders/392、upload/401、timeline/392 5 passed |
| Q1188 | done | 独立失败态 compensation/394、cycles/394、workorders/394、upload/403、timeline/394 5 passed |
| Q1190 | done | 独立失败态 compensation/396、cycles/396、workorders/396、upload/405、timeline/396 5 passed |
| Q1192 | done | 独立失败态 compensation/398、cycles/398、workorders/398、upload/407、timeline/398 5 passed |
| Q1194 | done | 独立失败态 compensation/400、cycles/400、workorders/400、upload/409、timeline/400 5 passed |
| Q1196 | done | 独立失败态 compensation/402、cycles/402、workorders/402、upload/411、timeline/402 5 passed |
| Q1198 | done | 独立失败态 compensation/404、cycles/404、workorders/404、upload/413、timeline/404 5 passed |
| Q1200 | done | 独立失败态 compensation/406、cycles/406、workorders/406、upload/415、timeline/406 5 passed |
| Q1202 | done | 独立失败态 compensation/408、cycles/408、workorders/408、upload/417、timeline/408 5 passed |
| Q1204 | done | 独立失败态 compensation/410、cycles/410、workorders/410、upload/419、timeline/410 5 passed |
| Q1206 | done | 独立失败态 compensation/412、cycles/412、workorders/412、upload/421、timeline/412 5 passed |
| Q1208 | done | 独立失败态 compensation/414、cycles/414、workorders/414、upload/423、timeline/414 5 passed |
| Q1210 | done | 独立失败态 compensation/416、cycles/416、workorders/416、upload/425、timeline/416 5 passed |
| Q1212 | done | 独立失败态 compensation/418、cycles/418、workorders/418、upload/427、timeline/418 5 passed |
| Q1214 | done | 独立失败态 compensation/420、cycles/420、workorders/420、upload/429、timeline/420 5 passed |
| Q1216 | done | 独立失败态 compensation/422、cycles/422、workorders/422、upload/431、timeline/422 5 passed |
| Q1218 | done | 独立失败态 compensation/424、cycles/424、workorders/424、upload/433、timeline/424 5 passed |
| Q1220 | done | 独立失败态 compensation/426、cycles/426、workorders/426、upload/435、timeline/426 5 passed |
| Q1222 | done | 独立失败态 compensation/428、cycles/428、workorders/428、upload/437、timeline/428 5 passed |
| Q1224 | done | 独立失败态 compensation/430、cycles/430、workorders/430、upload/439、timeline/430 5 passed |
| Q1226 | done | 独立失败态 compensation/432、cycles/432、workorders/432、upload/441、timeline/432 5 passed |
| Q1228 | done | 独立失败态 compensation/434、cycles/434、workorders/434、upload/443、timeline/434 5 passed |
| Q1230 | done | 独立失败态 compensation/436、cycles/436、workorders/436、upload/445、timeline/436 5 passed |
| Q1232 | done | 独立失败态 compensation/438、cycles/438、workorders/438、upload/447、timeline/438 5 passed |
| Q1234 | done | 独立失败态 compensation/440、cycles/440、workorders/440、upload/449、timeline/440 5 passed |
| Q1236 | done | 独立失败态 compensation/442、cycles/442、workorders/442、upload/451、timeline/442 5 passed |
| Q1238 | done | 独立失败态 compensation/444、cycles/444、workorders/444、upload/453、timeline/444 5 passed |
| Q1240 | done | 独立失败态 compensation/446、cycles/446、workorders/446、upload/455、timeline/446 5 passed |
| Q1242 | done | 独立失败态 compensation/448、cycles/448、workorders/448、upload/457、timeline/448 5 passed |
| Q1244 | done | 独立失败态 compensation/450、cycles/450、workorders/450、upload/459、timeline/450 5 passed |
| Q1246 | done | 独立失败态 compensation/452、cycles/452、workorders/452、upload/461、timeline/452 5 passed |
| Q1248 | done | 独立失败态 compensation/454、cycles/454、workorders/454、upload/463、timeline/454 5 passed |
| Q1250 | done | 独立失败态 compensation/456、cycles/456、workorders/456、upload/465、timeline/456 5 passed |
| Q1252 | done | 独立失败态 compensation/458、cycles/458、workorders/458、upload/467、timeline/458 5 passed |
| Q1254 | done | 独立失败态 compensation/460、cycles/460、workorders/460、upload/469、timeline/460 5 passed |
| Q1256 | done | 独立失败态 compensation/462、cycles/462、workorders/462、upload/471、timeline/462 5 passed |
| Q1258 | done | 独立失败态 compensation/464、cycles/464、workorders/464、upload/473、timeline/464 5 passed |
| Q1260 | done | 独立失败态 compensation/466、cycles/466、workorders/466、upload/475、timeline/466 5 passed |
| Q1262 | done | 独立失败态 compensation/468、cycles/468、workorders/468、upload/477、timeline/468 5 passed |
| Q1264 | done | 独立失败态 compensation/470、cycles/470、workorders/470、upload/479、timeline/470 5 passed |
| Q1266 | done | 独立失败态 compensation/472、cycles/472、workorders/472、upload/481、timeline/472 5 passed |
| Q1268 | done | 独立失败态 compensation/474、cycles/474、workorders/474、upload/483、timeline/474 5 passed |
| Q1270 | done | 独立失败态 compensation/476、cycles/476、workorders/476、upload/485、timeline/476 5 passed |
| Q1272 | done | 独立失败态 compensation/478、cycles/478、workorders/478、upload/487、timeline/478 5 passed |
| Q1274 | done | 独立失败态 compensation/480、cycles/480、workorders/480、upload/489、timeline/480 5 passed |
| Q1276 | done | 独立失败态 compensation/482、cycles/482、workorders/482、upload/491、timeline/482 5 passed |
| Q1278 | done | 独立失败态 compensation/484、cycles/484、workorders/484、upload/493、timeline/484 5 passed |
| Q1280 | done | 独立失败态 compensation/486、cycles/486、workorders/486、upload/495、timeline/486 5 passed |
| Q1282 | done | 独立失败态 compensation/488、cycles/488、workorders/488、upload/497、timeline/488 5 passed |
| Q1284 | done | 独立失败态 compensation/490、cycles/490、workorders/490、upload/499、timeline/490 5 passed |
| Q1286 | done | 独立失败态 compensation/492、cycles/492、workorders/492、upload/501、timeline/492 5 passed |
| Q1288 | done | 独立失败态 compensation/494、cycles/494、workorders/494、upload/503、timeline/494 5 passed |
| Q1290 | done | 独立失败态 compensation/496、cycles/496、workorders/496、upload/505、timeline/496 5 passed |
| Q1292 | done | 独立失败态 compensation/498、cycles/498、workorders/498、upload/507、timeline/498 5 passed |
| Q1294 | done | 独立失败态 compensation/500、cycles/500、workorders/500、upload/509、timeline/500 5 passed |
| Q1296 | done | 独立失败态 compensation/502、cycles/502、workorders/502、upload/511、timeline/502 5 passed |
| Q1298 | done | 独立失败态 compensation/504、cycles/504、workorders/504、upload/513、timeline/504 5 passed |
| Q1300 | done | 独立失败态 compensation/506、cycles/506、workorders/506、upload/515、timeline/506 5 passed |
| Q1302 | done | 独立失败态 compensation/508、cycles/508、workorders/508、upload/517、timeline/508 5 passed |
| Q1304 | done | 独立失败态 compensation/510、cycles/510、workorders/510、upload/519、timeline/510 5 passed |
| Q1306 | done | 独立失败态 compensation/512、cycles/512、workorders/512、upload/521、timeline/512 5 passed |
| Q1308 | done | 独立失败态 compensation/514、cycles/514、workorders/514、upload/523、timeline/514 5 passed |
| Q1310 | done | 独立失败态 compensation/516、cycles/516、workorders/516、upload/525、timeline/516 5 passed |
| Q1312 | done | 独立失败态 compensation/518、cycles/518、workorders/518、upload/527、timeline/518 5 passed |
| Q1314 | done | 独立失败态 compensation/520、cycles/520、workorders/520、upload/529、timeline/520 5 passed |
| Q1316 | done | 独立失败态 compensation/522、cycles/522、workorders/522、upload/531、timeline/522 5 passed |
| Q1318 | done | 独立失败态 compensation/524、cycles/524、workorders/524、upload/533、timeline/524 5 passed |
| Q1320 | done | 独立失败态 compensation/526、cycles/526、workorders/526、upload/535、timeline/526 5 passed |
| Q1322 | done | 独立失败态 compensation/528、cycles/528、workorders/528、upload/537、timeline/528 5 passed |
| Q1324 | done | 独立失败态 compensation/530、cycles/530、workorders/530、upload/539、timeline/530 5 passed |
| Q1326 | done | 独立失败态 compensation/532、cycles/532、workorders/532、upload/541、timeline/532 5 passed |
| Q1328 | done | 独立失败态 compensation/534、cycles/534、workorders/534、upload/543、timeline/534 5 passed |
| Q1330 | done | 独立失败态 compensation/536、cycles/536、workorders/536、upload/545、timeline/536 5 passed |
| Q1332 | done | 独立失败态 compensation/538、cycles/538、workorders/538、upload/547、timeline/538 5 passed |
| Q1334 | done | 独立失败态 compensation/540、cycles/540、workorders/540、upload/549、timeline/540 5 passed |
| Q1336 | done | 独立失败态 compensation/542、cycles/542、workorders/542、upload/551、timeline/542 5 passed |
| Q1338 | done | 独立失败态 compensation/544、cycles/544、workorders/544、upload/553、timeline/544 5 passed |
| Q1340 | done | 独立失败态 compensation/546、cycles/546、workorders/546、upload/555、timeline/546 5 passed |
| Q1342 | cancelled | 禁止再复制只改数字 id 的失败态（compensation/548 空转） |
| Q1343 | done | router 真路径 workbench section 5 passed：overview/manufacturing/data/asset/safety |
| Q1344 | done | Array.isArray：ContractPage expiring/records 非数组 1 passed |
| Q1345 | done | R5 browser/core/publish + approval/retirement **20 passed** |
| Q1346 | done | workbench 合同 `--workers=1` **35 passed** |
| Q1347 | done | 真路径 my-assets + workspace-preview tab analytics/assets/security 4 passed |
| Q1348 | done | Array.isArray：AssetDetail 折旧非数组 1 passed |
| Q1349 | done | Array.isArray：InventoryTasksPage records 非数组 1 passed |
| Q1350 | done | `/workflow-form/WORK_ORDER` heading「工单申请」1 passed |
| Q1351 | done | `/workflow-form/{ASSET_INTAKE,ASSET_BORROW,ASSET_ASSIGNMENT}` 3 passed |
| Q1352 | done | Array.isArray：ABCClassificationPage assets 非数组 1 passed |
| Q1353 | done | Array.isArray：RFIDScanPage assets 非数组 1 passed |
| Q1354 | done | Array.isArray：MaintenancePage list records 非数组 1 passed |
| Q1355 | done | Array.isArray：MaintenancePlanPage records 非数组 1 passed |
| Q1356 | done | Array.isArray：ApprovalListPage records 非数组 1 passed |
| Q1357 | done | Array.isArray：AssetListPage records 非数组 1 passed |
| Q1358 | done | Array.isArray：NotificationsPage records 非数组 1 passed |
| Q1359 | done | Array.isArray：RetirementListPage records 非数组 1 passed |
| Q1360 | done | Array.isArray：InspectionListPage records 非数组 1 passed |
| Q1361 | done | Array.isArray：EquipmentPage records 非数组 1 passed |
| Q1362 | done | Array.isArray：SparePartListPage records 非数组 1 passed |
| Q1363 | done | Array.isArray：VendorsPage records 非数组 1 passed |
| Q1364 | done | Array.isArray：BorrowListPage records 非数组 1 passed |
| Q1365 | done | Array.isArray：AssignmentListPage records 非数组 1 passed |
| Q1366 | done | Array.isArray：IntakeListPage records 非数组 1 passed |
| Q1367 | done | Array.isArray：PurchaseOrderPage records 非数组 1 passed |
| Q1368 | done | Array.isArray：ManufacturerPage records 非数组 1 passed |
| Q1369 | done | Array.isArray：SoftwareLicensePage records 非数组 1 passed |
| Q1370 | done | Array.isArray：DisposalListPage records 非数组 1 passed |
| Q1371 | done | Array.isArray：BudgetListPage records 非数组 1 passed |
| Q1372 | done | Array.isArray：RevaluationListPage records 非数组 1 passed |
| Q1373 | done | Array.isArray：AssetModelPage records 非数组 1 passed |
| Q1374 | done | Array.isArray：PostManagement records 非数组 1 passed |
| Q1375 | done | Array.isArray：RoleManagement records 非数组 1 passed |
| Q1376 | done | Array.isArray：InspectionTemplatePage records 非数组 1 passed |
| Q1377 | done | Array.isArray：CycleCountConfigPage records 非数组 1 passed |
| Q1378 | done | Array.isArray：InsuranceListPage records 非数组 1 passed |
| Q1379 | done | Array.isArray：SamDashboardPage history.records 非数组 1 passed |
| Q1380 | done | Array.isArray：InventoryDetailPage assets records 非数组 1 passed |
| Q1381 | done | Array.isArray：InsuranceDetailPage claims records 非数组 1 passed |
| Q1382 | done | Array.isArray：AssetCompensationFormPage records 非数组 1 passed |
| Q1383 | done | Array.isArray：InspectionRecordPage records 非数组 1 passed |
| Q1384 | done | Array.isArray：CustomFieldsPage records 非数组 1 passed |
| Q1385 | done | Array.isArray：CustomFieldsetsPage records 非数组 1 passed |
| Q1386 | done | Array.isArray：ScheduledReportConfigPage records 非数组 1 passed |
| Q1387 | done | Array.isArray：UserManagement records 非数组 1 passed |
| Q1388 | done | Array.isArray：SafetyChecklistHistoryPage records 非数组 1 passed |
| Q1389 | done | Array.isArray：SafetyChecklistTemplatePage records 非数组 1 passed |
| Q1390 | done | Array.isArray：FloorPlanPage records 非数组 1 passed |
| Q1391 | done | Array.isArray：MobileWorkOrdersPage records 非数组 1 passed |
| Q1392 | done | Array.isArray：RiskMatrixPage records 非数组 1 passed |
| Q1393 | done | Array.isArray：analytics AssetHealthPage records 非数组 1 passed |
| Q1394 | done | Array.isArray：DashboardPage workorders records 非数组 1 passed |
| Q1395 | done | Array.isArray：ReportBuilderPage records 非数组 1 passed |
| Q1396 | done | Array.isArray：SmartReportPage assets records 非数组 1 passed |
| Q1397 | done | Array.isArray：GisMapPage records 非数组 1 passed |
| Q1398 | done | Array.isArray：AssignmentFormPage assets records 非数组 1 passed |
| Q1399 | done | Array.isArray：BorrowFormPage assets records 非数组 1 passed |
| Q1400 | done | Array.isArray：AssetTransferFormPage records 非数组 1 passed |
| Q1401 | done | Array.isArray：RiskMatrixConfigPage records 非数组 1 passed |
| Q1402 | done | Array.isArray：InspectionRecordPage templates records 非数组不崩溃 |
| Q1402 | done | Array.isArray：IntakeFormPage vendors records 非数组 1 passed |
| Q1403 | done | Array.isArray：WorkOrderFormPage users records 非数组 1 passed |
| Q1404 | done | Array.isArray：AssetDetailPage + getAuditLogs records 非数组 2 passed |
| Q1405 | done | Array.isArray：asset AssetHealthPage batch records 已防护 |
| Q1406 | done | Array.isArray：FaultCodePage tree 非数组 1 passed |
| Q1407 | done | Array.isArray：DepreciationListPage data 非数组 1 passed |
| Q1408 | done | Array.isArray：StocktakingCycleListPage 非数组 1 passed |
| Q1409 | done | Array.isArray：SystemMailTemplatesWorkbenchPage records 已有测试 |
| Q1409 | done | Array.isArray：SystemBaseParamsWorkbenchPage records 非数组 1 passed |
| Q1410 | done | Array.isArray：useCatalogPage records（MEDIUM 7 callers） |
| Q1411 | done | Array.isArray：AssetPickerModal/CommentSection/SparePartUsageForm records |
| Q1412 | done | Array.isArray：useWorkOrderList records |
| Q1413 | done | Array.isArray：app WorkOrderListPage / CategoryManagerPage records |
| Q1414 | done | Array.isArray：app AssetListPage setAssets records |
| Q1415 | done | Array.isArray：app WorkOrderManagementPage records |
| Q1416 | cancelled | 禁止 src/app/pages |
| Q1417 | done | Array.isArray：SystemMailLogs/Gateway/NotifTemplates records 3 passed |
| Q1418 | done | Array.isArray：workbench posts/audit/fieldsets/category records 4 passed |
| Q1419 | done | Array.isArray：SystemFormStorageWorkbenchPage records 非数组 1 passed |
| Q1420 | done | Array.isArray：AssetScrapFormPage records 已有测试 |
| Q1421 | done | Array.isArray：app Compensation/Disposals/Approval/Settings/RFID records |
| Q1422 | done | Array.isArray：AssetWorkOrdersTab/DepreciationSchedule/useAssetDetail/workOrderApi |
| Q1423 | done | Array.isArray：auditLogService/assetDetailApi/AssetDisposal/useAssets/Picker |
| Q1424 | done | Array.isArray：/idle + workbenchv3 handover/doc/tech-support/workflow-mail 5 passed |
| Q1425 | done | Array.isArray：workbenchv3 import-export/tenants/runtime/data-permissions/channel-configs 5 passed |
| Q1426 | done | Array.isArray：workbenchv3 dept-org/file-storage/sla/notif-pref/custom-fields 5 passed |
| Q1427 | done | Array.isArray：workbenchv3 flow-def/form-config/switches/role-permissions/command-center 5 passed |
| Q1428 | done | Array.isArray：workbenchv3 menu-permissions/flow-designer 2 passed |
| Q1429 | done | workbenchv3 catalog API 失败脱敏：handover/doc/tech-support/workflow-mail/import-export 5 passed |
| Q1430 | done | workbenchv3 catalog 失败：tenants/dept-org/sla/file-storage/notif-pref 5 passed |
| Q1431 | done | workbenchv3 失败：runtime/flow-def/form-config/role-permissions/custom-fields 5 passed |
| Q1432 | done | workbenchv3 失败：menu-permissions/flow-designer/channel-configs/mail-templates/command-center 5 passed |
| Q1433 | done | workbenchv3 失败：mail-logs/mail-gateway/interfaces/cache/vendors 5 passed |
| Q1434 | done | workbenchv3 失败：locations/field-mapping/sync-rules/numbering-rules/posts 5 passed |
| Q1435 | done | workbenchv3 失败：users/audit-log/asset-category/form-storage/data-permissions 5 passed |
| Q1436 | done | workbenchv3 失败：webhook/todo-fields/approval-rules/switches/security-policy 5 passed |
| Q1437 | done | workbenchv3 失败：external-systems/base-params/notif-templates/fieldsets 4 passed |
| Q1438 | done | 桌面 /energy ranking 非数组 1 passed |
| Q1439 | done | 桌面 /test-results modules 非数组 1 passed（Vite 需重启才吃到 Array.isArray） |
| Q1440 | done | 桌面 /bigscreen stats 非对象字段 1 passed |
| Q1441 | done | 桌面 /bigscreen-3d stats 非对象字段 1 passed |
| Q1442 | done | 桌面 /dashboard trends 非数组 1 passed |
| Q1443 | in_progress | 桌面 /sam dashboard 非对象无 pageerror |
| Q1440 | done | 桌面 src/pages records 非数组：energy/tco/compensation/import-export/workflow-designer/spare-parts/1/inspections/1 **7 passed**。修 EnergyDashboardPage assetRanking、SparePartDetailPage usages、InspectionDetailPage history Array.isArray。禁 /m。 |
| Q1441 | done | 桌面 upload photos / energy assetRanking / safety items / spare usages / WORK_ORDER 失败 **5 passed**。修 InspectionUploadPage photoList、SafetyChecklistExecutionPage items Array.isArray。不抢 Q1439。 |
| Q1442 | done | 桌面 /inspections/1 photos 非 JSON 数组 1 passed。修 InspectionDetailPage photos 解析。 |
| Q1443 | done | 桌面 /inspections/1/edit photos 非数组 1 passed。修 InspectionFormPage parsePhotoValue。不抢 bigscreen-3d。 |
| Q1445 | done | 桌面 /system/users depts/roles/posts 非数组 **3 passed**。修 flattenDepts + roles/posts Array.isArray。不抢 bigscreen-3d。 |
| Q1446 | done | 桌面 SafetyChecklistTemplate items + History results Array.isArray；config items 非数组 1 passed |
| Q1447 | in_progress | 桌面 src/pages 未测失败态：/profile 当前用户失败无 pageerror |
| Q1444 | done | 桌面详情非数组：/gis/assets、scan surplusItems、/audit/1 changes、/workorders/1 attachments、/disposals/1、/budgets/1、/asset-models fieldsets/all、/insurances/1 **8 passed**。修 RFIDScanPage surplus/deficit、useGisAssets Array.isArray。禁 /m、禁 id 空转。 |
| Q1448 | done | 桌面非数组：manufacturers/options、categories/all、intake/1 checkItems、maintenance upcoming、categories tree 对象、purchase-orders/1 items、assignments/1、borrows/1 **8 passed**。修 AssetModelPage options、IntakeDetailPage checkItems/intakeAssets、PurchaseOrderPage items Array.isArray。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1449 | done | 桌面 tree 纯对象 / stats 非对象：/locations、/system/menus、/system/depts、/stocktaking/cycles、/gis/stats **5 passed**。页面已有 Array.isArray。许可证/重估/岗位/角色/闲置 records 非数组已覆盖，未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1450 | done | 桌面非数组：fault-codes tree 纯对象、reliability summary 数组、trend/ranking/unhealthy 纯对象、licenses summary/expiring、重估详情非对象、report-builder stats **9 passed**。修 ReliabilityPage summary、SoftwareLicensePage expiring、RoleManagement menuTree、RevaluationFormPage 详情、ReportBuilderPage stats Array.isArray。岗位/角色/闲置列表已覆盖未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1451 | done | 桌面非数组：risk-assessments matrix、energy byType/trend 为数组、custom-fields fieldOptions、transfer/new depts tree **5 passed**。修 RiskMatrixPage heatmap forEach、EnergyDashboardPage byType/trend asMetricMap、parseOptions Array.isArray、AssetTransferFormPage flattenTree。岗位/保险/供应商/制造商 records 已覆盖未重复；通知无独立详情路由未加 id。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1452 | done | 桌面树 children / 预算 tab 非数组 **7 passed**（locations/categories/fault-codes/depts/assets children、budgets alerts、budgets execution-rate）。修 LocationsPage/CategoryManagerPage/FaultCodePage/DeptManagement/AssetListPage 递归 children 与 BudgetListPage alerts/execRates Array.isArray。资产详情/盘点详情/维保计划/检验新建/工单列表/ABC/RFID 未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1453 | done | 桌面菜单树 children / 字段集 fields / 分类树 children **7 passed**（menus children、roles menus children、custom-fieldsets fields、intake/new categories children、asset-models manufacturers/options children、retirement depts children、assets/new categories children）。修 MenuManagement/RoleManagement children、custom-fieldsets fields、IntakeFormPage/AssetFormPage/RetirementListPage 递归 children Array.isArray。岗位/保险 claims/供应商 records 已覆盖未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1454 | done | 桌面非数组 **4 passed**（inventory/tasks/1 locations children、summary surplusItems、retirement/1 approvalRecords、sam highRiskItems/upcomingExpiry）。修 InventoryDetailPage children/surplus/deficit/scopeIds、RetirementDetailPage approvalRecords、SamDashboardPage highRiskItems/upcomingExpiry、IntakeFormPage checkItems/intakeAssets、AssetImportExport parse rows/errors Array.isArray。岗位/保险 claims/供应商/借用领用新建/维保 upcoming/检验新建已覆盖未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1455 | done | 桌面非数组 **5 passed**（/reports depreciation-stats、maintenance-stats、retirement-stats、workorders 统计、/analytics maintenance-stats）。修 ReportsPage 四条统计序列 Array.isArray、AnalyticsPage maintenanceData 对象守卫、InspectionListPage selectedRecords Array.isArray。StocktakingCycleListPage cycles 与 /inspections records 已覆盖未重复。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1456 | done | 桌面非数组 **4 passed**（/reports by-category 纯对象点击分类统计、/workflow-designer definition.nodes、assignees/preview nodes、/notifications items）。修 ChartPreview chartRows、WorkflowDesignerPage definition.nodes/preview.nodes/missingFields、NotificationsPage items Array.isArray。合同无独立详情路由未加 id。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1457 | done | 桌面非数组 **3 passed**（/workorders/new attachments、/assets/1 tcoCompare、/dashboard maintenance-stats alerts）。修 WorkOrderFormPage attachments、AssetDetailPage tcoCompareRows Array.isArray。DashboardPage maintenanceAlerts 已有防护，补测 alerts/upcomingList 纯对象。无 edit 路由故 FormPage 走 /workorders/new。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1458 | done | 桌面非数组 **3 passed**（/disposals/transfer/new assignees/preview nodes、/assets/1 audit log.changes、/equipment upcoming）。修 AssetTransferFormPage nodes/missingFields、AssetDetailPage log.changes、EquipmentPage upcoming Array.isArray。preview 须 mock start-availability canStart。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1459 | done | 桌面非数组 **2 passed**（/risk-matrix 编辑 dimension、/assets/import-export category/location children）。修 RiskMatrixConfigPage asList、AssetImportExportPage guardTree/guardCascade、CategoryTreeSelect children Array.isArray。禁 /m、禁 workbenchv3、禁 id 空转。 |
| Q1460 | done | 桌面非数组 **2 passed**（/profile roles/permissions、/floorplans assets）。修 UserProfilePage roles/permissions Array.isArray。平面图 getAssets 已有防护。禁 /m、禁 workbenchv3。不抢 Q1447 失败态。 |
| Q1461 | done | 桌面空态 **3 passed**（/inspection-templates、/inventory/cycle-count、/inventory/abc-classification）。antd Table locale.emptyText。禁 /m、禁 id 空转。 |
| Q1462 | done | 桌面空态 **1 passed**（/safety-checklists/config「暂无数据」）。DataTable 默认 emptyText。禁 /m。 |
| Q1463 | cancelled | /test-results 空态：静态 /test-reports/data.json 有模块数据，route 拦不住；report-builder 无空表文案。禁 /m。 |
| Q1464 | done | 桌面空态 **2 passed**（/disposals/scrap/new、/disposals/transfer/new「暂无已选资产」）。禁 /m。 |
| Q1465 | done | 桌面空态 **3 passed**（/sam「暂无扫描历史」、/contracts 点即将到期「暂无即将到期合同」、/budgets 点超支告警「暂无超支告警」）。禁 /m。 |
| Q1466 | done | 桌面空态 **3 passed**（/contracts 点时间轴「暂无时间线数据」、/budgets 点执行率「暂无执行率数据」、/inventory/smart-report/INV-001「暂无差异资产，盘点结果正常」）。summary mock 须对象。禁 /m。 |
| Q1467 | done | 桌面空态 **3 passed**（/assets/1「暂无 TCO 数据」、/approvals 点发起申请「暂无可发起的流程」、/audit/1「暂无变更记录」）。TCO mock `null`。禁 /m。 |
| Q1468 | done | 桌面空态 **3 passed**（/disposals/clearance/new 点添加资产「暂无匹配资产」、/purchase-orders 点行「暂无明细」、/inspection-records 点历史「暂无历史记录」）。禁 /m。 |
| Q1469 | done | 桌面空态 **3 passed**（清退「暂未选择资产」、/sam「暂无数据」、/gis 点资产定位管理「暂无可关联的资产」）。禁 /m。 |
| Q1470 | done | 桌面空态 **3 passed**（/assets/1「暂无趋势数据」、/workflows「暂无发布快照」、/reports 点资产分类统计「暂无图表数据」）。禁 /m。 |
| Q1471 | done | 桌面空态 **3 passed**（/intake/1「暂无入库资产」、/system/custom-fieldsets 点查看字段「该字段集暂无字段」、/audit 点筛选「暂无筛选项」）。禁 /m。 |
| Q1472 | done | 桌面空态 **3 passed**（/maintenance/plans 点日历「暂无维保计划数据」、/disposals 点调拨「暂无资产调拨记录」、点报废「暂无报废转让记录」）。vendor-portal 非 AppLayout、audit 趋势 7 天补零不可达。禁 /m。 |
| Q1473 | done | 桌面空态 **3 passed**（/compensation/new「暂无可选部门」、/sam 点查看详情「暂无详情」、/system/roles 点菜单权限「暂无菜单数据」）。DialogTitle console 忽略。禁 /m。 |
| Q1474 | done | 桌面空态 **3 passed**（/system/roles 点数据权限「暂无部门数据」、/assets/1/timeline「该资产暂无任何履历事件」、/floorplans「请新建平面图」）。领用/借用 option hidden。禁 /m。 |
| Q1475 | done | 桌面空态 **3 passed**（/assets「未找到符合条件的资产记录…」、/approvals「当前没有待处理的审批事项」、/notifications「所有通知都会显示在这里」）。禁 /m。 |
| Q1476 | done | 桌面空态 **3 passed**（/gis「没有已定位的资产可在地图上显示」、/notifications 点系统通知「当前筛选条件下没有通知」、/energy「尚未采集到能耗数据」）。禁 /m。 |
| Q1477 | done | 桌面空态 **3 passed**（/sam「执行合规扫描后显示许可类型分布」「执行合规扫描后显示席位使用率」「所有许可合规运行」）。禁 /m。 |
| Q1478 | done | 桌面空态 **3 passed**（/fault-codes「点击「新增根节点」…」、/categories「点击上方按钮添加根分类」、/reports 点资产分类统计「当前报表暂无可用数据」）。资产状态分布有图点。禁 /m。 |
| Q1479 | done | 桌面空态 **3 passed**（/report-builder 拖拽字段、/assets/import-export 点导出「请选择资产分类」、/locations「新增顶级位置」）。修 TreeSelect `treeCheckable`。禁 /m。 |
| Q1480 | done | 桌面空态 **3 passed**（导出「请选择资产状态（可多选）」「请选择存放位置」、/system/depts「新增部门」）。DragUploadArea 范围文案不在当前页。禁 /m。 |
| Q1481 | done | 桌面空态 **3 passed**（导入拖拽文案两句、/system/posts「新增岗位」）。禁 /m。 |
| Q1482 | done | 桌面空态 **3 passed**（下载导入模板、/system/menus「新增菜单」、/system/depts「请选择一个部门查看详情」）。禁 /m。 |
| Q1483 | done | 桌面空态 CTA **3 passed**（/spare-parts「新增备件」、/insurances「新增保险」、/borrows「新建借用单」）。禁 /m。 |
| Q1484 | done | 桌面空态 CTA **3 passed**（/assignments「新建领用单」、/intake「新建验收单」、/assets「新建资产」）。禁 /m。 |
| Q1485 | done | 桌面空态 CTA **3 passed**（/budgets「新增预算」、/revaluations「新增减值/重估」、/retirement「新建退役申请」）。禁 /m。 |
| Q1486 | done | 桌面空态 CTA **3 passed**（/inspections「新增检验」、/maintenance「新增维保」、/stocktaking-cycles「新建周期」）。禁 /m。 |
| Q1487 | done | 桌面空态 CTA **3 passed**（/maintenance/plans「新建计划」、/vendors「新增供应商」、/purchase-orders「新增采购单」）。禁 /m。 |
| Q1488 | done | 桌面空态 CTA **3 passed**（/manufacturers「新增制造商」、/contracts「新增合同」、/asset-models「新增模型」）。禁 /m。 |
| Q1489 | done | 桌面空态 CTA **3 passed**（/licenses「新增许可证」、/fault-codes「新增根节点」、/floorplans 按钮「新建」）。禁 /m。 |
| Q1490 | done | 桌面空态 CTA **3 passed**（/inventory「新建任务」、/inventory/cycle-count「新增规则」、/categories「添加根分类」）。EmptyState「添加分类」不可达。禁 /m。 |
| Q1491 | done | 桌面空态 CTA **3 passed**（/inspection-templates「新增模板」、/reports/scheduled「新建定时报表」、/inspection-records「新增检验」）。禁 /m。 |
| Q1492 | done | 桌面空态 CTA **3 passed**（/disposals「新建资产清退」、/risk-assessments「新增评估」、/safety-checklists/config「新增模板」）。禁 /m。 |
| Q1493 | done | 桌面空态 CTA **3 passed**（/disposals 点调拨/报废/赔偿对应「新建…」）。禁 /m。 |
| Q1494 | done | 桌面空态 CTA **3 passed**（/disposals 点工单「新建工单管理」、/workflows「新建流程」、/equipment「新建维保」）。禁 /m。 |
| Q1495 | done | 桌面空态 **3 passed**（/sam「触发合规扫描」、/reports/scheduled 点击新建提示、/equipment 点新建维保「新建维保记录」）。禁 /m。 |
| Q1496 | done | 桌面空态 **3 passed**（/gis 点资产定位管理「新建资产定位」「关联已有资产」、/notifications「全部已读」）。禁 /m。 |
| Q1497 | done | 桌面空态 **3 passed**（GIS 关联提示、搜索 placeholder、新建定位临时数据提示）。禁 /m。 |
| Q1498 | done | 桌面空态 **3 passed**（GIS 新建定位名称/编号/纬度 placeholder）。禁 /m。 |
| Q1499 | done | 桌面空态 **3 passed**（GIS 新建定位经度/位置 placeholder、「确认创建」）。禁 /m。 |
| Q1500 | done | 桌面空态 **3 passed**（GIS 关联「标注坐标」「取消」、新建定位「资产名称」）。禁 /m。 |
| Q1501 | done | 桌面空态 **3 passed**（/depreciation「批量计算折旧」、/inventory/abc-classification「批量重新分类」、/idle 副标题）。禁 /m。 |
| Q1502 | done | 桌面空态 **3 passed**（ABC 规则说明、/depreciation「待计算资产」「刷新」）。禁 /m。 |
| Q1503 | done | 桌面空态 **3 passed**（ABC「未分类资产」「导出报告」规则未匹配说明）。折旧批量确认空表不可达。禁 /m。 |
| Q1504 | done | 桌面空态 **3 passed**（ABC「A 类资产」、点批量重新分类确认、/idle「闲置总量」）。禁 /m。 |
| Q1505 | done | 桌面空态 **3 passed**（ABC「B 类资产」「C 类资产」、确认框正文）。禁 /m。 |
| Q1506 | done | 桌面空态 **3 passed**（ABC 确认时长提示、「总价值」、/idle「闲置天数」）。禁 /m。 |
| Q1507 | done | 桌面空态 **3 passed**（/bigscreen「资产运营分析平台」「值班领导」「值班经理」）。WebGL console 忽略。禁 /m。 |
| Q1508 | done | 桌面空态 **3 passed**（/bigscreen「资产运行分析」「今日资产信息」「资产异常分析」）。禁 /m。 |
| Q1509 | done | 桌面空态 **3 passed**（/bigscreen「今日不正常情况明细」「收入运力信息」「人员信息」）。禁 /m。 |
| Q1510 | done | 桌面空态 **3 passed**（/bigscreen「承运情况分析」「油量信息」「重点关注航班信息」）。禁 /m。 |
| Q1511 | done | 桌面空态 **3 passed**（/bigscreen-3d「资产规模指标」「资产分类结构」「价值趋势预测」）。禁 /m。 |
| Q1512 | done | 桌面空态 **3 passed**（/bigscreen-3d「设备在线总览」「城市资产TOP5」「风险异常队列」）。禁 /m。 |
| Q1513 | done | 桌面空态 **3 passed**（/categories「选择分类」详情空态、/floorplans「请选择平面图」）。禁 /m。 |
| Q1514 | done | 桌面空态 **3 passed**（/intake/new 验收说明、/spare-parts/new 备件保障说明、/workflows 搜索 placeholder）。禁 /m。 |
| Q1515 | done | 桌面空态 **3 passed**（/budgets/new「创建新的预算记录」、/revaluations/new「资产价值调整申请」、/analytics/reliability 副标题）。禁 /m。 |
| Q1516 | done | 桌面空态 **3 passed**（/analytics/tco 副标题、/disposals/scrap/new 报废说明、/disposals/transfer/new 转移说明）。禁 /m。 |
| Q1517 | done | 桌面空态 **3 passed**（/analytics/tco placeholder「输入资产ID」「输入部门ID」「输入分类ID」）。禁 /m。 |
| Q1518 | done | 桌面空态 **3 passed**（/manufacturers「搜索名称/编码」、/contracts「搜索合同名称/编号」、/insurances 搜索 placeholder）。禁 /m。 |
| Q1519 | done | 桌面空态 **3 passed**（/asset-models「搜索名称 / 型号」、/assignments「搜索编号、名称...」、/borrows「搜索用途/备注...」）。禁 /m。 |
| Q1520 | done | 桌面空态 **3 passed**（/approvals「搜索编号、标题或发起人」、/maintenance「按资产ID搜索...」、/maintenance/plans「搜索计划名称...」）。禁 /m。 |
| Q1521 | done | 桌面空态 **3 passed**（/licenses「搜索软件名称/厂商」、/spare-parts「搜索备件编码/名称...」、/audit「搜索操作记录...」）。禁 /m。 |
| Q1522 | done | 桌面空态 **3 passed**（/equipment「搜索设备名称或编号...」、/system/posts 搜索岗位、/system/custom-fields 搜索字段）。禁 /m。 |
| Q1523 | done | 桌面空态 **3 passed**（/system/depts「搜索部门名称、编码、负责人...」、/system/custom-fieldsets「搜索字段集名称」、/vendors「搜索供应商名称、编码、联系人...」）。禁 /m。 |
| Q1524 | done | 桌面空态 **3 passed**（/intake「搜索验收单号...」、/depreciation「搜索资产编号...」、/purchase-orders「搜索采购单号、名称...」）。禁 /m。 |
| Q1525 | done | 桌面空态 **3 passed**（/retirement「搜索编号或资产...」、/insurances「保单号/保险名称/保险公司」、/inspections「检验编号/检验机构/检验人」）。禁 /m。 |
| Q1526 | done | 桌面空态 **3 passed**（/inspection-records「检验编号/检验机构/检验人」、/retirement/new「搜索资产编号或名称」、/revaluations/new「输入资产ID搜索...」）。禁 /m。 |
| Q1527 | done | 桌面空态 **3 passed**（/compensation「搜索资产编号/名称」、/workorders/new「搜索资产编号或名称...」、/disposals/clearance/new 点添加资产后搜索）。禁 /m。 |
| Q1528 | done | 桌面空态 **3 passed**（/system/menus 点新增菜单「搜索图标...」、/system/depts「请选择一个部门查看详情」、/retirement/new「请输入资产编号或名称搜索」）。禁 /m。 |
| Q1529 | done | 桌面空态 **3 passed**（/system/depts「暂无部门数据」「点击下方按钮创建第一个部门」「点击左侧组织架构树中的节点即可查看」）。禁 /m。 |
| Q1530 | done | 桌面空态 **3 passed**（/workflows「流程总数」「已发布」「草稿中」）。禁 /m。 |
| Q1531 | done | 桌面空态 **3 passed**（/workflows「已停用」「全部业务流程」「可用于发起」）。禁 /m。 |
| Q1532 | done | 桌面空态 **3 passed**（/workflows「待完善发布」「暂停发起」「流程定义」）。禁 /m。 |
| Q1533 | done | 桌面空态 **3 passed**（/locations「资产存放位置的层级管理」「总位置数」「全部折叠」）。禁 /m。 |
| Q1534 | done | 桌面空态 **3 passed**（/locations「全部展开」「顶级位置」、/system/custom-fields「自定义字段管理」）。禁 /m。 |
| Q1535 | done | 桌面空态 **3 passed**（/system/custom-fields「管理系统扩展字段定义」、/system/posts「岗位信息维护」「岗位列表」）。禁 /m。 |
| Q1536 | done | 桌面空态 **3 passed**（/system/posts「岗位总量」「正常」「停用」）。禁 /m。 |
| Q1537 | done | 桌面空态 **3 passed**（/fault-codes「故障树」「三级故障编码体系」「现象 → 原因 → 措施」）。禁 /m。 |
| Q1538 | done | 桌面空态 **3 passed**（/fault-codes「节点总数」「故障现象」「故障原因」）。禁 /m。 |
| Q1539 | done | 桌面空态 **3 passed**（/fault-codes「解决措施」、/notifications「审批通知」「预警通知」）。禁 /m。 |
| Q1540 | done | 桌面空态 **3 passed**（/notifications「共 0 条通知」「系统通知」、/reports「资产报表」）。禁 /m。 |
| Q1541 | done | 桌面空态 **3 passed**（/reports「财务报表」「运维报表」「工单报表」）。禁 /m。 |
| Q1542 | done | 桌面空态 **3 passed**（/reports「资产汇总表」「资产分类统计」「资产状态分布」）。禁 /m。 |
| Q1543 | done | 桌面空态 **3 passed**（/reports「部门资产排行」「资产增长趋势」、点财务报表「资产价值趋势」）。禁 /m。 |
| Q1544 | done | 桌面空态 **3 passed**（/reports 点财务报表「折旧统计」「分类价值分布」、点运维报表「维保统计」）。禁 /m。 |
| Q1545 | done | 桌面空态 **3 passed**（/reports 点运维报表「退役处置统计」、点工单报表「工单完成率」「待处理工单」）。禁 /m。 |
| Q1546 | done | 桌面空态 **3 passed**（/reports/scheduled 调度说明与新建提示、/sam 副标题）。禁 /m。 |
| Q1547 | done | 桌面空态 **3 passed**（/risk-matrix 副标题、「创建矩阵」「矩阵名称」）。禁 /m。 |
| Q1548 | done | 桌面空态 **3 passed**（/risk-matrix 点创建矩阵「创建矩阵配置」「输入矩阵名称」、/asset-health 多维度评估说明）。禁 /m。 |
| Q1549 | done | 桌面空态 **3 passed**（/asset-health「平均健康分」「健康」「批量计算」）。禁 /m。 |
| Q1550 | done | 桌面空态 **3 passed**（/asset-health「警告」「危险」「TopN:」）。禁 /m。 |
| Q1551 | done | 桌面空态 **3 passed**（/analytics/health「多维度资产健康度评估」「健康资产」「警告资产」）。禁 /m。 |
| Q1552 | done | 桌面空态 **3 passed**（/analytics/health「危险资产」「评分分布」「评分区间分布」）。禁 /m。 |
| Q1553 | done | 桌面空态 **3 passed**（/analytics/health「不健康资产 Top 20」、/analytics/reliability「平均故障间隔」「平均修复时间」）。禁 /m。 |
| Q1554 | done | 桌面空态 **3 passed**（/analytics/reliability「设备可用率」「月均故障率」「总故障 0 次」）。禁 /m。 |
| Q1555 | done | 桌面空态 **3 passed**（/analytics/reliability「MTBF/MTTR 趋势」「资产可靠性排名」「可用性」）。禁 /m。 |
| Q1556 | done | 桌面空态 **3 passed**（/analytics「多维资产趋势、分类结构与运营指标分析」「资产总数」「本月维保」）。禁 /m。 |
| Q1557 | done | 桌面空态 **3 passed**（/analytics「资产总值」「待审批」「数据范围」）。禁 /m。 |
| Q1558 | done | 桌面空态 **3 passed**（/analytics「近 12 个月」「资产价值趋势」「资产分类分布」）。禁 /m。 |
| Q1559 | done | 桌面空态 **3 passed**（/analytics「部门资产排行」「处置统计」「数据来自资产台账、维保记录与审批流程」）。禁 /m。 |
| Q1560 | done | 桌面空态 **3 passed**（/idle「已发布公告」「待审批认领」「已完成认领」）。禁 /m。 |
| Q1561 | done | 桌面空态 **3 passed**（/idle「发布公告」「公告中」「已认领」）。禁 /m。 |
| Q1562 | done | 桌面空态 **3 passed**（/budgets「资产预算」「总预算」「已使用」）。禁 /m。 |
| Q1563 | done | 桌面空态 **3 passed**（/budgets「已承诺」「合同锁定」「0 项预算」）。禁 /m。 |
| Q1564 | done | 桌面空态 **3 passed**（/budgets「预算列表」「超支告警」「执行率」）。禁 /m。 |
| Q1565 | done | 桌面空态 **3 passed**（/revaluations「总记录」「减值/重估合计」「需及时处理」）。禁 /m。 |
| Q1566 | done | 桌面空态 **3 passed**（/revaluations「已通过」「本期已审批」「本期驳回」）。禁 /m。 |
| Q1567 | done | 桌面空态 **3 passed**（/revaluations「已拒绝」「减值/重估列表」、/categories「管理资产分类层级结构」）。禁 /m。 |
| Q1568 | done | 桌面空态 **3 passed**（/categories「总分类数」「根分类」「当前选中」）。禁 /m。 |
| Q1569 | done | 桌面空态 **3 passed**（/categories「子分类数」、/system/users「用户总量」「新增用户」）。禁 /m。 |
| Q1570 | done | 桌面空态 **3 passed**（/system/users「角色数」「岗位数」「总页数」）。禁 /m。 |
| Q1571 | done | 桌面空态 **3 passed**（/system/users「用户列表」、/system/roles「角色列表」「角色与权限管理」）。禁 /m。 |
| Q1572 | done | 桌面空态 **3 passed**（/system/roles「角色总数」「当前页」「RBAC」）。禁 /m。 |
| Q1573 | done | 桌面空态 **3 passed**（/system/menus「树形」「目录」「总计」）。禁 /m。 |
| Q1574 | done | 桌面空态 **3 passed**（/assets「资产台账管理」「资产列表」「资产总净值」）。禁 /m。 |
| Q1575 | done | 桌面空态 **3 passed**（/assets「待处理维修」「闲置率」「累计折旧」）。禁 /m。 |
| Q1576 | done | 桌面空态 **3 passed**（/assets「导出全部」「导出 PDF」「搜索编号、名称...」）。禁 /m。 |
| Q1577 | done | 桌面空态 **3 passed**（/assets「共 0 条资产」「导入」「资产管理」）。禁 /m。 |
| Q1578 | done | 桌面空态 **3 passed**（/dashboard「总资产数」「导出数据」「刷新视图」）。禁 /m。 |
| Q1579 | done | 桌面空态 **3 passed**（/dashboard「在用资产」「闲置资产」「资产价值趋势 (近12个月)」）。禁 /m。 |
| Q1580 | done | 桌面空态 **3 passed**（/dashboard「总价值」「分类分布」「维保预警」）。禁 /m。 |
| Q1581 | done | 桌面空态 **3 passed**（/dashboard「最近工单」「净值」「部门资产统计 (Top 5 部门)」）。禁 /m。 |
| Q1582 | done | 桌面空态 **3 passed**（/disposals「全周期」「本月处置总量」「资产回收价值」）。禁 /m。 |
| Q1583 | done | 桌面空态 **3 passed**（/disposals 清退风险提示、「资产清退」「工单管理」）。禁 /m。 |
| Q1584 | done | 桌面空态 **3 passed**（/disposals 点调拨/报废/赔偿风险提示）。禁 /m。 |
| Q1585 | done | 桌面空态 **3 passed**（/maintenance「设备维护」「维保列表」「维保记录管理」）。禁 /m。 |
| Q1586 | done | 桌面空态 **3 passed**（/maintenance「计划中」「执行中」「逾期」）。禁 /m。 |
| Q1587 | done | 桌面空态 **3 passed**（/maintenance 点新增维保「新增维保记录」说明与内容 placeholder）。禁 /m。 |
| Q1588 | done | 桌面空态 **3 passed**（/maintenance 点新增维保结果 placeholder 与类型内容标签）。禁 /m。 |
| Q1589 | done | 桌面空态 **3 passed**（/maintenance/plans 副标题、表格/卡片视图）。禁 /m。 |
| Q1590 | done | 桌面空态 **3 passed**（/maintenance/plans 日历视图、点新建计划标题与名称 placeholder）。禁 /m。 |
| Q1591 | done | 桌面空态 **3 passed**（/maintenance/plans 点新建计划关联资产与名称标签）。禁 /m。 |
| Q1592 | done | 桌面空态 **3 passed**（/inventory「实时同步」「任务总数」「平均进度」）。禁 /m。 |
| Q1593 | done | 桌面空态 **3 passed**（/inventory「已盘资产」「盘亏预警」「RFID」）。禁 /m。 |
| Q1594 | done | 桌面空态 **3 passed**（/inventory「盘点任务」「资产盘点管理」「决策摘要」）。禁 /m。 |
| Q1595 | done | 桌面空态 **3 passed**（/inventory「进度趋势」「筛选」、点筛选「重置」）。禁 /m。 |
| Q1596 | done | 桌面空态 **3 passed**（/spare-parts「备件总数」「备件列表」「备件库存管理」）。禁 /m。 |
| Q1597 | done | 桌面空态 **3 passed**（/spare-parts「库存告警」「已启用」「库存总价值」）。禁 /m。 |
| Q1598 | done | 桌面空态 **3 passed**（/contracts「合同信息维护与到期预警」「全部合同」「生效中」）。禁 /m。 |
| Q1599 | done | 桌面空态 **3 passed**（/contracts「30天内到期」「时间轴视图」「即将到期」）。禁 /m。 |
| Q1600 | done | 桌面空态 **3 passed**（/contracts 点新增合同说明与名称 placeholder）。禁 /m。 |
| Q1601 | done | 桌面空态 **3 passed**（/contracts 点新增合同类型编号与弹窗标题）。禁 /m。 |
| Q1602 | done | 桌面空态 **3 passed**（/licenses「许可证席位跟踪与到期管理」「总许可证」「有效许可证」）。禁 /m。 |
| Q1603 | done | 桌面空态 **3 passed**（/licenses「即将到期(30天)」「到期预警」、点新增说明）。禁 /m。 |
| Q1604 | done | 桌面空态 **3 passed**（/audit 副标题、「最近7天」「总操作数」）。禁 /m。 |
| Q1605 | done | 桌面空态 **3 passed**（/audit「今日操作」「活跃用户」「风险事件」）。禁 /m。 |
| Q1606 | done | 桌面空态 **3 passed**（/audit「操作趋势（近7天）」「操作类型分布」「最近操作」）。禁 /m。 |
| Q1607 | done | 桌面空态 **3 passed**（/approvals「待我审批」「我发起的」「已驳回」）。禁 /m。 |
| Q1608 | done | 桌面空态 **3 passed**（/approvals「审批」「待审批」「已通过」）。禁 /m。 |
| Q1609 | done | 桌面空态 **3 passed**（/borrows「借用总数」「借用列表」「借用记录管理」）。禁 /m。 |
| Q1610 | done | 桌面空态 **3 passed**（/borrows「已借出」「已逾期」「借用管理」）。禁 /m。 |
| Q1611 | done | 桌面空态 **3 passed**（/assignments「领用列表」「领用归还管理」「长期领用」）。禁 /m。 |
| Q1612 | done | 桌面空态 **3 passed**（/assignments「短期借用」「归还入库」「调拨转移」）。禁 /m。 |
| Q1613 | done | 桌面空态 **3 passed**（/assignments「总记录」「已签收」「已归还」）。禁 /m。 |
| Q1614 | done | 桌面空态 **3 passed**（/intake「管理资产入库验收全流程」「待质检」「部分验收」）。禁 /m。 |
| Q1615 | done | 桌面空态 **3 passed**（/intake「质检中」「已验收」「搜索」）。禁 /m。 |
| Q1616 | done | 桌面空态 **3 passed**（/equipment 副标题、「总设备数」「设备列表」）。禁 /m。 |
| Q1617 | done | 桌面空态 **3 passed**（/equipment「维保中」「正常运行」「设备状态:」）。禁 /m。 |
| Q1618 | done | 桌面空态 **3 passed**（/equipment「维修中」「已过期」「即将到期」）。禁 /m。 |
| Q1619 | done | 桌面空态 **3 passed**（/manufacturers「设备制造商信息维护」「全部制造商」「有官网」）。禁 /m。 |
| Q1620 | done | 桌面空态 **3 passed**（/manufacturers 点新增说明与名称 placeholder）。禁 /m。 |
| Q1621 | done | 桌面空态 **3 passed**（/asset-models 规格说明、「全部模型」「全部分类」）。禁 /m。 |
| Q1622 | done | 桌面空态 **3 passed**（/asset-models 点新增模型标题、说明与名称 placeholder）。禁 /m。 |
| Q1623 | done | 桌面空态 **3 passed**（/asset-models 点新增「产品型号」「模型名称 *」「分类 *」）。禁 /m。 |
| Q1624 | done | 桌面空态 **3 passed**（/depreciation「本月折旧总额」「折旧计划」「资产折旧计划管理」）。禁 /m。 |
| Q1625 | done | 桌面空态 **3 passed**（/depreciation「已完成」「直线0 / 双倍0」「折旧」）。禁 /m。 |
| Q1626 | done | 桌面空态 **3 passed**（/purchase-orders 副标题、「总采购单」「已审批」）。禁 /m。 |
| Q1627 | done | 桌面空态 **3 passed**（/purchase-orders 点新增采购订单标题与 placeholder）。禁 /m。 |
| Q1628 | done | 桌面空态 **3 passed**（/purchase-orders 点新增「采购明细」「采购单号 *」「采购名称 *」）。禁 /m。 |
| Q1629 | done | 桌面空态 **3 passed**（/insurances「保险台账管理」「保单列表」「保单总数」）。禁 /m。 |
| Q1630 | done | 桌面空态 **3 passed**（/insurances「总保费」「保单」「重置筛选」）。禁 /m。 |
| Q1631 | done | 桌面空态 **3 passed**（/notifications 点系统通知空态、「全部」「暂无通知」）。禁 /m。 |
| Q1632 | done | 桌面空态 **3 passed**（/floorplans「2D/3D 平面图」「平面图列表」「请从左侧选择一个平面图」）。禁 /m。 |
| Q1633 | done | 桌面空态 **3 passed**（/floorplans 副标题、「前往 GIS 地图」「请新建平面图」）。禁 /m。 |
| Q1634 | done | 桌面空态 **3 passed**（/floorplans 点新建平面图说明与名称 placeholder）。禁 /m。 |
| Q1635 | done | 桌面空态 **3 passed**（/floorplans 点新建「楼栋」「楼层」「图片URL」）。禁 /m。 |
| Q1636 | done | 桌面空态 **3 passed**（/gis 副标题、数据来源说明、无定位资产）。禁 /m。 |
| Q1637 | done | 桌面空态 **3 passed**（/reports 资产汇总/分类/状态卡片描述）。禁 /m。 |
| Q1638 | done | 桌面空态 **3 passed**（/reports 部门排行/增长趋势描述、点财务折旧描述）。禁 /m。 |
| Q1639 | done | 桌面空态 **3 passed**（/reports 点财务分类价值、运维维保/退役描述）。禁 /m。 |
| Q1640 | done | 桌面空态 **3 passed**（/reports 点工单/财务剩余卡片描述）。禁 /m。 |
| Q1641 | done | 桌面空态 **3 passed**（/risk-matrix 点创建「概率维度」「严重度维度」「等级映射」）。禁 /m。 |
| Q1642 | done | 桌面空态 **3 passed**（/risk-matrix 点创建「添加维度」「维度名称」「概率维度配置」）。禁 /m。 |
| Q1643 | done | 桌面空态 **3 passed**（/risk-matrix 点严重度/映射 tab 配置文案）。禁 /m。 |
| Q1644 | done | 桌面空态 **3 passed**（/vendors「合作供应商信息维护」「全部供应商」「合作中」）。禁 /m。 |
| Q1645 | done | 桌面空态 **3 passed**（/vendors「已停用」、点新增说明与名称 placeholder）。禁 /m。 |
| Q1646 | done | 桌面空态 **3 passed**（/vendors 点新增名称编码与弹窗标题）。禁 /m。 |
| Q1647 | done | 桌面空态 **3 passed**（/system/custom-fieldsets「字段集名称」「描述」「状态」）。禁 /m。 |
| Q1648 | done | 桌面空态 **3 passed**（/system/custom-fields「字段名」「显示名」「类型」）。禁 /m。 |
| Q1649 | done | 桌面空态 **3 passed**（/system/custom-fields「选项」「必填」「排序」）。禁 /m。 |
| Q1650 | done | 桌面空态 **3 passed**（/system/custom-fields「共 0 条」「操作」「ID」）。禁 /m。 |
| Q1651 | done | 桌面空态 **3 passed**（/system/posts「岗位编码」「岗位名称」「创建时间」）。禁 /m。 |
| Q1652 | done | 桌面空态 **3 passed**（/system/posts「备注」、点新增岗位编码）。禁 /m。 |
| Q1653 | done | 桌面空态 **3 passed**（/system/posts 点新增岗位名称与备注 placeholder）。禁 /m。 |
| Q1654 | done | 桌面空态 **3 passed**（/system/users「邮箱/手机号」「部门」「创建时间」）。禁 /m。 |
| Q1655 | done | 桌面空态 **3 passed**（/system/roles「角色名称」「角色编码」「数据权限」）。禁 /m。 |
| Q1656 | done | 桌面空态 **3 passed**（/system/roles「新增角色」、点新增名称与编码 placeholder）。禁 /m。 |
| Q1657 | done | 桌面空态 **3 passed**（/system/roles 点新增数据权限范围与描述）。禁 /m。 |
| Q1658 | done | 桌面空态 **3 passed**（/system/menus「菜单列表」「系统菜单目录与按钮权限」「菜单名称」）。禁 /m。 |
| Q1659 | done | 桌面空态 **3 passed**（/system/menus「权限标识」「路由」「按钮」）。禁 /m。 |
| Q1660 | done | 桌面空态 **3 passed**（/system/menus「菜单」、点新增显示名称与类型）。禁 /m。 |
| Q1661 | done | 桌面空态 **3 passed**（/system/menus 点新增图标路径与父级）。禁 /m。 |
| Q1662 | done | 桌面空态 **3 passed**（/system/menus 点新增组件路径与状态）。禁 /m。 |
| Q1663 | done | 桌面空态 **3 passed**（/system/depts「组织架构」、点新增部门名称编码）。禁 /m。 |
| Q1664 | done | 桌面空态 **3 passed**（/system/depts 点新增上级类型与领导）。禁 /m。 |
| Q1665 | done | 桌面空态 **3 passed**（/system/depts 点新增秘书电话邮箱）。禁 /m。 |
| Q1666 | done | 桌面空态 **3 passed**（/system/depts「支持搜索过滤」「支持展开/收起子级」「新增」）。禁 /m。 |
| Q1667 | done | 桌面空态 **3 passed**（/system/users 点新增用户名密码姓名）。禁 /m。 |
| Q1668 | done | 桌面空态 **3 passed**（/system/users 点新增邮箱手机号部门）。禁 /m。 |
| Q1669 | done | 桌面空态 **3 passed**（/system/users 点新增备注与分配角色岗位）。禁 /m。 |
| Q1670 | done | 桌面空态 **3 passed**（/system/users 点新增暂无角色岗位与确认新增）。禁 /m。 |
| Q1671 | done | 桌面空态 **3 passed**（/system/users 副标题搜索与取消）。禁 /m。 |
| Q1672 | done | 桌面空态 **3 passed**（/system/custom-fieldsets 标题 ID 操作）。禁 /m。 |
| Q1673 | done | 桌面空态 **3 passed**（/profile「当前套餐」「系统管理员」「ADMIN」）。禁 /m。 |
| Q1674 | done | 桌面空态 **3 passed**（/profile SUPER_ADMIN、部门排序负责人）。禁 /m。 |
| Q1675 | done | 桌面空态 **3 passed**（部门描述搜索用户、菜单排序号）。禁 /m。 |
| Q1676 | done | 桌面空态 **3 passed**（/system/menus 点新增路径与保存）。禁 /m。 |
| Q1677 | done | 桌面空态 **3 passed**（/dashboard「运营首页」「待审批」「欢迎回来，系统管理员」）。禁 /m。 |
| Q1678 | done | 桌面空态 **3 passed**（/dashboard「查看全部」「总价值」、/test-results 加载失败）。禁 /m。 |
| Q1679 | done | 桌面空态 **3 passed**（/system/posts 点新增排序与状态）。禁 /m。 |
| Q1680 | done | 桌面空态 **3 passed**（字段只读副标题共 0 条、菜单取消）。禁 /m。 |
| Q1681 | done | 桌面空态 **3 passed**（/403 权限说明与返回按钮）。禁 /m。 |
| Q1682 | done | 桌面空态 **3 passed**（/403 联系管理员与角色缺失）。禁 /m。 |
| Q1683 | done | 桌面空态 **3 passed**（/403 角色缺失说明、/forbidden）。禁 /m。 |
| Q1684 | done | 桌面空态 **3 passed**（/forbidden 权限说明与返回按钮）。禁 /m。 |
| Q1685 | done | 桌面空态 **3 passed**（/forbidden 联系管理员与角色缺失）。禁 /m。 |
| Q1686 | done | 桌面空态 **3 passed**（forbidden 角色缺失、/analytics「数据分析」）。禁 /m。 |
| Q1687 | done | 桌面空态 **3 passed**（/analytics 部门排行趋势分类空数据）。禁 /m。 |
| Q1688 | done | 桌面空态 **3 passed**（字段 V3 提示、菜单名称、岗位备注）。禁 /m。 |
| Q1689 | done | 桌面空态 **3 passed**（/system/roles 点新增名称编码描述）。禁 /m。 |
| Q1690 | done | 桌面空态 **3 passed**（/system/roles 点新增保存取消与空表）。禁 /m。 |
| Q1691 | done | 桌面空态 **3 passed**（/system/roles 点新增展开数据权限选项）。禁 /m。 |
| Q1692 | done | 桌面空态 **3 passed**（角色仅本人、部门确认新增取消）。禁 /m。 |
| Q1693 | done | 桌面空态 **3 passed**（/system/posts 点新增确认取消标题）。禁 /m。 |
| Q1694 | done | 桌面空态 **3 passed**（/energy「暂无能耗数据」、/system/users「停用」「全部」）。禁 /m。 |
| Q1695 | done | 桌面空态 **3 passed**（/system/users「正常」「重置」「用户」）。禁 /m。 |
| Q1696 | done | 桌面空态 **3 passed**（/system/users「状态」「操作」「用户管理」）。禁 /m。 |
| Q1697 | done | 桌面空态 **3 passed**（用户状态空表、部门备注）。禁 /m。 |
| Q1698 | done | 桌面空态 **3 passed**（无匹配图标、按钮权限标识、部门状态）。禁 /m。 |
| Q1699 | done | 桌面空态 **3 passed**（权限标识、通知中心、全部已读）。禁 /m。 |
| Q1700 | done | 桌面空态 **3 passed**（/reports 点财务报表折旧分类价值趋势）。禁 /m。 |
| Q1701 | done | 桌面空态 **3 passed**（/reports 点运维维保退役、工单完成率）。禁 /m。 |
| Q1702 | done | 桌面空态 **3 passed**（/reports 待处理工单与财务描述）。禁 /m。 |
| Q1703 | done | 桌面空态 **3 passed**（/reports 财务运维工单描述）。禁 /m。 |
| Q1704 | done | 桌面空态 **3 passed**（/reports 退役工单描述与导出 CSV）。禁 /m。 |
| Q1705 | done | 桌面空态 **3 passed**（/reports 导出PDF、报表中心、副标题）。禁 /m。 |
| Q1706 | done | 桌面空态 **3 passed**（/reports 近6/12/24个月）。禁 /m。 |
| Q1707 | done | 桌面空态 **3 passed**（/reports 卡片日期）。禁 /m。 |
| Q1708 | done | 桌面空态 **3 passed**（/login 品牌标语）。禁 /m。 |
| Q1709 | done | 桌面空态 **3 passed**（/login 智能运维入口与副标语）。禁 /m。 |
| Q1710 | done | 桌面空态 **3 passed**（/login 运行稳定与宇视品牌）。禁 /m。 |
| Q1711 | done | 桌面空态 **3 passed**（/login 全息版流星版与版权）。禁 /m。 |
| Q1712 | done | 桌面空态 **3 passed**（/login 账号密码与记住用户名）。禁 /m。 |
| Q1713 | done | 桌面空态 **3 passed**（/login 忘记密码登录系统SSO）。禁 /m。 |
| Q1714 | done | 桌面空态 **3 passed**（/login SSO说明与品牌名）。禁 /m。 |
| Q1715 | done | 桌面空态 **3 passed**（/login 用户名密码与台账文案）。禁 /m。 |
| Q1716 | done | 桌面空态 **3 passed**（/login 工作台文案与演示账户）。禁 /m。 |
| Q1717 | done | 桌面空态 **3 passed**（/login 演示账户角色）。禁 /m。 |
| Q1718 | done | 桌面空态 **3 passed**（/login 演示账户描述）。禁 /m。 |
| Q1719 | done | 桌面空态 **3 passed**（/login5 登录系统与演示体验）。禁 /m。 |
| Q1720 | done | 桌面空态 **3 passed**（/login 校验文案与系统管理员）。禁 /m。 |
| Q1721 | done | 桌面空态 **3 passed**（/login4 MES连接与信任条）。禁 /m。 |
| Q1722 | done | 桌面空态 **3 passed**（/login4 闭环协同与演示体验）。禁 /m。 |
| Q1723 | done | 桌面空态 **3 passed**（/login4 登录系统与平台名）。禁 /m。 |
| Q1724 | done | 桌面空态 **3 passed**（/login4 用户名密码记住）。禁 /m。 |
| Q1725 | done | 桌面空态 **3 passed**（/login4 忘记密码工作台SSO）。禁 /m。 |
| Q1726 | done | 桌面空态 **3 passed**（/login4 演示账户与版本导航）。禁 /m。 |
| Q1727 | done | 桌面空态 **3 passed**（/login4 标准全息流星版）。禁 /m。 |
| Q1728 | done | 桌面空态 **3 passed**（/login4 账号密码占位与校验）。禁 /m。 |
| Q1729 | done | 桌面空态 **3 passed**（/vendor-portal 标题编码登录）。禁 /m。 |
| Q1730 | done | 桌面空态 **3 passed**（门户密码、login4管理员、login5演示账户）。禁 /m。 |
| Q1731 | done | 桌面空态 **3 passed**（/login4 资产运维、/login5 管理员）。禁 /m。 |
| Q1732 | done | 桌面空态 **3 passed**（/login4 部门负责人全域权限）。禁 /m。 |
| Q1733 | done | 桌面空态 **3 passed**（/login4 资源审批巡检、/login5 资产管理员）。禁 /m。 |
| Q1734 | done | 桌面空态 **3 passed**（/login5 部门运维全域权限）。禁 /m。 |
| Q1735 | done | 桌面空态 **3 passed**（/login5 演示描述）。禁 /m。 |
| Q1736 | done | 桌面空态 **3 passed**（/login5 记住忘记与进入工作台）。禁 /m。 |
| Q1737 | done | 桌面空态 **3 passed**（/login5 SSO与用户名密码）。禁 /m。 |
| Q1738 | done | 桌面空态 **3 passed**（/login5 占位与校验）。禁 /m。 |
| Q1739 | done | 桌面空态 **3 passed**（login5/4 校验、analytics 近6个月）。禁 /m。 |
| Q1740 | done | 桌面空态 **3 passed**（SSO 失败返回登录、欢迎回来）。禁 /m。 |
| Q1741 | done | 桌面空态 **3 passed**（/categories 暂无分类与添加名称）。禁 /m。 |
| Q1742 | done | 桌面空态 **3 passed**（/categories 点添加编码与说明）。禁 /m。 |
| Q1743 | done | 桌面空态 **3 passed**（/categories 创建取消与名称校验）。禁 /m。 |
| Q1744 | done | 桌面空态 **3 passed**（分类编码校验与标题）。禁 /m。 |
| Q1745 | done | 桌面空态 **3 passed**（/locations 标题空表与新增位置）。禁 /m。 |
| Q1746 | done | 桌面空态 **3 passed**（/locations 点新增名称占位确认）。禁 /m。 |
| Q1747 | done | 桌面空态 **3 passed**（/locations 点新增编码占位取消）。禁 /m。 |
| Q1748 | done | 桌面空态 **3 passed**（/manufacturers 点新增说明名称）。禁 /m。 |
| Q1749 | done | 桌面空态 **3 passed**（/manufacturers 点新增编码联系人）。禁 /m。 |
| Q1750 | done | 桌面空态 **3 passed**（/manufacturers 点新增电话邮箱）。禁 /m。 |
| Q1751 | done | 桌面空态 **3 passed**（/manufacturers 点新增官网国家）。禁 /m。 |
| Q1752 | done | 桌面空态 **3 passed**（/manufacturers 点新增地址确认）。禁 /m。 |
| Q1753 | done | 桌面空态 **3 passed**（/manufacturers 点新增剩余占位）。禁 /m。 |
| Q1754 | done | 桌面空态 **3 passed**（/manufacturers 国家取消与名称列）。禁 /m。 |
| Q1755 | done | 桌面空态 **3 passed**（/manufacturers 编码联系人电话列）。禁 /m。 |
| Q1756 | done | 桌面空态 **3 passed**（/manufacturers 国家状态操作列）。禁 /m。 |
| Q1757 | done | 桌面空态 **3 passed**（制造商管理、供应商名称）。禁 /m。 |
| Q1758 | done | 桌面空态 **3 passed**（/vendors 点新增编码联系人）。禁 /m。 |
| Q1759 | done | 桌面空态 **3 passed**（/vendors 点新增电话邮箱）。禁 /m。 |
| Q1760 | done | 桌面空态 **3 passed**（/vendors 点新增地址邮箱占位）。禁 /m。 |
| Q1761 | done | 桌面空态 **3 passed**（/vendors 联系人姓名确认与标题）。禁 /m。 |
| Q1762 | done | 桌面空态 **3 passed**（/vendors 取消、/contracts 合同名称）。禁 /m。 |
| Q1763 | done | 桌面空态 **3 passed**（/contracts 点新增编号与类型）。禁 /m。 |
| Q1764 | done | 桌面空态 **3 passed**（/contracts 点新增金额货币备注）。禁 /m。 |
| Q1765 | done | 桌面空态 **3 passed**（/contracts 点新增起止日期备注）。禁 /m。 |
| Q1766 | done | 桌面空态 **3 passed**（/contracts 点新增金额占位确认取消）。禁 /m。 |
| Q1767 | done | 桌面空态 **3 passed**（/contracts 合同管理、CNY、状态）。禁 /m。 |
| Q1768 | done | 桌面空态 **3 passed**（/contracts 点新增展开合同类型）。禁 /m。 |
| Q1769 | done | 桌面空态 **3 passed**（/contracts 点新增服务合同与状态）。禁 /m。 |
| Q1770 | done | 桌面空态 **3 passed**（/contracts 点新增到期取消与USD）。禁 /m。 |
| Q1771 | done | 桌面空态 **3 passed**（/contracts 合同编号名称类型列）。禁 /m。 |
| Q1772 | done | 桌面空态 **3 passed**（/contracts 金额操作列与名称校验）。禁 /m。 |
| Q1773 | done | 桌面空态 **3 passed**（/purchase-orders 点新增供应商日期到货）。禁 /m。 |
| Q1774 | done | 桌面空态 **3 passed**（/purchase-orders 点新增备注与明细占位）。禁 /m。 |
| Q1775 | done | 桌面空态 **3 passed**（/purchase-orders 点新增明细列与添加行）。禁 /m。 |
| Q1776 | done | 桌面空态 **3 passed**（/purchase-orders 点新增单价确认取消）。禁 /m。 |
| Q1777 | done | 桌面空态 **3 passed**（采购订单管理、点新增金额备注）。禁 /m。 |
| Q1778 | done | 桌面空态 **3 passed**（/licenses 点新增软件名称厂商）。禁 /m。 |
| Q1779 | done | 桌面空态 **3 passed**（/licenses 点新增厂商软件类型）。禁 /m。 |
| Q1780 | done | 桌面空态 **3 passed**（/licenses 点新增版本授权类型）。禁 /m。 |
| Q1781 | done | 桌面空态 **3 passed**（/licenses 点新增席位购买价格）。禁 /m。 |
| Q1782 | done | 桌面空态 **3 passed**（/licenses 点新增价格采购单号）。禁 /m。 |
| Q1783 | done | 桌面空态 **3 passed**（/licenses 点新增备注确认取消）。禁 /m。 |
| Q1784 | done | 桌面空态 **3 passed**（软件许可证管理、备注请选择）。禁 /m。 |
| Q1785 | done | 桌面空态 **3 passed**（/insurances/new 保单号保险名称）。禁 /m。 |
| Q1786 | done | 桌面空态 **3 passed**（/insurances/new 保险名称类型公司）。禁 /m。 |
| Q1787 | done | 桌面空态 **3 passed**（/insurances/new 保险公司保费）。禁 /m。 |
| Q1788 | done | 桌面空态 **3 passed**（/insurances/new 保额免赔额）。禁 /m。 |
| Q1789 | done | 桌面空态 **3 passed**（/insurances/new 免赔额起止日期）。禁 /m。 |
| Q1790 | done | 桌面空态 **3 passed**（/insurances/new 状态备注返回）。禁 /m。 |
| Q1791 | done | 桌面空态 **3 passed**（/insurances/new 备注财产险标题）。禁 /m。 |
| Q1792 | done | 桌面空态 **3 passed**（/insurances/new 责任险车险生效中）。禁 /m。 |
| Q1793 | done | 桌面空态 **3 passed**（/insurances/new 保存与状态选项）。禁 /m。 |
| Q1794 | done | 桌面空态 **3 passed**（/insurances/new 点保存校验）。禁 /m。 |
| Q1795 | done | 桌面空态 **3 passed**（/spare-parts/new 备件编码名称）。禁 /m。 |
| Q1796 | done | 桌面空态 **3 passed**（/spare-parts/new 名称规格）。禁 /m。 |
| Q1797 | done | 桌面空态 **3 passed**（/spare-parts/new 计量单位库存）。禁 /m。 |
| Q1798 | done | 桌面空态 **3 passed**（/spare-parts/new 安全库存单价申请信息）。禁 /m。 |
| Q1799 | done | 桌面空态 **3 passed**（/spare-parts/new 缺口待确认到货）。禁 /m。 |
| Q1800 | done | 桌面空态 **3 passed**（/spare-parts/new 备件申请提交返回）。禁 /m。 |
| Q1801 | done | 桌面空态 **3 passed**（备件副标题、预算返回列表年度）。禁 /m。 |
| Q1802 | done | 桌面空态 **3 passed**（/budgets/new「预算类型」「采购预算」「创建预算」）。禁 /m。 |
| Q1803 | done | 桌面空态 **3 passed**（/budgets/new「部门ID」「分类ID」「预算总额」）。禁 /m。 |
| Q1804 | done | 桌面空态 **3 passed**（/budgets/new「状态」「草稿」「取消」）。禁 /m。 |
| Q1805 | done | 桌面空态 **3 passed**（/budgets/new「维保预算」「运营预算」「已审批」）。禁 /m。 |
| Q1806 | done | 桌面空态 **3 passed**（/budgets/new「已关闭」、/budgets/1「预算执行进度」「审批人」）。禁 /m。 |
| Q1807 | done | 桌面空态 **3 passed**（/budgets/1「预算详情」「基本信息」「预算总额」）。禁 /m。 |
| Q1808 | done | 桌面空态 **3 passed**（/budgets/1「已使用」「已承诺」「剩余」）。禁 /m。 |
| Q1809 | done | 桌面空态 **3 passed**（/budgets/1「执行率」「编辑」「删除」）。禁 /m。 |
| Q1810 | done | 桌面空态 **3 passed**（/budgets/1 点删除确认框三文案）。禁 /m。 |
| Q1811 | done | 桌面空态 **3 passed**（/budgets/1 点删除「取消」、详情「采购」「草稿」）。禁 /m。 |
| Q1812 | done | 桌面空态 **3 passed**（/budgets/1/edit 编辑预算/修改预算信息/更新预算；补 budgets/:id/edit 路由；从 404 未挂载列表移除该 path）。禁 /m。 |
| Q1813 | done | 桌面空态 **3 passed**（/budgets/1 详情「维保」「运营」「已审批」）。禁 /m。 |
| Q1814 | done | 桌面空态 **3 passed**（/budgets/1「已关闭」、失败态「返回列表」、「2026年 · 采购预算」）。禁 /m。 |
| Q1815 | done | 桌面空态 **3 passed**（/insurances/1/edit 编辑保险/保存/返回；补路由并对齐 navigate）。禁 /m。 |
| Q1816 | done | 桌面空态 **3 passed**（/insurances/1「保险详情」「理赔记录」「新增理赔」）。禁 /m。 |
| Q1817 | done | 桌面空态 **3 passed**（/insurances/1「理赔编号」「理赔日期」「理赔金额」）。禁 /m。 |
| Q1818 | done | 桌面空态 **3 passed**（/insurances/1「已赔付金额」「赔付日期」「事故描述」）。禁 /m。 |
| Q1819 | done | 桌面空态 **3 passed**（/insurances/1「已过期」「已取消」「待处理」）。禁 /m。 |
| Q1820 | done | 桌面空态 **3 passed**（/insurances/1「已批准」「已拒绝」「创建时间」）。禁 /m。 |
| Q1821 | done | 桌面空态 **3 passed**（/insurances/1「编辑」「返回」「保单号」）。禁 /m。 |
| Q1822 | done | 桌面空态 **3 passed**（/insurances/1「保险名称」「保险类型」「保险公司」）。禁 /m。 |
| Q1823 | done | 桌面空态 **3 passed**（/insurances/1「保费」「保额」「免赔额」）。禁 /m。 |
| Q1824 | done | 桌面空态 **3 passed**（/insurances/1「开始日期」「结束日期」「备注」）。禁 /m。 |
| Q1825 | done | 桌面空态 **3 passed**（/spare-parts/1「返回」「编辑」「当前库存」）。禁 /m。 |
| Q1826 | done | 桌面空态 **3 passed**（/spare-parts/1「安全库存」「库存状态」「库存正常」）。禁 /m。 |
| Q1827 | done | 桌面空态 **3 passed**（/spare-parts/1「基本信息」「备件编码」「规格型号」）。禁 /m。 |
| Q1828 | done | 桌面空态 **3 passed**（/spare-parts/1「计量单位」「单价」「领用记录」）。禁 /m。 |
| Q1829 | done | 桌面空态 **3 passed**（/spare-parts/1「停用」「启用」「缺货」）。禁 /m。 |
| Q1830 | done | 桌面空态 **3 passed**（/spare-parts/1「状态」「编码:」「工单 #」）。禁 /m。 |
| Q1831 | done | 桌面空态 **3 passed**（/intake/1「验收单详情」「基本信息」「验收单号」）。禁 /m。 |
| Q1832 | done | 桌面空态 **3 passed**（/intake/1「验收日期」「总金额」「创建时间」）。禁 /m。 |
| Q1833 | done | 桌面空态 **3 passed**（/intake/1「检查项」「入库资产列表」「状态」）。禁 /m。 |
| Q1834 | done | 桌面空态 **3 passed**（/intake/1「提交验收」「取消」「验收通过」）。禁 /m。 |
| Q1835 | done | 桌面空态 **3 passed**（/intake/1「保存质检结果」「驳回」、失败态「返回列表」）。禁 /m。 |
| Q1836 | done | 桌面空态 **3 passed**（/intake/1 检查项「名称」「预期值」「实际值」）。禁 /m。 |
| Q1837 | done | 桌面空态 **3 passed**（/intake/1「结果」「备注」「资产编号」）。禁 /m。 |
| Q1838 | done | 桌面空态 **3 passed**（/intake/1「资产名称」「品牌」「型号」）。禁 /m。 |
| Q1839 | done | 桌面空态 **3 passed**（/intake/1「原值」「购置日期」「待检」）。禁 /m。 |
| Q1840 | done | 桌面空态 **3 passed**（/intake/1「通过」「不通过」「驳回原因」）。禁 /m。 |
| Q1841 | done | 桌面空态 **3 passed**（/assignments/1/edit 编辑领用单/保存修改/返回）。禁 /m。 |
| Q1842 | done | 桌面空态 **3 passed**（/borrows/1/edit 编辑借用单/保存修改/返回）。禁 /m。 |
| Q1843 | done | 桌面空态 **3 passed**（/borrows/1/edit「借用信息」「预计归还日期」「借用用途」）。禁 /m。 |
| Q1844 | done | 桌面空态 **3 passed**（/borrows/1/edit「资产」「备注」「取消」）。禁 /m。 |
| Q1845 | done | 桌面空态 **3 passed**（/inspections/1/edit 编辑检验记录/检验编号/资产ID；setFields 只填表单字段）。禁 /m。 |
| Q1846 | done | 桌面空态 **3 passed**（/inspections/1/edit「检验模板」「检验类型」「检验日期」）。禁 /m。 |
| Q1847 | done | 桌面空态 **3 passed**（/inspections/1/edit「下次检验日期」「检验机构」「检验人」）。禁 /m。 |
| Q1848 | done | 桌面空态 **3 passed**（/inspections/1/edit「检验结果」「检查发现」「检验照片」）。禁 /m。 |
| Q1849 | done | 桌面空态 **3 passed**（/inspections/1/edit「证书编号」「证书到期日」「检验费用」）。禁 /m。 |
| Q1850 | done | 桌面空态 **3 passed**（/inspections/1/edit「报告附件」「更新」「取消」）。禁 /m。 |
| Q1851 | done | 桌面空态 **3 passed**（/inspections/1/edit「扫码」「自动生成或手动输入」「输入资产ID」）。禁 /m。 |
| Q1852 | done | 桌面空态 **3 passed**（/inspections/1/upload「检验照片上传」「上传新照片」「选择照片」）。禁 /m。 |
| Q1853 | done | 桌面空态 **3 passed**（/inspections/1/upload「已上传照片」「暂无已上传的照片」「返回详情页」）。禁 /m。 |
| Q1854 | done | 桌面空态 **3 passed**（/inspections/1/upload「检验记录列表」「检验记录详情」「照片上传」）。禁 /m。 |
| Q1855 | done | 桌面空态 **3 passed**（/inspections/1/upload「检验编号:」「共 0 张」「INSP-001」）。禁 /m。 |
| Q1856 | done | 桌面空态 **3 passed**（/inspections/1「检验详情」「编辑」「检验编号」）。禁 /m。 |
| Q1857 | done | 桌面空态 **3 passed**（/inspections/1「资产ID」「检验类型」「检验日期」）。禁 /m。 |
| Q1858 | done | 桌面空态 **3 passed**（/inspections/1「下次检验日期」「检验结果」「检验机构」）。禁 /m。 |
| Q1859 | done | 桌面空态 **3 passed**（/inspections/1「检验人」「证书编号」「证书到期日」）。禁 /m。 |
| Q1860 | done | 桌面空态 **3 passed**（/inspections/1「检验费用」「报告附件」「检验模板」）。禁 /m。 |
| Q1861 | done | 桌面空态 **3 passed**（/inspections/1「检查发现」「待检验」「年度检验」）。禁 /m。 |
| Q1862 | done | 桌面空态 **3 passed**（/inspections/new「新增检验记录」「创建」「取消」）。禁 /m。 |
| Q1863 | done | 桌面空态 **3 passed**（/assignments/1「领用单详情」「提交审批」「编辑」）。禁 /m。 |
| Q1864 | done | 桌面空态 **3 passed**（/assignments/1「取消」「基本信息」「资产编号」）。禁 /m。 |
| Q1865 | done | 桌面空态 **3 passed**（/assignments/1「资产名称」「领用类型」「状态」）。禁 /m。 |
| Q1866 | done | 桌面空态 **3 passed**（/assignments/1「预计归还日期」「草稿」「待审批」）。禁 /m。 |
| Q1867 | done | 桌面空态 **3 passed**（/assignments/1「已审批」「已签收」「待归还」）。禁 /m。 |
| Q1868 | done | 桌面空态 **3 passed**（/assignments/1「已归还」「A-001」「笔记本」）。禁 /m。 |
| Q1869 | done | 桌面空态 **3 passed**（/borrows/1「借用详情」「提交审批」「编辑」）。禁 /m。 |
| Q1870 | done | 桌面空态 **3 passed**（/borrows/1「取消」「详细信息」「资产编号」）。禁 /m。 |
| Q1871 | done | 桌面空态 **3 passed**（/borrows/1「资产名称」「状态」「借用日期」）。禁 /m。 |
| Q1872 | done | 桌面空态 **3 passed**（/borrows/1「预计归还日期」「投影仪」「B-001」）。禁 /m。 |
| Q1873 | done | 桌面空态 **3 passed**（/assignments/new「新建领用单」「创建领用单」「返回」）。禁 /m。 |
| Q1874 | done | 桌面空态 **3 passed**（/assignments/new「基本信息」「领用类型」「资产」）。禁 /m。 |
| Q1875 | done | 桌面空态 **3 passed**（/assignments/new「使用人」「使用部门 ID」「预计归还日期」）。禁 /m。 |
| Q1876 | done | 桌面空态 **3 passed**（/assignments/new「备注」「取消」「长期领用」）。禁 /m。 |
| Q1877 | done | 桌面空态 **3 passed**（/assignments/new「短期借用」「归还入库」「调拨转移」）。禁 /m。 |
| Q1878 | done | 桌面空态 **3 passed**（/assignments/new placeholder「使用人 ID」「使用部门 ID」「备注」）。禁 /m。 |
| Q1879 | done | 桌面空态 **3 passed**（/borrows/new「新建借用单」「创建借用单」「返回」）。禁 /m。 |
| Q1880 | done | 桌面空态 **3 passed**（/borrows/new「借用信息」「资产」「预计归还日期」）。禁 /m。 |
| Q1881 | done | 桌面空态 **3 passed**（/borrows/new「借用用途」「备注」「取消」）。禁 /m。 |
| Q1882 | done | 桌面空态 **3 passed**（/inspection-templates「检验模板管理」「搜索」「重置」）。禁 /m。 |
| Q1883 | done | 桌面空态 **3 passed**（/inspection-templates 列头「模板名称」「检验类型」「检验周期」）。禁 /m。 |
| Q1884 | done | 桌面空态 **3 passed**（/inspection-templates 列头「状态」「创建时间」「操作」）。禁 /m。 |
| Q1885 | done | 桌面空态 **3 passed**（/inspection-templates placeholder「模板名称」「检验类型」+「新增模板」）。禁 /m。 |
| Q1886 | done | 桌面空态 **3 passed**（/inspection-records「检验记录管理」「创建、编辑和追踪设备检验记录」「批量生成」）。禁 /m。 |
| Q1887 | done | 桌面空态 **3 passed**（/inspection-records「新增检验」「总记录」「通过」）。禁 /m。 |
| Q1888 | done | 桌面空态 **3 passed**（/inspection-records「待检验」「已过期/不通过」「搜索」）。禁 /m。 |
| Q1889 | done | 桌面空态 **3 passed**（/inspection-records「重置」「至」+ placeholder「检验编号/检验机构/检验人」）。禁 /m。 |
| Q1890 | done | 桌面空态 **3 passed**（/inspection-records 筛选「全部类型」「年度检验」「定期检验」）。禁 /m。 |
| Q1891 | done | 桌面空态 **3 passed**（/inspection-records 筛选「专项检验」「全部结果」「不通过」）。禁 /m。 |
| Q1892 | done | 桌面空态 **3 passed**（/inspection-records「附条件通过」+ 列头「检验编号」「资产ID」）。禁 /m。 |
| Q1893 | done | 桌面空态 **3 passed**（/inspection-records 列头「检验类型」「检验日期」「下次检验」）。禁 /m。 |
| Q1894 | done | 桌面空态 **3 passed**（/inspection-records 列头「检验机构」「检验人」「结果」）。禁 /m。 |
| Q1895 | done | 桌面空态 **3 passed**（/inspection-records 列头「操作」+「暂无检验记录」「当前没有可显示的数据」）。禁 /m。 |
| Q1896 | done | 桌面空态 **3 passed**（/stocktaking-cycles/new「返回列表」「新建盘点周期」「周期名称」）。禁 /m。 |
| Q1897 | done | 桌面空态 **3 passed**（/stocktaking-cycles/new「盘点类型」+ placeholder「例如：2024年6月循环盘点」+「保存」；option「全盘点」hidden 不测）。禁 /m。 |
| Q1898 | done | 桌面空态 **3 passed**（/stocktaking-cycles「循环盘点周期」「管理库存盘点计划与执行周期」「总周期」）。禁 /m。 |
| Q1899 | done | 桌面空态 **3 passed**（/stocktaking-cycles「进行中」「已完成」「已计划」）。禁 /m。 |
| Q1900 | done | 桌面空态 **3 passed**（/stocktaking-cycles「全部状态」「已暂停」「已取消」）。禁 /m。 |
| Q1901 | done | 桌面空态 **3 passed**（/stocktaking-cycles 列头「周期名称」「类型」「状态」）。禁 /m。 |
| Q1902 | done | 桌面空态 **3 passed**（/stocktaking-cycles 列头「开始时间」「结束时间」「操作」）。禁 /m。 |
| Q1903 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「返回列表」「周期信息」「统计信息」）。禁 /m。 |
| Q1904 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「总任务数」「待盘点」「已盘点」）。禁 /m。 |
| Q1905 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「已调整」「完成进度」「导出 PDF 报告」）。禁 /m。 |
| Q1906 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「分配任务」「盘点任务列表」「E2E周期」）。禁 /m。 |
| Q1907 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「状态」「类型」「开始时间」）。禁 /m。 |
| Q1908 | done | 桌面空态 **3 passed**（/stocktaking-cycles/1「结束时间」「已计划」「操作」）。禁 /m。 |
| Q1909 | done | 桌面空态 **3 passed**（/inventory/cycle-count「循环盘点规则配置（ABC分类）」「触发A类盘点」「A类（关键资产）」）。禁 /m。 |
| Q1910 | done | 桌面空态 **3 passed**（/inventory/cycle-count 列头「分类」「盘点频率」「最小价值」）。禁 /m。 |
| Q1911 | done | 桌面空态 **3 passed**（/inventory/cycle-count 列头「最大价值」「操作」+「B类（重要资产）」）。禁 /m。 |
| Q1912 | done | 桌面空态 **3 passed**（/inventory/cycle-count「C类（一般资产）」「季度盘点」「年度盘点」）。禁 /m。 |
| Q1913 | done | 桌面空态 **3 passed**（/inventory/cycle-count 点「新增规则」后「ABC分类」「盘点频率」「最小价值（元）」）。禁 /m。 |
| Q1914 | done | 桌面空态 **3 passed**（/inventory/cycle-count 点「新增规则」后「最大价值（元）」「适用资产分类」+ placeholder「不填表示无下限」；antd Select placeholder 不测）。禁 /m。 |
| Q1915 | done | 桌面空态 **3 passed**（/inventory/cycle-count 点「新增规则」后 placeholder「不填表示无上限」「JSON数组：[1,2,3] 或留空表示全部」+「确定」）。禁 /m。 |
| Q1916 | done | 桌面空态 **3 passed**（/inventory/cycle-count 点「新增规则」后「取消」+ 弹窗「新增规则」+「月度盘点」）。禁 /m。 |
| Q1917 | done | 桌面空态 **3 passed**（/inventory/abc-classification「ABC 分类管理」「ABC 分类规则」「资产列表」）。禁 /m。 |
| Q1918 | done | 桌面空态 **3 passed**（/inventory/abc-classification「A 类（高价值）」「B 类（中价值）」「C 类（低价值）」）。禁 /m。 |
| Q1919 | done | 桌面空态 **3 passed**（/inventory/abc-classification 列头「资产编号」「资产名称」「分类」）。禁 /m。 |
| Q1920 | done | 桌面空态 **3 passed**（/inventory/abc-classification 列头「ABC 分类」「原值」+「需月度盘点」）。禁 /m。 |
| Q1921 | done | 桌面空态 **3 passed**（/inventory/abc-classification「需季度盘点」「需年度盘点」+ 点批量重新分类「确定」）。禁 /m。 |
| Q1922 | done | 桌面空态 **3 passed**（/safety-checklists/config「安全检查表模板」「配置检查表模板与检查项清单」「全部模板」）。禁 /m。 |
| Q1923 | done | 桌面空态 **3 passed**（/safety-checklists/config「已启用」「已禁用」「模板列表」）。禁 /m。 |
| Q1924 | done | 桌面空态 **3 passed**（/safety-checklists/config 列头「模板名称」「状态」「检查项」）。禁 /m。 |
| Q1925 | done | 桌面空态 **3 passed**（/safety-checklists/config 列头「操作」+ 筛选「全部」「启用」）。禁 /m。 |
| Q1926 | done | 桌面空态 **3 passed**（/safety-checklists/config「禁用」+ 点「新增模板」后「模板名称」+ placeholder「如：消防安全检查表」）。禁 /m。 |
| Q1927 | done | 桌面空态 **3 passed**（/safety-checklists/config 点「新增模板」后「适用资产分类」「确认新增」+ placeholder「JSON数组：[1,2,3] 或留空」）。禁 /m。 |
| Q1928 | done | 桌面空态 **3 passed**（config 点新增「取消」+ history「安全检查历史」「查看安全检查执行记录与结果明细」）。禁 /m。 |
| Q1929 | done | 桌面空态 **3 passed**（/safety-checklists/history「全部执行」「已完成」「通过」）。禁 /m。 |
| Q1930 | done | 桌面空态 **3 passed**（/safety-checklists/history「不通过」「执行记录」「执行ID」）。禁 /m。 |
| Q1931 | done | 桌面空态 **3 passed**（/safety-checklists/history 列头「模板ID」「资产ID」「执行人ID」）。禁 /m。 |
| Q1932 | done | 桌面空态 **3 passed**（/safety-checklists/history 列头「执行日期」「状态」「总体结果」）。禁 /m。 |
| Q1933 | done | 桌面空态 **3 passed**（/safety-checklists/history 列头「操作」+ 筛选「全部」「进行中」）。禁 /m。 |
| Q1934 | done | 桌面空态 **3 passed**（/safety-checklists/execute「开始安全检查」「安全检查」「开始执行检查」）。禁 /m。 |
| Q1935 | done | 桌面空态 **3 passed**（/safety-checklists/execute「包含 0 个检查项」；execute/1「安全检查执行」+ 按钮「保存」）。禁 /m。 |
| Q1936 | done | 桌面空态 **3 passed**（execute/1「完成检查」；/risk-assessments「风险矩阵」「5x5 风险评估热力图与评估记录管理」）。禁 /m。 |
| Q1937 | done | 桌面空态 **3 passed**（/risk-assessments「风险矩阵（5x5）」「风险评估记录」「极低」）。禁 /m。 |
| Q1938 | done | 桌面空态 **3 passed**（/risk-assessments 轴标签「极高」「极小」「极大」）。禁 /m。 |
| Q1939 | done | 桌面空态 **3 passed**（/risk-assessments 筛选「重大」「高危」「中危」）。禁 /m。 |
| Q1940 | done | 桌面空态 **3 passed**（/risk-assessments 筛选「低危」「全部」+ 列头「资产ID」）。禁 /m。 |
| Q1941 | done | 桌面空态 **3 passed**（/risk-assessments 列头「可能性」「影响程度」「风险等级」）。禁 /m。 |
| Q1942 | done | 桌面空态 **3 passed**（/risk-assessments 列头「缓解措施」「评审日期」「操作」）。禁 /m。 |
| Q1943 | done | 桌面空态 **3 passed**（/risk-assessments/new「新增风险评估」「资产ID」「可能性（1-5）」）。禁 /m。 |
| Q1944 | done | 桌面空态 **3 passed**（/risk-assessments/new「影响程度（1-5）」「缓解措施」「评审日期」）。禁 /m。 |
| Q1945 | done | 桌面空态 **3 passed**（/risk-assessments/new「评估人ID」「创建」+ placeholder「输入资产ID」）。禁 /m。 |
| Q1946 | done | 桌面空态 **3 passed**（/risk-assessments/new「取消」+ placeholder「描述风险缓解措施」「评估人ID」）。禁 /m。 |
| Q1947 | done | 桌面空态 **3 passed**（/risk-assessments/new「自动计算的风险等级」「LOW（低危）」「1 - 极低」）。禁 /m。 |
| Q1948 | done | 桌面空态 **3 passed**（/risk-matrix「风险矩阵配置」「管理风险评估的概率维度、严重度维度和等级映射规则」「创建矩阵」）。禁 /m。 |
| Q1949 | done | 桌面空态 **3 passed**（/risk-matrix 列头「矩阵名称」「状态」「创建时间」）。禁 /m。 |
| Q1950 | done | 桌面空态 **3 passed**（/risk-matrix 列头「操作」+「暂无矩阵配置」+ 点创建「创建矩阵配置」）。禁 /m。 |
| Q1951 | done | 桌面空态 **3 passed**（/risk-matrix 点「创建矩阵」后「矩阵名称」+ placeholder「输入矩阵名称」+「概率维度」）。禁 /m。 |
| Q1952 | done | 桌面空态 **3 passed**（/risk-matrix 点「创建矩阵」后「严重度维度」「等级映射」「添加维度」）。禁 /m。 |
| Q1953 | done | 桌面空态 **3 passed**（/risk-matrix 点「创建矩阵」后「概率维度配置」「创建」「取消」）。禁 /m。 |
| Q1954 | done | 桌面空态 **3 passed**（/risk-assessments/1/edit「编辑风险评估」「资产ID」「可能性（1-5）」）。禁 /m。 |
| Q1955 | done | 桌面空态 **3 passed**（/risk-assessments/1/edit「影响程度（1-5）」「缓解措施」「更新」）。禁 /m。 |
| Q1956 | done | 桌面空态 **3 passed**（/risk-assessments/1/edit「评审日期」「取消」「评估人ID」）。禁 /m。 |
| Q1957 | done | 桌面空态 **3 passed**（/sam「SAM 合规管理」「总许可数」「合规」）。禁 /m。 |
| Q1958 | done | 桌面空态 **3 passed**（/sam「超用」「闲置」「已过期」）。禁 /m。 |
| Q1959 | done | 桌面空态 **3 passed**（/sam「合规率」「许可类型分布」「风险告警」）。禁 /m。 |
| Q1960 | done | 桌面空态 **3 passed**（/sam「席位使用率 TOP」「扫描历史」「扫描ID」）。禁 /m。 |
| Q1961 | done | 桌面空态 **3 passed**（/sam 扫描历史列头「扫描时间」「总许可」「过期」）。禁 /m。 |
| Q1962 | done | 桌面空态 **3 passed**（/report-builder「自定义报表构建器」「通过拖拽选择字段，快速创建自定义报表」「可用字段」）。禁 /m。 |
| Q1963 | done | 桌面空态 **3 passed**（/report-builder「报表名称」「报表类型」「图表类型」）。禁 /m。 |
| Q1964 | done | 桌面空态 **3 passed**（/report-builder「已选字段」「生成预览」「保存报表」）。禁 /m。 |
| Q1965 | done | 桌面空态 **3 passed**（/report-builder「数据预览」「表格」「柱状图」）。禁 /m。 |
| Q1966 | done | 桌面空态 **3 passed**（/report-builder「折线图」「饼图」+ placeholder「输入报表名称」）。禁 /m。 |
| Q1967 | done | 桌面空态 **3 passed**（/report-builder 字段「资产编码」「资产名称」「资产分类」）。禁 /m。 |
| Q1968 | done | 桌面空态 **3 passed**（/report-builder 字段「原值」「净值」「购入日期」）。禁 /m。 |
| Q1969 | done | 桌面空态 **3 passed**（/report-builder 字段「位置」「使用部门」「工单数量」）。禁 /m。 |
| Q1970 | done | 桌面空态 **3 passed**（/report-builder 字段「保养次数」「故障次数」「MTBF」）。禁 /m。 |
| Q1971 | done | 桌面空态 **3 passed**（/report-builder 字段「MTTR」「折旧金额」「维保费用」）。禁 /m。 |
| Q1972 | done | 桌面空态 **3 passed**（/report-builder 字段「能耗费用」「总成本」+ 分组「财务」）。禁 /m。 |
| Q1973 | done | 桌面空态 **3 passed**（/report-builder 分组「资产」「运维」+ 字段「状态」；option「资产报表」hidden）。禁 /m。 |
| Q1974 | done | 桌面空态 **3 passed**（/analytics/tco「资产 TCO 构成」「请输入资产ID查询」「资产ID」）。禁 /m。 |
| Q1975 | done | 桌面空态 **3 passed**（/analytics/tco「TCO 趋势 (近12个月)」「部门 TCO 排行」「请先查询资产」）。禁 /m。 |
| Q1976 | done | 桌面空态 **3 passed**（/analytics/tco「分类 TCO 排行」「请输入部门ID查询」「请输入分类ID查询」）。禁 /m。 |
| Q1977 | done | 桌面空态 **3 passed**（/analytics/health「平均健康分」「暂无数据」「资产健康评分」）。禁 /m。 |
| Q1978 | done | 桌面空态 **3 passed**（/analytics/health 表头空态不渲染；切 /analytics/reliability「可靠性分析」「MTBF」「MTTR」）。禁 /m。 |
| Q1979 | done | 桌面空态 **3 passed**（/workflows「业务流程管理」「集中维护审批流程、发布状态、版本快照和业务入口。」「返回资产处置」）。禁 /m。 |
| Q1980 | done | 桌面空态 **3 passed**（/workflows「条结果」「当前选中流程」「创建并发布默认流程」）。禁 /m。 |
| Q1981 | done | 桌面空态 **3 passed**（/workflows「流程信息」「版本历史与回滚」「该流程尚未形成可发布版本，业务入口会被阻断。」）。禁 /m。 |
| Q1982 | done | 桌面空态 **3 passed**（/workflows「当前版本」「发布快照」「审批/办理」）。禁 /m。 |
| Q1983 | done | 桌面空态 **3 passed**（/workflows「总节点」「本地草稿」「可发起状态」）。禁 /m。 |
| Q1984 | done | 桌面空态 **3 passed**（/workflows「业务对象」「更新时间」「发布时间」）。禁 /m。 |
| Q1985 | done | 桌面空态 **3 passed**（/workflows「创建时间」「更新人」「发布人」）。禁 /m。 |
| Q1986 | done | 桌面空态 **3 passed**（/workflows「发起入口」「契约状态」「阻断原因」）。禁 /m。 |
| Q1987 | done | 桌面空态 **3 passed**（/workflows「未记录」「未读取」「显示第」）。禁 /m。 |
| Q1988 | done | 桌面空态 **3 passed**（/workflows「资产转移流程」「资产清退流程」「资产报废转让流程」）。禁 /m。 |
| Q1989 | done | 桌面空态 **3 passed**（/workflows「资产赔偿流程」「资产退役流程」「首页」）。禁 /m。 |
| Q1990 | done | 桌面空态 **3 passed**（/workflows「上一页」「下一页」「末页」）。禁 /m。 |
| Q1991 | done | 桌面空态 **3 passed**（/workflows「未知」「业务：资产转移」「用于资产转出、转入确认及双方部门资产管理员审批的流程定义。」）。禁 /m。 |
| Q1992 | done | 桌面空态 **3 passed**（/workflows 清退/报废/赔偿说明）。禁 /m。 |
| Q1993 | done | 桌面空态 **3 passed**（/workflows 退役说明 +「业务：资产清退」「业务：资产报废转让」）。禁 /m。 |
| Q1994 | done | 桌面空态 **3 passed**（/workflows「业务：资产赔偿」「业务：资产退役」「ASSET_TRANSFER」）。禁 /m。 |
| Q1995 | done | 桌面空态 **3 passed**（/workflows「ASSET_CLEARANCE」「ASSET_SCRAP」「ASSET_COMPENSATION」）。禁 /m。 |
| Q1996 | done | 桌面空态 **3 passed**（/workflows「RETIREMENT」「当前页」；点新建「从模板创建」）。禁 /m。 |
| Q1997 | done | 桌面空态 **3 passed**（/workflow-designer「流程中心 / 设计器」「保存草稿」「发布流程」）。禁 /m。 |
| Q1998 | done | 桌面空态 **3 passed**（/workflow-designer「计算处理人」「重新读取后端定义」「个节点」）。禁 /m。 |
| Q1999 | done | 桌面空态 **3 passed**（/workflow-designer「删除节点」「撤销」「重做」）。禁 /m。 |
| Q2000 | done | 桌面空态 **3 passed**（/workflow-designer「滚轮缩放 · 拖拽布点 · 连线分流 · 拖拽吸附对齐」「节点属性」「表单源码」）。禁 /m。 |
| Q2001 | done | 桌面空态 **3 passed**（/workflow-designer「节点面板」「拖拽到画布创建节点，或点击按钮快速追加」「开始节点」）。禁 /m。 |
| Q2002 | done | 桌面空态 **3 passed**（/workflow-designer「审批节点」「办理节点」「抄送节点」）。禁 /m。 |
| Q2003 | done | 桌面空态 **3 passed**（/workflow-designer「条件分支」「结束节点」「流程入口与触发条件」）。禁 /m。 |
| Q2004 | done | 桌面空态 **3 passed**（/workflow-designer 审批/办理/抄送节点描述）。禁 /m。 |
| Q2005 | done | 桌面空态 **3 passed**（/workflow-designer 条件/结束描述 + 开始 helper）。禁 /m。 |
| Q2006 | done | 桌面空态 **3 passed**（/workflow-designer 审批/办理/抄送 helper）。禁 /m。 |
| Q2007 | done | 桌面空态 **3 passed**（/workflow-designer 条件/结束 helper +「未配置」）。禁 /m。 |
| Q2008 | done | 桌面空态 **3 passed**（/workflow-designer 画布「提交资产申请」「部门负责人审批」「金额阈值判断」）。禁 /m。 |
| Q2009 | done | 桌面空态 **3 passed**（/workflow-designer 画布「财务复核」「流程结束」「大额采购」）。禁 /m。 |
| Q2010 | done | 桌面空态 **3 passed**（/workflow-designer「常规采购」「节点名称」「节点说明」）。禁 /m。 |
| Q2011 | done | 桌面空态 **3 passed**（/workflow-designer「节点编码」「条连线」「环节子表单/区段」）。禁 /m。 |
| Q2012 | done | 桌面空态 **3 passed**（/workflow-designer「区段名称」「历史摘要字段」「子表单 HTML」）。禁 /m。 |
| Q2013 | done | 桌面空态 **3 passed**（/workflow-designer「审批人类型」「按角色」「指定用户」）。禁 /m。 |
| Q2014 | done | 桌面空态 **3 passed**（/workflow-designer「审批角色」「审批模式」「用于发起页渲染和审批详情快照展示」）。禁 /m。 |
| Q2015 | done | 桌面空态 **3 passed**（/workflow-designer「处理人预览」getByLabel「业务数据 JSON」「删除当前节点」）。禁 /m。 |
| Q2016 | done | 桌面空态 **3 passed**（/workflow-designer 点表单源码「自定义表单 HTML」「表单源码会保存在流程定义中」「查看业务表单」）。禁 /m。 |
| Q2017 | done | 桌面空态 **3 passed**（/workflow-form/ASSET_TRANSFER「ASSET_TRANSFER」「该流程尚未配置表单源码」「直接发起申请」）。禁 /m。 |
| Q2018 | done | 桌面空态 **3 passed**（/workflow-form/ASSET_CLEARANCE、ASSET_SCRAP、RETIREMENT 编码标题）。禁 /m。 |
| Q2019 | done | 桌面空态 **3 passed**（/workflow-form/ASSET_COMPENSATION 编码 + 设计器表单源码提示 +「直接发起申请」）。禁 /m。 |
| Q2020 | done | 桌面空态 **3 passed**（/manufacturers「正常」「停用」「状态：」）。禁 /m。 |
| Q2021 | done | 桌面空态 **3 passed**（/manufacturers 点新增「备注」、/vendors「暂无供应商数据」「刷新」）。禁 /m。 |
| Q2022 | done | 桌面空态 **3 passed**（/system/menus「菜单管理」「暂无菜单数据，请通过 DDL 初始化种子数据」「类型」）。禁 /m。 |
| Q2023 | done | 桌面空态 **3 passed**（/system/menus 表头「排序」「状态」「操作」）。禁 /m。 |
| Q2024 | done | 桌面空态 **3 passed**（/system/roles「角色管理」「描述」「ID」）。禁 /m。 |
| Q2025 | done | 桌面空态 **3 passed**（/system/depts「部门管理」、/system/posts「岗位管理」、/system/custom-fields「自定义字段管理」）。禁 /m。 |
| Q2026 | done | 桌面空态 **3 passed**（/energy「能耗管理」「暂无能耗数据」「尚未采集到能耗数据」；主界面标题空态不可见）。禁 /m。 |
| Q2027 | done | 桌面空态 **3 passed**（/gis「GIS 资产地图」「资产定位管理」「关联已有资产」）。禁 /m。 |
| Q2028 | done | 桌面空态 **3 passed**（/gis「资产分布」「全部状态」、点「资产定位管理」「纬度 (-90~90)」）。禁 /m。 |
| Q2029 | done | 桌面空态 **3 passed**（/gis「选择空间单元」、点「资产定位管理」「经度 (-180~180)」「位置描述」）。禁 /m。 |
| Q2030 | done | 桌面空态 **3 passed**（/gis 点空间筛选「暂无位置数据」、点新建定位「资产编号」「纬度」）。禁 /m。 |
| Q2031 | done | 桌面空态 **3 passed**（/gis 点新建定位「经度」「状态」、点空间筛选搜索 placeholder）。禁 /m。 |
| Q2032 | done | 桌面空态 **3 passed**（/gis「近 12 月」「自定义」、点空间筛选「请先在「位置管理」中维护空间层级」）。禁 /m。 |
| Q2033 | done | 桌面空态 **3 passed**（/gis 点「自定义」「自定义时间范围」「开始日期」「结束日期」）。禁 /m。 |
| Q2034 | done | 桌面空态 **3 passed**（/gis 点自定义「应用」「取消」、分类「全部」）。禁 /m。 |
| Q2035 | done | 桌面空态 **3 passed**（/floorplans 点新建「名称 *」「创建」「取消」）。禁 /m。 |
| Q2036 | done | 桌面空态 **3 passed**（/idle「闲置资产管理」「待处理」「历史记录」）。禁 /m。 |
| Q2037 | done | 桌面空态 **3 passed**（/idle 表头「资产编号」「资产名称」、页签「待审批」）。禁 /m。 |
| Q2038 | done | 桌面空态 **3 passed**（/idle 表头「部门」「状态」「操作」）。禁 /m。 |
| Q2039 | done | 桌面空态 **3 passed**（/depreciation「折旧管理」「折旧方法」「当期折旧」）。禁 /m。 |
| Q2040 | done | 桌面空态 **3 passed**（/depreciation「累计折旧」「折旧率」「全部方法」）。禁 /m。 |
| Q2041 | done | 桌面空态 **3 passed**（/depreciation「查询」「重置」「原值」）。禁 /m。 |
| Q2042 | done | 桌面空态 **3 passed**（/depreciation「净值」「状态」、/revaluations「资产减值/重估」）。禁 /m。 |
| Q2043 | done | 桌面空态 **3 passed**（/revaluations「价值调整」「资产价值调整记录」「条记录」）。禁 /m。 |
| Q2044 | done | 桌面空态 **3 passed**（/revaluations 表头「类型」「新值」「差额」）。禁 /m。 |
| Q2045 | done | 桌面空态 **3 passed**（/fault-codes「故障代码管理」「故障代码」、点新增「新增故障代码」）。禁 /m。 |
| Q2046 | done | 桌面空态 **3 passed**（/fault-codes 点新增「故障编码 *」「故障现象」「排序号」）。禁 /m。 |
| Q2047 | done | 桌面空态 **3 passed**（/fault-codes 点新增编码/描述 placeholder、「创建」）。禁 /m。 |
| Q2048 | done | 桌面空态 **3 passed**（/fault-codes 点新增「取消」、/categories「分类结构」、点添加根分类说明）。禁 /m。 |
| Q2049 | done | 桌面空态 **3 passed**（/categories 点添加根分类「分类名称」「分类编码」与名称 placeholder）。禁 /m。 |
| Q2050 | done | 桌面空态 **3 passed**（/categories 点添加根分类编码 placeholder、「创建」「取消」）。禁 /m。 |
| Q2051 | done | 桌面空态 **3 passed**（/purchase-orders「全部状态」「待审批」「刷新」）。禁 /m。 |
| Q2052 | done | 桌面空态 **3 passed**（/inspections 副标题、「批量删除」「批量导出」）。禁 /m。 |
| Q2053 | done | 桌面空态 **3 passed**（/inspections「总检验数」「通过」「不通过」）。禁 /m。 |
| Q2054 | done | 桌面空态 **3 passed**（/inspections「已过期」「检验编号」「资产ID」）。禁 /m。 |
| Q2055 | done | 桌面空态 **3 passed**（/inspections 表头「检验类型」「检验日期」「下次检验」）。禁 /m。 |
| Q2056 | done | 桌面空态 **3 passed**（/inspections 表头「检验机构」「结果」「操作」）。禁 /m。 |
| Q2057 | done | 桌面空态 **3 passed**（/risk-assessments「全部评估」「重大风险」「高危风险」）。禁 /m。 |
| Q2058 | done | 桌面空态 **3 passed**（/risk-assessments「中/低危」「项评估」「影响\\概率」）。禁 /m。 |
| Q2059 | done | 桌面空态 **3 passed**（/risk-assessments 轴「低」「中等」「高」；单字轴用 columnheader+序号）。禁 /m。 |
| Q2060 | done | 桌面空态 **3 passed**（/risk-assessments 轴「小」「大」、点单元格「关闭」）。禁 /m。 |
| Q2061 | done | 桌面空态 **3 passed**（点单元格「风险评估详情」「可能性：」「影响：」）。禁 /m。 |
| Q2062 | done | 桌面空态 **3 passed**（/risk-matrix 点创建矩阵 input「较低」「较高」、切严重度「轻微」）。禁 /m。 |
| Q2063 | done | 桌面空态 **3 passed**（/risk-matrix 点创建矩阵严重度「一般」「非常严重」「灾难性」）。禁 /m。 |
| Q2064 | done | 桌面空态 **3 passed**（/risk-matrix 点等级映射 CRITICAL/HIGH、「最低分数」）。禁 /m。 |
| Q2065 | done | 桌面空态 **3 passed**（/risk-matrix 点等级映射 MEDIUM/LOW、风险等级 placeholder）。禁 /m。 |
| Q2066 | done | 桌面空态 **3 passed**（/risk-matrix 点等级映射「按 minScore 降序排列」、分数 20/10）。禁 /m。 |
| Q2067 | done | 桌面空态 **3 passed**（/risk-matrix 点等级映射分数 4/0、「风险等级映射规则」）。禁 /m。 |
| Q2068 | done | 桌面空态 **3 passed**（/safety-checklists/config 点新增模板 heading、「状态」、弹窗「启用」）。禁 /m。 |
| Q2069 | done | 桌面空态 **3 passed**（/safety-checklists/execute?source=quick-safety 工作台/点检上下文/注塑机）。禁 /m。 |
| Q2070 | done | 桌面空态 **3 passed**（execute?source=quick-safety「温度 / 振动 / 电流」「高温点位」「18 个高温点位待确认」）。禁 /m。 |
| Q2071 | done | 桌面空态 **3 passed**（execute?source=quick-safety「资产：」「重点：」「来自固定资产工作台快捷入口」）。禁 /m。 |
| Q2072 | done | 桌面空态 **3 passed**（execute?source=quick-safety「风险：」「建议优先核对」「现场安全规则命中点位」）。禁 /m。 |
| Q2073 | done | 桌面空态 **3 passed**（/licenses「席位使用」「软件名称」、点新增「购买日期」）。禁 /m。 |
| Q2074 | done | 桌面空态 **3 passed**（/licenses 列头「类型」「厂商」「版本」）。禁 /m。 |
| Q2075 | done | 桌面空态 **3 passed**（/licenses 列头「到期日期」「状态」「操作」）。禁 /m。 |
| Q2076 | done | 桌面空态 **3 passed**（/licenses「软件许可证管理」「状态：」「全部」）。禁 /m。 |
| Q2077 | done | 桌面空态 **3 passed**（/licenses 筛选「有效」「已到期」「暂停」）。禁 /m。 |
| Q2078 | done | 桌面空态 **3 passed**（/licenses 点新增「到期日期」「¥」、heading「新增许可证」）。禁 /m。 |
| Q2079 | done | 桌面空态 **3 passed**（/sam「暂无高风险项」、列头「合规率」「操作」）。禁 /m。 |
| Q2080 | done | 桌面空态 **3 passed**（/sam 点查看详情「扫描详情」「软件名称」「许可类型」）。禁 /m。 |
| Q2081 | done | 桌面空态 **3 passed**（/sam 点查看详情「总席位」「已用席位」「使用率」）。禁 /m。 |
| Q2082 | done | 桌面空态 **3 passed**（/sam 点查看详情「合规状态」「风险等级」「到期」）。禁 /m。 |
| Q2083 | done | 桌面空态 **3 passed**（/sam 点查看详情「建议」「暂无详情」、按钮「查看详情」）。禁 /m。 |
| Q2084 | done | 桌面空态 **3 passed**（/audit「审计日志」「系统日志」「全部日志」）。禁 /m。 |
| Q2085 | done | 桌面空态 **3 passed**（/audit「告警」「总计」「导出」）。禁 /m。 |
| Q2086 | done | 桌面空态 **3 passed**（/audit 列头「时间」「操作人」「操作类型」）。禁 /m。 |
| Q2087 | done | 桌面空态 **3 passed**（/audit 列头「描述」「IP地址」「状态」）。禁 /m。 |
| Q2088 | done | 桌面空态 **3 passed**（/audit「筛选」「显示」「项，共」）。禁 /m。 |
| Q2089 | done | 桌面空态 **3 passed**（/audit/1「返回列表」「导出日志」「操作详情」）。禁 /m。 |
| Q2090 | done | 桌面空态 **3 passed**（/audit/1「操作时间」「关联资产」「操作上下文」）。禁 /m。 |
| Q2091 | done | 桌面空态 **3 passed**（/audit/1「请求方法」「请求路径」「无详细描述」）。禁 /m。 |
| Q2092 | done | 桌面空态 **3 passed**（/audit/1「资产编号」「资产名称」「变更字段」）。禁 /m。 |
| Q2093 | done | 桌面空态 **3 passed**（/audit/1「变更前值」「变更后值」「变更时间」）。禁 /m。 |
| Q2094 | done | 桌面空态 **3 passed**（/audit/1「用户代理」「请求 ID」「会话 ID」）。禁 /m。 |
| Q2095 | done | 桌面空态 **3 passed**（/audit/1「租户 ID」「操作轨迹」「当前节点」）。禁 /m。 |
| Q2096 | done | 桌面空态 **3 passed**（/audit/1「审计日志详情」「IP 地址」「操作人」）。禁 /m。 |
| Q2097 | done | 桌面空态 **3 passed**（/notifications?source=quick-alert「工作台带入」「工作台告警处理」「核对告警来源」）。禁 /m。 |
| Q2098 | done | 桌面空态 **3 passed**（/notifications?source=quick-alert「处置建议」「告警处置上下文」「转预测维保工单」）。禁 /m。 |
| Q2099 | done | 桌面空态 **3 passed**（/notifications source=security-event/data-alert/unknown）。禁 /m。 |
| Q2100 | done | 桌面空态 **3 passed**（/notifications?source=quick-alert「影响资产」「处置动作」「必要时」）。禁 /m。 |
| Q2101 | done | 桌面空态 **3 passed**（/analytics/tco「TCO 全生命周期成本」「部门ID」「分类ID」）。禁 /m。 |
| Q2102 | done | 桌面空态 **3 passed**（/analytics/reliability「暂无排名数据」「暂无趋势数据」、select「按 MTBF」）。禁 /m。 |
| Q2103 | done | 桌面空态 **3 passed**（/asset-health「暂无不健康资产」「最低分:」「刷新」）。禁 /m。 |
| Q2104 | done | 桌面空态 **3 passed**（/asset-health「不健康资产列表」「所有资产状态良好」「共 0 条」）。禁 /m。 |
| Q2105 | done | 桌面空态 **3 passed**（/asset-health「资产健康评分」「基于年龄」「维修频率」）。禁 /m。 |
| Q2106 | done | 桌面空态 **3 passed**（/asset-health「故障率」「利用率」「折旧进度」）。禁 /m。 |
| Q2107 | done | 桌面空态 **3 passed**（/contracts「到期日期」、tab 即将到期「暂无即将到期合同」「当前没有在30天内到期的合同」）。禁 /m。 |
| Q2108 | done | 桌面空态 **3 passed**（/contracts 点时间轴说明、/spare-parts「备件编码」「备件名称」）。禁 /m。 |
| Q2109 | done | 桌面空态 **3 passed**（/spare-parts「当前库存」「安全库存」「单价」）。禁 /m。 |
| Q2110 | done | 桌面空态 **3 passed**（/spare-parts「状态」「操作」「暂无备件」）。禁 /m。 |
| Q2111 | done | 桌面空态 **3 passed**（/insurances「保单号」「保险名称」「保险类型」）。禁 /m。 |
| Q2112 | done | 桌面空态 **3 passed**（/insurances「保险公司」「保费」「开始日期」）。禁 /m。 |
| Q2113 | done | 桌面空态 **3 passed**（/insurances「结束日期」「状态」「操作」）。禁 /m。 |
| Q2114 | done | 桌面空态 **3 passed**（/borrows「资产编号」「资产名称」「借用日期」）。禁 /m。 |
| Q2115 | done | 桌面空态 **3 passed**（/borrows「预计归还」「用途」「操作」）。禁 /m。 |
| Q2116 | done | 桌面空态 **3 passed**（/assignments「资产编号」「资产名称」「领用类型」）。禁 /m。 |
| Q2117 | done | 桌面空态 **3 passed**（/assignments「状态」「预计归还」「创建时间」）。禁 /m。 |
| Q2118 | done | 桌面空态 **3 passed**（/intake「验收单号」「验收日期」「总金额」）。禁 /m。 |
| Q2119 | done | 桌面空态 **3 passed**（/intake「状态」「创建时间」「操作」）。禁 /m。 |
| Q2120 | done | 桌面空态 **3 passed**（/purchase-orders「采购单号」「采购名称」「供应商」）。禁 /m。 |
| Q2121 | done | 桌面空态 **3 passed**（/purchase-orders「金额」「采购日期」「状态」）。禁 /m。 |
| Q2122 | done | 桌面空态 **3 passed**（/purchase-orders「操作」、/asset-models「模型名称」「型号」）。禁 /m。 |
| Q2123 | done | 桌面空态 **3 passed**（/asset-models「分类」「制造商」「状态」）。禁 /m。 |
| Q2124 | done | 桌面空态 **3 passed**（/asset-models「字段集」「描述」「操作」）。禁 /m。 |
| Q2125 | done | 桌面空态 **3 passed**（/equipment「设备名称」「设备ID」「上次维保」）。禁 /m。 |
| Q2126 | done | 桌面空态 **3 passed**（/equipment「下次维保」「使用率」「维保状态」）。禁 /m。 |
| Q2127 | done | 桌面空态 **3 passed**（/equipment「操作」「设备」「技术员」）。禁 /m。 |
| Q2128 | done | 桌面空态 **3 passed**（/equipment「日期」「类型」「费用」）。禁 /m。 |
| Q2129 | done | 桌面空态 **3 passed**（/maintenance「资产ID」「维保类型」「维保日期」）。禁 /m。 |
| Q2130 | done | 桌面空态 **3 passed**（/maintenance「执行人」「费用」「下次维保」）。禁 /m。 |
| Q2131 | done | 桌面空态 **3 passed**（/maintenance「操作」、/maintenance/plans「计划名称」「关联资产」）。禁 /m。 |
| Q2132 | done | 桌面空态 **3 passed**（/maintenance/plans「计划周期」「负责人」「下次执行」）。禁 /m。 |
| Q2133 | done | 桌面空态 **3 passed**（/maintenance/plans「优先级」「状态」「操作」）。禁 /m。 |
| Q2134 | done | 桌面空态 **3 passed**（/workorders/new「新建工单」「标题 *」「工单类型」）。禁 /m。 |
| Q2135 | done | 桌面空态 **3 passed**（/workorders/new「关联资产」「描述」「预计费用」）。禁 /m。 |
| Q2136 | done | 桌面空态 **3 passed**（/workorders/new「截止日期」「负责人」「协作人」）。禁 /m。 |
| Q2137 | done | 桌面空态 **3 passed**（/workorders/new placeholder 标题/描述/添加人员）。禁 /m。 |
| Q2138 | done | 桌面空态 **3 passed**（/workorders/new「优先级」「详细信息」「紧急」）。禁 /m。 |
| Q2139 | done | 桌面空态 **3 passed**（/workorders/new 优先级「高」「中」「低」）。禁 /m。 |
| Q2140 | done | 桌面空态 **3 passed**（/workorders/new「处理提示」「提交工单」「取消」）。禁 /m。 |
| Q2141 | done | 桌面空态 **3 passed**（/workorders/new 提示正文、select「维修」）。禁 /m。 |
| Q2142 | done | 桌面空态 **3 passed**（/workorders/new「附件」「上传文件」、/workorders/1「工单详情」）。禁 /m。 |
| Q2143 | done | 桌面空态 **3 passed**（/workorders/1「工单信息」「申请人」「SLA」）。禁 /m。 |
| Q2144 | done | 桌面空态 **3 passed**（/workorders/1「工单号」「优先级」「创建时间」）。禁 /m。 |
| Q2145 | done | 桌面空态 **3 passed**（/workorders/1「部门」「描述」、第二处「申请人」）。禁 /m。 |
| Q2146 | done | 桌面空态 **3 passed**（/workorders/1「审批记录」「暂无审批记录」、/budgets「年度」）。禁 /m。 |
| Q2147 | done | 桌面空态 **3 passed**（/budgets「类型」「预算总额」「剩余」）。禁 /m。 |
| Q2148 | done | 桌面空态 **3 passed**（/budgets「已使用」「已承诺」「状态」）。禁 /m。 |
| Q2149 | done | 桌面空态 **3 passed**（/budgets「操作」、/retirement「申请编号」「资产编号」）。禁 /m。 |
| Q2150 | done | 桌面空态 **3 passed**（/retirement「资产名称」「分类」「原值」）。禁 /m。 |
| Q2151 | done | 桌面空态 **3 passed**（/retirement「残值」「退役原因」「申请人」）。禁 /m。 |
| Q2152 | done | 桌面空态 **3 passed**（/retirement「状态」「操作」「新建退役申请」）。禁 /m。 |
| Q2153 | done | 桌面空态 **3 passed**（/retirement「资产退役管理」「暂无退役申请记录」、搜索 placeholder）。禁 /m。 |
| Q2154 | done | 桌面空态 **3 passed**（/retirement/new「资产退役申请」「新建申请」「资产选择」）。禁 /m。 |
| Q2155 | done | 桌面空态 **3 passed**（/retirement/new「退役管理」「折旧时间线」「退役原因」）。禁 /m。 |
| Q2156 | done | 桌面空态 **3 passed**（/retirement/new「残值评估」「资产 ID *」「返回」）。禁 /m。 |
| Q2157 | done | 桌面空态 **3 passed**（/retirement/new「备注与说明」「退役操作不可逆」「提交退役申请」）。禁 /m。 |
| Q2158 | done | 桌面空态 **3 passed**（/retirement/new「取消」、审批提示、建议残值说明）。禁 /m。 |
| Q2159 | done | 桌面空态 **3 passed**（/retirement/new 资产/备注 placeholder、「2023 (当前)」）。禁 /m。 |
| Q2160 | done | 桌面空态 **3 passed**（/retirement/new 原因 placeholder、「2020」「2025」）。禁 /m。 |
| Q2161 | done | 桌面空态 **3 passed**（/retirement/1「退役申请」「申请详情」、返回列表或退役管理）。禁 /m。 |
| Q2162 | done | 桌面空态 **3 passed**（/retirement/1「退役原因」「申请编号」「审批状态」）。禁 /m。 |
| Q2163 | done | 桌面空态 **3 passed**（/retirement/1「申请人」「申请时间」「更新时间」）。禁 /m。 |
| Q2164 | done | 桌面空态 **3 passed**（/compensation「资产赔偿申请」「填写信息」「基本信息」）。禁 /m。 |
| Q2165 | done | 桌面空态 **3 passed**（/compensation「赔偿编号」「申请人」「选择资产」）。禁 /m。 |
| Q2166 | done | 桌面空态 **3 passed**（/compensation「申请日期」「损坏类型」「资产选择」）。禁 /m。 |
| Q2167 | done | 桌面空态 **3 passed**（/compensation「损坏日期」「责任人」「责任部门」）。禁 /m。 |
| Q2168 | done | 桌面空态 **3 passed**（/compensation「损坏详情」「发现人」「是否报险」）。禁 /m。 |
| Q2169 | done | 桌面空态 **3 passed**（/compensation「资产损失说明」「赔偿配置」「赔偿方式」）。禁 /m。 |
| Q2170 | done | 桌面空态 **3 passed**（/compensation「现金赔偿」「总赔偿金额」「确认提交」）。禁 /m。 |
| Q2171 | done | 桌面空态 **3 passed**（/compensation「等价物赔偿」「维修恢复」「审批流程」）。禁 /m。 |
| Q2172 | done | 桌面空态 **3 passed**（/compensation「取消」「保存草稿」「提交申请」）。禁 /m。 |
| Q2173 | done | 桌面空态 **3 passed**（/disposals「处置单号」「资产信息」「申请人」）。禁 /m。 |
| Q2174 | done | 桌面空态 **3 passed**（/disposals「申请日期」「状态」「操作」）。禁 /m。 |
| Q2175 | done | 桌面空态 **3 passed**（/compensation「备注」、placeholder、合计）。禁 /m。 |
| Q2176 | done | 桌面空态 **3 passed**（/compensation 损失说明 placeholder、「返回」「赔偿申请」）。禁 /m。 |
| Q2177 | done | 桌面空态 **3 passed**（/disposals/clearance/new「资产清退申请」「风险提示」「基本信息」）。禁 /m。 |
| Q2178 | done | 桌面空态 **3 passed**（/disposals/clearance/new「清退编号」「申请人」「申请日期」）。禁 /m。 |
| Q2179 | done | 桌面空态 **3 passed**（/disposals/clearance/new「清退原因」「资产选择」「添加资产」）。禁 /m。 |
| Q2180 | done | 桌面空态 **3 passed**（/disposals/clearance/new「清退配置」「处理方式」「入库保管」）。禁 /m。 |
| Q2181 | done | 桌面空态 **3 passed**（/disposals/clearance/new「变卖处理」「捐赠」「不可逆」）。禁 /m。 |
| Q2182 | done | 桌面空态 **3 passed**（/disposals/clearance/new「预估残值」「紧急程度」「确认提交」）。禁 /m。 |
| Q2183 | done | 桌面空态 **3 passed**（/disposals/clearance/new 先选资产提示、「保存草稿」「普通」）。禁 /m。 |
| Q2184 | done | 桌面空态 **3 passed**（/disposals/clearance/new「紧急」exact、「审批流程」「备注」）。禁 /m。 |
| Q2185 | done | 桌面空态 **3 passed**（/disposals/clearance/new「取消」、风险正文、备注 placeholder）。禁 /m。 |
| Q2186 | done | 桌面空态 **3 passed**（/disposals/scrap/new「资产报废申请」「填写信息」「选择资产」）。禁 /m。 |
| Q2187 | done | 桌面空态 **3 passed**（/disposals/scrap/new「报废配置」「确认提交」「基本信息」）。禁 /m。 |
| Q2188 | done | 桌面空态 **3 passed**（/disposals/scrap/new「报废编号」「申请人」「报废原因」）。禁 /m。 |
| Q2189 | done | 桌面空态 **3 passed**（/disposals/scrap/new「处置方式」「添加资产」「暂无已选资产」）。禁 /m。 |
| Q2190 | done | 桌面空态 **3 passed**（/disposals/scrap/new「变卖处理」「报废拆解」「捐赠」）。禁 /m。 |
| Q2191 | done | 桌面空态 **3 passed**（/disposals/scrap/new「预估残值」「审批流程」「备注」）。禁 /m。 |
| Q2192 | done | 桌面空态 **3 passed**（/disposals/scrap/new 先选资产提示、「自动保存」「不可逆」）。禁 /m。 |
| Q2193 | done | 桌面空态 **3 passed**（/disposals/scrap/new「标准流程需部门经理」「取消」「返回」）。禁 /m。 |
| Q2194 | done | 桌面空态 **3 passed**（/disposals/scrap/new「申请日期」「残值评估将影响」「风险提示」）。禁 /m。 |
| Q2195 | done | 桌面空态 **3 passed**（/disposals/scrap/new「新建申请」「选填」、备注 placeholder）。禁 /m。 |
| Q2196 | done | 桌面空态 **3 passed**（/disposals/transfer/new「资产转移申请」「基本信息」「选择资产」）。禁 /m。 |
| Q2197 | done | 桌面空态 **3 passed**（/disposals/transfer/new「审批配置」「完成」「基础信息填写」）。禁 /m。 |
| Q2198 | done | 桌面空态 **3 passed**（/disposals/transfer/new「选择调拨资产」「流程配置」「提交状态」）。禁 /m。 |
| Q2199 | done | 桌面空态 **3 passed**（/disposals/transfer/new「单据信息」「调拨编号」「申请人」）。禁 /m。 |
| Q2200 | done | 桌面空态 **3 passed**（/disposals/transfer/new「调拨日期」「调拨类型」「调拨方向」）。禁 /m。 |
| Q2201 | done | 桌面空态 **3 passed**（/disposals/transfer/new「转出方」「调出部门」「调出位置」）。禁 /m。 |
| Q2202 | done | 桌面空态 **3 passed**（/disposals/transfer/new「转入方」「调入部门」「调入位置」）。禁 /m。 |
| Q2203 | done | 桌面空态 **3 passed**（/disposals/transfer/new「资产选择」「添加资产」「已选」）。禁 /m。 |
| Q2204 | done | 桌面空态 **3 passed**（/disposals/transfer/new「发布流程」「资产转移流程」「紧急程度」）。禁 /m。 |
| Q2205 | done | 桌面空态 **3 passed**（/disposals/transfer/new「处理人预览」「计算处理人」、高优先级说明）。禁 /m。 |
| Q2206 | done | 桌面空态 **3 passed**（/disposals/transfer/new「备注」「选填」「普通」）。禁 /m。 |
| Q2207 | done | 桌面空态 **3 passed**（/disposals/transfer/new「取消」「保存草稿」「提交申请」）。禁 /m。 |
| Q2208 | done | 桌面空态 **3 passed**（/disposals/transfer/new「返回」「自动保存」「必填」）。禁 /m。 |
| Q2209 | done | 桌面空态 **3 passed**（/disposals/transfer/new「新建」、所属部门/目标部门提示）。禁 /m。 |
| Q2210 | done | 桌面空态 **3 passed**（/inspections/new「检验编号」「资产ID」「检验模板」）。禁 /m。 |
| Q2211 | done | 桌面空态 **3 passed**（/inspections/new「检验类型」「检验日期」exact、「下次检验日期」）。禁 /m。 |
| Q2212 | done | 桌面空态 **3 passed**（/inspections/new「检验机构」「检验人」「检验结果」）。禁 /m。 |
| Q2213 | done | 桌面空态 **3 passed**（/inspections/new「检查发现」「检验照片」「证书编号」）。禁 /m。 |
| Q2214 | done | 桌面空态 **3 passed**（/inspections/new「证书到期日」「检验费用」「报告附件」）。禁 /m。 |
| Q2215 | done | 桌面空态 **3 passed**（/inspections/new「扫码」、编号/机构 placeholder）。禁 /m。 |
| Q2216 | done | 桌面空态 **3 passed**（/inspections/new 检验人/发现/证书 placeholder）。禁 /m。 |
| Q2217 | done | 桌面空态 **3 passed**（/inspections/new 资产ID/模板/附件 placeholder）。禁 /m。 |
| Q2218 | done | 桌面空态 **3 passed**（/revaluations/new「新增减值/重估」「查找」「返回列表」）。禁 /m。 |
| Q2219 | done | 桌面空态 **3 passed**（/revaluations/new「类型」「减值」exact、「重估」exact）。禁 /m。 |
| Q2220 | done | 桌面空态 **3 passed**（/revaluations/new「新值」「原因说明」「证据材料」）。禁 /m。 |
| Q2221 | done | 桌面空态 **3 passed**（/revaluations/new「提交申请」「取消」、证据 placeholder）。禁 /m。 |
| Q2222 | done | 桌面空态 **3 passed**（/assets/new「新建资产」「基本信息」「位置归属」）。禁 /m。 |
| Q2223 | done | 桌面空态 **3 passed**（/assets/new「财务信息」「资产名称」「附件」。关联资产新建不渲染）。禁 /m。 |
| Q2224 | done | 桌面空态 **3 passed**（/assets/new「品牌」「资产分类」「状态」。编号新建不渲染）。禁 /m。 |
| Q2225 | done | 桌面空态 **3 passed**（/assets/new「型号」「序列号」「供应商」）。禁 /m。 |
| Q2226 | done | 桌面空态 **3 passed**（/assets/new「原值」「当前净值」「购置日期」）。禁 /m。 |
| Q2227 | done | 桌面空态 **3 passed**（/assets/new「使用部门」「存放位置」「RFID」）。禁 /m。 |
| Q2228 | done | 桌面空态 **3 passed**（/assets/new「重要设备」「描述」「备注」）。禁 /m。 |
| Q2229 | done | 桌面空态 **3 passed**（/assets/new「保存」「取消」「保修期」）。禁 /m。 |
| Q2230 | done | 桌面空态 **3 passed**（/assets/new「折旧率」「纬度」「经度」）。禁 /m。 |
| Q2231 | done | 桌面空态 **3 passed**（/assets/import-export「资产批量导入导出」「导入」「导出」）。禁 /m。 |
| Q2232 | done | 桌面空态 **3 passed**（/inventory/smart-report 无任务ID、「返回盘点列表」）。禁 /m。 |
| Q2233 | done | 桌面空态 **3 passed**（/fixed-assets/workbench「欢迎回来」「运营首页」「总资产数」）。禁 /m。 |
| Q2234 | done | 桌面空态 **3 passed**（/fixed-assets/workbench「在用资产」「闲置资产」「导出数据」）。禁 /m。 |
| Q2235 | done | 桌面空态 **3 passed**（/fixed-assets/workbench「待审批」「刷新视图」「资产价值趋势」）。禁 /m。 |
| Q2236 | done | 桌面空态 **3 passed**（/fixed-assets/workbench「分类分布」「维保预警」「最近工单」）。禁 /m。 |
| Q2237 | done | 桌面空态 **3 passed**（/fixed-assets/workbench「净值」「部门资产统计」「查看全部」）。禁 /m。 |
| Q2238 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「系统管理 V3 工作台」「用户管理」「当前分组」）。禁 /m。 |
| Q2239 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「已接入」「部门组织」「组织权限」）。禁 /m。 |
| Q2240 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「流程平台」「基础资料」「角色权限」）。禁 /m。 |
| Q2241 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「菜单权限」「岗位管理」「数据权限」）。禁 /m。 |
| Q2242 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「交接管理」「租户管理」「集成配置」）。禁 /m。 |
| Q2243 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「消息与通知」「系统参数」「用户只读列表」）。禁 /m。 |
| Q2244 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「已接入真组件」「已注册模块」「四十四项菜单」）。禁 /m。 |
| Q2245 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3 部门树/角色绑定/权限库存描述）。禁 /m。 |
| Q2246 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3 租户主数据/交接摘要/数据范围）。禁 /m。 |
| Q2247 | done | 桌面空态 **3 passed**（/404「404 — 页面不存在」及拆分）。禁 /m。 |
| Q2248 | done | 桌面空态 **3 passed**（/forbidden「无访问权限」「您没有访问此页面的权限」「返回首页」）。禁 /m。 |
| Q2249 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3 关键词筛选/根部门摘要/未闭环提示）。禁 /m。 |
| Q2250 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3「套餐状态」「联系人摘要」「按域聚合」）。禁 /m。 |
| Q2251 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3 44项覆盖/流程平台9/9/组织权限8/8）。禁 /m。 |
| Q2252 | done | 桌面空态 **3 passed**（/fixed-assets/workbenchv3 基础资料6/6/集成5/5/消息8/8）。禁 /m。 |
| Q2253 | in_progress | 桌面空态：/fixed-assets/workbenchv3「系统参数组 8/8」。禁 /m。 |
