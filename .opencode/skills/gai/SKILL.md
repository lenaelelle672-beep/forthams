# Skill: gai

# GAI

GAI is the explicit directive workflow for this project.

It provides a practical, audit-first workflow for requests that need more structure than ad-hoc execution without forcing a heavyweight process for every change.

## When to Use

Use this skill when:

- the user types `/gai ...`
- the user says "run GAI"
- the user explicitly asks to use the GAI workflow
- the task benefits from directive-style execution, clearer planning, and evidence-backed closure

## Directive Flow

### 1. Triage

Classify the directive using the lightest flow that preserves correctness:

- **Light** — tiny change, low ambiguity
- **Medium** — multi-step feature or bugfix
- **Heavy** — cross-module work, higher review needs, architecture risk
- **Strategic** — broad refactor or system-level decision

Recommended routing:

- **Light**: Triage → Audit → Execute → Closeout
- **Medium**: Triage → Audit → Debate-Lite → Execute → Review → Closeout
- **Heavy / Strategic**: Triage → Audit → Debate-Lite → Workcard → Execute → Review → Closeout

### 2. Audit First

Before implementation on medium+ work:

- inspect current files and context
- identify existing patterns
- note constraints and risks
- distinguish current truth from the requested change

Do not jump straight from directive to edits on medium+ work.

### 3. Debate-Lite

When meaningful choices exist, compare 2-3 approaches briefly:

- option
- tradeoff
- chosen direction and why

Avoid fake roleplay. The purpose is better decisions.

### 4. Workcard

Create a lightweight workcard in the active context or todo flow.

Minimum fields:

- **Directive**
- **Owner**
- **Phase**
- **Acceptance checks**
- **Evidence to collect**
- **Open risks**

### 5. Execute

- follow existing project patterns
- use repository tools and agents when helpful
- keep progress updates concrete
- verify along the way, not only at the end
- avoid broad runtime changes unless the directive explicitly requires them

### 6. Closeout

A GAI closeout should include:

1. directive summary
2. affected scope/files
3. commands or checks run and outcomes
4. requirement/acceptance status
5. residual risks or explicit none

## Clarification Rule

Ask questions only when blocked by a real missing decision.

If there is a sensible default, choose it, state the assumption, and proceed.

## Red Flags

Never:

- treat `/gai` as cosmetic wording only
- skip audit on medium+ work
- force heavyweight process on trivial edits
- claim closure without evidence
- add a same-named command template that shadows this skill unless explicitly required

## Bottom Line

GAI gives this project an explicit directive mode:

- better structured than normal chat
- lighter than a rigid large-process pipeline
- aligned with practical execution
- versioned with the repository instead of relying on a user-global skill
