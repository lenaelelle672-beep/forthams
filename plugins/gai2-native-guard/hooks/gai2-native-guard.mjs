#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const DANGEROUS_COMMAND_RULES = [
  {
    id: 'cmd.rm-recursive-force',
    severity: 'critical',
    reason: 'recursive forced deletion is blocked',
    matches: commandHasRmRecursiveForce
  },
  {
    id: 'cmd.git-reset-hard',
    severity: 'critical',
    reason: 'hard repository reset discards local changes',
    pattern: /\bgit\s+reset\b[\s\S]*--hard\b/i
  },
  {
    id: 'cmd.git-clean-force',
    severity: 'high',
    reason: 'forced clean deletes untracked files',
    pattern: /\bgit\s+clean\b(?=[\s\S]*(?:\s-f[a-zA-Z]*\b|--force\b))(?![\s\S]*(?:\s-n\b|--dry-run\b))/i
  },
  {
    id: 'cmd.git-checkout-discard',
    severity: 'high',
    reason: 'checkout path discard can remove working tree changes',
    pattern: /\bgit\s+checkout\b[\s\S]*\s--(?:\s|$)/i
  },
  {
    id: 'cmd.git-restore-worktree',
    severity: 'high',
    reason: 'worktree restore discards local changes',
    pattern: /\bgit\s+restore\b[\s\S]*(?:--worktree\b|\s-W\b)/i
  },
  {
    id: 'cmd.git-push-force',
    severity: 'critical',
    reason: 'forced push rewrites remote history',
    pattern: /\bgit\s+push\b[\s\S]*(?:--force(?:-with-lease)?\b|\s-f\b)/i
  },
  {
    id: 'cmd.docker-system-prune',
    severity: 'high',
    reason: 'container system prune deletes local runtime data',
    pattern: /\bdocker\s+system\s+prune\b/i
  },
  {
    id: 'cmd.kubectl-delete',
    severity: 'high',
    reason: 'cluster delete operation can remove remote resources',
    pattern: /\bkubectl\s+delete\b/i
  }
];

