Edit the uploaded IMAGE2 v2 screenshot into a NEW persistent Stitch DESIGN screen with real HTML/CSS.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Hard technical output requirements:
- The generated screen must contain real HTML elements and CSS, not an empty body.
- Do not return image placeholder HTML, MISSING_IMAGES HTML, or a blank export.
- Do not rely on external images, remote images, screenshot layers, or a single bitmap background.
- The browser-rendered page must be visible at exactly 1585 x 992 CSS pixels.
- The document must not have page-level scrollbars at 1585 x 992.
- Every field listed below must be visible without clipping.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot:
- white `UNIVIEW`
- source-visible vertical divider / lockup
- adjacent subtitle `固定资产管理系统`
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 通知渠道
Menu id: `system-notification-channels`
Reference image: `notification-subpage-06-notification-channels-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-06-notification-channels-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-channels`
Canvas: exactly `1585 x 992` CSS pixels.

Source layout map:
- Top dark navy shell height about 56 px.
- Left dark navy sidebar width about 194 px.
- Content starts near x=211, y=73.
- Main title: `通知渠道配置台`.
- Top actions on the right: `+ 新建渠道`, `保存草稿`, `提交校验`, `发送测试`.
- Status strip has two bordered white cards:
  - `测试结果：` green badge `成功` and text `钉钉 H5 工作通知发送测试成功`
  - `校验状态：` green badge `通过` and text `12 项全部通过`

Top navigation and sidebar:
- Top active module is `系统运营中枢`.
- Keep visible modules and user area from source: `资产管理`, `采购管理`, `租赁管理`, `运维管理`, `盘点管理`, `报表中心`, `系统运营中枢`, `设置中心`, notification badge `12`, `管理员`.
- Sidebar group active state:
  - `系统配置` expanded.
  - `消息与通知` expanded.
  - `通知渠道` is the active blue subitem.
- Other visible subitems: `全局参数`, `业务参数`, `编码规则`, `集成配置`, `通知模板`, `通知策略`, `通知记录`, `安全管理`, `日志审计`, `系统工具`.

Middle left card `通知渠道列表`:
- Card bounds approximately x=212 y=181 w=599 h=434.
- Search/filter row includes:
  - placeholder `搜索渠道名称 / 编码 / 类型`
  - `全部类型`
  - `全部状态`
  - refresh icon button.
- Table header columns:
  `渠道名称`, `渠道类型`, `触达范围`, `限流策略`, `降级策略`, `健康`, `状态`, `操作`.
- Four visible rows:
  1. `钉钉 H5 工作通知` | `钉钉机器人` | `全组织` | `50次/分钟` | `降级到站内` | `健康` | `启用` | `编辑 复制 更多`
  2. `站内消息渠道` | `站内消息` | `全组织` | `200次/分钟` | `降级到邮件` | `健康` | `启用` | `编辑 复制 更多`
  3. `邮件通知渠道` | `邮件` | `全组织` | `100次/分钟` | `无降级` | `注意` | `启用` | `编辑 复制 更多`
  4. `短信备用通知` | `短信` | `指定角色` | `30次/分钟` | `无降级` | `异常` | `停用` | `编辑 复制 更多`
- Footer pagination:
  `共 4 条`, `10 条/页`, left arrow, active page `1`, right arrow, `前往`, input `1`, `页`.

Middle right card `渠道参数编辑区`:
- Card bounds approximately x=823 y=181 w=742 h=434.
- This card is the most important section. It must fit fully and must not scroll internally.
- Use a compact two-column form. Labels are small, inputs are 32 px high or less.
- Visible exact fields:
  - Left column: `渠道名称 *` value `钉钉 H5 工作通知` with counter `8/50`
  - Right column: `渠道编码 *` value `DINGTALK_H5`
  - Helper under channel code: `仅支持字母、数字和下划线，唯一标识`
  - Left column: `渠道类型 *` value `钉钉机器人`
  - Right column: `Webhook/接口地址 *` value `https://oapi.dingtalk.com/robot/send?access_token=25c...`
  - Helper under webhook: `请填写完整的 Webhook / 接口地址`
  - Left column: `认证方式 *` value `签名密钥（HMAC-SHA256）`
  - Right column: `签名密钥状态` value badge `有效`, link `重新生成`
  - Helper under secret status: `密钥上次更新于 2025-05-15 10:21:33`
  - Left column: `限流阈值 *` value `50` plus unit `次/分钟`
  - Helper under threshold: `达到阈值后将进行限流保护`
  - Right column: `失败降级 *` value `降级到站内消息`
  - Helper under fallback: `通知发送失败时的降级处理方式`
  - Left column bottom: `负责人 *` value `张三（资产管理员）`
  - Right column bottom: `审计要求 *` segmented control with `必达` selected and `普通` unselected
  - Helper under audit: `必达：未成功送达将产生审计告警`
- If there is no room for native selects, use div-based dropdown visuals so values remain visible.
- Do not add footer buttons inside this card; the source has top action buttons, not a form footer here.

Bottom row, four cards from y about 626 to 933:
1. `渠道健康矩阵`
   - Columns `渠道名称`, `成功率（24h）`, `平均响应时间`, `最后检测`, `健康`.
   - Rows:
     `钉钉 H5 工作通知` `98.6%` `320ms` `14:29:58` `健康`
     `站内消息渠道` `100%` `120ms` `14:30:02` `健康`
     `邮件通知渠道` `95.3%` `1.2s` `14:29:55` `注意`
     `短信备用通知` `--` `--` `2025-05-21 09:12:11` `异常`
   - Footer: `数据更新时间：2025-05-22 14:30:05`
2. `强制通知策略`
   - Rows:
     `强制范围` `全组织`
     `强制事件` badges `资产到期预警`, `审核驳回`, `资产盘盈盘亏`
     `最小成功数` `至少成功 1 个渠道`
     `失败处理` `触发降级路由并记录告警`
     `静默时段` `22:30 ~ 08:30（仅站内消息）`
     `重试策略` `间隔 2 分钟，最多 3 次`
3. `降级路由`
   - Vertical flow nodes:
     `钉钉 H5 工作通知（优先级 1）`
     `站内消息渠道（优先级 2）`
     `邮件通知渠道（优先级 3）`
   - Red failure arrows downward labeled `失败`.
   - Black arrows to the right with green check and `成功`.
4. `发布校验清单（12 项）`
   - Rows:
     `Webhook/接口可达性` `通过`
     `认证方式有效性` `通过`
     `签名验证` `通过`
     `限流策略合法性` `通过`
     `降级策略有效性` `通过`
     `短信备用未配置` `未通过`
   - Footer centered link: `查看全部 12 项校验详情`.

Visual style:
- Enterprise B2B UI, exact source density.
- Background `#f5f7fb` or source-equivalent.
- Top/sidebar navy close to source, not light.
- Primary blue `#1677ff`.
- White cards with 1 px borders `#d9e2ef`, subtle radius, no heavy shadows.
- Typography is compact Chinese, mostly 12-14 px.
- Do not use large marketing spacing.

Reject conditions:
- Exported HTML is blank or contains only `MISSING_IMAGES`.
- Browser screenshot is blank or not exactly `1585 x 992`.
- Any of these exact texts are missing: `DINGTALK_H5`, `张三（资产管理员）`, `审计要求`, `必达`, `普通`, `发布校验清单（12 项）`, `查看全部 12 项校验详情`, `2025-05-21 09:12:11`, `短信备用未配置`.
- Any wrong replacement appears: `NGTALK_H5`, `张三（资产管理部）`.
- The right editor clips lower fields or shows an internal scrollbar.
