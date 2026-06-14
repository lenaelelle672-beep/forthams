# 模块测试文档：审批流程管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 审批列表 | 已覆盖 | `approvalService.list` 对接 `/approvals/list` | `Approval.tsx` |
| 待审批查询 | 已覆盖 | `/approvals/pending` 与 `/approvals/pending/count` | `ApprovalControllerTest` |
| 同意按钮 | 已覆盖 | 调用 `approvalService.approve`，结果 `APPROVED` | `Approval.tsx` |
| 驳回按钮 | 已覆盖 | 调用 `approvalService.approve`，结果 `REJECTED` | `Approval.tsx` |
| 审批历史 | 已覆盖 | `getProcessById` 返回 process + records | `ApprovalService` |
| 流程设计器 | 已覆盖 | ReactFlow 设计器、后端保存草稿、发布与回读 | `WorkflowDesignerPage.tsx`、`WorkflowDefinitionServiceTest`、`WorkflowDefinitionControllerTest` |
| 流程中心权限 | 已覆盖 | 查询权限只读、编辑权限允许新建/保存/发布 | `browser-regression-smoke.spec.ts`、`routePermissions.test.ts` |

## 执行命令

```bash
cd frontend && npm test -- --run
cd backend && mvn test
```

## 结果

通过。流程设计器产物已持久化到后端 `workflow_definition`；真实后端 E2E 覆盖保存草稿，发布与运行时读取由后端 service/controller 测试覆盖。
