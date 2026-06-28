# GAI2 Native Guard

Project-level Codex runtime hook plugin for GAI2 guardrails after the Groundwork no-go decision.

This plugin source uses a hook-bearing manifest: `.codex-plugin/plugin.json` contains `"hooks": "./hooks/hooks.json"`. It is still not enabled merely by existing in the repo; it only enters the runtime path after explicit marketplace registration and plugin installation.

Current local status on 2026-06-27: version `0.1.0+codex.20260627043046` is installed, trusted in `/hooks`, and runtime-verified in this Codex environment; machines or threads without the same verification should still treat it as a candidate.

It does not write session artifacts, does not create `.groundwork`, and does not save prompt text, command text, patch text, or secret values.

## Behavior

- `PreToolUse` denies high-risk commands and risky path writes.
- `PermissionRequest` reports warnings and denies permission requests for matched risk; it does not grant permission.
- `PostToolUse` reports warning-only feedback and does not claim rollback or side-effect reversal.
- Normal low-risk commands and patches produce no output.

The hook only emits minimal evidence: `rule_id`, `severity`, `tool_name`, `path_category`, `action_hash`, and a short reason.

## Covered Tools

The hook matcher explicitly covers:

```text
^Bash$|^functions\.exec_command$|^apply_patch$|^functions\.apply_patch$|^Edit$|^Write$
```

## Test

```bash
node plugins/gai2-native-guard/tests/run-hook-tests.mjs
python3 /Users/feigao/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py /Users/feigao/project/Project/forthAMS/plugins/gai2-native-guard
```

The local `validate_plugin.py` script currently rejects hook-bearing manifests because it treats the `hooks` field as an unexpected plugin.json key. Record that failure as a local validator compatibility gap, not as runtime admission failure.

Real admission and enablement must be verified with:

```bash
codex plugin marketplace add /Users/feigao/project/Project/forthAMS
codex plugin add gai2-native-guard@forthams-project
```

After installation, open a new Codex thread and run a runtime interception test that should trigger the guard before treating the plugin as enabled on that machine/thread.

## Project-Level Availability

Runtime discovery depends on the project-level marketplace and plugin installation flow above. This local Codex environment is verified enabled for version `0.1.0+codex.20260627043046`; unverified machines or threads should continue to treat the plugin as a hook-bearing candidate.

Do not copy this plugin into `~/.codex`, `~/.agents`, shell profiles, Homebrew, npm global locations, or global Codex config as part of this source drop.

## Disable

If installed, disable it through the Codex plugin UI or remove the project marketplace entry. Removing `plugins/gai2-native-guard` and its marketplace entry removes the candidate plugin source.

## Known Limits

- The hook cannot know whether the user granted an explicit GAI2 write scope in conversation, so protected guidance/config writes are conservatively denied.
- `PermissionRequest` and `PostToolUse` are warning/reporting phases; they cannot undo side effects.
- Matching is string-based over hook payload fields and patch headers, not a full shell or diff parser.
