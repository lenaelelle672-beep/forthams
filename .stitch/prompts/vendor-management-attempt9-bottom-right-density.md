Edit the selected supplier management screen into a fresh complete DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use a generic admin template.
Do not change business data.
Return a fresh complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-04-vendor-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-vendor-management

Preserve the exact top-left IMAGE2 brand mark for this source screenshot: the source shows the blue-square icon plus white `固定资产管理系统` text. Do not insert `UNIVIEW`. Do not redraw, distort, split, re-space, or replace the source brand lockup.

Frame and scroll contract:
- Fixed document size: exactly 1586 x 992 CSS pixels.
- No page-level scroll: documentElement.scrollWidth=1586 and scrollHeight=992.
- No internal `overflow-y-auto`, `overflow-auto`, scrollbars, or hidden clipped required rows in tables/panels.
- Fit visible content by using source-density 12px-14px text and compact row heights, not by hiding content.

Keep attempt 8 strengths:
- Correct dark top shell and sidebar.
- Left `供应商分类` cards visible.
- Center supplier table visible with four rows.
- Right `供应商详情` rail visible.
- Bottom `交易反查台`, `供应商引用矩阵`, and `发布门禁` areas present.

Repair attempt 8 failures:
- `交易反查台` must show all 6 source rows inside the visible bottom-left card:
  1. `CT-CIP-2026-09`
  2. `PO-2026-0318`
  3. `WO-SSE-2307`
  4. `REIM-8842`
  5. `INV-2026-0318-07`
  6. `JE-2026-0318-07`
- `交易反查台` footer `共 6 条`, pagination, and `20 条/页` must be inside the card and visible.
- `供应商引用矩阵` footer `数据截止：2026-05-15 09:51:22` must be visible inside the matrix card.
- The right `供应商详情` rail must not clip form values. All source fields must be visible through `审计策略`.
- The right `风险提示` block and `发布门禁（6/7 通过）` checklist must be fully visible. All seven checklist rows must be visible: `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略`.
- The right rail must not overlay the center `供应商引用矩阵`.

Source coordinate map:
- Top nav: y=0..50.
- Sidebar: x=0..187, y=50..992.
- Left supplier category column: x=202..397, y=52..624.
- Main title/action/status/filter/table area: x=427..1327.
- Right detail rail: x=1343..1585, y=50..992.
- Main title/action row: y=68..145.
- Status strip: y=158..203.
- Filter row: y=221..283.
- Supplier table card: x=427..1327, y=221..607. It must not extend below y=607.
- Bottom row starts at y=626 and ends by y=957.
  - `交易反查台`: x=202..984, y=626..957.
  - `供应商引用矩阵`: x=994..1326, y=626..957.
- Right rail:
  - Detail form: y=70..512.
  - `风险提示`: y=517..618.
  - `发布门禁（6/7 通过）`: y=630..890.

Specific table density:
- Supplier table row height <= 55px; four rows and footer must fit by y<=607.
- Transaction table row height <= 31px; six rows and footer must fit by y<=957.
- Matrix grid must fit 2 rows x 3 columns plus footer; no scroll.
- Do not wrap transaction row ids into vertical text. `INV-2026-0318-07` and `JE-2026-0318-07` must be normal horizontal text.

Required visible text:
- Header/buttons: `供应商档案与交易反查`, `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.
- Category cards: `认证供应商`, `72`, `非长期供应商`, `18`, `维保供应商`, `11`, `停用/黑名单`, `3`.
- Supplier table: `宇视认证供应商 A`, `SUP-A-0001`, `临时采购供应商 B`, `SUP-B-0321`, `SSE 维保供应商 C`, `SUP-C-0009`, `CIP 设备维保备用供应商`, `SUP-D-0198`.
- Bottom transaction and matrix titles: `交易反查台`, `供应商引用矩阵`, `下载取证包`.
- Transaction values: `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`.
- Matrix values: `12`, `38`, `45`, `23`, `67`, `126`, `数据截止：2026-05-15 09:51:22`.
- Right rail: `供应商详情`, `风险提示`, `发布门禁（6/7 通过）`, `审计策略`, `待完善`.

Forbidden patterns:
- Do not hide required bottom rows behind an internal table scroll.
- Do not push `INV-2026-0318-07`, `JE-2026-0318-07`, or `数据截止：2026-05-15 09:51:22` below the viewport.
- Do not make the right rail wider than the source or cover the matrix.
- Do not replace the source brand with `UNIVIEW`.
