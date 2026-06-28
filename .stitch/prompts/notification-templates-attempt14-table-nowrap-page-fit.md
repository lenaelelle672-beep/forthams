This is a 100/100 pixel-fidelity repair for `通知模板配置台`, not a redesign.
The IMAGE2 v2 source `notification-subpage-05-notification-templates-v2.png` remains the only source of truth.
Do not change business data. Do not use a generic admin template.

Use the current selected candidate as the visual base only if it can be persisted as a full DESIGN screen.
Return a persistent full DESIGN screen with downloadable HTML and screenshot, not DOM operation suggestions.

Keep from the current candidate:
- dark top shell and left sidebar
- title/action/status/filter bands
- left `通知模板分组`
- right `模板属性与内容编辑` with visible buttons `插入变量`, `渲染预览`, `版本对比`
- bottom cards `变量字典`, `多渠道预览`, `发布校验清单`

Repair only these two failures:

1. Page fit:
- Chrome document/body must be exactly 1586 x 992.
- No document scroll. No internal scroll containers.
- Keep bottom row y=716..962 and keep `重新校验` visible above y=962.
- Reduce vertical padding and row heights; do not push any bottom-card content below the viewport.

2. Center table must become a horizontal nowrap grid:
- Card x=440..1128, y=231..705.
- Use a CSS grid/fixed table with columns:
  select 28px, `模板名称` 94px, `模板编码` 150px, `业务事件` 86px, `触发条件` 112px, `渠道` 80px, `变量完整度` 78px, `状态` 64px, `最近更新` 82px, `操作` 54px.
- Header and all cells use `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; writing-mode: horizontal-tb;`.
- Row height 54px, font 11px, line-height 16px.
- Do not wrap template names into vertical columns.
- Do not use vertical writing, stacked characters, rotated labels, or one-character-per-line text.
- Five visible rows:
  `待办到达通知` `NT_TODO_ARRIVED` `审批待办创建` `待办节点创建时` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 09:42`
  `盘点异常通知` `NT_INV_EXCEPTION` `抽盘异常提交` `异常记录状态 = 提交` `站内 + 邮件` `7/8 缺1项` `草稿` `2026-06-19 09:15`
  `风险预警通知` `NT_RISK_ALERT` `告警触发` `告警等级 >= 高` `站内 + 钉钉 + 短信` `9/10 缺1项` `待校验` `2026-06-19 08:51`
  `维保派工通知` `NT_MAINTENANCE_DISPATCH` `维保派工` `工单状态 = 已派工` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 08:20`
  `CIP 转固提醒` `NT_CIP_CAPITALIZE` `验收通过待转固` `验收结果 = 通过` `站内 + 邮件` `8/8 完整` `已发布` `2026-06-19 07:56`

Keep exact source-visible strings:
`通知模板配置台`, `通知模板分组`, `通知模板列表`, `模板属性与内容编辑`, `变量字典`, `多渠道预览`, `发布校验清单`, `变量完整度 96%`, `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`, `重新校验`.

Final self-check:
- In a real 1586 x 992 Chrome screenshot, all five table row names are horizontal and readable.
- `维保派工通知` is present and visible.
- Right editor buttons remain visible.
- Bottom three cards remain visible.
- No real scroll containers exist.
