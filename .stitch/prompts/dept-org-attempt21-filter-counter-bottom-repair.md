Repair the selected Stitch DESIGN screen. Keep the current successful structure, table rows, right panel fields, and data. Do not regenerate a different page.

This is a narrow pixel-fidelity repair against `org-permission-subpage-06-dept-org-v2.png`.
Return a persistent full DESIGN screen with downloadable HTML and screenshot. Do not return only DOM operation suggestions.

Keep these parts unchanged because they already pass verification:
- Document size 1586 x 992.
- All 8 center table rows from `设备管理部` to `运维支持组`.
- Right panel values `中（4 条待办，2 条审批）`, `按组织规则执行`, `是否启用`, and buttons `保存部门`, `差异确认`, `查看审计`.
- Bottom band visual content and current data.

Fix only these issues:

1. Search field exact text
- The verifier must read the exact text `搜索部门、编码、负责人、成本中心、同步来源`.
- Do not rely only on an input placeholder. Make this string visible and available in text or input value at y=142..209.
- It can appear as the input value or a visible muted search text inside the search control.

2. Counter exact text
- Replace every visible `8 / 12` with exact `8/12`.
- Do not leave the spaced version anywhere in text.
- Place exact `8/12` in the filter strip y=142..209.

3. Remove real scroll container in right detail
- The right `部门详情` body currently has `overflow-y-auto`.
- Remove internal scrolling. Fit the form inside x=1263..1572, y=142..694.
- Keep all 11 fields and the bottom buttons visible.
- Tighten vertical gaps if needed, but do not omit `交接规则` or `是否启用`.

4. Bottom band y-position
- `生成影响快照` and `查看差异详情` are currently below the 992 viewport.
- Compress the bottom band so all bottom content is visible between y=706 and y=958.
- The following must be visible inside the first viewport:
  `CIP立项`, `工作交接`, `生成影响快照`, `发布检查清单`, `交接规则已配置`, `查看差异详情`.
- Do not create internal scrollbars in the bottom band.

5. Scroll rule
- No element may have real overflow with `overflow:auto` or `overflow:scroll`.
- If an element uses an overflow class but content fits, that is acceptable; however no required content may be hidden.

Final self-check:
- In Chrome 1586 x 992, `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `8/12` is visible and `8 / 12` is absent.
- The exact search string is readable by page text or input value.
- Real internal scroller count is zero.
- `生成影响快照` and `查看差异详情` are visible within y<=958.
