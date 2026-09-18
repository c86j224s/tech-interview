#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define PAYLOAD_SIZE 1500
#define IO_TIMEOUT_MS 3000

static int wait_fd(int fd, short events) {
    struct pollfd pfd = {.fd = fd, .events = events};
    for (;;) {
        int rc = poll(&pfd, 1, IO_TIMEOUT_MS);
        if (rc > 0 && (pfd.revents & events)) return 0;
        if (rc < 0 && errno == EINTR) continue;
        if (rc == 0) fprintf(stderr, "I/O timeout\n");
        else if (rc < 0) perror("poll");
        else fprintf(stderr, "poll revents=0x%x\n", pfd.revents);
        return -1;
    }
}

static int write_all(int fd, const unsigned char *data, size_t len) {
    size_t off = 0;
    while (off < len) {
        ssize_t n = write(fd, data + off, len - off);
        if (n > 0) { off += (size_t)n; continue; }
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            if (wait_fd(fd, POLLOUT) < 0) return -1;
            continue;
        }
        if (n < 0) perror("write");
        return -1;
    }
    return 0;
}

static int run_backpressure(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) { perror("socket"); return 1; }
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons((uint16_t)port)
    };
    if (inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr) != 1) {
        fprintf(stderr, "inet_pton failed\n"); close(fd); return 1;
    }
    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("connect"); close(fd); return 1;
    }
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
        perror("fcntl"); close(fd); return 1;
    }

    unsigned char payload[4096];
    memset(payload, 'b', sizeof(payload));
    size_t sent = 0;
    const size_t target = 1024 * 1024;
    time_t deadline = time(NULL) + 3;
    while (sent < target && time(NULL) < deadline) {
        ssize_t n = write(fd, payload, sizeof(payload));
        if (n > 0) { sent += (size_t)n; continue; }
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            struct pollfd pfd = {.fd = fd, .events = POLLOUT};
            int rc = poll(&pfd, 1, 100);
            if (rc == 0) break;
            if (rc < 0 && errno == EINTR) continue;
            if (rc < 0) { perror("poll"); close(fd); return 1; }
            if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) break;
            continue;
        }
        if (n < 0 && (errno == EPIPE || errno == ECONNRESET)) break;
        perror("write"); close(fd); return 1;
    }
    /* Do not consume the echo: this deliberately applies reader backpressure. */
    struct timespec ts = {.tv_sec = 0, .tv_nsec = 200000000};
    while (nanosleep(&ts, &ts) < 0 && errno == EINTR) {}
    close(fd);
    return 0;
}

static int run_case(int port, size_t split, int halfclose) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) { perror("socket"); return 1; }
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons((uint16_t)port)
    };
    if (inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr) != 1) {
        fprintf(stderr, "inet_pton failed\n"); close(fd); return 1;
    }
    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("connect"); close(fd); return 1;
    }
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
        perror("fcntl"); close(fd); return 1;
    }
    unsigned char expected[PAYLOAD_SIZE];
    unsigned char received[PAYLOAD_SIZE];
    memset(expected, 'x', sizeof(expected));
    size_t first = split > 0 && split < sizeof(expected) ? split : sizeof(expected);
    if (write_all(fd, expected, first) < 0) { close(fd); return 1; }
    if (first < sizeof(expected)) {
        struct timespec ts = {.tv_sec = 0, .tv_nsec = 100000000};
        while (nanosleep(&ts, &ts) < 0 && errno == EINTR) {}
        if (write_all(fd, expected + first, sizeof(expected) - first) < 0) {
            close(fd); return 1;
        }
    }
    if (halfclose && shutdown(fd, SHUT_WR) < 0) {
        perror("shutdown"); close(fd); return 1;
    }

    size_t got = 0;
    while (got < sizeof(received)) {
        ssize_t n = read(fd, received + got, sizeof(received) - got);
        if (n > 0) { got += (size_t)n; continue; }
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            if (wait_fd(fd, POLLIN) < 0) { close(fd); return 1; }
            continue;
        }
        if (n == 0) fprintf(stderr, "unexpected EOF after %zu bytes\n", got);
        else perror("read");
        close(fd); return 1;
    }
    if (memcmp(expected, received, sizeof(expected)) != 0) {
        fprintf(stderr, "payload mismatch\n"); close(fd); return 1;
    }
    close(fd);
    return 0;
}

int main(int argc, char **argv) {
    signal(SIGPIPE, SIG_IGN);
    alarm(7);
    if (argc < 3 || argc > 4) {
        fprintf(stderr, "usage: %s PORT whole|split [halfclose]\n", argv[0]);
        return 2;
    }
    char *end = NULL;
    long parsed = strtol(argv[1], &end, 10);
    if (*argv[1] == '\0' || *end != '\0' || parsed < 1 || parsed > 65535) {
        fprintf(stderr, "PORT must be an integer from 1 to 65535\n"); return 2;
    }
    int halfclose = argc == 4 && strcmp(argv[3], "halfclose") == 0;
    if (argc == 4 && !halfclose) {
        fprintf(stderr, "optional mode must be halfclose\n"); return 2;
    }
    if (strcmp(argv[2], "whole") == 0) return run_case((int)parsed, 0, halfclose);
    if (strcmp(argv[2], "split") == 0) return run_case((int)parsed, 1, halfclose);
    if (argc == 3 && strcmp(argv[2], "backpressure") == 0) return run_backpressure((int)parsed);
    fprintf(stderr, "MODE must be whole, split, or backpressure\n");
    return 2;
}
