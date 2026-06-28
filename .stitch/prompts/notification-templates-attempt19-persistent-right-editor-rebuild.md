Repair the selected Stitch DESIGN screen into a new persistent full DESIGN screen.

This is still a 100/100 pixel-fidelity transcription task against `notification-subpage-05-notification-templates-v2.png`, not a redesign task.
The IMAGE2 v2 product screenshot remains the only source of truth for visual fidelity and business data.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not return only DOM operation suggestions. Return a new persistent full DESIGN screen with downloadable HTML and screenshot.

Preserve all currently passing areas from the selected screen:
- fixed viewport/document/body size 1586 x 992
- zero real internal scroll containers
- top shell and UNIVIEW brand lockup
- left sidebar active `消息与通知 > 通知模板`
- header, filter row, and exact continuous text `变量完整度 96%`
- left group panel
- center horizontal table with all 5 rows:
  `待办到达通知`, `盘点异常通知`, `风险预警通知`, `维保派工通知`, `CIP 转固提醒`
- codes including `NT_MAINTENANCE_DISPATCH`
- bottom three cards with `receiver_name`, `process_link`, `站内通知`, `钉钉 H5 卡片`, `重新校验`

Only rebuild the right editor action row and its local container inside the right editor panel:
- Right editor panel stays x=1145..1569 and y=231..704.
- Keep values `待办到达通知`, `NT_TODO_ARRIVED`, `站内通知`, `钉钉 H5 卡片`, `平台运维`.
- Keep editor variables `{{receiver_name}}`, `{{asset_name}}`, `{{todo_title}}`, `{{risk_level}}`, `{{process_link}}`.
- Move the three action buttons up from the current y=720 row into the right editor bottom action band.
- Required final text rects in Chrome 1586 x 992:
  - `插入变量`: x>=1120 and bottom<=715, target around x=1130 y=688.
  - `渲染预览`: x>=1120 and bottom<=715, target around x=1255 y=688.
  - `版本对比`: x>=1120 and bottom<=715, target around x=1380 y=688.
- Do not place any of these button texts below y=715.
- Do not shift the bottom workspace down or create document height above 992.
- Do not introduce emoji glyphs or hidden scroll areas.

Hard final self-check:
- `document.documentElement.scrollWidth === 1586`, `scrollHeight === 992`.
- `document.body.scrollWidth === 1586`, `scrollHeight === 992`.
- Required text present: `通知模板配置台`, `通知模板分组`, `通知模板列表`, `模板属性与内容编辑`, `变量字典`, `多渠道预览`, `发布校验清单`, `维保派工通知`, `CIP 转固提醒`, `NT_MAINTENANCE_DISPATCH`, `变量完整度 96%`, `插入变量`, `渲染预览`, `版本对比`.
- All five center row names are horizontal, inside x=430..1135 and y=270..700.
- `插入变量`, `渲染预览`, `版本对比` all satisfy x>=1120 and bottom<=715.
- Bottom card texts `receiver_name`, `process_link`, `站内通知`, `钉钉 H5 卡片`, `重新校验` are still visible within y=716..982.
