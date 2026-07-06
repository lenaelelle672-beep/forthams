Edit the selected uploaded IMAGE2 v2 product screenshot into a 100/100 pixel-fidelity HTML transcription.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Project: 1232247032869317081
Page name: 操作审计
Menu id: system-audit-log
Reference image: system-params-subpage-06-audit-log-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-06-audit-log-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-audit-log
Viewport: exactly 1595 x 986. Keep the source full desktop viewport. No page-level vertical scroll.

Critical anti-regression notes from the prior candidate:
- The table must show exactly 4 body rows. Do not collapse it to 3 rows.
- Do not use emoji icons anywhere. No 📋, 🛡️, 💼, ⏱️, 📝, 🔍, 📥, or generic colored emoji glyphs.
- Preserve the exact IMAGE2 top-left brand mark style: white `UNIVÉW`/`UNIVIEW` source wordmark shape, divider, and `固定资产管理系统`. Do not split letters, redraw as a generic text logo, or change spacing.
- Header buttons use source-style outline/primary buttons with small line icons only. If exact icons are difficult, use clean monochrome line-icon placeholders, never emoji.
- Keep all visible blocks inside the 1595 x 986 viewport. No panel-internal scrollbars unless the source visibly has one.

Exact shell and navigation:
- Top dark navy bar height and left sidebar match the screenshot.
- Active top module: `系统运营中枢`.
- Left sidebar active group: `系统参数`; active item: `操作审计`.
- Sidebar visible labels include: 系统概览, 组织与权限, 流程与规则, 主数据管理, 集成与接口, 系统参数, 参数总览, 基础参数, 编码规则, 消息通知, 审计策略, 操作审计, 留存策略, 脱敏规则, 水印管理, 日志配置, 任务调度, 系统运维.

Header:
- Title: `系统操作审计配置台`.
- Right actions, same order and visual treatment as source: `新建审计策略`, `保存草稿`, `提交校验`, `审计查询`, `导出取证包`.

KPI row:
- Four cards, same row geometry and spacing as source.
- Card 1: `审计事件`, value `9,842`.
- Card 2: `高危操作`, value `42`.
- Card 3: `取证包`, value `18`.
- Card 4: `留存策略`, value `3年`.
- Icons should be source-like rounded square/line icons, not emoji.

Middle left card:
- Title: `审计事件查询工作台`.
- Filter row content: `操作人`, placeholder `请选择操作人`; `对象范围`, placeholder `请选择对象范围`; `风险等级`, placeholder `请选择风险等级`; `时间范围`, `2025-05-15 00:00:00`, `~`, `2025-05-21 23:59:59`; buttons `审计查询`, `重置`; status text `已查询 1/4 条命中`.
- Table header columns: `时间`, `操作人`, `操作对象`, `操作类型`, `来源模块`, `风险等级`, `结果`, `操作`.
- Must show these exact 4 visible body rows in source order:
  1. `2025-05-21 10:23:45`, `张三`, `资产CIP-2025-000123`, `CIP 转固发布`, `CIP管理`, `高危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
  2. `2025-05-21 09:58:12`, `李四`, `ERP凭证VCH-20250521-001`, `ERP 回执归档`, `集成中心`, `中危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
  3. `2025-05-20 18:14:33`, `王五`, `资产权限策略-AdminRole`, `权限策略变更`, `权限管理`, `高危`, `警告`, `查看详情`, `追溯链路`, `下载取证包`.
  4. `2025-05-20 17:42:08`, `赵六`, `缓存键：AssetCacheAll`, `缓存刷新回滚`, `系统运维`, `中危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
- Footer/pagination visible: `共 4 条`, `10 条/页`, `上一页`, `1`, `下一页`, `前往`, `1`, `页`.
- Do not stack table characters vertically. Do not wrap the row into tall cells. No body row may be hidden under the bottom cards.

Middle right card:
- Title: `审计策略编辑`.
- All rows visible in order, no clipping:
  - `策略名称`: `CIP 转固高危操作审计`
  - `采集范围`: `CIP管理、资产管理、集成中心、权限管理`
  - `留存周期`: `3年`
  - `高危标记`: `勾选的操作类型判定为高危`
  - `导出水印`: `启用水印：公司全称 + 时间戳 + 用户`
  - `脱敏规则`: `默认脱敏规则-管理员（部分字段脱敏）`
  - `不可删除策略`: `启用（普通管理员不可删除）`
  - `取证审批`: `启用（需审计管理员审批）`
  - `告警通知`: `高危操作实时告警（邮件 + 短信）`
- Switches must be source-like blue/red toggles. No emoji pen icons; use small line edit glyphs or plain source-like control affordances.

Bottom row:
- Four source cards arranged in one horizontal row with equal top y and source-like card heights.
- Card 1 title: `导出取证包预览`; include `取证包编号`, `EVP-20250521-102345-001`; `事件数量`, `4 条`; `完整性哈希（SHA256）`, `7f1a6b6c9d8e4d2f0b5a3c9d6e7f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7`; `水印信息`; `下载审批状态`; button `下载取证包`.
- Card 2 title: `留存保护策略`; include `在线存储（热存） 180天`, `归档存储（冷存） 3年`, `普通管理员不可删除 已启用`, `强制留存策略 启用（不可覆盖）`.
- Card 3 title: `风险事件趋势（近 7 天）`; show red/orange trend line area with labels `高危事件`, `中危事件`, values ending `32` and `14`.
- Card 4 title: `审计链路追溯（示例）`; show four numbered timeline items: `作业台发起操作`, `工作流审批通过`, `系统回执（ERP/EHR/MES）`, `审计归档入库`.

Final self-check before completion:
- The rendered page at 1595 x 986 has no document scroll.
- All 4 audit event table body rows are visible.
- All 9 policy editor rows are visible.
- All 4 bottom cards are visible and do not overlap the table/editor.
- No emoji glyph appears anywhere.
- The result looks like a direct HTML transcription of the source screenshot, not a generic admin dashboard.
