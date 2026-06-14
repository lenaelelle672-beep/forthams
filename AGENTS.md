<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **forthams** (44377 symbols, 73155 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/forthams/context` | Codebase overview, check index freshness |
| `gitnexus://repo/forthams/clusters` | All functional areas |
| `gitnexus://repo/forthams/processes` | All execution flows |
| `gitnexus://repo/forthams/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- gai2:start -->
# GAI2 Goal Execution — forthAMS

When the active Codex goal/objective for this repository mentions **GAI2**, **gai2**, **$gai**, **/gai**, **/gai2**, **蜂群**, **swarm**, **subagent**, **子 agent**, or **multi-agent**, the agent MUST execute the `/Users/feigao/.codex/skills/gai/SKILL.md` workflow before ordinary project work.

## Required Boot Sequence

- Announce `GAI2 Continuation Boot` in the next user-visible update.
- Read the `gai` skill completely; for Medium, Heavy, Strategic, ambiguous, or cross-module work, also read `references/directive-flow.md`; before closeout, read `references/closeout-template.md`.
- Do not shrink the native goal. Restate the objective as the active directive and keep the goal active unless every requirement is evidenced.
- State current truth vs required change before edits.
- Create or refresh a compact GAI workcard with classification, phase, write scope, allowed paths, research decision, delegation, acceptance checks, evidence to collect, and open risks.
- Establish `gai2-orchestrator` as the active scheduler for Medium+ work. In Codex this is normally the main thread; if a separate orchestrator subagent is useful and supported, say so before spawning it.
- Keep the original Opencode GAI2 role names visible when relevant: `gai2`, `gai2-orchestrator`, `gai2-triage`, `gai2-research`, `gai2-audit`, `gai2-debate`, `gai2-drafter`, `gai2-refiner`, `gai2-builder`, and `gai2-reviewer`.
- Let `gai2-orchestrator` decide whether research is required/useful/skipped. Use `gai2-research` for external, latest, community, upstream, official-doc, paper, model/tool routing, or unstable facts; record source budget or skip reason and map research evidence in closeout.
- Before landing any change to GAI2 orchestration, model routing, swarm behavior, subagent policy, or role artifacts, research current mature external projects and local Opencode behavior first; record `borrow/adapt/reject`, selected orchestration pattern, and source date before edits.
- Use GAI2 swarm orchestration when useful: sidecar explorers/reviewers for independent fact checks, risk audits, and completion reviews; workers only for disjoint allowlisted edits.
- Apply the forthAMS subagent routing design in `docs/gai2-subagent-routing-design.md` for model, reasoning, concurrency, fork_context, and close-agent policy.
- In Chinese GAI2 runs, assign every subagent a Chinese alias at spawn time. Tool nicknames may appear only as technical notes; subagent prompts must start with a short identity header: role id, Chinese alias, one-sentence duty, write boundary, and a first-line output requirement using the Chinese alias.
- Close every subagent after its result has been consumed.
- Do not copy raw secrets/API keys/tokens/passwords from configs, logs, command output, Opencode files, or tool traces into conversation, docs, commits, or subagent prompts. Summarize with redaction status instead.
- Keep `frontend/src/pages/mobile/**` and mobile route work frozen until the user explicitly reopens mobile scope.

## Closeout

- End Medium+ turns with a GAI-style verdict: `PASS`, `PARTIAL`, or `FAIL`.
- Map acceptance checks to concrete evidence.
- Include research evidence, pattern selection, policy state, gap history, write-scope check, subagent ledger check, and tool-trace redaction status when applicable.
- If the overall goal is not fully proven, report `PARTIAL` for the increment and leave the native goal active.

<!-- gai2:end -->
