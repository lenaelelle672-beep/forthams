Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, emoji icons, or a different brand lockup.

Page name: 编号规则
Visible title: 资产编号规则配置台
Menu id: system-numbering-rules
Reference image: master-data-subpage-02-numbering-rules-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-02-numbering-rules-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-numbering-rules
Canvas: 1586 x 992 desktop. The browser document must be exactly 1586 x 992 with no page scroll.

Generate a new persistent DESIGN screen, not a temporary DOM operation. The exported HTML must contain the final corrected layout.

Critical source geometry:
- Top shell: y=0..50, dark navy. UNIVIEW brand at x=14..176. 系统运营中枢 top tab active.
- Left sidebar: x=0..207, light system settings sidebar. 基础资料 expanded, 编号规则 active.
- Content frame: x=226..1576, y=70..962.
- Header/action band: y=70..168. Title `资产编号规则配置台`; buttons `新建编号规则`, `试算编号`, `冲突检测`, `保存草稿`, `提交校验`; status strip `当前草稿已保存`, `试算样本 3 条`, `冲突检测 1 项待处理`.
- Filter row: y=187..219. Fields `规则名称`, `业务对象`, `序列口径`, `状态`, `影响范围`; buttons `查询`, `重置`.
- Main three-column workspace starts y=232:
  - Left list `编号规则列表`: x=226..440, y=232..761. It must show seven rules and bottom `展开全部`.
  - Center content: x=449..1207, y=232..924. It has three vertical zones, all visible:
    1. `编号规则明细表` y=232..526, six horizontal rows.
    2. `编号试算预览` y=538..760, with input sample table, arrow, trial result table, and `规则预览说明`.
    3. `冲突检测队列（共 1 项待处理）` y=773..924, with four horizontal conflict rows.
  - Right editor: x=1217..1576, y=232..932. It has `编号规则属性编辑区`, all form fields, action buttons, and `发布门禁 / 回滚策略`.

Hard repair rules from previous failed attempts:
- No internal scroll containers in the center column, preview result, conflict table, or right editor. The source screenshot shows these areas in one fixed frame.
- Do not push `编号试算预览` or `冲突检测队列（共 1 项待处理）` below the viewport.
- Do not lowercase `UNIVIEW` and do not add a generic icon before it.
- Keep all table cells horizontal. Do not wrap each value into stacked/vertical text.
- The main table must include all six source rows and exact visible strings: `SESMT2026060001`, `SESMT2026060002`, `SESMT2026060003`, `SESMT2026060004`, `CIP2026060005`, `CIP2026060006`.
- Preserve source wording exactly: `数量折行`, `序列位数`, `预览不占号`, `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`, `数量折行已配置`, `回滚方案已编写`.
- Do not generate previous wrong strings: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.
- If vertical space is tight, reduce font size to 11-12px and row height to source density; never add scrollbars or hide lower panels.

Final self-check before returning:
- documentElement.scrollWidth == 1586 and scrollHeight == 992.
- `编号规则明细表`, `编号试算预览`, and `冲突检测队列（共 1 项待处理）` are all visible.
- `发布门禁 / 回滚策略`, `数量折行已配置`, and `回滚方案已编写` are visible in the right panel.
- `数量拆行` is absent.
- The result looks like a direct HTML transcription of the screenshot, not a generic admin template.
