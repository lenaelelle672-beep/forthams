Move only the bottom diagnostic band of the selected Stitch DESIGN screen down to match the IMAGE2 source.

Source of truth: `notification-subpage-02-workflow-mail-v2.png`.
This is a 100/100 pixel-fidelity repair, not a redesign.

Keep everything else exactly unchanged:
- 1586 x 992 fixed canvas
- dark top shell and left sidebar
- header/filter row
- left `流程邮件规则` table
- center `CIP 转固流程邮件规则` detail
- right `规则字段维护` form
- all repaired exact text including `处置完成通知`, `扣款提醒`, and `发送预演（节点：转固完成）`
- no page scroll and no internal visible scroll containers

Required edit:
- Move the whole bottom band containing these cards down about 24-30px:
  - `邮件预览`
  - `变量映射`
  - `发送预演与发布校验`
- Target source-like top y: about 670.
- Keep the whole bottom band bottom <= 954.
- The title text `邮件预览`, `变量映射`, and `发送预演与发布校验` must be visible with y >= 650.
- The inner heading `发送预演（节点：转固完成）` must be visible with y >= 680.
- Keep `查看完整日志` visible inside the rightmost area.

Do not change business data. Do not rename any labels.

Forbidden:
- `处置结果通知`
- `扣款结果通知`
- `发送预演 （节点：转固完成）`
- emoji characters
- page scroll or internal visible scroll containers
