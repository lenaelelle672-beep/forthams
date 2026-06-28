Create a new persistent Stitch DESIGN/HTML screen from the selected uploaded IMAGE2 source.

This is a 100/100 pixel-fidelity transcription of `notification-subpage-04-mail-logs-v2.png`, not a redesign.
The IMAGE2 screenshot is the only source of truth. Do not use a generic admin template.

Canvas:
- Exactly 1586 x 992.
- html/body/root: width 1586px; height 992px; margin 0; overflow hidden.
- No page scroll and no internal visible scroll containers.
- Use fixed/absolute y-bands, not natural long-page flow.

Shell:
- Top nav y=0..51, dark navy, active `系统运营中枢`.
- Left sidebar x=0..217, y=51..992, active `邮件日志`.
- Top-left brand: white `UNIVIEW`, divider, `固定资产管理系统`. No leading logo square and no emoji.

Content bands:
- Header/actions y=67..159: title `邮件日志与重试策略台`; buttons `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- Filters y=170..224.
- Upper workspace y=236..696:
  - Left quick queue x=237..447, four cards.
  - Center table x=455..1203.
  - Right detail x=1212..1568.
- Bottom row y=707..941:
  - `失败重试队列` x=237..836.
  - `审计取证包` x=847..1568.

Center table:
- Title `邮件发送日志`.
- Header must say `最近发送`, not `最后发送`.
- Show all 6 horizontal rows within y=278..646:
  `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0925`, `BATCH-20260618-0912`, `BATCH-20260618-0907`, `BATCH-20260618-0886`.
- Keep row text horizontal; reduce font to 10-12px if needed.

Right detail:
- Title `失败详情与重试策略`.
- Show `处理进度` and the four steps above y=620.
- Buttons visible inside the panel: `执行重试`, `标记已处理`, `导出取证包`.

Bottom cards:
- Show 3 rows in `失败重试队列`.
- Show 3 rows in `审计取证包`.
- `生成取证包` and `下载` must be visible above y=941.

Required exact text:
`邮件日志与重试策略台`
`最近发送`
`BATCH-20260618-0886`
`失败详情与重试策略`
`处理进度`
`执行重试`
`标记已处理`
`失败重试队列`
`审计取证包`
`生成取证包`
`下载`

Forbidden:
- `最后发送`
- emoji glyphs, including 💾, 📋, 🔄, 📥, 🔍, 📅, ⚙️, ✅, 🛠️
- page scroll
- internal scrollbars
- vertical/stacked Chinese table text
