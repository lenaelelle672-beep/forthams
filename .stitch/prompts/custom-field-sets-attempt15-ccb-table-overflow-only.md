Edit the selected previous DESIGN candidate `ccb7878b834b4a64add860ba18923c85` into a NEW persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 product screenshot is the only source of truth:
- Page: 自定义字段集
- Menu id: system-custom-field-sets
- Reference image: master-data-subpage-06-custom-field-sets-v2.png
- Uploaded IMAGE source screen id: 4056474604009552491
- Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-custom-field-sets

Use the selected candidate only as the repair base because it already matches the source layout closely.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return DOM operations only.

Hard freeze these areas exactly as in the selected candidate:
- top shell, left sidebar, breadcrumb, page title, button row, and green status strip.
- left `业务对象/字段集方案` list.
- center top field-set table rows and x/y positions.
- right `字段集属性` rail, orange warning card, and `发布门禁 8/9` checklist. It is already visible; do not move it down or offscreen.
- desktop preview, H5 preview, and version matrix positions.

Canvas contract:
- Browser viewport/document/body exactly 1586 x 992 CSS pixels.
- No page scroll.
- No real internal scrollbars for source-visible content.
- No generated artboard wider than 1586 in the browser output.
- Do not create any element with `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or `max-h-` classes.
- No content below y=992.
- No vertical stacked table text.

Repair only these two things:

1. Bottom-left `字段组成排序` table readability and fit.
- Keep the card at the source position: left x≈225, top y≈603, width≈540, height≈350.
- Keep all six rows visible:
  `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`.
- Keep validation labels horizontal and visible inside this card:
  `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- Use a real compact table/grid, not form fields.
- Recommended internal columns: 排序 48px, 字段名称 92px, 字段类型 64px, 必填 50px, 桌面显示 72px, H5显示 64px, 导入模板 64px, 校验规则 86px.
- Use nowrap cells, 11px text, 30px row height, 4px horizontal padding.
- If space is tight, reduce switch/icon width and padding; do not hide the validation column and do not push it outside the card.

2. Remove real internal overflow without changing layout.
- Replace the main content scroller with fixed-height visible content that fits the 1586 x 992 viewport.
- Replace the left list, center table wrapper, bottom sort table wrapper, and right rail scrollers with fixed visible panels.
- Keep the visual layout and text exactly the same after removing overflow.
- Do not clip required rows or move any frozen area.

Required visible text after repair:
- `自定义字段集编排台`, `业务对象/字段集方案`, `字段组成排序`, `桌面套用预览`, `H5套用预览`, `版本影响矩阵`, `字段集属性`.
- `CIP转固字段集`, `FIELDSET_CIP_TRANSFER`, `FIELDSET_SERVER`, `FIELDSET_LAPTOP_OWNER`, `FIELDSET_INVENTORY_DIFF`, `FIELDSET_MAINT_ORDER`.
- `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`.
- `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- `发布后生成字段集版本快照`, `发布门禁`, `8/9`, `编码唯一`, `字段存在`, `排序合法`, `必填策略`, `布局绑定`, `H5套用`, `导入导出`, `历史影响`, `待处理`, `权限审计`.

Forbidden:
- `undefined`, `NaN`, `Lorem`, emoji glyphs.
- returning DOM operations only.
- moving the right rail or publish gate.
- making the field-set table labels vertical.
- dropping required center/bottom text while fixing overflow.

Final self-check before returning:
- All required strings are present and visible in the 1586 x 992 frame.
- `发布门禁 8/9` remains visible in the right rail.
- `字段组成排序` rows and validation labels are horizontal and inside the left-bottom card.
- `documentElement.scrollWidth/scrollHeight` and `body.scrollWidth/scrollHeight` are exactly 1586 x 992.
