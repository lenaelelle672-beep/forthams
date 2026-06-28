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
Viewport: exactly 1586 x 992. No document scroll and no horizontal overflow.

Use the source screenshot geometry, not a generic admin dashboard:
- Top dark shell: y=0..52, active top item `系统运营中枢`.
- Left sidebar: x=0..217, y=52..992; active group `消息与通知`; active item `邮件日志`.
- Main content frame: x=237..1570, y=66..942.
- Header title/actions band: y=66..158.
- Filter band: y=169..224.
- Middle grid band: y=238..696.
- Bottom grid band: y=707..941.

Critical repair from attempt 1:
- Keep the right detail card inside the viewport at x=1213..1570. Do not push it offscreen.
- The center table card must stay at x=455..1201. Its columns may be compact, but the card may not exceed x=1201.
- The left quick queue card must stay at x=237..447.
- The bottom left `失败重试队列` card must stay at x=237..836, y=707..941.
- The bottom right `审计取证包` card must stay at x=848..1570, y=707..941.
- Do not use emoji glyphs anywhere. No ⚙️, 📧, 🔁, 📦, ✅, ❌, or emoji-like colored symbols. Use source-like small line icons only.
- All visible table text must be horizontal. Do not stack Chinese characters or IDs vertically.
- No required rows hidden behind scrollbars. Avoid `overflow-auto`, `overflow-y-auto`, and `overflow-x-auto` for the source-visible cards.

Brand and shell:
- Preserve the exact source top-left white `UNIVIEW 固定资产管理系统` lockup in the navy top bar.
- Keep the source icon/spacing treatment in the top navigation and sidebar.
- Do not split letters, redraw the brand, or add a separate round play icon.

Header band:
- Title: `邮件日志与重试策略台`.
- Subtitle: `追踪流程邮件发送批次、失败原因、重试队列、备用网关和审计取证。`
- Buttons in source order: `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- Status strip on the right: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.

Filter row:
- Search placeholder: `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源`.
- Controls: `状态 全部`, `来源流程 全部`, `邮件模板 全部`, `网关 全部`, `时间范围 近 24 小时`, `重试次数 全部`, `重置`, `高级筛选`.

Left quick queue card:
- Title exactly `邮件日志规则 / 快速队列`.
- Header has only a small source-like line settings icon, not emoji.
- Four stacked cards:
  1. `SMTP 认证失败批次`, badge `待重试`, count `3`, text `适用场景：认证失败账号异常`, `策略：自动重试 3 次，切换备用网关`.
  2. `SLA 超时提醒发送记录`, badge `需升级`, count `1`, text `适用场景：SLA 提醒类邮件`, `策略：延迟重试 2 次，升级处理`.
  3. `CIP 邮件回执追踪`, badge `已归档`, count `12`, text `适用场景：CIP 流程邮件回执`, `策略：记录回执，失败标记人工`.
  4. `ERP 回执失败通知`, badge `自动重试`, count `2`, text `适用场景：ERP 回执失败类`, `策略：自动重试 5 次，人工升级`.

Center table card:
- Title exactly `邮件发送日志`.
- Columns: `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
- Show exactly these 6 visible rows in order:
  1. `BATCH-20260618-0931`, `CIP 转固审批通知`, `zhangsan@uniview.com`, `+3`, `CIP 转固流程`, `SMTP-01 主通道`, `失败`, `553 Authentication Failed: invalid user`, `1/3`, `2026-06-18 15:28:31`, `查看`, `重试`, `更多`.
  2. `BATCH-20260618-0928`, `ERP 回执失败模板`, `lisa.li@uniview.com`, `+5`, `ERP 回执`, `SMTP-01 主通道`, `重试中`, `Connection timed out`, `2/5`, `2026-06-18 15:22:17`, `查看`, `重试`, `更多`.
  3. `BATCH-20260618-0925`, `SLA 超时升级模板`, `ops@uniview.com`, `+2`, `SLA 升级`, `SMTP-02 备用`, `失败`, `5.7.1 Relay access denied`, `0/2`, `2026-06-18 15:15:06`, `查看`, `重试`, `更多`.
  4. `BATCH-20260618-0912`, `资产入账完成通知`, `caiwu@uniview.com`, `+8`, `FA 入账流程`, `SMTP-01 主通道`, `成功`, `-`, `0/0`, `2026-06-18 14:58:33`, `查看`, `详情`, `更多`.
  5. `BATCH-20260618-0907`, `CIP 转固串联通知`, `wangwu@uniview.com`, `+1`, `CIP 转固流程`, `SMTP-01 主通道`, `失败`, `550 5.1.1 User unknown`, `3/3`, `2026-06-18 14:41:09`, `查看`, `重试`, `更多`.
  6. `BATCH-20260618-0886`, `资产入账完成通知`, `finance@uniview.com`, `+6`, `FA 入账流程`, `SMTP-02 备用`, `成功`, `-`, `0/0`, `2026-06-18 14:25:12`, `查看`, `详情`, `更多`.
- Footer visible: `共 286 条`, page buttons `1`, `2`, `3`, `4`, `5`, `...`, `29`, `10 条 / 页`, `跳至`, `1`, `页`.
- Compact the table with source-like font size and row height; do not make the table wider than the source card.

Right detail card:
- Title exactly `失败详情与重试策略`.
- Current batch value in red: `BATCH-20260618-0931`.
- Rows: `日志名称 CIP 转固审批通知`, `日志编码 MAIL_LOG_20260618_0931`, `日志来源 系统自动触发`, `触发节点 Node_Approve（CIP 转固审批）`, `收件人 zhangsan@uniview.com 等 4 人`, `失败触发 2026-06-18 15:26:12`, `重试通道 SMTP-01 主通道`, `备用网关 SMTP-02 备用`, `处理策略 自动重试 3 次，切换备用网关`, `负责人 平台运维`, `审计说明 SMTP 认证失败，凭证可能过期或配置错误。`
- Section `处理进度` with four timeline items: `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
- Bottom buttons visible in one row: `执行重试`, `标记已处理`, `导出取证包`.

Bottom row:
- Left card title `失败重试队列`; show 3 rows with columns `批次号`, `失败原因`, `重试次数`, `下次重试时间`, `备用网关`, `升级负责人`, `操作`.
- Right card title `审计取证包`; show 3 rows with columns `批次号`, `Payload Hash`, `模板版本`, `变量快照`, `SMTP 响应`, `操作人`, `导出状态`, `操作`.
- Preserve source-like footer counts and pagination controls in both bottom cards.

Final self-check before completion:
- Browser frame is exactly 1586 x 992.
- The right detail card is fully visible; no content is offscreen to the right.
- Six center table rows are visible.
- Both bottom tables are visible.
- No emoji glyph appears anywhere.
- No horizontal page overflow and no card-level horizontal overflow.
