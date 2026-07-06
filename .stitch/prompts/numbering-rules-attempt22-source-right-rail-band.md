This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Repair only the right property rail of the current generated DESIGN screen.
Keep the current successful shell, sidebar, status strip, filters, left list, center detail table, preview, and conflict queue unchanged.
Generate a new persistent Stitch DESIGN/HTML screen.

Current failure to fix:
- The right editor action buttons are rendered at/under the release gate boundary and are not visible in the right property editor card.
- The source IMAGE2 screenshot has these buttons clearly visible inside the first right card, immediately above the second card:
  `保存草稿`, `提交校验`, `试算编号`.

Source-locked right rail geometry at 1586 x 992:
- Right rail x=1218..1576.
- First card `编号规则属性编辑区`: y=247..736.
- Second card `发布门禁 / 回滚策略`: y=744..952.
- There must be a clear 8px gap between the two cards.

First card details:
- Title `编号规则属性编辑区` at y=262.
- Form starts near y=300 and ends by y=682.
- Preserve all source labels and values:
  `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览不占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Compact the row rhythm enough to fit the full form:
  row height 24px to 26px, control height 20px to 22px, label font 11px, row gap 1px.
- The button row must be visible inside the first card:
  `保存草稿` at x=1230..1310, y=692..724
  `提交校验` at x=1324..1424, y=692..724
  `试算编号` at x=1440..1560, y=692..724
- Button bottom must be <=736.
- Do not place these buttons in the second card.
- Do not clip the buttons. Do not cover them with the release gate card.

Second card details:
- Title `发布门禁 / 回滚策略` at y=758..776.
- Six validation rows fit within y=790..907:
  `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
- Orange warning fully visible at y=916..946:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

Status strip:
- Keep the visual phrase exactly as source:
  `试算样本 3 条`
  `冲突检测 1 项待处理`

Technical constraints:
- Browser viewport remains 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- Do not add `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or `max-h-`.
- No vertical/squeezed text.
- Keep exact terms: `数量折行`, `序列位数`, `预览不占号`.
- Forbidden terms: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final acceptance:
- At 1586 x 992, the first card shows all form rows and the three action buttons.
- The second card starts below those buttons and shows all six checks plus the orange warning.
- Center workspace remains as in the current good candidate.
