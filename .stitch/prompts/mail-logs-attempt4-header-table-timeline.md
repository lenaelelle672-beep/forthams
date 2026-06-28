Edit the existing mail logs DESIGN screen. Keep the attempt3 three-column/bottom-grid geometry, but repair the remaining IMAGE2 source mismatches.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The source screenshot is `notification-subpage-04-mail-logs-v2.png`.
The output must fit exactly in the first 1586 x 992 viewport with no document scroll.

Do not change these attempt3 improvements:
- Right `失败详情与重试策略` card stays visible at x=1213..1570.
- Bottom `失败重试队列` and `审计取证包` cards stay visible at y=707..941.
- No emoji glyphs.
- Main table text remains horizontal, not vertical stacked.

Repair these exact remaining failures:

1. Header and filter geometry must match the IMAGE2 source:
- Top title band is y=66..158.
- `邮件日志与重试策略台` and subtitle are at left.
- Action buttons `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包` sit under the subtitle on the left side, as a horizontal row, not stacked and not pushed to the far top-right.
- Status strip `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32` sits on the right side of the same header band.
- Filter band is y=169..224 and contains the search box plus dropdowns/buttons in one horizontal source-like row.

2. Main table must show six fully visible body rows:
- The table card is x=455..1201 and y=238..696.
- Title/header y budget must be compact enough that all six rows and pagination are visible before y=696.
- The sixth row `BATCH-20260618-0886` must be fully visible, not cut by the footer.
- Keep all table cells horizontal. Use ellipsis for long content if necessary, but do not wrap IDs into multiple lines.
- Row ids visible: `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0925`, `BATCH-20260618-0912`, `BATCH-20260618-0907`, `BATCH-20260618-0886`.
- Footer visible: `共 286 条`, page controls, `10 条 / 页`, `跳至 1 页`.

3. Right detail must include the source `处理进度` timeline:
- Keep all detail rows currently visible.
- Below `审计说明`, show divider and section title `处理进度`.
- Show four timeline items in order: `触发邮件`, `SMTP 失败（553 Authentication Failed）`, `加入重试队列（第 1 次）`, `备用网关待执行`.
- Keep bottom buttons visible: `执行重试`, `标记已处理`, `导出取证包`.
- If vertical space is tight, reduce right-row line-height and padding; do not remove the timeline.

4. Left quick queue must show all four source cards:
- `SMTP 认证失败批次`, `SLA 超时提醒发送记录`, `CIP 邮件回执追踪`, `ERP 回执失败通知`.
- Do not hide the fourth card behind an internal scroll.

Hard reject conditions:
- Header buttons vertical or far top-right.
- Any emoji glyph.
- Any main table ID split across multiple lines.
- Fewer than six visible main table rows.
- Missing `处理进度`.
- Missing bottom two cards.
- Document wider or taller than 1586 x 992.
