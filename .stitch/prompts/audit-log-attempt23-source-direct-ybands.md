Create a NEW DESIGN screen from the uploaded IMAGE2 v2 screenshot.
Do not return DOM operations against an existing file.
Do not use old Stitch drafts, existing Stitch HTML, or any admin template as the visual source.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 操作审计
Menu id: system-audit-log
Reference image: system-params-subpage-06-audit-log-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-06-audit-log-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-audit-log

Canvas and shell:
- Exact source viewport: 1595 x 986.
- Body must have fixed 1595 x 986 visual content with no page-level scroll and no clipped bottom content.
- Top dark navy bar: y=0..52.
- Left sidebar: x=0..195, full height, dark navy gradient like source.
- Main content starts near x=218 and y=67.
- Do not use a light sidebar. Do not use a separate white title band.

Top-left brand lock:
- Preserve the exact source-visible white wordmark `UNIVÍEW`.
- Keep the vertical divider and adjacent subtitle `固定资产管理系统`.
- Do not render plain `UNIVIEW` without the accent.

Navigation locks:
- Top nav active: `系统运营中枢`.
- Sidebar active branch: `系统参数` expanded, `操作审计` selected.
- Sidebar list must include source-visible items: `参数总览`, `基础参数`, `编码规则`, `消息通知`, `审计策略`, `操作审计`, `留存策略`, `脱敏规则`, `水印管理`, `日志配置`, `任务调度`, `系统运维`.

Page header:
- Title: `系统操作审计配置台`.
- Top-right buttons, same order and compact height: `新建审计策略`, `保存草稿`, `提交校验`, `审计查询`, `导出取证包`.

KPI row:
- Four cards y≈115..200 with labels and values:
  1. `审计事件` / `9,842`
  2. `高危操作` / `42`
  3. `取证包` / `18`
  4. `留存策略` / `3年`
- Icons must be large source-style colored badges, not pale square tiles:
  blue clipboard, red shield-warning, green package/download, blue shield/clock.

Middle workspace y-band:
- Middle row starts at y≈214 and must end at y≈625.
- Left table card x≈226..1075, right strategy card x≈1088..1576.
- The middle row must not extend into the bottom row.

Left middle card:
- Card title: `审计事件查询工作台`.
- Filters must be compact and source-positioned:
  `操作人`, `对象范围`, `风险等级`, `时间范围`, date range `2025-05-15 00:00:00` to `2025-05-21 23:59:59`, `审计查询`, `已查询 1/4 条命中`, `重置`.
- Table headers exactly visible: `时间`, `操作人`, `操作对象`, `操作类型`, `来源模块`, `风险等级`, `结果`, `操作`.
- Show four table body rows, all within the card:
  - `2025-05-21 10:23:45`, `张三`, `资产CIP-2025-000123`, `CIP 转固发布`, `CIP管理`, `高危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`
  - `2025-05-21 09:58:12`, `李四`, `ERP凭证VCH-20250521-001`, `ERP 回执归档`, `集成中心`, `中危`, `成功`
  - `2025-05-20 18:14:33`, `王五`, `资产权限策略-AdminRole`, `权限策略变更`, `权限管理`, `高危`, `警告`
  - `2025-05-20 17:42:08`, `赵六`, `缓存键：AssetCacheAll`, `缓存刷新回滚`, `系统运维`, `中危`, `成功`
- Table row height must be compact enough to show all four rows plus pagination.
- Action column must remain inside the card; no horizontal overflow.
- Pagination at card bottom: `共 4 条`, `10 条/页`, `上一页`, `1`, `下一页`, `前往`, `1`, `页`.

Right middle card:
- Title must be source text `审计策略编排`.
- It must fit inside y≈214..625; no internal scrollbar and no overlap with bottom cards.
- Fields/toggles: `策略名称`, `采集范围`, `留存周期`, `高危标记`, `导出水印`, `脱敏规则`, `不可删除策略`, `取证审批`, `告警通知`.
- Source values include `CIP 转固高危操作审计`, `CIP管理、资产管理、集成中心、权限管理`, `3年`, `默认脱敏规则-管理员（部分字段脱敏）`.

Bottom row:
- Starts around y=634 and ends around y=933, all content fully visible.
- Four cards across the row:
  1. `导出取证包预览`
  2. `留存保护策略`
  3. `风险事件趋势（近 7 天）`
  4. `审计链路追溯（示例）`
- Card 1 must visibly contain all source rows and the full blue `下载取证包` button inside the card, not clipped.
- Card 2 values: `在线存储（热存） 180天`, `归档存储（冷存） 3年`, `普通管理员不可删除 已启用`, `强制留存策略 启用（不可覆盖）`.
- Card 3 line chart must show red and orange series with end labels/values `32` and `14`, plus bottom summary `高危事件 32（↑14）`, `中危事件 14（↑2）`.
- Card 4 timeline must show four steps ending with `审计归档入库`.

Rendering rules:
- Use dense enterprise typography matching the source: 12px table text, 13px-14px labels, bold card headings.
- No emoji characters.
- Prefer inline SVG or CSS icons; avoid external icon fonts if possible.
- Avoid page-level overflow, horizontal overflow, or bottom clipping.
