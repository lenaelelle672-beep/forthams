Edit the selected screen using the uploaded product screenshot as the visual authority.

This is a 100/100 pixel-fidelity transcription task with a controlled gray-release text update.
The uploaded IMAGE2/product screenshot is the source of truth for geometry, layout, density, colors, borders, typography, panel positions, row heights, table/list/form widths, and all visual alignment.

## Output contract
- Generate a new persistent Stitch DESIGN/HTML screen.
- The finished screen must be exportable with `get_screen` or `scripts/stitch-cli.js export`.
- The exported screen must include a real `htmlCode.downloadUrl`.
- Do not finish with only DOM operation events, suggestions, or a text description.
- If editing the selected IMAGE screen cannot create downloadable HTML, create a new persistent DESIGN/HTML screen based on it.

## Fixed frame
- Canvas: 1586 x 992 desktop.
- Keep the same top navigation, left sidebar, content frame, panel geometry, density, table/list/form layout, and no page-level vertical scroll.
- No mobile UI.
- No marketing hero, no dashboard redesign, no decorative gradient orbs.
- Do not use your own default admin template.

## Controlled required text/content updates
Make only these semantic substitutions/additions while preserving the source screenshot geometry:

1. Page/module name
   - The active page title must read: `流程定义 2`.
   - The left sidebar under 流程平台 must show `流程定义 2` as the active item.
   - Keep `流程定义` visible nearby as the original/formal sibling item when space allows.

2. Gray-release route state
   - Add or replace a small header pill with: `/workflows-v2`.
   - Add or replace a small header pill with: `正式入口未切换`.
   - Add a small note in the page header or right inspector: `正式 /workflows 保持不变`.

3. Future Settings OS framing
   - Keep the visual style from the screenshot, but use the label `Future Settings OS` in a small secondary label, not as a large hero.
   - The page should feel like a dense backend settings operation console.

4. Main workflow data
   - Use realistic workflow definition rows/cards:
     - `资产转移流程` / `ASSET_TRANSFER` / `已发布` / `v8`
     - `资产清退流程` / `ASSET_CLEARANCE` / `草稿中` / `v3`
     - `资产报废转让流程` / `ASSET_SCRAP` / `已发布` / `v5`
     - `资产赔偿流程` / `ASSET_COMPENSATION` / `已停用` / `v2`
     - `CIP 转固补充流程` / `CUSTOM_CIP_ACCEPTANCE` / `草稿中` / `v1`

5. Required visible operations
   - Keep visible actions for `新建流程`, `保存草稿`, `处理人预览`, `发布检查`, `发布流程`.
   - Include visible feedback text: `已保存草稿`.
   - Include visible validation feedback: `发布检查：处理人解析需确认`.

6. API/path truth
   - If an API path is visible, use `/workflows/*`.
   - Do not show `/workflow-designer/*` as the main API path.

## 100score preservation rules
Priority order:
1. Exact source geometry and panel positions.
2. Exact source row density and component sizing.
3. Exact source visual hierarchy and color system.
4. Controlled text substitutions above.
5. No unwanted wrapping, overlap, or internal scrollbars.

Preserve passing source regions. Do not modernize or reinterpret the screenshot beyond the controlled labels and workflow data above.

## Final self-check before completion
Only finish if these are true:
- The page looks like a direct HTML transcription of the uploaded screenshot, not a new admin template.
- `流程定义 2`, `/workflows-v2`, `正式入口未切换`, and `正式 /workflows 保持不变` are visible.
- The output is a persistent DESIGN/HTML screen with downloadable htmlCode.
- The page is one complete desktop module page.
