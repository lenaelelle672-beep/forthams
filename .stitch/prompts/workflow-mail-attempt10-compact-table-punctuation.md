Edit the selected uploaded IMAGE2 v2 reference screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not use any old Stitch draft as the visual source.

Page name: 流程邮件配置
Menu id: system-workflow-mail
Reference image: notification-subpage-02-workflow-mail-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-02-workflow-mail-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-workflow-mail
Canvas: exactly 1586 x 992 CSS pixels.

Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, divider, and `固定资产管理系统`.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.
Do not use emoji, pictograph glyphs, generic mascot icons, or colored non-source symbols anywhere.

Use the source screenshot's fixed structure:
- top shell y=0..56, sidebar x=0..212, main workspace x=212..1586.
- title/actions y=72..128; filter row y=156..206.
- upper panels y=216..658: left rules table, middle rule detail, right field maintenance.
- bottom panels y=672..954: mail preview, variable mapping, send preview/check, render/check, audit.
- no page scroll and no internal vertical scroll containers for source-visible content.

Hard visual repair focus:
1. The left `流程邮件规则` table must be horizontal, never vertically stacked.
   Use compact source density: header about 42px, five visible rows about 56px each.
   All 5 rows must be visible: `CIP 转固流程`, `资产入账流程`, `资产处置流程`, `隐患扣款流程`, `SLA 超时升级`.
   Keep columns compact like the source: radio, 流程, 节点事件, 邮件模板, 引用网关, 收件人规则, 静默条件, 状态, 操作.
2. Preserve exact Chinese punctuation. The bottom heading must be exactly:
   `发送预演（节点：转固完成）`
   Do not add a space before `（`; forbidden text: `发送预演 （节点：转固完成）`.
3. Keep all source-visible bottom/right content inside the 992px frame:
   `发送预演与发布校验`, `渲染结果`, `网关与校验`, `最近审计记录`, `查看完整日志`.
4. Right panel bottom buttons must stay visible: `保存草稿`, `发送预演`, `提交校验`.

Required visible source text:
- `流程邮件配置台`
- `新建规则`, `复制规则`, `发送预演`, `保存草稿`, `提交校验`
- `搜索流程 / 节点 / 模板 / 收件人`
- `流程邮件规则`, `CIP 转固流程邮件规则`, `规则字段维护`
- `抄送规则`, `静默条件`, `失败重试`, `附件策略`, `审计要求`
- `邮件预览`, `变量映射`, `发送预演与发布校验`
- `发送预演（节点：转固完成）`
- `重新预演`, `主题渲染`, `正文渲染`, `附件生成`, `TLS 安全`, `审计记录`, `查看完整日志`

Final self-check:
- Browser screenshot at 1586 x 992 must show the same source dark shell, white workspace, upper 3-panel band, and bottom card band.
- Left rules table has five horizontal rows, not stacked text.
- Exact punctuation string `发送预演（节点：转固完成）` exists.
- No emoji/generic icons, no internal scrollbars, no content clipped at the bottom.
