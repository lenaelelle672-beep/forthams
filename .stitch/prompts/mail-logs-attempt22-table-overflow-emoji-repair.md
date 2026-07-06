Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This remains a strict 100/100 transcription of `notification-subpage-04-mail-logs-v2.png`.
Do not redesign the page. Preserve the current shell, header, filters, three-column layout, right panel, and bottom cards.

Repair only these export-verification failures:

1. Center `邮件发送日志` table density
- The six batch rows must all be visible in the first viewport inside the center table.
- Place the six rows between y=332 and y=642.
- Each row height should be about 47-50px.
- Batch IDs must be single-line horizontal text with no line breaks:
  `BATCH-20260618-0931`
  `BATCH-20260618-0928`
  `BATCH-20260618-0925`
  `BATCH-20260618-0912`
  `BATCH-20260618-0907`
  `BATCH-20260618-0886`
- Reduce font size to 9-11px if needed. Do not split `BATCH-20260618-0931` across lines.
- Keep the column header `最近发送`, not `最后发送`.

2. Remove visible/internal scroll containers
- Do not use `overflow:auto` or `overflow:scroll` on sidebar, quick queue panel, center table, right panel, or bottom tables.
- Use `overflow:hidden` only if needed, but all source-visible rows above must remain visible.

3. Remove emoji glyphs
- Replace remaining pictographic/emoji characters with plain text or simple CSS line-icon placeholders.
- No emoji characters may remain in body text, including 📅, ⚙, ❓, 🔔, 👁, ✔, ☑, 📄.

4. Preserve already-good areas
- Keep documentElement/body exactly 1586 x 992.
- Keep `失败重试队列`, `审计取证包`, `生成取证包`, and `下载` visible in the bottom band.
- Keep right panel buttons `执行重试`, `标记已处理`, `导出取证包` visible.
- Keep required text `处理进度`.

Forbidden:
- `最后发送`
- emoji characters
- internal scrollbars
- page scroll
- vertical/stacked Chinese or batch-id text
