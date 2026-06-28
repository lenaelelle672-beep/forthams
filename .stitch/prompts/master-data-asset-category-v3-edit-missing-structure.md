Edit the selected screen only. Keep the current visual shell, top nav, sidebar, filter bar, and bottom impact cards, but fix the missing product-image structure so it matches IMAGE2 `master-data-subpage-01-asset-category-v2.png`.

Hard requirements:

1. Center table must show exactly these 7 visible rows and these 9 columns:
Columns: `分类名称`, `分类编码`, `上级分类`, `折旧年限(年)`, `编号前缀`, `盘点策略`, `标签策略`, `状态`, `操作`.
Rows:
- `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
- `生产设备/回流焊炉`, `SE-RFH-001`, `生产设备`, `10`, `SERFH`, `季度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
- `检测设备/AOI`, `TE-AOI-001`, `检测设备`, `7`, `TEAOI`, `月度盘点`, `检测类标签`, `启用`, `编辑 影响 停用`
- `IT设备/笔记本`, `IT-NB-001`, `IT设备`, `3`, `ITNB`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
- `IT设备/服务器`, `IT-SV-001`, `IT设备`, `5`, `ITSV`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
- `工装夹具/治具`, `JG-JGJ-001`, `工装夹具`, `5`, `JGJG`, `半年度盘点`, `工装类标签`, `启用`, `编辑 影响 停用`
- `办公设备/显示器`, `BG-XSQ-001`, `办公设备`, `3`, `BGXSQ`, `年度盘点`, `办公类标签`, `启用`, `编辑 影响 停用`

2. Right form must show exactly these 13 labels in this order:
`分类名称 *`, `分类编码 *`, `上级分类 *`, `折旧年限(年) *`, `编号前缀 *`, `盘点策略 *`, `标签策略 *`, `折旧策略 *`, `重点设备规则`, `MES/MAC绑定策略`, `CIP转固默认分类`, `审计策略`, `负责人 *`.
Use current values: `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `直线法`, `关键设备(价值>10万)`, `生产设备强制绑定MES`, `生产设备/贴片机`, `资产变更全审计`, `设备管理员`.

3. Add the lower right panel `发布检查清单` with exactly six checklist rows:
`编码唯一性 通过`, `上级关系有效 通过`, `编号规则已绑定 通过`, `折旧策略完整 通过`, `盘点策略已配置 通过`, `权限影响已确认 通过`.
Keep the orange warning: `23 条待建资产将按新分类重新预览`.

4. Keep bottom `影响预览（基于当前编辑）` with exactly five cards:
`编号规则引用`, `待建资产池`, `盘点策略`, `折旧衔接`, `MES/MAC绑定`.

5. Use dense Ant Design style. Do not rename to `父级分类`, `默认折旧(月)`, or English terms. Use `上级分类`, `折旧年限(年)`, `编号前缀`, `标签策略` exactly.
