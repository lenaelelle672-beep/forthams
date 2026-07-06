Edit the selected screen using the uploaded product screenshot as the only authority.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.

## Scoring contract
Your goal is a 100/100 visual match to the uploaded screenshot.
Grade the result against the screenshot before finishing.
Any visible mismatch loses points.

Priority order:
1. Exact geometry and panel positions.
2. Exact visible text.
3. Exact table/list/form widths, row density, and no unwanted wrapping.
4. Exact right/side editor field count, order, density, and button position.
5. Exact bottom/secondary panel alignment.
6. Exact colors, borders, radius, typography, and icon style.

Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.
The uploaded screenshot is the only source of truth.

## Fixed frame
- Keep the same canvas size as the uploaded screenshot: 1585px wide by 992px high.
- No page-level vertical scroll; the source screenshot is a single full desktop viewport.
- Preserve the exact top navigation, dark left sidebar, content frame, panels, and density from the screenshot.

## Page identity
Page name: 通知渠道
Menu id: system-notification-channels
Reference image: notification-subpage-06-notification-channels-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-06-notification-channels-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-channels
Visible title: 通知渠道配置台

## Brand and shell requirements
- Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW`, adjacent `固定资产管理系统`, and the source-visible divider.
- Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
- Do not generate disconnected letters, generic logos, or a different brand lockup.
- Top nav must match source order and active state: 资产管理, 采购管理, 租赁管理, 运维管理, 盘点管理, 报表中心, 系统运营中枢(active), 设置中心.
- Left sidebar must match the source dark system configuration sidebar, with 消息与通知 expanded and 通知渠道 selected.

## Exact content that must be visible
- Header buttons: 新建渠道, 保存草稿, 提交校验, 发送测试.
- Feedback bars: 测试结果：成功 钉钉 H5 工作通知发送测试成功; 校验状态：通过 12 项全部通过.
- Main left panel title: 通知渠道列表.
- Table columns: 渠道名称, 渠道类型, 触达范围, 限流策略, 降级策略, 健康, 状态, 操作.
- Table rows exactly include: 钉钉 H5 工作通知, 站内消息渠道, 邮件通知渠道, 短信备用通知.
- Right editor title: 渠道参数编辑区.
- Right editor visible fields and values must include exactly:
  - 渠道名称: 钉钉 H5 工作通知
  - 渠道编码: DINGTALK_H5
  - 渠道类型: 钉钉机器人
  - Webhook/接口地址
  - 认证方式: 签名密钥（HMAC-SHA256）
  - 签名密钥状态: 有效, 重新生成, 密钥上次更新于 2025-05-15 10:21:33
  - 限流阈值: 50 次/分钟
  - 失败降级: 降级到站内消息
  - 负责人: 张三（资产管理员）
  - 审计要求: 必达, 普通
- Bottom panels must be fully visible in the viewport, not below the fold:
  - 渠道健康矩阵, including rows 钉钉 H5 工作通知, 站内消息渠道, 邮件通知渠道, 短信备用通知, and timestamp 2025-05-21 09:12:11.
  - 强制通知策略.
  - 降级路由 with three stacked route boxes: 钉钉 H5 工作通知, 站内消息渠道, 邮件通知渠道.
  - 发布校验清单（12 项）, including 短信备用未配置 and 查看全部 12 项校验详情.

## Hard rejection rules
- Do not output `NGTALK_H5`; this is a failed clipped value. The source value is exactly `DINGTALK_H5`.
- Do not output `张三（资产管理部）`; the source value is exactly `张三（资产管理员）`.
- Do not hide `查看全部 12 项校验详情`, `短信备用未配置`, `2025-05-21 09:12:11`, or any bottom panel behind overflow.
- Do not create a right editor internal scroll container; all right editor fields visible in the source must fit in the 1585 x 992 viewport.
- Do not use a 2560 x 2048 canvas or generic admin template.

## Density instructions
- Use compact table rows and compact field heights like the source screenshot.
- The upper two-column body and the bottom four-panel row must fit together inside the viewport.
- Bottom four panels start around the lower third of the content area and end above the viewport bottom, matching the screenshot.
- Use 1px pale borders, white panels, restrained blue/green/orange/red statuses, and radius no greater than 8px.

## Final self-check before completion
Only finish if these are true:
- The page looks like a direct HTML transcription of the uploaded IMAGE2 screenshot.
- All major blocks align with the screenshot.
- All listed exact Chinese and Latin values are visible.
- No required content is below the visible viewport.
- No visible text has been renamed or clipped.
