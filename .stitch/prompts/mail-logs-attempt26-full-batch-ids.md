Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a visual-fidelity refinement for the center `邮件发送日志` table in `notification-subpage-04-mail-logs-v2.png`.
Do not redesign or move any panels. Preserve all current verifier-passing conditions:
- 1586 x 992 fixed no-scroll document
- no emoji
- six visible main rows
- `最近发送` visible inside the center table header
- right panel and bottom cards visible
- no internal scroll containers

Only improve the center table column widths so batch IDs are not visually truncated.

Required:
- In the center table, show the full batch IDs without ellipsis:
  `BATCH-20260618-0931`
  `BATCH-20260618-0928`
  `BATCH-20260618-0925`
  `BATCH-20260618-0912`
  `BATCH-20260618-0907`
  `BATCH-20260618-0886`
- Give the `批次号` column about 126-132px.
- Compress other columns to keep the total table width inside x=455..1203:
  - 模板/场景 about 72px
  - 收件人 about 98px
  - 来源流程 about 62px
  - 网关 about 46px
  - 状态 about 42px
  - 失败原因 about 82px
  - 重试次数 about 36px
  - 最近发送 about 78px
  - 操作 about 48px
- Use 9px text if necessary. Keep all row text horizontal.

Forbidden:
- hiding `最近发送`
- `最后发送`
- emoji characters
- page scroll
- internal scrollbars
- moving right or bottom panels
