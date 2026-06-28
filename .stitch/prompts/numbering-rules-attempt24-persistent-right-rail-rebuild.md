This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

IMPORTANT PERSISTENCE REQUIREMENT:
- Do NOT return DOM operations only.
- Do NOT use temporary project.file_update patches.
- Create a new persistent Stitch DESIGN screen with exported HTML containing the repaired right rail.
- The exported HTML must already contain the compact right rail structure.

Task:
Rebuild the entire right rail only, using fixed exported HTML geometry. Keep every other part of the current screen unchanged.

Keep unchanged:
- Top shell and `UNIVIEW | 固定资产管理系统` brand.
- Sidebar and active menu.
- Page title, action buttons, status strip, filters.
- Left `编号规则列表`.
- Center `编号规则明细表`, `编号试算预览`, and `冲突检测队列`.

Replace the right rail with this persistent fixed layout:

Right rail:
- x=1218..1576, y=247..952, width about 358px.
- Two white bordered cards with a clear 8px gap.
- No `overflow-y-auto`, no `overflow-auto`, no `overflow-scroll`, no `max-h-`.

Card 1: `编号规则属性编辑区`
- x=1218..1576, y=247..736.
- Title y=262.
- Form rows use persistent fixed CSS, not scroll:
  row height 24px, control height 20px, label width 86px, label font 11px, row gap 1px.
- Include all rows exactly:
  `规则名称`, `规则编码`, `业务对象`, `编号模式`, `序列口径`, `年月格式`, `序列位数`, `数量折行`, `预览不占号`, `生成占号策略`, `冲突处理`, `回滚方案`, `审计策略`, `负责人`.
- Values match source/current:
  `小类+年月+公共月序列`, `R-CLS-YM-MSEQ`, `生产设备等 12 类`, `小类+年月+公共月序列`, `公共月序列`, `YYYYMM（如 202606）`, `4`, `是`, `不占号`, `保存草稿后占号`, `不生成，进入冲突队列`, `回滚不释放编号（保留占号）`, `完整审计（新增/修改/占号/回滚）`, `资产管理员`.
- Button row inside card 1:
  y=700..728, bottom <=736.
  Three buttons visible and horizontal:
  `保存草稿`, `提交校验`, `试算编号`.

Card 2: `发布门禁 / 回滚策略`
- x=1218..1576, y=744..952.
- Title y=758..774.
- Checklist area y=790..929.
- Use fixed 18px rows with 2px gaps.
- Rows:
  `编码唯一性` -> `通过`
  `序列口径确认` -> `通过`
  `数量折行已配置` -> `通过`
  `试算样本通过` -> `通过`
  `冲突队列已处理` -> `待处理 1 项`
  `回滚方案已编写` -> `通过`
- Row y positions:
  796, 819, 842, 865, 888, 911.
- Orange warning y=932..948, fully visible:
  `已生成资产保留旧编号，新规则仅影响发布后批次。`

Status strip text:
- Keep visually exact:
  `试算样本 3 条`
  `冲突检测 1 项待处理`

Technical constraints:
- Browser viewport 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- No vertical/squeezed text.
- Exact terms: `数量折行`, `序列位数`, `预览不占号`.
- Forbidden terms: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Acceptance:
- Exporting the returned new screen must produce HTML where the three editor buttons and all six release gate rows plus orange warning are visible within 1586 x 992.
