Edit the selected uploaded IMAGE screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent `固定资产管理系统`.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 通知渠道
Menu id: `system-notification-channels`
Reference image: `notification-subpage-06-notification-channels-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-06-notification-channels-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-channels`
Canvas: exactly `1585 x 992` CSS pixels.

Recreate this exact IMAGE2 v2 product screenshot as HTML:

Top shell and sidebar:
- Dark navy top bar height and left dark sidebar exactly like source.
- Top active module is `系统运营中枢`; far-right icons and `管理员` user menu match the source.
- Left sidebar groups: `系统监控`, `组织与权限`, `基础数据`, `流程与规则`, active `系统配置`, active subitem under `消息与通知` -> `通知渠道`.
- Do not use a light/default admin shell.

Page header:
- Title `通知渠道配置台`.
- Top action buttons are rectangular source-like buttons, right aligned:
  `+ 新建渠道`, `保存草稿`, `提交校验`, `发送测试`.
- Do not render action buttons as loose icon text without bordered button boxes.

Status strip:
- Two white bordered cards:
  left `测试结果： 成功 钉钉 H5 工作通知发送测试成功`;
  right `校验状态： 通过 12 项全部通过`.
- Keep the green success badges and source spacing.

Middle layout:
- Left wide card `通知渠道列表` with search/filter row:
  search placeholder `搜索渠道名称 / 编码 / 类型`, dropdowns `全部类型`, `全部状态`, refresh icon.
- Table columns: `渠道名称`, `渠道类型`, `触达范围`, `限流策略`, `降级策略`, `健康`, `状态`, `操作`.
- Four visible rows:
  `钉钉 H5 工作通知`, `站内消息渠道`, `邮件通知渠道`, `短信备用通知`.
  Keep health/status tags `健康`, `注意`, `异常`, `启用`, `停用` and actions `编辑`, `复制`, `更多`.
- Pagination/footer: `共 4 条`, `10 条/页`, page `1`, `前往 1 页`.

Right middle card `渠道参数编辑区`:
- Must fit entirely from y≈181 to y≈615 without internal scroll.
- Two-column compact form exactly like source.
- Visible values and labels:
  `渠道名称 *` -> `钉钉 H5 工作通知` and `8/50`
  `渠道编码 *` -> `DINGTALK_H5`
  helper `仅支持字母、数字和下划线，唯一标识`
  `渠道类型 *` -> `钉钉机器人`
  `Webhook/接口地址 *` -> `https://oapi.dingtalk.com/robot/send?access_token=25c...`
  helper `请填写完整的 Webhook / 接口地址`
  `认证方式 *` -> `签名密钥（HMAC-SHA256）`
  `签名密钥状态` -> `有效` and `重新生成`
  helper `密钥上次更新于 2025-05-15 10:21:33`
  `限流阈值 *` -> `50` and `次/分钟`
  `失败降级 *` -> `降级到站内消息`
  `负责人 *` -> `张三（资产管理员）`
  `审计要求 *` -> segmented control `必达` selected and `普通`
- Use dropdown-look boxes made from text/divs if native selects would clip or hide values.
- No internal scrollbar; no clipped lower fields.

Bottom row:
- Four source-like cards aligned from y≈626 to y≈932:
  `渠道健康矩阵`, `强制通知策略`, `降级路由`, `发布校验清单（12 项）`.
- `渠道健康矩阵` table rows:
  `钉钉 H5 工作通知 98.6% 320ms 14:29:58 健康`
  `站内消息渠道 100% 120ms 14:30:02 健康`
  `邮件通知渠道 95.3% 1.2s 14:29:55 注意`
  `短信备用通知 -- -- 2025-05-21 09:12:11 异常`
  footer `数据更新时间：2025-05-22 14:30:05`.
- `强制通知策略` rows:
  `强制范围 全组织`
  `强制事件 资产到期预警 审核驳回 资产盘盈盘亏`
  `最小成功数 至少成功 1 个渠道`
  `失败处理 触发降级路由并记录告警`
  `静默时段 22:30 ~ 08:30（仅站内消息）`
  `重试策略 间隔 2 分钟，最多 3 次`.
- `降级路由` flow:
  `钉钉 H5 工作通知（优先级 1）` -> failure to `站内消息渠道（优先级 2）` -> failure to `邮件通知渠道（优先级 3）`, with right-side success arrows.
- `发布校验清单（12 项）` rows:
  `Webhook/接口可达性 通过`
  `认证方式有效性 通过`
  `签名验证 通过`
  `限流策略合法性 通过`
  `降级策略有效性 通过`
  `短信备用未配置 未通过`
  footer link `查看全部 12 项校验详情`.

Hard failures:
- Screenshot is not exactly `1585 x 992`.
- Page-level scroll appears.
- Right editor has internal scroll or hides `负责人`, `张三（资产管理员）`, `审计要求`.
- Top action buttons are loose icon text instead of source-like bordered buttons.
- Bottom title is not exact `发布校验清单（12 项）`.
- Any key text above is missing, clipped, or rewritten.
