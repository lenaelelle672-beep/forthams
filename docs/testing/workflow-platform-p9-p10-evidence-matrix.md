# Workflow Platform P9/P10 Evidence Matrix

Date: 2026-06-28

## Scope / Guardrails

This document is the P9/P10 evidence matrix for the workflow-platform goal. It is evidence aggregation only, not the final reviewer closeout and not a final PASS.

Guardrails:

- The authority for P9/P10 remains `docs/specs/workflow-platform-execution-plan.md:276-315`.
- P9 requires DB / API / audit / page / E2E evidence for the `ASSET_TRANSFER` runtime path; any missing core layer keeps P9 PARTIAL.
- P10 requires closeout evidence, full regression state, GitNexus change detection, independent reviewer/MINIONS chain evidence, P6 asset-retirement post-verification boundary, and frozen-path checks.
- `/dashboard`, `frontend/src/pages/mobile/**`, and `frontend/src/router/index.tsx` remain frozen for this evidence-only update.
- This matrix aggregates current code/test evidence but does not reopen frozen scopes, mobile scope, or irreversible asset-retirement scope.
- The execution-plan named legacy hardcoded workflow keys are referenced by execution-plan line numbers only; this testing document intentionally does not add their exact key literals.

## P9 Acceptance Evidence Matrix

