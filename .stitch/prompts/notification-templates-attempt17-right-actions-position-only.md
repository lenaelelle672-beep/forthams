Repair only the right editor action button row in the selected Stitch DESIGN screen.

Do not regenerate or change the page structure. Preserve all currently passing content:
- fixed 1586 x 992 document
- zero real scroll containers
- all five center table rows
- all bottom cards
- all text values and codes

Single required fix:
- Move the right editor action row containing `插入变量`, `渲染预览`, `版本对比` upward so every button has `bottom <= 715`.
- Move the row to the right so every button text has `x >= 1120`.
- Target final button text positions approximately:
  - `插入变量`: x=1130, y=688, bottom about 708
  - `渲染预览`: x=1255, y=688, bottom about 708
  - `版本对比`: x=1380, y=688, bottom about 708
- Keep the buttons inside the right editor panel.
- Do not move the bottom workspace.
- Do not reintroduce emoji.

Final self-check:
- In Chrome 1586 x 992, the text rects for `插入变量`, `渲染预览`, and `版本对比` all satisfy x>=1120 and bottom<=715.
