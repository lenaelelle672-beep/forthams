This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Repair only the top-left brand mark of the current persistent DESIGN screen.
Keep the successful body layout from the current candidate unchanged:
- status strip, filters, left list, center detail grid, preview, conflict queue,
- right property editor with buttons,
- release gate with all six rows and orange warning.

Brand source requirement:
- The IMAGE2 source screenshot top-left brand is a white `uniview` wordmark followed by a vertical divider and `固定资产管理系统`.
- There is NO blue square `U` app icon in the IMAGE2 source.
- Remove the generated blue rounded-square `U` icon completely.

Top-left brand geometry at 1586 x 992:
- Dark navy top bar remains height about 50px.
- White `uniview` wordmark starts around x=14, y=14.
- Wordmark width about 95px, height about 22px.
- Use lowercase visual wordmark text `uniview` in white. It may be CSS text, but it must look like the source wordmark, not a generic app icon.
- Put a thin vertical divider around x=120, y=14..36.
- Put `固定资产管理系统` in white around x=132, y=17, same as source.
- Do not add any blue logo square, app badge, or generic icon.
- Preserve the rest of the top navigation positions and active `系统运营中枢` state.

Technical constraints:
- Create a new persistent Stitch DESIGN screen, not DOM operations only.
- Browser viewport remains 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- No `overflow-y-auto`, no `overflow-auto`, no `max-h-`.
- No vertical/squeezed text.
- Keep exact terms: `数量折行`, `序列位数`, `预览不占号`.

Final acceptance:
- Exported HTML screenshot at 1586 x 992 shows no blue `U` square and shows the source-like `uniview | 固定资产管理系统` lockup.
- All current layout gates from the body remain intact.
