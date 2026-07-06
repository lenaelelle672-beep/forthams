Repair the selected Stitch DESIGN screen with a surgical footer-only correction.

This is not a redesign. Do not move panels. Do not change row heights except if absolutely necessary by 1-2px. Preserve the current attempt17 layout, no page scroll, no internal overflow.

The selected screen currently has the wrong footer placement:
- The upper-left `邮件模板列表` table footer incorrectly says `共 5 条`.
- The upper-left `邮件模板列表` table must say `共 4 条` because there are four mail template rows.
- The bottom-left `变量字典` card must show its own footer `共 5 条` because there are five variable rows.
- The bottom-middle `引用流程` card must continue to show `共 3 条`.

Surgical changes:

1. Upper-left mail template table footer
- Find the footer inside the `邮件模板列表` card, near the pagination controls `<`, `1`, `>`, `20 条/页`.
- Change that footer text to exactly `共 4 条`.
- Do not change the four mail template rows.

2. Bottom-left variable dictionary footer
- In the bottom `变量字典` card, keep these five rows visible:
  - `receiver_name`
  - `asset_name`
  - `asset_code`
  - `capitalization_date`
  - `erp_receipt_no`
- Add/keep the footer `共 5 条` at the bottom of this card, below the fifth row and inside the card.
- Do not put this footer in the upper mail template table.

3. Bottom-middle reference flow footer
- Keep `共 3 条` inside the `引用流程` card, below the three rows.

4. Preserve all current pass conditions
- Keep input placeholder exactly `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Keep `邮件模板列表` visible.
- Keep `合规签名`, `重新校验`, and all bottom cards visible.
- Keep `默认网关`, `当前版本`, `负责人`, and `erp_receipt_no` visible.
- No `overflow-y-auto`, no scroll containers, no page scroll.

Failure conditions:
- `邮件模板列表` footer still says `共 5 条`.
- No visible `共 4 条`.
- Bottom `变量字典` card lacks visible `共 5 条`.
- `erp_receipt_no` row is clipped or hidden.
