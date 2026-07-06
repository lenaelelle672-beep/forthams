Edit the selected uploaded IMAGE2 v2 screenshot into a persistent Stitch DESIGN HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not return only DOM operation suggestions. Return a new persistent full DESIGN screen with downloadable HTML and screenshot.

Page name: 通知模板配置台
Menu id: system-notification-templates
Reference image: notification-subpage-05-notification-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-05-notification-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-templates

Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, the source-visible divider/lockup, and adjacent `固定资产管理系统`. Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.

Fixed frame:
- Viewport and document size exactly 1586 x 992.
- Body, root, and documentElement must have width 1586 and height 992.
- No page-level scroll and no internal scroll containers hiding source-visible content.
- Do not use emoji glyphs.

Source shell:
- Top dark navigation y=0..51, active `系统运营中枢`.
- Left sidebar x=0..217, active `消息与通知 > 通知模板`.
- Main content x=237..1569.

Header and filters:
- Header y=69..157 with title `通知模板配置台`.
- Header buttons: `新建通知模板`, `保存草稿`, `提交校验`, `通知预览`, `发布`.
- Status strip must include exact continuous text `变量完整度 96%`.
- Filter row y=169..219 with search placeholder `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道`.

Upper workspace y=231..704:
- Left group panel x=237..431, title `通知模板分组`.
- Center table x=439..1130, title `通知模板列表`.
- Right editor x=1145..1569, title `模板属性与内容编辑`.

Center table hard gate:
- Render a compact horizontal table, not stacked cards.
- Show all 5 rows between y=312 and y=575:
  `待办到达通知` `NT_TODO_ARRIVED`
  `盘点异常通知` `NT_INV_EXCEPTION`
  `风险预警通知` `NT_RISK_ALERT`
  `维保派工通知` `NT_MAINTENANCE_DISPATCH`
  `CIP 转固提醒` `NT_CIP_CAPITALIZE`
- Required chips visible: `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`.
- Text must remain horizontal. Do not stack Chinese characters vertically.

Right editor hard gate:
- Keep the full editor and action row inside y=231..704.
- Visible values include `待办到达通知`, `NT_TODO_ARRIVED`, `站内通知`, `钉钉 H5 卡片`, `平台运维`.
- Content editor must show `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`.
- Place the action row above the bottom workspace:
  - `插入变量` text rect must be x>=1120 and bottom<=715.
  - `渲染预览` text rect must be x>=1120 and bottom<=715.
  - `版本对比` text rect must be x>=1120 and bottom<=715.
- Target action text coordinates:
  - `插入变量` around x=1130, y=688, bottom about 708.
  - `渲染预览` around x=1255, y=688, bottom about 708.
  - `版本对比` around x=1380, y=688, bottom about 708.
- Do not place these buttons at y=720 or below.

Bottom workspace y=716..963:
- Left card x=237..640 title `变量字典`.
- Middle card x=649..1106 title `多渠道预览`.
- Right card x=1116..1569 title `发布校验清单`.
- `变量字典` must show `receiver_name`, `asset_name`, `todo_title`, `risk_level`, `process_link` in the bottom card.
- `多渠道预览` must show `站内通知`, `钉钉 H5 卡片`, `邮件摘要`, `去处理`, `查看详情`.
- `发布校验清单` must show `变量完整度`, `渠道适配`, `按钮链接`, `强制通知策略`, `失败降级`, `审计记录`, and bottom button `重新校验`.

Final self-check before returning:
- Required text present: `通知模板配置台`, `通知模板分组`, `通知模板列表`, `模板属性与内容编辑`, `变量字典`, `多渠道预览`, `发布校验清单`, `维保派工通知`, `CIP 转固提醒`, `NT_MAINTENANCE_DISPATCH`, `变量完整度 96%`, `{{receiver_name}}`, `{{process_link}}`, `插入变量`, `渲染预览`, `版本对比`, `重新校验`.
- Table row visibility: all 5 row names have rect x>=430, x<=1135, y>=270, bottom<=700, height<=28.
- Right action visibility: `插入变量`, `渲染预览`, `版本对比` all satisfy x>=1120 and bottom<=715.
- Bottom cards visibility: `receiver_name`, `process_link`, `站内通知`, `钉钉 H5 卡片`, `重新校验` appear within y=716..982.
- Document height is exactly 992 and real internal scroller count is zero.
