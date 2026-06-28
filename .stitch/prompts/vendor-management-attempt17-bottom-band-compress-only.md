Refine the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected screen `9c2dae32ee9e4e5b83bdf7e141f44f97` is only the current candidate baseline.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Canvas: exactly 1586 x 992 CSS px.

Preserve from the selected baseline:
- Top-left brand: blue rounded-square product icon plus white `固定资产管理系统`.
- No `UNIVIEW`.
- Top nav active `系统运营中枢`.
- Left sidebar active `基础资料 / 供应商管理`.
- Header title, KPI cards, alert strip, filter bar, supplier table, and right rail content.
- The corrected `供应商引用矩阵` position: it is bottom-center, between the transaction table and right rail, not inside the right rail.
- Matrix values stay left of x=1326: `12`, `38`, `45`, `23`, `67`, `126`.

Critical repair: bottom band vertical compression only.
- Current candidate failure: the bottom `交易反查台` card has internal scrolling and clips the final rows at the viewport bottom.
- Remove all internal scrollbars from the page.
- The outer document and body must be exactly 1586 x 992, with no page scroll.
- The bottom band must fit entirely inside y=642..982.
- The `交易反查台` card must show all six rows fully inside y<=945, with footer/pagination fully inside y<=970.
- No cell, link, row text, or footer may touch or pass y=982.

Exact bottom band target geometry:
- `交易反查台` card: x=202..970, y=642..982, no internal scrollbar.
- `供应商引用矩阵` card: x=996..1326, y=642..982, no internal scrollbar.
- Right rail remains x=1344..1586 and must not overlap the bottom center matrix.

Transaction table must be compact like the source:
- Header row height about 30px.
- Body row height about 30px.
- Six body rows visible, no clipping, no scroll.
- Use 11px-12px compact Chinese table text if needed.
- Reduce padding, row gaps, card title height, and footer height as needed.
- Do not wrap the order ids into multiple visual lines.
- Keep evidence links visible in the same row.

Rows visible in order:
1. `CT-CIP-2026-09` with `合同.pdf`
2. `PO-2026-0318` with `PO.pdf`
3. `WO-SSE-2307` with `工单.pdf`
4. `REIM-8842` with `报销单.pdf`
5. `INV-2026-0318-07` with `发票.pdf`
6. `JE-2026-0318-07` with `入账单.pdf`

Footer visible:
- `共 6 条`
- `20 条/页`
- page `1`
- `前往 1 页`

Matrix content remains:
- Row 1: `合同引用` value `12`, `PO 引用` value `38`, `维保工单` value `45`.
- Row 2: `报销记录` value `23`, `发票入账` value `67`, `历史留痕` value `126`.
- Footer `数据截止：2026-05-15 09:51:22`.
- Values `45` and `126` must have visual right edge <= x=1326.

Final self-check before returning:
- Browser viewport 1586 x 992.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No element with `overflow:auto` or `overflow:scroll` may have `scrollHeight > clientHeight` or `scrollWidth > clientWidth`.
- Required strings present: `供应商档案与交易反查`, `交易反查台`, `供应商引用矩阵`, `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`, `数据截止：2026-05-15 09:51:22`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
