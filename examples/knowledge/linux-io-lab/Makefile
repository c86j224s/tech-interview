CC ?= cc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra -Wpedantic
LDFLAGS ?=

.PHONY: all clean test
all: epoll_echo uring_echo test_client

epoll_echo: epoll_echo.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

uring_echo: uring_echo.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $< -luring

test_client: test_client.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

test: all
	@./run-local.sh

clean:
	rm -f epoll_echo uring_echo test_client epoll-echo.log uring-echo.log
