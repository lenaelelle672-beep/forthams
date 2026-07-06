Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN/HTML screen.

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

Critical source geometry:
- Document must render at exactly 1586 x 992 with no page scroll.
- Top shell height 56px. Sidebar width 212px. Main content starts at x=212.
- Header/actions y=72..126. Filter row y=156..206.
- Upper panels y=216..658. Bottom panels y=672..954.
- Keep every source-visible element inside the 992px frame.
- Do not create internal overflow-y scroll containers. Content must be physically fitted by source-like density.

Brand and icon fidelity:
- Preserve the exact top-left IMAGE2 brand lockup: white `UNIVIEW`, divider, and `固定资产管理系统`.
- Do not split UNIVIEW into UNI/VIEW. Do not replace it with a generic brand.
- Do not use emoji or colored pictograph glyphs anywhere. Forbidden examples: `👤`, `📄`, `⚙`, `⚙️`, `🔔`, `🛠`, `🛠️`, `💾`, `✉`, `✈`, `💰`, `✅`, `✓`, `●`.
- Use small source-like monochrome line icons, outline squares, or CSS-only strokes. If an icon cannot be drawn in the source style, omit the icon but preserve text spacing.

Top navigation and sidebar:
- Top nav labels exactly: `资产运营总览`, `数据监控中心`, `资产运维中心`, `风险预警中心`, active `系统运营中枢`.
- Top right: notification badge `12`, help, settings, avatar, `超级管理员`.
- Sidebar title `系统运营中枢`.
- Active group `消息与通知`; active item `流程邮件配置`.
- Visible sidebar items: `流程平台`, `组织权限`, `基础资料`, `集成配置`, `消息与通知`, `邮件网关配置`, `流程邮件配置`, `邮件模板`, `邮件日志`, `通知模板`, `通知渠道`, `通知偏好`, `流程通知开关`, `系统参数`.

Header and filters:
- Page title `流程邮件配置台`.
- Buttons in a single horizontal row: `新建规则`, `复制规则`, `发送预演`, `保存草稿`, `提交校验`.
- Search placeholder `搜索流程 / 节点 / 模板 / 收件人`.
- Filters: `流程类型 全部`, `邮件模板 全部`, `发送状态 全部`, `校验状态 全部`.

Upper-left panel `流程邮件规则`:
- Keep source table horizontal. Never stack table cell characters vertically.
- Row height must be compact like the source, about 42px. Header about 42px.
- Columns: radio, `流程`, `节点事件`, `邮件模板`, `引用网关`, `收件人规则`, `静默条件`, `状态`, `操作`.
- Five rows must be visible:
  1. `CIP 转固流程`, `转固完成`, `CIP 转固通知`, `MAIL-GW-001`, `固定资产管理员`, `无`, `已发布`, `编辑 复制 ...`
  2. `资产入账流程`, `入账完成`, `入账完成通知`, `MAIL-GW-001`, `资产使用门负责人`, `无`, `已发布`, `编辑 复制 ...`
  3. `资产处置流程`, `处置完成`, `处置完成通知`, `MAIL-GW-001`, `资产处置审批人`, `金额>5000`, `草稿`, `编辑 复制 ...`
  4. `隐患扣款流程`, `扣款完成`, `扣款提醒通知`, `MAIL-GW-002`, `财务会计`, `节假日静默`, `已发布`, `编辑 复制 ...`
  5. `SLA 超时升级`, `超时升级`, `SLA升级通知`, `MAIL-GW-001`, `运维责任人`, `超时>24小时`, `已发布`, `编辑 复制 ...`
- Footer inside this panel: `共 5 条`, page `1`, `20 条 / 页`.

Upper-middle panel `CIP 转固流程邮件规则`:
- Title with green tag `已发布`.
- Four node cards: `提交`, `资产管理员审批`, `财务复核`, `转固完成`.
- Each node uses source-like status dots/toggles, not emoji.
- Detail list rows must all be visible without scrolling:
  - `邮件模板` `CIP 转固完成通知（模板ID：TMP-CIP-001）` `查看`
  - `邮件网关` `MAIL-GW-001（smtp.uniview.com:587）` `健康`
  - `收件人规则` `流程发起人主管；资产归属部门负责人；固定资产管理员` `查看`
  - `抄送规则` `固定资产管理员；财务资产会计` `编辑`
  - `静默条件` `节假日静默（国家法定节假日 08:00-20:00 不发送）` `编辑`
  - `失败重试` `3 次，间隔 10 分钟`
  - `附件策略` `自动生成转固单 PDF 附件`
  - `审计要求` `记录成功与失败详情`

Upper-right panel `规则字段维护`:
- Fields in order, all visible:
  - `规则名称 *` = `CIP 转固流程-转固完成通知`
  - `流程类型 *` = `固定资产流程`
  - `节点事件 *` = `转固完成`
  - `邮件模板 *` = `CIP 转固完成通知`
  - `邮件网关 *` = `MAIL-GW-001`
  - `收件人规则 *` = `自定义规则`
  - `抄送规则` = `固定资产管理员；财务资产会计`
  - `静默条件` = `节假日静默（08:00-20:00）`
  - `状态` = `已发布`
  - `启用`
- Bottom buttons visible inside the panel: `保存草稿`, `发送预演`, `提交校验`.
- Do not cover the lower fields with a floating button strip.

Bottom tier:
- Left card `邮件预览`:
  - `主题`
  - `【UNIVIEW】资产转固已完成（${asset_code}）`
  - body includes `${receiver_name}`, `${asset_name}`, `${asset_code}`, `${capitalization_date}`
  - button `预览完整邮件`
- Middle-left card `变量映射`:
  - rows `${receiver_name}`, `${asset_name}`, `${asset_code}`, `${capitalization_date}`, `${project_code}`
  - links/buttons `添加变量映射`, `管理变量`
- Right group title `发送预演与发布校验`.
- The heading must be exactly `发送预演（节点：转固完成）`.
  - There must be no extra spaces before or after `（` or `）`.
  - Do not output `发送预演 （节点：转固完成）`.
- Include recipients `张三`, `李四`, `王五`, button `重新预演`.
- Include `渲染结果`, `网关与校验`, `最近审计记录`.
- Visible checks: `主题渲染 正常`, `正文渲染 正常`, `附件生成 转固单.pdf`, `TLS 安全 正常`, `审计记录 已记录`.
- Link `查看完整日志`.

Hard failure conditions:
- Any emoji/generic pictograph icon remains visible.
- Exact text `发送预演（节点：转固完成）` is missing or has inserted spaces.
- Any table cell becomes vertical stacked text.
- `隐患扣款流程`, `抄送规则`, `静默条件`, `失败重试`, `附件策略`, `审计要求`, or `查看完整日志` is missing.
- Page or internal vertical scrolling is required to see source-visible content.
- Bottom cards extend below the 992px viewport.

Final self-check before returning:
- Browser screenshot at 1586 x 992 shows the same source dark shell, white workspace, upper 3-panel band, and bottom 3-card band.
- All five left-table rows are visible and horizontal.
- Source brand/icon treatment is preserved without emoji.
- The exact Chinese punctuation string `发送预演（节点：转固完成）` is present.
