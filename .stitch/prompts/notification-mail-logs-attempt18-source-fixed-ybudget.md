Edit the selected uploaded IMAGE2 v2 reference screen into a 100/100 pixel-fidelity HTML transcription.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide source-visible content behind scroll.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 邮件日志
Menu id: system-mail-logs
Reference image: notification-subpage-04-mail-logs-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-04-mail-logs-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-logs
Canvas: exactly 1586 x 992.

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Keep the same top shell, sidebar active state, content layout, tables, forms, cards, buttons, colors, borders, typography, spacing, and visible Chinese text.
Do not use any existing Stitch reference draft as the visual source.

Critical source layout and y-budget:
- Whole page must fit exactly inside 1586 x 992. html/body/document scrollWidth must be 1586 and scrollHeight must be 992.
- No `overflow-y-auto`, `overflow-auto`, internal scroll bars, clipped table bodies, or hidden required rows in the source-visible panels.
- Top dark shell y=0..52, dark sidebar x=0..217 y=52..992, main content x=217..1586 y=52..992.
- Header title `邮件日志与重试策略台` at y≈67, subtitle at y≈101.
- Action button row starts around y=124 and must be horizontal under the title: `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- KPI strip is on the same horizontal band to the right: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.
- Filter row y≈170..225 with the full placeholder `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源` and selectors `状态`, `来源流程`, `邮件模板`, `网关`, `时间范围`, `重试次数`, plus `重置` and `高级筛选`.

Upper workspace:
- Left quick queue panel x≈237..446 y≈236..696, title `邮件日志规则 / 快速队列`, exactly four stacked cards:
  1. `SMTP 认证失败批次`, `待重试`, `策略：自动重试 3 次，切换备用网关`, badge `3`
  2. `SLA 超时提醒发送记录`, `需升级`, `策略：延迟重试 2 次，升级处理`, badge `1`
  3. `CIP 邮件回执追踪`, `已归档`, `策略：记录回执，失败标记人工`, badge `12`
  4. `ERP 回执失败通知`, `自动重试`, `策略：自动重试 5 次，人工升级`, badge `2`
- Center table panel x≈455..1200 y≈236..696, title `邮件发送日志`.
  It must show all six source rows without row clipping. Row height target 48px or less. Use normal horizontal table cells, never vertical stacked Chinese text.
  Columns visible: `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
  Rows include:
  `BATCH-20260618-0931`, `CIP 转固审批通知`, `zhangsan@uniview.com +3`, `CIP 转固流程`, `SMTP-01 主通道`, `失败`, `553 Authentication Failed: invalid user`, `1/3`, `2026-06-18 15:28:31`
  `BATCH-20260618-0928`, `ERP 回执失败模板`, `lisi.li@uniview.com +5`, `ERP 回执`, `SMTP-01 主通道`, `重试中`, `Connection timed out`, `2/5`, `2026-06-18 15:22:17`
  `BATCH-20260618-0925`, `SLA 超时升级模板`, `ops@uniview.com +2`, `SLA 升级`, `SMTP-02 备用`, `失败`, `5.7.1 Relay access denied`, `0/2`, `2026-06-18 15:15:06`
  `BATCH-20260618-0912`, `资产入账完成通知`, `caiwu@uniview.com +8`, `FA 入账流程`, `SMTP-01 主通道`, `成功`, `-`, `0/0`, `2026-06-18 14:58:33`
  `BATCH-20260618-0907`, `CIP 转固审批通知`, `wangwu@uniview.com +1`, `CIP 转固流程`, `SMTP-01 主通道`, `失败`, `550 5.1.1 User unknown`, `3/3`, `2026-06-18 14:41:09`
  `BATCH-20260618-0886`, `资产入账完成通知`, `finance@uniview.com +6`, `FA 入账流程`, `SMTP-02 备用`, `成功`, `-`, `0/0`, `2026-06-18 14:25:12`
  Footer must stay visible: `共 286 条`, pagination `1 2 3 4 5 ... 29`, `10 条 / 页`, `跳至 1 页`.
- Right detail panel x≈1212..1570 y≈236..696, title `失败详情与重试策略`.
  It must show source detail rows through `审计说明` and a visible `处理进度` section below them. The timeline must start above y=545 and be visible through y≈650:
  `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
  Bottom action buttons at y≈656..686: `执行重试`, `标记已处理`, `导出取证包`.

Bottom workspace:
- Bottom panels start at y≈707 and end before y=944.
- Left bottom panel x≈237..836 title `失败重试队列`, visible three rows:
  `BATCH-20260618-0931`, `553 Authentication Failed`, `1/3`, `2026-06-18 15:33:31`, `SMTP-02 备用`, `平台运维`, `重试发送 | 详情`
  `BATCH-20260618-0928`, `Connection timed out`, `2/5`, `2026-06-18 15:36:17`, `SMTP-02 备用`, `平台运维`, `重试发送 | 详情`
  `BATCH-20260618-0907`, `550 5.1.1 User unknown`, `3/3`, `2026-06-18 15:20:09`, `SMTP-02 备用`, `itops`, `升级处理 | 详情`
  Footer visible: `共 3 条`, pagination `1`, `10 条 / 页`.
- Right bottom panel x≈847..1570 title `审计取证包`, visible three rows:
  `BATCH-20260618-0931`, `e8b6f2d3d9b4...`, `V3`, `查看快照`, `553 Authentication Failed`, `平台运维`, `未导出`, `生成取证包`
  `BATCH-20260618-0928`, `a47c9e92f6d1...`, `V2`, `查看快照`, `Connection timed out`, `平台运维`, `已导出`, `下载`
  `BATCH-20260618-0907`, `3c1ae7b6f4a0...`, `V2`, `查看快照`, `550 5.1.1 User unknown`, `itops`, `已导出`, `下载`
  Footer visible: `共 3 条`, pagination `1`, `10 条 / 页`.

Hard fail conditions:
- Any table header or row text rendered vertically or one-character-per-line.
- Fewer than six visible rows in the center `邮件发送日志` table.
- Fewer than three visible rows in either bottom table.
- Missing visible `处理进度` timeline in the right panel.
- Page or panel needs scrolling to reveal source-visible rows.
- Placeholder text such as `Main Content Layout Omitted`.
- Emoji-style replacement icons or decorative generic admin template elements.
