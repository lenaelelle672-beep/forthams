Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a surgical table-width repair for `notification-subpage-04-mail-logs-v2.png`.
Do not redesign the page. Preserve all current passing conditions: 1586 x 992 fixed no-scroll document, no emoji, six visible rows, right panel visible, bottom cards visible, and no internal scroll containers.

Current issue:
- The center `邮件发送日志` table contains the correct header `最近发送`, but its colgroup is too wide, so the `最近发送` column renders outside the center card around x=1302.

Required repair:
- Keep the center card x=455..1203.
- Make the center table width fit inside that card. The table, header cells, and row cells must not extend beyond x=1203.
- Shrink the center table columns so their total visual width is <= 731px.
- Use compact widths similar to:
  - 批次号 102px
  - 模板/场景 82px
  - 收件人 118px
  - 来源流程 72px
  - 网关 58px
  - 状态 46px
  - 失败原因 106px
  - 重试次数 48px
  - 最近发送 70px
  - 操作 48px
- It is acceptable to use 9-10px font and ellipsis inside cells, but the batch id text must remain horizontal and visible.
- The visible `最近发送` header must render within x=455..1203 and y=236..330.

Preserve:
- All six batch rows from `BATCH-20260618-0931` to `BATCH-20260618-0886`.
- `失败详情与重试策略`, `处理进度`, `执行重试`, `标记已处理`, `导出取证包`.
- `失败重试队列`, `审计取证包`, `生成取证包`, `下载`.

Forbidden:
- `最后发送`
- emoji characters
- page scroll
- internal scrollbars
- moving the right panel or bottom cards
