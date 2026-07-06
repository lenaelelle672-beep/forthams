Repair the selected Stitch DESIGN screen against the IMAGE2 v2 source screenshot.

This is a narrow 100/100 pixel-fidelity repair, not a redesign.
The IMAGE2 v2 source screenshot is the only authority.
Do not change business data.
Do not regenerate a generic admin template.

Target page: 邮件模板配置台
Source image: notification-subpage-03-mail-templates-v2.png
Canvas: 1586 x 992.

Keep from the current candidate:
- The correct `UNIVIEW 固定资产管理系统` top-left brand.
- The current top navigation, page title, header buttons, status strip, upper table rows, right form fields, bottom three cards, and visible `重新校验` button.
- The fact that bottom cards `变量字典`, `引用流程`, and `发布校验清单` are visible inside the 992px viewport.

Only repair these mismatches:

1. Restore the filter row exactly like the source.
- The search input placeholder must read `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Show dropdown filters in one row: `状态 全部`, `场景 全部`, `语言 全部`, `引用流程 全部`, `变量完整度 全部`, plus `重置`.
- Keep the row at approximately y=184..224 and do not make it taller than the source.

2. Restore the left table panel title.
- Add the source panel heading `邮件模板列表` above the table.
- Keep table columns visible: `模板名称`, `模板编码`, `使用场景`, `引用流程`, `语言`, `变量完整度`, `状态`, `操作`.
- Do not remove the four template rows.

3. Fix the right editor/body collision with the bottom cards.
- The right `模板编辑区` panel must end before the bottom card row begins.
- Make the rich text body compact and fully contained above the bottom row.
- Remove the internal scrolling editor body if it hides source-visible content.
- Keep buttons `插入变量`, `渲染预览`, `版本对比` inside the editor panel and above the bottom cards.
- The bottom cards should start below both upper panels, not overlap the editor panel.

4. Preserve bottom publish checklist detail.
- `发布校验清单` must include visible rows:
  - `变量完整度`
  - `标题长度`
  - `渠道适配`
  - `合规签名`
  - `测试发送`
  - `审计记录`
- Keep `重新校验` visible.

Failure conditions:
- Missing `搜索模板名称 / 编码 / 变量 / 引用流程`.
- Missing `邮件模板列表`.
- Any bottom card clipped below 992px.
- Any right editor content overlaying bottom cards.
- A scrollable rich editor body that hides the source-visible signature or variable text.
