Refine the selected mail templates DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `2e0015ad82a440fc9002aac799d04451` keeps the correct source structure, exact 1586x992 document size, visible search placeholder, no overflow containers, and all required DOM text. It fails only because the bottom card footers/button are physically below the viewport.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Preserve exactly:
- Top shell, sidebar, header, status band, filters.
- Upper `邮件模板列表` with exactly four rows and footer `共 4 条`.
- Upper `模板编辑区`, including compact non-scrolling editor body.
- Search input placeholder `搜索模板名称 / 编码 / 变量 / 引用流程`.
- No internal scrollbars and document/body exactly 1586 x 992.

Critical repair:
- Current failure coordinates:
  - bottom `变量字典` footer `共 5 条` is at y≈1001..1016.
  - bottom `引用流程` footer `共 3 条` is at y≈1001..1016.
  - `重新校验` is at y≈993..1008.
- These must be moved fully visible into the 1586 x 992 viewport.
- Target:
  - `共 5 条` y≈940..956.
  - `共 3 条` y≈940..956.
  - `重新校验` y≈910..948.

How to fit:
- Move the bottom three cards up so their top is y≈680 instead of y≈733 if necessary.
- Reduce bottom-card header height to 28px.
- Reduce bottom-card table header height to 24px.
- Reduce bottom-card row height to 24px.
- Reduce bottom-card padding to 10px.
- Use 11px compact table text and 14px line-height.
- Keep all required bottom rows visible; do not hide them with overflow clipping.

Bottom-left `变量字典` card:
- Position target x≈235..668, y≈680..956.
- Rows visible:
  `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`.
- Footer `共 5 条` must be visible inside this card near y≈944.

Bottom-middle `引用流程` card:
- Position target x≈686..1118, y≈680..956.
- Rows visible:
  `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`.
- Footer `共 3 条` must be visible inside this card near y≈944.

Bottom-right `发布校验清单` card:
- Position target x≈1136..1569, y≈680..956.
- Rows visible:
  `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`.
- Button `重新校验` must be visible inside this card near y≈920.

Do not regress:
- Do not change upper table footer from `共 4 条`.
- Do not put `共 5 条` or `共 3 条` in the upper table.
- Do not lose `erp_receipt_no`.
- Do not reintroduce `overflow-y-auto`, `overflow-auto`, or any real scroll container.
- Do not create page height > 992.
- Do not create page width > 1586.

Final self-check:
- Browser text includes `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, `重新校验`.
- All three strings `共 5 条`, `共 3 条`, `重新校验` have bounding boxes with bottom <= 956.
- The search placeholder remains visible in the input.
- `documentElement.scrollHeight=992`, `body.scrollHeight=992`, no real internal scroll containers.
