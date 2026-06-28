Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Do not use old Stitch drafts as the visual source.
Do not simplify or replace with a generic admin template.

Page name: 邮件日志与重试策略台
Menu id: system-mail-logs
Reference image: notification-subpage-04-mail-logs-v2.png
Canvas: exactly 1586 x 992 CSS pixels.

Hard geometry:
- Document must be exactly 1586 x 992 with no page scroll.
- Top shell y=0..50.
- Sidebar x=0..217. Main content x=217..1586.
- Header/actions/status/filter occupy y=64..226.
- Main upper workspace y=238..696.
- Bottom row y=708..944.
- No internal scrollbars in center table, right detail, or bottom tables.

Source shell:
- Brand exactly `UNIVIEW 固定资产管理系统`.
- Top nav: `资产管理`, `财务管理`, `报表中心`, `系统设置`, active `系统运营中枢`.
- Sidebar `消息与通知` expanded, active `邮件日志`.

Header:
- Title `邮件日志与重试策略台`.
- Subtitle `追踪流程邮件发送批次、失败原因、重试队列、备用网关和审计取证。`
- Buttons: `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- Status strip values: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.
- Filter placeholder exactly `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源`.

Upper workspace:
1. Left panel `邮件日志规则 / 快速队列`
- Four compact cards: `SMTP 认证失败批次`, `SLA 超时提醒发送记录`, `CIP 邮件回执追踪`, `ERP 回执失败通知`.
- Card height about 88px; no giant blank area.

2. Center panel `邮件发送日志`
- Must visibly show all six rows in the viewport:
  - `BATCH-20260618-0931`
  - `BATCH-20260618-0928`
  - `BATCH-20260618-0925`
  - `BATCH-20260618-0912`
  - `BATCH-20260618-0907`
  - `BATCH-20260618-0886`
- Row height must be compact like source, about 44px to 48px.
- Columns: `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
- Include visible failure texts `553 Authentication Failed: invalid user`, `5.7.1 Relay access denied`, `550 5.1.1 User unknown`.
- Footer inside center panel: `共 286 条`, pages `1 2 3 4 5 ... 29`, `10 条/页`, `跳至 1 页`.
- Do not stack table text vertically. Do not show only 3 rows.

3. Right panel `失败详情与重试策略`
- Visible fields include `BATCH-20260618-0931`, `MAIL_LOG_20260618_0931`, `Node_Approve`, `zhangsan@uniview.com 等 4 人`, `SMTP-01 主通道`, `SMTP-02 备用`, `平台运维`.
- Visible process section `处理进度` with `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
- Bottom buttons visible: `执行重试`, `标记已处理`, `导出取证包`.

Bottom row:
- Left `失败重试队列` table has three visible rows:
  `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0907`.
- Right `审计取证包` table has three visible rows:
  `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0907`.
- Visible actions/text: `重试发送`, `升级处理`, `生成取证包`, `下载`, `共 3 条`.
- Bottom tables and pagination must remain inside y<=944.

Hard reject:
- Center table shows fewer than six rows.
- Bottom row starts below y=730 or is clipped.
- Any source-visible row is hidden in overflow.
- Search placeholder is shortened or changed.
- Page uses emoji icons or a generic admin shell.
