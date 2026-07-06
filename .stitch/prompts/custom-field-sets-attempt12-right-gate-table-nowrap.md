Edit the selected previous DESIGN candidate into a NEW complete Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-06-custom-field-sets-v2.png` is the only source of truth.
The selected screen is only a repair base; do not treat it as the visual authority.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW persistent DESIGN screen with full HTML.

Page: 自定义字段集 / `system-custom-field-sets`.
Canvas: exact 1586 x 992 CSS pixels.
No page scroll. No content below y=992.
Avoid real internal scrollbars; visible source content must fit in-frame.
Keep Chinese/Latin table text horizontal; no vertical stacked cells.

Keep current source-matching areas unless explicitly named below:
- white top shell with `固定资产管理系统`
- left sidebar active `自定义字段集`
- title `自定义字段集编排台`
- action/status rows
- left field-set scheme list
- center field-set table
- desktop/H5 preview cards
- version impact matrix

Repair 1: right `字段集属性` rail must fit fully in x=1308..1586, y=56..992.
- Use compact property rows h<=30px.
- Keep all property fields visible through `审计策略`.
- Required values remain visible:
  `CIP转固字段集`
  `FIELDSET_CIP_TRANSFER`
  `在建工程`
  `v3.2（草稿）`
  `6 个字段`
  `自定义排序`
  `CIP转固_桌面页面布局_v2`
  `CIP转固_H5表单布局_v2`
  `CIP转固_导入模板_v2`
  `ERP-CIP转固集成映射_v1`
  `CIP转固字段权限策略_v2`
  `受影响 12 个页面 / 8 个实例`
  `字段变更审计策略_v1`

Repair 2: warning and gate placement.
- Orange warning card must sit around y=552..632, not at the bottom.
- It must include:
  `发布后生成字段集版本快照；已发布版本不能无痕改字段顺序；H5/桌面/导入模板需同步。`
- `发布门禁` card must start around y=646 and end before y=976.
- Show title `发布门禁` and score `8/9`.
- Show all rows:
  `编码唯一 通过`
  `字段存在 通过`
  `排序合法 通过`
  `必填策略 通过`
  `布局绑定 通过`
  `H5套用 通过`
  `导入导出 通过`
  `历史影响 待处理`
  `权限审计 通过`
- `历史影响` and `待处理` must be inside the visible 1586 x 992 viewport.

Repair 3: bottom-left `字段组成排序` table must read horizontally.
- Show six rows: `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`.
- Keep `唯一性校验`, `必填校验`, `值域校验`, `格式校验` horizontal.
- Use nowrap, font around 11px, compact row heights.

Repair 4: top-center field-set table must remain horizontally readable.
- Keep `FIELDSET_CIP_TRANSFER`, `FIELDSET_SERVER`, `FIELDSET_LAPTOP_OWNER`, `FIELDSET_INVENTORY_DIFF`, `FIELDSET_MAINT_ORDER` visible.
- Keep `状态` and `操作` columns visible before the right rail.

Forbidden output:
- `undefined`
- `NaN`
- `Lorem`
- emoji glyphs
- page-level scroll

Final self-check:
- Browser at 1586 x 992 shows `发布门禁`, `8/9`, all gate rows, `历史影响 待处理`, and the six `字段组成排序` rows.
- `documentElement.scrollHeight` and `body.scrollHeight` are 992.
- No required source-visible content needs scrolling to see.
