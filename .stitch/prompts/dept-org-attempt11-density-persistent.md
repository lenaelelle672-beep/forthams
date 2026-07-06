Edit the selected department-organization DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 source `org-permission-subpage-06-dept-org-v2.png` is the only source of truth.
Use the selected attempt9 screen only as a structural baseline.
Create a NEW persistent DESIGN screen. Do not return only DOM operations.

Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Reference:
- Page name: 部门组织
- Menu id: system-dept-org
- Reference image: org-permission-subpage-06-dept-org-v2.png
- Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-06-dept-org-v2.png
- Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-dept-org

Brand:
- Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW`, adjacent `固定资产管理系统`, source spacing, source divider/lockup.
- Do not lowercase, split, redraw, or replace the wordmark.

Hard frame:
- CSS viewport exactly 1586 x 992.
- documentElement.scrollWidth exactly 1586.
- documentElement.scrollHeight exactly 992.
- No page-level scroll.
- No internal scroll containers for source-visible content.
- No clipped right-card buttons, bottom warning, or bottom hint card.

Preserve source geometry:
- Top navigation: x=0..1586, y=0..57, active `系统运营中枢`.
- Sidebar: x=0..174, y=57..992, active `部门组织`.
- Main content: x=174..1586, y=57..992.
- Header: y≈76..126 with title `部门组织与负责人配置` and buttons `新建部门`, `同步组织`, `差异确认`, `保存草稿`, `提交校验`.
- Filter bar: x≈188..1250, y≈142..216. Search placeholder `搜索部门、编码、负责人、成本中心、同步来源`; tabs `全部部门`, `正常`, `负责人变更`, `同步差异`; exact counter `8/12`.
- Middle workspace: y≈222..693:
  - Left tree card x≈188..428, y≈222..693.
  - Center department table x≈432..1247, y≈222..693.
  - Right detail card x≈1263..1573, y≈142..693 in the source; keep it from y≈142 or y≈222 only if every field and buttons remain visible.
- Bottom section: x≈188..1573, y≈705..957.

Repair the previous candidate failures:
1. Department table density:
   - Source shows all eight department rows without internal scrolling.
   - The prior candidate showed only about three rows.
   - Table header height: about 38px.
   - Body row height: 38px to 40px.
   - Footer visible inside card.
   - Keep all eight rows visible:
     `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物流管理组`, `运维支持组`.
   - Required row values visible:
     `DM-0010`, `ET-0020`, `FA-0031`, `CIP-0032`, `IT-0040`, `FC-0050`, `MM-0051`, `OS-0052`.
     `张伟`, `李强`, `王芳`, `赵敏`, `陈磊`, `刘洋`, `孙超`, `周俊`.
     `CC-410100`, `CC-420100`, `CC-410110`, `CC-410120`, `CC-430100`, `CC-440100`, `CC-410130`, `CC-410140`.
     `ERP`, `钉钉`, `EHR`, `正常`, `负责人变更`, `同步差异`.
   - Footer text: `共 8 条`, page `1`, `20 条/页`, `跳至 1 页`.

2. Right detail panel density:
   - All source fields and bottom buttons must be fully visible without scroll or clipping.
   - Use compact 29px to 32px controls and 6px to 7px gaps.
   - Fields and values in order:
     `部门名称` `设备管理部`
     `部门编码` `DM-0010`
     `父级路径` `总部 / A厂区 / 资产管理中心`
     `成本中心` `CC-410100`
     `部门负责人` `张伟`
     `同步来源` `ERP`
     `同步策略` `每日增量同步`
     `部门状态` `正常`
     `审批影响` `中（4 条待办，2 条审批）`
     `交接规则` `按组织规则执行`
     `是否启用`
   - Buttons visible at the bottom: `保存部门`, `差异确认`, `查看审计`.

3. Bottom section:
   - Entire bottom section visible within y≈705..957.
   - Left title `审批影响链路与发布检查`.
   - Flow cards visible: `CIP立项`, `费用归集`, `转固验收`, `工作交接`.
   - Orange warning visible: `负责人变更会影响待办和审批节点，请先生成影响快照。`
   - Button visible: `生成影响快照`.
   - Checklist visible: `发布检查清单`, `父级路径有效`, `成本中心已绑定`, `负责人已确认`, `同步差异已处理`, `审批影响已预览`, `交接规则已配置`, with `通过` and `待处理`.
   - Right hint card visible: `提示说明`, `查看差异详情`.

4. Left tree:
   - Keep all source-visible nodes:
     `总部`, `A厂区`, `资产管理中心`, `设备管理部`, `工程技术中心`, `财务共享中心`, `信息技术部`.
   - Selected `设备管理部`.
   - Keep source badges: `EHR`, `ERP`, `钉钉`, counts `1`, `7`, `12`, `6`, `5`, `4`, `6`.

Visual fidelity rules:
- Keep the dark navy source shell, white main panels, pale blue selected row, thin blue outlines, compact 4px-8px radii, and source-like line icons.
- Do not use emoji icons.
- Do not stack Chinese table text vertically.
- Use ellipsis only where the source itself truncates long paths.

Final self-check:
- `8/12` appears exactly, not `8 / 12`.
- `中（4 条待办，2 条审批）` is visible.
- All eight table rows are visible.
- Right detail buttons are visible.
- Bottom warning and hint card are visible.
- The result looks like a direct HTML transcription of the uploaded IMAGE2 screenshot.
