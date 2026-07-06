100/100 pixel-fidelity transcription from the selected uploaded IMAGE2 screenshot only. Not a redesign.

Critical repair after the previous failed candidate:
- The upper middle grid was too tall and pushed the bottom four-panel row down.
- In the source screenshot, the bottom four-panel row begins around y=628 and ends around y=928 within a 1585 x 992 viewport.
- The upper left table and right editor must end above that bottom row, around y=614.
- Do not let the bottom row start around y=728.

Fixed viewport:
- Canvas exactly 1585 x 992.
- No page scroll.
- No hidden main overflow.
- No internal scroll in the right editor.

Source layout to match:
- Dark top shell, exact UNIVIEW 固定资产管理系统 brand lockup, 系统运营中枢 active.
- Dark left sidebar, 消息与通知 expanded, 通知渠道 selected.
- Title 通知渠道配置台.
- Buttons 新建渠道, 保存草稿, 提交校验, 发送测试.
- Feedback bars: 测试结果 成功 钉钉 H5 工作通知发送测试成功; 校验状态 通过 12 项全部通过.

Upper content height:
- Left 通知渠道列表 panel and right 渠道参数编辑区 panel must fit from about y=180 to y=614.
- Left table contains exactly 4 rows: 钉钉 H5 工作通知, 站内消息渠道, 邮件通知渠道, 短信备用通知.
- Keep table rows compact, about 42-48px high, not a large empty table region.
- Pagination stays at the bottom of the left panel but still above y=614.

Right editor must show all source fields before the bottom row:
- 渠道名称: 钉钉 H5 工作通知
- 渠道编码 input value: DINGTALK_H5
- 渠道类型: 钉钉机器人
- Webhook/接口地址
- 认证方式: 签名密钥（HMAC-SHA256）
- 签名密钥状态: 有效, 重新生成, 密钥上次更新于 2025-05-15 10:21:33
- 限流阈值: 50 次/分钟
- 失败降级: 降级到站内消息
- 负责人: 张三（资产管理员）
- 审计要求: 必达, 普通

Bottom row:
- Four panels fully visible starting around y=628:
  1. 渠道健康矩阵, including timestamp 2025-05-21 09:12:11.
  2. 强制通知策略.
  3. 降级路由.
  4. 发布校验清单（12 项）, including 短信备用未配置 and 查看全部 12 项校验详情.

Hard reject:
- Never output NGTALK_H5.
- Never output 张三（资产管理部）.
- Do not hide 负责人, 审计要求, 失败降级, or 查看全部 12 项校验详情.
- Do not use a 2560 x 2048 visual scale.
