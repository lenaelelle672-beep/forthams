#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(__filename), '..');
const hookPath = path.join(pluginRoot, 'hooks', 'gai2-native-guard.mjs');
const fakeSecret = ['FAKE', 'SECRET', 'DO', 'NOT', 'USE', '123'].join('_');

function runHook(payload) {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: pluginRoot
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(fakeSecret));
  assert.doesNotMatch(result.stderr, new RegExp(fakeSecret));
  const output = result.stdout.trim() ? JSON.parse(result.stdout.trim()) : {};
  return { ...result, output };
}

function pretool(toolName, toolInput) {
  return {
    hook_event_name: 'PreToolUse',
    session_id: 'synthetic-session',
    cwd: pluginRoot,
    tool_name: toolName,
    tool_input: toolInput
  };
}

function isDenied(output) {
  return output?.hookSpecificOutput?.permissionDecision === 'deny';
}

const execDanger = runHook(pretool('functions.exec_command', { cmd: 'git reset --hard HEAD' }));
assert.equal(isDenied(execDanger.output), true, 'functions.exec_command dangerous command should deny');
assert.match(execDanger.stdout, /rule_id=cmd\.git-reset-hard/);
assert.doesNotMatch(execDanger.stdout, /git reset --hard/);

const bashDanger = runHook(pretool('Bash', { command: 'rm -rf ./build-cache' }));
assert.equal(isDenied(bashDanger.output), true, 'Bash dangerous command should deny');
assert.match(bashDanger.stdout, /rule_id=cmd\.rm-recursive-force/);
assert.doesNotMatch(bashDanger.stdout, /rm -rf/);

for (const command of [
  'rm -fr ./build-cache',
  'rm -r -f ./build-cache',
  'rm -f -r ./build-cache',
  'rm --recursive -f ./build-cache',
  'rm -r --force ./build-cache',
  '/bin/rm -rf ./build-cache',
  '/usr/bin/rm -r -f ./build-cache'
]) {
  const rmSplitFlags = runHook(pretool('functions.exec_command', { cmd: command }));
  assert.equal(isDenied(rmSplitFlags.output), true, `${command} should deny`);
  assert.match(rmSplitFlags.stdout, /rule_id=cmd\.rm-recursive-force/);
}

const quotedRm = runHook(pretool('functions.exec_command', { cmd: 'echo "rm -rf ./build-cache"' }));
assert.equal(isDenied(quotedRm.output), false, 'quoted rm text should not deny');
assert.equal(quotedRm.stdout.trim(), '', 'quoted rm text should not need output');

const envPatch = runHook(pretool('functions.apply_patch', {
  patch: '*** Begin Patch\n*** Add File: .env.local\n+TOKEN=redacted\n*** End Patch\n'
}));
assert.equal(isDenied(envPatch.output), true, 'patch modifying .env should deny');
assert.match(envPatch.stdout, /path_category=sensitive_path/);

const agentsPatch = runHook(pretool('functions.apply_patch', {
  patch: '*** Begin Patch\n*** Update File: AGENTS.md\n@@\n-old\n+new\n*** End Patch\n'
}));
assert.equal(isDenied(agentsPatch.output), true, 'patch modifying AGENTS.md should deny');
assert.match(agentsPatch.stdout, /path_category=protected_guidance/);

const readonlySkill = runHook(pretool('functions.exec_command', {
  cmd: "sed -n '1,20p' /Users/feigao/.codex/skills/gai/SKILL.md"
}));
assert.equal(isDenied(readonlySkill.output), false, 'readonly sed of SKILL.md should not deny');
assert.equal(readonlySkill.stdout.trim(), '', 'readonly sed should not need output');

const readonlyAgents = runHook(pretool('functions.exec_command', { cmd: 'cat AGENTS.md' }));
assert.equal(isDenied(readonlyAgents.output), false, 'readonly cat of AGENTS.md should not deny');
assert.equal(readonlyAgents.stdout.trim(), '', 'readonly cat should not need output');

const readonlyReference = runHook(pretool('functions.exec_command', {
  cmd: 'rg pattern references/foo.md'
}));
assert.equal(isDenied(readonlyReference.output), false, 'readonly rg of references/*.md should not deny');
assert.equal(readonlyReference.stdout.trim(), '', 'readonly rg should not need output');

