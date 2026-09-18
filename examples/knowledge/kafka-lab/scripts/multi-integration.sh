#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
COMPOSE=${COMPOSE:-docker compose}
GRADLE=${GRADLE:-gradle}
JAVA_BIN=${JAVA_BIN:-java}
export COMPOSE_PROJECT_NAME="kafka-lab-$(date +%s)-$$"
INBOX_FILE=".lab-inbox/$COMPOSE_PROJECT_NAME/events.log"
export INBOX_FILE
BOOTSTRAP=${MULTI_BOOTSTRAP:-localhost:29092,localhost:39092,localhost:49092}
mkdir -p "$(dirname "$INBOX_FILE")"

cleanup() { $COMPOSE -f compose.multi.yaml down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "${SKIP_MULTI_UP:-0}" != 1 ]; then
  $COMPOSE -f compose.multi.yaml up -d --wait --wait-timeout 120
fi
$COMPOSE -f compose.multi.yaml exec -T kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --if-not-exists --topic lab-events --partitions 1 --replication-factor 3 --config min.insync.replicas=2
python3 tests/poll_replication.py .lab-inbox/topic.txt 3 3 --file compose.multi.yaml --service kafka-1
$GRADLE installDist
CP="build/install/kafka-lab/lib/*"
KAFKA_BOOTSTRAP="$BOOTSTRAP" "$JAVA_BIN" -cp "$CP" lab.kafka.ProducerMain 6
set +e
KAFKA_BOOTSTRAP="$BOOTSTRAP" INBOX_FILE="$INBOX_FILE" STOP_AFTER_EVENT_ID=evt-2 KILL_BEFORE_COMMIT=true MAX_RECORDS=3 "$JAVA_BIN" -cp "$CP" lab.kafka.InboxWorker > .lab-inbox/consumer-kill.log 2>&1
status=$?
set -e
test "$status" -eq 42
python3 tests/assert_consumer.py .lab-inbox/consumer-kill.log killed
test "$(python3 tests/count_inbox.py "$INBOX_FILE")" -eq 3
KAFKA_BOOTSTRAP="$BOOTSTRAP" INBOX_FILE="$INBOX_FILE" MAX_RECORDS=6 "$JAVA_BIN" -cp "$CP" lab.kafka.InboxWorker > .lab-inbox/consumer-restart.log 2>&1
python3 tests/assert_consumer.py .lab-inbox/consumer-restart.log restarted
KAFKA_BOOTSTRAP="$BOOTSTRAP" "$JAVA_BIN" -cp "$CP" lab.kafka.OffsetAdmin > .lab-inbox/group-offset.log
python3 tests/assert_offset.py .lab-inbox/group-offset.log 6
python3 tests/assert_inbox.py "$INBOX_FILE" 6
