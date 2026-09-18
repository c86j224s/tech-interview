#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CXX=${CXX:-c++}
SANITIZER=${SANITIZER:-address}
case "$SANITIZER" in
  address) SAN_FLAGS='-fsanitize=address,undefined' ;;
  thread) SAN_FLAGS='-fsanitize=thread' ;;
  *) printf '%s\n' 'SANITIZER must be address or thread' >&2; exit 2 ;;
esac

if [ "$(uname -s)" = Darwin ]; then
  SDK=$(xcrun --show-sdk-path)
  set -- -isysroot "$SDK" -isystem "$SDK/usr/include/c++/v1"
else
  set --
fi
"$CXX" "$@" -pthread -std=c++17 -Wall -Wextra -Wpedantic -Wconversion -Wshadow -O1 -g $SAN_FLAGS \
  "$ROOT/main.cpp" -o "$ROOT/ownership-sync-lab-$SANITIZER"
# Apple Clang's Darwin runtime does not support LeakSanitizer's detect_leaks option.
ASAN_OPTIONS=${ASAN_OPTIONS:-halt_on_error=1} \
TSAN_OPTIONS=${TSAN_OPTIONS:-halt_on_error=1} \
  "$ROOT/ownership-sync-lab-$SANITIZER"