| AC | Requirement | DB | API | Audit | Page | E2E | Status / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P9-AC1 | Published `ASSET_TRANSFER` shows My Assets entry and start-availability contract. | PARTIAL: DB direct-read proves published workflow definition persistence for `ASSET_TRANSFER` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:229-247`; My Assets entry itself is UI/API evidence, not DB state. | PASS: real-backend smoke calls `/workflow-runtime/ASSET_TRANSFER/start-availability` and asserts `canStart`, `status`, `version`, and `entryUrl` in `frontend/src/e2e/real-backend-smoke.spec.ts:191-198`. | PASS: publish audit is polled through `/audit-logs` and matched as `流程发布` in `frontend/src/e2e/real-backend-smoke.spec.ts:157-171`. | PASS: My Assets quick entry is visible, enabled, opens the transfer preview, and routes to `/disposals/transfer/new` in `frontend/src/e2e/real-backend-smoke.spec.ts:209-223`; transfer form renders published version/definition summary in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:574-590`. | PASS: covered by the real-backend smoke path above. | PARTIAL only because final P10 regression/reviewer gates remain open. |
| P9-AC2 | Unpublished / disabled / no-version or unconfigured / no-permission states block start with `blockReason` or equivalent explanation. | PASS: `WorkflowPlatformPersistenceTest` covers DRAFT, DISABLED, PUBLISHED with version `0` and no published version row, plus UNCONFIGURED in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:207-218`; it directly inserts/cleans those states and requests start availability in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:240-268`; it asserts `canStart=false`, `status`, `version`, `blockReason`, workflow-definition status/missing state, and absence of a published `workflow_definition_version` row in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:279-343`. | PASS: smoke stubs draft/unpublished, disables the workflow, deletes it to form unconfigured state, and simulates 403 permission denial in `frontend/src/e2e/real-backend-smoke.spec.ts:225-273`. | PASS: `WorkflowRuntimeController.startAvailability` has `@OperLog(title = "审批发起可用性检查", businessType = OperBusinessType.OTHER, saveRequestData = false)` in `backend/src/main/java/com/ams/controller/WorkflowRuntimeController.java:26-30`; `WorkflowDefinitionControllerTest` reflects `@PreAuthorize` plus the `@OperLog` title/type/saveRequestData in `backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java:97-110`; persistence tests assert `sys_operate_log` contains `operation=审批发起可用性检查`, `business_type=OTHER`, and `request_uri=/api/workflow-runtime/ASSET_TRANSFER/start-availability` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:279-343`. | PASS: blocked My Assets entry is disabled and contains explanatory text in `frontend/src/e2e/real-backend-smoke.spec.ts:201-207`; transfer form blocks submit from `start-availability` in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:174-188` and `frontend/src/pages/disposal/AssetTransferFormPage.tsx:259-275`. | PASS: blocked-entry behavior is part of the real-backend smoke. | PARTIAL: current P9 blocked-start DB/API/audit/page/E2E evidence is covered; no-permission DB/audit is not applicable or remains proven at API/E2E layer. Final status still depends on P10 gates. |
| P9-AC3 | Step subforms, history forms, and opinions are available when the runtime reaches step 3. | PASS: direct `JdbcTemplate` reads assert `approval_process` at current step 3, workflow payload in business data, and step 1/2 `approval_record` opinions in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:283-320`. | PASS: real-backend smoke asserts detail current step/status, runtime path, records, and step opinions in `frontend/src/e2e/real-backend-smoke.spec.ts:592-600`. | PASS: direct DB operate-log assertions cover two approval actions in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:322-331`; E2E audit API checks approval logs in `frontend/src/e2e/real-backend-smoke.spec.ts:578-590`. | PASS: approval detail renders `环节区段`, completed historical sections, expandable previous forms/opinions, current section, and future section behavior in `frontend/src/pages/approval/ApprovalDetailPage.tsx:841-928`; E2E verifies page behavior in `frontend/src/e2e/real-backend-smoke.spec.ts:626-652`. | PASS: four-step runtime/history smoke verifies the full page path. | PASS for current P9 evidence layer. |
| P9-AC4 | Runtime flow chart shows completed/current/upcoming/exception/end state and links to section context. | PARTIAL: DB direct-read proves runtime path persistence through definition/process records, but not visual state. | PASS: approval detail API returns `workflowRuntimePath` with four approval nodes in `frontend/src/e2e/real-backend-smoke.spec.ts:595-597`. | GAP: no specific audit event for chart rendering; audit is not expected to log visual rendering. | PASS: `ApprovalFlowChart` maps runtime states and labels in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:84-149`, renders accessible state buttons in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:377-424`, and links selected nodes to workflow sections in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:461-507`; approval detail mounts it as `运行态流程图` in `frontend/src/pages/approval/ApprovalDetailPage.tsx:934-945`. | PASS: E2E asserts completed step 1/2, current step 3, upcoming step 4, summary panel, and section anchors in `frontend/src/e2e/real-backend-smoke.spec.ts:605-624`. | PARTIAL: visual screenshot evidence across target viewports is still missing for P10. |
| P9-AC5 | Assignee calculation supports load-triggered, manual trigger, missing-field block, and hides concrete assignee lists. | PARTIAL: DB direct-read does not assert assignee-preview persistence; operate logs cover publish/approval actions, not all preview variants. | PASS: runtime and designer preview APIs are exercised by smoke and UI flows; transfer form auto preview is enabled by `workflowCanStart` in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:238-250`. | PASS for current preview audit: smoke polls `处理人预览` audit logs in `frontend/src/e2e/real-backend-smoke.spec.ts:379-390`. | PASS: designer preview displays only resolved counts and hides concrete lists in `frontend/src/pages/workflow/WorkflowDesignerPage.tsx:193-224`; approval detail hides concrete runtime assignees and missing-field details in `frontend/src/pages/approval/ApprovalDetailPage.tsx:1016-1081`; smoke asserts privacy/no raw assignee dumps in `frontend/src/e2e/real-backend-smoke.spec.ts:173-178` and `frontend/src/e2e/real-backend-smoke.spec.ts:369-377`. | PASS: real-backend smoke covers load/manual preview and missing-field behavior. | PARTIAL: broader action-area matrix for no-permission, terminal, failed-service, and missing-field states remains open. |
| P9-AC6 | Main runtime path is not driven by execution-plan named legacy hardcoded workflow keys. | N/A: DB layer is not the right source for source-code literal cleanup. | PASS by source audit command: `rg -n "<execution-plan named legacy hardcoded workflow keys>" backend/src frontend/src frontend/tests docs/testing docs/specs` was expected to find those key literals only in `docs/specs/workflow-platform-execution-plan.md`; current testing docs intentionally do not add exact literals. | N/A. | N/A. | PARTIAL: this matrix records the expected audit command but does not rerun it as final gate. | PARTIAL until the exact command is rerun in the final reviewer closeout. |

## P10 Acceptance Evidence Matrix

| AC | Requirement | Evidence | Status / Gap |
| --- | --- | --- | --- |
| P10-AC1 | Evidence matrix exists and maps DB / API / audit / page / E2E for P9/P10. | This document maps P9 and P10 evidence by layer and preserves remaining gaps. | PASS for document artifact, not final PASS. |
| P10-AC2 | Full regression status is recorded. | This turn reran the targeted backend Maven suite for workflow definition/service/persistence and it passed: `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS`, with existing JaCoCo/JSqlParser `MethodTooLargeException` warnings. Backend full, frontend full, build, and real-backend E2E were not rerun. | GAP / PARTIAL. |
| P10-AC3 | GitNexus `detect_changes(scope=all)` reviewed before closeout. | Current GitNexus result remains `CRITICAL`: `changed_files=79`, `changed_count=914`, `affected_count=27`. This blocks final PASS until an independent reviewer accepts or narrows the scope. | GAP / PARTIAL. |
| P10-AC4 | Independent reviewer / MINIONS chain completed. | This matrix is produced by `gai2-builder`; it is not independent reviewer output and does not self-award PASS. | GAP / PARTIAL. |
| P10-AC5 | P6 asset-retirement post-verification boundary remains intact. | `docs/specs/workflow-platform-execution-plan.md:16` and `docs/specs/workflow-platform-execution-plan.md:302-315` keep irreversible retirement writes out of the main line; this document does not reopen that scope. | PARTIAL until final reviewer verifies current diff paths and runtime evidence. |
| P10-AC6 | Frozen paths remain untouched by this evidence-only update. | Write scope for this update is limited to this matrix document. Frozen check reported no diff under `frontend/src/pages/dashboard`, `frontend/src/pages/mobile`, or `frontend/src/router/index.tsx`. | PARTIAL until final reviewer consumes the current diff/path evidence. |

## Commands / Evidence Log

Commands already represented in this matrix:

```bash
cd backend && mvn test -Dtest=WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,WorkflowPlatformPersistenceTest
```

Status: passed locally in the main thread with `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS`. Output included existing JaCoCo/JSqlParser `MethodTooLargeException` warnings, but the Maven build succeeded.

```bash
cd backend && mvn -Dtest=WorkflowPlatformPersistenceTest test
```

Status: referenced as the targeted DB direct-read persistence gate. The test directly reads `workflow_definition`, `workflow_definition_version`, `approval_process`, `approval_record`, and `sys_operate_log` via `JdbcTemplate` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:229-345`.

