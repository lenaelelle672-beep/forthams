# Workflow Platform P0 Baseline

Date: 2026-06-27

## 2026-06-28 Current Evidence Note

This P0 baseline is a historical freeze. Its DB direct-read pending statement has been superseded for later P9/P10 evidence by `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java`, which uses `JdbcTemplate` direct reads for `workflow_definition`, `workflow_definition_version`, `approval_process`, `approval_record`, and `sys_operate_log`.

The current aggregation lives in `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`. That later DB evidence narrows the old P0 DB gap, but it does not convert the overall workflow-platform goal to PASS: the P9/P10 matrix still records PARTIAL because final full regression, GitNexus CRITICAL risk review, independent reviewer/MINIONS closeout, and visual/screenshot evidence remain open.

## Scope

P0 covers the desktop workflow platform path only. Mobile routes under `frontend/src/pages/mobile/**` and P6 asset retirement code are frozen for this increment.

## Seven Pages

1. Workflow center/list.
2. Workflow designer.
3. Workflow custom form entry.
4. Approval list.
5. Approval detail.
6. Audit logs.
7. Reports/dashboard evidence pages used by the real-backend smoke suite.

## Current Real E2E Coverage

`frontend/src/e2e/real-backend-smoke.spec.ts` covers login, asset list/detail, workflow designer visibility, workflow draft save, core navigation, managed workflow publish/readback, node-level section form roundtrip, assignee preview, approval launch from the published workflow snapshot, three-step asset transfer runtime history readback, WorkOrder approval goldline APIs, approval list/detail APIs, reports, audit logs, and backend health.

The current Phase F boundary removes P6 asset retirement irreversible writes from the real-backend smoke main line. Asset retirement approve/complete and asset `SCRAPPED` assertions must stay in later read-only or drill verification until P6 gates are reopened.

The managed `ASSET_TRANSFER` publish/readback path is now part of real-backend E2E coverage, not only backend service/controller coverage and not a custom `CUSTOM_*` workflow:

- Save draft with node-level `formSource`, `formSectionName`, and `formSummaryFields`.
- Publish and GET the workflow definition back.
- Assert published status/version and node-level `formSource` roundtrip.
- Manually trigger assignee preview in the designer and assert a resolved role/user display.
- Call assignee preview with missing condition business data and assert `calculable=false`, missing fields, and no returned assignees.
- Submit an approval through the published `ASSET_TRANSFER` workflow and GET approval detail.
- Assert approval detail `workflowRuntimePath` includes the published definition's `approval-1`, `审批处理`, and `SUPER_ADMIN`, proving runtime uses the published definition.

## Publish Gap

Before this increment, top-level `definition.formSource` existed but start/approval nodes did not carry a required section form. Publish validation did not enforce the node-level form contract, so designer, backend defaults, and approval detail evidence could drift.

## Borrow / Adapt / Reject

- Borrow: mature workflow products keep form binding at the step/node level so each step can explain the data it owns.
- Adapt: forthAMS keeps a lightweight HTML string plus section name and summary fields. It does not introduce a form engine in P0.
- Reject: field-level permission engines, HTML schema parsing, and server-side sanitizer policy are outside this first cut.

## Evidence Plan

- DB: direct verification of the published workflow definition JSON still requires safe credentials; do not count it as passed without those credentials. This is the 2026-06-27 historical freeze status; the current DB direct-read supplement is recorded in the 2026-06-28 note and P9/P10 matrix.
- API: `GET /workflows/{businessType}` returns published status, version, and node-level form fields.
- API: `POST /workflows/{businessType}/assignees/preview` is read-only and returns unresolved/empty assignees when conditions cannot be evaluated.
- Audit: `/audit-logs` API and `/audit` page search for `流程发布` prove publish audit evidence.
- Page: designer can edit node-level section fields, manually calculate assignees, workflow form reads start-node `formSource`, and approval detail shows section summary from the workflow snapshot.
- E2E: real-backend E2E covers managed publish/readback, node-level section form roundtrip, assignee preview, approval launch from the published snapshot, three-step asset transfer history readback, and WorkOrder approval goldline.
- Tests: backend service/controller tests cover roundtrip, missing `formSource` publish failure, default template fields, assignee preview, and audit annotations; smoke E2E covers real publish, assignee preview, and approval detail readback.
- Boundary: API/page/E2E evidence does not equal DB direct-read evidence. DB direct verification remains pending only for this 2026-06-27 historical freeze; current supplemental DB direct-read evidence is recorded in the 2026-06-28 note and P9/P10 matrix.