const PROTECTED_PATH_RULES = [
  {
    id: 'path.mobile-frozen',
    severity: 'high',
    category: 'frozen_mobile_scope',
    reason: 'frontend mobile route scope is frozen',
    pattern: /(?:^|[/"'\s])frontend\/src\/pages\/mobile(?:\/|$)/i
  },
  {
    id: 'path.sensitive-env',
    severity: 'critical',
    category: 'sensitive_path',
    reason: 'environment files are sensitive',
    pattern: /(?:^|[/"'\s])\.env(?:[.\w-]*)?(?=$|[/"'\s])/i
  },
  {
    id: 'path.private-key',
    severity: 'critical',
    category: 'sensitive_path',
    reason: 'private key files are sensitive',
    pattern: /(?:^|[/"'\s])(?:id_rsa|id_dsa|id_ecdsa|id_ed25519|.*(?:private[-_]?key|\.pem|\.key))(?=$|[/"'\s])/i
  },
  {
    id: 'path.secret-token-file',
    severity: 'critical',
    category: 'sensitive_path',
    reason: 'secret or token named files are sensitive',
    matches: textHasSensitiveSecretTokenPath
  },
  {
    id: 'path.protected-guidance',
    severity: 'high',
    category: 'protected_guidance',
    reason: 'protected guidance/config edits require explicit write_scope allowlist',
    pattern: /(?:^|[/"'\s])(?:AGENTS\.md|SKILL\.md|references\/[^/"'\s]+\.md|\.codex[^/"'\s]*|\.agents[^/"'\s]*|[^/"'\s]*(?:hooks\.json|plugin\.json))(?=$|[/"'\s])/i
  }
];

const TOOL_ALIASES = new Set([
  'Bash',
  'functions.exec_command',
  'apply_patch',
  'functions.apply_patch',
  'Edit',
  'Write'
]);

const WRITE_TOOL_ALIASES = new Set([
  'apply_patch',
  'functions.apply_patch',
  'Edit',
  'Write'
]);

const SHELL_TOOL_ALIASES = new Set([
  'Bash',
  'functions.exec_command'
]);

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeEvent(payload) {
  return stringValue(payload.hook_event_name) || stringValue(payload.hookEventName) || '';
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function toolInput(payload) {
  const input = payload.tool_input ?? payload.toolInput;
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function getToolName(payload) {
  return stringValue(payload.tool_name) || stringValue(payload.toolName) || 'unknown';
}

function getActionText(payload) {
  const input = toolInput(payload);
  const fields = [
    input.cmd,
    input.command,
    input.patch,
    input.file_path,
    input.path
  ];
  return fields.filter((value) => typeof value === 'string' && value.length > 0).join('\n');
}

function extractCandidatePaths(payload) {
  const input = toolInput(payload);
  const paths = [];
  for (const key of ['file_path', 'path']) {
    if (typeof input[key] === 'string') paths.push(input[key]);
  }
  if (typeof input.patch === 'string') {
    const patchPathRe = /^\*\*\* (?:Add File|Update File|Delete File):\s+(.+)$/gm;
    for (const match of input.patch.matchAll(patchPathRe)) {
      if (match[1]) paths.push(match[1].trim());
    }
    const diffPathRe = /^(?:---|\+\+\+)\s+(?:a\/|b\/)?(.+)$/gm;
    for (const match of input.patch.matchAll(diffPathRe)) {
      if (match[1] && match[1] !== '/dev/null') paths.push(match[1].trim());
    }
  }
  return paths.join('\n');
}

function findViolation(payload) {
  const toolName = getToolName(payload);
  if (!TOOL_ALIASES.has(toolName)) return null;

  const actionText = getActionText(payload);
  const shellTool = SHELL_TOOL_ALIASES.has(toolName);
  if (shellTool) {
    for (const rule of DANGEROUS_COMMAND_RULES) {
      if (ruleMatches(rule, actionText)) {
        return evidence(rule, toolName, actionText, 'command');
      }
    }
  }

  const pathText = [extractCandidatePaths(payload), actionText].filter(Boolean).join('\n');
  const writeIntent = hasWriteIntent(toolName, actionText);
  for (const rule of PROTECTED_PATH_RULES) {
    if (rule.category !== 'sensitive_path' && !writeIntent) continue;
    if (ruleMatches(rule, pathText)) {
      return evidence(rule, toolName, pathText, rule.category);
    }
  }

  return null;
}

function hasWriteIntent(toolName, actionText) {
  if (WRITE_TOOL_ALIASES.has(toolName)) return true;
  if (SHELL_TOOL_ALIASES.has(toolName)) return shellCommandLooksMutating(actionText);
  return false;
}

function shellCommandLooksMutating(command) {
  if (!command.trim()) return false;
  return SHELL_MUTATION_PATTERNS.some((pattern) => pattern.test(command)) || shellCommandHasWriteRedirection(command);
}

const SHELL_MUTATION_PATTERNS = [
  /(?:^|[;&|({]\s*)(?:rm|mv|cp|install|mkdir|rmdir|touch|ln|chmod|chown|chgrp|truncate|dd)\b/i,
  /(?:^|[;&|({]\s*)sed\s+(?:-[^\s]*i[^\s]*|\S+\s+-[^\s]*i[^\s]*)\b/i,
  /(?:^|[;&|({]\s*)perl\s+-[^\s]*i[^\s]*\b/i,
  /(?:^|[;&|({]\s*)python3?\b[\s\S]*\b(?:write_text|write_bytes|open\s*\([^)]*['"](?:a|w|x)\b)/i,
  /(?:^|[;&|({]\s*)(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|upgrade|audit\s+fix)\b/i,
  /(?:^|[;&|({]\s*)git\s+(?:reset|clean|checkout|restore|push|commit|merge|rebase|switch|branch|tag|stash|apply|am)\b/i,
  /(?:^|[;&|({]\s*)(?:docker|kubectl)\s+(?:delete|apply|create|run|start|stop|restart|rm|rmi|compose\s+up|system\s+prune)\b/i,
  /(?:^|[;&|({]\s*)tee\s+(?:-[^\s]+\s+)*\S+/i
];

function ruleMatches(rule, text) {
  if (typeof rule.matches === 'function') return rule.matches(text);
  return rule.pattern.test(text);
}

function commandHasRmRecursiveForce(command) {
  const tokens = shellWords(command);
  for (let index = 0; index < tokens.length; index += 1) {
    if (pathBasename(tokens[index]).toLowerCase() !== 'rm') continue;
    let recursive = false;
    let force = false;
    for (let next = index + 1; next < tokens.length; next += 1) {
      const token = tokens[next];
      if (isShellCommandSeparator(token)) break;
      if (token === '--') break;
      if (token === '--recursive') recursive = true;
      if (token === '--force') force = true;
      if (/^-[^-]/.test(token)) {
        const flags = token.slice(1);
        if (/[rR]/.test(flags)) recursive = true;
        if (/f/.test(flags)) force = true;
      }
      if (recursive && force) return true;
    }
  }
  return false;
}

function shellCommandHasWriteRedirection(command) {
  const tokens = shellWords(command);
  for (let index = 0; index < tokens.length; index += 1) {
    const target = redirectTarget(tokens[index], tokens[index + 1]);
    if (!target) continue;
    if (target.startsWith('&')) continue;
    if (target === '/dev/null') continue;
    return true;
  }
  return false;
}

function redirectTarget(token, nextToken) {
  if (token.startsWith('&>')) return token.slice(2) || nextToken || '';
  const match = token.match(/^(?:\d+)?(?:>>|>\|?|>)(.*)$/);
  if (!match) return '';
  return match[1] || nextToken || '';
}

function textHasSensitiveSecretTokenPath(text) {
  return shellWords(text).some((token) => {
    const basename = pathBasename(token).toLowerCase();
    if (!basename) return false;
    return SENSITIVE_SECRET_TOKEN_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
  });
}

const SENSITIVE_SECRET_TOKEN_BASENAME_PATTERNS = [
  /^\.?(?:secret|token)$/,
  /^secrets?\.(?:json|ya?ml|txt|env|ini|conf|config)$/,
  /^tokens?\.(?:json|ya?ml|txt|env|ini|conf|config)$/,
  /^(?:.*[-_.])secrets?\.(?:json|ya?ml|txt|env|ini|conf|config)$/,
  /^(?:api|access|refresh|auth|id|private)[-_]?token(?:\.(?:json|ya?ml|txt|env|ini|conf|config))?$/
];

function pathBasename(value) {
  const cleaned = value.replace(/^[<>(){},;]+|[<>(){},;]+$/g, '');
  return cleaned.split('/').filter(Boolean).pop() || cleaned;
}

function shellWords(command) {
  const words = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\|\||&&|[;&|()])|(\S+)/g;
  for (const match of command.matchAll(pattern)) {
    words.push(match[1] ?? match[2] ?? match[3] ?? match[4]);
  }
  return words;
}

function isShellCommandSeparator(token) {
  return token === ';' || token === '&&' || token === '||' || token === '|' || token === '(' || token === ')';
}

function evidence(rule, toolName, source, fallbackCategory) {
  return {
    rule_id: rule.id,
    severity: rule.severity,
    tool_name: toolName,
    path_category: rule.category || fallbackCategory || 'command',
    action_hash: hash12(source),
    reason: rule.reason
  };
}

function hash12(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function denyPreTool(violation) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formatReason(violation)
    }
  });
}

function warnPermission(eventName, violation) {
  const message = `${formatReason(violation)}. This hook does not grant permission.`;
  if (eventName === 'PermissionRequest') {
    emit({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
          message
        }
      }
    });
    return;
  }
  emit({
    systemMessage: `${formatReason(violation)}. Side effects may already have happened; this hook cannot undo them.`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: 'GAI2 Native Guard reported post-tool risk feedback only; inspect manually if this action executed.'
    }
  });
}

function formatReason(violation) {
  return [
    '[gai2-native-guard]',
    `rule_id=${violation.rule_id}`,
    `severity=${violation.severity}`,
    `tool_name=${violation.tool_name}`,
    `path_category=${violation.path_category}`,
    `action_hash=${violation.action_hash}`,
    `reason=${violation.reason}`
  ].join(' ');
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function main() {
  const payload = parsePayload(readStdin());
  const eventName = normalizeEvent(payload);
  const violation = findViolation(payload);
  if (!violation) return;

  if (eventName === 'PreToolUse') {
    denyPreTool(violation);
    return;
  }
  if (eventName === 'PermissionRequest' || eventName === 'PostToolUse') {
    warnPermission(eventName, violation);
  }
}

main();
