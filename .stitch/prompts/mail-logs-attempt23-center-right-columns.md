Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a narrow 100/100 transcription repair for `notification-subpage-04-mail-logs-v2.png`.
Do not redesign the page. Preserve the current fixed 1586 x 992 no-scroll layout, six visible table rows, right panel, bottom cards, no emoji state, and no internal scroll containers.

Only repair the center `邮件发送日志` table right-side columns.

Current issue:
- The table shows all six rows but the right columns are clipped.
- The center table header `最近发送` must appear inside the center table, not only in the top KPI strip.

Required center table layout:
- Keep center table inside x=455..1203.
- Header row must visibly include these columns within x<=1203:
  `批次号`, `模板/场景`, `收件人`, `来源流程`, `网关`, `状态`, `失败原因`, `重试次数`, `最近发送`, `操作`.
- Place `最近发送` around x=1080..1145 and `操作` around x=1150..1196.
- Each of the six rows must keep the batch id visible and horizontal:
  `BATCH-20260618-0931`
  `BATCH-20260618-0928`
  `BATCH-20260618-0925`
  `BATCH-20260618-0912`
  `BATCH-20260618-0907`
  `BATCH-20260618-0886`
- Show compact date/time values under `最近发送` and action links under `操作`.
- Reduce font size and column gaps if needed; do not widen the center card or overlap the right `失败详情与重试策略` panel.

Preserve:
- documentElement/body exactly 1586 x 992
- `失败详情与重试策略`, `处理进度`, `执行重试`, `标记已处理`, `导出取证包`
- `失败重试队列`, `审计取证包`, `生成取证包`, `下载`
- no emoji characters
- no internal scrollbars

Forbidden:
- `最后发送`
- page scroll
- internal scrollbars
- vertical/stacked batch id text
