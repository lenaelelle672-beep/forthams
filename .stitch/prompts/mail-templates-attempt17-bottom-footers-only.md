Repair the selected Stitch DESIGN screen with a very narrow scope.

This is a 100/100 pixel-fidelity transcription repair, not a redesign task.
Do not regenerate the page. Do not move major panels.
Preserve the current attempt16 layout because it already has:
- Correct `UNIVIEW 固定资产管理系统` brand.
- Visible filter row.
- Visible `邮件模板列表`.
- No page-level scroll.
- No internal overflow containers.
- Bottom cards visible in the 1586 x 992 viewport.

Only fix the following source mismatches from `notification-subpage-03-mail-templates-v2.png`:

1. Search input
- The search input placeholder must be exactly `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Keep the visible filter row compact and in the same location.
- Do not collapse or remove any dropdown filter.

2. Bottom `变量字典` card
- Keep it at the current bottom-left position.
- Add the missing fifth row:
  - `erp_receipt_no`, `ERP 回执单号`, `否`, `RCPT20250618001`
- The card footer must show `共 5 条`.
- Keep all rows visible above the card bottom. Reduce row height slightly if needed, but do not create scroll.
- Keep existing rows: `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`.

3. Bottom `引用流程` card
- Keep it at the current bottom-middle position.
- Footer must show `共 3 条`.
- Keep the three rows visible: `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`.

4. Upper table source values
- Preserve current table geometry, but correct these source values if they differ:
  - ERP row `使用场景` must be `ERP 回执`, `引用流程` must be `ERP 回执`.
  - SLA row `使用场景` must be `SLA 升级`, `引用流程` must be `SLA 升级`.

5. Right editor fields
- If space allows without moving bottom cards, restore compact source fields `默认网关`, `当前版本 V3`, and `负责人 平台运维`.
- Do not let the editor overlap bottom cards.
- Do not reintroduce overflow-y auto/scroll.

Hard failure conditions:
- Any bottom card clipped below y=992.
- Any internal scroll container.
- Missing `邮件模板列表`.
- Missing `共 5 条`.
- Missing `共 3 条`.
- Missing `erp_receipt_no`.
- Moving bottom card row below its current visual position.
