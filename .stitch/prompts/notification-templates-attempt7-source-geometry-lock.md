Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, emoji logos, or a different brand lockup.

Page name: 通知模板
Menu id: system-notification-templates
Reference image: notification-subpage-05-notification-templates-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/notification-subpage-05-notification-templates-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-notification-templates
Canvas: 1586 x 992 desktop. The browser document must be exactly 1586 x 992 with no page scroll.

Generate a new DESIGN screen, not a temporary DOM operation on the old export. The downloadable HTML must contain the final corrected layout.

Critical source layout:
- Top shell: dark navy top bar, white UNIVIEW brand on the left, module tabs across the top, 系统运营中枢 active.
- Left shell: dark navy sidebar, 消息与通知 expanded, 通知模板 selected.
- Content begins at x about 234 and ends at x about 1567. Use a white canvas with fine blue-gray borders.
- Page title band y about 64..156: title `通知模板配置台`, subtitle, five blue/outline action buttons, and a right status strip.
- Filter row y about 168..220: one search input and compact filters. Search placeholder must be visible: `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道`.
- Middle work area y about 231..704:
  - left group list x about 234..430, title `通知模板分组`, five group cards.
  - center table x about 440..1128, title `通知模板列表`, a horizontal dense table.
  - right editor x about 1139..1567, title `模板属性与内容编辑`, all visible fields and the content editor.
- Bottom work area y about 716..964:
  - left `变量字典` table x about 234..640.
  - center `多渠道预览` x about 650..1106 with three preview tabs/cards: `站内通知`, `钉钉 H5 卡片`, `邮件摘要`.
  - right `发布校验清单` x about 1116..1567, checklist rows and the `重新校验` button fully visible above y=952.

Hard repair rules from previous failed Stitch attempts:
- Never render table text vertically. Do not stack Chinese characters or table values one per line. Every row in `通知模板列表` and `变量字典` must read horizontally like the IMAGE2 source.
- Never create internal scroll containers in the main content, table, right editor, variable dictionary, preview cards, or publish checklist. The source screenshot fits in one 1586 x 992 frame.
- Keep the right editor fully visible: `模板属性与内容编辑`, `模板名称`, `模板编码`, `业务事件`, `触发条件`, `默认渠道`, `负责人`, `启用状态`, `通知内容编辑`, `正文`, `CTA 按钮配置`, `插入变量`, `渲染预览`, `版本对比`.
- Keep the bottom row fully visible: `变量字典`, `多渠道预览`, `发布校验清单`, `变量完整度`, `渠道适配`, `按钮链接`, `强制通知策略`, `失败降级`, `审计记录`, `重新校验`.
- Keep source values exact where visible: `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`, `变量完整度 96%`, `共 5 条`, `待办到达通知`, `NT_TODO_ARRIVED`, `站内 + 钉钉`, `站内 + 邮件`, `站内 + 钉钉 + 短信`.
- If space is tight, reduce font size slightly and preserve horizontal reading. Do not wrap every cell vertically. Do not push bottom actions below the viewport.
- Do not introduce markdown fence text such as ```html.
- Do not use emoji-style icons. Use source-like line icons only when the source shows icons.

Final self-check before returning:
- Browser viewport 1586 x 992 would show the full page without scroll.
- No element that is visible in the IMAGE2 source is hidden below the viewport.
- `重新校验` is visible inside the right bottom checklist.
- `变量字典` row text is horizontal, not vertical.
- `通知模板列表` table rows are horizontal, not vertical.
- The result looks like a direct HTML transcription of the screenshot, not a generic admin template.
