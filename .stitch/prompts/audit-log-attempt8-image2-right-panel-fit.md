Edit the selected uploaded IMAGE2 v2 product screenshot screen into HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide source-visible content behind scroll if the uploaded screenshot shows it.

Page name: 操作审计
Menu id: system-audit-log
Reference image: system-params-subpage-06-audit-log-v2.png
Source size: 1595 x 986
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-06-audit-log-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-audit-log

Top shell and brand:
- Preserve the exact IMAGE2 brand mark: white `UNIVIEW`, divider, and `固定资产管理系统`.
- Do not lowercase, split, redraw, or replace the brand.
- Top active navigation is `系统运营中枢`.
- Sidebar active group is `系统参数`; active item is `操作审计`.
- Page title must be `系统操作审计配置台`.
- Header actions must be visible: `新建审计策略`, `保存草稿`, `提交校验`, `审计查询`, `导出取证包`.

Fixed source frame:
- HTML viewport is exactly 1595 x 986.
- No document-level vertical or horizontal scroll.
- Do not create internal scrollbars in the audit table, right policy editor, or bottom cards.
- Keep all source-visible content inside the 1595 x 986 frame.

Source coordinate bands:
- Left sidebar: x=0..194, y=0..986.
- Main content: x=219..1577.
- Header/title/actions: y=68..100.
- KPI row: x=219..1577, y=114..200, four cards.
- Middle row: y=214..623.
  - Audit query/table panel: x=219..1075, y=214..623.
  - Policy editor panel: x=1088..1577, y=214..623.
- Bottom row: y=635..923.
  - Export evidence preview: x=219..565.
  - Retention policy: x=576..856.
  - Risk trend chart: x=868..1191.
  - Audit trace: x=1201..1577.

KPI row:
- Four cards in one row:
  `审计事件` = `9,842`
  `高危操作` = `42`
  `取证包` = `18`
  `留存策略` = `3年`
- Keep the icon style as clean line/product icons, not emoji.

Audit query/table panel:
- Title: `审计事件查询工作台`.
- Filter row visible and horizontal:
  `操作人`, `请选择操作人`, `对象范围`, `请选择对象范围`, `风险等级`, `请选择风险等级`, `时间范围`, `2025-05-15 00:00:00`, `2025-05-21 23:59:59`, `审计查询`, `已查询 1/4 条命中`, `重置`.
- Table must show exactly four visible data rows, not one or two rows.
- Table columns visible and horizontal:
  `时间`, `操作人`, `操作对象`, `操作类型`, `来源模块`, `风险等级`, `结果`, `操作`.
- Required row values:
  - `2025-05-21 10:23:45`, `张三`, `资产 CIP-2025-000123`, `CIP 转固发布`, `CIP管理`, `高危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`
  - `2025-05-21 09:58:12`, `李四`, `ERP凭证VCH-20250521-001`, `ERP 回执归档`, `集成中心`, `中危`, `成功`
  - `2025-05-20 18:14:33`, `王五`, `资产权限策略-AdminRole`, `权限策略变更`, `权限管理`, `高危`, `警告`
  - `2025-05-20 17:42:08`, `赵六`, `缓存键：AssetCacheAll`, `缓存刷新回滚`, `系统运维`, `中危`, `成功`
- Footer visible: `共 4 条`, `10 条/页`, `上一页`, `1`, `下一页`, `前往`, `页`.
- Do not stack column headers vertically.
- Do not stack Chinese table text into narrow columns.

Right policy editor:
- Title must be exactly `审计策略编辑`, not `审计策略编排`.
- All rows must be visible inside y=214..623 with no internal scroll.
- Compact each form row to fit source height.
- Required visible labels and values:
  `策略名称` = `CIP 转固高危操作审计`
  `采集范围` = `CIP管理、资产管理、集成中心、权限管理`
  `留存周期` = `3年`
  `高危标记` = `勾选的操作类型判定为高危`
  `导出水印` = `启用水印：公司全称 + 时间戳 + 用户`
  `脱敏规则` = `默认脱敏规则-管理员（部分字段脱敏）`
  `不可删除策略` = `启用（普通管理员不可删除）`
  `取证审批` = `启用（需审计管理员审批）`
  `告警通知` = `高危操作实时告警（邮件 + 短信）`
- Show blue switches on the rows where source shows switches.
- Do not clip below `不可删除策略`; `取证审批` and `告警通知` must be visible.

Bottom row:
- Export card title: `导出取证包预览`.
- Required visible values:
  `EVP-20250521-102345-001`, `4 条`, `完整性哈希（SHA256）`, `7f1a6b6c9d8e4d2f0b5a3c9d6e7f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7`, `UNIVIEW 固定资产管理系统 | 2025-05-21 10:23:45`, `下载审批状态`, `已批准（审计管理员-刘工，2025-05-21 10:25:01）`, `下载取证包`.
- Retention card title: `留存保护策略`.
- Required values: `在线存储（热存）`, `180天`, `归档存储（冷存）`, `3年`, `普通管理员不可删除`, `已启用`, `强制留存策略`, `启用（不可覆盖）`, `策略生效范围：系统所有审计日志与取证包`.
- Trend chart title: `风险事件趋势（近 7 天）`.
- Required visible values: `高危事件`, `中危事件`, `32（↑14）`, `14（↑2）`, date labels `5/15` through `5/21`.
- Trace card title: `审计链路追溯（示例）`.
- Required trace entries:
  `作业台发起操作`, `工作流审批通过`, `系统回执（ERP/EHR/MES）`, `审计归档入库`.

Hard failures:
- Any page scroll is failure.
- Any internal scroll in the right editor is failure.
- Any table header/cell rendered vertically is failure.
- Fewer than four visible audit rows is failure.
- Missing exact `审计策略编辑` is failure.
- Missing exact `CIP 转固高危操作审计` is failure.
- Missing exact `资产 CIP-2025-000123` is failure.
- Missing exact `缓存键：AssetCacheAll` with fullwidth colon is failure.
- Clipping `取证审批` or `告警通知` is failure.
- Moving the bottom four-card row into a right column is failure.
