#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <liburing.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define PORT 19091
#define QUEUE_DEPTH 32
#define MAX_CONNECTIONS 8
#define BUFFER_CAP 1024
#define DRAIN_TIMEOUT_MS 2000

typedef enum { OP_ACCEPT, OP_RECV, OP_SEND, OP_CANCEL } op_kind;
typedef struct client client;
typedef struct operation {
    op_kind kind;
    int fd;
    size_t off;
    size_t len;
    unsigned char data[BUFFER_CAP];
    client *owner;
    uint32_t owner_generation;
    struct operation *target;
} operation;
typedef struct client {
    int fd;
    uint32_t generation;
    operation recv_op;
    operation send_op;
    operation cancel_op;
    int recv_inflight;
    int send_inflight;
    int cancel_inflight;
} client;

static volatile sig_atomic_t stop_requested;
static client clients[MAX_CONNECTIONS];
static int listener_fd = -1;

static void on_signal(int signo) { (void)signo; stop_requested = 1; }

/* A staged SQE whose submission result is not exactly one is an ownership
 * boundary we cannot safely recover from. Do not reuse its operation or ring;
 * let process teardown reclaim kernel resources. */
static void fatal_submission(const char *where, int rc) {
    fprintf(stderr, "%s: submission ownership uncertain (%s); terminating\n",
            where, rc < 0 ? strerror(-rc) : "unexpected SQE count");
    _exit(70);
}

static client *take_client(int fd) {
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) {
        client *c = &clients[i];
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

static void drop_client(client *c) {
    if (!c || c->fd < 0) return;
    if (c->recv_inflight || c->send_inflight || c->cancel_inflight) return;
    close(c->fd);
    c->fd = -1;
}

static void submit_exact(struct io_uring *ring, const char *where) {
    int rc = io_uring_submit(ring);
    if (rc != 1) fatal_submission(where, rc);
}

static void submit_accept(struct io_uring *ring, operation *op, int *inflight) {
    struct io_uring_sqe *sqe = io_uring_get_sqe(ring);
    if (!sqe) fatal_submission("accept SQE", -EAGAIN);
    memset(op, 0, sizeof(*op));
    op->kind = OP_ACCEPT;
    op->fd = listener_fd;
    io_uring_prep_accept(sqe, listener_fd, NULL, NULL, SOCK_CLOEXEC);
    io_uring_sqe_set_data(sqe, op);
    submit_exact(ring, "accept");
    *inflight = 1;
}

static void submit_recv(struct io_uring *ring, client *c) {
    struct io_uring_sqe *sqe = io_uring_get_sqe(ring);
    if (!sqe) fatal_submission("recv SQE", -EAGAIN);
    memset(&c->recv_op, 0, sizeof(c->recv_op));
    c->recv_op.kind = OP_RECV;
    c->recv_op.fd = c->fd;
    c->recv_op.owner = c;
    c->recv_op.owner_generation = c->generation;
    io_uring_prep_recv(sqe, c->fd, c->recv_op.data, BUFFER_CAP, 0);
    io_uring_sqe_set_data(sqe, &c->recv_op);
    submit_exact(ring, "recv");
    c->recv_inflight = 1;
}

static void submit_send(struct io_uring *ring, client *c) {
    struct io_uring_sqe *sqe = io_uring_get_sqe(ring);
    if (!sqe) fatal_submission("send SQE", -EAGAIN);
    size_t remaining = c->send_op.len - c->send_op.off;
    if (remaining == 0 || remaining > BUFFER_CAP) fatal_submission("send length", -EINVAL);
    io_uring_prep_send(sqe, c->fd, c->send_op.data + c->send_op.off,
                       remaining, MSG_NOSIGNAL);
    io_uring_sqe_set_data(sqe, &c->send_op);
    submit_exact(ring, "send");
    c->send_inflight = 1;
}

static void submit_cancel(struct io_uring *ring, operation *cancel_op,
                          operation *target, int *cancel_inflight) {
    struct io_uring_sqe *sqe = io_uring_get_sqe(ring);
    if (!sqe) fatal_submission("cancel SQE", -EAGAIN);
    memset(cancel_op, 0, sizeof(*cancel_op));
    cancel_op->kind = OP_CANCEL;
    cancel_op->fd = target->fd;
    cancel_op->target = target;
    cancel_op->owner = target->owner;
    cancel_op->owner_generation = target->owner_generation;
    io_uring_prep_cancel64(sqe, (uint64_t)(uintptr_t)target, 0);
    io_uring_sqe_set_data(sqe, cancel_op);
    submit_exact(ring, "cancel");
    *cancel_inflight = 1;
}

static int pending_clients(void) {
    int count = 0;
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) {
        const client *c = &clients[i];
        count += c->recv_inflight + c->send_inflight + c->cancel_inflight;
    }
    return count;
}

