Repair the selected Stitch DESIGN screen. Keep the current successful fixed 1586 x 992 zero-scroll layout and do not regenerate a different page.

This is a narrow verification repair against `notification-subpage-05-notification-templates-v2.png`.
Return a persistent full DESIGN screen with downloadable HTML and screenshot. Do not return only DOM operation suggestions.

Keep unchanged:
- Document and body size 1586 x 992.
- No real scroll containers.
- Current top shell, left sidebar, header, filter row, group panel, and first three center table rows.
- Current right editor content and bottom three-card layout.

Fix only these verification gaps:

1. Center table missing rows
- Add/restore the 4th row exactly:
  `维保派工通知` `NT_MAINTENANCE_DISPATCH`
- Add/restore the 5th row exactly:
  `CIP 转固提醒` `NT_CIP_CAPITALIZE`
- Keep all five table rows horizontal between x=439..1130 and y=312..575.
- Do not stack text vertically.

2. Header status text
- Render exact continuous text `变量完整度 96%` somewhere in the status strip.
- Do not split it into separate nodes that cannot be read as continuous body text.

3. Right editor action buttons
- Move `插入变量`, `渲染预览`, and `版本对比` to x>=1120 and bottom<=715.
- Keep them visible in the right editor action row.
- Remove emoji icons from these buttons. Use plain text or monochrome line icons.

4. Bottom variable dictionary
- In the `变量字典` bottom-left card, show all five rows as visible text between y=716..963:
  `receiver_name`, `asset_name`, `todo_title`, `risk_level`, `process_link`.
- `process_link` must appear in the bottom variable dictionary, not only inside the editor body.

5. Bottom preview/checklist
- Keep `站内通知`, `钉钉 H5 卡片`, and `重新校验` visible within y=716..982.
- Remove emoji from `重新校验`.

6. Scroll and forbidden text
- Keep documentElement and body scrollHeight exactly 992.
- Real internal scroller count must be zero.
- No `undefined`, `NaN`, `Lorem`, `lorem`, or emoji glyphs.

Final self-check:
- Required text present: `维保派工通知`, `CIP 转固提醒`, `NT_MAINTENANCE_DISPATCH`, `变量完整度 96%`, `process_link`.
- Table row visibility: all 5 rows have rect x>=430, x<=1135, y>=270, bottom<=700, height<=28.
- Right action visibility: all three buttons x>=1120 and bottom<=715.
- Bottom cards visibility: receiver_name/process_link/站内通知/钉钉 H5 卡片/重新校验 are all in the bottom workspace.
