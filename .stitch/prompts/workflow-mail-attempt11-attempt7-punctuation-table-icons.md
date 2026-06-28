Repair the selected Stitch DESIGN screen against the IMAGE2 source `notification-subpage-02-workflow-mail-v2.png`.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 流程邮件配置
Menu id: system-workflow-mail
Reference image: notification-subpage-02-workflow-mail-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-02-workflow-mail-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-workflow-mail

Start from the current selected DESIGN screen, but use the IMAGE2 source as the truth. Keep the current global 1586 x 992 fit and no-page-scroll behavior from this candidate.

Hard locks:
- Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW`, source-visible divider/lockup, and adjacent `固定资产管理系统`.
- Keep the same top shell, left sidebar active item `流程邮件配置`, page title `流程邮件配置台`, five top action buttons, filter row, three-column middle workspace, and four-card bottom workspace.
- Keep document and body exactly 1586 x 992. Do not introduce page-level scrolling.
- Do not introduce internal scrollbars for the main table, middle detail, right editor, or bottom cards.

Required exact text:
- `流程邮件配置台`
- `流程邮件规则`
- `CIP 转固流程邮件规则`
- `规则字段维护`
- `CIP 转固流程`
- `CIP 转固通知`
- `MAIL-GW-001`
- `固定资产管理员`
- `CIP 转固流程-转固完成通知`
- `CIP 转固完成通知`
- `抄送规则`
- `失败重试`
- `附件策略`
- `审计要求`
- `邮件预览`
- `变量映射`
- `发送预演与发布校验`
- `发送预演（节点：转固完成）`
- `查看完整日志`

Critical repair 1: exact punctuation.
- Render `发送预演（节点：转固完成）` as one continuous visible text string.
- Do not insert a whitespace between `发送预演` and `（节点：转固完成）`.
- Forbidden text: `发送预演 （节点：转固完成）`.

Critical repair 2: icon treatment.
- Remove generic emoji/text-symbol icons from top action buttons.
- Forbidden visible glyphs: `✉`, `✈`, `📧`, `🔗`, `👁`, `⚙`, `🚀`.
- Use source-like thin line icon treatment or omit the icon if it cannot match the IMAGE2 source.

Critical repair 3: left `流程邮件规则` table density.
- The left rules table must look like the IMAGE2 source: a compact horizontal table, not vertically stacked cells.
- Keep 5 visible rows within the card.
- Row height target: 44-48 px, header around 36-40 px.
- Column labels and row values should use horizontal text. Do not stack characters vertically.
- Keep these visible row labels/data: `CIP 转固流程`, `资产入账流程`, `资产处置流程`, `隐患扣款流程`, `SLA 超时升级`, `CIP 转固通知`, `入账完成通知`, `处置完成通知`, `扣款提醒`, `SLA升级通知`.
- Keep the selected first row pale blue source highlight and compact `编辑` / `复制` operations.

Critical repair 4: bottom workspace.
- Keep `邮件预览`, `变量映射`, `发送预演与发布校验`, and `最近审计记录` fully visible inside the 992 px viewport.
- Keep `查看完整日志` visible inside the bottom-right audit card.
- Keep bottom cards aligned in one row like the IMAGE2 source; do not push any bottom content outside the viewport.

Do not rebuild from a generic dashboard. This is a narrow repair of the current candidate: exact punctuation, no emoji icons, source-like left table density, and visible bottom cards while preserving all successful global geometry.
