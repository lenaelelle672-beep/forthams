Edit the selected previous DESIGN candidate `eed01e9d0898467381b43bcd45c988cc` into a NEW persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 source screenshot is `master-data-subpage-06-custom-field-sets-v2.png`.
Use the selected candidate only as the repair base.
Return a NEW complete DESIGN screen with full HTML. Do not return DOM operations only.

Freeze the entire page except the `校验规则` text cells inside the bottom-left `字段组成排序` table.

Current candidate is already correct for:
- document/body exactly 1586 x 992.
- no real internal scrollers.
- missing required text = none.
- right `字段集属性` and `发布门禁 8/9` visible.
- bottom-left table rows fit inside the card.

Only repair legibility of the validation labels in the bottom-left table:
- Increase the `校验规则` text labels to 11.5px or 12px so each visible label has a text box width >=45px.
- Labels: `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- Keep these labels horizontal and fully inside x<=760.
- Do not change row count, row y positions, card size, card position, or any other table columns.
- Do not move preview cards, matrix, right rail, top table, left list, or shell.
- Do not reintroduce scrolling or overflow-auto classes.

Forbidden:
- moving any frozen area.
- wrapping or stacking Chinese text vertically.
- changing business strings.
- `undefined`, `NaN`, `Lorem`, emoji glyphs.

Final self-check:
- `格式校验` width >=45px and right <=760.
- `必填校验` width >=45px and right <=760.
- `值域校验` width >=45px and right <=760.
- `唯一性校验` width >=45px and right <=760.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
