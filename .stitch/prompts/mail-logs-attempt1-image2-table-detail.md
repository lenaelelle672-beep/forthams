Create a complete 100/100 pixel-fidelity HTML transcription of the selected uploaded IMAGE2 v2 screenshot.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 邮件日志
Menu id: system-mail-logs
Reference image: notification-subpage-04-mail-logs-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-04-mail-logs-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-logs
Viewport: exactly 1586 x 992. No document scroll.

Brand and shell:
- Preserve source top-left white `UNIVIEW 固定资产管理系统` lockup in the navy top bar.
- Active top module: `系统运营中枢`.
- Left sidebar active section: `消息与通知`; active item: `邮件日志`.
- No emoji glyphs anywhere. Use line icons/vector shapes only.

Header band:
- Title: `邮件日志与重试策略台`.
- Subtitle: `追踪流程邮件发送批次、失败原因、重试队列、备用网关和审计取证。`
- Buttons: `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- Right status strip: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.

Filter row:
- Search placeholder `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源`.
- Select labels: `状态 全部`, `来源流程 全部`, `邮件模板 全部`, `网关 全部`, `时间范围 近 24 小时`, `重试次数 全部`.
- Buttons: `重置`, `高级筛选`.

Main content band:
- Left quick queue card title: `邮件日志规则 / 快速队列`, with 4 stacked items:
  `SMTP 认证失败批次` badge `待重试` count `3`;
  `SLA 超时提醒发送记录` badge `需升级` count `1`;
  `CIP 邮件回执追踪` badge `已归档` count `12`;
  `ERP 回执失败通知` badge `自动重试` count `2`.
- Center large table card title: `邮件发送日志`.
- Table columns: `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
- Show exactly 6 visible rows:
  BATCH-20260618-0931 / CIP 转固审批通知 / zhangsan@uniview.com +3 / CIP 转固流程 / SMTP-01 主通道 / 失败 / 553 Authentication Failed: invalid user / 1/3 / 2026-06-18 15:28:31 / 查看 重试 更多
  BATCH-20260618-0928 / ERP 回执失败模板 / lisa.li@uniview.com +5 / ERP 回执 / SMTP-01 主通道 / 重试中 / Connection timed out / 2/5 / 2026-06-18 15:22:17 / 查看 重试 更多
  BATCH-20260618-0925 / SLA 超时升级模板 / ops@uniview.com +2 / SLA 升级 / SMTP-02 备用 / 失败 / 5.7.1 Relay access denied / 0/2 / 2026-06-18 15:15:06 / 查看 重试 更多
  BATCH-20260618-0912 / 资产入账完成通知 / caiwu@uniview.com +8 / FA 入账流程 / SMTP-01 主通道 / 成功 / - / 0/0 / 2026-06-18 14:58:33 / 查看 详情 更多
  BATCH-20260618-0907 / CIP 转固串联通知 / wangwu@uniview.com +1 / CIP 转固流程 / SMTP-01 主通道 / 失败 / 550 5.1.1 User unknown / 3/3 / 2026-06-18 14:41:09 / 查看 重试 更多
  BATCH-20260618-0886 / 资产入账完成通知 / finance@uniview.com +6 / FA 入账流程 / SMTP-02 备用 / 成功 / - / 0/0 / 2026-06-18 14:25:12 / 查看 详情 更多
- Pagination footer: `共 286 条`, pages `1 2 3 4 5 ... 29`, `10 条 / 页`, `跳至 1 页`.

Right detail card:
- Title: `失败详情与重试策略`.
- Current batch red value: `BATCH-20260618-0931`.
- Detail rows include: `日志名称 CIP 转固审批通知`, `日志编码 MAIL_LOG_20260618_0931`, `日志来源 系统自动触发`, `触发节点 Node_Approve（CIP 转固审批）`, `收件人 zhangsan@uniview.com 等 4 人`, `失败触发 2026-06-18 15:26:12`, `重试通道 SMTP-01 主通道`, `备用网关 SMTP-02 备用`, `处理策略 自动重试 3 次，切换备用网关`, `负责人 平台运维`, `审计说明 SMTP 认证失败，凭证可能过期或配置错误`.
- Progress section `处理进度` with four timeline items:
  `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
- Bottom buttons: `执行重试`, `标记已处理`, `导出取证包`.

Bottom band:
- Left bottom table title: `失败重试队列`, show 3 rows with batch, failure reason, retry count, next retry time, backup gateway, escalation owner, actions.
- Right bottom table title: `审计取证包`, show 3 rows with batch, payload hash, template version, variable snapshot, SMTP response, operator, export status, action.

Layout hard gates:
- No blank lower half. The page must have visible content from top to bottom.
- All cards, tables, and detail panel are visible in the 1586 x 992 viewport.
- No vertical text stacking; all Chinese and IDs horizontal.
- No hidden required rows behind scrollbars.
- No emoji.
