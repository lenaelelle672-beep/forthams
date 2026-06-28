Repair the selected Stitch DESIGN screen against the IMAGE2 source `notification-subpage-04-mail-logs-v2.png`.

This is a narrow 100/100 pixel-fidelity repair, not a redesign.
Preserve attempt16 strengths:
- The center `邮件发送日志` table shows all six rows.
- The right `失败详情与重试策略` panel exists.
- The bottom `失败重试队列` and `审计取证包` panels exist.

Only repair the hard geometry regressions:

1. Fit the page back into the source viewport
- Canvas exactly 1586 x 992.
- documentElement.scrollWidth must be <=1586.
- documentElement.scrollHeight must be <=992.
- No horizontal overflow. No content may extend past x=1586.
- No page-level vertical overflow.

2. Preserve 6 visible center rows
Do not lose these visible rows:
- `BATCH-20260618-0931`
- `BATCH-20260618-0928`
- `BATCH-20260618-0925`
- `BATCH-20260618-0912`
- `BATCH-20260618-0907`
- `BATCH-20260618-0886`
Keep row height compact. Do not reintroduce 3-row layout.

3. Fix x-bands to source
- Sidebar x=0..217.
- Main content x=217..1586.
- Upper left quick queue x about 237..447.
- Upper center log table x about 455..1203.
- Upper right detail x about 1212..1568.
- Bottom left retry queue x about 237..835.
- Bottom right evidence package x about 847..1568.
- Right and bottom panels must not be wider than these bands.

4. Fix bottom-right `审计取证包` table
- Must fit within x<=1568.
- Show three rows with actions visible:
  - `BATCH-20260618-0931` ... `生成取证包`
  - `BATCH-20260618-0928` ... `下载`
  - `BATCH-20260618-0907` ... `下载`
- If needed, shorten columns with source-like ellipsis, but keep actions visible inside the card.
- Do not let `生成取证包` or `下载` render beyond the viewport.

5. Fix right detail panel height
- Right panel must fit y=305..696 without internal vertical scroll.
- Buttons `执行重试`, `标记已处理`, `导出取证包` must remain visible.
- If needed, reduce line-height and field gaps only inside the right detail panel.

6. Exact source text
- Search placeholder must be exactly `搜索批次号 / 模板 / 收件人 / 失败原因 / 流程来源`.
- Keep `5.7.1 Relay access denied` visible in center row 3.
- Keep `550 5.1.1 User unknown` visible.
- Remove any extra leading icon before `UNIVIEW`; brand begins with `UNIVIEW 固定资产管理系统`.

Hard failure:
- More than 1586px document width.
- More than 992px document height.
- Center table drops below six visible rows.
- Bottom right actions clipped offscreen.
- Source placeholder shortened.
