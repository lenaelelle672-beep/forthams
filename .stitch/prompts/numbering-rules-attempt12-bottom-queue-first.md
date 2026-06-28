Edit the selected uploaded IMAGE2 v2 source screenshot into a new Stitch DESIGN screen.

Page name: 资产编号规则配置台
Menu id: system-numbering-rules
Reference image: master-data-subpage-02-numbering-rules-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-02-numbering-rules-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-numbering-rules

Recreate this exact IMAGE2 v2 product screenshot as HTML.
The source screenshot is exactly 1586 x 992. Keep the generated DESIGN screen at 1586 x 992 CSS px with no document scroll.
Do not use previous Stitch drafts as the visual source.

Top-left IMAGE2 brand lock:
- Preserve the exact source top-left brand: white lowercase-looking source wordmark `uniview` as rendered in the IMAGE2 screenshot, the vertical divider, and `固定资产管理系统`.
- Do not add a blue product icon before the wordmark.
- Do not replace the mark with a generic cube, bell, shield, or broken logo.
- Keep the top nav dark navy and `系统运营中枢` active.

Hard layout budget, source coordinates:
- Header/nav occupies y=0..52.
- Left sidebar occupies x=0..206, y=52..992.
- Content title/action row occupies x=228..1575, y=72..116.
- Status strip occupies x=228..1575, y=128..167.
- Filter strip occupies x=228..1575, y=180..221.
- Main workspace begins at y=232 and ends by y=924.
- Left `编号规则列表` is x=227..439, y=232..761. It shows seven rule cards plus `展开全部`.
- Center `编号规则明细表` is x=450..1206, y=232..526. It must show exactly six compact table rows; row height must be near 36 px, not 60+ px.
- Center `编号试算预览` is x=450..1206, y=538..760. It has three columns: 输入样本, arrow, 试算结果, plus the blue `规则预览说明` card.
- Center `冲突检测队列（共 1 项待处理）` is x=227..1206, y=773..924. All four conflict rows are visible inside this frame.
- Right `编号规则属性编辑区` is x=1216..1575, y=232..724. All form fields and the three buttons `保存草稿`, `提交校验`, `试算编号` are visible.
- Right `发布门禁 / 回滚策略` is x=1216..1575, y=737..932. The checklist and orange warning are visible inside this frame.

Tradeoff instruction:
- If space is tight, reduce font size, cell padding, and table row height before moving any source-visible content below the 992 px viewport.
- Do not sacrifice the bottom conflict queue or the right publish gate. These two areas must stay visible.
- Keep Chinese table cells horizontal. Do not stack characters vertically.
- Do not create `overflow:auto`, `overflow-y:auto`, `max-height` clipped table bodies, sticky scroll panels, or hidden scroll areas for center/right sections.

Required visible source text:
- `资产编号规则配置台`
- `编号规则列表`
- `编号规则明细表`
- `编号试算预览`
- `冲突检测队列（共 1 项待处理）`
- `编号规则属性编辑区`
- `发布门禁 / 回滚策略`
- `小类+年月+公共月序列`
- `R-CLS-YM-MSEQ`
- `R-CIP-MSEQ`
- `R-IT-SEQ`
- `R-SVR-SEQ`
- `R-SPARE-SEQ`
- `R-TEMP-SEQ`
- `SESMT2026060001`
- `SESMT2026060002`
- `SESMT2026060003`
- `SESMT2026060004`
- `CIP2026060005`
- `CIP2026060006`
- `历史锁号重复`
- `手工改号冲突`
- `资产小类缺失`
- `已核销批次只读`
- `数量折行已配置`
- `回滚方案已编写`
- `试算样本通过`
- `已生成资产保留旧编号，新规则仅影响发布后批次。`

Exact wording rules:
- Use `数量折行`, never `数量拆行`.
- Use `序列位数`, never `序位位数`.
- Use `预览不占号`, never `预留不占号`.
- Use `历史锁号重复`, never `历史号重复`.
- Use `冲突检测队列（共 1 项待处理）` with the full parenthetical text.

Visual density rules:
- Use dense B2B backend typography: 11-12px table text, 13px labels, compact 28-32px form controls.
- White panels, pale blue active list card, thin #d6e3f3 borders, bright #1677ff primary buttons, green status chips, orange warning chips.
- Border radius must stay small, about 4-6px.
- Match the source spacing and do not add decorative cards, shadows, gradients, or marketing layout.

Final browser self-check:
- At a real 1586 x 992 screenshot, `SESMT2026060006`, all four conflict rows, `发布门禁 / 回滚策略`, `数量折行已配置`, `回滚方案已编写`, and the orange warning are visible without scrolling.
- The center table has six visible rows and does not collapse into vertical stacked text.
- The page looks like the uploaded IMAGE2 screenshot, not a redesigned admin template.
