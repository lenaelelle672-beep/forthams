Edit the selected vendor management DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` remains the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use a generic admin template.
Do not change business data.
Return a fresh complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Canvas: exactly 1586 x 992 CSS pixels.

Preserve attempt 9 strengths:
- Source-like blue-square top-left brand icon plus white `固定资产管理系统`.
- No `UNIVIEW` text.
- No page-level scroll; document/body must remain 1586 x 992.
- No real internal scrollbars.
- Keep the left category cards, supplier table, right detail rail, risk block, publish gate, and six-row `交易反查台` visible.
- Keep transaction ids `INV-2026-0318-07` and `JE-2026-0318-07` as horizontal text.

Narrow repair only:
- The right-bottom `供应商引用矩阵` is currently squeezed/partly hidden by the right rail. Repair it to match the source:
  - Matrix card x=994..1326, y=626..957, never under the right rail.
  - Right detail rail starts at x=1343 and must not overlap matrix content.
  - Matrix title: `供应商引用矩阵`.
  - Matrix grid is 2 rows x 3 columns and all six values are visible:
    - Row 1: `合同引用` value `12`, `PO 引用` value `38`, `维保工单` value `45`.
    - Row 2: `报销记录` value `23`, `发票入账` value `67`, `历史留痕` value `126`.
  - Matrix footer must use exact full-width punctuation: `数据截止：2026-05-15 09:51:22`.
  - Footer must be visible inside the card above y=947.

Right rail must remain fully visible:
- Right rail x=1343..1585, y=50..992.
- Keep `供应商详情`, `风险提示`, and the publish gate visible.
- Title can match source style: `发布门禁` with small `（6/7 通过）` count aligned on the same header row, or exact combined text `发布门禁（6/7 通过）`.
- Seven publish rows visible: `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略`.
- Final row `审计策略` value `待完善` remains visible above the viewport bottom.

Do not regress these required source text strings:
- `供应商档案与交易反查`
- `宇视认证供应商 A`
- `SUP-A-0001`
- `CIP 设备维保备用供应商`
- `SUP-D-0198`
- `交易反查台`
- `INV-2026-0318-07`
- `JE-2026-0318-07`
- `发票.pdf`
- `入账单.pdf`
- `供应商引用矩阵`
- `数据截止：2026-05-15 09:51:22`
- `风险提示`
- `发布门禁`
- `审计策略`
- `待完善`

Forbidden regressions:
- Do not move the right rail on top of the matrix card.
- Do not hide the `45` or `126` matrix values.
- Do not use ASCII colon in `数据截止：2026-05-15 09:51:22`.
- Do not remove the six transaction rows.
- Do not add page scroll or internal scrollbars.
- Do not change the top-left brand back to a circular warning/exclamation icon.
