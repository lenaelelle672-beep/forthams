Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not use old Stitch drafts as the visual source.

Page name: 流程邮件配置
Menu id: system-workflow-mail
Reference image: notification-subpage-02-workflow-mail-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-02-workflow-mail-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-workflow-mail
Canvas: exactly 1586 x 992 CSS pixels.

Absolute layout contract:
- No page-level scroll: documentElement scrollWidth=1586 and scrollHeight=992.
- No internal overflow-y scroll containers in any table, rule detail, right editor, or bottom card.
- Top nav y=0..54.
- Sidebar x=0..212, content x=212..1586.
- Header/actions y=64..150.
- Filter row y=156..207.
- Upper workspace y=216..657.
- Bottom tier y=670..954.
- Keep all source-visible text inside the 992px viewport.

Top shell and sidebar:
- Preserve exact source brand: `UNIVIEW 固定资产管理系统`.
- Top nav labels: `资产运营总览`, `数据监控中心`, `资产运维中心`, `风险预警中心`, active `系统运营中枢`.
- Right side: badge `12`, help, settings, avatar, `超级管理员`.
- Left sidebar active group `消息与通知`, active item `流程邮件配置`.
- Visible sidebar includes `邮件网关配置`, `流程邮件配置`, `邮件模板`, `邮件日志`, `通知模板`, `通知渠道`, `通知偏好`, `流程通知开关`, and `系统参数`.

Header and filter:
- Title `流程邮件配置台`.
- Buttons: `新建规则`, `复制规则`, `发送预演`, `保存草稿`, `提交校验`.
- Filter search placeholder: `搜索流程 / 节点 / 模板 / 收件人`.
- Filters: `流程类型 全部`, `邮件模板 全部`, `发送状态 全部`, `校验状态 全部`.

Upper-left panel `流程邮件规则`:
- Columns: selection, `流程`, `节点事件`, `邮件模板`, `引用网关`, `收件人规则`, `静默条件`, `状态`, `操作`.
- Five source rows visible:
  1. `CIP 转固流程`, `转固完成`, `CIP 转固通知`, `MAIL-GW-001`, `固定资产管理员`, `无`, `已发布`, `编辑 复制 ...`
  2. `资产入账流程`, `入账完成`, `入账完成通知`, `MAIL-GW-001`, `资产使用门负责人`, `无`, `已发布`, `编辑 复制 ...`
  3. `资产处置流程`, `处置完成`, `处置完成通知`, `MAIL-GW-001`, `资产处置审批人`, `金额>5000`, `草稿`, `编辑 复制 ...`
  4. `隐患扣款流程`, `扣款完成`, `扣款提醒通知`, `MAIL-GW-002`, `财务会计`, `节假日静默`, `已发布`, `编辑 复制 ...`
  5. `SLA 超时升级`, `超时升级`, `SLA升级通知`, `MAIL-GW-001`, `运维责任人`, `超时>24小时`, `已发布`, `编辑 复制 ...`
- Footer `共 5 条`, pagination `1`, `20 条 / 页`.
- Keep table text horizontal. Do not make `已发布` vertical.

Upper-middle panel `CIP 转固流程邮件规则`:
- Title with green tag `已发布`.
- Flow node cards: `提交`, `资产管理员审批`, `财务复核`, `转固完成`.
- Each node shows toggles for `发送邮件`, `站内通知`, `钉钉 H5`.
- Detail rows below the flow must be visible in this panel:
  - `邮件模板` `CIP 转固完成通知（模板ID：TMP-CIP-001）` with `查看`
  - `邮件网关` `MAIL-GW-001（smtp.uniview.com:587）` with `健康`
  - `收件人规则` `流程发起人主管；资产归属部门负责人；固定资产管理员`
  - `抄送规则` `固定资产管理员；财务资产会计`
  - `静默条件` `节假日静默（国家法定节假日 08:00-20:00 不发送）`
  - `失败重试` `3 次，间隔 10 分钟`
  - `附件策略` `自动生成转固单 PDF 附件`
  - `审计要求` `记录成功与失败详情`

Upper-right panel `规则字段维护`:
- Title `规则字段维护`.
- Fields in order:
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
- Buttons at panel bottom: `保存草稿`, `发送预演`, `提交校验`.
- All fields and buttons must be visible; no lower fields clipped by a floating button strip.

Bottom tier:
- Left card `邮件预览`:
  - subject begins `【UNIVIEW】资产转固已完成（${asset_code}）`
  - visible body includes `${receiver_name}`, `${asset_name}`, `${asset_code}`, `${capitalization_date}`
  - button `预览完整邮件`
- Middle-left card `变量映射`:
  - rows `${receiver_name}`, `${asset_name}`, `${asset_code}`, `${capitalization_date}`, `${project_code}`
  - buttons/links `添加变量映射`, `管理变量`
- Middle/right composite `发送预演与发布校验`:
  - `发送预演（节点：转固完成）`
  - recipients `张三`, `李四`, `王五`
  - button `重新预演`
  - `渲染结果`, `网关与校验`, `最近审计记录`
  - visible checks `主题渲染 正常`, `正文渲染 正常`, `附件生成 转固单.pdf`, `TLS 安全 正常`, `审计记录 已记录`
  - link `查看完整日志`.

Failure patterns to avoid:
- Do not use internal `overflow-y-auto` or `overflow-y-scroll`.
- Do not clip right editor lower fields.
- Do not hide center detail rows after `静默条件`.
- Do not squeeze `最近审计记录` into a narrow wrapped strip.
- Do not omit exact `发送预演（节点：转固完成）`.
- Do not turn table statuses or values into vertical stacks.

Final self-check:
- Browser screenshot at 1586 x 992 shows all upper panels and bottom cards.
- Text contains `抄送规则`, `静默条件`, `失败重试`, `附件策略`, `审计要求`, and exact `发送预演（节点：转固完成）`.
- No internal scroll containers are needed for source-visible content.
