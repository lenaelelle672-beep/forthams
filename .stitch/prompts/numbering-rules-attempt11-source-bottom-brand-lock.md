Edit the selected uploaded IMAGE2 v2 source screenshot into a new Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not use a generic admin template.
Do not use any previous Stitch draft as the visual source.
Do not change business data.

Page: 资产编号规则配置台
Menu id: system-numbering-rules
Reference image: master-data-subpage-02-numbering-rules-v2.png
Canvas: exactly 1586 x 992 CSS pixels. No document scroll. No internal scroll.

Non-negotiable brand rule:
- The source top-left brand is white uppercase `UNIVIEW` with the source divider and adjacent `固定资产管理系统`.
- Do not lowercase it. Do not render `uniview`. Do not add a generic cube/icon before the wordmark.

Source layout y-budget:
- Header title/actions/status/filter together must finish by y=220.
- Main workspace starts y=232.
- Left `编号规则列表`: y=232..761.
- Center `编号规则明细表`: y=232..526, six rows visible, compact row height.
- Center `编号试算预览`: y=538..760, input sample, arrow, trial result, and preview note visible.
- Center `冲突检测队列（共 1 项待处理）`: y=773..924, all four conflict rows visible.
- Right `编号规则属性编辑区`: y=232..724, compact form fields and three action buttons visible.
- Right `发布门禁 / 回滚策略`: y=737..932, all checklist rows and orange warning visible.

Repair the known failed candidate pattern:
- Do not make the main table rows so tall that only 2 rows show.
- Do not make `编号试算预览` consume the whole bottom half.
- Do not move `冲突检测队列` below y=924.
- Do not hide `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`, `数量折行已配置`, `回滚方案已编写`, or `试算样本通过`.
- Do not use scroll containers or `overflow:auto`/`overflow-y:auto` for center or right panels.

Exact source text:
- Required visible strings: `资产编号规则配置台`, `编号规则列表`, `编号规则明细表`, `编号试算预览`, `冲突检测队列（共 1 项待处理）`, `发布门禁 / 回滚策略`.
- Required visible values: `小类+年月+公共月序列`, `R-CLS-YM-MSEQ`, `SESMT2026060001`, `SESMT2026060002`, `SESMT2026060003`, `SESMT2026060004`, `CIP2026060005`, `CIP2026060006`.
- Required visible checklist/conflict strings: `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`, `数量折行已配置`, `回滚方案已编写`, `试算样本通过`.
- Use exact source wording `数量折行`, `序列位数`, `预览不占号`.
- Forbidden wrong strings: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Density rules:
- Use 11-12px dense Chinese table text where needed.
- Keep table and checklist text horizontal.
- Prefer narrower columns and smaller row height over wrapping or hiding.
- Keep source-like white/blue-gray panels, thin borders, blue buttons, green/orange status chips, 8px or smaller radius.

Final self-check:
- In a real 1586 x 992 browser screenshot, `冲突检测队列（共 1 项待处理）` and all four conflict rows are visible.
- `发布门禁 / 回滚策略`, `数量折行已配置`, and `回滚方案已编写` are visible.
- `UNIVIEW` is uppercase and source-faithful.
- The page visually matches the IMAGE2 screenshot, not a generic dashboard.
