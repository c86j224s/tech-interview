#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CXX=${CXX:-c++}
CXXFLAGS=${CXXFLAGS:--std=c++17 -Wall -Wextra -Wpedantic -Wconversion -Wshadow -O2}

if [ "$(uname -s)" = Darwin ]; then
  SDK=$(xcrun --show-sdk-path)
  set -- -isysroot "$SDK" -isystem "$SDK/usr/include/c++/v1"
else
  set --
fi
exec "$CXX" "$@" -pthread $CXXFLAGS "$ROOT/main.cpp" -o "$ROOT/ownership-sync-lab"
