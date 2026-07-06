Repair the selected generated DESIGN screen into a new persistent Stitch DESIGN/HTML screen.

This is still a 100/100 pixel-fidelity transcription task against the IMAGE2 source `master-data-subpage-02-numbering-rules-v2.png`.
Do not return DOM operations only. Generate a persistent DESIGN screen with exported HTML that actually contains the repaired layout.
Do not redesign the shell, left sidebar, title, status strip, filter row, or left rule list.

Current exported attempt failure:
- `.center-workspace` is `overflow: auto` with `scrollHeight` about 1603 inside a 735px visible area.
- `.right-editor` is `overflow: auto` with `scrollHeight` about 1024 inside a 735px visible area.
- The real 1586 x 992 screenshot only shows the top table and part of the preview; `冲突检测队列` and the right `发布门禁 / 回滚策略` are below the visible viewport.
- The column header `数量折行` is stacked vertically.

Required repair:
1. Remove internal scrolling from the center and right columns.
   - No `overflow-y-auto`, no `overflow-auto`, no `overflow: auto`, no clipped scroll containers for source-visible content.
   - The whole page must remain exactly 1586 x 992 with document scrollHeight <= 992.

2. Rebuild the center workspace as three fixed-height bands inside x=448..1208, y=247..982:
   - Detail table band y=247..510, height about 263.
     Show title `编号规则明细表`, six compact horizontal rows, and pagination.
     Row height about 31px. Font 11px. Header text horizontal; `数量折行` must stay on one line.
   - Trial preview band y=522..740, height about 218.
     Show title `编号试算预览`.
     Show the input sample, arrow, result table, and blue preview note compactly.
     Must include `SESMT2026060001`, `SESMT2026060004`, `CIP2026060005`, `CIP2026060006` in the visible result table.
   - Conflict queue band y=752..952, height about 200.
     Title text must visually read `冲突检测队列（共 1 项待处理）`.
     Show four rows: `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`.

3. Rebuild the right column as two fixed-height cards inside x=1218..1576, y=247..982:
   - `编号规则属性编辑区` y=247..700.
     Compact fields with 26px control height and 6px row gaps.
     The visible field labels must include `序列位数`, `数量折行`, `预览不占号`.
     Buttons `保存草稿`, `提交校验`, `试算编号` must sit around y=660..695.
   - `发布门禁 / 回滚策略` y=712..952.
     Show all six checklist rows and warning text.
     Required visible rows: `编码唯一性`, `序列口径确认`, `数量折行已配置`, `试算样本通过`, `冲突队列已处理`, `回滚方案已编写`.
     Orange warning visible at the bottom.

4. Preserve exact data and fix text:
   - Status strip should visually read `试算样本 3 条` and `冲突检测 1 项待处理`.
   - Use exact row text `CIP转固公共月序列`.
   - Use exact generated value `SESMT2026060006` somewhere in the visible trial result set if the source has six rows; otherwise keep it in visible text near the trial table footer.
   - Use exact `数量折行`, `序列位数`, `预览不占号`.

Forbidden:
- `数量拆行`
- `序位位数`
- `预留不占号`
- `历史号重复`
- vertical text in table cells
- internal vertical scrollbars
- moving conflict queue or release checklist below y=992

Final self-check before returning:
- At 1586 x 992, the screenshot shows detail table, trial preview, conflict queue, right editor buttons, and release checklist all at once.
- The exported HTML must be persistent; if re-exported, it must still show the repaired layout.
