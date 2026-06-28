Repair only the right `渠道参数编辑区` of the selected Stitch DESIGN screen.

This is a narrow 100/100 pixel-fidelity repair against IMAGE2 source `notification-subpage-06-notification-channels-v2.png`.
Do not redesign the page.
Do not change the shell, sidebar, header, result bars, left table, or bottom four cards.
Do not move the bottom row.

Current problem:
- Attempt14 removed internal scrolling and fixed the checklist title.
- But the lower right-editor fields are still clipped at the bottom.
- `负责人 *` / `张三（资产管理员）` and `审计要求 *` / `必达` / `普通` must be visible before the card bottom.

Right editor packing rules:
- Keep the editor top and bottom in the same position.
- Use a true two-column compact grid where possible.
- Input/select height: 24-26px.
- Label height: 14-16px.
- Vertical gap between field groups: 4px.
- Helper text can be shortened, hidden, or removed if needed to fit source-visible fields.
- Remove large margins/padding in the right editor body only.
- Do not use overflow-y-auto, overflow-scroll, max-height scrolling, or clipped hidden content.

Must be visible in `渠道参数编辑区`:
- `渠道名称 *` value `钉钉 H5 工作通知`
- `渠道编码 *` value `DINGTALK_H5`
- `渠道类型 *` value `钉钉机器人`
- `Webhook/接口地址 *`
- `认证方式 *` value `签名密钥（HMAC-SHA256）`
- `签名密钥状态` value `有效`, link `重新生成`, text `密钥上次更新于 2025-05-15 10:21:33`
- `限流阈值 *` value `50`, unit `次/分钟`
- `失败降级 *` value `降级到站内消息`
- `负责人 *` value `张三（资产管理员）`
- `审计要求 *` options `必达` and `普通`

Preserve exact forbidden rules:
- Never output `NGTALK_H5`.
- Never output `张三（资产管理部）`.
- Keep `DINGTALK_H5`.
- Keep `张三（资产管理员）`.
- Keep `发布校验清单（12 项）` in the bottom-right card.

Verification gates:
- Canvas remains 1585 x 992.
- documentElement scrollWidth <= 1585 and scrollHeight <= 992.
- Right editor has no internal vertical scroll container.
- `负责人 *`, `张三（资产管理员）`, `审计要求 *`, `必达`, and `普通` are visible in the screenshot.
- Bottom four cards remain visible; `查看全部 12 项校验详情` remains visible.
