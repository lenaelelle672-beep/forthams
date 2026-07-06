Edit the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected attempt11 DESIGN screen is only the repair baseline. Keep its matching shell/table/right-rail geometry, but fix the matrix clipping.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a new complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Canvas: exactly 1586 x 992 CSS px.

Very narrow repair scope:
- Preserve the selected screen's global shell, left navigation, category cards, title area, supplier table, bottom transaction table, and right rail.
- Preserve document/body width and height. Browser must remain exactly 1586 x 992 with no page scroll.
- Do NOT move the right rail.
- Do NOT widen the body.
- Do NOT rebuild the full layout.
- Do NOT move the matrix offscreen.
- Only compress the internal `供应商引用矩阵` card so its full 2x3 grid fits before the right rail.

Current baseline facts to preserve:
- Top-left brand is the source blue square icon plus `固定资产管理系统`; no `UNIVIEW`.
- `交易反查台` shows all six rows including `INV-2026-0318-07` and `JE-2026-0318-07`.
- Right rail shows `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, `待完善`.
- No real internal scrollbars.

Required matrix repair:
- The matrix card must stay in the lower-right area between the transaction table and right rail.
- Its visual right edge must be <= x=1326.
- Change the matrix card to a compact width around 246px, not 332px.
- Use a compact 3-column grid:
  - Total grid width <= 222px.
  - Each column width about 68-72px.
  - Column gap 4-6px.
  - Padding 10-12px.
  - Value font size 18-20px, not oversized.
  - Label font size 10-11px.
  - Subtext font size 10px.
- The title `供应商引用矩阵` and footer `数据截止：2026-05-15 09:51:22` must remain visible inside the card.
- The footer can use 10px text and stay on one line.

Matrix values must be visible inside the card, left of the right rail:
- Row 1: `合同引用` value `12`, `PO 引用` value `38`, `维保工单` value `45`.
- Row 2: `报销记录` value `23`, `发票入账` value `67`, `历史留痕` value `126`.
- The right edge of values `45` and `126` must be <= x=1326.

Keep right rail unchanged and visible:
- Right rail begins at x≈1343 and must not overlap the matrix.
- Keep all visible groups: `供应商详情`, `风险提示`, `发布门禁`.
- Keep rows: `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略`.
- Final value `待完善` remains visible.

Final self-check before returning:
- Browser viewport 1586 x 992.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No real internal scrollbars.
- Required strings present: `供应商档案与交易反查`, `交易反查台`, `INV-2026-0318-07`, `JE-2026-0318-07`, `供应商引用矩阵`, `数据截止：2026-05-15 09:51:22`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
