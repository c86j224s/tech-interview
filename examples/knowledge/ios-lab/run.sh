#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BUILD="$ROOT/build"
mkdir -p "$BUILD"
RUN_DIR=$(mktemp -d "$BUILD/run.XXXXXX")
cleanup() {
    rm -rf "$RUN_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

swiftc "$ROOT/SwiftInitializationARC.swift" -o "$RUN_DIR/swift-arc"
"$RUN_DIR/swift-arc"

swiftc "$ROOT/PropertyListSQLite.swift" -o "$RUN_DIR/property-list-sqlite"
( cd "$RUN_DIR" && ./property-list-sqlite )

clang -fobjc-arc -framework Foundation "$ROOT/ObjectiveCOwnership.m" -o "$RUN_DIR/objectivec-ownership"
"$RUN_DIR/objectivec-ownership"

swiftc "$ROOT/AutoLayoutConflict.swift" -o "$RUN_DIR/auto-layout-conflict"
"$RUN_DIR/auto-layout-conflict"

swiftc "$ROOT/CoreDataMigration.swift" -o "$RUN_DIR/coredata-migration"
( cd "$RUN_DIR" && ./coredata-migration )