static int64_t monotonic_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) < 0) return -1;
    return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static struct __kernel_timespec remaining_timeout(int64_t deadline_ms) {
    int64_t now = monotonic_ms();
    int64_t remaining = deadline_ms - now;
    if (remaining < 1) remaining = 1;
    if (remaining > 100) remaining = 100;
    struct __kernel_timespec ts = {
        .tv_sec = remaining / 1000,
        .tv_nsec = (remaining % 1000) * 1000000
    };
    return ts;
}

static void begin_shutdown(struct io_uring *ring, operation *accept_op,
                           int *accept_inflight, operation *accept_cancel_op,
                           int *accept_cancel_inflight) {
    if (listener_fd >= 0) {
        close(listener_fd);
        listener_fd = -1;
    }
    if (*accept_inflight && !*accept_cancel_inflight) {
        submit_cancel(ring, accept_cancel_op, accept_op, accept_cancel_inflight);
    }
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) {
        client *c = &clients[i];
        if (c->fd < 0 || c->cancel_inflight) continue;
        operation *target = c->recv_inflight ? &c->recv_op :
                            (c->send_inflight ? &c->send_op : NULL);
        if (target) submit_cancel(ring, &c->cancel_op, target, &c->cancel_inflight);
        else drop_client(c);
    }
}

