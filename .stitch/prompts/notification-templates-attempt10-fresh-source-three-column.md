Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded screenshot `notification-subpage-05-notification-templates-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 通知模板配置台
Menu id: system-notification-templates
Reference image: notification-subpage-05-notification-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-05-notification-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-templates
Canvas: exactly 1586 x 992 CSS pixels.

Build directly from the uploaded IMAGE screen, not from any prior candidate or DOM-operation repair.

Critical layout:
- Fixed 1586 x 992 desktop canvas.
- No page-level scrolling. Avoid internal overflow-y-auto for source-visible content.
- Top shell y=0..52, left sidebar x=0..216, main content x=216..1586.
- Header/title/action area y=64..166.
- Filter row y=168..220.
- Main three-column row y=231..705.
- Bottom three-card row y=716..962.

Top shell and sidebar:
- Preserve the source top-left brand `UNIVIEW 固定资产管理系统`.
- Active top tab `系统运营中枢`.
- Left dark sidebar expands groups `流程平台`, `组织权限`, `基础资料`, `集成配置`, `消息与通知`, `系统参数`.
- Active item: `通知模板`.

Header:
- Title `通知模板配置台`.
- Subtitle `维护站内、钉钉 H5、邮件和钉通知的标题、正文、按钮、变量与发布校验。`
- Buttons: `新建通知模板`, `保存草稿`, `提交校验`, `通知预览`, `发布`.
- Right status strip includes: `模板草稿 已保存`, `多渠道预览 已生成`, `变量完整度 96%`, `强制通知 4 条`, `最近更新 2026-06-19 10:18`, `更新人 平台运维`.

Filter row:
- Search placeholder `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道`.
- Filters: `状态`, `业务事件`, `通知渠道`, `语言`, `引用流程`, `强制通知`.
- Right buttons: `重置`, `高级筛选`.

Main row:
- Left group card x about 234..430, title `通知模板分组`, five groups:
  `流程待办`, `盘点异常`, `风险预警`, `维保派工`, `CIP 转固`.
- Center table x about 440..1128, title `通知模板列表`.
- The table must render horizontally, never stacked vertically.
- Columns: `模板名称`, `模板编码`, `业务事件`, `触发条件`, `渠道`, `变量完整度`, `状态`, `最近更新`, `操作`.
- Rows:
  `待办到达通知` `NT_TODO_ARRIVED` `审批待办创建` `待办节点创建时` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 09:42`;
  `盘点异常通知` `NT_INV_EXCEPTION` `抽盘异常提交` `异常记录状态 = 提交` `站内 + 邮件` `7/8 缺1项` `草稿` `2026-06-19 09:15`;
  `风险预警通知` `NT_RISK_ALERT` `告警触发` `告警等级 >= 高` `站内 + 钉钉 + 短信` `9/10 缺1项` `待校验` `2026-06-19 08:51`;
  `维保派工通知` `NT_MAINTENANCE_DISPATCH` `维保派工` `工单状态 = 已派工` `站内 + 钉钉` `8/8 完整` `已发布` `2026-06-19 08:20`;
  `CIP 转固提醒` `NT_CIP_CAPITALIZE` `验收通过待转固` `验收结果 = 通过` `站内 + 邮件` `8/8 完整` `已发布` `2026-06-19 07:56`.
- Right editor x about 1143..1568, title `模板属性与内容编辑`.
- Show all source-visible fields and content editor without clipping:
  `模板名称`, `模板编码`, `业务事件`, `触发条件`, `默认渠道`, `负责人`, `启用状态`.
- Content editor title `通知内容编辑`, field `标题`, rich-text toolbar, body containing variables:
  `{{receiver_name}}`, `{{todo_title}}`, `{{asset_name}}`, `{{risk_level}}`, `{{process_link}}`.
- CTA/action controls and bottom buttons visible: `插入变量`, `渲染预览`, `版本对比`.

Bottom row:
- Card 1 x about 234..640 w about 406, title `变量字典`, five horizontal rows:
  `receiver_name`, `asset_name`, `todo_title`, `risk_level`, `process_link`.
- Card 2 x about 650..1106 w about 456, title `多渠道预览`.
  Tabs: `站内通知`, `钉钉 H5 卡片`, `邮件摘要`.
  Show three preview panels and buttons `去处理`.
- Card 3 x about 1116..1568 w about 451, title `发布校验清单`.
  Six rows: `变量完整度`, `渠道适配`, `按钮链接`, `强制通知策略`, `失败降级`, `审计记录`.
  Bottom button `重新校验`.

Required exact text:
- `通知模板配置台`
- `通知模板分组`
- `通知模板列表`
- `模板属性与内容编辑`
- `变量字典`
- `多渠道预览`
- `发布校验清单`
- `流程待办`, `盘点异常`, `风险预警`, `维保派工`, `CIP 转固`
- `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`
- `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`
- `变量完整度 96%`
- `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`
- `插入变量`, `渲染预览`, `版本对比`, `重新校验`

Forbidden failure modes:
- Do not stack table headers or Chinese text vertically.
- Do not make the document height larger than 992.
- Do not use internal scrollbars for the main table, right editor, variable dictionary, preview card, or checklist.
- Do not hide bottom row links/buttons below the viewport.
- Do not change `通知模板列表` to a card-only layout.
- Do not use old candidate geometry.

Final self-check:
- At 1586 x 992 viewport, all three main columns and all three bottom cards are visible.
- Browser text can find `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`, `变量完整度 96%`, and the five variable tokens.
- Screenshot resembles the uploaded IMAGE2 source, not a generic notification dashboard.
