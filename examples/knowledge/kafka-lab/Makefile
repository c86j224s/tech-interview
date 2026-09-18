.PHONY: test compile broker-up broker-down integration multi-up multi-down multi-integration multi-failure python-test

GRADLE ?= gradle
COMPOSE ?= docker compose
BASH ?= bash

# No .ONESHELL: this package supports Apple make 3.81.
test:
	command -v $(firstword $(GRADLE)) >/dev/null 2>&1 || test -x "$(firstword $(GRADLE))" || { printf '%s\n' 'Gradle command not found: set GRADLE=gradle or provide ./gradlew' >&2; exit 1; }
	$(GRADLE) test

compile:
	command -v $(firstword $(GRADLE)) >/dev/null 2>&1 || test -x "$(firstword $(GRADLE))" || { printf '%s\n' 'Gradle command not found: set GRADLE=gradle or provide ./gradlew' >&2; exit 1; }
	$(GRADLE) compileJava

python-test:
	python3 tests/test_checkpoint.py

broker-up:
	$(COMPOSE) -f compose.yaml up -d --wait broker

broker-down:
	$(COMPOSE) -f compose.yaml down --volumes --remove-orphans

integration:
	$(BASH) scripts/single-integration.sh

multi-up:
	$(COMPOSE) -f compose.multi.yaml up -d --wait

multi-down:
	$(COMPOSE) -f compose.multi.yaml down --volumes --remove-orphans

multi-integration:
	$(BASH) scripts/multi-integration.sh

multi-failure:
	$(BASH) scripts/multi-failure.sh
