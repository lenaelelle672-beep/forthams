Edit the selected previous DESIGN candidate `bb828bdfff144c30a225ed914d30cc9c` into a NEW persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 product screenshot `master-data-subpage-06-custom-field-sets-v2.png` is the only source of truth.
Use the selected candidate only as the repair base.
Return a NEW complete DESIGN screen with full HTML. Do not return DOM operations only.

Hard freeze everything except the bottom-left `字段组成排序` table:
- top shell, sidebar, title area, green status strip.
- left scheme list.
- center top table and all rows.
- desktop preview, H5 preview, version matrix.
- right `字段集属性` rail, warning card, and `发布门禁 8/9` checklist.
- document/body size and no-scroll state.

Current candidate already has:
- `missing=[]`
- no real internal scrollers
- visible right rail and publish gate
- correct document/body `1586 x 992`

Only repair the bottom-left `字段组成排序` table:
- Keep the card position and size exactly.
- All six rows must stay visible: `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`.
- Keep all validation labels horizontal and fully inside the card:
  `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- The validation-label text must land inside x<=760. Do not let these labels extend into the next preview card.
- Reduce internal table columns and padding:
  排序 36px, 字段名称 82px, 字段类型 54px, 必填 42px, 桌面显示 62px, H5显示 58px, 导入模板 56px, 校验规则 72px.
- Use 10.5px or 10px text if needed, 28-30px rows, 2px horizontal cell padding.
- Shrink toggle switches and green check icons if needed.
- Do not wrap or stack Chinese table text vertically.
- Do not hide the validation column.

Forbidden:
- moving any frozen area.
- reintroducing `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or `max-h-`.
- page scroll or internal scroll.
- `undefined`, `NaN`, `Lorem`, emoji glyphs.

Final self-check:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
- `发布门禁`, `8/9`, `历史影响`, `待处理`, `权限审计` remain visible in the right rail.
- `唯一性校验`, `必填校验`, `值域校验`, `格式校验` are visible horizontally inside the bottom-left card and do not extend beyond x=760.
