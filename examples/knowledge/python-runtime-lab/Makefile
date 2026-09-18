PYTHON ?= python3
CC ?= cc
CFLAGS ?= -O2 -Wall -Wextra -Werror
PY_CFLAGS := $(shell $(PYTHON) -c 'import sysconfig; print(sysconfig.get_config_var("CFLAGS") or "")') -I$(shell $(PYTHON) -c 'import sysconfig; print(sysconfig.get_path("include"))')
EXT_SUFFIX := $(shell $(PYTHON) -c 'import sysconfig; print(sysconfig.get_config_var("EXT_SUFFIX") or ".so")')
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  MODULE_LDFLAGS := -bundle -undefined dynamic_lookup
else
  MODULE_LDFLAGS := -shared
endif

.PHONY: test test-python build-extension clean

test: test-python

test-python:
	$(PYTHON) compound_state.py
	$(PYTHON) compound_state.py --safe

build-extension:
	$(CC) $(CFLAGS) $(PY_CFLAGS) -fPIC $(MODULE_LDFLAGS) refsafe.c -o refsafe$(EXT_SUFFIX)
	$(PYTHON) -c 'import refsafe; assert refsafe.get_item_strong({"x": 7}, "x") == 7; assert refsafe.get_item_strong({}, "x") is None; print("refsafe: PASS")'

clean:
	rm -f refsafe*.so refsafe*.dylib refsafe*.bundle
