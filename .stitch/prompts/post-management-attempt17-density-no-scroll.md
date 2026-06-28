Edit the selected post-management DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 source `org-permission-subpage-07-post-management-v2.png` is the only source of truth.
Use the selected attempt16 screen only as a structural baseline because it is closer than earlier attempts.

Do not change the top nav, sidebar, header, status strip, KPI cards, or overall white enterprise visual style.
Keep the current good positions:
- Top nav y=0..48.
- Sidebar x=0..211.
- Header y=64..137.
- Status strip y=153..193.
- KPI row y=205..281.
- Middle workspace y=282..720.
- Bottom workflow/check card y=732..954.

Current failure to repair:
- Center table still has horizontal overflow and hides source columns.
- Right detail panel still has internal vertical scroll and hides `审计策略`, `启用状态`, or bottom buttons depending on scroll position.
- Left category list has a small internal scroll.

Hard constraints:
- Canvas and CSS viewport exactly 1585 x 992.
- document height exactly 992.
- No page-level scroll.
- No internal scroll containers in left tree, center table, or right detail panel.
- No clipped right-panel buttons.
- No clipped bottom workflow/check/process content.
- Forbidden text absent: `审计策略未开启`.

Center table repair:
- Keep the center card x≈439..1236 and y≈282..720.
- Fit the entire table inside this card width with no horizontal overflow.
- Use compact source-like 12px text, 36px to 42px row height, and narrow columns.
- All columns must be visible without scroll:
  `岗位`, `岗位编码`, `职责范围`, `审批解析`, `角色联动`, `数据权限`, `交接策略`, `状态`, `操作`.
- Preserve six visible rows:
  `资产管理员`, `资产会计`, `部门负责人`, `系统管理员`, `CIP专员`, `审计岗`.
- The selected `CIP专员` row must show:
  `FA-CIP-0301`, `CIP项目`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `离职自动交接`, `待确认`, `编辑`, `复制`, `更多`.
- Pagination remains at the bottom and visible: `共 128 条`, `1 2 3 4 5 ... 13`, `10 条/页`.

Right detail repair:
- Keep the right detail card x≈1250..1568 and y≈282..720.
- Remove its internal vertical scroll. All fields must fit in the visible card.
- Use compact source-like form rows: small labels, 28px to 32px input height, 7px to 8px vertical gaps.
- Required fields and values must all be visible in this order:
  `岗位名称` `CIP专员`
  `岗位编码` `FA-CIP-0301`
  `职责范围` `CIP项目`
  `审批解析` `CIP转固验收`
  `兜底岗位` `CIP负责人（FA-CIP-0302）`
  `角色联动` `资产项目角色包`
  `数据权限联动` `项目级数据`
  `交接策略` `离职自动交接`
  `审计策略` `审计策略-标准（STA-STD-01）`
  `启用状态`
- Buttons must be visible at the bottom of the right panel: `保存岗位`, `影响预览`, `查看审计`.

Left tree repair:
- Remove left tree internal vertical scroll.
- Keep all visible source categories through `设备运维 30`.
- Keep active `CIP专员`.

Bottom section:
- Preserve the current attempt16 bottom section because it is close.
- Ensure all items remain visible:
  `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`,
  `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`,
  `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.

Brand:
- Preserve the exact source-like top-left lockup: white `UNIVIEW`, blue circular mark, vertical divider, `固定资产管理系统`.
- Do not generate a different logo or split the wordmark.

Final self-check:
- CSS viewport 1585 x 992.
- documentElement.scrollHeight 992.
- No visible card uses scrollbars to reveal required content.
- The right panel visibly includes `审计策略-标准（STA-STD-01）` and `启用状态`.
- The center table visibly includes the selected row code `FA-CIP-0301` and the `操作` column.
- The result remains visually aligned to the uploaded IMAGE2 screenshot, not a generic admin template.
