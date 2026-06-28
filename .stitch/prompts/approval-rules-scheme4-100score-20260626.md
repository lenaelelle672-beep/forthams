Edit the selected screen using the uploaded product screenshot as the only authority.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.

## Scoring contract
Your goal is a 100/100 visual match to the uploaded screenshot.
Grade the result against the screenshot before finishing.
Any visible mismatch loses points.

Priority order:
1. Exact geometry and panel positions.
2. Exact visible text.
3. Exact table/list/form widths, row density, and no unwanted wrapping.
4. Exact right/side editor field count, order, density, and button position.
5. Exact bottom/secondary panel alignment.
6. Exact colors, borders, radius, typography, and icon style.

Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.
The uploaded screenshot is the only source of truth.

## Output contract
- Generate or edit into a persistent Stitch DESIGN/HTML screen.
- The finished screen must be exportable with `get_screen` or `scripts/stitch-cli.js export`.
- The exported screen must include a real `htmlCode.downloadUrl`.
- Do not finish with only DOM operation events, suggestions, or a text description of changes.
- If the current edit path only patches an existing screen but the exported HTML remains unchanged, create a new persistent DESIGN/HTML screen that contains the fixes.

## Fixed frame
- Canvas size is exactly 1823 x 863.
- No browser chrome, no red annotation boxes, no arrows, no callout marks.
- No page-level vertical scroll; this source is a single desktop viewport.
- Preserve the screenshot top navigation, sidebar, content frame, panels, and density.

## Page-specific transcription
- Build the exact visible upper-left approval-rules system settings page from the uploaded screenshot.
- Dark navy top navigation spans the full width from x=0 to x=1823 and y=0 to about y=148, with a subtle cyan bottom hairline.
- Top brand area: `UNIVIEW`, vertical divider, `系统设置中心`.
- Top tabs, in order: `流程平台`, `组织权限`, `基础资料`, `集成配置`, `消息与通知`, `系统参数`.
- `流程平台` is the active top tab: rounded dark-blue outline, brighter text, cyan glow/underline.
- Preserve the decorative small notched block at the top/left intersection: it hangs below the dark header near the sidebar boundary, has a dark blue face, cyan edge glow, and a 3x3 dotted cyan grid.
- Left sidebar begins below the top nav with a pale blue gradient background, about 532 px wide in the source. It must stay visually calm and clean.
- Left sidebar title area: `流程平台`, `7 个配置项`, divider line.
- Left sidebar item list, exact visible order: active `流程平台` with a circular count `7`, then `流程定义`, `流程设计器`, `表单配置`, `表单存储`.
- Use outline-style document/sliders/calendar/storage icons similar to the source. Keep the left navigation spacing, typography, and icon rhythm exactly as shown.
- Main content starts to the right of the sidebar with a light gray-blue page background.
- Main hero card begins around x=591 and y=208 with a large white rounded panel and soft shadow.
- Breadcrumb text: `系统运营中枢 / 流程平台 / 审批规则`.
- Main title: `审批规则配置台`.
- Subtitle: `配置重要处理人跳过、离职交接承接、代理审批和节点权限规则，并支持命中模拟、保存草稿和发布校验。`
- Action buttons in one row: blue primary `+ 新建规则`, then bordered `保存草稿`, bordered `模拟命中`, bordered `提交校验` with a play icon. Match sizes, spacing, icons, and borders.
- Success banner below hero card: pale green background, green border, green check icon, text `规则命中模拟已完成 · CIP 转固流程 / 财务审核 · 已生成审计链路`.
- Bottom visible cards start below the success banner. Only reproduce the visible top of these cards exactly as in the screenshot: left card title `规则集`, middle card label `规则总数`, right card label `启用规则`.

## Final self-check before completion
Only finish if these are true:
- The page looks like a direct HTML transcription of the uploaded screenshot, not a recreated admin template.
- The dark top navigation and pale left sidebar intersection match the source, including the notched cyan/dotted detail.
- All visible labels listed above are present and not renamed.
- No visible block has been moved to a different layout.
- The output can be exported as HTML and verified with a real browser screenshot at 1823 x 863.
