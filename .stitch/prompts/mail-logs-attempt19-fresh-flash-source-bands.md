Edit the selected uploaded IMAGE2 v2 screenshot into a Stitch DESIGN HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot:
white `UNIVIEW`, the visible adjacent text `固定资产管理系统`, and the same top shell spacing.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not add a leading icon before UNIVIEW.

Page name: 邮件日志
Menu id: system-mail-logs
Reference image: notification-subpage-04-mail-logs-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-04-mail-logs-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-logs

Canvas and shell:
- Fixed viewport and document size: exactly 1586 x 992.
- No page-level vertical or horizontal scroll.
- Top dark navigation height about 51px; active top tab `系统运营中枢`.
- Left dark sidebar width about 217px; section `消息与通知` expanded; active item `邮件日志`.
- Content starts at x=237 and y=67.

Header and actions:
- Title: `邮件日志与重试策略台`.
- Subtitle: `追踪流程邮件发送批次、失败原因、重试队列、备用网关和审计取证。`
- Header buttons, in source order: `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- KPI strip: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.

Filter row:
- Search placeholder: `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源`.
- Filter labels: `状态`, `来源流程`, `邮件模板`, `网关`, `时间范围`, `重试次数`.
- Buttons: `重置`, `高级筛选`.

Main content geometry:
- Upper workspace y=236..696.
- Left quick queue panel x=237..447, title `邮件日志规则 / 快速队列`, exactly four stacked cards:
  `SMTP 认证失败批次`, `SLA 超时提醒发送记录`, `CIP 邮件回执追踪`, `ERP 回执失败通知`.
- Center log table x=455..1203, title `邮件发送日志`.
- Right detail panel x=1212..1568, title `失败详情与重试策略`.
- Bottom row y=707..941.
- Bottom-left card x=237..836, title `失败重试队列`.
- Bottom-right card x=847..1568, title `审计取证包`.

Center table requirements:
- Column labels must be visible and horizontal: `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
- Show all 6 rows within the center table without internal scrolling:
  `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0925`, `BATCH-20260618-0912`, `BATCH-20260618-0907`, `BATCH-20260618-0886`.
- Required failure texts include `553 Authentication Failed: invalid user`, `Connection timed out`, `5.7.1 Relay access denied`, and `550 5.1.1 User unknown`.
- Status chips include `失败`, `重试中`, and `成功`.
- Keep row height compact so the pagination line is visible: `共 286 条`, pages `1 2 3 4 5 ... 29`, and `10 条 / 页`.

Right detail panel requirements:
- Current batch `BATCH-20260618-0931` in red.
- Labels and values visible: `日志名称`, `日志编码`, `日志来源`, `触发节点`, `收件人`, `失败触发`, `重试通道`, `备用网关`, `处理策略`, `负责人`, `审计说明`.
- Show the `处理进度` timeline with four rows: `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
- Bottom action buttons visible: `执行重试`, `标记已处理`, `导出取证包`.

Bottom tables:
- `失败重试队列` table columns: `批次号`, `失败原因`, `重试次数`, `下次重试时间`, `备用网关`, `升级负责人`, `操作`.
- Show 3 rows and action text including `重试发送`, `升级处理`, `详情`.
- `审计取证包` table columns: `批次号`, `Payload Hash`, `模板版本`, `变量快照`, `SMTP 响应`, `操作人`, `导出状态`, `操作`.
- Show 3 rows and action text including `查看快照`, `生成取证包`, `下载`.

Visual constraints:
- Use compact 12-14px Chinese typography like the source.
- White panels with 1px pale blue borders, <=8px radius, no oversized card styling.
- Blue primary buttons, red/orange/green status chips as in the screenshot.
- No emoji glyphs. Use small monochrome line icons only where the source has icons.
- Do not hide source-visible content behind scrollbars.

Reject the result if:
- Center table has fewer than 6 visible rows.
- Right panel bottom buttons are outside the first viewport.
- Bottom two cards are clipped, stacked vertically, or missing row content.
- Text becomes vertical/stacked because a column is too narrow.
- The page looks like a generic admin dashboard instead of a direct transcription.
