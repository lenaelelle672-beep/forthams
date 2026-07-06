Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not use old Stitch drafts as the visual source.

Page name: 邮件模板
Menu id: system-mail-templates
Reference image: notification-subpage-03-mail-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-03-mail-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-templates
Canvas: exactly 1586 x 992 CSS pixels.

Absolute layout contract:
- No page-level scroll: documentElement scrollWidth=1586 and scrollHeight=992.
- No internal overflow-y scroll containers in the content cards.
- Top nav y=0..50.
- Sidebar x=0..218, content x=218..1586.
- Page header and status band y=50..160.
- Filter row y=168..225.
- Upper two panels y=238..688.
- Bottom three cards y=700..956.
- Nothing source-visible may be clipped below y=992.

Source shell:
- Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW` + divider + `固定资产管理系统`.
- Top nav: `资产管理`, `财务管理`, `报表中心`, `系统设置`, active `系统运营中枢`.
- Right user area: bell badge `12`, help icon, avatar, `平台运维`.
- Left sidebar dark navy. Active group `消息与通知`, active item `邮件模板`.
- Keep source sidebar density and labels. Visible labels include `系统运营中枢`, `流程平台`, `流程设计`, `流程监控`, `流程日志`, `流程委托`, `组织权限`, `组织管理`, `角色管理`, `权限管理`, `用户管理`, `基础资料`, `资产分类`, `资产属性`, `编码规则`, `枚举值管理`, `集成配置`, `系统集成`, `接口管理`, `数据映射`, `调度任务`, `消息与通知`, `通知渠道`, `消息模板`, `邮件模板`, `短信模板`, `消息日志`, `系统参数`, `全局参数`, `业务参数`, `参数日志`.

Header:
- Title `邮件模板配置台`.
- Subtitle `管理流程邮件与通知邮件的标题、正文、变量、版本和引用流程。`
- Action buttons in one horizontal row: `新建模板`, `保存草稿`, `提交校验`, `模板预览`, `发布`.
- Status band: `草稿已保存`, `变量校验通过`, `当前版本`, `V3`, `更新人`, `平台运维`, `更新时间`, `2026-06-18 15:20`.

Filter row:
- Search placeholder exactly `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Separate source filters in one row:
  - `状态` value `全部`
  - `场景` value `全部`
  - `语言` value `全部`
  - `引用流程` value `全部`
  - `变量完整度` value `全部`
- Right button `重置`.

Upper-left panel `邮件模板列表`:
- Fit inside y=238..688. Do not create a giant blank table area.
- Table columns: `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Keep table text horizontal. Do not wrap source values into multi-line stacks unless the source wraps similarly.
- Four source rows:
  1. `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `CIP 转固流程`, `中文(简体)`, `8/8 完整`, `已发布`, `编辑 复制 更多`
  2. `ERP 回执失败模板`, `MAIL_ERP_FAIL`, `ERP 回执`, `ERP 回执`, `中文(简体)`, `6/7 补齐`, `草稿`, `编辑 复制 更多`
  3. `资产入账完成通知`, `MAIL_FA_POSTED`, `资产入账`, `FA 入账流程`, `中文(简体)`, `7/7 完整`, `已发布`, `编辑 复制 更多`
  4. `SLA 超时升级模板`, `MAIL_SLA_ESCALATE`, `SLA 升级`, `SLA 升级`, `中文(简体)`, `5/6 缺补`, `待校验`, `编辑 复制 更多`
- Footer inside this upper-left panel: `共 4 条`, pagination `1`, `20 条 / 页`.
- Important: never change this upper panel footer to `共 5 条`.

Upper-right panel `模板编辑区`:
- Fit inside y=238..688 and never overlap the bottom cards.
- Fields and values:
  - `模板名称 *` = `CIP 转固审批通知`
  - `模板编码 *` = `MAIL_CIP_APPROVAL`
  - `使用场景` = `CIP 转固`
  - `语言` = `中文(简体)`
  - `邮件主题 *` = `【CIP 转固】{{asset_name}} 转固审批结果通知`
  - `默认网关` = `企业邮箱网关`
  - `当前版本` = `V3`
  - `负责人 *` = `平台运维`
  - `邮件正文 *`
- Rich text editor must be compact and visible without overflow scroll. Preserve visible tokens:
  - `{{receiver_name}}`
  - `{{asset_name}}`
  - `{{asset_code}}`
  - `{{capitalization_date}}`
  - `{{erp_receipt_no}}`
- Editor bottom buttons must stay inside the upper-right panel, above y=688: `插入变量`, `渲染预览`, `版本对比`.

Bottom-left card `变量字典`:
- Position y=700..956, fully visible.
- Columns: `变量名`, `变量来源`, `是否必填`, `示例值`.
- Five rows:
  1. `receiver_name`, `流程实例.接收人姓名`, `是`, `张三`
  2. `asset_name`, `资产.名称`, `是`, `服务器-戴尔R740`
  3. `asset_code`, `资产.编码`, `是`, `FA2025060001`
  4. `capitalization_date`, `转固.转固日期`, `是`, `2026-06-18`
  5. `erp_receipt_no`, `ERP.回执单号`, `否`, `RCPT20250618001`
- Footer inside this card: `共 5 条`.

Bottom-middle card `引用流程`:
- Position y=700..956, fully visible.
- Columns: `流程名称`, `流程编码`, `节点`, `触发事件`.
- Rows:
  1. `CIP 转固流程`, `CIP`, `Node_Approve`, `批准通过`
  2. `FA 入账流程`, `FA`, `Node_Post`, `入账完成`
  3. `ERP 回执失败重试`, `ERP`, `Node_RetryFail`, `回执失败`
- Footer inside this card: `共 3 条`.

Bottom-right card `发布校验清单`:
- Position y=700..956, fully visible.
- Columns: `检查项`, `校验结果`, `说明`.
- Rows:
  - `变量完整度`, `通过`, `8/8 个变量已配置`
  - `标题长度`, `通过`, `23/128 字符`
  - `渠道适配`, `通过`, `企业邮箱网关：支持`
  - `合规签名`, `通过`, `已配置系统签名`
  - `测试发送`, `待执行`, `尚未执行测试发送`
  - `审计记录`, `通过`, `最近提交人：平台运维`
- Button `重新校验`.

Failure patterns to avoid:
- Do not output a screen where the bottom cards are only partially visible.
- Do not move `共 5 条` into the upper `邮件模板列表` panel.
- Do not lose `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Do not omit `邮件模板列表`.
- Do not omit `合规签名`, `erp_receipt_no`, `共 4 条`, `共 5 条`, or `共 3 条`.
- Do not let table columns become vertical stacks.
- Do not introduce a rich-editor internal scrollbar.

Final self-check before completion:
- The browser screenshot at 1586 x 992 shows all source sections.
- Body or input placeholder contains `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Visible text contains `邮件模板列表`, `共 4 条`, `变量字典`, `共 5 条`, `引用流程`, `共 3 条`, `合规签名`, and `重新校验`.
- No visible panel overlaps another panel.
