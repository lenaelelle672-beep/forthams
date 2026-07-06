100/100 pixel-fidelity transcription from the selected uploaded IMAGE2 screenshot only. Not a redesign.

Page: 邮件日志与重试策略台. Source: notification-subpage-04-mail-logs-v2.png. Canvas exactly 1586 x 992.

Brand and shell:
- Top-left brand exactly white `UNIVIEW` followed by `固定资产管理系统`; no extra logo mark before UNIVIEW.
- Top nav source order: 资产管理, 财务管理, 报表中心, 系统设置, 系统运营中枢(active).
- Left dark sidebar: 消息与通知 expanded, 邮件日志 selected.

Header:
- Title 邮件日志与重试策略台.
- Subtitle: 追踪流程邮件发送批次、失败原因、重试队列、备用网关和审计取证。
- Buttons: 新建重试策略, 保存草稿, 提交校验, 重试预演, 导出取证包.
- Status strip: 待处理失败 5, 今日发送 1,286, 成功率 98.7%, 重试队列 3, 审计留痕 已启用, 最近同步 2026-06-18 15:32.

Filter row:
- Search placeholder: 搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源.
- Filters: 状态, 来源流程, 邮件模板, 网关, 时间范围 近 24 小时, 重试次数, 重置, 高级筛选.

Main three-column area:
- Left panel: 邮件日志规则 / 快速队列.
  Cards: SMTP 认证失败批次, SLA 超时提醒发送记录, CIP 邮件回执追踪, ERP 回执失败通知.
- Center panel: 邮件发送日志.
  Columns: 批次号, 模板/场景, 收件人, 来源流程, 网关, 状态, 失败原因, 重试次数, 最近发送, 操作.
  Six rows must be visible: BATCH-20260618-0931, 0928, 0925, 0912, 0907, 0886.
- Right panel: 失败详情与重试策略.
  Must show BATCH-20260618-0931, MAIL_LOG_20260618_0931, Node_Approve, 553 Authentication Failed, SMTP-01 主通道, SMTP-02 备用, 平台运维, and the progress timeline.
  Buttons visible at bottom: 执行重试, 标记已处理, 导出取证包.

Bottom area:
- Left bottom panel: 失败重试队列 with three rows and pagination inside the panel.
- Right bottom panel: 审计取证包 with three rows and pagination inside the panel.
- Visible bottom actions/text: 重试发送, 升级处理, 生成取证包, 下载.

Layout:
- No page-level scroll: document size 1586 x 992.
- No internal hidden overflow that clips required rows, bottom tables, or right panel buttons.
- Compact 12-14px typography; white panels; 1px pale blue borders; blue action buttons; green/orange/red status chips; radius <= 8px.

Hard reject:
- Do not hide any of the six center log rows.
- Do not hide the bottom two panels.
- Do not hide right-side action buttons.
- Do not use generic admin shell or wrong top nav.
