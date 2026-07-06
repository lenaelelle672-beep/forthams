Edit the selected generated DESIGN screen into a new persistent Stitch DESIGN/HTML screen.
Do not return DOM operations only. Create a new generated screen id with downloadable HTML.

This is a 100/100 pixel-fidelity repair for `供应商管理`.
The IMAGE2 v2 source is `master-data-subpage-04-vendor-management-v2.png`, 1586 x 992.
Do not redesign the page. Preserve all currently good geometry/content from the selected screen:
- top shell and left sidebar;
- vertical `供应商分类` column;
- center supplier table;
- bottom `交易反查台` with all 6 rows;
- bottom `供应商引用矩阵` with values `12`, `38`, `45`, `23`, `67`, `126`;
- no page scroll and no internal scroll.

Only repair the right rail blank lower half.

Right rail source geometry:
- Right rail x≈1328..1574, y=66..904.
- Keep `供应商详情` at top.
- Compact the form enough to fit the lower cards:
  `供应商名称 *` -> `宇视认证供应商 A`
  `供应商编码 *` -> `SUP-A-0001`
  `认证状态 *` -> `已认证`
  `复核周期 *` -> `12 个月`
  `交易范围 *` -> `安防设备、系统集成`
  `合同PO策略 *` -> `需合同/PO 才可下单`
  `维保范围` -> `设备维保、系统运维`
  `报销策略` -> `按合同额度报销`
  `停用策略` -> `停用后禁止新引用`
  `审计策略` -> `标准审计策略`
- Use compact 26px fields and 6px gaps. No native select clipping. No scrollbars.

Add the missing lower cards exactly like source:

1. `风险提示` card, red-tinted border/background, below the form:
   - `非长期供应商累计 3 次需转认证`
   - `合同外服务需审批`
   - `停用后历史不删除`

2. `发布门禁（6/7 通过）` card below risk:
   - `基本信息` `通过`
   - `认证材料` `通过`
   - `合同/PO策略` `通过`
   - `风险评估` `通过`
   - `报销策略` `通过`
   - `历史交易保留` `通过`
   - `审计策略` `待完善`

Hard constraints:
- Keep viewport exactly 1586 x 992.
- Keep body/document size 1586 x 992.
- Keep `交易反查台` bottom rows visible: `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`.
- Keep matrix values inside source x-band, not in the right rail.
- Do not move center/bottom panels.
- Do not introduce internal scroll containers.
- Do not drop `发布门禁`, `审计策略`, or `待完善`.
