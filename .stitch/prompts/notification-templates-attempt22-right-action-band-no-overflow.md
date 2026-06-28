Repair the selected Stitch DESIGN screen into a new persistent full DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-05-notification-templates-v2.png` remains the only visual source of truth.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not return DOM operations only. Return a new persistent full DESIGN screen with downloadable HTML and screenshot.

Preserve these already-passing gates from the selected screen exactly:
- Chrome viewport 1586 x 992.
- `document.documentElement.scrollWidth === 1586`.
- `document.documentElement.scrollHeight === 992`.
- `document.body.scrollWidth === 1586`.
- `document.body.scrollHeight === 992`.
- zero real internal scroll containers.
- top shell, UNIVIEW brand lockup, and left sidebar active `消息与通知 > 通知模板`.
- header, filter row, exact text `变量完整度 96%`.
- left `通知模板分组` panel.
- center `通知模板列表` table with five horizontal rows:
  `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`.
- visible code `NT_MAINTENANCE_DISPATCH`.
- bottom cards: `变量字典`, `多渠道预览`, `发布校验清单`.
- bottom texts remain visible: `receiver_name`, `process_link`, `站内通知`, `钉钉 H5 卡片`, `重新校验`.

Only rebuild the local bottom action band inside the right editor panel.
The right editor panel must stay in the same right-side column and must not push the bottom cards downward.

Current failing action text rects in the selected screen:
- `插入变量`: x=1069.578125, y=728, bottom=745.
- `渲染预览`: x=1388, y=728, bottom=745.
- `版本对比`: x=1488, y=728, bottom=745.

Required persistent final geometry in exported HTML:
- The right editor action band is inside the right editor panel, between y=670 and y=704.
- `插入变量` is visible around x=1132, y=687, bottom<=715.
- `渲染预览` is visible around x=1260, y=687, bottom<=715.
- `版本对比` is visible around x=1390, y=687, bottom<=715.
- All three action text rects must satisfy x>=1120 and bottom<=715 in Chrome 1586 x 992.
- No visible copy of `插入变量`, `渲染预览`, or `版本对比` may remain at y>=716.

Keep the bottom workspace as a separate fixed band starting at y=716 or lower:
- `变量字典` card stays in the lower-left band.
- `多渠道预览` card stays in the lower-middle band.
- `发布校验清单` card stays in the lower-right band.
- None of these bottom cards may use CSS `overflow:auto` or `overflow:scroll`.
- If text is tight inside `变量字典`, reduce cell font size or column widths; do not create a horizontal or vertical scroll container.

Exact text requirements:
- Keep `通知模板配置台`, `通知模板分组`, `通知模板列表`, `模板属性与内容编辑`.
- Keep `变量字典`, `多渠道预览`, `发布校验清单`.
- Keep `流程待办`, `盘点异常`, `风险预警`, `维保派工`, `CIP 转固`.
- Keep `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`.
- Keep `NT_MAINTENANCE_DISPATCH`.
- Keep `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`.
- Keep `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`.
- Keep `插入变量`, `渲染预览`, `版本对比`, `重新校验`.

Hard final self-check before returning:
- Missing required text is empty.
- Forbidden placeholder text `undefined`, `NaN`, `Lorem`, `lorem` is absent.
- All five table row names are horizontal and inside x=430..1135, y=270..700.
- `插入变量`, `渲染预览`, `版本对比` are all x>=1120 and bottom<=715.
- `receiver_name`, `process_link`, `站内通知`, `钉钉 H5 卡片`, `重新校验` remain visible in y=710..982.
- real internal scroller count is 0.
