This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Repair only the right property rail and the residual overflow class in the selected generated DESIGN screen.
Keep the current top shell, sidebar, status strip, filters, left rule list, center detail grid, trial preview, and conflict queue visually unchanged.
Generate a new persistent Stitch DESIGN/HTML screen, not DOM operations only.

Critical current failure:
- The right editor buttons `保存草稿`, `提交校验`, `试算编号` are below the visible editor card, around y=760, and must move upward into the editor card at y=668..704.
- The HTML still contains `overflow-y-auto` on the left rule list. Remove all `overflow-y-auto`, `overflow-auto`, `max-h-*`, and `max-h-[...]` classes from the generated HTML. Do not replace them with another auto/scroll overflow class.

Right rail target geometry at 1586 x 992:
- Right rail outer band: x=1218..1576, y=247..952.
- Property editor card: x=1218..1576, y=247..704, height about 457px.
- Release gate card: x=1218..1576, y=714..952, height about 238px.

Property editor card:
- Title `编号规则属性编辑区` near x=1260, y=262.
- Keep compact one-column form with all labels visible:
  `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览不占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Use 20px to 22px controls.
- Label font 11px.
- Row gap 1px to 2px.
- Compress vertical rhythm enough that `负责人` ends by y=656.
- The button row must be inside this same property editor card:
  `保存草稿`, `提交校验`, `试算编号`
  each visible at x>=1218, y=668..704, bottom<=710.
- Do not place these three buttons in the release gate card. Do not let them overlap the release gate title.

Release gate card:
- Title `发布门禁 / 回滚策略` at y=726..742.
- Rows visible:
  `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
- Orange warning fully visible inside the viewport at y=922..948:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

Status strip text:
- Preserve visual text exactly:
  `试算样本 3 条`
  `冲突检测 1 项待处理`
- It is acceptable to style the number in a nested span, but the visible phrase must read as the exact source text.

Technical constraints:
- Document must stay 1586 x 992 at browser viewport 1586 x 992.
- No internal real scrollbars.
- No vertical text or squeezed text.
- No `h-[660px]`.
- No `overflow-y-auto`, no `overflow-auto`, no `max-h-`.
- Preserve exact terms: `数量折行`, `序列位数`, `预览不占号`.
- Forbidden terms: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final visual check:
- At 1586 x 992, the editor buttons are visible above the release gate.
- The release gate and orange warning are visible.
- Center workspace still matches the current good attempt.
