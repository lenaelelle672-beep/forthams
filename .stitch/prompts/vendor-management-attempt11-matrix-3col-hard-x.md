Edit the selected vendor management DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` remains the only source of truth.
Any visible mismatch loses points.
Do not redesign or change business data.
Return a fresh complete DESIGN screen with full HTML. Do not return only DOM operations.

Page: 供应商档案与交易反查
Canvas: exactly 1586 x 992 CSS px.

Preserve all attempt10 strengths:
- Blue-square source brand + white `固定资产管理系统`, no `UNIVIEW`.
- No page scroll, no internal scrollbars.
- Six `交易反查台` rows visible.
- Right rail `供应商详情`, `风险提示`, and `发布门禁` visible.
- Exact full-width footer `数据截止：2026-05-15 09:51:22`.

Critical failure to fix:
- In attempt10, the matrix values `45` and `126` existed but rendered at x≈1380, inside the right rail area. That is a visible failure.
- The `供应商引用矩阵` card must show 3 columns fully inside the center matrix card, not under or behind the right rail.

Hard x-coordinate contract:
- Main content right edge before rail: x=1326.
- Gap between matrix and right rail: x=1327..1342.
- Right rail starts at x=1343 exactly.
- No matrix title, label, number, footer, border, or icon may render at x > 1326.
- Values `45` and `126` must render inside x=1248..1315, never beyond x=1326.

Matrix card exact layout:
- Card bounds: x=994 y=626 w=332 h=331, right edge x=1326.
- Header: y=641, title `供应商引用矩阵`.
- Grid starts y=682. Use exactly 3 equal columns, each 104px wide, with 10px internal gap:
  - Column 1 x=1010..1104
  - Column 2 x=1118..1212
  - Column 3 x=1226..1320
- Row 1:
  - `合同引用` value `12` in column 1.
  - `PO 引用` value `38` in column 2.
  - `维保工单` value `45` in column 3.
- Row 2:
  - `报销记录` value `23` in column 1.
  - `发票入账` value `67` in column 2.
  - `历史留痕` value `126` in column 3.
- Footer: `数据截止：2026-05-15 09:51:22` at x=1010..1304, y≈922..936.

Right rail:
- Bounds: x=1343 y=50 w=243 h=942.
- It must not cover the matrix. No z-index overlay over x<1343.
- Keep the publish gate rows visible:
  `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略`, final value `待完善`.

Do not regress:
- `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`.
- `宇视认证供应商 A`, `SUP-A-0001`, `CIP 设备维保备用供应商`, `SUP-D-0198`.
- `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, `待完善`.

Final self-check before returning:
- Browser viewport 1586 x 992.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- No real internal scrollbars.
- The screenshot visibly shows all six matrix numbers: `12`, `38`, `45`, `23`, `67`, `126` inside the `供应商引用矩阵` card, left of the right rail.
