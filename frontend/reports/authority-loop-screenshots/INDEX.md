# 权限修复 LOOP 页面图鉴

截图由 `src/e2e/authority-loop-screenshot-audit.spec.ts` 对生产预览 `vite preview` 拍摄，API 为契约 mock。

2026-08-17 真实后端重拍：已停止。当前环境 `DB_URL`/`JWT_SECRET` 未设置，`127.0.0.1:8080` 不可达。未发明新接口。

| 文件 | 路径 | 验收点 |
|---|---|---|
| 01-workflows-center-1440x900.png | /workflows | 有 `system:flow:query` 可进，非 Forbidden |
| 02-workflow-designer-1440x900.png | /workflow-designer | platform_admin + designer 权限可进 |
| 03-disposals-resubmission-1440x900.png | /disposals | 识别 `CANCELLED_REQUIRES_RESUBMISSION` |
| 04-inventory-create-1440x900.png | /inventory | 创建表单为盘点类型 + 部门范围 |
| 05-workorder-missing-approval-1440x900.png | /workorders/12 | 无流程时禁用直连审批 |
| 06-retirement-missing-approval-1440x900.png | /retirement/9 | 无流程时提示去审批中心 |
| 07-login-1440x900.png | /login | 登录页可打开 |
| 08-compensation-detail-1440x900.png | /compensation/9 | 赔偿详情编号与金额 |
| 09-inventory-detail-1440x900.png | /inventory/tasks/3 | 盘点详情可打开 |
| 10-approvals-center-1440x900.png | /approvals | 审批中心可打开 |
