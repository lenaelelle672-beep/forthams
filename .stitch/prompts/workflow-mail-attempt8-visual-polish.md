Repair the selected Stitch DESIGN screen against the IMAGE2 source `notification-subpage-02-workflow-mail-v2.png`.

This is a narrow 100/100 pixel-fidelity repair, not a redesign.
Preserve the current attempt7 strengths:
- 1586 x 992 document with no page scroll.
- No internal overflow containers.
- Upper panels and bottom cards all visible.
- Right editor lower fields visible.
- Center detail rows visible through `审计要求`.

Only repair the source mismatches:

1. Icon style
- Remove all emoji-style glyph icons such as `👤`, `📄`, `⚙️`, `🔔`, `🛠️`, `💾`, `✉`, `✈`, `💰`, `✓`, `●`.
- Replace them with small monochrome line icons or simple CSS icon boxes matching the IMAGE2 source. If a line icon cannot be drawn cleanly, omit the icon but keep the text and spacing.
- Do not use colored emoji in top buttons, sidebar, flow nodes, or checklist rows.

2. Exact source text
- The bottom heading must be exactly `发送预演（节点：转固完成）` with fullwidth Chinese parentheses and no spaces around the parentheses.
- Keep `隐患扣款流程`, `抄送规则`, `静默条件`, `失败重试`, `附件策略`, `审计要求`, `查看完整日志`.

3. Left table density
- Keep all five rows visible.
- Reduce header and cell wrapping so table cells are closer to the source screenshot.
- Do not allow values like `已发布` or operation links to become vertical stacks.
- Keep source columns: `流程`, `节点事件`, `邮件模板`, `引用网关`, `收件人规则`, `静默条件`, `状态`, `操作`.
- Keep footer `共 5 条`, page `1`, `20 条 / 页`.

4. Bottom cards visual alignment
- Keep bottom tier at the current y range and fully visible.
- `邮件预览`, `变量映射`, `发送预演与发布校验` must not overlap the upper workspace.
- Keep `最近审计记录` readable and not squeezed into a wrapped strip.

5. Preserve source shell
- Brand remains `UNIVIEW 固定资产管理系统`.
- Top nav remains `资产运营总览`, `数据监控中心`, `资产运维中心`, `风险预警中心`, active `系统运营中枢`.
- Left active path remains `消息与通知` > `流程邮件配置`.

Hard failure conditions:
- Any page scroll or internal overflow container.
- Missing exact `发送预演（节点：转固完成）`.
- Emoji icons remain visible.
- Right editor lower fields become clipped again.
- Bottom cards move below the 992px viewport.
