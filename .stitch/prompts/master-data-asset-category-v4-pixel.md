You are recreating a desktop product screenshot as a high-fidelity static HTML screen.
This is not a generic admin CRUD page. It is a near-pixel remake of the provided product image:
`master-data-subpage-01-asset-category-v2.png`.

Target: Chinese fixed asset management system, menu path:
`系统运营中枢 / 基础资料 / 资产分类`.

The previous Stitch versions looked too different because they used a small responsive page and changed the shell proportions. This version must preserve the exact product-screen geometry, density, and visual hierarchy.

## Fixed Canvas Contract
- Render a fixed desktop canvas: exactly `1586px` wide and `992px` tall.
- Body background is `#f5f7fb`; no marketing, no hero, no dashboard chart decoration.
- The first viewport must show the entire working page: top navigation, left sidebar, header, status strip, filter bar, 3-column workbench, lower impact preview, and right publish checklist.
- No vertical document scroll is needed at 1586x992. If smaller browser widths occur, allow horizontal overflow rather than reflowing the layout.
- Use CSS that keeps the layout at fixed product proportions: `min-width:1586px; width:1586px; min-height:992px; height:992px; overflow:hidden;`.
- Do not create a 512px thumbnail-like layout. Do not stack the panels into a mobile/responsive layout.

## Absolute Geometry Map
Use these approximate screen coordinates. They are more important than creative interpretation.

Global shell:
- Top nav: `x=0 y=0 w=1586 h=50`, dark navy `#061b38`.
- Left sidebar: `x=0 y=50 w=220 h=942`, white, right border `#dbe3ef`.
- Main content: `x=220 y=50 w=1366 h=942`, background `#f5f7fb`.

Main content inner padding:
- Left margin inside main content: 20px.
- Right margin inside main content: 22px.
- Panels use 1px border `#d7e2ef`, radius 4-6px, no shadows.

Top page header:
- Header zone: `x=240 y=74 w=1324 h=48`.
- H1 at left: `资产分类策略配置台`, 20px, 800 weight, text `#12233d`.
- Subtitle under H1: `维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。`, 12px, `#63758a`.
- Action buttons aligned right in same row: five buttons, height 34px, 8px gap.

Status strip:
- `x=240 y=136 w=1324 h=46`.
- One white bordered strip, radius 6px.
- Three compact statuses in one row: green check `当前草稿已保存`, green check `编码唯一性通过`, orange warning `待建资产池 23 条待补录`.

Filter bar:
- `x=240 y=194 w=1324 h=56`.
- White bordered panel, radius 6px.
- 8 columns in one row: 分类名称, 分类编码, 状态, 折旧策略, 盘点策略, 标签策略, 查询, 重置.
- Label text 12px. Controls 32px high.

Workbench region:
- Top: `y=261`. Bottom work row ends at `y=747`.
- Left tree: `x=240 y=261 w=196 h=486`.
- Center table: `x=446 y=261 w=724 h=486`.
- Right column: `x=1180 y=261 w=384 h=699`.
- Gap between workbench panels: 10px.

Bottom impact preview:
- `x=240 y=758 w=930 h=202`.
- This panel spans only the left tree + center table area.
- It must NOT run under the right editor. The right side at this vertical level is the publish checklist.

Right publish checklist:
- Inside the right column, under the form panel.
- Form panel: `x=1180 y=261 w=384 h=486`.
- Checklist panel: `x=1180 y=758 w=384 h=202`.

## App Shell Details
Top nav:
- Left brand text: `uniview | 固定资产管理系统` with white logo-like text.
- Nav tabs in this exact order:
  `固定资产工作台`, `资产全景视图`, `大屏态势`, `流程协同`, `系统运营中枢`.
- Active tab is `系统运营中枢`, blue background/bottom line `#1677ff`, text white.
- Right tools: notification icon with red badge `12`, help icon, settings icon, divider, avatar circle, `系统管理员`, small down arrow.
- Use simple real icons or inline SVG. Never render icon-font names as visible text.

Sidebar:
- White sidebar with compact rows.
- Section title near top: `系统设置`.
- Menu groups:
  `组织与权限`, `用户与角色`, `基础资料`, `流程配置`, `集成配置`, `安全与审计`, `系统运维`.
