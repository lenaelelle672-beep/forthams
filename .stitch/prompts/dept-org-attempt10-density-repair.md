Repair the selected DESIGN screen against the IMAGE2 v2 source `org-permission-subpage-06-dept-org-v2.png`.

This remains a 100/100 pixel-fidelity transcription task, not a redesign task.
Do not change business data, top navigation, sidebar, colors, or panel hierarchy.
Fix only density, clipping, and exact text spacing so the generated HTML matches the source screenshot.

Required repairs:
1. Department table density:
   - The source shows all eight department rows inside the center table card.
   - Current candidate shows only about three rows because row height is too large and the table body is clipped.
   - Reduce table header to about 38px and each body row to about 40px.
   - Keep all rows visible: 设备管理部, 工程技术中心, 资产会计组, CIP项目组, 信息技术部, 财务共享中心, 物流管理组, 运维支持组.
   - Footer remains visible: 共 8 条, page 1, 20 条/页, 跳至 1 页.

2. Right detail panel density:
   - The source shows all detail fields and buttons in the right card.
   - Current candidate stops around 同步来源.
   - Compact each label/control row to about 34px.
   - Make all fields visible: 部门名称, 部门编码, 父级路径, 成本中心, 部门负责人, 同步来源, 同步策略, 部门状态, 审批影响, 交接规则, 是否启用.
   - Show exact values: 每日增量同步, 正常, 中（4 条待办，2 条审批）, 按组织规则执行.
   - Show buttons: 保存部门, 差异确认, 查看审计.

3. Counter text:
   - Use exact source text `8/12`, not `8 / 12`.

4. Bottom section:
   - Keep bottom section within y=705..957.
   - Do not expand the bottom card height.
   - Keep the orange warning and button visible.

5. No overflow:
   - No internal vertical scrollbars or hidden source-visible content.
   - Document remains exactly 1586 x 992.
