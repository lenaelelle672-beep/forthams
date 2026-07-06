Refine the selected mail templates DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `05398e1a52f640a7abe07bfc8c512731` is the best current baseline: keep its source-like shell, sidebar, header, filter row, upper list, editor, and bottom three-card structure.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 邮件模板配置台
Menu id: system-mail-templates
Reference image: notification-subpage-03-mail-templates-v2.png
Canvas: exactly 1586 x 992 CSS px.

Preserve current successes:
- Top-left brand `UNIVIEW | 固定资产管理系统`.
- Left dark sidebar active `消息与通知 / 邮件模板`.
- Header title `邮件模板配置台`, status pills, and action buttons.
- Filter row with visible search placeholder `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Upper left `邮件模板列表` with exactly four rows and footer `共 4 条`.
- Upper right `模板编辑区` with `默认网关`, `当前版本`, `负责人`, and editor toolbar.
- Bottom cards `变量字典`, `引用流程`, and `发布校验清单`.
- Required bottom strings `erp_receipt_no`, `合规签名`, `共 5 条`, and `共 3 条`.
- No page scroll: document/body must remain 1586 x 992.

Critical repair only:
1. The current candidate has one internal rich-editor overflow container:
   - class is like `p-2 text-xs leading-relaxed overflow-y-auto`.
   - Replace it with a compact non-scrolling editor body.
   - It must not have `overflow-y-auto`, `overflow-auto`, or scrollHeight > clientHeight.
   - Keep these visible tokens: `{{receiver_name}}`, `{{asset_name}}`, `{{asset_code}}`, `{{capitalization_date}}`, `{{erp_receipt_no}}`.
   - Compress the body text with 11px text and shorter line height if needed.
2. Current bottom card footers and button are too low:
   - `共 5 条` and `共 3 条` are at y≈991 and must move fully inside the cards, target y<=952.
   - `重新校验` is at y≈993 and must move fully visible, target y<=952.
   - Move the bottom three cards upward by about 18-24px or reduce their internal row heights.
   - Do not let bottom cards overlap the upper table/editor.
   - Do not change the upper `邮件模板列表` footer: it must remain `共 4 条`.

Source-like vertical budget:
- Filter row y≈168..225.
- Upper panels y≈238..688.
- Bottom three cards y≈700..956, but all card footers/buttons must be visually inside y<=956.
- If needed, make bottom cards y≈684..956 while preserving a clear 8-12px gap below upper panels.

Bottom-left card `变量字典`:
- Five rows visible:
  `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`.
- Footer `共 5 条` must be fully visible inside the card, not clipped at the bottom.

Bottom-middle card `引用流程`:
- Three rows visible:
  `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`.
- Footer `共 3 条` must be fully visible inside the card, not clipped at the bottom.

Bottom-right card `发布校验清单`:
- Keep visible rows:
  `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`.
- Button `重新校验` must be fully visible inside the 1586 x 992 viewport.

Hard final self-check:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No element with `overflow:auto` or `overflow:scroll` may have scrollHeight > clientHeight or scrollWidth > clientWidth.
- Search placeholder is visible in the input: `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Visible text includes `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, and `重新校验`.
- Forbidden: do not add non-source brand icons; do not move `共 5 条` into the upper list; do not omit footer counts.