- `基础资料` is expanded and highlighted pale blue.
- Children under `基础资料`: `资产分类` active, `编号规则`, `位置管理`, `供应商管理`, `自定义字段`, `自定义字段集`.
- Active child `资产分类`: pale blue `#e8f2ff`, text `#1677ff`, 4px radius.
- Icons are simple line icons, 14-16px, dark gray.

## Header Actions
Button sequence, exact labels:
1. Primary blue `+ 新建资产分类`
2. Outline `批量补类`
3. Outline `影响预览`
4. Outline blue `保存草稿`
5. Primary blue `提交校验`

Button styling:
- Height 34px, radius 4px, 12px text, medium weight.
- Primary background `#1677ff`, white text.
- Outline buttons white background, border `#cbd8e8`, blue/dark text.

## Filter Bar Content
One horizontal row:
- `分类名称` input placeholder `请输入`
- `分类编码` input placeholder `请输入`
- `状态` select placeholder `请选择`
- `折旧策略` select placeholder `请选择`
- `盘点策略` select placeholder `请选择`
- `标签策略` select placeholder `请选择`
- Primary blue button `查询`
- Gray outline button `重置`

## Left Category Tree Panel
Panel title row height 36px: `资产分类树`, collapse chevron at right.

Tree content must use compact indentation, folder icons, connecting guide lines, and exact nodes:
- root row: `全部分类 128`
- expanded group `生产设备 56`
  - active child `贴片机 8`
  - child `回流焊炉 6`
- expanded group `检测设备 12`
  - child `AOI检测机 6`
- expanded group `IT设备 28`
  - child `笔记本 12`
  - child `服务器 8`
- groups without children shown below: `工装夹具 18`, `办公设备 14`, `运输设备 6`, `其他资产 6`
- Bottom centered outline button: `展开全部`.

Active row is `贴片机 8`: blue text, pale blue background. It must not select AOI.

## Center Table Panel
Panel title row height 36px:
- left title `分类明细表`
- right/small text `共 7 条`

Table:
- Header background `#f7f9fc`.
- Header row height 38px.
- Data row height 39-42px. Seven visible rows must fit inside panel without vertical scrolling.
- Text size 12px; compact enterprise density.
- Visible vertical dividers and horizontal borders.
- Status `启用` is a tiny green dot plus text, not a pill.
- Operation links are blue.

Columns in exact order:
1. `分类名称`
2. `分类编码`
3. `上级分类`
4. `折旧年限(年)`
5. `编号前缀`
6. `盘点策略`
7. `标签策略`
8. `状态`
9. `操作`

Exact rows:
1. `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
2. `生产设备/回流焊炉`, `SE-RFH-001`, `生产设备`, `10`, `SERFH`, `季度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
3. `检测设备/AOI`, `TE-AOI-001`, `检测设备`, `7`, `TEAOI`, `月度盘点`, `检测类标签`, `启用`, `编辑 影响 停用`
4. `IT设备/笔记本`, `IT-NB-001`, `IT设备`, `3`, `ITNB`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
5. `IT设备/服务器`, `IT-SV-001`, `IT设备`, `5`, `ITSV`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
6. `工装夹具/治具`, `JG-JGJ-001`, `工装夹具`, `5`, `JGJG`, `半年度盘点`, `工装类标签`, `启用`, `编辑 影响 停用`
7. `办公设备/显示器`, `BG-XSQ-001`, `办公设备`, `3`, `BGXSQ`, `年度盘点`, `办公类标签`, `启用`, `编辑 影响 停用`

Pagination at bottom of table panel:
- text `共 7 条`
- previous chevron, active page square `1`, next chevron
- page size select `10条/页`

## Right Editor Panel
Panel title row height 36px:
- `分类属性编辑区`
- small context text may show `生产设备/贴片机`.

Form layout:
- 13 rows, compact two-column label/control grid.
- Labels width about 106-112px.
- Control height 30px.
- Row gap 6px.
- Buttons are fixed at the bottom of the form panel, not in the middle of the form.

