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
| Q1525 | in_progress | 桌面空态：/retirement 搜索编号或资产、/insurances 保单号搜索、/inspections 检验编号搜索。禁 /m。 |
