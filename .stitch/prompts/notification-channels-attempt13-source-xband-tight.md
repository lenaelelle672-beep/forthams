Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not use any old Stitch draft as the visual source.

Page name: 通知渠道配置
Menu id: system-notification-channels
Reference image: notification-subpage-06-notification-channels-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-06-notification-channels-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-channels
Canvas: exactly 1585 x 992 CSS pixels.

Hard geometry lock:
- Document width must be exactly 1585. Document height must be exactly 992.
- No horizontal or vertical page scroll.
- No hidden main overflow and no internal y-scroll containers.
- Top shell y=0..56.
- Sidebar x=0..196. Main content x=196..1585.
- Content right edge must never exceed x=1585; do not clip the right `发布校验清单` panel.
- Page content padding is about 16px from the sidebar edge. Main panel x starts around 212.
- Header title/actions y=74..112.
- Result bars y=120..166.
- Upper row y=180..614.
- Bottom row y=628..928.

Brand and shell:
- Preserve exact source brand: `UNIVIEW` white wordmark, source divider, and `固定资产管理系统`.
- Top nav source labels: `资产管理`, `采购管理`, `租赁管理`, `运维管理`, `盘点管理`, `报表中心`, active `系统运营中枢`, `设置中心`.
- Top right: notification badge `12`, help, grid icon, blue circular `管`, `管理员`.
- Sidebar active group `消息与通知`, active item `通知渠道`.
- Sidebar visible items include `系统监控`, `组织与权限`, `基础数据`, `流程与规则`, `系统配置`, `全局参数`, `业务参数`, `编码规则`, `集成配置`, `消息与通知`, `通知模板`, `通知策略`, `通知渠道`, `通知记录`, `安全管理`, `日志审计`, `系统工具`.
- Do not use emoji or generic colored pictograph icons.

Header and result bars:
- Title `通知渠道配置台`.
- Buttons in one horizontal row: `新建渠道`, `保存草稿`, `提交校验`, `发送测试`.
- Left result bar: `测试结果：`, green badge `成功`, text `钉钉 H5 工作通知发送测试成功`.
- Right result bar: `校验状态：`, green badge `通过`, text `12 项全部通过`.

Upper-left `通知渠道列表`:
- Panel x about 212..810, y about 180..614.
- Search row with placeholder `搜索渠道名称 / 编码 / 类型`, filters `全部类型`, `全部状态`, refresh icon.
- Table columns: `渠道名称`, `渠道类型`, `触达范围`, `限流策略`, `降级策略`, `健康`, `状态`, `操作`.
- Four rows visible and horizontal:
  1. `钉钉 H5 工作通知`, `钉钉机器人`, `全组织`, `50次/分钟`, `降级到站内`, `健康`, `启用`, `编辑 复制 更多`
  2. `站内消息渠道`, `站内消息`, `全组织`, `200次/分钟`, `降级到邮件`, `健康`, `启用`, `编辑 复制 更多`
  3. `邮件通知渠道`, `邮件`, `全组织`, `100次/分钟`, `无降级`, `注意`, `启用`, `编辑 复制 更多`
  4. `短信备用通知`, `短信`, `指定角色`, `30次/分钟`, `无降级`, `异常`, `停用`, `编辑 复制 更多`
- Footer: `共 4 条`, `10 条/页`, page `1`, `前往 1 页`.
- Do not leave a huge blank table body. Table panel ends before bottom row.

Upper-right `渠道参数编辑区`:
- Panel x about 823..1566, y about 180..614.
- Two-column form, all visible above y=614:
  - `渠道名称 *` = `钉钉 H5 工作通知`
  - `渠道编码 *` = `DINGTALK_H5`
  - helper text `仅支持字母、数字和下划线，唯一标识`
  - `渠道类型 *` = `钉钉机器人`
  - helper text `通过钉钉机器人向用户推送工作通知`
  - `Webhook/接口地址 *` = `https://oapi.dingtalk.com/robot/send?access_token=25c...`
  - helper text `请填写完整的 Webhook / 接口地址`
  - `认证方式 *` = `签名密钥（HMAC-SHA256）`
  - `签名密钥状态` = `有效`, `重新生成`, `密钥上次更新于 2025-05-15 10:21:33`
  - `限流阈值 *` = `50` and `次/分钟`
  - `失败降级 *` = `降级到站内消息`
  - `负责人 *` = `张三（资产管理员）`
  - `审计要求 *` = `必达`, `普通`
- Hard text rules:
  - Never output `NGTALK_H5`.
  - Never output `张三（资产管理部）`.
  - Do not hide `失败降级`, `负责人`, or `审计要求`.

Bottom row:
- Four equal panels fully visible from y=628..928:
  1. `渠道健康矩阵`, includes rows and timestamp `2025-05-21 09:12:11`, footer `数据更新时间：2025-05-22 14:30:05`.
  2. `强制通知策略`, includes `资产到期预警`, `审核驳回`, `资产盘盈盘亏`, `触发降级路由并记录告警`, `22:30 - 08:30（仅站内消息）`, `间隔 2 分钟，最多 3 次`.
  3. `降级路由`, includes `钉钉 H5 工作通知（优先级 1）`, `站内消息渠道（优先级 2）`, `邮件通知渠道（优先级 3）`, red `失败`, green `成功`.
  4. `发布校验清单（12 项）`, includes `Webhook/接口可达性`, `认证方式有效性`, `签名验证`, `限流策略合法性`, `降级策略有效性`, orange `短信备用未配置`, link `查看全部 12 项校验详情`.
- Do not crop the right checklist or bottom links.

Hard failure conditions:
- Any document scroll or internal scroll container.
- Content width exceeds x=1585 or right panel is clipped.
- Missing `张三（资产管理员）`, `降级到站内消息`, `2025-05-21 09:12:11`, `短信备用未配置`, or `查看全部 12 项校验详情`.
- Forbidden `NGTALK_H5` or `张三（资产管理部）`.
- Vertical table text or huge blank middle table area.

Final self-check:
- Screenshot at 1585 x 992 matches the source x-bands: dark sidebar 196px, main content full width to x=1585.
- Right editor and bottom `发布校验清单` are fully visible.
- All source-visible text above is visible in the viewport.
