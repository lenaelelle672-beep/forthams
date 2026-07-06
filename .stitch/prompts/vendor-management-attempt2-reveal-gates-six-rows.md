Edit this Stitch screen to match the original IMAGE2 v2 source screenshot for `master-data-subpage-04-vendor-management-v2.png`.

This remains a 100/100 pixel-fidelity transcription task. Do not redesign, do not change business data, and do not introduce emoji.

Keep the successful parts from the current candidate:
- No emoji.
- The page is contained in 1586 x 992.
- The top shell, sidebar, category cards, supplier table, and metric matrix are generally present.

Fix these hard mismatches:

1) Right supplier detail panel must not hide content behind an internal scrollbar.
- Source screenshot shows the right panel with `供应商详情`, `风险提示`, and `发布门禁` visible in the same right column.
- Remove the tall internal scroll behavior from the right panel.
- Compress form row height, field padding, and vertical gaps so these sections are visible:
  - `供应商详情`
  - `风险提示`
  - `发布门禁`
  - progress `6/7 通过`
  - checklist rows including `基本信息`, `认证材料`, `合同/PO策略`, `风险评估`, `报销策略`, `历史交易保留`, `审计策略 待完善`.
- The right column must remain inside the viewport and must not overlap the bottom card row.

2) Bottom `交易反查台` must show all 6 source rows.
- Current candidate only reveals 4 rows. Source shows 6 rows plus footer.
- Compress table row height and card header/tabs height so all rows are visible:
  - 合同 / CT-CIP-2026-09
  - PO / PO-2026-0318
  - SSE 维保 / WO-SSE-2307
  - 报销 / REIM-8842
  - 发票 / INV-2026-0318-07
  - 入账单 / JE-2026-0318-07
- Keep footer `共 6 条`, page `1`, and `20 条/页` visible.

3) Source-like top band and positions.
- Keep source title `供应商档案与交易反查`.
- Keep source action buttons: `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.
- Keep status strip: `草稿已保存 09:51`, `认证材料待复核 2 项`, `历史交易保留 126 单`, `黑名单命中 0`.

4) Main supplier table stays 4 rows visible.
- Do not regress the 4 supplier table rows:
  `宇视认证供应商 A`, `临时采购供应商 B`, `SSE 维保供应商 C`, `CIP 设备维保备用供应商`.
- Do not make text vertical. Do not add horizontal page overflow.

Density guidance:
- Use compact 11px-12px Chinese typography.
- Reduce vertical gaps in the right panel and bottom tables.
- Bottom band should start around y=635 and end before y=955.
- No document scroll. No internal scrollbars hiding required content.

Final self-check:
- At 1586 x 992, visible text includes `发布门禁`, `审计策略`, `待完善`, `INV-2026-0318-07`, `JE-2026-0318-07`, and `数据截止：2026-05-15 09:51:22`.
- No emoji.
