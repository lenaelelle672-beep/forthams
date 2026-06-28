Repair only the CENTER WORKSPACE of the selected generated DESIGN screen.

Source of truth: `master-data-subpage-02-numbering-rules-v2.png`.
This is still a 100/100 pixel-fidelity transcription task. Keep the existing successful shell, sidebar, header, filter row, left rule list, and right editor/release checklist from the current candidate.

Do not return DOM operations only. Generate a new persistent DESIGN/HTML screen.

Current good state to preserve:
- Real viewport is 1586 x 992 with no document scroll.
- Real internal scrollers count is 0.
- No vertical text.
- Right `发布门禁 / 回滚策略` is visible.

Current remaining center failure:
- Center table + preview + conflict queue exceed the visible y budget.
- `CIP2026060006` appears at y around 1130, below the viewport.
- `冲突检测队列（共 1 项待处理）` is split and not visible as a source-like single title.
- The center HTML still includes `overflow-y-auto`; remove it.

Required center-only rebuild:

Center card x=448..1208 y=247..952, no scroll, no overflow-y-auto.

1. Detail table band y=247..498.
- Title `编号规则明细表`.
- Header row height 30px.
- Six data rows, each 28px high maximum.
- The table must stay horizontal and compact. No wrapped multi-line cells except source-like short line breaks if unavoidable.
- Required visible rows:
  `小类+年月+公共月序列`, `CIP转固公共月序列`, `IT设备编号`, `服务器编号`, `备件编码`, `临时资产编号`.
- Required visible columns include `数量折行`, `占号策略`, `状态`, `操作`.
- Put pagination inside this band at y=472..493, not below.

2. Trial preview band y=510..728.
- Title `编号试算预览`.
- Use three compact blocks in one row:
  left `输入样本`, middle `试算结果（分行后效果）`, right `规则预览说明`.
- In the middle result table, make six rows fit inside y=580..720 with 20px row height and 10px font.
- All generated values must be visible:
  `SESMT2026060001`, `SESMT2026060002`, `SESMT2026060003`, `SESMT2026060004`, `CIP2026060005`, `CIP2026060006`.
- Do not let the result table content continue below y=728.

3. Conflict queue band y=740..952.
- Title must visually read on one line:
  `冲突检测队列（共 1 项待处理）`
- Four rows must be visible within the card:
  `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`.
- Row height 32px maximum. Use 10px to 11px text. Keep actions visible.
- Do not place this band over the preview table; it must start after preview ends.

Text precision:
- Status strip should use visually contiguous text `试算样本 3 条` and `冲突检测 1 项待处理`.
- Keep exact `数量折行`, `序列位数`, `预览不占号`.
- Forbidden strings: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

HTML/CSS constraints:
- Remove `overflow-y-auto`, `overflow-auto`, and `max-h-[...]` classes from source-visible center/right content.
- Do not use hidden overflow to fake passing; all required text must have bounding boxes inside the 1586 x 992 viewport.
- Do not move the right editor or release checklist.

Final self-check:
- In a 1586 x 992 browser screenshot, `CIP2026060006`, the conflict title, all four conflict rows, and the right release checklist are visible simultaneously.
