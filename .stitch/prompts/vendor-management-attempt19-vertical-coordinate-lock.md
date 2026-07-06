Refine the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected screen `6bab67c5a3524c73b002a269c2d64ed6` has the correct source-like structure, but its vertical scale is wrong.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Critical failure to repair:
- Current candidate made the page 1526px tall.
- Current candidate placed `交易反查台` at y≈1165 and `供应商引用矩阵` at y≈1163.
- Source image places `交易反查台` at y≈626 and `供应商引用矩阵` at y≈626.
- Fix by compressing and repositioning vertical sections to the exact 992px source frame. Do not keep a long page.

Hard viewport rules:
- `html`, `body`, and the root app container must be width 1586px and height 992px.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No page scroll, no internal scrollbars, no content below y=992.
- Do not rely on `overflow:hidden` to hide required content. All required content must be visible.

Preserve from selected screen:
- Correct source-like top shell, left sidebar, `供应商分类` vertical card column, center supplier table, right detail rail, transaction table, and supplier matrix.
- No horizontal KPI-card row. Keep the vertical supplier category column.
- No `UNIVIEW`.
- Keep all business data exactly.

Absolute source Y coordinates:
- Top shell: y=0..50.
- Left sidebar begins y=50.
- Supplier category title: y≈68.
- Supplier category cards:
  - `认证供应商` card y≈120..225.
  - `非长期供应商` card y≈240..345.
  - `维保供应商` card y≈360..465.
  - `停用/黑名单` card y≈485..590.
- Main title `供应商档案与交易反查`: y≈70.
- Action buttons: y≈70..105.
- Status bar: y≈157..201.
- Supplier table/filter card: y≈222..624.
- Bottom transaction band: y≈626..958.
- Right rail:
  - details form y≈68..490.
  - `风险提示` y≈516..616.
  - `发布门禁` y≈630..895.

Absolute source X coordinates:
- Left sidebar x=0..186.
- Supplier category column x=202..397.
- Main center x=428..1326.
- Right rail x=1344..1586.
- Bottom `交易反查台` x=202..970.
- Bottom `供应商引用矩阵` x=996..1326.

Compression requirements:
- Center supplier table must fit four rows and footer within y=222..624.
- Bottom transaction table must fit six rows and footer within y=626..958.
- Use compact 11px-12px row text and 26px-30px table rows where required.
- Do not wrap transaction ids into two lines.
- `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`, `共 6 条`, and bottom pagination must be visible above y=958.
- `供应商引用矩阵` values `45` and `126` must be visible above y=900 and right edge <= x=1326.
- `发布门禁`, `审计策略`, and `待完善` must be visible above y=895 in the right rail.

Required strings present:
- `供应商分类`
- `供应商档案与交易反查`
- `交易反查台`
- `供应商引用矩阵`
- `CT-CIP-2026-09`
- `PO-2026-0318`
- `WO-SSE-2307`
- `REIM-8842`
- `INV-2026-0318-07`
- `JE-2026-0318-07`
- `合同.pdf`
- `PO.pdf`
- `工单.pdf`
- `报销单.pdf`
- `发票.pdf`
- `入账单.pdf`
- `数据截止：2026-05-15 09:51:22`
- `供应商详情`
- `风险提示`
- `发布门禁`
- `审计策略`
- `待完善`

Forbidden strings absent:
- `UNIVIEW`
- `数据截止: 2026-05-15 09:51:22`
