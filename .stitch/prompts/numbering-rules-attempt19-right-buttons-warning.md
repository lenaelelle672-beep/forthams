Repair only the RIGHT PROPERTY RAIL and status strip text of the selected generated DESIGN screen.

Source: `master-data-subpage-02-numbering-rules-v2.png`.
Keep the current center workspace exactly as it is: the detail grid, trial preview, and conflict queue now fit visually. Do not change center x=448..1208.
Keep shell, sidebar, header, filter row, and left rule list exactly as they are.
Generate a new persistent Stitch DESIGN/HTML screen. Do not return DOM operations only.

Current remaining right rail failure:
- The right editor buttons `保存草稿`, `提交校验`, `试算编号` are visually at y≈812 inside the release checklist area.
- They must be inside `编号规则属性编辑区`, above `发布门禁 / 回滚策略`.
- The orange warning at the bottom of the release checklist is barely clipped.

Required right rail geometry, x=1218..1576:

1. `编号规则属性编辑区` card y=247..704.
- Use compact two-column field layout when needed.
- Keep all labels visible and horizontal:
  `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览不占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Control height 24px to 26px, row gap 4px.
- Place button row at y=660..696 inside this card:
  `保存草稿`, `提交校验`, `试算编号`.
- These buttons must not appear inside the release checklist.

2. `发布门禁 / 回滚策略` card y=714..952.
- Title y≈728.
- Checklist rows y=772..912:
  `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
- Orange warning fully visible y=922..948:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

3. Status strip text:
- Make the status text visually contiguous and present in browser text:
  `试算样本 3 条`
  `冲突检测 1 项待处理`
- Do not split the number into a separate inaccessible or hidden element.

Technical constraints:
- Remove leftover `overflow-y-auto`, `overflow-auto`, and `max-h-` classes from source-visible content.
- No document scroll, no internal real scrollbars, no vertical text.
- Do not change the good center grid.
- Forbidden strings remain forbidden: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final self-check:
- At 1586 x 992, center detail/preview/conflict remains visible.
- Right editor button row is visible above the release checklist.
- Release checklist and orange warning are fully visible.
