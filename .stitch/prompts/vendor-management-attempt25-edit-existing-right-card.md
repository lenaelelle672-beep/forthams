Edit the selected generated DESIGN screen into a new persistent Stitch DESIGN/HTML screen.
Do not return DOM operations only.

This is a narrow repair for the existing visible right-side white card titled `供应商详情`.
Do not create a second right rail. Do not create content outside the viewport.
Do not change the top shell, sidebar, supplier category column, center table, bottom transaction table, or `供应商引用矩阵`.

Current good layout to preserve:
- `供应商分类` is a vertical column on the left of the workbench.
- `交易反查台` has all 6 rows visible.
- `供应商引用矩阵` is in the bottom middle area, left of the right rail.
- The existing visible right card title `供应商详情` is already at the correct right edge. Keep that card's x/y/width.
- Keep viewport/document exactly 1586 x 992.
- No page scroll and no internal scrollbars.

Only modify the inside of the existing visible `供应商详情` card:

1. Keep the form at the top but make it compact:
   - `供应商名称 *` `宇视认证供应商 A`
   - `供应商编码 *` `SUP-A-0001`
   - `认证状态 *` `已认证`
   - `复核周期 *` `12 个月`
   - `交易范围 *` `安防设备、系统集成`
   - `合同PO策略 *` `需合同/PO 才可下单`
   - `维保范围` `设备维保、系统运维`
   - `报销策略` `按合同额度报销`
   - `停用策略` `停用后禁止新引用`
   - `审计策略` `标准审计策略`
   Use 24px value boxes, compact gaps, custom div dropdowns, no native select.

2. Directly below that form, inside the same visible right card, add the red card:
   - title `风险提示`
   - `非长期供应商累计 3 次需转认证`
   - `合同外服务需审批`
   - `停用后历史不删除`

3. Below the risk card, still inside the visible right card and above y=904, add:
   - title `发布门禁（6/7 通过）`
   - `基本信息` `通过`
   - `认证材料` `通过`
   - `合同/PO策略` `通过`
   - `风险评估` `通过`
   - `报销策略` `通过`
   - `历史交易保留` `通过`
   - `审计策略` `待完善`

Strict failure avoidance:
- Do not move `发布门禁`, `审计策略`, or `待完善` outside x=1320..1586.
- Do not make the right card wider than the viewport.
- Do not move the matrix values `45` and `126`.
- Do not move `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, or `入账单.pdf`.
- Do not introduce overflow:auto/scroll.
