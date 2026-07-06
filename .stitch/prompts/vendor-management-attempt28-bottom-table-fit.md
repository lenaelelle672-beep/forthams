Repair the selected generated DESIGN screen `28d3607929e54541b8ba5df7e6a8bad4` against the IMAGE2 source `master-data-subpage-04-vendor-management-v2.png`.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot is the only source of truth.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.
Return a persistent DESIGN screen with full HTML. Do not return DOM operations only.

Preserve the successful gates from the current selected candidate:
- Exact 1586 x 992 document/body frame.
- No page-level scroll.
- Four source columns remain fixed: left nav x=0..186, supplier category x=186..382, main workspace x=382..1326, right detail rail x=1326..1586.
- Right rail is visible inside x<=1586.
- Matrix values `45` and `126` remain in the main workspace with right edge <=1326.
- Keep exact fullwidth timestamp `数据截止：2026-05-15 09:51:22`.
- Keep no `UNIVIEW` text.

Only repair these failing parts:

1. Bottom `交易反查台` card:
- Remove the internal `overflow-auto` table scroller.
- Show all six transaction rows within the card and above y=958:
  `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`.
- Show all evidence links within the same card and above y=958:
  `合同.pdf`, `PO.pdf`, `工单.pdf`, `报销单.pdf`, `发票.pdf`, `入账单.pdf`.
- Make the bottom card compact: 11px body text, 22-24px row height, 30px header, 28px tab bar, 28px footer.
- Do not stack transaction codes vertically. Codes must be horizontal and readable.
- Keep `共 6 条` and `20 条/页` visible inside the card footer.

2. Right rail `发布门禁` card:
- Remove the internal `overflow-auto` area.
- Keep `发布门禁`, `审计策略`, and `待完善` visible inside x=1326..1586 and y<930.
- Reduce row height/padding only inside this card if needed.
- Do not move right rail outside x<=1586.

3. Strict no-scroll requirements:
- No real internal scrollers anywhere in the page.
- No `overflow-auto`, `overflow-y-auto`, or scrollable content regions that hide source-visible rows.
- Do not increase document/body height or width.

Do not alter the already-correct top shell, supplier category list, main supplier table, matrix x-position, right rail form values, or source brand lockup. This is a narrow bottom-fit repair.
