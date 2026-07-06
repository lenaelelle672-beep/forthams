Edit the selected post-management DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 source `org-permission-subpage-07-post-management-v2.png` is the only source of truth.
Use the selected recent screen only as a content/data baseline.

Create a NEW persistent DESIGN screen. Do not return only DOM operations.

The current failure is not just 3px overflow. The vertical bands are wrong:
- The bottom section currently begins too low, around y=833.
- In the source IMAGE2 screenshot, `流程节点解析与发布检查` begins around y=714 and ends around y=936.
- The middle workspace must end around y=703, not near y=824.

Hard source viewport:
- CSS document and screenshot: exactly 1585 x 992.
- No document scroll.
- No internal scroll containers.
- No vertical table text.
- Forbidden text absent: `审计策略未开启`.

Preserve exact source/business strings:
- Brand: `UNIVIEW | 固定资产管理系统`.
- Title: `岗位管理与审批解析配置`.
- Top buttons: `新建岗位`, `影响预览`, `保存草稿`, `提交校验`.
- Table values: `FA-CIP-0301`, `CIP专员`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `离职自动交接`.
- Right detail values: `CIP专员`, `FA-CIP-0301`, `CIP项目`, `CIP转固验收`, `CIP负责人（FA-CIP-0302）`, `资产项目角色包`, `项目级数据`, `离职自动交接`, `审计策略-标准（STA-STD-01）`.
- Bottom checklist: `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`.

Exact y-band reconstruction:
- Top nav: y=0..48.
- Sidebar: x=0..211, y=48..992.
- Main header: y=72..137.
- Status strip: y=147..181.
- KPI row: y=189..253.
- Middle workspace: y=264..703.
  - Left category card: x=226..392, y=264..703.
  - Center table card: x=406..1208, y=264..703.
  - Right detail card: x=1220..1572, y=264..703.
- Bottom `流程节点解析与发布检查`: x=226..1572, y=714..936.
- Collapse control: visible at left bottom around y=930.

Middle workspace rules:
- The center table must fit the same 6 visible rows as the source within y=322..641.
- Pagination/footer must be inside the center card at y≈660..690.
- Remove the large blank lower area currently below the center table.
- The right detail panel must show fields through `启用状态` and the buttons `保存岗位`, `影响预览`, `查看审计` inside y=264..703.
- Use compact source-like row heights. Reduce table row height and right form input height if needed.

Bottom section rules:
- Header `流程节点解析与发布检查` at y≈724.
- Four workflow cards visible on the left: `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`.
- Middle checklist visible with all six items and `审计策略已开启`.
- Right process diagram visible with nodes `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.
- Bottom explanatory sentence visible and not clipped.

Do not change horizontal layout proportions.
Do not switch to a generic admin template.
Do not add decorative images or marketing content.
