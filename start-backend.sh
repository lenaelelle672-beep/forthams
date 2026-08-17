#!/bin/bash

set -euo pipefail

require_env() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        printf '%s\n' "缺少必需环境变量: ${name}" >&2
        exit 1
    fi
}

require_env DB_URL
require_env DB_USERNAME
require_env DB_PASSWORD
require_env JWT_SECRET

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$script_dir/backend"

exec mvn spring-boot:run
