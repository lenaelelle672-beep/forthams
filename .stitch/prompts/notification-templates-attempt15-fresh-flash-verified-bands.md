Edit the selected uploaded IMAGE2 v2 screenshot into a Stitch DESIGN HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 通知模板配置台
Menu id: system-notification-templates
Reference image: notification-subpage-05-notification-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-05-notification-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-templates

Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW` plus adjacent `固定资产管理系统`, same spacing and dark top shell.

Fixed frame:
- Viewport and document size exactly 1586 x 992.
- No page-level scroll and no internal scroll containers hiding source-visible content.
- Body and root layout must fit the first viewport.

Source layout:
- Top dark navigation y=0..51, active `系统运营中枢`.
- Left dark sidebar x=0..217, active `消息与通知 > 通知模板`.
- Main content x=237..1569.
- Header y=69..157 with title `通知模板配置台`, subtitle, buttons `新建通知模板`, `保存草稿`, `提交校验`, `通知预览`, `发布`, and status strip values:
  `模板草稿 已保存`, `多渠道预览 已生成`, `变量完整度 96%`, `强制通知 4 条`, `最近更新 2026-06-19 10:18`, `更新人 平台运维`.
- Filter row y=169..219 with search text `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道` and filters `状态`, `业务事件`, `通知渠道`, `语言`, `引用流程`, `强制通知`, plus `重置`, `高级筛选`.

Upper workspace y=231..704:
- Left group panel x=237..431, title `通知模板分组`, 5 groups:
  `流程待办`, `盘点异常`, `风险预警`, `维保派工`, `CIP 转固`.
- Center table x=439..1130, title `通知模板列表`.
- Right editor x=1145..1569, title `模板属性与内容编辑`.

Center table hard gate:
- It must be a horizontal compact table, not stacked cards.
- Show all 5 rows between y=312 and y=575.
- Required rows and codes:
  `待办到达通知` `NT_TODO_ARRIVED`
  `盘点异常通知` `NT_INV_EXCEPTION`
  `风险预警通知` `NT_RISK_ALERT`
  `维保派工通知` `NT_MAINTENANCE_DISPATCH`
  `CIP 转固提醒` `NT_CIP_CAPITALIZE`
- Required variable completeness chips: `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`.
- Keep row text horizontal: no column text may become vertical stacked characters.
- Footer visible: `共 5 条`, page `1`, `20 条/页`.

Right editor hard gate:
- Keep all source-visible fields and the content editor inside y=231..704.
- Visible values include `待办到达通知`, `NT_TODO_ARRIVED`, `站内通知`, `钉钉 H5 卡片`, `平台运维`.
- Content editor must show variables: `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`.
- Buttons must be visible above y=715: `插入变量`, `渲染预览`, `版本对比`.

Bottom workspace y=716..963:
- Left card x=237..640 title `变量字典`.
- Middle card x=649..1106 title `多渠道预览`.
- Right card x=1116..1569 title `发布校验清单`.
- `变量字典` must show rows for `receiver_name`, `asset_name`, `todo_title`, `risk_level`, `process_link`.
- `多渠道预览` must show tabs `站内通知`, `钉钉 H5 卡片`, `邮件摘要`, and preview buttons/text `去处理`, `查看详情`.
- `发布校验清单` must show rows for `变量完整度`, `渠道适配`, `按钮链接`, `强制通知策略`, `失败降级`, `审计记录`, and bottom button `重新校验`.

Visual constraints:
- Compact 12-14px Chinese enterprise typography.
- White panels, pale blue borders, <=8px radius.
- No emoji glyphs.
- Use source-like blue/green/orange status chips.

Reject the result if:
- Document height exceeds 992.
- Table rows stack vertically.
- `维保派工通知` is missing.
- `插入变量`, `渲染预览`, or `版本对比` are below the first viewport.
- Bottom cards are clipped or hidden behind scroll.
