Refine the selected notification channels DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-06-notification-channels-v2.png` is the only source of truth.
The selected screen `3025f3a9e20f47f5bf0e16fa94cbf256` already has the correct 1585 x 992 frame, no internal overflow containers, visible bottom four cards, and exact bottom title `发布校验清单（12 项）`.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

ABSOLUTE FREEZE ZONE:
- Do not change the top shell, sidebar, title/action row, test result bar, validation bar, left `通知渠道列表`, or bottom four cards.
- Do not change the document/body size: exactly 1585 x 992.
- Do not change bottom card row y-position.
- Keep `发布校验清单（12 项）`, `短信备用未配置`, and `查看全部 12 项校验详情` visible.
- Keep no internal scroll containers.

ONLY REPAIR `渠道参数编辑区`:
- Current selected screen clips lower right-editor fields at the bottom.
- Rebuild only the right editor body as a true compact two-column grid so all source-visible fields fit above y≈655.
- Do not use overflow-y-auto, overflow-scroll, max-height scrolling, or hidden clipped lower fields.
- Use 24px-26px controls, 12px helper text, 4px-6px vertical gaps, and compact labels.
- Helper text may be shortened but source-visible business values must remain exact.

Right editor target:
- Card title: `渠道参数编辑区`
- y range should stay approximately y=222..655.
- Column A fields:
  - `渠道名称 *` value `钉钉 H5 工作通知`
  - `渠道类型 *` value `钉钉机器人`
  - `认证方式 *` value `签名密钥（HMAC-SHA256）`
  - `限流阈值 *` value `50` and unit `次/分钟`
  - `负责人 *` value `张三（资产管理员）`
- Column B fields:
  - `渠道编码 *` value `DINGTALK_H5`
  - `Webhook/接口地址 *` visible with URL beginning `https://oapi.dingtalk.com/robot/send?access_token=25c...`
  - `签名密钥状态` value `有效`, link `重新生成`, text `密钥上次更新于 2025-05-15 10:21:33`
  - `失败降级 *` value `降级到站内消息`
  - `审计要求 *` options `必达` and `普通`

Critical visibility gates:
- `DINGTALK_H5` must be visible in the screenshot.
- `签名密钥（HMAC-SHA256）` must be visible in the screenshot.
- `降级到站内消息` must be visible in the screenshot.
- `负责人 *` and `张三（资产管理员）` must be visible in the screenshot.
- `审计要求 *`, `必达`, and `普通` must be visible in the screenshot.
- `2025-05-21 09:12:11` must remain visible in the bottom health matrix.

Hard viewport gates:
- `documentElement.scrollWidth=1585`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1585`, `body.scrollHeight=992`.
- No page scroll.
- No internal scrollbars.
- No right-edge clipping.
- Bottom four cards remain visible.

Required strings present:
- `通知渠道配置台`
- `钉钉 H5 工作通知`
- `DINGTALK_H5`
- `签名密钥（HMAC-SHA256）`
- `降级到站内消息`
- `张三（资产管理员）`
- `审计要求`
- `必达`
- `普通`
- `渠道健康矩阵`
- `2025-05-21 09:12:11`
- `发布校验清单（12 项）`
- `短信备用未配置`
- `查看全部 12 项校验详情`

Forbidden strings absent:
- `NGTALK_H5`
- `张三（资产管理部）`
- `发布校验清单 (12 项)`
- `undefined`
- `NaN`
