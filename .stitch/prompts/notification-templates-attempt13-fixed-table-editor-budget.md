This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 通知模板配置台
Menu id: system-notification-templates
Reference image: notification-subpage-05-notification-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-05-notification-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-templates

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible product text `固定资产管理系统`, and the dark navy shell.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Return a persistent full DESIGN screen with downloadable HTML and screenshot. Do not return only DOM operation suggestions.
Chrome document and body must be exactly 1586 x 992 CSS px. No page scroll, no internal scroll containers, no offscreen 3172 x 2048 artboard.

Use this fixed source grid:
- top nav x=0..1586, y=0..52
- left sidebar x=0..216, y=52..992, active `消息与通知 > 通知模板`
- main x=216..1586
- title/action/status y=62..165
- filter row y=172..219
- main row y=231..705
- bottom row y=716..962

Header:
`通知模板配置台`
Subtitle: `维护站内、钉钉 H5、邮件和钉通知的标题、正文、按钮、变量与发布校验。`
Buttons: `新建通知模板`, `保存草稿`, `提交校验`, `通知预览`, `发布`.
Status strip: `模板草稿 已保存`, `多渠道预览 已生成`, `变量完整度 96%`, `强制通知 4 条`, `最近更新 2026-06-19 10:18`, `更新人 平台运维`.

Filter row:
Search placeholder `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道`.
Filters `状态`, `业务事件`, `通知渠道`, `语言`, `引用流程`, `强制通知`.
Buttons `重置`, `高级筛选`.

Left group card x=234..430, y=231..705:
Title `通知模板分组`.
Groups `流程待办`, `盘点异常`, `风险预警`, `维保派工`, `CIP 转固`.
Show source-like icons, counts, owner lines, and green `启用` badges.

Center table card x=440..1128, y=231..705:
Title `通知模板列表`.
This is a real horizontal dense table, not stacked cards.
Use fixed horizontal row grid: each row height 56 px, font 11px, `white-space: nowrap`, no vertical writing, no wrapping into one-character columns.
If width is tight, reduce columns but keep these exact visible cells horizontal:
- `待办到达通知` `NT_TODO_ARRIVED` `审批待办创建` `待办节点创建时` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 09:42`
- `盘点异常通知` `NT_INV_EXCEPTION` `抽盘异常提交` `异常记录状态 = 提交` `站内 + 邮件` `7/8 缺1项` `草稿` `2026-06-19 09:15`
- `风险预警通知` `NT_RISK_ALERT` `告警触发` `告警等级 >= 高` `站内 + 钉钉 + 短信` `9/10 缺1项` `待校验` `2026-06-19 08:51`
- `维保派工通知` `NT_MAINTENANCE_DISPATCH` `维保派工` `工单状态 = 已派工` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 08:20`
- `CIP 转固提醒` `NT_CIP_CAPITALIZE` `验收通过待转固` `验收结果 = 通过` `站内 + 邮件` `8/8 完整` `已发布` `2026-06-19 07:56`
Footer `共 5 条`, page `1`, `20 条/页`.

Right editor card x=1143..1568, y=231..705:
Title `模板属性与内容编辑`.
Keep all source-visible fields and the content editor inside this card:
`模板名称`, `模板编码`, `业务事件`, `触发条件`, `默认渠道`, `负责人`, `启用状态`, `通知内容编辑`, `标题`, `正文`.
Rich text area must show variables `{{receiver_name}}`, `{{todo_title}}`, `{{asset_name}}`, `{{risk_level}}`, `{{process_link}}`.
Action buttons must be visible above y=705: `插入变量`, `渲染预览`, `版本对比`.
Use compact controls: 26px inputs, 4px gaps, editor body max 125px. No editor scrollbar.

Bottom row:
- `变量字典` card x=234..640, y=716..962. Five horizontal rows: `receiver_name`, `asset_name`, `todo_title`, `risk_level`, `process_link`, footer `共 5 条`.
- `多渠道预览` card x=650..1106, y=716..962. Tabs `站内通知`, `钉钉 H5 卡片`, `邮件摘要`; show three preview panels and buttons `去处理`.
- `发布校验清单` card x=1116..1568, y=716..962. Six rows: `变量完整度`, `渠道适配`, `按钮链接`, `强制通知策略`, `失败降级`, `审计记录`, button `重新校验`.

Hard forbidden failures:
- no vertical stacked table text
- no table/card/editor internal scrollbars
- no page height above 992
- no missing `维保派工通知`
- no right editor buttons below y=705
- no bottom card content below y=962

Final self-check:
The real 1586 x 992 Chrome screenshot must show all three main columns, all five notification rows horizontally, all right editor action buttons, and all three bottom cards.
