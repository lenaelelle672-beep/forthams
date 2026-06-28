Repair the selected Stitch DESIGN screen against the IMAGE2 v2 source screenshot.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 邮件模板
Menu id: system-mail-templates
Reference image: notification-subpage-03-mail-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-03-mail-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-templates
Canvas: 1586 x 992 CSS pixels.

Repair goal:
- Keep the currently correct top-left `UNIVIEW 固定资产管理系统` brand lockup. Do not replace or redraw it.
- Keep all text horizontal.
- No page-level scroll; no internal scroll containers for panels that the source shows fully visible.
- Restore the source geometry so the bottom three cards are fully visible:
  - `变量字典` at lower-left.
  - `引用流程` at lower-middle.
  - `发布校验清单` at lower-right.
- In the source, the upper body uses two panels from about y=238 to y=688, and the bottom three cards start about y=700 and end before y=960. Match that vertical budget.

Required top shell and sidebar:
- Top nav: `UNIVIEW 固定资产管理系统`, `资产管理`, `财务管理`, `报表中心`, `系统设置`, active `系统运营中枢`, right `12`, `平台运维`.
- Left sidebar title `系统运营中枢`.
- Sidebar groups and items must match source density. Active group `消息与通知`; active child `邮件模板`.
- Visible sidebar items include: `流程平台`, `流程设计`, `流程监控`, `流程日志`, `流程委托`, `组织权限`, `组织管理`, `角色管理`, `权限管理`, `用户管理`, `基础资料`, `资产分类`, `资产属性`, `编码规则`, `枚举值管理`, `集成配置`, `系统集成`, `接口管理`, `数据映射`, `调度任务`, `消息与通知`, `通知渠道`, `消息模板`, `邮件模板`, `短信模板`, `消息日志`, `系统参数`, `全局参数`, `业务参数`, `参数日志`.

Header and controls:
- Title `邮件模板配置台`.
- Subtitle `管理流程邮件与通知邮件的标题、正文、变量、版本和引用流程。`
- Header buttons in one row: `新建模板`, `保存草稿`, `提交校验`, `模板预览`, `发布`.
- Status strip: `草稿已保存`, `变量校验通过`, `当前版本 V3`, `更新人 平台运维`, `更新时间 2026-06-18 15:20`.
- Filter row must be visible in-frame with search placeholder `搜索模板名称 / 编码 / 变量 / 引用流程`, and filters `状态 全部`, `场景 全部`, `语言 全部`, `引用流程 全部`, `变量完整度 全部`, plus `重置`.

Upper left panel:
- Panel title `邮件模板列表`.
- Keep this panel compact: source height is about 450px, not a tall empty table.
- Table columns: `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Rows:
  1. `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `CIP 转固流程`, `中文(简体)`, `8/8 完整`, `已发布`, `编辑 复制 更多`.
  2. `ERP 回执失败模板`, `MAIL_ERP_FAIL`, `ERP 回执`, `ERP 回执`, `中文(简体)`, `6/7 补齐`, `草稿`, `编辑 复制 更多`.
  3. `资产入账完成通知`, `MAIL_FA_POSTED`, `资产入账`, `FA 入账流程`, `中文(简体)`, `7/7 完整`, `已发布`, `编辑 复制 更多`.
  4. `SLA 超时升级模板`, `MAIL_SLA_ESCALATE`, `SLA 升级`, `SLA 升级`, `中文(简体)`, `5/6 缺补`, `待校验`, `编辑 复制 更多`.
- Footer: `共 4 条`, pagination with page `1`, `20 条 / 页`.

Upper right panel:
- Panel title `模板编辑区`.
- Keep it compact enough that the whole panel ends around y=688.
- Form fields must match source: `模板名称`, `模板编码`, `使用场景`, `语言`, `邮件主题`, `默认网关`, `当前版本 V3`, `负责人`, `邮件正文`.
- Values: `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `中文(简体)`, `【CIP 转固】{{asset_name}} 转固审批结果通知`, `企业邮箱网关`, `平台运维`.
- Rich editor toolbar and body must show variable tokens: `{{receiver_name}}`, `{{asset_name}}`, `{{asset_code}}`, `{{capitalization_date}}`, `{{erp_receipt_no}}`.
- Bottom actions inside this panel: `插入变量`, `渲染预览`, `版本对比`.

Bottom cards, all fully visible:
- `变量字典`: columns `变量名`, `变量来源`, `是否必填`, `示例值`; rows `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`; footer `共 5 条`.
- `引用流程`: columns `流程名称`, `流程编码`, `节点`, `触发事件`; rows `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`; footer `共 3 条`.
- `发布校验清单`: columns `检查项`, `校验结果`, `说明`; rows `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`; bottom button `重新校验`.

Prior failed output to avoid:
- Do not push bottom cards below the visible viewport.
- Do not leave the bottom cards as only a clipped top edge.
- Do not omit `邮件模板列表`.
- Do not omit the search placeholder `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Do not omit `中文(简体)` or `合规签名`.
- Do not create a giant blank area inside the upper-left table.

Final self-check:
- Browser screenshot at 1586 x 992 must show the full `变量字典`, `引用流程`, and `发布校验清单` cards.
- `发布校验清单` must show `合规签名` and the `重新校验` button.
- The top-left brand must remain exact `UNIVIEW 固定资产管理系统`.
