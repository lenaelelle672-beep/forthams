Edit the selected uploaded IMAGE2 v2 supplier-management reference into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return DOM operations only.

Canvas and shell:
- Exact canvas/document/body: 1586 x 992 CSS pixels.
- No page scroll.
- No internal scrollbars.
- No content may render beyond x=1586 or y=992.
- Use the IMAGE2 source's top-left brand treatment exactly as visible in this source. Do not insert `UNIVIEW` if the source does not show it.

Use this fixed source grid model:
- Left navigation shell: x=0..186.
- Supplier category column: x=186..382.
- Main content column: x=382..1326.
- Right detail rail: x=1326..1586.
- Body background and borders must match the source white/blue-gray system style.
- Do not create a fifth column or a horizontal canvas wider than 1586.

Required page identity:
- Page/menu: 供应商管理 / `system-vendor-management`.
- Source title area must show `供应商档案与交易反查`.
- Category panel title: `供应商分类`.
- Main lower table title: `交易反查台`.
- Matrix card title: `供应商引用矩阵`.
- Right rail title: `供应商详情`.

Left category column x=186..382:
- Show source-like vertical category list with counts.
- Keep compact rows and visible category cards.
- Do not overlap the main table.

Main content x=382..1326:
- Top title/action/status region y≈56..154.
- Supplier table y≈170..538.
- Lower band y≈560..950.
- Lower band layout:
  - `交易反查台` x≈206..982 relative to source, visually inside the main area; show all six rows:
    `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`.
  - Evidence links visible: `合同.pdf`, `PO.pdf`, `工单.pdf`, `报销单.pdf`, `发票.pdf`, `入账单.pdf`.
  - Footer must show `共 6 条` and `20 条/页`.
  - `供应商引用矩阵` must remain left of the right rail. Matrix values `45` and `126` must have right edge <=1326.
- Include exact data timestamp: `数据截止：2026-05-15 09:51:22` using fullwidth Chinese colon.

Right detail rail x=1326..1586:
- Rebuild this rail inside the 260px width; nothing in this rail may exceed x=1586.
- Header y≈68: `供应商详情`.
- Compact form fields y≈105..500 with labels and values:
  `供应商名称 *` / `宇视认证供应商 A`
  `供应商编码 *` / `SUP-A-0001`
  `认证状态 *` / `已认证`
  `复核周期 *` / `12 个月`
  `交易范围 *` / `安防设备、系统集成`
  `合同PO策略 *` / `需合同/PO 才可下单`
  `维保范围` / `设备维保、系统运维`
  `报销策略` / `按合同额度报销`
  `停用策略` / `停用后禁止新引用`
  `审计策略` / `标准审计策略`
- `风险提示` card y≈520..620:
  `非长期供应商累计 3 次需转认证`
  `合同外服务需审批`
  `停用后历史不删除`
- `发布门禁` card y≈635..900:
  `发布门禁`
  `基本信息 通过`
  `认证材料 通过`
  `合同/PO策略 通过`
  `风险评估 通过`
  `报销策略 通过`
  `历史交易保留 通过`
  `审计策略 待完善`
- `待完善` must be visible inside x=1326..1586 and y<920.

Typography and density:
- Use compact B2B table density from the source, not large dashboard cards.
- Table text must stay horizontal; no vertical stacked table cells.
- Use source-like small 12-14px labels and row heights.
- Avoid emoji and generic placeholder icons.

Hard verification gates:
- Required strings visible: `供应商分类`, `供应商档案与交易反查`, `交易反查台`, `供应商引用矩阵`, `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`, `数据截止：2026-05-15 09:51:22`, `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`, `undefined`, `NaN`, `Lorem`.
- `发布门禁`, `风险提示`, `审计策略`, and `待完善` must all be visible within x<=1586.
- Matrix values `45` and `126` must stay outside the right rail and inside x<=1326.
- Bottom transaction rows including `INV-2026-0318-07` and `JE-2026-0318-07` must be visible above y=958.
