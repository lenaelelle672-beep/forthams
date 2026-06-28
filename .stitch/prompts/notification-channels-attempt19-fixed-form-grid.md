Repair ONLY the visible density and field placement of the current notification-channels Stitch DESIGN screen.

This remains a 100/100 pixel-fidelity transcription task from the IMAGE2 v2 source.
Do not redesign the page. Do not use a blank body, MISSING_IMAGES output, remote image layers, or screenshot backgrounds.

Target viewport: exactly 1585 x 992.
Critical source page: `通知渠道配置台`.

Current attempt18 failure:
- `负责人 *` label is visible but its input is clipped below the right editor.
- `审计要求 *` segmented control is not visible.
- `渠道健康矩阵` fourth row is clipped and the exact timestamp `2025-05-21 09:12:11` is missing.

Make these exact structural repairs:

RIGHT EDITOR FIX
- Card title remains `渠道参数编辑区`.
- The card body must be a fixed 2-column x 5-row grid.
- Put the 5 rows at these approximate viewport y positions:
  1. y=234: `渠道名称 *` / `渠道编码 *`
  2. y=305: `渠道类型 *` / `Webhook/接口地址 *`
  3. y=376: `认证方式 *` / `签名密钥状态`
  4. y=447: `限流阈值 *` / `失败降级 *`
  5. y=518: `负责人 *` / `审计要求 *`
- Every row must remain inside the right editor card before y=615.
- Use 11-12px labels, 28px inputs, 10-11px helper text.
- If space is tight, remove helper lines under `渠道类型`, `认证方式`, `限流阈值`, and `失败降级`; do NOT remove the row 5 fields.
- Exact row 5 values:
  - `负责人 *` value `张三（资产管理员）`
  - `审计要求 *` segmented control with `必达` selected and `普通` unselected
  - helper `必达：未成功送达将产生审计告警`
- Forbidden value: `张三（资产管理部）`.

BOTTOM LEFT CARD FIX
- Card title remains `渠道健康矩阵`.
- Show all 4 rows within the card, no internal scroll, no clipping:
  1. `钉钉 H5 工作通知` `98.6%` `320ms` `14:29:58` `健康`
  2. `站内消息渠道` `100%` `120ms` `14:30:02` `健康`
  3. `邮件通知渠道` `95.3%` `1.2s` `14:29:55` `注意`
  4. `短信备用通知` `--` `--` `2025-05-21 09:12:11` `异常`
- Use smaller 11-12px table text and row height about 32px.
- Footer `数据更新时间：2025-05-22 14:30:05` can be very small, but the 4 rows must be visible.

DO NOT BREAK THESE EXISTING PASS ITEMS
- Keep `DINGTALK_H5`.
- Keep `发布校验清单（12 项）`.
- Keep `查看全部 12 项校验详情`.
- Keep `短信备用未配置`.
- Keep bottom `降级路由` third node fully visible.
- Keep top dark shell, left sidebar active `通知渠道`, and top action buttons.

Required exact text after repair:
`DINGTALK_H5`
`张三（资产管理员）`
`审计要求`
`必达`
`普通`
`发布校验清单（12 项）`
`查看全部 12 项校验详情`
`2025-05-21 09:12:11`
`短信备用未配置`

Forbidden exact text after repair:
`张三（资产管理部）`
`NGTALK_H5`
