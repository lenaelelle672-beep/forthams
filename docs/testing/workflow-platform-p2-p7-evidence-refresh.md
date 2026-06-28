# Workflow Platform P2-P7 Evidence Refresh

Date: 2026-06-28

## Scope

This refresh records the current evidence for the workflow-platform goal items P2 through P7. It is not a full-goal completion report. Mobile routes under `frontend/src/pages/mobile/**` remain frozen. P6 asset-retirement irreversible writes remain out of scope.

## Evidence Summary

| Area | Status | Evidence | Remaining Gap |
| --- | --- | --- | --- |
| P2 business start availability and My Assets entry | PASS for current evidence | `GET /workflow-runtime/ASSET_TRANSFER/start-availability` is covered by `frontend/src/api/__tests__/workflow.test.ts` and the real-backend smoke. The real-backend smoke asserts published `ASSET_TRANSFER` returns `canStart=true`, has `entryUrl`, and the My Assets quick entry navigates to the transfer form. It also mocks and verifies blocked entry behavior for `DRAFT` / unpublished status. | Full goal still needs final DB/API/audit/page evidence matrix aggregation before PASS. |
| P4 published workflow drives asset transfer | PASS for current evidence | Real-backend smoke saves and publishes an `ASSET_TRANSFER` definition, starts an approval through the published workflow, and verifies approval detail runtime path uses the published approval node. Backend tests cover `requirePublishedRuntimePlan` and persisted runtime path. | Do not treat this as proof that every legacy hardcoded path is removed; final P4 closeout still needs explicit hardcoded-path audit. |
| P5 step subforms / HCL Notes-like sections | PASS for current evidence | Approval detail builds `环节区段` from `_workflowDefinition`; completed historical sections default collapsed and are expandable; current section defaults open; future section is greyed and only loads after arrival. The real-backend four-approval-node smoke stops at step 3 and verifies previous forms, opinions, current section, and future section behavior. | Full visual and accessibility review remains part of final 100-point closeout. |
| P6 runtime flow chart | PASS for current evidence | `ApprovalFlowChart` maps runtime states to completed/current/upcoming/rejected/cancelled/ended, exposes legend and clickable/focusable node summaries, and links runtime nodes to section anchors. Real-backend smoke verifies the runtime chart is visible and matches the running approval path. | Final visual quality still needs screenshot/page evidence across target viewports. |
| P7 assignee calculation and action-area governance | PASS for current evidence | Transfer form and approval detail both support load-triggered runtime assignee preview and manual `计算/重新计算` actions. Uncalculable/error states show reasons and hide specific assignees. This refresh tightens the real-backend smoke so the transfer-form preview must show only candidate count plus `具体处理人名单已隐藏`, and must not accept raw `SUPER_ADMIN` or `assignees:` text inside the preview panel. | Broader action-area matrix for no-permission, terminal, failed-service, and missing-field states still needs final matrix aggregation. |

## Commands Run For This Refresh

```bash
cd frontend && npm test -- --run src/api/__tests__/workflow.test.ts src/__tests__/assetTransferForm.test.tsx tests/unit/approvalFlowChart.test.tsx
```

Result: PASS, 3 files / 25 tests.

```bash
cd backend && mvn -q -Dtest=WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest,WorkflowPlatformPersistenceTest,ApprovalServiceTest test
```

Result: PASS. The run still prints the known JaCoCo/JSqlParser `MethodTooLargeException` instrumentation noise, but Maven exits 0.

```bash
cd frontend && npm run e2e:real -- --grep "托管流程发布|四审批节点" --reporter=line
```

Result: PASS, 2 real-backend Playwright tests.

## Assertion Tightening

The managed workflow publish smoke previously accepted `/SUPER_ADMIN|\d+/` inside the transfer-form assignee preview panel. That was too broad for P7 because a raw role or user-like value could satisfy the test. The assertion now requires:

- `已解析 N 名候选处理人`
- `具体处理人名单已隐藏`
- no `SUPER_ADMIN` inside the assignee preview panel
- no raw `assignees:` text inside the assignee preview panel

This does not ban role names from the runtime flow chart. The flow chart can still display role semantics for node rules; the privacy boundary applies to the assignee preview result list.

## Current Verdict

P2-P7 current evidence is stronger after this refresh, especially P7 assignee-preview privacy evidence. The overall 5-day workflow-platform goal remains PARTIAL until final DB/API/audit/page evidence aggregation, visual screenshot evidence, hardcoded-path audit, full regression, GitNexus detect_changes review, and independent GAI2 reviewer closeout are complete.
