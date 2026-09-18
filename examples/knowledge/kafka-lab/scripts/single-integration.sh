#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
GRADLE=${GRADLE:-gradle}
export COMPOSE_PROJECT_NAME="kafka-lab-$(date +%s)-$$"
INBOX_FILE=".lab-inbox/$COMPOSE_PROJECT_NAME/events.log"
mkdir -p "$(dirname "$INBOX_FILE")"
cleanup() { docker compose -f compose.yaml down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose -f compose.yaml up -d --wait --wait-timeout 120
$GRADLE runAdmin
$GRADLE runProducer --args='6'
INBOX_FILE="$INBOX_FILE" MAX_RECORDS=6 $GRADLE run
