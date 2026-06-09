#!/bin/sh
set -eu

java_port="${JAVA_PORT:-8081}"

java -jar /app/app.jar --server.port="${java_port}" "$@" &
java_pid="$!"

nginx -g 'daemon off;' &
nginx_pid="$!"

terminate() {
    kill -TERM "${nginx_pid}" "${java_pid}" 2>/dev/null || true
    wait "${nginx_pid}" "${java_pid}" 2>/dev/null || true
}

trap terminate INT TERM

while :; do
    if ! kill -0 "${java_pid}" 2>/dev/null; then
        wait "${java_pid}"
        exit "$?"
    fi

    if ! kill -0 "${nginx_pid}" 2>/dev/null; then
        wait "${nginx_pid}"
        exit "$?"
    fi

    sleep 2
done
