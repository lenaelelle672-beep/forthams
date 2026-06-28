100/100 pixel-fidelity transcription from the uploaded IMAGE2 screenshot only.

Critical repair:
- Previous candidate showed only 3 center log rows. The source screenshot shows all 6 center rows.
- The center `邮件发送日志` table must show these six rows visibly above the bottom panels:
  BATCH-20260618-0931, BATCH-20260618-0928, BATCH-20260618-0925, BATCH-20260618-0912, BATCH-20260618-0907, BATCH-20260618-0886.
- Reduce center table row height to match the source. Do not use tall 120px rows.
- Bottom panels must start around y=708, not y=785.

Keep the source:
- Canvas exactly 1586 x 992, no page scroll.
- UNIVIEW 固定资产管理系统 exact brand, no extra logo.
- Top nav: 资产管理, 财务管理, 报表中心, 系统设置, 系统运营中枢 active.
- Sidebar 消息与通知 expanded, 邮件日志 selected.
- Title 邮件日志与重试策略台.
- Buttons: 新建重试策略, 保存草稿, 提交校验, 重试预演, 导出取证包.
- Filter placeholder must be exact: 搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源.

Main layout:
- Left `邮件日志规则 / 快速队列` panel: 4 compact cards.
- Center `邮件发送日志`: compact table with 6 visible rows and pagination below.
- Right `失败详情与重试策略`: details and progress timeline, with 执行重试, 标记已处理, 导出取证包 visible.
- Bottom row: 失败重试队列 and 审计取证包, each with 3 rows and pagination visible.

Hard reject:
- Center table fewer than 6 visible rows.
- Bottom row hidden or pushed below viewport.
- Right action buttons hidden.
- Placeholder shortened or renamed.
