Edit the selected post-management DESIGN screen into a new persistent Stitch DESIGN screen.

This is a surgical repair, not a redesign.
The IMAGE2 v2 source `org-permission-subpage-07-post-management-v2.png` remains the only source of truth.
Use the selected attempt17 screen as the baseline and change ONLY the center `岗位列表` table fit.

Do not change:
- Top nav, sidebar, header, status strip, KPI cards.
- Left `岗位分类` tree.
- Right `岗位详情` panel.
- Bottom `流程节点解析与发布检查` section.
- Global canvas size, colors, borders, typography, or layout bands.

Current failure:
- The center table still has horizontal overflow.
- The source screenshot shows the `状态` and `操作` columns visible without horizontal scrolling.
- attempt17 hides `状态` and `操作` to the right, so it is not a 100/100 transcription.

Hard table repair:
- Center table viewport/card remains x≈439..1236, y≈377..664.
- Remove horizontal scroll completely.
- No internal scroll containers in the table wrapper.
- All 9 table columns must be visible inside the same card width:
  `岗位`, `岗位编码`, `职责范围`, `审批解析`, `角色联动`, `数据权限`, `交接策略`, `状态`, `操作`.
- Use a fixed compact grid/table layout whose total width is less than the visible card:
  - selector/radio column: 36px
  - `岗位`: 84px
  - `岗位编码`: 96px
  - `职责范围`: 116px
  - `审批解析`: 96px
  - `角色联动`: 98px
  - `数据权限`: 82px
  - `交接策略`: 88px
  - `状态`: 58px
  - `操作`: 92px
- Use 11px to 12px source-like text.
- Keep row height around 42px.
- Use single-line cells with ellipsis for long text, matching the source density.
- Do not wrap table cells vertically and do not stack Chinese characters.

Required visible table content:
- Six rows remain visible: `资产管理员`, `资产会计`, `部门负责人`, `系统管理员`, `CIP专员`, `审计岗`.
- Selected row remains highlighted on `CIP专员`.
- Visible statuses include `已启用` and `待确认`.
- `操作` column shows `编辑`, `复制`, `更多`.
- Pagination remains visible: `共 128 条`, `1 2 3 4 5 ... 13`, `10 条/页`.

Global hard constraints:
- CSS viewport 1585 x 992.
- documentElement.scrollHeight 992.
- No page-level scroll.
- No overflow beyond viewport.
- Forbidden text absent: `审计策略未开启`.

Final self-check:
- `scrollWidth` of the table wrapper is not greater than its `clientWidth`.
- `状态` and `操作` columns are visibly present.
- Everything outside the center table remains visually unchanged from attempt17.
