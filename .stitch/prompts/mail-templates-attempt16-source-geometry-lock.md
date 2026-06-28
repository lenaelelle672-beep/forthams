Repair the selected Stitch DESIGN screen against `notification-subpage-03-mail-templates-v2.png`.

This is a 100/100 pixel-fidelity transcription repair, not a redesign task.
The IMAGE2 v2 source screenshot is the only source of truth.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use a default admin template.
Do not change business data.

Target page: 邮件模板配置台
Menu id: system-mail-templates
Source image: notification-subpage-03-mail-templates-v2.png
Canvas: exactly 1586 x 992 CSS pixels.

Start from the current selected candidate but repair the source mismatches. The current candidate already has the correct `UNIVIEW 固定资产管理系统` brand and the bottom cards are visible. Preserve those improvements.

Hard geometry budget:
- Top nav: y=0..50.
- Page header/title/buttons/status: y=50..160.
- Filter row: y=168..225.
- Upper panels: y=238..688.
- Bottom cards: y=700..956.
- Nothing required may extend below y=956 except page background.
- No page-level scroll. No internal scroll containers in the upper panels or rich editor.

Required source shell:
- Top-left brand must remain exact: `UNIVIEW 固定资产管理系统`.
- Top nav labels: `资产管理`, `财务管理`, `报表中心`, `系统设置`, active `系统运营中枢`.
- Right side: badge `12`, `平台运维`.
- Left sidebar active group `消息与通知`, active item `邮件模板`.

Header:
- Title `邮件模板配置台`.
- Subtitle `管理流程邮件与通知邮件的标题、正文、变量、版本和引用流程。`
- Buttons in one horizontal row: `新建模板`, `保存草稿`, `提交校验`, `模板预览`, `发布`.
- Status strip: `草稿已保存`, `变量校验通过`, `当前版本 V3`, `更新人 平台运维`, `更新时间 2026-06-18 15:20`.

Filter row must be restored exactly:
- A search input whose placeholder is exactly `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Separate compact dropdowns, all visible in one row:
  - label `状态`, value `全部`
  - label `场景`, value `全部`
  - label `语言`, value `全部`
  - label `引用流程`, value `全部`
  - label `变量完整度`, value `全部`
- Right reset button `重置`.
- Do not collapse the filter row into only `状态：全部`.

Upper-left panel:
- Add the panel title `邮件模板列表` above the table.
- Table columns must include `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Four source rows must remain visible:
  1. `CIP 转固审批通知`, `MAIL_CIP_APPROVAL`, `CIP 转固`, `CIP 转固流程`, `中文(简体)`, `8/8 完整`, `已发布`, `编辑 复制 更多`
  2. `ERP 回执失败模板`, `MAIL_ERP_FAIL`, `ERP 回执`, `ERP 回执`, `中文(简体)`, `6/7 补齐`, `草稿`, `编辑 复制 更多`
  3. `资产入账完成通知`, `MAIL_FA_POSTED`, `资产入账`, `FA 入账流程`, `中文(简体)`, `7/7 完整`, `已发布`, `编辑 复制 更多`
  4. `SLA 超时升级模板`, `MAIL_SLA_ESCALATE`, `SLA 升级`, `SLA 升级`, `中文(简体)`, `5/6 缺补`, `待校验`, `编辑 复制 更多`
- Footer `共 4 条`, page `1`, `20 条/页`.
- Keep row heights source-dense so the panel ends before y=688.

Upper-right panel:
- Title `模板编辑区`.
- Keep right panel at y=238..688. It must not overlap bottom cards.
- Fields:
  - `模板名称 *` = `CIP 转固审批通知`
  - `模板编码 *` = `MAIL_CIP_APPROVAL`
  - `使用场景` = `CIP 转固`
  - `语言` = `中文(简体)`
  - `邮件主题 *` = `【CIP 转固】{{asset_name}} 转固审批结果通知`
  - `默认网关` = `企业邮箱网关`
  - `当前版本` = `V3`
  - `负责人 *` = `平台运维`
  - `邮件正文 *`
- Rich text body must be compact and fully visible without an internal scrollbar. It may use smaller line-height, but must preserve visible tokens:
  - `{{receiver_name}}`
  - `{{asset_name}}`
  - `{{asset_code}}`
  - `{{capitalization_date}}`
  - `{{erp_receipt_no}}`
- Bottom actions inside editor: `插入变量`, `渲染预览`, `版本对比`, all above y=688.

Bottom cards:
- Place the three cards at y=700..956.
- `变量字典` card:
  - columns `变量名`, `变量来源`, `是否必填`, `示例值`
  - rows `receiver_name`, `asset_name`, `asset_code`, `capitalization_date`, `erp_receipt_no`
  - footer `共 5 条`
- `引用流程` card:
  - columns `流程名称`, `流程编码`, `节点`, `触发事件`
  - rows `CIP 转固流程`, `FA 入账流程`, `ERP 回执失败重试`
  - footer `共 3 条`
- `发布校验清单` card:
  - columns `检查项`, `校验结果`, `说明`
  - rows `变量完整度`, `标题长度`, `渠道适配`, `合规签名`, `测试发送`, `审计记录`
  - button `重新校验`

Final self-check must pass:
- The body text contains `搜索模板名称 / 编码 / 变量 / 引用流程`.
- The body text contains `邮件模板列表`.
- The body text contains `合规签名`.
- The browser screenshot at 1586 x 992 shows the complete bottom three cards.
- No upper panel, editor, or toolbar overlaps the bottom cards.
- No internal `overflow-y:auto`/`scroll` is used to hide source-visible content.
