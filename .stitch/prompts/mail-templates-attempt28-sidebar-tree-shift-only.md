Refine the selected mail templates DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The selected screen `c4334c273cd04008af9a58c124f92cd3` is the best current base.
It passes all main-content gates and no-scroll gates. The only failure is sidebar vertical offset.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Minimal edit only:
- Keep the full page, top shell, and main content exactly visible as in the selected screen.
- Do NOT delete, hide, replace, rebuild, or blank the main work area.
- Do NOT regenerate the table/editor/bottom cards.
- Do NOT modify any element at x>=218.
- Do NOT modify any element at y<50.

Only change the left sidebar menu tree inside x=0..218, y=50..992:
- Keep the sidebar header `系统运营中枢` in place.
- Move the menu tree starting at section `流程平台` and including all following sidebar rows up by exactly 56px.
- The easiest safe implementation is to wrap the rows from `流程平台` through `参数日志` in one container and set `transform: translateY(-56px)`, or subtract 56px from each row top value.
- Do not introduce scrollbars.
- Do not change row order, labels, icons, colors, or active state.

Current measured positions from the selected screen:
- active `邮件模板` text y≈831.5; after shifting up 56px it must be y≈775.5.
- `参数日志` text y≈1001.5; after shifting up 56px it must be y≈945.5 and fully visible.
- `流程设计` y≈201; after shifting up 56px it must be y≈145.

Required after the edit:
- `流程设计`, `流程监控`, `流程日志`, `流程委托`,
  `组织管理`, `角色管理`, `权限管理`, `用户管理`,
  `资产分类`, `资产属性`, `编码规则`, `枚举值管理`,
  `系统集成`, `接口管理`, `数据映射`, `调度任务`,
  `通知渠道`, `消息模板`, `邮件模板`, `短信模板`, `消息日志`,
  `全局参数`, `业务参数`, `参数日志`
  are visibly inside x=0..218 and y=50..992.
- active `邮件模板` remains a blue active row and is around y=775.
- `参数日志` is visible above y=992.
- No internal scroll containers anywhere.
- document/body exactly 1586 x 992.

Do not regress validated main content:
- body text includes `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, `重新校验`.
- `共 5 条`, `共 3 条`, and `重新校验` each have bottom <= 956.
- The main work area must not be blank.
