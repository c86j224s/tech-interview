#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <unistd.h>

#define PORT 19090
#define MAX_EVENTS 64
#define MAX_CONNECTIONS 32
#define OUTPUT_CAP 4096
#define IO_BUDGET 512
#define ACCEPT_BUDGET 8

typedef struct connection {
    int fd;
    uint32_t generation;
    unsigned char out[OUTPUT_CAP];
    size_t out_off;
    size_t out_len;
    int peer_eof;
    int closing;
    int ready_again;
} connection;

static volatile sig_atomic_t stop_requested;
static connection slots[MAX_CONNECTIONS];
static uint64_t ready_queue[MAX_CONNECTIONS];
static size_t ready_head;
static size_t ready_tail;
static size_t ready_count;

static void on_signal(int signo) { (void)signo; stop_requested = 1; }

static uint64_t handle_for(size_t index, uint32_t generation) {
    return ((uint64_t)generation << 32) | (uint64_t)(index + 1);
}

static uint64_t connection_handle(const connection *c) {
    return handle_for((size_t)(c - slots), c->generation);
}

static connection *connection_from_handle(uint64_t handle) {
    uint32_t raw_index = (uint32_t)handle;
    uint32_t generation = (uint32_t)(handle >> 32);
    if (raw_index == 0 || raw_index > MAX_CONNECTIONS || generation == 0) return NULL;
    connection *c = &slots[raw_index - 1];
    if (c->fd < 0 || c->generation != generation) return NULL;
    return c;
}

static int enqueue_ready(connection *c) {
    if (c->ready_again) return 0;
    if (ready_count == MAX_CONNECTIONS) return -1;
    ready_queue[ready_tail] = connection_handle(c);
    ready_tail = (ready_tail + 1) % MAX_CONNECTIONS;
    ++ready_count;
    c->ready_again = 1;
    return 0;
}

static uint64_t dequeue_ready(void) {
    uint64_t handle = ready_queue[ready_head];
    ready_head = (ready_head + 1) % MAX_CONNECTIONS;
    --ready_count;
    return handle;
}

static int add_interest(int epfd, connection *c) {
    struct epoll_event ev = {0};
    ev.events = EPOLLET | EPOLLONESHOT;
    if (!c->peer_eof && c->out_len - c->out_off < OUTPUT_CAP)
        ev.events |= EPOLLIN | EPOLLRDHUP;
    if (c->out_len != c->out_off) ev.events |= EPOLLOUT;
    ev.data.u64 = connection_handle(c);
    return epoll_ctl(epfd, EPOLL_CTL_MOD, c->fd, &ev);
}

static int queue_bytes(connection *c, const unsigned char *data, size_t n) {
    if (c->out_off != 0) {
        if (c->out_off == c->out_len) {
            c->out_off = c->out_len = 0;
        } else {
            memmove(c->out, c->out + c->out_off, c->out_len - c->out_off);
            c->out_len -= c->out_off;
            c->out_off = 0;
        }
    }
    if (n > OUTPUT_CAP - c->out_len) return -1;
    memcpy(c->out + c->out_len, data, n);
    c->out_len += n;
    return 0;
}

static void remove_connection(int epfd, connection *c) {
    if (!c || c->fd < 0) return;
    (void)epoll_ctl(epfd, EPOLL_CTL_DEL, c->fd, NULL);
    close(c->fd);
    c->fd = -1;
    c->ready_again = 0;
    c->closing = 0;
}

static connection *new_connection(int fd) {
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) {
        connection *c = &slots[i];
        if (c->fd >= 0) continue;
        uint32_t generation = c->generation + 1;
        if (generation == 0) generation = 1;
        memset(c, 0, sizeof(*c));
        c->fd = fd;
        c->generation = generation;
        return c;
    }
    return NULL;
}

/* Return 1 when the bounded read budget was exhausted before EAGAIN. */
static int handle_read(connection *c) {
    unsigned char buf[IO_BUDGET];
    size_t budget = IO_BUDGET;
    while (budget > 0) {
        size_t queued = c->out_len - c->out_off;
        if (queued == OUTPUT_CAP) return 0;
        size_t room = OUTPUT_CAP - queued;
        size_t want = budget < room ? budget : room;
        ssize_t n = recv(c->fd, buf, want, 0);
        if (n > 0) {
            if (queue_bytes(c, buf, (size_t)n) < 0) {
                c->closing = 1;
                return -1;
            }
            budget -= (size_t)n;
            continue;
        }
        if (n == 0) {
            /* A hang-up bit is only a prompt to call recv; zero is EOF. */
            c->peer_eof = 1;
            return 0;
        }
        if (errno == EINTR) continue;
        if (errno == EAGAIN || errno == EWOULDBLOCK) return 0;
        c->closing = 1;
        return -1;
    }
    return 1;
}

