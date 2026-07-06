Repair the selected Stitch DESIGN screen against the IMAGE2 source `notification-subpage-06-notification-channels-v2.png`.

This is a narrow 100/100 pixel-fidelity repair, not a redesign.
Preserve attempt13 strengths:
- Main x-bands and sidebar width are close to the source.
- Bottom four panels are visible within the 1585 x 992 viewport.
- Left `通知渠道列表` table is horizontal and usable.
- No forbidden `NGTALK_H5` and no forbidden `张三（资产管理部）`.

Only repair these source mismatches:

1. Right editor must not scroll
- Remove the internal `overflow-y-auto` / scroll behavior from `渠道参数编辑区`.
- The editor body must fit all source-visible fields above the bottom row.
- Compress only vertical spacing inside this right editor. Do not change the left table or bottom cards.
- Use compact 26-30px input/select heights, 12px helper text, and 6-8px vertical gaps.

2. Make lower right-editor fields visible
The following must be visible in the right editor before the bottom row starts:
- `限流阈值 *` with `50` and `次/分钟`
- `失败降级 *` with `降级到站内消息`
- `负责人 *` with `张三（资产管理员）`
- `审计要求 *` with `必达` and `普通`

3. Preserve exact values
- Keep visible `渠道编码 *` value exactly `DINGTALK_H5`.
- Keep `认证方式 *` exactly `签名密钥（HMAC-SHA256）`.
- Keep `密钥上次更新于 2025-05-15 10:21:33`.
- Keep `Webhook/接口地址 *` field visible.
- Never output `NGTALK_H5`.
- Never output `张三（资产管理部）`.

4. Fix bottom checklist title
- The bottom-right card title must be exactly `发布校验清单（12 项）`.
- Use fullwidth Chinese parentheses and include the space between `12` and `项`.
- Keep visible orange row `短信备用未配置`.
- Keep link `查看全部 12 项校验详情`.

5. Do not regress layout
- Keep canvas exactly 1585 x 992.
- Keep documentElement scrollWidth <= 1585 and scrollHeight <= 992.
- Keep the bottom row y range and four cards visible.
- Keep right content within x<=1585.
- Do not make table text vertical.
- Do not enlarge the top shell, header, result bars, or left table.

Hard failure conditions:
- Any internal vertical scroll remains in the right editor.
- `负责人 *` / `张三（资产管理员）` is hidden.
- `审计要求 *` / `必达` / `普通` is hidden.
- Bottom-right title is `发布校验清单 (12 项)` or any halfwidth-parentheses variant.
- Bottom cards move below the 992px viewport.
