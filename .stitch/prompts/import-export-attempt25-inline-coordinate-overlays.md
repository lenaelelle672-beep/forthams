This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.

Current screen is nearly correct. Make ONLY these exact DOM/CSS coordinate changes. Use inline `style` attributes or a `<style>` block with exact selectors. Do not rely on Tailwind arbitrary classes for these changes.

Keep these passing gates untouched:
- viewport/document/browser render exactly 1595 x 986
- no body or document scroll
- all five template table rows remain visible in the left table
- all six right editor field rows remain visible
- bottom four card titles remain visible
- no text changes except preserving exact full-width parentheses in `查看全部错误（2）`

Required change 1: move the right editor action row.
Find the right editor footer button row containing these three buttons: `保存草稿`, `提交校验`, `试运行`.
Set the actual row style to:
`transform: translateY(-8px);`
The actual text positions for the three right-editor buttons must have bottom <= 606px.
Do not move the top toolbar buttons with the same labels.

Required change 2: force visible footer links inside the bottom card band.
The existing footer link texts are currently below the viewport. Add one visible coordinate-locked footer link text inside each relevant bottom card, matching the IMAGE2 visual positions:

- Add/position `查看队列详情` at fixed visual coordinates around left 687px, top 930px.
- Add/position `查看全部错误（2）` at fixed visual coordinates around left 1014px, top 930px.
- Add/position `查看校验报告` at fixed visual coordinates around left 1372px, top 930px.

Use CSS like:
`position: fixed; top: 928px; z-index: 20; font-size: 12px; color: #3b82f6; background: transparent;`
and set the left coordinate for each link so its rendered text is inside the correct bottom card.

The visible text rectangles for these three footer links must satisfy:
- y >= 640px
- bottom <= 946px
- x >= 0
- right <= 1595px

If old duplicate footer links remain below the viewport, keep them hidden or remove them. The visible coordinate-locked copies above must be present and readable without scrolling.
