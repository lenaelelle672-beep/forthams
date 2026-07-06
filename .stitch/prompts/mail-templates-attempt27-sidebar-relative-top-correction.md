Refine the selected mail templates DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `c4334c273cd04008af9a58c124f92cd3` passes main content, missing text, and no-scroll gates, but the sidebar rows are vertically too low.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

ONLY fix the sidebar row y coordinates.
Freeze everything outside x=0..218, y=50..992 exactly as it is.
Do not change top bar or main content.
Do not change table rows, bottom cards, editor, buttons, or data.

Current measured failure:
- `流程设计` is at y≈201 but must be y≈145.
- `通知渠道` is at y≈775 but must be y≈719.
- active `邮件模板` is too low.
- `参数日志` is at y≈1001.5 and is outside the viewport; it must be visible at y≈946.
- The sidebar has no scroll, but a blank spacer after the sidebar header pushes the menu down by about 56px.

Critical correction:
- Remove the extra blank spacer after the sidebar header.
- Use absolute top coordinates relative to the sidebar container, NOT relative to the page body.
- Sidebar container top is viewport y=50.
- Therefore each row's CSS `top` inside the sidebar must equal `targetViewportY - 50`.

Use these exact relative top values inside the sidebar container:
- `系统运营中枢`: top=19px.
- `流程平台`: top=63px.
- `流程设计`: top=95px.
- `流程监控`: top=123px.
- `流程日志`: top=151px.
- `流程委托`: top=179px.
- `组织权限`: top=211px.
- `组织管理`: top=241px.
- `角色管理`: top=269px.
- `权限管理`: top=297px.
- `用户管理`: top=325px.
- `基础资料`: top=355px.
- `资产分类`: top=383px.
- `资产属性`: top=411px.
- `编码规则`: top=439px.
- `枚举值管理`: top=467px.
- `集成配置`: top=497px.
- `系统集成`: top=525px.
- `接口管理`: top=553px.
- `数据映射`: top=581px.
- `调度任务`: top=609px.
- `消息与通知`: top=639px.
- `通知渠道`: top=669px.
- `消息模板`: top=697px.
- active `邮件模板`: top=725px, active blue rectangle h=30.
- `短信模板`: top=753px.
- `消息日志`: top=781px.
- `系统参数`: top=812px.
- `全局参数`: top=840px.
- `业务参数`: top=868px.
- `参数日志`: top=896px.

These relative top values produce these viewport y positions:
- active `邮件模板` at y=775.
- `参数日志` at y=946 and visible inside the 992px viewport.

Sidebar CSS requirements:
- No `overflow-y-auto`, no `overflow-auto`, no `overflow-scroll`.
- No `justify-between`.
- No large `padding-top`, `mt-`, `space-y`, or spacer block after the header.
- Row height 24px to 28px, line-height 20px, font 13px-14px.
- The sidebar scrollHeight must be <= 942.
- Every required sidebar text must be visibly inside x=0..218 and y=50..992.

Do not regress validated gates:
- document/body exactly 1586 x 992.
- no page scroll.
- no internal scroll containers anywhere.
- body text includes all sidebar leaf items and all main content required text.
- `共 5 条`, `共 3 条`, and `重新校验` each have bottom <= 956.
