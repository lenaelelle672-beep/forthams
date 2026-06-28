# GAI2 Native Guard

## Purpose

`plugins/gai2-native-guard` is a project-level Codex runtime hook plugin that fills the GAI2 hard-intercept gap after the Groundwork no-go result. It is designed to block obvious high-risk tool calls before execution while preserving GAI2's native review, write-scope, and closeout process. Treat it as a candidate in any machine/thread that has not completed local install, trust, and runtime verification.

The plugin uses a hook-bearing manifest: `plugins/gai2-native-guard/.codex-plugin/plugin.json` contains `"hooks": "./hooks/hooks.json"` and advertises `Instructions` plus `Lifecycle hooks`. It is not installed globally or enabled by default on other machines/threads that have not completed the verification below, and does not create long-lived session artifacts.

## Boundary

- Project source lives under `plugins/gai2-native-guard`.
- Optional project marketplace entry lives at `.agents/plugins/marketplace.json`.
- No writes to `~/.codex`, `~/.agents`, global Codex config, shell profiles, Homebrew, npm global installs, or application business code.
- The hook never saves prompt text, command text, patch text, or secret/token values.

Allowed output evidence is limited to `rule_id`, `severity`, `tool_name`, `path_category`, `action_hash`, and a short reason.

## Hook Coverage

The hook config covers `PreToolUse`, `PermissionRequest`, and `PostToolUse` with timeout `10`.

Matcher:

```text
^Bash$|^functions\.exec_command$|^apply_patch$|^functions\.apply_patch$|^Edit$|^Write$
```

`PreToolUse` denies:

- destructive commands such as `rm -rf`, path-qualified `rm` (`/bin/rm -rf`), split recursive/force `rm` flags (`rm -r -f`, `rm --recursive -f`, `rm -r --force`), `git reset --hard`, `git clean -f`, `git checkout --`, `git restore --worktree`, `git push --force`, `docker system prune`, and `kubectl delete`;
- sensitive path access or writes, including `.env*`, private key files, and credential-like secret/token file basenames such as `.token`, `.secret`, `secret.txt`, `secrets.json`, `token.txt`, `token.json`, `tokens.yml`, `api-token`, and `refresh-token.json`;
- protected guidance/config write or change intent such as edits to `AGENTS.md`, `SKILL.md`, `references/*.md`, `.codex*`, `.agents*`, and hook/plugin config;
- write or change intent under `frontend/src/pages/mobile/**`.

For protected guidance/config and frozen mobile paths, read-only shell commands are allowed. Examples such as `sed -n ... SKILL.md`, `cat AGENTS.md`, and `rg pattern references/foo.md` should not be denied solely because they read protected guidance. Stderr or stdout redirection to `/dev/null` is not treated as protected-guidance write intent, so `rg pattern .../SKILL.md 2>/dev/null` remains allowed. Shell commands that look like they mutate files or state, including stdout/append redirection to real files, `sed -i`, file operations, package installs, destructive git operations, or container/cluster mutations, are treated as write/change intent. `apply_patch`, `functions.apply_patch`, `Edit`, and `Write` are always treated as write intent.

Secret/token path matching is intentionally basename-oriented. It blocks credential-like names and extensions but does not block ordinary read-only source files just because a filename contains a token-related substring, such as `src/tokenizer.ts` or `src/auth-token-utils.ts`.

`PermissionRequest` and `PostToolUse` only report warning/system messages. They do not grant permission and do not claim to roll back side effects.

## Test

Run:

```bash
node plugins/gai2-native-guard/tests/run-hook-tests.mjs
python3 /Users/feigao/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py /Users/feigao/project/Project/forthAMS/plugins/gai2-native-guard
```

The hook test uses synthetic payloads for `functions.exec_command`, `Bash`, and `functions.apply_patch`, verifies denial behavior, verifies fake-secret redaction, and verifies that `.groundwork` is not created.

The local `validate_plugin.py` script currently rejects hook-bearing manifests because it treats the `hooks` field as an unexpected plugin.json key. Record that as a validator compatibility gap between the local script and hook plugin manifests; do not treat it as runtime failure.

## Project-Level Install/Enable

Runtime admission and enablement must be verified with:

```bash
codex plugin marketplace add /Users/feigao/project/Project/forthAMS
codex plugin add gai2-native-guard@forthams-project
```

After installation, start a new Codex thread and run a runtime interception test that should trigger the guard. On machines/threads that have not completed the current-local verification below, keep treating the plugin as a hook-bearing candidate and do not describe it as proven enabled.

Installed/enabled status is not the same as hook trust. After installing the plugin, open Codex `/hooks`, make sure the `gai2-native-guard` hook is visible, and explicitly trust it there. In Codex Desktop, a full app restart or a new thread may be required before the hook appears. Treat installed/enabled without `/hooks` trust as insufficient runtime coverage.

## Current Local Verification / 当前本机验证

Status as of 2026-06-27: this local Codex environment has installed and trusted `gai2-native-guard` version `0.1.0+codex.20260627043046`.

- `hooks/list` showed all three `gai2-native-guard@forthams-project` hooks with `enabled=true` and `trustStatus=trusted`; their `sourcePath` and `command` point at the new cached version.
- Runtime `codex exec --ephemeral` verification blocked recursive force removal, including split flags, with `rule_id=cmd.rm-recursive-force`.
- Runtime verification allowed protected-guidance read/search commands that do not express write intent, including the tested `rg "__gai2_guard_no_match__" /Users/feigao/.codex/skills/gai/SKILL.md 2>/dev/null || true`.
- Runtime verification allowed ordinary source reads that merely contain a token-related substring, including the tested `cat src/tokenizer.ts 2>/dev/null || true`.
- Runtime verification blocked credential-like secret/token path access for `cat token.txt` with `rule_id=path.secret-token-file`.

This local result does not automatically prove enablement in other Codex machines, caches, or threads. In any machine/thread where this section's install, trust, and runtime checks have not been completed, continue to treat the plugin as a candidate until verified there.

## Disable

If enabled, disable it from the Codex plugin UI or remove the project marketplace entry. Removing `plugins/gai2-native-guard` and the marketplace entry removes the candidate plugin source.

## Known Limitations

- The hook cannot inspect conversational authorization, so protected guidance/config and frozen mobile writes are conservatively denied until a future payload carries explicit write-scope/allowlist metadata.
- Matching is intentionally small and string-based. It is not a complete shell parser or diff parser.
- `PermissionRequest` and `PostToolUse` are not rollback mechanisms.
- The plugin is a GAI2-native guard direction, not a Groundwork runtime replacement and not a global Codex policy layer.
