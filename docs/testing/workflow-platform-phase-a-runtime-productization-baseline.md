# Workflow Platform Phase A Runtime Productization Baseline

Date: 2026-06-27

## 2026-06-28 Current Evidence Note

This Phase A baseline is a historical freeze. Its DB direct-read pending status has been superseded for later P9/P10 evidence by `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java`, which uses `JdbcTemplate` direct reads for `workflow_definition`, `workflow_definition_version`, `approval_process`, `approval_record`, and `sys_operate_log`.

The current aggregation lives in `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`. That later DB evidence narrows the old Phase A DB gap, but it does not convert the overall workflow-platform goal to PASS: the P9/P10 matrix still records PARTIAL because final full regression, GitNexus CRITICAL risk review, independent reviewer/MINIONS closeout, and visual/screenshot evidence remain open.

## Phase A Scope

Phase A freezes the current runtime-productization baseline after the managed workflow and asset-transfer real-backend checks passed. It does not repeat the old question of whether a workflow can be published. The next work should build from the proven baseline into Phase B-F:

- Phase B: step subform runtime page productization.
- Phase C: runtime flow chart productization.
- Phase D: assignee calculation and action-area governance.
- Phase E: designer robustness hardening.
- Phase F: WorkOrder goldline and asset-retirement post-verification.

Frozen boundaries:

- Mobile route work remains frozen until explicitly reopened by the user.
- P6 asset-retirement irreversible writes remain forbidden until the later post-verification gates pass.
- DB direct-read evidence is not implied by API, audit, page, or E2E checks.

## Evidence Matrix

| Layer | Status | Evidence | Notes |
| --- | --- | --- | --- |
| DB direct read | PARTIAL | Not yet directly verified in this 2026-06-27 Phase A freeze; current supplemental DB direct-read evidence is recorded in the 2026-06-28 note and P9/P10 matrix. | Historical-only row; do not read this as the current DB evidence state. |
| API | PASS | Backend service/controller tests passed for workflow definition and controller coverage. | API evidence can prove contract/read-model behavior, not direct database state. |
| Audit | PASS | Real-backend E2E includes audit-log coverage; publish audit evidence is represented through audit API/page checks. | Keep audit as a separate layer from page visibility. |
| Page | PASS | Real-backend E2E covers workflow designer visibility, publish/readback visibility, approval detail, transfer history readback, and WorkOrder goldline pages/API-driven views. | Page evidence proves user-visible behavior only. |
| E2E | PASS | Real-backend E2E passed 11 tests, including managed publish/readback, asset transfer three-step history, and WorkOrder approval goldline. | This is the current runtime baseline for Phase A. |

## Gate Commands

The following results were provided by the main thread and frozen here as Phase A evidence:

```bash
cd backend && mvn -Dtest=WorkflowDefinitionServiceTest,WorkflowDefinitionControllerTest test
```

Result: PASS, 38 tests.

```bash
cd frontend && npx tsc --noEmit --pretty false
```

Result: PASS.

```bash
cd frontend && npm run build
```

Result: PASS, with only the existing large chunk warning.

```bash
cd frontend && npm run e2e:real -- --reporter=line
```

Result: PASS, 11 tests.

Covered real-backend scenarios:

- Managed workflow publish/readback of node-level form data and approval launch.
- Asset transfer three-step flow stopping at step 3 with prior form and opinion history visible.
- WorkOrder approval goldline.

## Freeze Path Check

Completed main-thread verification:

- `git diff --cached --name-only | rg '^frontend/src/pages/mobile/' || true`: PASS, no output. Mobile route work remains frozen.
- `git diff --cached --name-only | rg 'retirement|Retirement|mobile|Mobile' || true`: PASS, no output. No mobile or asset-retirement path is present in the staged set.
- `git diff --cached --check -- docs/specs/workflow-platform-execution-plan.md docs/testing/workflow-platform-p0-baseline.md docs/testing/workflow-platform-phase-a-runtime-productization-baseline.md`: PASS, no output.
- GitNexus `detect_changes(repo=forthams, scope=staged, worktree=/Users/feigao/project/Project/forthAMS)`: PASS for this freeze gate with `risk_level=medium`, `changed_files=23`, `changed_count=111`, `affected_count=3`; affected processes are limited to `ApprovalDetailPage` intra-community flows. No HIGH or CRITICAL risk was reported.

## Verdict

Phase A gate commands and freeze checks are complete for this increment: backend targeted tests PASS, frontend typecheck PASS, frontend build PASS, real-backend E2E PASS, freeze-path commands PASS, and GitNexus `detect_changes` is MEDIUM with no HIGH or CRITICAL risk reported.

The Phase A incremental verdict remains PARTIAL because DB direct-read evidence is still not directly verified in this 2026-06-27 historical freeze. API, audit, page, E2E, freeze-path, and GitNexus evidence are enough to continue runtime productization into Phase B, but they do not close the DB direct-read layer for that freeze; current supplemental DB direct-read evidence is recorded in the 2026-06-28 note and P9/P10 matrix.

Current status by layer:

- DB direct read: PARTIAL for the 2026-06-27 historical freeze; see the 2026-06-28 note and P9/P10 matrix for current supplemental DB direct-read evidence.
- API: PASS.
- Audit: PASS.
- Page: PASS.
- E2E: PASS.
- Freeze path: PASS.
- GitNexus change detection: PASS / MEDIUM-no-HIGH.

Do not claim the overall goal is PASS from this historical freeze alone. Current DB direct-read supplement is mapped in the 2026-06-28 note and P9/P10 matrix, but the overall goal still requires the remaining P10 gates.
