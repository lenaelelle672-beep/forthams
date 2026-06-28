Refine the selected mail templates DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `3452ea8c49f24066b5aca2044813b5ef` has the correct main content and all sidebar labels, but FAILS because the sidebar became a scrollable long menu:
- `ASIDE.sidebar` has `overflow-y-auto`.
- sidebar scrollHeight is 1060 while clientHeight is 942.
- active `邮件模板` is too low, around y≈880, not source y≈775.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.
Do not change any business data.

ONLY fix the sidebar implementation and vertical density.
Freeze everything outside x=0..218, y=50..992 exactly as it is.
Do not alter top bar or main content.

Mandatory sidebar implementation:
- The sidebar must NOT be a flex column with `justify-between`.
- The sidebar must NOT have `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or any internal scroll.
- Sidebar must use a fixed/absolute-positioned row stack inside x=0..218, y=50..992.
- Set sidebar CSS overflow to hidden or visible only if scrollHeight remains <= clientHeight.
- The sidebar scrollHeight must be <= 942.
- Every row must be a separate visible row with explicit top/y position.
- Row heights must be compact:
  - header: 36px.
  - section row: 24px.
  - child row: 25px.
  - vertical gap between groups: 5px maximum.
  - text line-height: 20px.
  - font size: 13px for sections and children if needed to fit.
- Do not add padding that increases row height beyond the explicit values.

Exact visible row top positions inside the 1586x992 viewport:
- `系统运营中枢`: y=69.
- `流程平台`: y=113.
- `流程设计`: y=145.
- `流程监控`: y=173.
- `流程日志`: y=201.
- `流程委托`: y=229.
- `组织权限`: y=261.
- `组织管理`: y=291.
- `角色管理`: y=319.
- `权限管理`: y=347.
- `用户管理`: y=375.
- `基础资料`: y=405.
- `资产分类`: y=433.
- `资产属性`: y=461.
- `编码规则`: y=489.
- `枚举值管理`: y=517.
- `集成配置`: y=547.
- `系统集成`: y=575.
- `接口管理`: y=603.
- `数据映射`: y=631.
- `调度任务`: y=659.
- `消息与通知`: y=689.
- `通知渠道`: y=719.
- `消息模板`: y=747.
- active `邮件模板`: y=775, active blue rectangle x=8..208, h=30.
- `短信模板`: y=803.
- `消息日志`: y=831.
- `系统参数`: y=862.
- `全局参数`: y=890.
- `业务参数`: y=918.
- `参数日志`: y=946.

Exact sidebar text requirements:
`流程设计`, `流程监控`, `流程日志`, `流程委托`,
`组织管理`, `角色管理`, `权限管理`, `用户管理`,
`资产分类`, `资产属性`, `编码规则`, `枚举值管理`,
`系统集成`, `接口管理`, `数据映射`, `调度任务`,
`通知渠道`, `消息模板`, `邮件模板`, `短信模板`, `消息日志`,
`全局参数`, `业务参数`, `参数日志`.

Visual source match:
- `邮件模板` active row must be around y=775, not y=880.
- `系统参数`, `全局参数`, `业务参数`, and `参数日志` must all be visible inside the viewport, not below it.
- Use the same dark navy sidebar background and compact source density.
- Use simple inline SVG-style line icons; no emoji.

Do not regress validated gates:
- document/body exactly 1586 x 992.
- no page scroll.
- no internal scroll containers anywhere, including the sidebar.
- missingSidebar must be empty.
- body text includes `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, `重新校验`.
- `共 5 条`, `共 3 条`, and `重新校验` each have bottom <= 956.
