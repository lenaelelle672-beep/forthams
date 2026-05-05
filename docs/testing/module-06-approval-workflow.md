# 模块测试文档：审批流程管理

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 审批列表 | 已覆盖 | `approvalService.list` 对接 `/approvals/list` | `Approval.tsx` |
| 待审批查询 | 已覆盖 | `/approvals/pending` 与 `/approvals/pending/count` | `ApprovalControllerTest` |
| 同意按钮 | 已覆盖 | 调用 `approvalService.approve`，结果 `APPROVED` | `Approval.tsx` |
| 驳回按钮 | 已覆盖 | 调用 `approvalService.approve`，结果 `REJECTED` | `Approval.tsx` |
| 审批历史 | 已覆盖 | `getProcessById` 返回 process + records | `ApprovalService` |
| 流程设计器 | 已覆盖 | 本地交互式 ReactFlow 设计器 | `WorkflowDesigner.tsx` |

## 执行命令

```bash
cd frontend && npm test -- --run
cd backend && mvn test
```

## 结果

通过。残留风险：流程设计器产物暂未持久化到后端。
