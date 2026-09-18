#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
SERVICE_URL="${PULSAR_SERVICE_URL:-pulsar://127.0.0.1:6650}"
TOPIC="${PULSAR_TOPIC:-persistent://public/default/orders}"

export COMPOSE_PROJECT_NAME=pulsar-lab-standalone
consumer_pid=
cleanup() {
  if [[ -n "$consumer_pid" ]]; then
    kill "$consumer_pid" >/dev/null 2>&1 || true
    wait "$consumer_pid" 2>/dev/null || true
  fi
  docker compose down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for tool in docker mvn java; do
  command -v "$tool" >/dev/null || { printf 'NOT_RUN: missing %s\n' "$tool"; exit 0; }
done

docker compose up -d --wait --wait-timeout 120
mvn -q test
mvn -q -DskipTests package
mvn -q dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
LAB_CP="target/classes:$(<target/classpath.txt)"
PULSAR_INBOX_LEDGER=var/inbox.ledger PULSAR_CONSUMER_SECONDS=30 \
  java -cp "$LAB_CP" com.example.pulsarlab.App consumer "$SERVICE_URL" "$TOPIC" "orders-shared" "Shared" > consumer.log 2>&1 &
consumer_pid=$!
for attempt in {1..100}; do
  grep -q 'READY subscription=' consumer.log && break
  kill -0 "$consumer_pid" || { printf '%s\n' 'FAIL consumer startup'; exit 1; }
  sleep 0.1
done
grep -q 'READY subscription=' consumer.log || { printf '%s\n' 'FAIL readiness timeout'; exit 1; }
java -cp "$LAB_CP" com.example.pulsarlab.App producer "$SERVICE_URL" "$TOPIC"
wait "$consumer_pid"
