Create a high-fidelity desktop HTML screen for the Chinese fixed asset management system page:
"系统运营中枢 / 基础资料 / 资产分类".

This is a strict remake of IMAGE2 `master-data-subpage-01-asset-category-v2.png`.
Do not simplify the page. Do not create a generic CRUD admin page. Do not create a dashboard.

## Canvas And Shell
- Desktop canvas: 1586 x 992, full width, no marketing content.
- App shell:
  - Top dark navy bar, height 52px, background #061b38.
  - Left brand area: `uniview | 固定资产管理系统`.
  - Top tabs: `固定资产工作台`, `资产全景视图`, `大屏态势`, `流程协同`, `系统运营中枢`.
  - `系统运营中枢` must be active with blue highlight #1677ff.
  - Right tools: notification badge `12`, help icon, settings icon, avatar, `系统管理员`.
- Left sidebar:
  - Width 220px, white background #ffffff, right border #dbe3ef.
  - Section title `系统设置`.
  - Menu groups in order: `组织与权限`, `用户与角色`, `基础资料`, `流程配置`, `集成配置`, `安全与审计`, `系统运维`.
  - `基础资料` is expanded.
  - Children under `基础资料`: `资产分类` active, then `编号规则`, `位置管理`, `供应商管理`, `自定义字段`, `自定义字段集`.
  - Active `资产分类`: pale blue #e8f2ff, blue text #1677ff, 4px radius, clear left emphasis.
  - No search box in the top navigation or sidebar.

## Page Header
- Main area background #f6f8fb.
- Header content uses white/very pale surface, padding 22px 20px 12px.
- Left:
  - H1 `资产分类策略配置台`, 20px, weight 700, color #172033.
  - Subtitle `维护资产大类、小类、折旧、编号前缀、盘点策略、标签策略和重点设备规则。`, 12px, color #68758a.
- Right action buttons in one row:
  1. Primary blue `+ 新建资产分类`
  2. Outline `批量补类`
  3. Outline `影响预览`
  4. Outline blue `保存草稿`
  5. Primary blue `提交校验`
- Status strip below header:
  - One bordered white strip, height about 44px, border #dbe3ef, radius 6px.
  - Three inline statuses:
    - Green check `当前草稿已保存`
    - Green check `编码唯一性通过`
    - Orange warning `待建资产池 23 条待补类`

## Filter Bar
- Directly under status strip.
- White panel, border #dbe3ef, radius 6px, height about 58px, horizontal layout.
- Fields in exact order:
  - `分类名称` input placeholder `请输入`
  - `分类编码` input placeholder `请输入`
  - `状态` select placeholder `请选择`
  - `折旧策略` select placeholder `请选择`
  - `盘点策略` select placeholder `请选择`
  - `标签策略` select placeholder `请选择`
  - Primary blue button `查询`
  - Gray outline button `重置`
- Keep this filter bar outside the table. Search/filter belongs here only.

## Main Work Area
Use a 3-column layout with equal vertical alignment:
- Left tree: 200px wide.
- Center table area: flexible.
- Right editor/checklist area: 384px wide.
- Gap: 10px.
- The work area should fit above the bottom impact preview.

### Left Category Tree Panel
- White panel, border #dbe3ef, radius 6px.
- Header: `资产分类树`, with a small collapse chevron on the right.
- Tree must show at least these nodes:
  - `全部分类 128`
  - `生产设备 56`
  - `贴片机 8`
  - `回流焊炉 6`
  - `检测设备 12`
  - `AOI检测机 6`
  - `IT设备 28`
  - `笔记本 12`
  - `服务器 8`
  - `工装夹具 18`
  - `办公设备 14`
  - `运输设备 6`
  - `其他资产 6`
- Use folder/file icons, indentation, chevrons, and small counts.
- Active tree path is `生产设备 / 贴片机`, not AOI.
- Tree active row: blue text, pale blue background.
- Bottom button: `展开全部`.

### Center Detail Table Panel
- White panel, border #dbe3ef, radius 6px.
- Header row:
  - Title `分类明细表`
  - Small count `共 7 条`
- Table columns in exact order:
  1. `分类名称`
  2. `分类编码`
  3. `上级分类`
  4. `折旧年限(年)`
  5. `编号前缀`
  6. `盘点策略`
  7. `标签策略`
  8. `状态`
  9. `操作`
