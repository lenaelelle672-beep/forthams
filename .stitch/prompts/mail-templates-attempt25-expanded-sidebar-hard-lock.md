Refine the selected mail templates DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `cd5dee2e269c4377a01fac87f533ce36` passes main-content geometry and top-shell improvement, but FAILS because the left sidebar is still collapsed/generic.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

ONLY fix the left sidebar.
Freeze everything outside x=0..218, y=50..992 exactly as it is.
Do not move the main content.
Do not alter the top bar.
Do not move the bottom cards.

Hard pass/fail issue:
The previous screen omitted these source-visible sidebar leaf items:
`流程设计`, `流程监控`, `流程日志`, `流程委托`,
`组织管理`, `角色管理`, `权限管理`, `用户管理`,
`资产属性`, `枚举值管理`,
`系统集成`, `接口管理`, `数据映射`, `调度任务`,
`全局参数`, `业务参数`, `参数日志`.

These strings MUST be real visible body text in the new HTML. Do not hide them in tooltips, comments, aria-only text, offscreen text, or collapsed submenus.

Replace the current collapsed/generic sidebar with the IMAGE2 source expanded fixed-position sidebar:
- Sidebar rectangle x=0..218, y=50..992.
- Background dark navy gradient similar to the source.
- Use compact source-like typography:
  - section rows: 14px, weight 600, height 28px.
  - child rows: 14px, weight 400, height 27px.
  - icon area x=20..36.
  - text x≈50 for children and x≈20/50 for section header depending on icon.
  - no row height larger than 30px.
- Every section is expanded. Do not collapse any section into only a header.

Absolute vertical row plan, matching source density:
- y=66: header row with network icon + `系统运营中枢`.
- y=112: section `流程平台`.
- y=145: child `流程设计`.
- y=173: child `流程监控`.
- y=201: child `流程日志`.
- y=229: child `流程委托`.
- y=259: section `组织权限`.
- y=290: child `组织管理`.
- y=318: child `角色管理`.
- y=346: child `权限管理`.
- y=374: child `用户管理`.
- y=404: section `基础资料`.
- y=433: child `资产分类`.
- y=461: child `资产属性`.
- y=489: child `编码规则`.
- y=517: child `枚举值管理`.
- y=547: section `集成配置`.
- y=576: child `系统集成`.
- y=604: child `接口管理`.
- y=632: child `数据映射`.
- y=660: child `调度任务`.
- y=690: section `消息与通知`; use source selected-section darker band and an expanded chevron.
- y=719: child `通知渠道`.
- y=747: child `消息模板`.
- y=775: active child `邮件模板`; bright blue rectangle x≈8..208, h≈30, mail icon, white text.
- y=803: child `短信模板`.
- y=831: child `消息日志`.
- y=861: section `系统参数`.
- y=890: child `全局参数`.
- y=918: child `业务参数`.
- y=946: child `参数日志`.

Icon rules:
- Use small simple line icons before each child. No emoji.
- The active `邮件模板` row uses a mail/envelope line icon.
- Section chevrons appear on the right for section rows.

Do not regress the validated main content:
- document/body exactly 1586 x 992.
- no page scroll.
- no internal scroll containers.
- body text includes `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, `重新校验`.
- `共 5 条`, `共 3 条`, and `重新校验` each have bottom <= 956.

Final self-check:
- `document.body.innerText` includes every sidebar child listed above.
- `邮件模板` active row is around y=775, not around y=390.
- `消息与通知` section is expanded.
- Main content remains unchanged.
