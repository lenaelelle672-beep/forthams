Repair this generated notification template screen against the IMAGE2 v2 source.

This is still a 100/100 pixel-fidelity transcription task, not a redesign task.
Use `notification-subpage-05-notification-templates-v2.png` as the source of truth.
Keep the current good shell, header, filter row, group list, and bottom-row placement.

Fix only these source-visible mismatches:

1. Center table must be horizontal, not vertical.
- In `通知模板列表`, every column header and cell must be single-line horizontal text.
- Set the table to a compact fixed layout inside the center card.
- Use about 11px font and `white-space: nowrap` for table cells.
- Do not stack the template names `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`.
- Required visible rows: `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`.
- Required visible badges: `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`.

2. Right editor must fit inside the source-visible column.
- `模板属性与内容编辑` must show the rich text editor and the action buttons within the 992px viewport.
- The buttons `插入变量`, `渲染预览`, `版本对比` must be visible above y=705, like the IMAGE2 source.
- Reduce vertical padding, reduce editor body height, and keep all fields compact.
- Do not hide these buttons below the viewport or behind scrolling.

3. Bottom row must remain source-like and visible.
- Bottom cards stay y about 716..962.
- `变量字典` rows remain horizontal.
- `多渠道预览` shows the three preview cards in one row.
- `发布校验清单` shows six checklist rows and `重新校验`.
- Do not use internal vertical scrollbars in `变量字典` or `发布校验清单`.

4. Preserve exact visible source strings:
- `通知模板配置台`
- `通知模板分组`, `通知模板列表`, `模板属性与内容编辑`
- `变量字典`, `多渠道预览`, `发布校验清单`
- `维保派工通知`
- `变量完整度 96%`
- `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`
- `插入变量`, `渲染预览`, `版本对比`, `重新校验`

Forbidden:
- Vertical table text.
- Page or main-content height above 992px.
- Buttons below y=992.
- Internal vertical scroll containers for source-visible content.
- Replacing the center table with cards.

Before finishing, verify the 1586 x 992 screenshot shows horizontal table rows and the right editor buttons.
