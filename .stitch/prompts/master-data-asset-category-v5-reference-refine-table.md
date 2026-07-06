Edit the selected screen. Keep the current high-fidelity recreation, but fix the layout proportions so it matches the uploaded reference screenshot more closely.

Do NOT redesign the page. Do NOT change the data. Only adjust geometry and density.

## Problems to fix
1. The center table is too narrow and the cell text wraps vertically.
2. The filter bar is wrapping into two lines.
3. The right editor is taking too much width and the center table loses columns.
4. The workbench should match the source screenshot: left tree + center table + right editor in one row, with all table columns readable.

## Required geometry
- Fixed page frame: 1586px wide, 992px tall.
- Top nav height: 50px.
- Left sidebar width: 220px.
- Main content area: x=220, width=1366.
- Content padding: 20px.
- Workbench:
  - left tree width: 196px
  - center table width: about 724px
  - right editor width: about 384px
  - gaps: 10px
- Bottom:
  - impact preview spans only left tree + center table
  - publish checklist stays below right editor

## Table requirements
- The table must show all 9 columns without clipping:
  `分类名称`, `分类编码`, `上级分类`, `折旧年限(年)`, `编号前缀`, `盘点策略`, `标签策略`, `状态`, `操作`.
- Use font-size 12px.
- Use single-line cells where possible. Do not split values like `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `设备类标签` into vertical fragments.
- If needed, use CSS `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.
- Row height should be about 39-42px.
- Header row should remain compact.

## Filter bar requirements
- Keep all filter controls in one horizontal row, as in the uploaded screenshot:
  分类名称, 分类编码, 状态, 折旧策略, 盘点策略, 标签策略, 查询, 重置.
- Controls height 32px.
- No two-line filter layout.

## Right editor requirements
- Keep width about 384px.
- Keep form compact.
- If the form content is long, it may scroll internally, but the panel itself must align with the table top and checklist bottom.

## Keep exactly
- Keep the top navy shell and active states.
- Keep all 7 table rows and all exact row values.
- Keep all 13 right form fields and values.
- Keep the 5 impact cards.
- Keep the 6 publish checklist rows.
- Keep title `资产分类策略配置台`.
- Keep Ant Design style, #1677ff primary, #061b38 top nav, #f5f7fb page background, #d7e2ef borders.