- Table must show exactly 7 visible rows:
  1. `生产设备/贴片机`, `SE-SMT-001`, `生产设备`, `8`, `SESMT`, `月度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
  2. `生产设备/回流焊炉`, `SE-RFH-001`, `生产设备`, `10`, `SERFH`, `季度盘点`, `设备类标签`, `启用`, `编辑 影响 停用`
  3. `检测设备/AOI`, `TE-AOI-001`, `检测设备`, `7`, `TEAOI`, `月度盘点`, `检测类标签`, `启用`, `编辑 影响 停用`
  4. `IT设备/笔记本`, `IT-NB-001`, `IT设备`, `3`, `ITNB`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
  5. `IT设备/服务器`, `IT-SV-001`, `IT设备`, `5`, `ITSV`, `季度盘点`, `IT类标签`, `启用`, `编辑 影响 停用`
  6. `工装夹具/治具`, `JG-JGJ-001`, `工装夹具`, `5`, `JGJG`, `半年度盘点`, `工装类标签`, `启用`, `编辑 影响 停用`
  7. `办公设备/显示器`, `BG-XSQ-001`, `办公设备`, `3`, `BGXSQ`, `年度盘点`, `办公类标签`, `启用`, `编辑 影响 停用`
- Header background #f7f9fc, compact 12px text, visible vertical dividers.
- Row height around 42px. Dense but readable.
- Status `启用` is a green dot + text, not a large badge.
- Operation links are blue.
- Bottom pagination: `共 7 条`, page `1` active, page size `10条/页`.

### Right Editor And Publish Checklist
- Right side is a vertical stack:
  1. Upper white panel `分类属性编辑区`.
  2. Lower white panel `发布检查清单`.

#### 分类属性编辑区
- Header: `分类属性编辑区`.
- Form fields in exact order, with labels and current values:
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
- Most fields should be select-like controls with dropdown arrows where appropriate.
- Footer buttons: `保存草稿`, `提交校验`, `预览影响`.

#### 发布检查清单
- Header: `发布检查清单`.
- Six checklist rows:
  1. Green check `编码唯一性` right text `通过`
  2. Green check `上级关系有效` right text `通过`
  3. Green check `编号规则已绑定` right text `通过`
  4. Green check `折旧策略完整` right text `通过`
  5. Green check `盘点策略已配置` right text `通过`
  6. Green check `权限影响已确认` right text `通过`
- Orange warning box at bottom:
  - `23 条待建资产将按新分类重新预览`

## Bottom Impact Preview
- Full-width white panel below main work area, aligned under left+center but not hidden.
- Header: `影响预览（基于当前编辑）`.
- Show exactly 5 cards in one row:
  1. `编号规则引用`
     - Subtext `影响 2 条编号规则`
     - Detail box:
       - `关联规则`
       - `SE 生产设备编号规则`
       - `SMT 贴片机专用规则`
     - Link `查看详情`
  2. `待建资产池`
     - Subtext `影响 23 条待建资产`
     - Detail box:
       - `待建资产`
       - `贴片机（待建） 12`
       - `贴片机-备品（待建） 11`
     - Link `查看详情`
  3. `盘点策略`
     - Subtext `影响 1 条盘点计划`
     - Detail box:
       - `关联计划`
       - `生产设备月度盘点计划`
     - Link `查看详情`
  4. `折旧衔接`
     - Subtext `影响 1 条折旧策略`
     - Detail box:
       - `关联策略`
       - `生产设备折旧（直线法）`
     - Link `查看详情`
  5. `MES/MAC绑定`
     - Subtext `影响 1 条绑定策略`
     - Detail box:
       - `关联策略`
       - `生产设备强制绑定MES`
     - Link `查看详情`
- Cards: white, border #dbe3ef, radius 6px, small blue icons, compact text.

## Visual Style
- Ant Design style, crisp enterprise B2B, compact density.
- Primary #1677ff, deep navy #061b38, page background #f6f8fb.
- Borders #dbe3ef / #e8edf5, text #172033 / #68758a.
- Border radius 4-6px, no large rounded cards.
- No hero, no decorative blobs, no one-note purple gradients.
- Use Chinese labels exactly. No English placeholders.
- The screen must visibly contain: 7 table rows, 13 right form fields, 5 bottom impact cards, 6 checklist rows.
