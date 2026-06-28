Edit the selected uploaded IMAGE screen into a high-fidelity HTML recreation.

The selected screen is the source of truth: a 1586 x 992 product screenshot named
`资产分类产品图 reference v2`.

Your job is not to redesign it. Convert the uploaded screenshot into an HTML UI that visually matches it as closely as possible.

## Non-negotiable reference rules
- Keep the same desktop canvas: 1586px wide, 992px tall.
- Preserve the same top dark navy `uniview | 固定资产管理系统` shell.
- Preserve the same active top tab `系统运营中枢`.
- Preserve the same left sidebar, active group `基础资料`, active child `资产分类`.
- Preserve the same main page title: `资产分类策略配置台`.
- Preserve the same positions, sizes, spacing, table density, panel borders, colors, and visual proportions from the uploaded screenshot.
- Do not invent a different product, different menu, different table data, different card style, or different dashboard.
- Do not output a small thumbnail layout. Use a fixed 1586 x 992 desktop frame.

## Visual geometry to match from the uploaded image
- Top bar: dark navy, height about 50px.
- Sidebar: white, width about 220px, starts under top bar.
- Main content begins at x≈220, y≈50 with light gray page background.
- Header/actions area at top of content.
- Status strip directly under header.
- Filter row directly under status strip.
- Workbench row with three columns:
  - left asset category tree,
  - center detail table,
  - right category property editor.
- Bottom row:
  - impact preview panel spans left tree + center table only,
  - publish checklist sits under the right property editor.

## Exact text that must appear
Top navigation:
`固定资产工作台`, `资产全景视图`, `大屏态势`, `流程协同`, `系统运营中枢`, `系统管理员`.

Sidebar:
`系统设置`, `组织与权限`, `用户与角色`, `基础资料`, `资产分类`, `编号规则`, `位置管理`, `供应商管理`, `自定义字段`, `自定义字段集`, `流程配置`, `集成配置`, `安全与审计`, `系统运维`.

Header:
`资产分类策略配置台`
`维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。`
Buttons: `新建资产分类`, `批量补类`, `影响预览`, `保存草稿`, `提交校验`.

Status strip:
`当前草稿已保存`, `编码唯一性通过`, `待建资产池 23 条待补类`.

Filter row:
`分类名称`, `分类编码`, `状态`, `折旧策略`, `盘点策略`, `标签策略`, `查询`, `重置`.

Left tree:
`资产分类树`, `全部分类 128`, `生产设备 56`, `贴片机 8`, `回流焊炉 6`, `检测设备 12`, `AOI检测机 6`, `IT设备 28`, `笔记本 12`, `服务器 8`, `工装夹具 18`, `办公设备 14`, `运输设备 6`, `其他资产 6`, `展开全部`.

Table title:
`分类明细表`.

Table columns:
`分类名称`, `分类编码`, `上级分类`, `折旧年限(年)`, `编号前缀`, `盘点策略`, `标签策略`, `状态`, `操作`.

Table rows exactly:
1. `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
2. `生产设备/回流焊炉`, `SE-RFH-001`, `生产设备`, `10`, `SERFH`, `季度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
3. `检测设备/AOI`, `TE-AOI-001`, `检测设备`, `7`, `TEAOI`, `月度盘点`, `检测类标签`, `启用`, `编辑 影响 停用`
4. `IT设备/笔记本`, `IT-NB-001`, `IT设备`, `3`, `ITNB`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
5. `IT设备/服务器`, `IT-SV-001`, `IT设备`, `5`, `ITSV`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
6. `工装夹具/治具`, `JG-JGJ-001`, `工装夹具`, `5`, `JGJG`, `半年度盘点`, `工装类标签`, `启用`, `编辑 影响 停用`
7. `办公设备/显示器`, `BG-XSQ-001`, `办公设备`, `3`, `BGXSQ`, `年度盘点`, `办公类标签`, `启用`, `编辑 影响 停用`

Right editor:
Title `分类属性编辑区`.
Fields in exact order:
`分类名称 *`, `分类编码 *`, `上级分类 *`, `折旧年限(年) *`, `编号前缀 *`, `盘点策略 *`, `标签策略 *`, `折旧策略 *`, `重点设备规则`, `MES/MAC绑定策略`, `CIP转固默认分类`, `审计策略`, `负责人 *`.
Values:
`生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `直线法`, `关键设备(价值>10万)`, `生产设备强制绑定MES`, `生产设备/贴片机`, `资产变更全审计`, `设备管理员`.
Buttons: `保存草稿`, `提交校验`, `预览影响`.

Publish checklist:
Title `发布检查清单`.
Rows:
`编码唯一性 通过`, `上级关系有效 通过`, `编号规则已绑定 通过`, `折旧策略完整 通过`, `盘点策略已配置 通过`, `权限影响已确认 通过`.
Warning: `23 条待建资产将按新分类重新预览`.

Impact preview:
Title `影响预览（基于当前编辑）`.
Cards in one row:
`编号规则引用`, `待建资产池`, `盘点策略`, `折旧衔接`, `MES/MAC绑定`.
Every card has a compact detail box and the link `查看详情`.

## Style constraints
- Use Ant Design-like enterprise B2B visual style.
- Primary blue `#1677ff`.
- Top navy `#061b38`.
- Page background `#f5f7fb`.
- White panels with 1px border `#d7e2ef`.
- Text primary `#12233d`, secondary `#63758a`.
- Radius 4-6px, no heavy shadows.
- Compact controls: 30-32px high.
- Table rows: about 40px high.
- Font: PingFang SC, Microsoft YaHei, Inter fallback.

## Do not
- Do not use title `企业资产管理系统`.
- Do not rename fields.
- Do not use `贴片机` alone where the screenshot says `生产设备/贴片机`.
- Do not change row values to other examples like `年度全盘`, `RFID大标签`, `洗手器`, or `研发仪器`.
- Do not omit right-side checklist.
- Do not crop the right editor.
- Do not stack impact cards vertically.
