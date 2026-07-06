Refine the selected notification channels DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a narrow 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-06-notification-channels-v2.png` is the only source of truth.
The selected screen `5c0566b927a945e38b79e677c485f421` fixed the right editor into two columns, preserved the 1585 x 992 frame, preserved no scrollbars, and kept the bottom validation cards visible. It still clips the lower right-editor fields.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

ABSOLUTE FREEZE:
- Freeze everything except the inside of the `渠道参数编辑区` right editor card.
- Keep exact document/body size 1585 x 992.
- Keep bottom four diagnostic cards exactly where they are.
- Keep `发布校验清单（12 项）`, `短信备用未配置`, and `查看全部 12 项校验详情` visible.
- Keep left `通知渠道列表`, bottom `渠道健康矩阵`, `强制通知策略`, and `降级路由` unchanged.
- Keep realScrollerCount=0.

RIGHT EDITOR ULTRA-COMPACT PACKING:
- The right editor card top/body/bottom must stay inside y≈222..655.
- Fit all fields by removing or hiding nonessential helper text inside this card only.
- Do NOT show long explanatory helper lines under fields except:
  - Keep `密钥上次更新于 2025-05-15 10:21:33` as one compact 11px line.
- Use 20px-22px input/select heights.
- Use 11px-12px labels.
- Use 2px-4px vertical gaps.
- Use a true 2-column grid with five compact rows:
  1. Left: `渠道名称 *` = `钉钉 H5 工作通知`; Right: `渠道编码 *` = `DINGTALK_H5`
  2. Left: `渠道类型 *` = `钉钉机器人`; Right: `Webhook/接口地址 *` = `https://oapi.dingtalk.com/robot/send?access_token=25c...`
  3. Left: `认证方式 *` = `签名密钥（HMAC-SHA256）`; Right: `签名密钥状态` = `有效` + `重新生成` + `密钥上次更新于 2025-05-15 10:21:33`
  4. Left: `限流阈值 *` = `50` + `次/分钟`; Right: `失败降级 *` = `降级到站内消息`
  5. Left: `负责人 *` = `张三（资产管理员）`; Right: `审计要求 *` = segmented options `必达` and `普通`
- The bottom edge of row 5 must be above y=650.
- `负责人 *`, `张三（资产管理员）`, `审计要求 *`, `必达`, and `普通` must be fully visible, not clipped by the bottom cards.

HARD GATES:
- `documentElement.scrollWidth=1585`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1585`, `body.scrollHeight=992`.
- No page scroll.
- No internal scrollbars.
- No right-edge clipping.
- Do not move bottom row cards down.
- Do not make any table text vertical.

Required strings present and visible:
- `DINGTALK_H5`
- `签名密钥（HMAC-SHA256）`
- `降级到站内消息`
- `张三（资产管理员）`
- `审计要求`
- `必达`
- `普通`
- `发布校验清单（12 项）`
- `短信备用未配置`
- `查看全部 12 项校验详情`

Forbidden strings absent:
- `NGTALK_H5`
- `张三（资产管理部）`
- `发布校验清单 (12 项)`
- `undefined`
- `NaN`
