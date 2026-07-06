100/100 pixel-fidelity transcription from the selected uploaded IMAGE2 screenshot only. Not a redesign.

Page: 邮件模板配置台. Source: notification-subpage-03-mail-templates-v2.png. Canvas exactly 1586 x 992.

Critical corrections required:
- Top-left brand must be exactly white `UNIVIEW` followed by `固定资产管理系统`; do not add an infinity/link logo or any blue logo mark before UNIVIEW.
- Keep the source top nav order: 资产管理, 财务管理, 报表中心, 系统设置, 系统运营中枢(active).
- The right panel `模板编辑区` must show the source-visible editor labels and fields without internal scroll:
  模板名称 *, 模板编码 *, 使用场景, 语言, 邮件主题 *, 默认网关, 当前版本 V3, 负责人 *, 邮件正文 *.
- The `邮件正文 *` rich text area must be visible and include the toolbar and source variable tags:
  {{receiver_name}}, {{asset_name}}, {{asset_code}}, {{capitalization_date}}, {{erp_receipt_no}}.
- Bottom action buttons on the editor must be visible: 插入变量, 渲染预览, 版本对比.
- Bottom three panels must be visible: 变量字典, 引用流程, 发布校验清单.
- The 发布校验清单 bottom-right `重新校验` button must sit inside the panel and not overlap or float outside.

Required visible exact data:
- Search placeholder: 搜索模板名称 / 编码 / 变量 / 引用流程.
- Table rows: CIP 转固审批通知, ERP 回执失败模板, 资产入账完成通知, SLA 超时升级模板.
- Completeness chips: 8/8 完整, 6/7 补齐, 7/7 完整, 5/6 缺补.
- Language: 中文（简体）.
- Editor values: MAIL_CIP_APPROVAL, 【CIP 转固】{{asset_name}} 转固审批结果通知, 企业邮箱网关, 平台运维.
- Bottom variables: receiver_name, asset_name, asset_code, capitalization_date, erp_receipt_no.
- Publish checklist: 变量完整度, 标题长度, 渠道适配, 合规签名, 测试发送, 审计记录.

Layout:
- No page-level scroll: document size must be 1586 x 992.
- No right editor internal scrollbar.
- Keep compact row heights and source panel positions.
- Use white panels, 1px pale borders, blue action buttons, green/orange/red status chips, radius <= 8px.

Hard reject:
- No infinity/link icon before UNIVIEW.
- Do not hide `邮件正文 *`.
- Do not cover `重新校验`.
- Do not use generic admin shell.
