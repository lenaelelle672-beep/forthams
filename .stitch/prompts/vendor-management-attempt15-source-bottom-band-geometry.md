Create a fresh persistent complete DESIGN/HTML screen from the selected vendor management candidate.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected candidate is only a content/brand baseline. If it conflicts with the source screenshot geometry, follow the IMAGE2 v2 screenshot.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Canvas: exactly 1586 x 992 CSS px.

Preserve these successful baseline facts:
- Top-left brand is a blue rounded-square product icon plus white `固定资产管理系统`.
- No `UNIVIEW`.
- Top nav active `系统运营中枢`.
- Left sidebar active `基础资料 / 供应商管理`.
- Title `供应商档案与交易反查`.
- Four supplier rows visible.
- Right `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, `待完善` visible.
- No page scroll and no real internal scrollbars.

Critical source geometry repair:
- The selected baseline incorrectly places `供应商引用矩阵` inside the far-right rail at x≈1356..1516.
- The IMAGE2 source places `供应商引用矩阵` in the bottom center, LEFT OF the right rail.
- Move the entire `供应商引用矩阵` card left of the right rail.
- Do not leave any matrix value inside x>=1344.

Source bottom band layout:
- Bottom band starts around y=626 and ends around y=982.
- `交易反查台` card:
  - x=202..970, y=626..982.
  - Shows six compact rows including `INV-2026-0318-07` and `JE-2026-0318-07`.
  - It must not extend under the matrix.
- `供应商引用矩阵` card:
  - x=996..1326, y=626..957.
  - width about 325-330px.
  - title `供应商引用矩阵`.
  - exact 2 rows x 3 columns.
  - all six values visible and left of x=1326.
  - footer `数据截止：2026-05-15 09:51:22` visible inside the card near y=935.
- Right rail:
  - x=1344..1586, y=50..992.
  - Contains `供应商详情`, `风险提示`, and `发布门禁`.
  - It must not contain the `供应商引用矩阵` card.
  - It must not overlay x<1344.

Matrix content:
- Row 1: `合同引用` value `12`, `PO 引用` value `38`, `维保工单` value `45`.
- Row 2: `报销记录` value `23`, `发票入账` value `67`, `历史留痕` value `126`.
- Required coordinate check: values `45` and `126` must have visual right edge <= x=1326.

Transaction table content:
- rows visible in order:
  `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`.
- evidence links visible: `合同.pdf`, `PO.pdf`, `工单.pdf`, `报销单.pdf`, `发票.pdf`, `入账单.pdf`.
- footer `共 6 条`, `20 条/页`, page `1` visible.

Final self-check before returning:
- Browser viewport 1586 x 992.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No real internal scrollbars.
- Required strings present: `供应商档案与交易反查`, `交易反查台`, `供应商引用矩阵`, `INV-2026-0318-07`, `JE-2026-0318-07`, `数据截止：2026-05-15 09:51:22`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
- The matrix card is visibly between the transaction table and the right rail, not inside the right rail.
