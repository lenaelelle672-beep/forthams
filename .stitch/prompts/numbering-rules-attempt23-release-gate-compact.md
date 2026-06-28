This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Repair only the second right card `发布门禁 / 回滚策略` of the selected DESIGN screen.
Do not move the top shell, sidebar, status strip, filters, left list, center workspace, conflict queue, or the first right property editor card.
Keep the first right card and its action buttons exactly as in the current attempt: the buttons `保存草稿`, `提交校验`, `试算编号` are already correctly visible around y=706.

Current failure:
- The release gate checklist rows are too tall. `回滚方案已编写` falls near y=966..981, and the orange warning is clipped/offscreen.

Required second-card geometry at 1586 x 992:
- Card x=1218..1576.
- Card y=744..952.
- Title `发布门禁 / 回滚策略` at y=758..774.
- Divider line below title around y=786.
- Six checklist rows must all be visible and compact:
  1. `编码唯一性`
  2. `序列口径确认`
  3. `数量折行已配置`
  4. `试算样本通过`
  5. `冲突队列已处理`
  6. `回滚方案已编写`
- Checklist row height: 18px to 20px.
- Checklist row vertical gap: 2px to 3px.
- Row y-bands:
  `编码唯一性` y=796..814
  `序列口径确认` y=819..837
  `数量折行已配置` y=842..860
  `试算样本通过` y=865..883
  `冲突队列已处理` y=888..906
  `回滚方案已编写` y=911..929
- Status text on the right side (`通过`, `待处理 1 项`) must stay visible and aligned in the same row.
- Orange warning box must be fully visible at y=932..948:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

Technical constraints:
- Browser viewport remains 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- Do not add `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or `max-h-`.
- No vertical/squeezed text.
- Keep exact terms: `数量折行`, `序列位数`, `预览不占号`.
- Forbidden terms: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final acceptance:
- Right editor remains visible with its three buttons.
- Release gate rows and orange warning are fully visible inside the viewport.
- Center workspace remains unchanged.
