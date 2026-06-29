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
- Stitch design-system / Design MD fact source for this workflow-platform pass is Future Settings OS; current MCP project title is `Next-Gen Doc-to-UI`, projectId `11462082228439399504`; this matrix does not cite or rely on the old Stitch project.

## P9 Acceptance Evidence Matrix

| AC | Requirement | DB | API | Audit | Page | E2E | Status / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P9-AC1 | Published `ASSET_TRANSFER` shows My Assets entry and start-availability contract. | PARTIAL: DB direct-read proves published workflow definition persistence for `ASSET_TRANSFER` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:229-247`; My Assets entry itself is UI/API evidence, not DB state. | PASS: real-backend smoke calls `/workflow-runtime/ASSET_TRANSFER/start-availability` and asserts `canStart`, `status`, `version`, and `entryUrl` in `frontend/src/e2e/real-backend-smoke.spec.ts:191-198`. | PASS: publish audit is polled through `/audit-logs` and matched as `流程发布` in `frontend/src/e2e/real-backend-smoke.spec.ts:157-171`. | PASS: My Assets quick entry is visible, enabled, opens the transfer preview, and routes to `/disposals/transfer/new` in `frontend/src/e2e/real-backend-smoke.spec.ts:209-223`; transfer form renders published version/definition summary in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:574-590`. | PASS: covered by the real-backend smoke path above. | PARTIAL only because final P10 reviewer/global gates remain open. |
| P9-AC2 | Unpublished / disabled / no-version or unconfigured / no-permission states block start with `blockReason` or equivalent explanation. | PASS: `WorkflowPlatformPersistenceTest` covers DRAFT, DISABLED, PUBLISHED with version `0` and no published version row, plus UNCONFIGURED in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:207-218`; it directly inserts/cleans those states and requests start availability in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:240-268`; it asserts `canStart=false`, `status`, `version`, `blockReason`, workflow-definition status/missing state, and absence of a published `workflow_definition_version` row in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:279-343`. | PASS: smoke stubs draft/unpublished, disables the workflow, deletes it to form unconfigured state, and simulates 403 permission denial in `frontend/src/e2e/real-backend-smoke.spec.ts:225-273`. | PASS: `WorkflowRuntimeController.startAvailability` has `@OperLog(title = "审批发起可用性检查", businessType = OperBusinessType.OTHER, saveRequestData = false)` in `backend/src/main/java/com/ams/controller/WorkflowRuntimeController.java:26-30`; `WorkflowDefinitionControllerTest` reflects `@PreAuthorize` plus the `@OperLog` title/type/saveRequestData in `backend/src/test/java/com/ams/controller/WorkflowDefinitionControllerTest.java:97-110`; persistence tests assert `sys_operate_log` contains `operation=审批发起可用性检查`, `business_type=OTHER`, and `request_uri=/api/workflow-runtime/ASSET_TRANSFER/start-availability` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:279-343`. | PASS: blocked My Assets entry is disabled and contains explanatory text in `frontend/src/e2e/real-backend-smoke.spec.ts:201-207`; transfer form blocks submit from `start-availability` in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:174-188` and `frontend/src/pages/disposal/AssetTransferFormPage.tsx:259-275`. | PASS: blocked-entry behavior is part of the real-backend smoke. | PARTIAL: current P9 blocked-start DB/API/audit/page/E2E evidence is covered; no-permission DB/audit is not applicable or remains proven at API/E2E layer. Final status still depends on P10 gates. |
| P9-AC3 | Step subforms, history forms, and opinions are available when the runtime reaches step 3. | PASS: direct `JdbcTemplate` reads assert `approval_process` at current step 3, workflow payload in business data, and step 1/2 `approval_record` opinions in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:283-320`. | PASS: real-backend smoke asserts detail current step/status, runtime path, records, and step opinions in `frontend/src/e2e/real-backend-smoke.spec.ts:592-600`. | PASS: direct DB operate-log assertions cover two approval actions in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:322-331`; E2E audit API checks approval logs in `frontend/src/e2e/real-backend-smoke.spec.ts:578-590`. | PASS: approval detail renders `环节区段`, completed historical sections, expandable previous forms/opinions, current section, and future section behavior in `frontend/src/pages/approval/ApprovalDetailPage.tsx:841-928`; E2E verifies page behavior in `frontend/src/e2e/real-backend-smoke.spec.ts:626-652`. | PASS: four-step runtime/history smoke verifies the full page path. | PASS for current P9 evidence layer. |
| P9-AC4 | Runtime flow chart shows completed/current/upcoming/exception/end state and links to section context. | PARTIAL: DB direct-read proves runtime path persistence through definition/process records, but not visual state. | PASS: approval detail API returns `workflowRuntimePath` with four approval nodes in `frontend/src/e2e/real-backend-smoke.spec.ts:595-597`. | GAP: no specific audit event for chart rendering; audit is not expected to log visual rendering. | PASS: `ApprovalFlowChart` maps runtime states and labels in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:84-149`, renders accessible state buttons in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:377-424`, and links selected nodes to workflow sections in `frontend/src/app/components/approval/ApprovalFlowChart.tsx:461-507`; approval detail mounts it as `运行态流程图` in `frontend/src/pages/approval/ApprovalDetailPage.tsx:934-945`; component-level Vitest `frontend/src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx` covers the section aria-label/title, legend, completed/current/upcoming runtime path states, rejected/cancelled/ended branches, summary state/handler-role/approval-mode, section anchors, and empty state. | PASS: E2E asserts completed step 1/2, current step 3, upcoming step 4, summary panel, and section anchors in `frontend/src/e2e/real-backend-smoke.spec.ts:605-624`; targeted Playwright attachments now capture `asset-transfer-runtime-flow-chart-step-3`, `asset-transfer-runtime-detail-page-step-3`, `asset-transfer-runtime-flow-chart-step-3-mobile`, and `asset-transfer-runtime-detail-page-step-3-mobile`; target command `npm --prefix frontend test -- --run src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx` passed 6 tests. | PARTIAL: desktop + mobile targeted artifact capture exists and the new component target covers completed/current/upcoming/rejected/cancelled/ended, legend, summary, section anchor, and empty-state behavior; full browser regression is now PASS; cross-browser/device-emulation Future OS matrix is now PASS, but physical real-device hardware is not claimed. |
| P9-AC5 | Assignee calculation supports load-triggered, manual trigger, missing-field block, and hides concrete assignee lists. | PARTIAL: DB direct-read does not assert assignee-preview persistence; operate logs cover publish/approval actions, not all preview variants. | PASS: runtime and designer preview APIs are exercised by smoke and UI flows; transfer form auto preview is enabled by `workflowCanStart` in `frontend/src/pages/disposal/AssetTransferFormPage.tsx:238-250`. | PASS for current preview audit: smoke polls `处理人预览` audit logs in `frontend/src/e2e/real-backend-smoke.spec.ts:379-390`. | PASS: designer preview displays only resolved counts and hides concrete lists in `frontend/src/pages/workflow/WorkflowDesignerPage.tsx:193-224`; approval detail hides concrete runtime assignees and missing-field details in `frontend/src/pages/approval/ApprovalDetailPage.tsx:1016-1081`; approval action-area states now expose stable current-assignee, no-current-step, terminal, and detail-load-error anchors in `frontend/src/pages/approval/ApprovalDetailPage.tsx:695-1180`; component-level Vitest `frontend/src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx` covers auto-load redaction, missing-field blocking, manual recalculation redaction, service failure hidden-state, current-node mismatch blocking, and missing business type disabled/no-API behavior. | PASS: real-backend smoke covers load/manual preview and missing-field behavior; targeted browser regression covers current assignee, observer no-current-step/no-permission, terminal, and detail-service-failure action-area variants; target command `npm --prefix frontend test -- --run src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx` passed 6 tests. | PARTIAL: targeted matrix coverage is materially stronger and full browser regression is now PASS; the P7 runtime-assignee component slice is expanded to 6 tests and remains reviewer-accepted only for that slice, cross-browser/device-emulation Future OS matrix is now PASS, but physical real-device hardware is not claimed. |
| P9-AC6 | Main runtime path is not driven by execution-plan named legacy hardcoded workflow keys. | N/A: DB layer is not the right source for source-code literal cleanup. | PASS by source audit command: `rg -n "STANDARD_V2|FAST_TRACK" backend/src frontend/src frontend/tests docs/testing docs/specs` only hits the execution-plan prohibition notes in `docs/specs/workflow-platform-execution-plan.md`; it does not hit runtime code, tests, or `docs/testing`. | N/A. | N/A. | PASS: the exact audit command was rerun in this closeout pass. | PASS for current source-audit layer. |

## P10 Acceptance Evidence Matrix

| AC | Requirement | Evidence | Status / Gap |
| --- | --- | --- | --- |
| P10-AC1 | Evidence matrix exists and maps DB / API / audit / page / E2E for P9/P10. | This document maps P9 and P10 evidence by layer and preserves remaining gaps. | PASS for document artifact, not final PASS. |
| P10-AC2 | Full regression status is recorded. | This turn reran the targeted backend Maven suite for workflow definition/service/persistence and it passed: `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS`, with existing JaCoCo/JSqlParser `MethodTooLargeException` warnings. This round also ran targeted Vitest, targeted combined Playwright for two real-backend workflow cases plus two browser action-area cases (`4 passed`, producing 14 PNG attachments in `frontend/playwright-report/data` after the cross-viewport follow-up), targeted Future OS browser checks, a static Future OS HTML inline-script check, and the full browser regression. The contract target `src/__tests__/workbenchPlatformEntry.contract.test.ts` was repaired and passed with 18 tests. Full Vitest passed via `npm --prefix frontend test -- --run` with `Test Files 101 passed (101)` and `Tests 992 passed (992)` in 5.76s. The P7 runtime-assignee target `npm --prefix frontend test -- --run src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx` now passed 6 tests, covering auto-load redaction, missing-field blocking, manual recalculation redaction, service failure hidden-state, current-node mismatch blocking, and missing business type disabled/no-API behavior. The runtime-flow target `npm --prefix frontend test -- --run src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx` passed 6 tests, covering completed/current/upcoming/rejected/cancelled/ended, legend, summary, section anchor, and empty-state behavior. The P3 frontend publish precheck target `npm --prefix frontend test -- --run src/utils/workflowDefinition.test.ts` passed 1 file / 16 tests after the normalized self-loop bypass repair. The current frontend build passed via `npm --prefix frontend run build`: Vite transformed 9450 modules and finished with `built in 12.43s`, with only the existing large chunk warning. The initial full browser regression exposed 49 passed / 13 failed; after the Future OS contract repair, targeted workbench passed 12 tests in 2.6m, targeted `/settings` passed in 5.3s, the static check passed for 44 `future-settings-os-*.html` inline scripts, and full browser regression passed 62/62 in 4.0m. Backend full passed via `cd backend && mvn test` with `Tests run: 715, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`, total time `01:49 min`, finished `2026-06-29T20:45:22+08:00`. Full real-backend E2E passed via `npm --prefix frontend run e2e:real -- --reporter=line` with `12 passed (23.8s)`, covering login/storageState, asset list/detail, workflow designer, hosted `ASSET_TRANSFER` publish/readback/start approval, workflow center version history and rollback, four approval nodes stopped at step 3 with history forms/opinions/future sections, four asset-retirement designer entries, core navigation/approval/reporting, work-order approval gold path, approval list/reporting, depreciation/audit, and dashboard. The System Hub verifier was aligned with the current Future OS smoke contract and now passes with `formal_menus=44`, `manifest_entries=45`, `formal_manifest_entries=44`, and group counts `流程平台:9, 组织权限:8, 基础资料:6, 集成配置:5, 消息与通知:8, 系统参数:8`; `workbenchPlatformEntry.contract.test.ts` was rerun and passed 18 tests. A new opt-in device matrix was added and passed via `npm --prefix frontend run e2e:device-matrix` with `20 passed (7.2m)` after removing the broad `Warning:` ignore and keeping only explicit external font/image/resource noise filters. It covers Chromium, Firefox, WebKit, mobile Safari emulation, and tablet Chrome emulation across the Future OS full-menu iframe and three narrow-screen critical pages. Physical real-device hardware is not claimed. | PASS for backend full, full real-backend E2E, browser-regression, frontend full Vitest, current build evidence, P7 runtime-assignee target, runtime-flow target, P3 workflowDefinition target, Future OS verifier, and cross-browser/device-emulation matrix; PARTIAL only for broader release-boundary closeout. |
| P10-AC3 | GitNexus `detect_changes(scope=all)` reviewed before closeout. | Old GitNexus record was `CRITICAL`: `changed_files=79`, `changed_count=914`, `affected_count=27`. First-pass refresh returned `LOW`, `changed_files=29`, `changed_count=37`, `affected_count=0`. Previous latest refresh returned `MEDIUM`, `changed_files=34`, `changed_count=50`, `affected_count=3`. The P3 normalized self-loop repair returned `MEDIUM`, `changed_files=36`, `changed_count=56`, `affected_count/processes=3`. Latest detect all after the legacy app workflowDefinition repair returned `MEDIUM`, `changed_files=38`, `changed_count=60`, `affected_count/processes=3`; affected processes remain limited to `ApprovalDetailPage` flows: `ApprovalDetailPage -> NormalizeRole`, `ApprovalDetailPage -> NumericValue`, and `ApprovalDetailPage -> StringValue`. Staged detect still has no changes. The dirty worktree still includes unrelated symbols, so this matrix does not claim final PASS. | PARTIAL. |
| P10-AC4 | Independent reviewer / MINIONS chain completed. | This matrix is produced by `gai2-builder`; it is not independent reviewer output and does not self-award PASS. Reviewer one returned `PARTIAL` with gap_fingerprint `stale-contract-label-and-unproven-ledger-chain`. After builder six repaired the stale Future OS/browser-contract title, reviewer two returned `PASS` only for the repaired Future OS/browser-contract slice. Global reviewer three completed read-only review and returned `PARTIAL`, while accepting the specified increment as PASS for backend full, full real-backend E2E, the Future OS route/browser contract, P9-AC6 old-key audit, and no mobile/dashboard scope breach. Reviewer three reviewed `git diff --check`, the old-key `rg` audit, frozen paths, `git diff --stat`, GitNexus `detect_changes`, and related test/spec/source samples; no secrets were output. Reviewer eight / 审查员八号 returned AC-R1..AC-R5 PASS for the release-boundary / Stitch fact-source slice with gap_fingerprint `release-boundary-global-open-dirty-whitelist-staging-hardware`. Reviewer ten / 审查员十号 returned AC-S1..AC-S6 PASS for the recommended staging decision split with gap_fingerprint `GLOBAL-PARTIAL-STAGING-DEVICE-EVIDENCE-OPEN`. Reviewer fifteen / 审查员十五号 returned PASS for the P7 runtime-assignee scope and closed `P7-runtime-assignee-scope-router-modified-and-gai2-ledger-unproven`; the global goal remains PARTIAL. Reviewer seventeen / 审查员十七号 returned historical PARTIAL only due ledger evidence gap `runtime-assignee-6test-minions-ledger-not-evidenced`; reviewer36 / 审查员三十六号 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS only for this ledger/docs-only closure slice and does not upgrade the global release. Reviewer thirty-two / 审查员三十二号 is now closed-history for the current docs-only chain: reviewer32 returned historical `PARTIAL` with gap_fingerprint `reviewer32-current-docs-only-chain-ledger-unverified`, and reviewer33 / 审查员三十三号 has since returned read-only `PASS` closing only the current docs-only chain ledger slice. This does not change functional evidence and is not a global PASS; global remains PARTIAL / 全局仍为 PARTIAL because dirty worktree, staging/user decision, and physical real-device hardware remain open. | PARTIAL: reviewer three completed, reviewer eight accepted the release-boundary / Stitch fact-source slice, reviewer ten accepted the recommended staging split slice, reviewer fifteen accepted the P7 runtime-assignee slice, reviewer36 locally closed the listed historical ledger/docs-only gaps after their historical PARTIAL records, and reviewer33 accepted only the current docs-only chain ledger slice that closed reviewer32's historical gap, but the overall workflow-platform/native goal still cannot be marked PASS. |
| P10-AC5 | P6 asset-retirement post-verification boundary remains intact. | `docs/specs/workflow-platform-execution-plan.md:16` and `docs/specs/workflow-platform-execution-plan.md:302-315` keep irreversible retirement writes out of the main line; this document does not reopen that scope. | PARTIAL until final reviewer verifies current diff paths and runtime evidence. |
| P10-AC6 | Frozen paths remain untouched by this evidence-only update. | First-pass workflow evidence edits did not intentionally write mobile or dashboard paths. Current dirty worktree contains a `frontend/src/router/index.tsx` diff for `/settings-v2` -> `/settings/:tab` compatibility. Global reviewer three accepted this as a narrow frozen-router exception because it only redirects to `/settings/:tab`, adjacent route permission/contract tests passed, and `/settings` browser smoke passed. This is an accepted exception, not evidence that router was untouched or that frozen scope is a zero-touch PASS. This round verified adjacent compatibility with `npm --prefix frontend test -- --run src/utils/routePermissions.test.ts src/__tests__/workbenchPlatformEntry.contract.test.ts` (`26 passed`) and `/settings` browser smoke (`1 passed`). | PARTIAL overall: no mobile/dashboard scope breach is accepted as PASS for the increment, and the `/settings-v2` router redirect is accepted as a narrow compatibility exception, but frozen-router reconciliation is not a zero-touch PASS. |

## 2026-06-29 Browser Regression Contract Repair Note

Full browser regression first exposed a Future Settings OS contract mismatch: 49 passed and 13 failed. The failures were concentrated in `/settings` and `/fixed-assets/workbench?menu=system-*`, where the implementation correctly renders Future OS static HTML in an iframe, while the old browser contracts still asserted legacy React surfaces such as `.workspace-topbar-title`, `*专用功能面板`, legacy labels, and interactive draft/filter flows.

This repair targets the test contract only. The expected product surface remains Future OS, including `future-settings-os-navigation-center.html`, `future-settings-os-flow-designer.html`, `future-settings-os-form-config.html`, `future-settings-os-approval-rules.html`, `future-settings-os-external-systems.html`, `future-settings-os-mail-templates.html`, `future-settings-os-workflow-mail.html`, `future-settings-os-base-params.html`, and `future-settings-os-asset-category.html`. The browser specs should verify iframe-rendered titles, module navigation, sidebar/search affordances, and core page copy instead of reverting to the old React configuration panels.

Repair target:

- `/settings` smoke accepts the redirect to `/fixed-assets/workbench?menu=system-base-params` and verifies the Future OS 基础参数 page.
- `workbench-platform-entry.browser-regression-smoke.spec.ts` validates the navigation-center iframe, the six primary system groups, key subpage links, Future OS return navigation, notification/master-data/config search affordances, and narrow-screen iframe content for flow designer, form config, and approval rules.
- No business source, router, mobile scope, or Future OS iframe integration is reopened by this contract repair.

Repair result:

- Targeted workbench browser regression passed 12 tests in 2.6m.
- Targeted `/settings` browser regression passed in 5.3s.
- Full browser regression passed 62/62 in 4.0m.
- Static Future OS HTML inline-script validation passed for 44 `future-settings-os-*.html` files.
- `future-settings-os-sla-config.html` was repaired after an unclosed Tailwind config script caused iframe `Unexpected end of input` / syntax errors.
- This repair did not roll back Future OS and did not modify `frontend/src/pages/mobile/**`.

## P10 First-Pass Executable Evidence

This round adds Playwright attachment points without writing screenshots into the repository. The attachment names below were materialized by the targeted combined Playwright run across desktop project defaults plus targeted mobile viewport captures; the report currently contains 14 PNG attachment files under `frontend/playwright-report/data`.

| Attachment | Spec path | Coverage / Gap |
| --- | --- | --- |
| `asset-transfer-form-full-page` | `frontend/src/e2e/real-backend-smoke.spec.ts` | My Assets -> transfer form page quality and renamed `资产转移申请` entry path. |
| `asset-transfer-form-workflow-status` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Published workflow status card anchored by `data-testid="asset-transfer-workflow-status"`. |
| `asset-transfer-form-assignee-preview` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Assignee preview panel anchored by `data-testid="asset-transfer-assignee-preview"` and privacy posture. |
| `asset-transfer-form-mobile-full-page` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Mobile viewport full-page transfer form evidence after the My Assets -> transfer form route opens. |
| `asset-transfer-form-mobile-action-area` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Mobile viewport action-area evidence anchored by `data-testid="asset-transfer-action-area"`. |
| `asset-transfer-runtime-flow-chart-step-3` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Runtime flow chart visual proof while the four-approval path is stopped at step 3. |
| `asset-transfer-runtime-detail-page-step-3` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Full approval detail page context around completed/current/upcoming section states. |
| `asset-transfer-runtime-flow-chart-step-3-mobile` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Mobile viewport runtime chart proof while the four-approval path is stopped at step 3. |
| `asset-transfer-runtime-detail-page-step-3-mobile` | `frontend/src/e2e/real-backend-smoke.spec.ts` | Mobile viewport approval detail page context around the step-3 runtime chart and section states. |
| `approval-action-area-current-assignee` | `frontend/src/e2e/browser-regression-smoke.spec.ts` | Action-area matrix: current assignee can see approve/reject controls, anchored by `data-testid="approval-action-area-current-assignee"`. |
| `approval-action-area-observer-no-permission-no-current-step` | `frontend/src/e2e/browser-regression-smoke.spec.ts` | Action-area matrix: observer without approve/reject permission and not current step sees explanatory no-action state and no approve/reject buttons. |
| `approval-action-area-terminal` | `frontend/src/e2e/browser-regression-smoke.spec.ts` | Action-area matrix: terminal approval detail shows the terminal card and no approve/reject controls. |
| `approval-action-area-terminal-mobile` | `frontend/src/e2e/browser-regression-smoke.spec.ts` | Mobile viewport terminal action-area evidence with no approve/reject controls. |
| `approval-detail-load-error` | `frontend/src/e2e/browser-regression-smoke.spec.ts` | Failed-service matrix: detail API failure shows an explanatory load-error block and no approve/reject controls. |

Status: first-pass desktop + targeted mobile artifact evidence captured. This closes naming/test-anchor gaps and captures screenshot artifacts for page quality, runtime chart, assignee preview, and targeted action-area matrix coverage for current assignee, observer no-current-step, terminal state, and detail-service failure. It does not claim final P10 PASS because reviewer two's PASS covers only the repaired Future OS/browser-contract slice, while frozen-path reconciliation and larger implementation/global reviewer remain open. The opt-in cross-browser/device-emulation matrix is now configured and passed across Chromium, Firefox, WebKit, mobile Safari emulation, and tablet Chrome emulation; physical real-device hardware is still not claimed. Full browser regression is now PASS evidence.

## Commands / Evidence Log

Commands already represented in this matrix:

```bash
cd backend && mvn test -Dtest=WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest,WorkflowPlatformPersistenceTest
```

Status: passed locally in the main thread with `Tests run: 73, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS`. Output included existing JaCoCo/JSqlParser `MethodTooLargeException` warnings, but the Maven build succeeded.

```bash
cd backend && mvn test
```

Status: full backend regression passed in the main thread with `Tests run: 715, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`, total time `01:49 min`, finished `2026-06-29T20:45:22+08:00`.

```bash
cd backend && mvn -Dtest=WorkflowPlatformPersistenceTest test
```

Status: referenced as the targeted DB direct-read persistence gate. The test directly reads `workflow_definition`, `workflow_definition_version`, `approval_process`, `approval_record`, and `sys_operate_log` via `JdbcTemplate` in `backend/src/test/java/com/ams/service/WorkflowPlatformPersistenceTest.java:229-345`.

```bash
cd frontend && npm run e2e:real -- --reporter=line
```

Status: referenced as the real-backend Playwright gate for published `ASSET_TRANSFER`, start availability, My Assets entry, blocked entry states, approval detail runtime path, missing-field assignee preview, rollback, four-step runtime/history/flow chart/audit assertions in `frontend/src/e2e/real-backend-smoke.spec.ts`.

```bash
npm --prefix frontend run e2e:real -- --reporter=line
```

Status: full real-backend E2E passed in the main thread with `12 passed (23.8s)`. Coverage included login/storageState, asset list/detail, workflow designer, hosted `ASSET_TRANSFER` publish/readback/start approval, workflow center version history and rollback, four approval nodes stopped at step 3 with history forms/opinions/future sections, four asset-retirement designer entries, core navigation/approval/reporting, work-order approval gold path, approval list/reporting, depreciation/audit, and dashboard.

```bash
AMS_E2E_REAL_BACKEND=true npm --prefix frontend run e2e -- --project=real-backend-smoke --project=browser-regression-smoke src/e2e/real-backend-smoke.spec.ts src/e2e/browser-regression-smoke.spec.ts -g '托管流程发布回读节点表单并发起审批|资产转移四审批节点停在第 3 步可回看历史表单、意见和未来环节|/approvals/:id'
```

Status: passed with `4 passed`; after the cross-viewport follow-up, the combined report materialized 14 PNG attachments in `frontend/playwright-report/data`.

```bash
npm --prefix frontend run e2e:real -- --grep "托管流程发布回读节点表单并发起审批|资产转移四审批节点停在第 3 步" --reporter=line
```

Status: device-matrix refresh pass completed with `2 passed (10.0s)`.

```bash
npm --prefix frontend run e2e:browser-regression -- --grep "系统运营中枢全量配置页|窄屏|桌面分辨率|/approvals/:id|/settings 可认证" --reporter=line
```

Status: current configured browser-regression/device coverage pass completed with `9 passed (1.4m)`.

```bash
npx --prefix frontend playwright install firefox webkit
```

Status: installed Firefox 146.0.1 (`playwright firefox v1509`) and WebKit 26.0 (`playwright webkit v2248`) into the local Playwright cache after the first opt-in matrix run reported missing browser executables.

```bash
npm --prefix frontend run e2e:device-matrix
```

Status: first run after adding the opt-in matrix passed Chromium but failed 16 non-Chromium/device rows because Firefox/WebKit browser executables were missing. After installing Firefox/WebKit and filtering only explicit external font/image/resource noise from `collectBrowserErrors`, the full matrix passed with `20 passed (7.2m)` after the broad `Warning:` ignore was removed. The matrix covers Chromium, Firefox, WebKit, mobile Safari emulation, and tablet Chrome emulation for the Future OS full-menu iframe check plus flow-designer, form-config, and approval-rules narrow-screen checks. This is cross-browser/device-emulation evidence, not physical real-device hardware evidence.

```bash
AMS_E2E_REAL_BACKEND=true npm --prefix frontend run e2e -- --project=real-backend-smoke --project=browser-regression-smoke src/e2e/real-backend-smoke.spec.ts src/e2e/browser-regression-smoke.spec.ts -g '托管流程发布回读节点表单并发起审批|资产转移四审批节点停在第 3 步可回看历史表单、意见和未来环节|/approvals/:id' --reporter=line
```

Status: current combined targeted Playwright refresh completed with `4 passed (14.6s)`.

```bash
find frontend/playwright-report/data -maxdepth 1 -type f -name '*.png'
```

Status: current report data contained 14 PNG files: `03b58d32f2d40e8d4128bb173734edfe71502d31.png`, `1a3888e22543cde301396adcd8574354ecf3190b.png`, `1c127149e937783b7576169b68350ecd3f2c0e0c.png`, `2e63aab4c72d04bc3773180aefa98402bd87e20e.png`, `3793f49096b3aa79273b3829eb36d4b4c5212bb4.png`, `57c65d6eccbf660e94c57dd2e093220130f3a63d.png`, `63b5ad6aa4b8de261d45c297ee7ece45302db283.png`, `7451c3d0c320bcb547a1025756a61855fb68585a.png`, `b3ea62cc00c456764bb2dc435765a56b43cb0bec.png`, `c087e38a08a00a1bf7b2e4469a1a6ec7c7500160.png`, `c2da82950818c97d693576cf3f23efc5f0b01e75.png`, `c6117d3f9bb1867f5972982e423b84aedb51c4ac.png`, `ce0589e5d1806e4605d4ad6fb07968e8187ca238.png`, and `d118bcf9087b5013b913a73ed27c305efe393f4b.png`.

```bash
npm --prefix frontend run e2e:browser-regression -- src/e2e/browser-regression-smoke.spec.ts -g '/approvals/:id'
```

Status: passed with `2 passed (5.3s)`. The targeted browser regression covers current assignee, no-current-step observer, terminal action-area, and approval-detail load-error evidence attachments.

```bash
npm --prefix frontend run e2e:browser-regression -- src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts
```

Status: Future OS workbench targeted browser regression passed with `12 passed (2.6m)`.

```bash
npm --prefix frontend run e2e:browser-regression -- src/e2e/browser-regression-smoke.spec.ts -g '/settings'
```

Status: `/settings` targeted browser regression passed in `5.3s`.

```bash
npm --prefix frontend run e2e:browser-regression
```

Status: full browser regression passed with `62 passed (4.0m)`.

```bash
node <static Future OS HTML inline-script check>
```

Status: passed for 44 `future-settings-os-*.html` inline scripts after fixing the unclosed Tailwind config in `future-settings-os-sla-config.html`.

```bash
npm --prefix frontend run build
```

Status: passed. Vite transformed 9450 modules and finished with `built in 12.43s`; output included the existing large chunk warning, not a build error.

```bash
npm --prefix frontend test -- --run
```

Status: full Vitest passed with `Test Files 101 passed (101)`, `Tests 992 passed (992)`, duration 5.76s.

```bash
npm --prefix frontend test -- --run src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx
```

Status: P7 runtime-assignee target passed with 6 tests, covering auto-load redaction, missing-field blocking, manual recalculation redaction, service failure hidden-state, current-node mismatch blocking, and missing business type disabled/no-API behavior.

```bash
npm --prefix frontend test -- --run src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx
```

Status: P9 runtime-flow target passed with 6 tests, covering section aria-label/title, legend labels, runtime path + history completed/current/upcoming states, rejected/cancelled/ended branches, summary state/handler-role/approval-mode, section anchors, and the approval-null empty state.

```bash
npm --prefix frontend test -- --run src/__tests__/workbenchPlatformEntry.contract.test.ts
```

Status: contract target passed with 18 tests after repair.

```bash
npm --prefix frontend run verify:system-hub
```

Status: passed after the verifier was aligned to the current Future OS smoke contract. Output confirmed `formal_menus=44`, `manifest_entries=45`, `formal_manifest_entries=44`, and group counts `流程平台:9, 组织权限:8, 基础资料:6, 集成配置:5, 消息与通知:8, 系统参数:8`.

```bash
npm --prefix frontend test -- --run src/__tests__/workbenchPlatformEntry.contract.test.ts
```

Status: rerun passed with `18 passed`.

```bash
rg -n "<execution-plan named legacy hardcoded workflow keys>" backend/src frontend/src frontend/tests docs/testing docs/specs
```

Status: superseded by the exact command below.

```bash
rg -n "STANDARD_V2|FAST_TRACK" backend/src frontend/src frontend/tests docs/testing docs/specs
```

Status: passed for the current source-audit layer. Output was limited to the execution-plan prohibition notes in `docs/specs/workflow-platform-execution-plan.md`; there were no hits in `backend/src`, `frontend/src`, `frontend/tests`, or `docs/testing`.

```bash
rg -n "<execution-plan named legacy hardcoded workflow keys>" docs/testing docs/specs
```

Status: older narrow check. The current exact audit above is broader and is the closeout evidence.

```bash
git diff --check -- frontend/src/pages/approval/ApprovalDetailPage.tsx frontend/src/pages/disposal/AssetTransferFormPage.tsx frontend/src/e2e/real-backend-smoke.spec.ts frontend/src/e2e/browser-regression-smoke.spec.ts docs/testing/workflow-platform-p9-p10-evidence-matrix.md docs/specs/workflow-platform-execution-plan.md
```

Status: no output.

```bash
GitNexus detect_changes(repo=forthams, scope=all, worktree=/Users/feigao/project/Project/forthAMS)
```

Old known status before this first-pass executable-evidence update: CRITICAL, with `changed_files=79`, `changed_count=914`, and `affected_count=27`. This round's first-pass refresh returned LOW with `changed_files=29`, `changed_count=37`, and `affected_count=0`; previous refresh returned MEDIUM with `changed_files=34`, `changed_count=50`, `affected_count=3`; the P3 normalized self-loop repair refresh returned MEDIUM with `changed_files=36`, `changed_count=56`, `affected_count/processes=3`; latest detect all after the legacy app workflowDefinition repair returned MEDIUM with `changed_files=38`, `changed_count=60`, `affected_count/processes=3`, and affected processes limited to `ApprovalDetailPage` flows: `ApprovalDetailPage -> NormalizeRole`, `ApprovalDetailPage -> NumericValue`, and `ApprovalDetailPage -> StringValue`. It still needs independent reviewer consumption before final PASS.

```bash
git diff --name-only -- frontend/src/pages/mobile frontend/src/router/index.tsx frontend/src/pages/dashboard
```

Current status: output is limited to `frontend/src/router/index.tsx`; there is no `frontend/src/pages/mobile/**` or `frontend/src/pages/dashboard/**` output. Global reviewer three accepted the router diff as a narrow `/settings-v2` -> `/settings/:tab` compatibility redirect exception backed by adjacent route permission/contract tests and `/settings` browser smoke. This is not a "router untouched" claim.

```bash
node <recommended staging decision split in-memory audit>
```

Status: prior staging split audit passed with `tracked_count=35`, `tracked_delta=0`, `tracked_split=22/3/8/2`, `untracked_total=118`, `formal_total/html/png/icons/manifest=95/44/44/6/1`, `app_test_untracked=1`, `evidence_total/stitch/notes/boundary=22/9/12/1`, `other_untracked=0`, `cached_count=0`, and `frozen_probe=frontend/src/router/index.tsx`. Current visible untracked after adding `ApprovalFlowChart.runtimeStates.test.tsx` is 119, split as 95 formal Future OS assets + 2 app/test candidates + 22 evidence/archive candidates + 0 other. A first attempt that wrote the expected path list to `/tmp` was blocked by the GAI2 native guard because the list contained protected guidance paths; the replacement audit kept the expected list in memory and did not write files.

## Runtime-Assignee 6-Test MINIONS Ledger Repair

gap_fingerprint: `runtime-assignee-6test-minions-ledger-not-evidenced`

Purpose: reviewer seventeen / 审查员十七号 returned historical PARTIAL only because this slice lacked a local, auditable MINIONS / execution-chain summary. 审查员三十六号 / reviewer36 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS for this ledger/docs-only closure slice only. The historical PARTIAL and gap_fingerprint remain recorded; this does not mark the global goal as PASS, and global remains PARTIAL / 全局仍为 PARTIAL.

| Role | Agent / Tool | Scope / Lease | Result / Consumption |
| --- | --- | --- | --- |
| 起草员二号, role_id=`gai2-drafter` | agent_id=`019f149f-47e0-7ae1-95a4-a37f35f840d1`; tool=`Wegener` | readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0 | result=completed; artifact=draft plan for 3 additional runtime-assignee tests and matrix update; consumed=true; close_status=closed |
| 精修员二号, role_id=`gai2-refiner` | agent_id=`019f14a1-8e56-73f0-b178-bf486fb73753`; tool=`Gibbs` | readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0 | result=completed; verdict=accept_with_refinements; write_intent_preserved=true; degradation_detected=false; consumed=true; close_status=closed |
| 执行员十七号, role_id=`gai2-builder` | agent_id=`019f14a2-fa63-7e13-a911-813597e6cc23`; tool=`Darwin` | allowlist limited to `frontend/src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx` and `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`; wait_budget=480000ms; interrupt_count=0 | result=completed; changed_files=the target test and this matrix; target Vitest 6 tests passed; git diff check no output; consumed=true; close_status=closed |
| 审查员十七号, role_id=`gai2-reviewer` | agent_id=`019f14a8-0ccc-75d3-b8a8-9e4517af50d6`; tool=`Aristotle` | readonly; wait_budget=480000ms; interrupt_count=0 | result=PARTIAL only due ledger evidence gap; consumed=true; close_status=closed |

## Runtime-Flow Chart 6-Test MINIONS Ledger Repair

gap_fingerprint: `runtime-flow-chart-6test-minions-ledger-not-evidenced`

Purpose: this section records the repair/evidence for the historical runtime-flow ledger gap. 审查员三十六号 / reviewer36 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS for this ledger/docs-only closure slice only. It does not mark the global goal as PASS. Global remains PARTIAL because staging/commit/user decision remains open and no physical real-device hardware evidence is claimed.

Slice objective: add component-level runtime flow chart evidence in `ApprovalFlowChart.runtimeStates.test.tsx`, covering completed/current/upcoming/rejected/cancelled/ended states, legend, summary, section anchor, and empty state.

| Role | Agent / Tool | Scope / Lease | Result / Consumption |
| --- | --- | --- | --- |
| 起草员三号, role_id=`gai2-drafter` | agent_id=`019f14b1-a14b-7da0-8fc8-6b46265267ab`; tool=`Bohr` | readonly; fork_context=false; wait_budget=180000ms + recovery 90000ms; interrupt_count=1 | result=completed returned on close; artifact=draft plan for new `frontend/src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx`, matrix update, release-boundary update to 119/2/24, and warning that ended state needs a scenario without completed records; consumed=true; close_status=closed |
| 精修员三号, role_id=`gai2-refiner` | agent_id=`019f14b6-8732-7bd0-b704-5796433372d7`; tool=`Godel` | readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0 | result=completed; verdict=`accept_with_refinements`; write_intent_preserved=true; degradation_detected=false; refined import path to `@/app/components/approval/ApprovalFlowChart`, clarified ended state via APPROVED/COMPLETED with no completed records, and required rejected/cancelled separate testids plus summary/anchor assertions; consumed=true; close_status=closed |
| 执行员十九号, role_id=`gai2-builder` | agent_id=`019f14b8-3a4c-7b13-8ff4-f46714f0f413`; tool=`Hilbert` | allowlist limited to `frontend/src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx`, `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`, and `docs/testing/workflow-platform-release-boundary.md`; wait_budget=480000ms; interrupt_count=0 | result=completed; changed_files=the runtime-flow component test, this matrix, and release-boundary; target command `npm --prefix frontend test -- --run src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx` passed 1 file / 6 tests; `git diff --check` for docs and no-index check for the new test had no whitespace-error output; scoped frozen probe reported only the existing `frontend/src/router/index.tsx` compatibility exception, with no mobile/dashboard writes; consumed=true; close_status=closed |

Docs-only follow-up repair ledger for `runtime-flow-docs-repair-ledger-not-recorded`: this subsection records reviewer nineteen's historical PARTIAL gap and the subsequent matrix-only repair. 审查员三十六号 / reviewer36 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS for this ledger/docs-only closure slice only. This does not self-award global PASS and does not change the global PARTIAL state. Global remains PARTIAL because no staging/commit/user decision has been made and no physical real-device hardware evidence is claimed.

| Role | Agent / Tool | Scope / Lease | Result / Consumption |
| --- | --- | --- | --- |
| 审查员十九号, role_id=`gai2-reviewer` | agent_id=`019f14c3-4e02-7c42-a7c8-627220b7f20a`; tool=`Arendt` | readonly; fork_context=false; wait_budget=480000ms; interrupt_count=0 | result=PARTIAL; gap_fingerprint=`runtime-flow-docs-repair-ledger-not-recorded`; acceptance all PASS except AC-MINIONS1 because 执行员二十号 ledger was missing; consumed=true; close_status=closed |
| 执行员二十号, role_id=`gai2-builder` | agent_id=`019f14c1-2421-7be3-8653-87378ad23175`; tool=`Hubble` | allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; changed_files=matrix only; added `Runtime-Flow Chart 6-Test MINIONS Ledger Repair`; command `git diff --check -- docs/testing/workflow-platform-p9-p10-evidence-matrix.md` produced no output / no whitespace errors; command `git diff --name-only -- docs/testing/workflow-platform-p9-p10-evidence-matrix.md` returned `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`; no stage/commit; consumed=true; close_status=closed |
| 执行员二十一号, role_id=`gai2-builder` | agent_id not available in prompt; follow-up repair from conversation evidence | allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md`; fork_context=false | docs-only repair added this follow-up ledger; reviewer36 later closed the ledger/docs-only slice locally; no fabricated close_status is claimed for this row; no global PASS is self-awarded |

## P3 Frontend Publish Precheck Gate / P3 前端发布前预检查门禁

This compact ledger records the current P3 designer publish-precheck frontend gate slice. The historical reviewer21 PARTIAL for `P3-PRECHECK-NORMALIZE-SELF-LOOP-BYPASS-AND-DOCS-BUILDER-LEDGER-MISSING` remains recorded, and 审查员三十六号 / reviewer36 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS for this ledger/docs-only closure slice only. Global remains PARTIAL because no staging/commit/user decision has been made and no physical real-device hardware evidence is claimed.

- Implementation/test slice: `frontend/src/utils/workflowDefinition.ts` adds loop-risk detection with stable error text `流程存在循环路径，请检查节点连线`. The normalized self-loop bypass is repaired: normalize now preserves self-loop edges for validation, structural inbound/outbound checks still ignore self-loop counts, and stable cycle validation runs through the normalize path. A three-color DFS checks every node for back-edges, and the cycle error is emitted only once.
- Test coverage: `frontend/src/utils/workflowDefinition.test.ts` adds P3 pre-release structure-gate unit coverage for valid flow, missing start/approval `formSource`, missing approver, no end / multiple ends, duplicate condition exits / missing branches / compound expressions, unreachable nodes, ordinary cycle, direct self-loop, and normalized-path self-loop bypass.
- Target command: `npm --prefix frontend test -- --run src/utils/workflowDefinition.test.ts` passed 1 file / 16 tests.
- Whitespace gate: `git diff --check -- frontend/src/utils/workflowDefinition.ts frontend/src/utils/workflowDefinition.test.ts` produced no output.
- Pre-impact: GitNexus `impact(validateWorkflowDefinition, upstream)` returned LOW, direct callers=1, processes affected=0.
- P3 detect all after repair was `MEDIUM`, `changed_files=36`, `changed_count=56`, `affected_count/processes=3`; latest detect all after the legacy app workflowDefinition repair is `MEDIUM`, `changed_files=38`, `changed_count=60`, `affected_count/processes=3`, limited to `ApprovalDetailPage -> NormalizeRole`, `ApprovalDetailPage -> NumericValue`, and `ApprovalDetailPage -> StringValue`; staged detect has no changes.
- Scoped frozen/status: changed files include `frontend/src/utils/workflowDefinition.ts`, `frontend/src/utils/workflowDefinition.test.ts`, and existing `frontend/src/router/index.tsx` compatibility exception; no mobile/dashboard output; `git diff --cached --name-only | wc -l` is 0.

MINIONS chain for this slice:

| Role | Agent / Tool | Scope / Lease | Result / Consumption |
| --- | --- | --- | --- |
| 起草员四号, role_id=`gai2-drafter` | agent_id=`019f14cb-d5e8-7ac1-a808-c863a4dbf2b3`; tool=`Nash` | readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0 | result=completed; artifact=DFS cycle detection + P3 test matrix draft; consumed=true; close_status=closed |
| 精修员四号, role_id=`gai2-refiner` | agent_id=`019f14cd-cac0-74e3-a246-070abbd600da`; tool=`Plato` | readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0 | result=completed; verdict/write_intent_preserved=true; refinements=self-loop direct validation, cycle error once, no backend/page expansion; consumed=true; close_status=closed |
| 执行员二十二号, role_id=`gai2-builder` | agent_id=`019f14cf-8838-7073-938c-7a9a6d4386f9`; tool=`Pascal` | allowlist limited to `frontend/src/utils/workflowDefinition.ts` and `frontend/src/utils/workflowDefinition.test.ts`; wait_budget=600000ms; interrupt_count=0 | result=completed; target test 15 passed; no stage/commit; consumed=true; close_status=closed |
| 审查员二十一号, role_id=`gai2-reviewer` | agent_id=`019f14d9-cfa9-75c2-ae83-a90735f7b283`; tool=`Bernoulli` | readonly; fork_context=false; wait_budget=480000ms; interrupt_count=0 | result=PARTIAL; gap_fingerprint=`P3-PRECHECK-NORMALIZE-SELF-LOOP-BYPASS-AND-DOCS-BUILDER-LEDGER-MISSING`; found normalized self-loop bypass and missing 执行员二十三号 ledger; close_status=closed |
| 执行员二十三号, role_id=`gai2-builder` | agent_id=`019f14d4-262b-7d43-9981-8e544f687721`; tool=`Jason` | allowlist limited to the two docs files; fork_context=false; wait_budget=420000ms; interrupt_count=0 | result=completed; changed matrix + release-boundary; no stage/commit; close_status=closed |
| 执行员二十四号, role_id=`gai2-builder` | agent_id=`019f14dd-0620-7a72-adf9-cbb23f055579`; tool=`Beauvoir` | allowlist limited to the two frontend utils/test files; fork_context=false; wait_budget=420000ms; interrupt_count=0 | result=completed; fixed normalize self-loop bypass by preserving self-loop edges through normalize; added normalized-path self-loop test; target command `npm --prefix frontend test -- --run src/utils/workflowDefinition.test.ts` passed 1 file / 16 tests; no stage/commit; close_status=closed |

Current main-thread evidence snapshot retained for historical trace:

- `git status --short` shows this matrix modified, `docs/testing/workflow-platform-release-boundary.md` untracked, both new test files untracked, and existing `frontend/src/router/index.tsx` modified.
- `git diff --cached --name-only | wc -l` is `0`.
- `git ls-files --others --exclude-standard | wc -l` is `119`.
- Current target command now: `npm --prefix frontend test -- --run src/utils/workflowDefinition.test.ts` -> 1 file / 16 tests passed.
- Latest GitNexus detect all after repair: MEDIUM, `changed_files=38`, `changed_count=60`, `affected_count/processes=3`, limited to the same `ApprovalDetailPage` flows; staged detect has no changes.
- Current tracked dirty count is 39; visible untracked remains 119; release-boundary split is tracked `26/3/8/2`, visible `95+2+22+0`, release app/test total 28.
- The prior gap remains historical PARTIAL evidence, but reviewer36 / 审查员三十六号 has locally closed this ledger/docs-only slice; do not self-award global PASS.
- The recorded runtime-flow target remains `1 file / 6 tests passed`; reviewer36's ledger/docs-only closure is local only and is not a self-awarded global PASS.
- Tool trace redaction status: no raw secrets, API keys, tokens, passwords, or private keys are copied into this ledger.

## Legacy App Workflow Definition Cycle Precheck Repair / 旧 app 流程定义循环预检修复

This compact ledger records the `DUPLICATE-WORKFLOW-DEFINITION-PRECHECK-BYPASS` repair for the legacy app workflow definition utility. It is slice evidence only and does not change the global PARTIAL release verdict.

- Implementation slice: `frontend/src/app/utils/workflowDefinition.ts` now preserves valid-node self-loop edges during normalization so validation can reject them. Validation uses stable cycle text `流程存在循环路径，请检查节点连线`, treats direct self-loops as cycle errors without counting them toward incoming/outgoing/adjacency, and runs DFS over non-self-loop adjacency to reject ordinary directed cycles such as `A -> B -> A`. The app flow node semantics remain local; no canonical re-export was introduced.
- Test coverage: `frontend/tests/unit/workflowDefinitionValidation.test.ts` now covers normalized self-loop preservation, direct self-loop rejection, and multi-node directed cycle rejection, including one-time cycle-error emission.
- Target command: `npm --prefix frontend test -- --run tests/unit/workflowDefinitionValidation.test.ts src/utils/workflowDefinition.test.ts` passed 2 files / 27 tests.
- Whitespace gate: `git diff --check -- frontend/src/app/utils/workflowDefinition.ts frontend/tests/unit/workflowDefinitionValidation.test.ts docs/testing/workflow-platform-p9-p10-evidence-matrix.md docs/testing/workflow-platform-release-boundary.md` produced no output.
- GitNexus latest all-scope detect: MEDIUM, `changed_files=38`, `changed_count=60`, `affected_count/processes=3`; affected processes remain `ApprovalDetailPage -> NormalizeRole`, `ApprovalDetailPage -> NumericValue`, and `ApprovalDetailPage -> StringValue`. GitNexus staged detect reports no changes detected.
- Current tracked dirty count: `39`; current visible untracked count: `119`; tracked split: `26` release app/test + `3` release support/evidence docs + `8` separate policy/tooling + `2` local noise.
- Release app/test total: `28` candidates = `26` tracked release app/test + `2` untracked app/test. The two newly tracked release app/test paths are `frontend/src/app/utils/workflowDefinition.ts` and `frontend/tests/unit/workflowDefinitionValidation.test.ts`.
- Visible untracked split remains `95` formal Future OS assets + `2` app/test + `22` evidence/archive + `0` other.
- Scoped frozen probe output remains only `frontend/src/router/index.tsx`; no mobile/dashboard/WorkflowDesigner page modifications came from this slice.
- Pre-impact: upstream GitNexus impact for app normalize/validate was reported by the scheduler as LOW, with no HIGH/CRITICAL warning.
- Scope guard: writes are limited to the user-approved allowlist; `frontend/src/app/pages/WorkflowDesigner.tsx`, `frontend/src/pages/workflow/WorkflowDesignerPage.tsx`, and `frontend/src/pages/mobile/**` were not edited; no stage/commit operation was run.
- Tool trace redaction status: no raw secrets, API keys, tokens, passwords, or private keys are copied into this ledger.
- Reviewer twenty-three / 审查员二十三号 returned `PARTIAL`: agent_id=`019f14f4-12d8-79a1-84a6-5ffd57881d53`; gap_fingerprint=`duplicate-workflow-precheck-functional-pass-agent27-ledger-unverified`; AC-L1..AC-L6 functional checks PASS; AC-L7 ledger PARTIAL because 执行员二十七号 lease/identity evidence was not independently verifiable. 审查员二十四号 / reviewer24 agent_id=`019f14fd-ed84-7072-a2b2-4b6b2d4d0516` rechecked `DUPLICATE-WORKFLOW-DEFINITION-PRECHECK-BYPASS` and the reviewer23 gap, returned verdict `PASS`, `gap_fingerprint=null`, and AC-L1..AC-L7 PASS. This closes only the old app workflowDefinition slice ledger gap and does not change the global PARTIAL state.

| Legacy app workflowDefinition repair ledger role | Agent / tool identity | Scope / lease | Result |
| --- | --- | --- | --- |
| 起草员五号, role_id=`gai2-drafter` | agent_id=`019f14e9-2523-7ca3-afdb-b3002298dd6a` | readonly; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; duplicate workflow definition precheck bypass draft consumed=true; close_status=closed |
| 精修员五号, role_id=`gai2-refiner` | agent_id=`019f14ea-db3f-73d3-a7a5-73c6b12f761d` | readonly; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; write intent preserved for old app util repair and target test pairing; consumed=true; close_status=closed |
| 执行员二十六号, role_id=`gai2-builder` | agent_id=`019f14eb-add5-7083-9e08-ca5a3d679663` | allowlist limited to `frontend/src/app/utils/workflowDefinition.ts` and `frontend/tests/unit/workflowDefinitionValidation.test.ts`; fork_context=false; wait_budget=720000ms; interrupt_count=0 | result=completed; fixed `DUPLICATE-WORKFLOW-DEFINITION-PRECHECK-BYPASS`; target command passed 2 files / 27 tests; no stage/commit; close_status=closed |
| 执行员二十七号, role_id=`gai2-builder` | agent_id=`019f14ef-b02f-7700-ab02-2bdacd58c7ee`; tool=`Gauss` | allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md` and `docs/testing/workflow-platform-release-boundary.md`; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; corrected evidence stats and ledger only; ran scoped docs `git diff --check`; no business files, tests, router, mobile, dashboard, or WorkflowDesigner edits; no stage/commit; consumed=true; close_status=closed |
| 执行员二十八号, role_id=`gai2-builder` | agent_id=`019f14f6-e333-7930-8315-11de5390801e`; tool=`Ampere` | allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md` and `docs/testing/workflow-platform-release-boundary.md`; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; repairs gap `duplicate-workflow-precheck-functional-pass-agent27-ledger-unverified`; docs-only ledger/lease evidence update; no business files, tests, router, mobile, dashboard, or WorkflowDesigner edits; no stage/commit; consumed=true; close_status=closed |
| 执行员二十九号, role_id=`gai2-builder` | agent_id=`019f14f9-e87b-71d3-b6ea-ff133de29534`; tool=`Feynman` | allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md` and `docs/testing/workflow-platform-release-boundary.md`; fork_context=false; wait_budget=300000ms; interrupt_count=0 | result=completed; corrected 执行员二十八号 actual closed state and removed stale pending phrases; no business files, tests, router, mobile, dashboard, or WorkflowDesigner edits; no stage/commit; consumed=true; close_status=closed |

## Current Docs-Only Chain Ledger Repair / 当前 docs-only 链路台账修复

This docs-only repair records the current chain for reviewer thirty-two / 审查员三十二号 gap `reviewer32-current-docs-only-chain-ledger-unverified`, now closed by reviewer33 / 审查员三十三号 read-only PASS for the current docs-only chain ledger slice only. It does not change functional evidence, does not claim global PASS, does not authorize staging or commit, and does not modify code, tests, router, mobile, dashboard, or WorkflowDesigner files.

- 审查员三十二号: agent_id=`019f1508-538c-7480-a3af-4f4d669783d8`; role_id=`gai2-reviewer`; historical verdict=`PARTIAL`; gap_fingerprint=`reviewer32-current-docs-only-chain-ledger-unverified`; AC-D1..AC-D5 PASS; AC-D6 PARTIAL because the current chain was not locally searchable before this ledger repair. This is closed-history after reviewer33 and is no longer the current blocker.
- 审查员三十三号 / reviewer33: read-only `PASS`, closing `reviewer32-current-docs-only-chain-ledger-unverified` only for the current docs-only chain ledger slice. This is not a global PASS; global remains PARTIAL / 全局仍为 PARTIAL.
- 起草员六号: agent_id=`019f1502-f84b-71f1-9ffc-013584c93d5a`; tool=`Boole`; role_id=`gai2-drafter`; readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed.
- 精修员六号: agent_id=`019f1504-9bd7-7b93-a923-da222fc36b60`; tool=`Nietzsche`; role_id=`gai2-refiner`; readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed.
- 执行员三十一号: agent_id=`019f1505-65ee-7c92-9e5e-0868f78d3a82`; tool=`Tesla`; role_id=`gai2-builder`; allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md` and `docs/testing/workflow-platform-release-boundary.md`; fork_context=false; wait_budget=300000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed.
- 执行员三十二号: thread ledger supplied by orchestrator to reviewer; this current docs-only repair intentionally does not record the active executor as closed to avoid recursive closure claims.
- Reviewer twenty-four / 审查员二十四号 fact remains preserved: agent_id=`019f14fd-ed84-7072-a2b2-4b6b2d4d0516`; verdict `PASS`; gap_fingerprint=null; AC-L1..AC-L7 PASS for the old app workflowDefinition slice only. This old-slice PASS is not a global PASS.
- Current preflight snapshot for reviewer33 refresh: `git diff --check` produced no output; `git diff --cached --name-only` was empty; frozen probe output was only `frontend/src/router/index.tsx`; trackedTotal=`39` split `26/3/8/2/0`; untrackedTotal=`119` split futureHtml=`44`, nativePng=`44`, icons=`6`, manifest=`1`, stitchPrompts=`9`, notes=`12`, boundary=`1`, appTests=`2`, other=`0`; releaseAppTestTotal=`28`; `npm --prefix frontend run verify:system-hub` PASS with formal_menus=`44`, manifest_entries=`45`, formal_manifest_entries=`44`, groups=`流程平台:9, 组织权限:8, 基础资料:6, 集成配置:5, 消息与通知:8, 系统参数:8`; GitNexus staged none; GitNexus all remains MEDIUM `38/60/3`.
- GitNexus docs impact: `Remaining Gaps` returned LOW/0; other specific docs sections returned UNKNOWN/0 with target not found; docs sections are not indexed as code symbols, and there was no HIGH/CRITICAL warning.
- Tool trace redaction status: no raw secrets, API keys, tokens, passwords, or private keys are copied into this ledger.

### Reviewer34 Current Docs-Only MINIONS Ledger Repair / 审查员三十四号当前 docs-only MINIONS 台账修复

This subsection records the reviewer36 local closure for `executor33-current-docs-only-minions-ledger-not-recorded` after reviewer34's historical PARTIAL. 审查员三十六号 / reviewer36 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS for this ledger/docs-only closure slice only. It does not mark the global goal as PASS, does not claim physical real-device hardware PASS, and does not authorize code, test, router, mobile, dashboard, WorkflowDesigner, configuration, stage, or commit changes.

- 审查员三十四号 / reviewer34: agent_id=`019f1521-e116-7611-acba-9fc2f8fb9a98`; role_id=`gai2-reviewer`; verdict=`PARTIAL`; gap_fingerprint=`executor33-current-docs-only-minions-ledger-not-recorded`; AC-R34-1..AC-R34-4 PASS; AC-R34-5 PARTIAL because current slice MINIONS ledger was not locally searchable.
- 起草员七号: agent_id=`019f1519-0d0b-7061-9735-e48db2c18fbb`; tool=`Franklin`; role_id=`gai2-drafter`; model=`gpt-5.4`; reasoning=`xhigh`; readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed.
- 精修员七号: agent_id=`019f151a-9df4-7060-aeb2-35699f2d8ff5`; tool=`Turing`; role_id=`gai2-refiner`; model=`gpt-5.5`; reasoning=`high`; readonly; fork_context=false; wait_budget=180000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed; write_intent_preserved=true.
- 执行员三十三号: agent_id=`019f151b-b915-7b51-9f83-688fe24e4c0c`; tool=`Pauli`; role_id=`gai2-builder`; model=`gpt-5.5`; reasoning=`high`; allowlist limited to `docs/testing/workflow-platform-p9-p10-evidence-matrix.md` and `docs/testing/workflow-platform-release-boundary.md`; fork_context=false; wait_budget=480000ms; interrupt_count=0; result=completed; consumed=true; close_status=closed; no stage/commit; no out-of-scope writes.
- 执行员三十四号: record only as thread ledger supplied by orchestrator to reviewer; this document does not self-record the current builder as closed. The main thread will supply current builder close ledger to reviewer.
- Repair status: `executor33-current-docs-only-minions-ledger-not-recorded` preserves reviewer34's historical PARTIAL and is locally closed by reviewer36 only for this ledger/docs-only slice. Global remains PARTIAL / 全局仍为 PARTIAL because the dirty worktree, staging/user decision, and physical real-device hardware remain open.

## Remaining Gaps

- Browser regression is no longer a P10 gap: the repaired full browser regression passed 62/62 in 4.0m, and the targeted Future OS workbench plus `/settings` checks also passed.
- Frontend full Vitest is no longer a P10 gap: `npm --prefix frontend test -- --run` passed 101 test files and 992 tests in 5.76s.
- Backend full is no longer a P10 gap: `cd backend && mvn test` passed 715 tests with no failures/errors/skips and `BUILD SUCCESS`.
- Full real-backend E2E is no longer a P10 gap: `npm --prefix frontend run e2e:real -- --reporter=line` passed 12 tests in 23.8s across the full real-backend workflow-platform coverage listed above.
- Cross-browser/device-emulation coverage is no longer a configured-matrix gap: `npm --prefix frontend run e2e:device-matrix` passed 20 tests across Chromium, Firefox, WebKit, mobile Safari emulation, and tablet Chrome emulation. Physical real-device hardware is still not claimed because no attached hardware farm/device lab was used.
- GitNexus `detect_changes(scope=all)` has an old CRITICAL record, a first-pass LOW refresh, a previous MEDIUM refresh with `changed_files=34`, `changed_count=50`, and `affected_count=3`, the P3 repair MEDIUM refresh with `changed_files=36`, `changed_count=56`, and `affected_count/processes=3`, and this latest MEDIUM refresh with `changed_files=38`, `changed_count=60`, and `affected_count/processes=3`. Current tracked dirty count is 39, split as 26 release app/test + 3 release support/evidence docs + 8 separate policy/tooling + 2 local noise, with no tracked diff under `frontend/src/pages/mobile/**` or `frontend/src/pages/dashboard/**`; `frontend/src/router/index.tsx` remains the documented narrow redirect exception and the scoped frozen probe output remains only that path. The two newly tracked release app/test paths are `frontend/src/app/utils/workflowDefinition.ts` and `frontend/tests/unit/workflowDefinitionValidation.test.ts`. The ignore follow-up reduced visible untracked paths from 1337 and the new runtime-flow target keeps current visible untracked at 119 with app/test candidates visible. Current visible classes remain 95 formal Future OS/system-hub release candidates (`44` HTML, `44` native-shell PNG, `6` navigation icons, `1` manifest), 2 untracked app/test candidates (`frontend/src/__tests__/ApprovalDetailPage.runtimeAssignee.test.tsx` and `frontend/src/__tests__/ApprovalFlowChart.runtimeStates.test.tsx`), 9 Stitch prompt/evidence files, 12 Notes DXL workflow-migration evidence documents, and 1 release-boundary evidence document. The release-boundary manifest freezes the 119 visible candidates as a publish/app-test/evidence/user-decision split, and release app/test total is now 28 candidates, but the dirty worktree/global release review still cannot PASS until staging/commit/user decision is completed.
- Independent reviewer state is no longer open: reviewer one returned `PARTIAL` with gap_fingerprint `stale-contract-label-and-unproven-ledger-chain`; after builder six repaired the stale Future OS/browser-contract title, reviewer two returned `PASS` only for the repaired Future OS/browser-contract slice; global reviewer three returned overall `PARTIAL` while accepting the specified increment as PASS for backend full, full real-backend E2E, Future OS route/browser contract, P9-AC6 old-key audit, and no mobile/dashboard scope breach. Reviewer twenty-three / 审查员二十三号 returned historical `PARTIAL` with gap_fingerprint `duplicate-workflow-precheck-functional-pass-agent27-ledger-unverified`: AC-L1..AC-L6 PASS, AC-L7 ledger PARTIAL; reviewer twenty-four / 审查员二十四号 has since closed that old app workflowDefinition slice ledger gap, while global remains PARTIAL.
- Reviewer twenty-four / 审查员二十四号 conclusion: PASS for `DUPLICATE-WORKFLOW-DEFINITION-PRECHECK-BYPASS` and the reviewer23 gap recheck. agent_id=`019f14fd-ed84-7072-a2b2-4b6b2d4d0516`; verdict `PASS`; gap_fingerprint=null; AC-L1..AC-L7 PASS. This closes only `duplicate-workflow-precheck-functional-pass-agent27-ledger-unverified` for the old app workflowDefinition slice, not the global release; global remains PARTIAL because dirty worktree/staging/user decision/physical real-device hardware remain open.
- Reviewer four / 审查员四号 conclusion: PASS only for the then-current configured device matrix review. A later opt-in matrix now adds cross-browser/device-emulation PASS evidence, and reviewer five / 审查员五号 closed `browser-error-filter-doc-source-drift` after `collectBrowserErrors` was narrowed to explicit external font/image/resource noise only. Global release remains blocked by the dirty-worktree/untracked release-boundary and by the absence of physical real-device hardware evidence.
- Reviewer eight / 审查员八号 conclusion: AC-R1..AC-R5 PASS for the release-boundary / Stitch fact-source repair slice, including the then-current visible-untracked classification and release/evidence/user-decision split. The accepted gap_fingerprint is `release-boundary-global-open-dirty-whitelist-staging-hardware`; the overall workflow-platform/native goal remains PARTIAL because global release staging/commit/user decision and physical real-device hardware remain open.
- Reviewer ten / 审查员十号 conclusion: AC-S1..AC-S6 PASS for the recommended staging decision split slice. Evidence included the prior in-memory staging split audit (`tracked_split=22/3/8/2`, `formal_total/html/png/icons/manifest=95/44/44/6/1`, `app_test_untracked=1`, `evidence_total/stitch/notes/boundary=22/9/12/1`, `other_untracked=0`, `cached_count=0`), `npm --prefix frontend run verify:system-hub` PASS, GitNexus latest MEDIUM risk, and frozen probe limited to `frontend/src/router/index.tsx`. Current tracked split is now 26/3/8/2, and visible split remains 95 formal + 2 app/test + 22 evidence/archive + 0 other. The accepted gap_fingerprint is `GLOBAL-PARTIAL-STAGING-DEVICE-EVIDENCE-OPEN`; the overall workflow-platform/native goal remains PARTIAL because no user staging/commit decision has been made and physical real-device hardware is not claimed.
- Reviewer fifteen / 审查员十五号 conclusion: PASS for the P7 runtime-assignee component-test slice. It closes `P7-runtime-assignee-scope-router-modified-and-gai2-ledger-unproven` with the target Vitest evidence, but global remains PARTIAL because there is no user staging/commit decision and physical real-device hardware is not claimed.
- Reviewer seventeen / 审查员十七号 conclusion: historical PARTIAL only due ledger evidence gap `runtime-assignee-6test-minions-ledger-not-evidenced`. The `runtime-assignee-6test-minions-ledger` repair section above records the 起草员二号 -> 精修员二号 -> 执行员十七号 -> 审查员十七号 chain with agent IDs, lease fields, consumed results, and `close_status=closed`; reviewer36 / 审查员三十六号 returned PASS for this ledger/docs-only closure slice only, and global remains PARTIAL.
- Reviewer twenty-one / 审查员二十一号 conclusion: historical PARTIAL for `P3-PRECHECK-NORMALIZE-SELF-LOOP-BYPASS-AND-DOCS-BUILDER-LEDGER-MISSING`. The P3 section above preserves the historical gap and records reviewer36 / 审查员三十六号 PASS only for this ledger/docs-only closure slice; global remains PARTIAL.
- Reviewer thirty-three / 审查员三十三号 conclusion: read-only PASS for the current docs-only chain ledger slice, closing reviewer32 historical `reviewer32-current-docs-only-chain-ledger-unverified`. Reviewer32 is no longer a current blocker. This does not close the global release; global remains PARTIAL / 全局仍为 PARTIAL because dirty worktree/staging/user decision/physical real-device hardware remain open.
- Reviewer thirty-four / 审查员三十四号 conclusion: historical PARTIAL only due current docs-only MINIONS ledger gap `executor33-current-docs-only-minions-ledger-not-recorded`; AC-R34-1..AC-R34-4 PASS and AC-R34-5 PARTIAL because the current slice MINIONS ledger was not locally searchable. The reviewer34 repair subsection above now records the 起草员七号 -> 精修员七号 -> 执行员三十三号 -> 审查员三十四号 facts with agent IDs, tool/model/reasoning, lease fields, consumed results, closed prior agents, and the rule that 执行员三十四号 is not self-recorded as closed. Reviewer36 / 审查员三十六号 returned PASS for this ledger/docs-only closure slice only; this is not a global PASS.
- BUILDER12-ORPHAN-LEASE-NOT-RECORDED: Executor twelve / 执行员十二号, role_id=`gai2-builder`, tool name Fermat, agent_id `019f144e-714e-7990-95e2-4072e2ff503c`, was assigned the two evidence documents as the allowlist. Lease/watchdog record: two waits of `300000ms` returned no result; one interrupt requested compact status; a further `60000ms` wait returned no result; `close_agent` was interrupted by the user, so `close_status=unknown`; status is handled as `orphaned_timeout`. Because this was a mandatory builder orphan, the main thread then performed a local fallback documentation record. No stage/commit occurred. 审查员三十八号 / reviewer38 agent_id=`019f153c-9dbe-7b73-a5b8-611da487428f`, tool=`Hypatia`, readonly, closed, returned PASS only for this BUILDER12 historical process-gap closure. This does not convert the orphaned builder into a normal completed builder, does not change the local fallback characterization, and does not grant global PASS; global remains PARTIAL / not global PASS.
- Overall workflow-platform/native goal review remains PARTIAL: dirty-worktree/global release review remains open, the 39 tracked dirty paths are split as 26 release app/test + 3 release support/evidence docs + 8 separate policy/tooling + 2 local noise, the 119 visible candidates are frozen in the release-boundary manifest as a 95 formal + 2 app/test + 22 evidence/archive + 0 other publish/app-test/evidence/user-decision split but are not yet staged/committed/resolved by user decision, and physical real-device hardware coverage is not claimed.
- The release-boundary now contains a Release Decision Packet / 发布决策包 for user approval of staging/commit tradeoffs, but it is not authorization to stage or commit, and global remains PARTIAL.
- Ignore classification decision for this follow-up: only clear not-release local artifacts are ignored (`.stitch/tmp-chrome-*/`, `frontend/system-visual-audit/`, `stitch-output/`, `.superpowers/brainstorm/`, `tmp/`, root/`frontend` one-off PNG captures, selected visual-audit JSON metrics, `flow-definition-console.txt`, and old non-Future-OS `stitch-mcp`/`*-subpage-v1.png` references). Formal Future OS/system-hub publish candidates under `frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/**` remain visible and are validated by `verify:system-hub`; Stitch prompts under `.stitch/prompts/**` remain visible as reproduction evidence; `Notes/**` remains visible because it contains HCL Notes DXL workflow-migration analysis, including `Notes/flows/asset-transfer.md`.
- Visual/screenshot evidence for runtime chart and page quality now has desktop + mobile targeted Playwright artifacts. Cross-browser/device-emulation matrix review is closed by this turn's commands, but the matrix must not claim physical iPhone/iPad hardware PASS because no real device farm was used.
- Frozen router reconciliation remains a narrow accepted exception, not a zero-touch PASS: the frozen-path check currently outputs only `frontend/src/router/index.tsx`, with no mobile/dashboard output. The visible router diff is the `/settings-v2` compatibility redirect to `/settings/:tab`; reviewer three accepted the exception after route-permission/Workbench contract Vitest passed 26 tests and `/settings` browser smoke passed 1 test, but the matrix must not describe router as untouched.
- Broader action-area governance matrix now covers current assignee, observer no-permission/no-current-step, terminal, and failed-service states in executable browser regression attachments; missing-field and any non-targeted matrix variants still need final review.
- P6 asset-retirement remains a post-verification boundary; irreversible retirement writes remain out of scope.

## Current Verdict

PARTIAL.

DB direct-read evidence has been supplemented after the old P0/Phase A baseline by `WorkflowPlatformPersistenceTest`, and blocked-start DB/API/audit/page/E2E evidence is materially stronger. The backend full gap is now PASS evidence with 715 tests passing and `BUILD SUCCESS`, and the full real-backend E2E gap is now PASS evidence with 12 tests passing across the complete real-backend workflow-platform path. The browser-regression gap is also PASS evidence: targeted Future OS workbench, targeted `/settings`, static Future OS HTML inline-script validation, and full browser regression all passed after the `future-settings-os-sla-config.html` script repair. Frontend full Vitest is also PASS evidence with 101 test files and 992 tests passing, the P7 runtime-assignee target passed 6 tests, the runtime-flow target passed 6 tests covering completed/current/upcoming/rejected/cancelled/ended, legend, summary, section anchor, and empty-state behavior, and the P3 `workflowDefinition.test.ts` target passed 16 tests after the normalized self-loop repair. The legacy app workflowDefinition repair target passed 2 files / 27 tests across `frontend/tests/unit/workflowDefinitionValidation.test.ts` and `frontend/src/utils/workflowDefinition.test.ts`. The current frontend build passed with only the existing large chunk warning. The Future OS verifier is now PASS evidence with 44 formal menus and 45 manifest entries. The opt-in cross-browser/device-emulation matrix is now PASS evidence with 20 tests passing across Chromium, Firefox, WebKit, mobile Safari emulation, and tablet Chrome emulation after `collectBrowserErrors` was narrowed to explicit external font/image/resource noise only; physical device hardware is not claimed. Reviewer one returned `PARTIAL` with gap_fingerprint `stale-contract-label-and-unproven-ledger-chain`; after builder six repaired the stale Future OS/browser-contract title, reviewer two returned `PASS` only for that repaired Future OS/browser-contract slice. Global reviewer three returned overall `PARTIAL`, while accepting the specified increment as PASS for backend full, full real-backend E2E, the Future OS route/browser contract, P9-AC6 old-key audit, and no mobile/dashboard scope breach; reviewer four / 审查员四号 returned PASS only for the then-current configured device matrix review before the new opt-in matrix was added; reviewer five / 审查员五号 returned PASS for the latest repair slice and closed `browser-error-filter-doc-source-drift`; reviewer eight / 审查员八号 returned AC-R1..AC-R5 PASS for the release-boundary / Stitch fact-source repair slice and preserved gap_fingerprint `release-boundary-global-open-dirty-whitelist-staging-hardware`; reviewer ten / 审查员十号 returned AC-S1..AC-S6 PASS for the prior recommended staging decision split slice and preserved gap_fingerprint `GLOBAL-PARTIAL-STAGING-DEVICE-EVIDENCE-OPEN`; reviewer fifteen / 审查员十五号 returned PASS and closed `P7-runtime-assignee-scope-router-modified-and-gai2-ledger-unproven`; reviewer seventeen / 审查员十七号 returned historical PARTIAL for the ledger gap `runtime-assignee-6test-minions-ledger-not-evidenced`; reviewer twenty-one / 审查员二十一号 returned historical PARTIAL for `P3-PRECHECK-NORMALIZE-SELF-LOOP-BYPASS-AND-DOCS-BUILDER-LEDGER-MISSING`; reviewer36 / 审查员三十六号 agent_id=`019f152d-65eb-7832-b59c-e01b0f4198c8`, tool=`Sagan`, readonly, closed, returned PASS only for the listed ledger/docs-only closure slices, including the runtime-assignee, runtime-flow chart, runtime-flow docs repair, P3 docs-builder ledger, and executor33 current docs-only MINIONS ledger gaps. Reviewer32's historical current-docs-only gap `reviewer32-current-docs-only-chain-ledger-unverified` is closed by reviewer33 / 审查员三十三号 read-only PASS for the current docs-only chain ledger slice only, not a global PASS. The `/settings-v2` router redirect is accepted only as a narrow compatibility exception to `/settings/:tab`, backed by adjacent route permission/contract tests and `/settings` browser smoke; it is not a router-untouched PASS. The latest scoped frozen probe output remains only `frontend/src/router/index.tsx`; no mobile/dashboard/WorkflowDesigner page modifications came from the legacy app workflowDefinition slice. The overall workflow-platform/native goal still cannot be marked PASS because dirty-worktree/global release review remains open: current tracked dirty count is 39 split as 26 release app/test + 3 release support/evidence docs + 8 separate policy/tooling + 2 local noise + 0 other; current visible untracked paths are 119 and frozen in the release-boundary manifest as futureHtml=44, nativePng=44, icons=6, manifest=1, stitchPrompts=9, notes=12, boundary=1, appTests=2, other=0, but still require staging/commit/user decision and no physical real-device hardware is claimed. The release-boundary contains a Release Decision Packet / 发布决策包 for user approval of staging/commit tradeoffs, but it is not authorization to stage or commit, and global remains PARTIAL / 全局仍为 PARTIAL. This follow-up ignores only clear not-release local artifacts and old non-Future-OS Stitch/MCP references; formal Future OS/system-hub publish candidates, both app/test candidates, Stitch prompts, Notes DXL workflow evidence, and the release-boundary snapshot remain visible under the release-boundary manifest for staging, archive, or cleanup/user decision.
