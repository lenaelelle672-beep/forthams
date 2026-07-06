Repair the selected DESIGN screen into a new persistent DESIGN screen.

Do not redesign. Do not change layout structure. Do not return DOM operations only.

Current exported HTML already passes every verifier gate except the right editor action buttons.
Keep all current text, table rows, bottom cards, document size, and zero-scroll behavior exactly as-is.

Only change the existing right editor action row:
- Current text rects are:
  - `插入变量`: x=1069.578125, y=728, bottom=745
  - `渲染预览`: x=1388, y=728, bottom=745
  - `版本对比`: x=1488, y=728, bottom=745
- Move the existing row with CSS/absolute positioning/transform so the exported HTML renders:
  - `插入变量`: x>=1120 and bottom<=715
  - `渲染预览`: x>=1120 and bottom<=715
  - `版本对比`: x>=1120 and bottom<=715
- Recommended transform for the current row: translate(64px, -38px).
- Do not duplicate the buttons. Do not leave old visible text at y=728.
- Do not move the bottom workspace.
- Do not change the center table or bottom cards.

Final self-check in Chrome 1586 x 992:
- documentElement/body remain exactly 1586 x 992.
- missing text remains [].
- all five table rows remain horizontal.
- bottom cards remain visible.
- realScrollerCount remains 0.
- the three action button text rects satisfy x>=1120 and bottom<=715.
