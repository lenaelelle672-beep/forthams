Repair the selected Stitch DESIGN screen into a new persistent full DESIGN screen.

This is a narrow coordinate repair only. Do not redesign the page.
The IMAGE2 v2 screenshot `notification-subpage-05-notification-templates-v2.png` remains the source of truth.
Return a persistent DESIGN screen with downloadable HTML and screenshot; do not return DOM operations only.

Preserve all currently passing gates from the selected screen:
- viewport, documentElement, and body remain exactly 1586 x 992.
- missing required text remains empty.
- forbidden placeholder text remains absent.
- all five center table rows remain horizontal.
- `渲染预览` and `版本对比` remain at y=696/bottom=713 with x>=1120.
- bottom cards remain visible.
- real internal scroller count remains 0.

Only fix this one failing text rect:
- Current `插入变量` text rect is x=1069.578125, y=696, bottom=713.
- Move the existing `插入变量` action button/text horizontally right by about 64px.
- Required final `插入变量` text rect: x>=1120, y around 696, bottom<=715.
- Target final `插入变量`: x=1132, y=696, bottom=713.

Do not move `插入变量` downward.
Do not create a duplicate `插入变量`.
Do not leave any visible `插入变量` copy at x<1120.
Do not move `渲染预览`, `版本对比`, the right editor form, the center table, or the bottom cards.
Do not introduce any `overflow:auto` or `overflow:scroll` container.

Hard final self-check in Chrome 1586 x 992:
- `插入变量`, `渲染预览`, and `版本对比` all satisfy x>=1120 and bottom<=715.
- `document.documentElement.scrollWidth === 1586`, `scrollHeight === 992`.
- `document.body.scrollWidth === 1586`, `scrollHeight === 992`.
- real internal scroller count is 0.
