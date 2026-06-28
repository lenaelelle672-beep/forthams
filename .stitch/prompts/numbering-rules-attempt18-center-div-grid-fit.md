Repair only the CENTER WORKSPACE of the selected generated DESIGN screen.

Source: `master-data-subpage-02-numbering-rules-v2.png`.
Keep the existing shell, sidebar, header, filter row, left rule list, and right editor/release checklist exactly as they are in the current candidate.
Generate a new persistent Stitch DESIGN/HTML screen. Do not return DOM operations only.

Current issue:
- The center table still visually uses too much row height; only four of six detail rows fit.
- The trial result final row `CIP2026060006` is below the viewport at y≈1076.
- The right release checklist is already good; do not move it.

Center workspace x=448..1208 y=247..952 must be rebuilt as compact fixed div-grids, not native table rows if native tables force tall rows.

1. Detail grid card y=247..492.
- Use a div-based grid that visually looks like the source table.
- Title `编号规则明细表`.
- Header y=296..320, six data rows y=322..478.
- Row height exactly about 25px.
- Font 10px to 11px.
- All six rows visible:
  `小类+年月+公共月序列`
  `CIP转固公共月序列`
  `IT设备编号`
  `服务器编号`
  `备件编码`
  `临时资产编号`
- Required visible codes: `R-CLS-YM-MSEQ`, `R-CIP-MSEQ`, `R-IT-SEQ`, `R-SVR-SEQ`, `R-SPARE-SEQ`, `R-TEMP-SEQ`.
- Header `数量折行` must be one horizontal label, not wrapped or vertical.
- Put pagination in the top-right of this card footer, y=470..490.

2. Trial preview card y=504..726.
- Title `编号试算预览`.
- Use a three-block layout like the source: left input sample, middle result grid, right blue explanation.
- Use compact div-grid rows, not native table if that expands.
- Result grid rows y=572..714, each 20px or less.
- All six generated numbers visible inside the middle block:
  `SESMT2026060001`
  `SESMT2026060002`
  `SESMT2026060003`
  `SESMT2026060004`
  `CIP2026060005`
  `CIP2026060006`
- If space is tight, show asset name and generated number only; keeping the generated number visible is mandatory.

3. Conflict queue card y=738..952.
- Keep title exactly one visual line: `冲突检测队列（共 1 项待处理）`.
- Four div-grid rows, each max 31px:
  `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`.
- Keep action links visible.

Global center constraints:
- No `overflow-y-auto`, no `overflow-auto`, no `max-h-[...]`, no clipped hidden content for required center data.
- No vertical text.
- Do not enlarge document height beyond 992.
- Do not touch the right rail or left rule list.

Text precision:
- Status strip should visually read `试算样本 3 条` and `冲突检测 1 项待处理`.
- Keep exact `数量折行`, `序列位数`, `预览不占号`.
- Forbidden: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final self-check:
- A real 1586 x 992 screenshot must show six detail rows, all six generated values including `CIP2026060006`, the conflict queue title, all four conflict rows, and the right release checklist simultaneously.
