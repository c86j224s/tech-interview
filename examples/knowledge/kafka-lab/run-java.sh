#!/bin/sh
set -eu
if [ "$#" -lt 1 ]; then
  printf '%s\n' 'usage: run-java.sh MAIN_CLASS [args...]' >&2
  exit 2
fi
JAVA_BIN=${JAVA_BIN:-java}
exec "$JAVA_BIN" -cp 'build/classes/java/main:build/resources/main:build/install/kafka-lab/lib/*' "$@"
