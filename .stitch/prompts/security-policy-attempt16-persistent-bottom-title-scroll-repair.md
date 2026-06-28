Edit the selected security-policy DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription repair for `system-params-subpage-02-security-policy-v2.png`, not a redesign task.
Use the selected attempt10 DESIGN screen only as the current near-layout baseline.
The IMAGE2 v2 screenshot remains the source of truth for all text, geometry, colors, and business data.
Do not return DOM operation suggestions only. Return a new persistent full DESIGN screen with downloadable HTML and screenshot.

Preserve these currently passing gates:
- Canvas, viewport, documentElement, and body size exactly 1609 x 977.
- Top shell, sidebar, brand lockup, active `系统运营中枢`, active `系统参数 > 安全策略`.
- Page visible title `登录会话与敏感字段策略`.
- KPI cards: `安全策略 12`, `高危操作 7`, `脱敏字段 18`, `异常登录 3`.
- Left `安全策略列表` table x/y layout and all five policy rows:
  `session.sensitive.policy`, `dingtalk.h5.verify`, `high.risk.confirm`, `api.key.rotate`, `cip.sensitive.policy`.
- Keep the five rows horizontal inside x=250..1085 and y=330..680.

Required repairs:

1. HTML title and forbidden text
- Set the document title to `登录会话与敏感字段策略`.
- Remove the literal string `Security Policy Console` from the exported HTML.
- Do not use `安全策略编辑`.
- Do not use ASCII or split trend text such as `异常登录趋势 (最近7天)` or `异常登录趋势\n(最近7天)`.

2. Remove the table internal scroller without changing table rows
- The current table wrapper at approximately x=267, y=355 has overflow auto and real horizontal overflow. Remove that real scroller.
- Make the table fit the card width by compacting column widths and font/padding if needed.
- No element other than html/body may have real overflow with `overflow:auto` or `overflow:scroll`.
- Do not make any table cell vertical or stacked.

3. Right editor bottom content
- Keep right editor title exactly `安全策略编排`.
- Keep the right editor card in x=1105..1585 and y=249..676.
- Compress the right editor body so these are visible inside the card:
  `审计留痕`, `应急解锁`, `保存草稿`, `提交校验`.
- Required rects in Chrome 1609 x 977:
  - `审计留痕`: x>=1080 and bottom<=720.
  - `应急解锁`: x>=1080 and bottom<=760.
  - editor `保存草稿`: x>=1080, y>=520, bottom<=760.
  - editor `提交校验`: x>=1080, y>=520, bottom<=760.
- Move the editor buttons up from the current y=808 row into y=620..650 if needed.

4. Bottom four-card band
- Keep four cards in one row inside y=680..945:
  `安全策略地图`, `高危操作清单`, `发布复核门禁`, `异常登录趋势（最近 7 天）`.
- `查看全部高危操作` must be visible with bottom<=945, target y about 918.
- `查看复核详情` must be visible with bottom<=945, target y about 918.
- `查看全部趋势` must be visible with bottom<=945, target y about 918.
- Trend card title must be exact text `异常登录趋势（最近 7 天）`, one visible line, x>=1240, bottom<=760.
- If space is tight, reduce chart/table row heights and card padding; do not push links below y=945 and do not create scroll.

Final self-check:
- `document.documentElement.scrollWidth === 1609`, `scrollHeight === 977`.
- `document.body.scrollWidth === 1609`, `scrollHeight === 977`.
- `missing=[]` for all required source text, especially `异常登录趋势（最近 7 天）`.
- `forbiddenPresent=[]` for `Security Policy Console`, `安全策略编辑`, and ASCII/split trend titles.
- `tableFiveRowsVisible=true`, `rightEditorBottomVisible=true`, `highRiskLinkVisible=true`, `bottomLinksVisible=true`, `trendTitleExactVisible=true`, `searchPlaceholderVisible=true`.
- `realScrollerCount=0`.