```bash
cd frontend && npm run e2e:real -- --reporter=line
```

Status: referenced as the real-backend Playwright gate for published `ASSET_TRANSFER`, start availability, My Assets entry, blocked entry states, approval detail runtime path, missing-field assignee preview, rollback, four-step runtime/history/flow chart/audit assertions in `frontend/src/e2e/real-backend-smoke.spec.ts`.

```bash
rg -n "<execution-plan named legacy hardcoded workflow keys>" backend/src frontend/src frontend/tests docs/testing docs/specs
```

Expected status: only the execution plan should contain the exact key literals named at `docs/specs/workflow-platform-execution-plan.md:26`, `docs/specs/workflow-platform-execution-plan.md:172`, and `docs/specs/workflow-platform-execution-plan.md:183`. This matrix avoids adding those exact literals to `docs/testing`.

```bash
rg -n "<execution-plan named legacy hardcoded workflow keys>" docs/testing docs/specs
```

Status: exact-literal check only hit the execution plan's prohibition notes; `docs/testing` did not add those exact literals.

```bash
git diff --check -- backend/src/main/java/com/ams/controller/WorkflowRuntimeController.java backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java docs/testing/workflow-platform-p9-p10-evidence-matrix.md
```

Status: no output.

```bash
GitNexus detect_changes(repo=forthams, scope=all, worktree=/Users/feigao/project/Project/forthAMS)
```

Current known status: CRITICAL, with `changed_files=79`, `changed_count=914`, and `affected_count=27`. This prevents final PASS.

```bash
git diff --name-only -- frontend/src/pages/dashboard frontend/src/pages/mobile frontend/src/router/index.tsx
```

Status: no output; frozen paths remain untouched in the current diff.

## Remaining Gaps

- Full regression was not rerun for the final P9/P10 closeout.
- GitNexus `detect_changes(scope=all)` is currently CRITICAL and needs independent review or scope reduction before any final PASS.
- Independent `gai2-reviewer` verdict is not complete.
- Visual/screenshot evidence for runtime chart and page quality across target viewports is still missing.
- Broader action-area governance matrix remains incomplete for no-permission, terminal, failed-service, and missing-field states.
- P6 asset-retirement remains a post-verification boundary; irreversible retirement writes remain out of scope.

## Current Verdict

PARTIAL.

DB direct-read evidence has been supplemented after the old P0/Phase A baseline by `WorkflowPlatformPersistenceTest`, and blocked-start DB/API/audit/page/E2E evidence is materially stronger. The overall workflow-platform goal still cannot be marked PASS because final P10 gates remain open: full regression is not complete, GitNexus `detect_changes(scope=all)` is CRITICAL, independent reviewer/MINIONS closeout is incomplete, and visual/screenshot evidence remains missing.
