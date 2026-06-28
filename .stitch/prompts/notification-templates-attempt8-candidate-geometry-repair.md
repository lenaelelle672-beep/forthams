Edit the selected notification-template DESIGN screen into a new downloadable Stitch DESIGN screen.

This remains a 100/100 pixel-fidelity transcription task. Use the original IMAGE2 v2 screenshot as source of truth and use the selected candidate only as a near-layout baseline.
Do not return DOM operations only. The result must be a new/persistent DESIGN screen whose exported HTML contains the repaired layout.

Page: 通知模板配置台
Canvas: exact 1586 x 992. No page-level scroll. No internal scroll containers.

Current candidate problems to repair:
1. Document height is 1040; compress it to exactly 992.
2. Bottom row widths are wrong. The selected candidate makes `变量字典` too narrow, so table headers stack vertically. Restore source-like bottom geometry:
   - `变量字典`: x=234..640, y=716..964, width about 406.
   - `多渠道预览`: x=650..1106, y=716..964, width about 456.
   - `发布校验清单`: x=1116..1567, y=716..964, width about 451.
3. The right editor is too tall and causes clipping. Keep `模板属性与内容编辑` in x=1139..1567, y=231..704 only. Make editor rows compact so `插入变量`, `渲染预览`, and `版本对比` remain visible inside the middle panel.
4. The lower `发布校验清单` card must show all checklist rows and the `重新校验` button fully inside y<=952.

Exact text preservation:
- Keep visible values from the current candidate that match source: `待办到达通知`, `NT_TODO_ARRIVED`, `站内 + 钉钉`, `共 5 条`, `重新校验`.
- Restore source status text exactly where possible: `变量完整度 96%`, `8/8 完整`, `7/8 缺1项`, `9/10 缺1项`.
- Keep `搜索模板名称 / 编码 / 业务事件 / 变量 / 渠道` visible in the filter input.

Hard visual rules:
- Horizontal text only. Do not stack `变量来源`, `是否必填`, `说明`, or row values vertically.
- Use compact 12px Chinese table text if necessary. Prefer smaller text over vertical wrapping.
- Do not introduce emoji icons, markdown fence text, or generic placeholder content.
- Preserve the IMAGE2 shell: UNIVIEW brand, dark sidebar, 消息与通知 expanded, 通知模板 active.

Final self-check:
- documentElement.scrollWidth == 1586 and scrollHeight == 992.
- `变量字典` headers and rows read horizontally.
- `发布校验清单` and `重新校验` visible.
- No visible content below the viewport.
