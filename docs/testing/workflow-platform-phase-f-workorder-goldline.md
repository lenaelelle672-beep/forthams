# Workflow Platform Phase F WorkOrder Goldline Evidence

Date: 2026-06-27

## Scope

This Phase F evidence boundary freezes the real-backend smoke main line around WorkOrder approval only:

- Create WorkOrder.
- Verify initial `DRAFT`.
- Find the WorkOrder through the list API.
- Read the WorkOrder detail API.
- Submit to `PENDING`.
- Approve to `APPROVED`.
- Read the final detail API and verify persisted `APPROVED`.
- Verify submit and approve audit logs through the audit API.
- Open `/workorders/{id}` and verify the approved WorkOrder page content.

## Irreversible Write Ban

The real-backend smoke main line must not execute asset retirement irreversible writes in this phase:

- No retirement create/apply path in the WorkOrder goldline test.
- No retirement approve path.
- No retirement complete path.
- No assertion that an asset reaches `SCRAPPED`.

Asset retirement remains P6 scope and can only return through read-only or drill-mode evidence until the P6 gates are explicitly reopened.

## E2E Path

`frontend/src/e2e/real-backend-smoke.spec.ts`

Test name:

`真实后端：工单审批金线 DRAFT 到 APPROVED 可跑通`

Covered assertions:

- `POST /workorders` returns `DRAFT`.
- `GET /workorders` can find the seeded WorkOrder.
- `GET /workorders/{id}` reads back the seeded WorkOrder detail and `DRAFT` state.
- `POST /workorders/{id}/submit` returns `PENDING`.
- `POST /workorders/{id}/approve` returns `APPROVED`.
- Final `GET /workorders/{id}` reads back persisted `APPROVED`.
- `GET /audit-logs` finds `工单提交` with `/workorders/{id}/submit`.
- `GET /audit-logs` finds `工单审批通过` with `/workorders/{id}/approve`.
- `/workorders/{id}` shows the WorkOrder title, approved status, and description.

## Evidence Matrix

| Layer | Status | Evidence |
| --- | --- | --- |
| DB | PARTIAL | No direct DB query was run. Persistence is indirectly verified through final `GET /workorders/{id}`, list lookup, and audit API records backed by the real backend. |
| API | PASS | The WorkOrder real-backend E2E covers the `DRAFT` -> `PENDING` -> `APPROVED` flow plus final detail `APPROVED`. |
| audit | PASS | The goldline queries the audit API for `工单提交` and `工单审批通过`, and verifies each log text includes the matching request URI: `/workorders/{id}/submit` and `/workorders/{id}/approve`. |
| page | PASS | The goldline opens `/workorders/{id}` and verifies the WorkOrder title, approved status (`已批准`/`APPROVED`), and description `真实后端API闭环测试自动创建` are visible without an HTTP error page. |

## Increment Scope Boundary

- This repair increment only changed `frontend/src/e2e/real-backend-smoke.spec.ts` and this evidence document.
- The repository currently has 21 cumulative staged files from earlier workflow-platform phases; those are baseline staged state and are not part of this Phase F repair write scope.
- Mobile path check returned no staged `frontend/src/pages/mobile/**` files.
- retirement/mobile path check returned no staged matches.

## Verification

- `cd frontend && npx tsc --noEmit --pretty false` passed.
- `cd frontend && npm run e2e:real -- --reporter=line -g "工单审批金线"` passed with 1 WorkOrder goldline test.
- `cd frontend && npm run e2e:real -- --reporter=line` passed with 10 tests.
- `cd frontend && npm run build` passed with existing large chunk warning.
- `cd backend && mvn -Dtest=WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest test` passed with 38 tests.
- `git diff --check -- frontend/src/e2e/real-backend-smoke.spec.ts docs/testing/workflow-platform-phase-f-workorder-goldline.md` passed.
- GitNexus `detect_changes(scope=staged)` returned MEDIUM risk, 21 cumulative staged files, 3 affected ApprovalDetailPage processes, no HIGH/CRITICAL.

## Current Verdict

PASS for this increment's WorkOrder API/audit/page and P6 irreversible-write ban. Full Phase F evidence remains PARTIAL because direct DB evidence is still missing.
