Repair the selected Stitch DESIGN screen against the IMAGE2 source `master-data-subpage-06-custom-field-sets-v2.png`.

This is still a 100/100 pixel-fidelity transcription task, not a redesign.
Keep the same white top shell, sidebar, title/actions/status strip, left field-set list, center field-set table, bottom previews, and right property rail.

Only repair these visible mismatches:

1. Right rail must show the complete source-visible lower section in the 1586 x 992 viewport:
   - `字段集属性`
   - all property fields through `审计策略`
   - the orange warning `发布后生成字段集版本快照；已发布版本不能无痕改字段顺序；H5/桌面/导入模板需同步。`
   - the full `发布门禁` card with `8/9`
   - all checklist rows: `编码唯一`, `字段存在`, `排序合法`, `必填策略`, `布局绑定`, `H5套用`, `导入导出`, `历史影响`, `权限审计`
   - `历史影响` row must show `待处理`.
   The current candidate clips the publish gate below the viewport. Compress the right rail field heights and vertical gaps so the publish gate starts around y=620 and ends before y=955.

2. The bottom-left `字段组成排序` table must read horizontally.
   The current candidate wraps values like `转固批次号` and `唯一性校验` vertically. Make these cells single-line horizontal by reducing font size to about 11px, widening text columns, and using nowrap. Do not stack Chinese characters.

3. The top-center table must show its right-side `状态` and `操作` columns before the right rail, with horizontal row text. Compress only column widths/typography; do not move the right rail offscreen.

4. Keep the bottom workspace y position as in the current candidate/source. Do not push `版本影响矩阵` below the viewport.

Do not introduce page scrollbars or internal scrollbars. If content is tight, reduce row heights, font size, and padding. Do not hide required source text behind clipping.
