#!/bin/sh
set -eu

case "$(uname -s)" in
  Linux)
    if command -v docker >/dev/null 2>&1 && command -v gradle >/dev/null 2>&1; then
      exec gradle test
    fi
    printf '%s\n' 'NOT_RUN: Linux requires Docker and Gradle; run make test or make integration.'
    exit 77
    ;;
  *)
    printf '%s\n' 'NOT_RUN: broker integration requires Docker and this script does not simulate Kafka on this host.'
    printf '%s\n' 'On a permitted host: make test && make integration'
    exit 77
    ;;
esac
