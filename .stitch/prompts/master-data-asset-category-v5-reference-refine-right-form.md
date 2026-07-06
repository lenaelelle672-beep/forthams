Edit the selected screen. Keep the current refined layout and table exactly as-is. Only fix the right-side `分类属性编辑区` form.

Current issue:
- The right editor panel only shows the first several fields before the buttons.
- In the reference screenshot, all 13 form fields are visible in the right editor panel before the bottom buttons.

Do not change:
- Top nav, sidebar, status strip, filter bar.
- Center table layout, table rows, table column widths.
- Bottom impact preview cards.
- Publish checklist content and position.

Right editor requirements:
- Panel title: `分类属性编辑区`.
- The right editor width stays about 384px.
- Make the form compact enough to show all 13 fields in the visible panel.
- Use label font 11px, value font 12px.
- Use control height 28px or 29px.
- Use row gap 4px.
- Use label width around 104px.
- The three action buttons appear after the 13th field at the bottom of the editor panel.
- Do not place buttons after field 8.
- Do not hide fields behind scroll.

Fields in exact visible order:
1. `分类名称 *` value `生产设备/贴片机`
2. `分类编码 *` value `SE-SMT-001`
3. `上级分类 *` value `生产设备`
4. `折旧年限(年) *` value `8`
5. `编号前缀 *` value `SESMT`
6. `盘点策略 *` value `月度盘点`
7. `标签策略 *` value `设备类标签`
8. `折旧策略 *` value `直线法`
9. `重点设备规则` value `关键设备(价值>10万)`
10. `MES/MAC绑定策略` value `生产设备强制绑定MES`
11. `CIP转固默认分类` value `生产设备/贴片机`
12. `审计策略` value `资产变更全审计`
13. `负责人 *` value `设备管理员`

Buttons after the fields:
`保存草稿`, `提交校验`, `预览影响`.

Keep the Ant Design style, #1677ff primary, #f5f7fb background, #d7e2ef borders.