const readonlySkillWithStderrNull = runHook(pretool('functions.exec_command', {
  cmd: 'rg pattern /Users/feigao/.codex/skills/gai/SKILL.md 2>/dev/null'
}));
assert.equal(isDenied(readonlySkillWithStderrNull.output), false, 'stderr-to-null while reading SKILL.md should not deny');
assert.equal(readonlySkillWithStderrNull.stdout.trim(), '', 'stderr-to-null readonly command should not need output');

const sensitiveRead = runHook(pretool('functions.exec_command', { cmd: 'cat .env.local' }));
assert.equal(isDenied(sensitiveRead.output), true, 'sensitive path read should deny');
assert.match(sensitiveRead.stdout, /path_category=sensitive_path/);

for (const command of [
  'cat src/tokenizer.ts',
  "sed -n '1p' src/auth-token-utils.ts"
]) {
  const ordinarySourceRead = runHook(pretool('functions.exec_command', { cmd: command }));
  assert.equal(isDenied(ordinarySourceRead.output), false, `${command} should not deny`);
  assert.equal(ordinarySourceRead.stdout.trim(), '', `${command} should not need output`);
}

for (const command of ['cat secrets.json', 'cat .token', 'cat api-token', 'cat token.txt', 'cat token.json', 'cat tokens.yml']) {
  const credentialRead = runHook(pretool('functions.exec_command', { cmd: command }));
  assert.equal(isDenied(credentialRead.output), true, `${command} should deny`);
  assert.match(credentialRead.stdout, /path_category=sensitive_path/);
}

const shellGuidanceWrite = runHook(pretool('functions.exec_command', {
  cmd: 'printf x >> AGENTS.md'
}));
assert.equal(isDenied(shellGuidanceWrite.output), true, 'shell write to AGENTS.md should deny');
assert.match(shellGuidanceWrite.stdout, /path_category=protected_guidance/);

const shellSkillEdit = runHook(pretool('functions.exec_command', {
  cmd: "sed -i '' 's/a/b/' /Users/feigao/.codex/skills/gai/SKILL.md"
}));
assert.equal(isDenied(shellSkillEdit.output), true, 'shell sed -i to SKILL.md should deny');
assert.match(shellSkillEdit.stdout, /path_category=protected_guidance/);

const safeCommand = runHook(pretool('functions.exec_command', { cmd: 'printf synthetic-safe' }));
assert.equal(isDenied(safeCommand.output), false, 'safe command should not deny');
assert.equal(safeCommand.stdout.trim(), '', 'safe command should not need output');

const secretPayload = runHook(pretool('functions.exec_command', {
  cmd: `printf ${fakeSecret} && git push --force origin main`
}));
assert.equal(isDenied(secretPayload.output), true, 'dangerous command with fake secret should deny');
assert.doesNotMatch(secretPayload.stdout, new RegExp(fakeSecret));
assert.doesNotMatch(secretPayload.stderr, new RegExp(fakeSecret));

const permissionWarning = runHook({
  hookEventName: 'PermissionRequest',
  toolName: 'functions.exec_command',
  toolInput: { cmd: 'docker system prune -af' }
});
assert.notEqual(permissionWarning.output?.hookSpecificOutput?.decision?.behavior, 'allow');
assert.match(permissionWarning.stdout, /does not grant permission/);
assert.doesNotMatch(permissionWarning.stdout, /docker system prune/);

const postWarning = runHook({
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'kubectl delete namespace prod' }
});
assert.match(postWarning.stdout, /cannot undo/);
assert.doesNotMatch(postWarning.stdout, /kubectl delete namespace prod/);

assert.equal(hasGroundworkDir(pluginRoot), false, 'hook must not create .groundwork');
assert.equal(scanFilesForExactSecret(pluginRoot, fakeSecret), false, 'plugin files must not contain fake secret marker');

console.log('gai2-native-guard hook tests passed');

function hasGroundworkDir(root) {
  return walk(root).some((filePath) => path.basename(filePath) === '.groundwork');
}

function scanFilesForExactSecret(root, marker) {
  return walk(root)
    .filter((filePath) => statSync(filePath).isFile())
    .some((filePath) => {
      const content = readFileSync(filePath, 'utf8');
      return content.includes(marker);
    });
}

function walk(root) {
  const entries = [];
  for (const name of readdirSync(root)) {
    const next = path.join(root, name);
    entries.push(next);
    if (statSync(next).isDirectory()) entries.push(...walk(next));
  }
  return entries;
}
