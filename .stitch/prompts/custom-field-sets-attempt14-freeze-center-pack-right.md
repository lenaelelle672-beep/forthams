Edit the selected previous DESIGN candidate `900c3c2c97de42a99a352ff895fda106` into a NEW persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-06-custom-field-sets-v2.png` is the only source of truth.
Use the selected candidate only as a repair base because its center content is mostly correct.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return DOM operations only.

Hard freeze, do not rebuild or move these candidate areas:
- top shell, left sidebar, breadcrumb, title, actions, and status strip.
- left `业务对象/字段集方案` list.
- center top field-set table, including rows:
  `FIELDSET_CIP_TRANSFER`, `FIELDSET_SERVER`, `FIELDSET_LAPTOP_OWNER`, `FIELDSET_INVENTORY_DIFF`, `FIELDSET_MAINT_ORDER`.
- `桌面套用预览`, `H5套用预览`, and `版本影响矩阵`.
- center workspace x bands. The right rail must stay in x=1308..1586 and must not push the center content left or right.

Canvas contract:
- Browser viewport/document/body exactly 1586 x 992 CSS pixels.
- No page scroll.
- No real internal scrollbars for source-visible content.
- No content below y=992.
- No vertical stacked text in tables.
- Keep compact Chinese enterprise typography.

Repair only these two areas:

1. Right rail vertical packing.
- Keep right rail x=1308..1586.
- Move the right rail header `字段集属性` to y≈68, like the IMAGE2 source.
- Pack all property fields from y≈100 to y≈535 with compact 24px value boxes and 4px gaps:
  `名称 *` `CIP转固字段集`
  `编码 *` `FIELDSET_CIP_TRANSFER`
  `业务对象 *` `在建工程`
  `当前版本` `v3.2（草稿）`
  `字段组成` `6 个字段`
  `排序策略` `自定义排序`
  `桌面布局绑定` `CIP转固_桌面页面布局_v2`
  `H5布局绑定` `CIP转固_H5表单布局_v2`
  `导入导出模板` `CIP转固_导入模板_v2`
  `集成映射` `ERP-CIP转固集成映射_v1`
  `权限策略` `CIP转固字段权限策略_v2`
  `历史影响` `受影响 12 个页面 / 8 个实例`
  `审计策略` `字段变更审计策略_v1`
- Place the orange warning card at y≈548..626 and keep this text visible:
  `发布后生成字段集版本快照；已发布版本不能无痕改字段顺序；H5/桌面/导入模板需同步。`
- Place the `发布门禁` card at y≈640..968.
- Show title `发布门禁` and score `8/9`.
- Show all 9 checklist rows inside y<970:
  `编码唯一` `通过`
  `字段存在` `通过`
  `排序合法` `通过`
  `必填策略` `通过`
  `布局绑定` `通过`
  `H5套用` `通过`
  `导入导出` `通过`
  `历史影响` `待处理`
  `权限审计` `通过`
- `历史影响`, `待处理`, and `权限审计` must be visible inside x=1308..1586 and y<970.
- Do not move `发布门禁` below y=970.

2. Bottom-left `字段组成排序` table readability.
- Keep the card position and size from the candidate.
- Do not rebuild the card as form fields.
- Keep six rows visible:
  `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`.
- Keep validation labels horizontal and visible:
  `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- Use nowrap cells, 11px text, compact row height around 30px.
- If space is tight, reduce toggle/icon size; do not hide rows.

Strict preservation:
- Preserve `FIELDSET_CIP_TRANSFER` in the center table at x≈520..1000.
- Preserve `FIELDSET_SERVER`, `FIELDSET_LAPTOP_OWNER`, `FIELDSET_INVENTORY_DIFF`, `FIELDSET_MAINT_ORDER`.
- Preserve `转固批次号`, `项目编号`, `资产小类`, `发票号`, `ERP回执号` as horizontal table text.
- Preserve `版本影响矩阵` values and `待处理` inside the matrix.

Forbidden:
- `undefined`, `NaN`, `Lorem`, emoji glyphs.
- returning DOM operations only.
- creating an internal right-rail scrollbar.
- moving publish gate below the viewport.
- dropping center/bottom required text while fixing the right rail.

Final self-check before returning:
- Required visible text exists: `发布门禁`, `8/9`, `编码唯一`, `字段存在`, `排序合法`, `必填策略`, `布局绑定`, `H5套用`, `导入导出`, `历史影响`, `待处理`, `权限审计`.
- Required center text still exists: `FIELDSET_SERVER`, `FIELDSET_LAPTOP_OWNER`, `FIELDSET_INVENTORY_DIFF`, `FIELDSET_MAINT_ORDER`.
- Required sort table text still exists: `转固批次号`, `项目编号`, `资产小类`, `供应商`, `发票号`, `ERP回执号`, `唯一性校验`, `必填校验`, `值域校验`, `格式校验`.
- `documentElement.scrollHeight` and `body.scrollHeight` are exactly 992.
