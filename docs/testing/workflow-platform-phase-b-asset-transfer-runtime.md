# Workflow Platform Phase B Asset Transfer Runtime Evidence

Date: 2026-06-27

## Scope

This increment verifies the desktop `ASSET_TRANSFER` approval-detail runtime path for a four-approval-node workflow stopped at step 3. Mobile routes under `frontend/src/pages/mobile/**` stay frozen. P6 asset retirement approve/complete and any `SCRAPPED` assertions stay out of scope.

## Evidence Matrix

| Layer | Status | Evidence | Gap |
| --- | --- | --- | --- |
| DB | PASS | `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java` runs under the e2e H2 schema with `JdbcTemplate` direct reads after MockMvc goes through the real controller/service/AOP path. It saves and publishes a four-approval-node `ASSET_TRANSFER` definition, creates an approval, approves steps 1/2, then directly asserts `workflow_definition`, `approval_process`, `approval_record`, and `sys_operate_log`. | DB direct-read evidence is scoped to the e2e H2 persistence path and does not mutate P6 asset-retirement state. |
| API | PASS | `frontend/src/e2e/real-backend-smoke.spec.ts` publishes an `ASSET_TRANSFER` definition with `approval-1`, `approval-2`, `approval-3`, and `approval-4`; creates an approval; calls `POST /approvals/{id}/approve` twice; then asserts `GET /approvals/{id}` has `process.currentStep=3`, `process.status=PENDING`, at least four approval nodes in `workflowRuntimePath`, all four approval node IDs, and step 1/2 records with their approval opinions. | This increment stops at the current third approval step and does not complete the workflow. |
| Audit | PASS | Existing Phase B/P0 coverage already verifies workflow publish audit and assignee-preview audit through `/audit-logs` and `/audit`. This increment polls `/audit-logs?keyword=审批通过&page=0&size=10` after the two approval actions and asserts at least two logs include both `审批通过` and `/approvals/{id}/approve`. | Approval action audit is covered for the four-node runtime path stopped at step 3; broader audit export/statistics behavior remains covered by existing audit tests. |
| Page | PASS | The smoke opens `/approvals/{id}` and asserts `环节区段`, `运行态流程图`, step 1/2 `已完成` sections, default-collapsed historical form labels, expandable historical section forms and approval opinions, step 3 `当前环节` with its current form field and `等待当前处理人处理`, and step 4 as a future section with summary text `待流转/未到达`. It also asserts the step 4 form field is not visible by default and remains absent after expansion, while the expanded future section shows `到达该环节后加载` and `尚未生成审批记录`. | Future-step greying is covered through the approval-detail page smoke and the full real-backend E2E suite. |
| E2E | PASS | `真实后端：资产转移四审批节点停在第 3 步可回看历史表单、意见和未来环节` is a real-backend Playwright smoke that exercises publish, create, approve step 1, approve step 2, API readback, page readback including future-step greying, and workflow restore. Targeted and full real-backend E2E runs both passed. | Requires the standard real backend and real E2E credentials configured for `npm run e2e:real`. |

## Runtime Boundary

The smoke validates history visibility up to the current third approval step and future-step grey behavior for the fourth approval node:

- Step 1 and step 2 are completed through the real approval API.
- Step 1 and step 2 records retain their approval opinions.
- The approval detail page keeps completed sections collapsed by default but expandable.
- The third approval section is the current step and remains open with the current form field and current-handler waiting state.
- The fourth approval section remains a future step: its summary exposes `待流转/未到达`, its form fields are not rendered before or after expansion, and expansion shows `到达该环节后加载` plus `尚未生成审批记录`.

The smoke does not approve or complete the third step. It does not touch asset retirement paths or irreversible retirement state.

## Verification

- `git diff --check -- frontend/src/e2e/real-backend-smoke.spec.ts docs/testing/workflow-platform-phase-b-asset-transfer-runtime.md` passed.
- `cd frontend && npm run e2e:real -- --reporter=line -g "四审批节点"` passed: 1 test, `真实后端：资产转移四审批节点停在第 3 步可回看历史表单、意见和未来环节`.
- `cd frontend && npm run e2e:real -- --reporter=line` passed: 11 tests.
- `cd frontend && npx tsc --noEmit --pretty false` passed.
- `cd frontend && npm run build` passed with the existing large chunk warning.
- `cd backend && mvn -Dtest=WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest test` passed: 38 tests.
- `cd backend && mvn -Dtest=WorkflowPlatformPersistenceTest test` passed: e2e H2 direct-read persistence test for `workflow_definition`, `approval_process`, `approval_record`, and `sys_operate_log`.

## Current Verdict

This Phase B increment records PASS evidence for DB, API, Page, Audit, E2E, Build, Typecheck, and backend targeted gates on a four-approval-node runtime path stopped at step 3, including future-step grey evidence for step 4. The long goal as a whole remains PARTIAL until Phase C-E/F are completed.
