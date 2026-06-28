Edit the selected screen using the uploaded product screenshot as the only authority.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Return a fresh complete DESIGN screen with full HTML. Do not return only DOM operations. Do not make a floating overlay or absolute bottom panel that covers the editor. All visible source content must be in normal source-like panels.

Page name: 邮件模板配置台
Menu id: system-mail-templates
Reference image: notification-subpage-03-mail-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-03-mail-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-templates

Hard viewport contract:
- Canvas/document/viewport: exactly 1586 x 992 CSS pixels.
- documentElement.scrollWidth = 1586 and scrollHeight = 992.
- body scrollWidth = 1586 and scrollHeight = 992.
- No page-level scrollbars.
- No internal overflow-y scroll containers in sidebar, editor, tables, or bottom cards.
- Do not use emoji/pictograph icons; use simple line icons matching the IMAGE2 source.

Exact source geometry to restore:
- Top shell: y=0..50, dark navy, exact IMAGE2 brand: white `UNIVIEW` followed by `固定资产管理系统` as a single lockup.
- Sidebar: x=0..218, y=50..992, dark navy. Active item path: `消息与通知` > `邮件模板`.
- Main content left edge: x=234.
- Header/title/status/buttons/filter: y=64..226.
- Upper workspace: y=238..687.
  - Left `邮件模板列表` card: x=235..911, y=238..687.
  - Right `模板编辑区` card: x=923..1569, y=238..687.
- Bottom diagnostic tier: y=700..957, never above 700 and never below 957.
  - `变量字典` card: x=235..654, y=700..957.
  - `引用流程` card: x=666..1084, y=700..957.
  - `发布校验清单` card: x=1098..1569, y=700..957.

Current failure to repair:
- Attempt 19 placed the bottom cards as if they were floating over the editor. The right `发布校验清单` covered the lower editor area, and `重新校验` was below the visible frame at y≈993.
- Attempt 19 put `共 5 条` and `共 3 条` at y≈991; in the source these footers belong inside the bottom cards and must sit safely around y=930..940.
- Attempt 19 kept an internal editor body overflow container; source has no visible editor scrollbar.
- Attempt 19 widened the left table and narrowed the right editor. Restore the source x-bands above.

Content that must remain verbatim and visible:
- Title: `邮件模板配置台`.
- Buttons: `新建模板`, `保存草稿`, `提交校验`, `模板预览`, `发布`.
- Status strip: `草稿已保存`, `变量校验通过`, `当前版本`, `V3`, `更新人`, `平台运维`, `更新时间`, `2026-06-18 15:20`.
- Search placeholder: `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Filters: `状态 全部`, `场景 全部`, `语言 全部`, `引用流程 全部`, `变量完整度 全部`, `重置`.
- Upper left table title: `邮件模板列表`.
- Upper left table columns: `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Upper left table rows, exactly four rows:
  1. `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `CIP 转固流程`, `中文(简体)`, `8/8 完整`, `已发布`, `编辑`, `复制`, `更多`.
  2. `ERP 回执失败模板`, `MAIL_ERP_FAIL`, `ERP 回执`, `ERP 回执`, `中文(简体)`, `6/7 补齐`, `草稿`, `编辑`, `复制`, `更多`.
  3. `资产入账完成通知`, `MAIL_FA_POSTED`, `资产入账`, `FA 入账流程`, `中文(简体)`, `7/7 完整`, `已发布`, `编辑`, `复制`, `更多`.
  4. `SLA 超时升级模板`, `MAIL_SLA_ESCALATE`, `SLA 升级`, `SLA 升级`, `中文(简体)`, `5/6 待补`, `待校验`, `编辑`, `复制`, `更多`.
- Upper table footer inside the upper-left card: `共 4 条`, page `1`, `20 条 / 页`.
- Right editor fields: `模板名称 *`, `模板编码 *`, `使用场景`, `语言`, `邮件主题 *`, `默认网关`, `当前版本`, `负责人 *`, `邮件正文 *`.
- Right editor values: `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `中文（简体）`, `【CIP 转固】{{asset_name}} 转固审批结果通知`, `企业邮箱网关`, `V3`, `平台运维`.
- Editor body text must include visible variables: `{{receiver_name}}`, `{{asset_name}}`, `{{asset_code}}`, `{{capitalization_date}}`, `{{erp_receipt_no}}`.
- Editor bottom actions must stay inside right editor y<=686: `插入变量`, `渲染预览`, `版本对比`.

Bottom cards:
- `变量字典`: five rows visible, including `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`; footer `共 5 条` inside the card at y≈930.
- `引用流程`: three rows visible, `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`; footer `共 3 条` inside the card at y≈930.
- `发布校验清单`: visible rows `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`; button `重新校验` fully visible inside card, bottom<=948.

Density and wrapping:
- Use compact 12px-14px Chinese enterprise typography like the IMAGE2 source.
- No vertical Chinese text.
- Do not wrap table row names into two-line cells unless the IMAGE2 source visibly wraps them.
- The upper `邮件模板列表` rows must be readable and aligned; do not compress the right editor by making the left table too wide.
- The bottom cards must not collide with, overlap, or cover the editor.

Final self-check before completion:
- The page looks like a direct HTML transcription of `notification-subpage-03-mail-templates-v2.png`, not a recreated generic admin template.
- All major blocks align to the source coordinates.
- `重新校验`, `共 5 条`, and `共 3 条` are fully visible above the bottom edge.
- There are no visible or hidden internal overflow-y scroll containers for source-visible content.