/* Return 1 when the bounded write budget was exhausted with output pending. */
static int handle_write(connection *c) {
    size_t budget = IO_BUDGET;
    while (c->out_off < c->out_len && budget > 0) {
        size_t remaining = c->out_len - c->out_off;
        size_t attempt = remaining < budget ? remaining : budget;
        ssize_t n = send(c->fd, c->out + c->out_off, attempt, MSG_NOSIGNAL);
        if (n > 0) {
            c->out_off += (size_t)n;
            budget -= (size_t)n;
            continue;
        }
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return 0;
        c->closing = 1;
        return -1;
    }
    if (c->out_off == c->out_len) c->out_off = c->out_len = 0;
    return c->out_off < c->out_len ? 1 : 0;
}

static void service_connection(int epfd, connection *c, uint32_t bits) {
    int yielded = 0;
    if (bits & (EPOLLIN | EPOLLRDHUP | EPOLLHUP | EPOLLERR)) {
        int read_result = handle_read(c);
        if (read_result < 0) c->closing = 1;
        if (read_result > 0) yielded = 1;
    }
    if (!c->closing && (bits & EPOLLOUT || c->out_len != c->out_off)) {
        int write_result = handle_write(c);
        if (write_result < 0) c->closing = 1;
        if (write_result > 0) yielded = 1;
    }
    if (c->peer_eof && c->out_off == c->out_len) c->closing = 1;

    if (c->closing) {
        remove_connection(epfd, c);
        return;
    }
    if (add_interest(epfd, c) < 0) {
        remove_connection(epfd, c);
        return;
    }
    /* Re-run only after a real budget yield, through the FIFO below. */
    if (yielded && enqueue_ready(c) < 0) remove_connection(epfd, c);
}

static void accept_ready(int epfd, int listener) {
    for (int accepted = 0; accepted < ACCEPT_BUDGET; ++accepted) {
        int fd = accept4(listener, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
        if (fd < 0) {
            if (errno == EINTR) { --accepted; continue; }
            if (errno == EAGAIN || errno == EWOULDBLOCK) return;
            perror("accept4");
            return;
        }
        if (stop_requested) {
            close(fd);
            continue;
        }
        connection *c = new_connection(fd);
        if (!c) {
            close(fd);
            continue;
        }
        struct epoll_event cev = {0};
        cev.events = EPOLLIN | EPOLLET | EPOLLONESHOT | EPOLLRDHUP;
        cev.data.u64 = connection_handle(c);
        if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &cev) < 0) remove_connection(epfd, c);
    }
}

int main(void) {
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) slots[i].fd = -1;
    signal(SIGPIPE, SIG_IGN);
    struct sigaction sa = {.sa_handler = on_signal};
    sigemptyset(&sa.sa_mask);
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    int listener = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
    if (listener < 0) { perror("socket"); return 1; }
    int one = 1;
    if (setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one)) < 0) {
        perror("setsockopt"); close(listener); return 1;
    }
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(PORT),
        .sin_addr.s_addr = htonl(INADDR_LOOPBACK)
    };
    if (bind(listener, (struct sockaddr *)&addr, sizeof(addr)) < 0 ||
        listen(listener, MAX_CONNECTIONS) < 0) {
        perror("bind/listen"); close(listener); return 1;
    }
    int epfd = epoll_create1(EPOLL_CLOEXEC);
    if (epfd < 0) { perror("epoll_create1"); close(listener); return 1; }
    struct epoll_event lev = {.events = EPOLLIN, .data.u64 = 0};
    if (epoll_ctl(epfd, EPOLL_CTL_ADD, listener, &lev) < 0) {
        perror("epoll_ctl"); close(epfd); close(listener); return 1;
    }
    fprintf(stderr, "epoll echo listening on 127.0.0.1:%d\n", PORT);

    struct epoll_event events[MAX_EVENTS];
    while (!stop_requested) {
        int timeout = ready_count > 0 ? 0 : 250;
        int n = epoll_wait(epfd, events, MAX_EVENTS, timeout);
        if (n < 0) {
            if (errno == EINTR) continue;
            perror("epoll_wait");
            break;
        }
        for (int i = 0; i < n; ++i) {
            if (events[i].data.u64 == 0) {
                accept_ready(epfd, listener);
                continue;
            }
            connection *c = connection_from_handle(events[i].data.u64);
            if (c) service_connection(epfd, c, events[i].events);
        }
        /* One local quantum per pass keeps epoll_wait/listener work visible. */
        if (ready_count > 0) {
            connection *c = connection_from_handle(dequeue_ready());
            if (c) {
                c->ready_again = 0;
                service_connection(epfd, c, EPOLLIN);
            }
        }
    }

    close(listener);
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) remove_connection(epfd, &slots[i]);
    close(epfd);
    return 0;
}
