Edit the selected screen using the uploaded product screenshot as the only authority.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.

## Scoring contract
Your goal is a 100/100 visual match to the uploaded screenshot.
Grade the result against the screenshot before finishing.
Any visible mismatch loses points.

Priority order:
1. Exact geometry and panel positions.
2. Exact visible Chinese text.
3. Exact table column widths, row density, and no unwanted wrapping.
4. Exact right editor field count, order, density, and button position.
5. Exact bottom impact-preview and publish-checklist alignment.
6. Exact colors, borders, radius, typography, and icon style.

Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.
The uploaded screenshot is the only source of truth.

## Fixed frame
- Canvas: 1586px wide x 992px tall.
- No page-level vertical scroll at 1586x992.
- Top nav: 50px high.
- Left sidebar: 220px wide.
- Main content starts at x=220 y=50.

## Must match the screenshot

### Top shell
- `uniview | 固定资产管理系统`
- Top tabs: `固定资产工作台`, `资产全景视图`, `大屏态势`, `流程协同`, `系统运营中枢`.
- `系统运营中枢` is active.
- Right tools include red badge `12`, help, settings, avatar, `系统管理员`.

### Sidebar
- Title `系统设置`.
- Groups: `组织与权限`, `用户与角色`, `基础资料`, `流程配置`, `集成配置`, `安全与审计`, `系统运维`.
- `基础资料` expanded.
- `资产分类` active.
- Children: `资产分类`, `编号规则`, `位置管理`, `供应商管理`, `自定义字段`, `自定义字段集`.

### Header and actions
- Title `资产分类策略配置台`.
- Subtitle `维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。`
- Buttons: `新建资产分类`, `批量补类`, `影响预览`, `保存草稿`, `提交校验`.

### Status and filter
- Status strip: `当前草稿已保存`, `编码唯一性通过`, `待建资产池 23 条待补类`.
- Filter row stays one row:
  `分类名称`, `分类编码`, `状态`, `折旧策略`, `盘点策略`, `标签策略`, `查询`, `重置`.

### Workbench geometry
Use the screenshot proportions:
- Left tree panel width about 196px.
- Center table panel wide enough to read all 9 columns.
- Right editor panel about 384px.
- Gaps about 10px.
- Bottom impact preview spans left tree + center table only.
- Publish checklist is under the right editor only.

### Left tree
Show:
`资产分类树`, `全部分类 128`, `生产设备 56`, `贴片机 8`, `回流焊炉 6`, `检测设备 12`, `AOI检测机 6`, `IT设备 28`, `笔记本 12`, `服务器 8`, `工装夹具 18`, `办公设备 14`, `运输设备 6`, `其他资产 6`, `展开全部`.
Active tree item: `贴片机 8`.

### Center table
Do not allow vertical text fragments.
Use single-line cells, with ellipsis only if needed.
Font size 12px. Row height about 40px.

Columns:
`分类名称`, `分类编码`, `上级分类`, `折旧年限(年)`, `编号前缀`, `盘点策略`, `标签策略`, `状态`, `操作`.

Rows exactly:
1. `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
2. `生产设备/回流焊炉`, `SE-RFH-001`, `生产设备`, `10`, `SERFH`, `季度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
3. `检测设备/AOI`, `TE-AOI-001`, `检测设备`, `7`, `TEAOI`, `月度盘点`, `检测类标签`, `启用`, `编辑 影响 停用`
4. `IT设备/笔记本`, `IT-NB-001`, `IT设备`, `3`, `ITNB`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
5. `IT设备/服务器`, `IT-SV-001`, `IT设备`, `5`, `ITSV`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
6. `工装夹具/治具`, `JG-JGJ-001`, `工装夹具`, `5`, `JGJG`, `半年度盘点`, `工装类标签`, `启用`, `编辑 影响 停用`
7. `办公设备/显示器`, `BG-XSQ-001`, `办公设备`, `3`, `BGXSQ`, `年度盘点`, `办公类标签`, `启用`, `编辑 影响 停用`

### Right editor
All 13 fields must be visible in the editor panel in this exact order before the buttons.
No field may be hidden, moved below the buttons, or replaced.
Use compact density like the screenshot:
- label 11px
- value 12px
- control height 27-29px
- row gap 3-4px
- label width about 104px

Fields and values:
1. `分类名称 *` = `生产设备/贴片机`
2. `分类编码 *` = `SE-SMT-001`
3. `上级分类 *` = `生产设备`
4. `折旧年限(年) *` = `8`
5. `编号前缀 *` = `SESMT`
6. `盘点策略 *` = `月度盘点`
7. `标签策略 *` = `设备类标签`
8. `折旧策略 *` = `直线法`
9. `重点设备规则` = `关键设备(价值>10万)`
10. `MES/MAC绑定策略` = `生产设备强制绑定MES`
11. `CIP转固默认分类` = `生产设备/贴片机`
12. `审计策略` = `资产变更全审计`
13. `负责人 *` = `设备管理员`

Buttons after the 13th field:
`保存草稿`, `提交校验`, `预览影响`.

### Publish checklist
Title: `发布检查清单`.
Rows:
`编码唯一性 通过`, `上级关系有效 通过`, `编号规则已绑定 通过`, `折旧策略完整 通过`, `盘点策略已配置 通过`, `权限影响已确认 通过`.
Warning: `23 条待建资产将按新分类重新预览`.

### Impact preview
Title: `影响预览（基于当前编辑）`.
Five cards in one row:
`编号规则引用`, `待建资产池`, `盘点策略`, `折旧衔接`, `MES/MAC绑定`.

## Final self-check before completion
Only finish if these are true:
- The page looks like a direct HTML transcription of the screenshot, not a recreated admin template.
- All major blocks align with the screenshot.
- 7 table rows are visible.
- 13 editor fields are visible before the action buttons.
- 5 impact cards are visible.
- 6 checklist rows are visible.
- No required text has been renamed.
