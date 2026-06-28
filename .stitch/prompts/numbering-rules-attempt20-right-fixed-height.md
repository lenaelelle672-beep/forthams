Repair only the RIGHT PROPERTY RAIL of the selected generated DESIGN screen.

Base candidate: keep the current successful center workspace exactly. Do not touch center x=448..1208.
Generate a new persistent Stitch DESIGN/HTML screen, not DOM operations only.

Right rail hard requirements:
- Right rail x=1218..1576, y=247..952.
- Do NOT set the first right panel to `h-[660px]`.
- Do NOT use a right editor panel taller than 456px.
- Do NOT push `发布门禁 / 回滚策略` below y=720.

Exact right rail bands:

1. Property editor card:
- x=1218..1576, y=247..703, height exactly about 456px.
- Title: `编号规则属性编辑区`.
- Use compact one-column source-like form.
- Control height: 20px to 22px.
- Label font: 11px.
- Row gap: 2px to 3px.
- All labels visible: `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览不占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Button row must be inside this card at y=674..698:
  `保存草稿`, `提交校验`, `试算编号`.

2. Release gate card:
- x=1218..1576, y=714..952, height about 238px.
- Title: `发布门禁 / 回滚策略` at y≈728.
- Six rows visible: `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
- Orange warning fully visible at y=922..948:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

Technical constraints:
- No `h-[660px]`, no `overflow-y-auto`, no `overflow-auto`, no `max-h-`.
- Document stays 1586 x 992; no internal real scrollbars; no vertical text.
- Keep exact source terms: `数量折行`, `序列位数`, `预览不占号`.
- Forbidden terms: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.
- Preserve current center detail grid, trial preview, and conflict queue exactly.

Final check:
- At 1586 x 992, the right editor buttons are above the release gate, and the release gate including `回滚方案已编写` and the orange warning is visible.
