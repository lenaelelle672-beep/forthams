#!/bin/sh
set -eu

plugin_root="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-}}"
if [ -z "$plugin_root" ]; then
  script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  plugin_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
fi

json_escape() {
  sed 's/\\/\\\\/g; s/"/\\"/g'
}

emit_message() {
  message=$(printf '%s' "$1" | json_escape)
  printf '{"systemMessage":"%s"}\n' "$message"
}

if ! command -v node >/dev/null 2>&1; then
  emit_message "[gai2-native-guard] Node.js is required to run the hook."
  exit 0
fi

exec node "$plugin_root/hooks/gai2-native-guard.mjs"
