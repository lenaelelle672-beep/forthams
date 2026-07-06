Edit the selected security-policy DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `system-params-subpage-02-security-policy-v2.png` is the only source of truth.
Use the selected attempt10 DESIGN screen `131b73091f834b848f0b8c436aedab48` only as the current near-layout baseline.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Hard freeze. Do not change these attempt10 structures:
- The top dark shell, `UNIVIEW | 固定资产管理系统` brand lockup, top navigation, and left sidebar active state.
- The page title `登录会话与敏感字段策略`.
- The four KPI cards: `安全策略 12`, `高危操作 7`, `脱敏字段 18`, `异常登录 3`.
- The left `安全策略列表` table x positions, column layout, and horizontal table cells.
- The five policy rows:
  `会话与敏感字段策略` / `session.sensitive.policy`,
  `钉钉 H5 入口校验` / `dingtalk.h5.verify`,
  `高危操作确认` / `high.risk.confirm`,
  `接口密钥轮换` / `api.key.rotate`,
  `CIP 转固敏感字段策略` / `cip.sensitive.policy`.
- Fullwidth punctuation in table values:
  `强校验（跳转校验+签名）`,
  `按角色脱敏（3级）`.

Forbidden regressions:
- Do not make any table cell vertical or stacked.
- Do not replace the page with a gray/default admin template.
- Do not add document scroll.
- Do not add internal scrollbars or overflow-y-auto regions.
- Do not crop required text below the viewport.
- Do not use `Security Policy Console`.
- Do not use `安全策略编辑`.
- Do not use ASCII trend title `异常登录趋势 (最近7天)`.

Only repair the vertical budget in these two places:

1. Right editor card.
- Source title is exactly `安全策略编排`.
- Keep the right editor x band around 1105..1585.
- Keep the entire editor above the bottom-card row.
- Show all fields without any scroll or clipping:
  `策略名称 *`, `策略键 *`, `会话策略`, `登录限制`, `敏感字段脱敏`, `H5 身份校验`, `高危操作确认`, `审计留痕`, `应急解锁`.
- Show the editor buttons `保存草稿` and `提交校验` inside the editor card, visibly above the bottom-card row.
- Reduce input heights, label spacing, and internal gaps if needed. Use compact 28-30px controls and 6-8px gaps.
- Do not move the editor over the bottom cards.

2. Bottom four-card band.
- Keep four cards in one row: `安全策略地图`, `高危操作清单`, `发布复核门禁`, `异常登录趋势（最近 7 天）`.
- The bottom-card row must fit entirely inside y 680..945.
- In `高危操作清单`, all four rows and the link `查看全部高危操作` must be visible inside the card:
  `越权访问`, `批量导出`, `删除附件`, `修改系统配置`, `查看全部高危操作`.
- In `发布复核门禁`, `查看复核详情` must remain visible.
- In the trend card, the title must be exactly one visible line: `异常登录趋势（最近 7 天）`.
- Keep `异常登录次数`, `阻断次数`, and `查看全部趋势` visible.
- If space is tight, compress row heights and chart height; do not hide, scroll, or push content below y=977.

Search/filter correction:
- The filter search input must visibly expose placeholder/value `搜索策略名称/策略键`.
- Keep it in the table filter row.

Final self-check before returning:
- Canvas/document/body are exactly 1609 x 977 CSS pixels.
- No document scroll and no real internal scroll containers.
- All five policy rows are visible in the left table.
- `审计留痕`, `应急解锁`, `保存草稿`, and `提交校验` are visible in the right editor, not only in the top toolbar.
- `查看全部高危操作`, `查看复核详情`, `异常登录趋势（最近 7 天）`, and `查看全部趋势` are visible in the bottom cards.
- The exported HTML is a persistent repaired DESIGN screen, not a list of DOM operations.
