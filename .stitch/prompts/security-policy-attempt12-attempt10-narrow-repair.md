Edit the selected security-policy DESIGN screen into a new persistent Stitch DESIGN screen.

This is a narrow repair, not a redesign.
The IMAGE2 v2 screenshot `system-params-subpage-02-security-policy-v2.png` is the only source of truth.
Use the selected attempt10 DESIGN screen only as the current visual baseline because its overall layout is close.

Do not regenerate a new admin template.
Do not change the top navigation, sidebar, KPI row, table columns, table row heights, business data, chart values, or bottom card order.
Do not make table cells vertical. All table labels and values must remain horizontal like the source.
Do not introduce document scroll or internal scroll containers.

Keep these attempt10 elements unchanged:
- Top brand shell `UNIVIEW | 固定资产管理系统`.
- Left sidebar with `系统参数` expanded and `安全策略` active.
- Four KPI cards: `安全策略 12`, `高危操作 7`, `脱敏字段 18`, `异常登录 3`.
- Left `安全策略列表` table width and column layout.
- Five table rows and all keys:
  `会话与敏感字段策略`, `session.sensitive.policy`,
  `钉钉 H5 入口校验`, `dingtalk.h5.verify`,
  `高危操作确认`, `high.risk.confirm`,
  `接口密钥轮换`, `api.key.rotate`,
  `CIP 转固敏感字段策略`, `cip.sensitive.policy`.

Only make these repairs:

1. Right editor title:
- Source title is `安全策略编排`.
- The final screen must contain visible `安全策略编排`.
- It must not contain `安全策略编辑`.

2. Right editor bottom visibility:
- Keep the right editor card within the upper row.
- All fields must be visible without scrolling:
  `策略名称 *`, `策略键 *`, `会话策略`, `登录限制`, `敏感字段脱敏`, `H5 身份校验`, `高危操作确认`, `审计留痕`, `应急解锁`.
- Bottom buttons `保存草稿` and `提交校验` must be visible inside the editor card.
- If vertical space is tight, reduce field height and internal gaps; do not crop or scroll.

3. Bottom high-risk card:
- `查看全部高危操作` must be visible inside the `高危操作清单` card.
- Do not push it below the viewport.
- Keep rows `越权访问`, `批量导出`, `删除附件`, `修改系统配置`.

4. Trend title:
- Replace the split or ASCII title with exactly `异常登录趋势（最近 7 天）`.
- It must be visually one header line in the card title area.
- Use full-width Chinese parentheses and spaces around 7.
- Do not use `异常登录趋势 (最近7天)`.
- Keep legend `异常登录次数`, `阻断次数` and the link `查看全部趋势`.

5. Search placeholder:
- Ensure the filter search input visibly reads `搜索策略名称/策略键`.
- Keep it in the table filter row; do not move it to top nav or sidebar.

Quality gates:
- CSS viewport/document: 1609 x 977.
- No document scroll.
- No internal scrollbars.
- Required text visible: `安全策略编排`, `查看全部高危操作`, `异常登录趋势（最近 7 天）`, `搜索策略名称/策略键`.
- Forbidden text absent: `安全策略编辑`, `异常登录趋势 (最近7天)`.
