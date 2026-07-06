Create a new persistent full DESIGN screen from the selected Stitch DESIGN screen.

This is a narrow verification repair for `notification-subpage-05-notification-templates-v2.png`.
Do not return DOM operation suggestions only. Return a persistent DESIGN screen with downloadable HTML and screenshot.

Current state already passes every verifier gate except the right editor action row. Preserve all passing content:
- documentElement/body size exactly 1586 x 992
- no real internal scroll containers
- all required text present
- all 5 center table rows horizontal and visible
- bottom cards visible
- no forbidden text

The only failing rects in the current exported HTML are:
- `插入变量` at x=1069.578125, y=728, bottom=745
- `渲染预览` at x=1388, y=728, bottom=745
- `版本对比` at x=1488, y=728, bottom=745

Force this exact repair:
1. Remove or relocate the old action row at y=728. No action button text may remain with bottom > 715.
2. Add one compact right-editor toolbar inside the `模板属性与内容编辑` panel at y=684..710.
3. Place the three action buttons in this toolbar as plain text buttons:
   - `插入变量` text rect target x=1132, y=690, bottom about 707
   - `渲染预览` text rect target x=1258, y=690, bottom about 707
   - `版本对比` text rect target x=1384, y=690, bottom about 707
4. The right editor panel may compress the editor body by 34px if needed. Do not move the bottom workspace.
5. Do not duplicate the row below y=715. Do not use emoji icons.

Implementation guidance for the generated HTML:
- Use absolute positioning or a fixed grid band for the toolbar.
- The toolbar container can be `position:absolute; left:1148px; top:684px; width:410px; height:30px;`.
- Button text must not wrap.
- Keep all labels horizontal.

Final self-check:
- `插入变量`, `渲染预览`, and `版本对比` all have visible text rects with x>=1120 and bottom<=715.
- There are no visible rects for these three texts with bottom>715.
- All previous verifier gates remain true.
