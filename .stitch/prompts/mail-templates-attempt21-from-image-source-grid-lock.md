Use the selected uploaded IMAGE screen as the only source of truth.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only authority.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use a generic admin template.
Do not change business data.

Generate a new complete DESIGN screen as HTML. Do not only return DOM operations.

Page: 邮件模板配置台
Menu: system-mail-templates
Reference image: notification-subpage-03-mail-templates-v2.png

Pixel frame:
- The final document is exactly 1586 x 992 CSS px.
- No document scroll: scrollWidth=1586, scrollHeight=992.
- No internal scrollbars for source-visible content.
- Use compact Chinese enterprise text; no emoji icons.

Global shell from source:
- Header y=0..50, navy #061b38.
- Left brand at x=14..238: white `UNIVIEW 固定资产管理系统` exactly as shown.
- Active top nav: `系统运营中枢`.
- Sidebar x=0..218, y=50..992, dark navy; active nested item `邮件模板` under `消息与通知`.

Main content source layout:
- Main content area x=218..1586, y=50..992, background #f4f7fb.
- Title block: x=235, y=68, title `邮件模板配置台`, subtitle below.
- Action buttons row: x=235..740, y=124..157: `新建模板`, `保存草稿`, `提交校验`, `模板预览`, `发布`.
- Status strip: x=881..1568, y=124..157: `草稿已保存`, `变量校验通过`, `当前版本`, `V3`, `更新人`, `平台运维`, `更新时间`, `2026-06-18 15:20`.
- Filter card: x=235..1569, y=168..226. Search input and filters all inside this row.

Strict grid below filters:
- Upper row must occupy exactly y=238..688.
  - Left table card: x=235..912, y=238..688.
  - Right editor card: x=923..1569, y=238..688.
- Bottom row must occupy exactly y=700..957.
  - Variable dictionary: x=235..654, y=700..957.
  - Referenced process: x=666..1084, y=700..957.
  - Publish validation: x=1098..1569, y=700..957.
- Do not overlap these grid rows. Bottom cards must never cover the upper row. No `position: fixed` or overlay-style bottom panels.

Upper left table requirements:
- Card title `邮件模板列表` at y≈250.
- Headers: `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Exactly four visible rows, no hidden fifth row, no row below the card:
  1. `CIP 转固审批通知` / `MAIL_CIP_APPROVAL` / `CIP 转固` / `CIP 转固流程` / `中文(简体)` / `8/8 完整` / `已发布` / `编辑 复制 更多`.
  2. `ERP 回执失败模板` / `MAIL_ERP_FAIL` / `ERP 回执` / `ERP 回执` / `中文(简体)` / `6/7 补齐` / `草稿` / `编辑 复制 更多`.
  3. `资产入账完成通知` / `MAIL_FA_POSTED` / `资产入账` / `FA 入账流程` / `中文(简体)` / `7/7 完整` / `已发布` / `编辑 复制 更多`.
  4. `SLA 超时升级模板` / `MAIL_SLA_ESCALATE` / `SLA 升级` / `SLA 升级` / `中文(简体)` / `5/6 待补` / `待校验` / `编辑 复制 更多`.
- Footer inside the same card near y=657..675: `共 4 条`, page `1`, `20 条 / 页`.

Upper right editor requirements:
- Card title `模板编辑区`.
- Two-column form matching source. Values: `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `中文（简体）`, `【CIP 转固】{{asset_name}} 转固审批结果通知`, `企业邮箱网关`, `V3`, `平台运维`.
- Rich editor toolbar and content must fit inside y=454..651.
- Include visible editor variables: `{{receiver_name}}`, `{{asset_name}}`, `{{asset_code}}`, `{{capitalization_date}}`, `{{erp_receipt_no}}`.
- Editor action buttons `插入变量`, `渲染预览`, `版本对比` must be inside the editor card at y≈656..676.
- No editor body overflow; fit by reducing line height and preserving source density.

Bottom row requirements:
- The bottom row starts only at y=700. It must not appear as an overlay on top of the upper cards.
- `变量字典` card: 5 rows, including `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`; footer `共 5 条` safely visible at y≈923.
- `引用流程` card: 3 rows `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`; footer `共 3 条` safely visible at y≈923.
- `发布校验清单` card: rows `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`; action button `重新校验` fully visible at y≈918..947.

Source text details:
- Search placeholder exactly `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Filter labels and values: `状态 全部`, `场景 全部`, `语言 全部`, `引用流程 全部`, `变量完整度 全部`, `重置`.
- Use `6/7 补齐` for ERP row, not `6/7 待补`.

Forbidden failure patterns:
- Do not put bottom cards over the upper table/editor.
- Do not place `共 5 条`, `共 3 条`, or `重新校验` at y>=960.
- Do not clip the fourth table row.
- Do not hide `erp_receipt_no`.
- Do not use large emoji buttons such as rocket/eye/floppy icons.
- Do not make the left table wider than x=235..912 or the editor narrower than x=923..1569.
