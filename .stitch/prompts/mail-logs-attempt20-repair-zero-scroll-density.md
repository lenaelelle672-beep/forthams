Repair the selected Stitch DESIGN screen against the original IMAGE2 v2 source `notification-subpage-04-mail-logs-v2.png`.

This is still a 100/100 pixel-fidelity transcription task, not a redesign task.
Do not invent a new layout. Keep all visible text and business data from the current screen unless explicitly corrected below.

Critical failure to fix:
- The current screen became 1586 x 1759 and hides required content behind the main vertical scroll.
- The target source is a single 1586 x 992 desktop frame with no page-level scroll.
- The bottom cards must be visible in the first viewport, not below it.

Hard geometry repair:
- Document and body must be exactly 1586px wide and 992px high.
- Body and main workspace must use `overflow: hidden`, not `overflow-y-auto`.
- Top nav y=0..51.
- Sidebar x=0..217, y=51..992.
- Main content x=217..1586, y=51..992.
- Header block y=67..159.
- Filter row y=170..224.
- Upper three-column workspace y=236..696.
- Bottom row y=707..941.
- Nothing source-visible may appear below y=941 except the page margin.

Compress these areas instead of scrolling:
- Center `邮件发送日志` table must fit all six rows between y=278 and y=646; row height about 49px.
- Center table footer/pagination must fit y=657..684.
- Right `失败详情与重试策略` panel must fit y=236..696, including the bottom buttons.
- Right detail rows should use 11-12px type, tight 4px gaps, no large vertical spacing.
- `处理进度` must begin above y=510 and all four steps must fit before the buttons.
- Bottom `失败重试队列` and `审计取证包` cards must fit y=707..941, including their 3 rows and pagination/footer.

Exact text correction:
- Center table column header must be `最近发送`, not `最后发送`.

Emoji/icon repair:
- Remove all emoji glyphs from the UI, including but not limited to `💾`, `📋`, `🔄`, `📥`, `🔍`, `📅`, `⚙️`, `✅`, and `🛠️`.
- Use plain text buttons or small monochrome line icons instead. Do not leave emoji characters in the HTML text.

Visibility requirements:
- `BATCH-20260618-0886` must be visible inside the center table in the first viewport.
- `执行重试`, `标记已处理`, and `导出取证包` must be visible inside the right panel in the first viewport.
- `失败重试队列`, `审计取证包`, `生成取证包`, and `下载` must be visible in the first viewport.
- Do not hide any source-visible content behind an internal scroll container.

Keep:
- Brand `UNIVIEW 固定资产管理系统`.
- Active top tab `系统运营中枢`.
- Active sidebar item `邮件日志`.
- The three-column structure and two bottom cards.
- The same data rows and table values already present.
