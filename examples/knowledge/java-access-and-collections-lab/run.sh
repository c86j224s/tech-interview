#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT="$ROOT/build/classes"
rm -rf "$ROOT/build"
mkdir -p "$OUT"
if ! command -v javac >/dev/null 2>&1 || ! command -v java >/dev/null 2>&1; then
  printf '%s\n' 'NOT_RUN: Java tools are unavailable in this environment'
  exit 0
fi
javac_ok=0
java_ok=0
if javac -version >"$ROOT/build/javac-version.txt" 2>&1; then
  javac_ok=1
fi
if java -version >"$ROOT/build/java-version.txt" 2>&1; then
  java_ok=1
fi
if [ "$javac_ok" -ne 1 ] || [ "$java_ok" -ne 1 ]; then
  printf '%s\n' 'NOT_RUN: Java tools cannot start a Java runtime in this environment'
  exit 0
fi
printf 'javac: '
awk 'NR == 1 {print $2; exit}' "$ROOT/build/javac-version.txt"

mkdir -p "$OUT/access"
javac -d "$OUT/access" "$ROOT/access/src/base/Base.java" "$ROOT/access/src/base/PackageOnly.java" "$ROOT/access/src/client/Sub.java" "$ROOT/access/src/client/AccessPass.java" "$ROOT/access/src/nest/PrivateNest.java"
java -cp "$OUT/access" client.AccessPass
javac -d "$OUT/access" "$ROOT/access/src/base/PublicChild.java" "$ROOT/access/src/client/InheritedAccess.java"
java -cp "$OUT/access" client.InheritedAccess

if javac -d "$OUT/access-bad-protected" "$ROOT/access/src/base/Base.java" "$ROOT/access/src/client/BadProtectedQualifier.java" >"$ROOT/build/bad-protected.out" 2>&1; then
  printf '%s\n' 'FAIL: protected qualifier unexpectedly compiled'
  exit 1
fi
printf '%s\n' 'PASS: protected Base qualifier rejected'

if javac -d "$OUT/access-bad-package" "$ROOT/access/src/base/PackageOnly.java" "$ROOT/access/src/client/BadPackageAccess.java" >"$ROOT/build/bad-package.out" 2>&1; then
  printf '%s\n' 'FAIL: package-private type unexpectedly compiled'
  exit 1
fi
printf '%s\n' 'PASS: package-private top-level type rejected'

if javac -d "$OUT/access-bad-private" "$ROOT/access/src/nest/PrivateNest.java" "$ROOT/access/src/nest/BadPrivateAccess.java" >"$ROOT/build/bad-private.out" 2>&1; then
  printf '%s\n' 'FAIL: private access unexpectedly compiled'
  exit 1
fi
printf '%s\n' 'PASS: private access outside nest rejected'

mkdir -p "$OUT/modules/provider"
javac -d "$OUT/modules/provider" "$ROOT/modules/provider/module-info.java" "$ROOT/modules/provider/api/PublicApi.java" "$ROOT/modules/provider/internal/InternalApi.java"
mkdir -p "$OUT/modules/consumer"
javac --module-path "$OUT/modules/provider" -d "$OUT/modules/consumer" "$ROOT/modules/consumer/module-info.java" "$ROOT/modules/consumer/app/Main.java"
java --module-path "$OUT/modules/provider:$OUT/modules/consumer" -m consumer/app.Main
if javac --module-path "$OUT/modules/provider" -d "$OUT/modules/consumer-bad" "$ROOT/modules/consumer/module-info.java" "$ROOT/modules/consumer/app/BadMain.java" >"$ROOT/build/bad-module.out" 2>&1; then
  printf '%s\n' 'FAIL: non-exported module package unexpectedly compiled'
  exit 1
fi
printf '%s\n' 'PASS: non-exported module package rejected'

javac -d "$OUT/final-good" "$ROOT/final/src/FinalRules.java"
java -cp "$OUT/final-good" FinalRules
if javac -d "$OUT/final-bad-class" "$ROOT/final/src/FinalRules.java" "$ROOT/final/src/BadFinalClass.java" >"$ROOT/build/bad-final-class.out" 2>&1; then
  printf '%s\n' 'FAIL: final class unexpectedly extended'
  exit 1
fi
printf '%s\n' 'PASS: final class extension rejected'
if javac -d "$OUT/final-bad-method" "$ROOT/final/src/FinalMethodParent.java" "$ROOT/final/src/BadFinalMethod.java" >"$ROOT/build/bad-final-method.out" 2>&1; then
  printf '%s\n' 'FAIL: final method unexpectedly overridden'
  exit 1
fi
printf '%s\n' 'PASS: final method override rejected'

javac -d "$OUT/collections" "$ROOT/collections/src/LegacyCollectionChecks.java"
java -cp "$OUT/collections" LegacyCollectionChecks

# opens affects deep reflection, not ordinary source imports.
javac --module-path "$OUT/modules/provider" -d "$OUT/modules/consumer" "$ROOT/modules/consumer/module-info.java" "$ROOT/modules/consumer/app/ReflectionCheck.java"
java --module-path "$OUT/modules/provider:$OUT/modules/consumer" -m consumer/app.ReflectionCheck false
java --add-opens provider/provider.internal=consumer --module-path "$OUT/modules/provider:$OUT/modules/consumer" -m consumer/app.ReflectionCheck true
