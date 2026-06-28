Edit the existing mail logs DESIGN candidate into a source-faithful 1586 x 992 HTML page.

This is still a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-04-mail-logs-v2.png` is the only source of truth.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.

Page name: 邮件日志
Menu id: system-mail-logs
Reference image: notification-subpage-04-mail-logs-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-mail-logs
Viewport: exactly 1586 x 992.

Use the existing candidate as the visual baseline because its header, horizontal main table, bottom two-card row, and source-like density are closer than the later vertical-text attempt.

Repair only these failures from the baseline:
1. Bring the right `失败详情与重试策略` card fully inside the 1586px viewport.
2. Keep the center `邮件发送日志` table horizontal, readable, and inside x=455..1201.
3. Remove all emoji glyphs, especially the gear emoji near `邮件日志规则 / 快速队列`; use a small monochrome line icon instead.
4. Ensure the bottom `失败重试队列` and `审计取证包` cards remain visible in y=707..941.

Hard geometry:
- Sidebar stays x=0..217.
- Main content stays x=237..1570.
- Middle grid is exactly three columns:
  - x=237..447: `邮件日志规则 / 快速队列`
  - x=455..1201: `邮件发送日志`
  - x=1213..1570: `失败详情与重试策略`
- Bottom grid is exactly two columns:
  - x=237..836: `失败重试队列`
  - x=848..1570: `审计取证包`

Do not repeat the attempt2 failure:
- Do not make header action buttons vertical.
- Do not stack table headers or body cells vertically.
- Do not wrap `BATCH-20260618-0931` into multiple lines.
- Do not show only four main table rows; all six source rows must be visible.
- Do not hide bottom tables below the viewport.
- Do not use internal horizontal scrollbars for source-visible tables.

Required visible text:
- Header: `邮件日志与重试策略台`, `新建重试策略`, `保存草稿`, `提交校验`, `重试预演`, `导出取证包`.
- Status strip: `待处理失败 5`, `今日发送 1,286`, `成功率 98.7%`, `重试队列 3`, `审计留痕 已启用`, `最近同步 2026-06-18 15:32`.
- Main table title: `邮件发送日志`.
- Six row ids: `BATCH-20260618-0931`, `BATCH-20260618-0928`, `BATCH-20260618-0925`, `BATCH-20260618-0912`, `BATCH-20260618-0907`, `BATCH-20260618-0886`.
- Right detail: `失败详情与重试策略`, `BATCH-20260618-0931`, `Node_Approve（CIP 转固审批）`, `处理进度`, `执行重试`, `标记已处理`, `导出取证包`.
- Bottom: `失败重试队列`, `审计取证包`, `Payload Hash`, `模板版本`, `SMTP 响应`, `共 3 条`.

Final self-check:
- Source-like horizontal table density is more important than large typography.
- All content must fit in the first 1586 x 992 viewport.
- No emoji glyph appears anywhere.
- The result must look like the uploaded IMAGE2 source screenshot, not like a newly composed admin layout.
