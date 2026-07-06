Repair the current Stitch DESIGN screen against the original IMAGE2 v2 source screenshot.

This is still a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 notification-channels screenshot is the only source of truth.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.
Do not return blank HTML, MISSING_IMAGES HTML, or screenshot-as-background output.

Target page: `通知渠道配置台`
Reference image: `notification-subpage-06-notification-channels-v2.png`
Menu id: `system-notification-channels`
Canvas: browser-rendered viewport exactly `1585 x 992`.

Fix these attempt17 failures:

1. Right editor bottom fields are missing from the visible viewport.
- The card `渠道参数编辑区` must show ALL fields inside the card without scroll.
- Required bottom row fields must be visible:
  - `负责人 *` with exact value `张三（资产管理员）`
  - `审计要求 *` with segmented control `必达` selected and `普通` unselected
  - helper `必达：未成功送达将产生审计告警`
- Replace the wrong value `张三（资产管理部）` with exact `张三（资产管理员）`.
- Use a compact two-column form grid:
  - labels 12px, inputs 28-30px high, helper lines 12px.
  - no large vertical gaps.
  - no native select text clipping.
- Keep right editor from roughly y=188 to y=615, not taller.

2. Bottom cards overflow vertically and omit visible rows.
- The bottom row must start around y=626 and end before y=934.
- All four cards must fit their contents without internal scrolling or clipping.
- `渠道健康矩阵` must show all 4 source rows:
  `钉钉 H5 工作通知`, `站内消息渠道`, `邮件通知渠道`, `短信备用通知`.
  Include `2025-05-21 09:12:11` in the SMS row.
- `降级路由` third node `邮件通知渠道（优先级 3）` must be fully visible, not cut off at the viewport bottom.
- `发布校验清单（12 项）` must be visible as the exact card title, with the footer link `查看全部 12 项校验详情`.

3. Preserve the source shell and density.
- Keep top dark navy shell and active `系统运营中枢`.
- Keep left dark navy sidebar with `通知渠道` active.
- Keep top-left brand as source: white `UNIVIEW` + divider + `固定资产管理系统`.
- Keep the top buttons as bordered buttons:
  `+ 新建渠道`, `保存草稿`, `提交校验`, `发送测试`.

4. Required exact text that must appear in the HTML and in the rendered viewport:
- `DINGTALK_H5`
- `张三（资产管理员）`
- `审计要求`
- `必达`
- `普通`
- `发布校验清单（12 项）`
- `查看全部 12 项校验详情`
- `2025-05-21 09:12:11`
- `短信备用未配置`

Forbidden exact text:
- `张三（资产管理部）`
- `NGTALK_H5`

Implementation guidance:
- Reduce row heights and vertical padding instead of pushing content below the fold.
- Use CSS grid/flex layouts with fixed card heights matching the source.
- If content is too tall, make typography/row height closer to the source, not scrolling.
- The final HTML body should visually occupy exactly the source 1585 x 992 screenshot proportions.