int main(void) {
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) clients[i].fd = -1;
    signal(SIGPIPE, SIG_IGN);
    struct sigaction sa = {.sa_handler = on_signal};
    sigemptyset(&sa.sa_mask);
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    listener_fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (listener_fd < 0) { perror("socket"); return 1; }
    int one = 1;
    if (setsockopt(listener_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one)) < 0) {
        perror("setsockopt"); close(listener_fd); return 1;
    }
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(PORT),
        .sin_addr.s_addr = htonl(INADDR_LOOPBACK)
    };
    if (bind(listener_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0 ||
        listen(listener_fd, MAX_CONNECTIONS) < 0) {
        perror("bind/listen"); close(listener_fd); return 1;
    }
    /* Blocking descriptor: io_uring owns asynchronous accept readiness. */

    struct io_uring ring;
    struct io_uring_params params;
    memset(&params, 0, sizeof(params));
    int rc = io_uring_queue_init_params(QUEUE_DEPTH, &ring, &params);
    if (rc < 0) {
        fprintf(stderr, "io_uring unavailable: %s\n", strerror(-rc));
        close(listener_fd);
        return 77;
    }
    fprintf(stderr, "io_uring echo listening on 127.0.0.1:%d features=0x%x\n",
            PORT, params.features);

    operation accept_op;
    operation accept_cancel_op;
    int accept_inflight = 0;
    int accept_cancel_inflight = 0;
    int shutting_down = 0;
    int64_t shutdown_deadline = 0;
    size_t pending = 0;

    submit_accept(&ring, &accept_op, &accept_inflight);
    ++pending;

    while (pending > 0) {
        if (stop_requested && !shutting_down) {
            shutting_down = 1;
            int64_t now = monotonic_ms();
            shutdown_deadline = now < 0 ? 0 : now + DRAIN_TIMEOUT_MS;
            begin_shutdown(&ring, &accept_op, &accept_inflight,
                           &accept_cancel_op, &accept_cancel_inflight);
            pending = (size_t)(accept_inflight + accept_cancel_inflight + pending_clients());
        }

        struct io_uring_cqe *cqe = NULL;
        struct __kernel_timespec timeout;
        if (shutting_down) timeout = remaining_timeout(shutdown_deadline);
        rc = shutting_down
            ? io_uring_wait_cqe_timeout(&ring, &cqe, &timeout)
            : io_uring_wait_cqe(&ring, &cqe);
        if (rc < 0) {
            if (rc == -EINTR) continue;
            if (shutting_down && rc == -ETIME && monotonic_ms() < shutdown_deadline) continue;
            fprintf(stderr, "wait CQE: %s; terminating without unsafe reuse\n",
                    strerror(-rc));
            _exit(70);
        }
        operation *op = io_uring_cqe_get_data(cqe);
        int res = cqe->res;
        io_uring_cqe_seen(&ring, cqe);
        if (pending > 0) --pending;
        if (!op) continue;

        if (op->kind == OP_ACCEPT) {
            accept_inflight = 0;
            if (res >= 0) {
                if (shutting_down) {
                    close(res);
                } else {
                    client *c = take_client(res);
                    if (!c) {
                        close(res);
                    } else {
                        submit_recv(&ring, c);
                        ++pending;
                    }
                }
            }
            if (!shutting_down) {
                submit_accept(&ring, &accept_op, &accept_inflight);
                ++pending;
            }
        } else if (op->kind == OP_RECV) {
            client *c = op->owner;
            if (!c || c->generation != op->owner_generation) continue;
            c->recv_inflight = 0;
            if (!shutting_down && res > 0) {
                memset(&c->send_op, 0, sizeof(c->send_op));
                c->send_op.kind = OP_SEND;
                c->send_op.fd = c->fd;
                c->send_op.len = (size_t)res;
                c->send_op.owner = c;
                c->send_op.owner_generation = c->generation;
                memcpy(c->send_op.data, c->recv_op.data, (size_t)res);
                submit_send(&ring, c);
                ++pending;
            } else {
                drop_client(c);
            }
        } else if (op->kind == OP_SEND) {
            client *c = op->owner;
            if (!c || c->generation != op->owner_generation) continue;
            c->send_inflight = 0;
            if (!shutting_down && res > 0 && (size_t)res <= c->send_op.len - c->send_op.off) {
                c->send_op.off += (size_t)res;
                if (c->send_op.off < c->send_op.len) {
                    submit_send(&ring, c);
                    ++pending;
                } else {
                    memset(&c->send_op, 0, sizeof(c->send_op));
                    submit_recv(&ring, c);
                    ++pending;
                }
            } else {
                drop_client(c);
            }
        } else if (op->kind == OP_CANCEL) {
            if (op->owner && op->owner->generation == op->owner_generation) {
                op->owner->cancel_inflight = 0;
                drop_client(op->owner);
            } else {
                accept_cancel_inflight = 0;
            }
        }

        if (shutting_down) {
            for (size_t i = 0; i < MAX_CONNECTIONS; ++i) drop_client(&clients[i]);
            pending = (size_t)(accept_inflight + accept_cancel_inflight + pending_clients());
            if (pending == 0) break;
            if (monotonic_ms() >= shutdown_deadline) {
                fprintf(stderr, "shutdown drain timeout; terminating\n");
                _exit(70);
            }
        }
    }
    for (size_t i = 0; i < MAX_CONNECTIONS; ++i) drop_client(&clients[i]);
    io_uring_queue_exit(&ring);
    if (listener_fd >= 0) close(listener_fd);
    return 0;
}
