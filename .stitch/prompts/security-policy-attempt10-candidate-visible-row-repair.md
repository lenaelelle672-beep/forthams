Edit the selected security-policy DESIGN screen into a new persistent Stitch DESIGN screen.

The original uploaded IMAGE2 v2 screenshot remains the only source of truth. Use the selected screen only as a near-layout baseline. Do not return DOM operations only; the exported HTML must contain the repaired layout.

Page: 登录会话与敏感字段策略
Canvas: exactly 1609 x 977 CSS pixels. No document scroll. No internal scroll containers.

Current candidate strengths to preserve:
- Top shell, left sidebar, KPI row, bottom four-card band, and overall white/blue-gray enterprise style are close to the IMAGE2 source.
- Keep uppercase `UNIVIEW | 固定资产管理系统`.
- Keep the bottom cards in one row: `安全策略地图`, `高危操作清单`, `发布复核门禁`, `异常登录趋势（最近 7 天）`.

Required repairs:
1. The policy table must show all five source rows inside the visible table:
   - `会话与敏感字段策略` / `session.sensitive.policy`
   - `钉钉 H5 入口校验` / `dingtalk.h5.verify`
   - `高危操作确认` / `high.risk.confirm`
   - `接口密钥轮换` / `api.key.rotate`
   - `CIP 转固敏感字段策略` / `cip.sensitive.policy`
   Use compact row height around 45px. Do not leave a blank area where row 5 should be.
2. The right editor must show all lower fields and buttons inside the visible middle card:
   - `高危操作确认`
   - `审计留痕`
   - `应急解锁`
   - `保存草稿`
   - `提交校验`
   Make field rows smaller if needed; do not add scroll.
3. Bottom trend title must be exact: `异常登录趋势（最近 7 天）`.
4. The link `查看全部高危操作` must be visible inside the `高危操作清单` card, not below the viewport.

Strict text rules:
- Preserve fullwidth punctuation exactly: `强校验（跳转校验+签名）`, `按角色脱敏（3级）`.
- Do not use ASCII variants: `强校验 (跳转校验+签名)`, `按角色脱敏 (3级)`.
- Keep source labels `安全策略列表`, `安全策略编辑`, `发布复核门禁`, `查看复核详情`, `查看全部趋势`.

Density/geometry:
- Middle row y about 230..660. Bottom row y about 672..923.
- The left policy table and right editor must both finish before the bottom row starts.
- If space is tight, reduce form input height and table row height; never hide or scroll required content.
- No `overflow-y-auto`, no `overflow-auto`, no clipped inner panels.

Final self-check:
- documentElement.scrollWidth == 1609 and scrollHeight == 977.
- All five policy rows are visible.
- Right lower fields through `应急解锁` and buttons are visible.
- Bottom four cards are fully visible with exact trend title.
- No internal overflow containers.
