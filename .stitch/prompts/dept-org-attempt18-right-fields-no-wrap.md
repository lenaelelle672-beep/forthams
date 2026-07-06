This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.

Page name: 部门组织与负责人配置
Menu id: system-dept-org
Reference image: org-permission-subpage-06-dept-org-v2.png

Use the current candidate as base. Do not change the center table, left tree, header, sidebar, or bottom publish band.

Only repair the right `部门详情` panel.

Current candidate improvement:
- The bottom buttons `保存部门`, `差异确认`, `查看审计` are visible.

Current candidate failure:
- The fields `交接规则` and `是否启用` are missing from the visible right panel.
- Several right-panel labels wrap to two lines. The IMAGE2 source keeps a compact professional editor and all fields visible.
- The top counter must render as exact text `8/12`, not `8 / 12`.

Required right panel final order, all visible above the button row:
1. `部门名称` value `设备管理部`
2. `部门编码` value `DM-0010`
3. `父级路径` value `总部 / A厂区 / 资产管理中心`
4. `成本中心` value `CC-410100`
5. `部门负责人` value `张伟`
6. `同步来源` value `ERP`
7. `同步策略` value `每日增量同步`
8. `部门状态` value `正常`
9. `审批影响` value `中（4 条待办，2 条审批）`
10. `交接规则` value `按组织规则执行`
11. `是否启用` blue enabled toggle
12. Button row: `保存部门`, `差异确认`, `查看审计`

Right panel layout instructions:
- Keep the right panel inside the same source area; do not overlap the bottom publish band.
- Use one-line labels. Do not wrap labels such as `部门编码`, `部门负责人`, `同步策略`, `部门状态`.
- Use a label column about 64 px wide and control column about 205 px wide.
- Use compact controls: height 24-26 px, font 12 px, vertical gap 4 px.
- Use compact panel padding: 12 px horizontal, 8 px vertical.
- Button row height 32 px and 8 px bottom padding.
- No internal vertical scroll. No clipping. All content must be visible in a 1586 x 992 Chrome screenshot.

Keep exact visible text `8/12` in the filter row.