Exact form labels and values in this exact order:
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

Footer buttons in form panel:
- `保存草稿`, `提交校验`, `预览影响`
- Three equal-width buttons, 30px high. Middle is primary blue.

## Right Publish Checklist Panel
Panel title: `发布检查清单`.
Six rows, exact labels:
1. green check `编码唯一性` right text `通过`
2. green check `上级关系有效` right text `通过`
3. green check `编号规则已绑定` right text `通过`
4. green check `折旧策略完整` right text `通过`
5. green check `盘点策略已配置` right text `通过`
6. green check `权限影响已确认` right text `通过`

Bottom warning box:
- Pale orange background `#fff7ed`, border `#fdba74`, orange icon.
- Text: `23 条待建资产将按新分类重新预览`.

## Bottom Impact Preview Panel
Panel title row: `影响预览（基于当前编辑）`; small context `生产设备/贴片机`.
- Five cards in a single horizontal row.
- Cards are compact, equal width, no wrapping, no stacking.
- Use small blue line icons.
- Each card border `#dbe3ef`, radius 6px.

Exact cards:
1. `编号规则引用`
   - `影响 2 条编号规则`
   - value `SESMT`
   - note `生产设备编号前缀已绑定`
   - detail box: `SE 生产设备编号规则`, `SMT 贴片机专用规则`
   - link `查看详情`
2. `待建资产池`
   - `影响 23 条待建资产`
   - value `23`
   - note `条待建资产将按分类重算`
   - detail box: `待建资产`, `贴片机（待建）12`, `贴片机-备品（待建）11`
   - link `查看详情`
3. `盘点策略`
   - `影响 1 条盘点计划`
   - value `月度盘点`
   - note `发布后刷新盘点计划`
   - detail box: `关联计划`, `生产设备月度盘点计划`
   - link `查看详情`
4. `折旧衔接`
   - `影响 1 条折旧策略`
   - value `8年`
   - note `影响资产卡片折旧参数`
   - detail box: `关联策略`, `生产设备折旧（直线法）`
   - link `查看详情`
5. `MES/MAC绑定`
   - `影响 1 条绑定策略`
   - value `已绑定`
   - note `设备类字段集随分类带出`
   - detail box: `关联策略`, `生产设备强制绑定MES`
   - link `查看详情`

## Product Visual Language
- Ant Design-like Chinese enterprise UI.
- Palette:
  - top navy `#061b38`
  - active/primary blue `#1677ff` or `#1769e8`
  - surface `#ffffff`
  - page background `#f5f7fb`
  - borders `#d7e2ef`, `#e6eef7`
  - text primary `#12233d`
  - text secondary `#63758a`
  - green `#0b8a53`
  - orange `#e86b00`
- Typography: PingFang SC / Microsoft YaHei / Inter fallback.
- Compact sizes:
  - panel title 12px, weight 800
  - field label 11-12px
  - controls 30-32px
  - table text 12px
  - cards 10-12px
- Corners are 4-6px. Do not use large rounded cards.
- No decorative gradients, blobs, hero imagery, marketing copy, large empty whitespace, or dashboard KPI cards.

## Hard Negative Constraints
- Do not use the old page name `企业资产管理系统`.
- Do not use a generic top bar or unrelated dashboard navigation.
- Do not omit the left sidebar or change active menu.
- Do not move `影响预览` below the whole page; it must sit under the tree/table only.
- Do not place `发布检查清单` inside the form panel; it is a separate lower-right panel.
- Do not reduce the table to 3 rows.
- Do not remove columns.
- Do not rename labels to `父级分类`, `默认折旧(月)`, or English words.
- Do not show icon font text such as `settings`, `notifications`, `folder`, `check_circle`.

## Acceptance Checklist
The visible screen must contain all of these in the first viewport:
- `uniview | 固定资产管理系统`
- active top tab `系统运营中枢`
- active sidebar item `资产分类`
- title `资产分类策略配置台`
- 7 table rows and 9 table columns
- 13 right form fields
- 5 impact cards under left+center
- 6 publish checklist rows on the lower right
- orange warning `23 条待建资产将按新分类重新预览`
