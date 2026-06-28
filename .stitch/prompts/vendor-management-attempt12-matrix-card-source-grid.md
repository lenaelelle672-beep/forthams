Edit the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
Attempt11 is only a repair baseline because it already matches the source in most regions; do not use it as a visual source if it conflicts with the IMAGE2 v2 screenshot.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a new complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-04-vendor-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-vendor-management
Canvas: exactly 1586 x 992 CSS px.

Preserve the exact top-left IMAGE2 brand mark for this source:
- Blue rounded-square product icon at x≈13 y≈13, 28x28.
- White text `固定资产管理系统`.
- Do not render `UNIVIEW` on this page.
- Do not use generic circular logo marks, exclamation icons, emoji, or disconnected letters.

Preserve attempt11 strengths where they match the source:
- Top shell, selected `系统运营中枢`, left `基础资料 / 供应商管理` active state.
- Header title `供应商档案与交易反查`.
- Top buttons `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.
- Supplier table with four visible suppliers including `宇视认证供应商 A`, `SUP-A-0001`, `CIP 设备维保备用供应商`, `SUP-D-0198`.
- Bottom `交易反查台` table with all six rows visible, including `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`.
- Right rail `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, and final value `待完善` visible.
- No page-level scroll and no real internal scrollbars.

Critical visible failure to fix from attempt11:
- The `供应商引用矩阵` card is clipped/covered by the right rail.
- Values `45` and `126` are currently rendered at x≈1333..1363, crossing into the right rail.
- This is forbidden. The matrix must be a separate source-like card, fully left of the right rail.

Hard geometry contract for the lower-right source card:
- The center/lower matrix card must occupy x=1080..1326, y=613..945.
- The right rail starts at x=1344 and spans y=50..992.
- Keep a visible blank divider gap at x=1327..1343.
- No `供应商引用矩阵` text, number, label, card border, icon, footer, or refresh icon may render beyond x=1326.
- The right rail must never overlay, cover, or clip any matrix content.

Matrix card exact content and layout:
- Header at y≈629: `供应商引用矩阵`.
- Grid: exactly 2 rows x 3 columns, compact like the source screenshot.
- Column 1 x=1098..1166.
- Column 2 x=1184..1248.
- Column 3 x=1264..1318.
- Row 1 y=685..770:
  - Column 1 label `合同引用`, value `12`, subtext `较上月 ↑ 2`.
  - Column 2 label `PO 引用`, value `38`, subtext `较上月 ↑ 5`.
  - Column 3 label `维保工单`, value `45`, subtext `较上月 ↑ 3`.
- Row 2 y=805..890:
  - Column 1 label `报销记录`, value `23`, subtext `较上月 ↑ 1`.
  - Column 2 label `发票入账`, value `67`, subtext `较上月 ↑ 6`.
  - Column 3 label `历史留痕`, value `126`, subtext `较上月 ↑ 8`.
- Footer at y≈925: `数据截止：2026-05-15 09:51:22`.
- The right edge of value `45` and value `126` must be <= 1318.

Right rail geometry:
- Bounds x=1344..1586.
- It may be compact, but all source-visible groups must remain visible:
  `供应商详情`, `风险提示`, `发布门禁`, `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略`, `待完善`.
- Do not add internal scrolling to the right rail.
- Do not cover the center matrix or transaction table.

Self-check before returning:
- Browser viewport 1586 x 992.
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- No real internal scrollbars.
- Required visible text exists: `供应商档案与交易反查`, `供应商引用矩阵`, `交易反查台`, `INV-2026-0318-07`, `JE-2026-0318-07`, `数据截止：2026-05-15 09:51:22`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden text absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
- Screenshot visibly shows all six matrix values `12`, `38`, `45`, `23`, `67`, `126` inside the `供应商引用矩阵` card, left of the right rail.
