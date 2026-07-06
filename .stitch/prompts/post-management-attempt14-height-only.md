Edit the selected post-management DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 source `org-permission-subpage-07-post-management-v2.png` remains the only source of truth.
The selected attempt10 screen is the visual baseline because it already passed key text checks and had no internal scroll containers.

Create a NEW persistent DESIGN screen. Do not return DOM operations only.

Critical: this is a height-only repair.
Do not redesign the page.
Do not rewrite the shell, sidebar, KPI row, tree, table, right detail fields, or bottom business data.
Do not change any visible business strings.
Do not create internal scroll containers.
Do not use `overflow-y-auto`, `overflow-auto`, scrollable cards, or hidden scroll panels.

Preserve these exact successful attempt10 properties:
- Top-left brand: uppercase `UNIVIEW | 固定资产管理系统`.
- Title: `岗位管理与审批解析配置`.
- Required values present: `FA-CIP-0301`, `CIP专员`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `离职自动交接`, `审计策略-标准（STA-STD-01）`, `审计策略已开启`.
- Forbidden value absent: `审计策略未开启`.
- The center table stays horizontal; no vertical text stacking.
- No internal scroll containers.

The only failed gate in attempt10 was:
- document/body height was 995px, but source viewport is 1585 x 992.
- Bottom workflow row extended about 3px below the viewport.
- Right detail buttons visually overlapped the bottom section.

Repair only this:
- Make html, body, and the root app container exactly 1585 x 992.
- Make `documentElement.scrollHeight <= 992` and `body.scrollHeight <= 992`.
- Keep all visible content inside y=0..992.
- Keep the bottom row inside y=804..952.
- Keep the bottom row card height around 148px, not 150+.
- Move the bottom row top upward by 6px OR reduce its bottom padding by 8px; use whichever preserves the source look.
- Keep the right `岗位详情` action buttons above the bottom row with a visible gap of at least 8px.
- The bottom row must still show:
  `流程节点解析与发布检查`, `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`,
  `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`,
  `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.

Acceptance gates:
- Browser CSS viewport/document: 1585 x 992.
- Screenshot dimensions: 1585 x 992.
- `documentElement.scrollHeight <= 992`.
- `body.scrollHeight <= 992`.
- `scrollContainerCount = 0`.
- Required text/value checks still pass.
- Forbidden `审计策略未开启` absent.
