#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <limits>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#pragma comment(lib, "Ws2_32.lib")

namespace {
constexpr unsigned short kPort = 39555;
constexpr std::uint32_t kMaxFrame = 1024 * 1024;
constexpr std::size_t kMaxQueuedFrames = 4;
constexpr DWORD kWaitMs = 1000;
constexpr DWORD kDrainDeadlineMs = 3000;

std::runtime_error win_error(const char* what, DWORD code) {
    return std::runtime_error(std::string(what) + " failed: " + std::to_string(code));
}

void require(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

void require_socket(SOCKET socket, const char* operation) {
    if (socket == INVALID_SOCKET) {
        throw win_error(operation, WSAGetLastError());
    }
}

struct Winsock {
    Winsock() {
        WSADATA data{};
        const int rc = WSAStartup(MAKEWORD(2, 2), &data);
        if (rc != 0) {
            throw win_error("WSAStartup", static_cast<DWORD>(rc));
        }
    }
    Winsock(const Winsock&) = delete;
    Winsock& operator=(const Winsock&) = delete;
    ~Winsock() { WSACleanup(); }
};

struct Socket {
    explicit Socket(SOCKET value = INVALID_SOCKET) : value(value) {}
    Socket(const Socket&) = delete;
    Socket& operator=(const Socket&) = delete;
    Socket(Socket&& other) noexcept : value(other.value) { other.value = INVALID_SOCKET; }
    Socket& operator=(Socket&&) noexcept = delete;
    ~Socket() {
        if (value != INVALID_SOCKET) {
            closesocket(value);
        }
    }
    SOCKET get() const { return value; }
    SOCKET release() {
        SOCKET result = value;
        value = INVALID_SOCKET;
        return result;
    }
    SOCKET value;
};

struct Port {
    explicit Port(HANDLE value) : value(value) {}
    Port(const Port&) = delete;
    Port& operator=(const Port&) = delete;
    ~Port() {
        if (value != nullptr) {
            CloseHandle(value);
        }
    }
    HANDLE value;
};

struct Op {
    OVERLAPPED overlapped{};
    WSABUF buffer{};
    std::vector<char> storage;
    std::size_t offset = 0;
    bool receive = false;
    bool pending = false;
    std::uint64_t id = 0;
};

struct OpStore {
    std::unordered_map<OVERLAPPED*, std::unique_ptr<Op>> active;

    Op& add(std::unique_ptr<Op> op) {
        Op* raw = op.get();
        active.emplace(&raw->overlapped, std::move(op));
        return *raw;
    }

    std::unique_ptr<Op> remove(OVERLAPPED* key) {
        auto it = active.find(key);
        require(it != active.end(), "completion has no active operation");
        std::unique_ptr<Op> result = std::move(it->second);
        active.erase(it);
        return result;
    }
};

void reset_overlapped(Op& op) {
    std::memset(&op.overlapped, 0, sizeof(op.overlapped));
}

class BoundedSender {
public:
    explicit BoundedSender(std::size_t limit) : limit_(limit) {}

    void enqueue(std::vector<char> frame) {
        require(frame.size() <= kMaxFrame + sizeof(std::uint32_t), "outgoing frame too large");
        require(queued_.size() + (active_ != nullptr ? 1 : 0) < limit_,
                "bounded sender queue is full");
        queued_.push_back(std::move(frame));
    }

    bool has_active() const { return active_ != nullptr; }

    void start_next(OpStore& store, SOCKET socket) {
        if (active_ != nullptr || queued_.empty()) {
            return;
        }
        auto op = std::make_unique<Op>();
        op->receive = false;
        op->id = next_id_++;
        op->storage = std::move(queued_.front());
        queued_.pop_front();
        active_ = &store.add(std::move(op));
        submit(store, socket, *active_);
    }

    void complete(Op& op, DWORD bytes, OpStore& store, SOCKET socket) {
        require(&op == active_, "sender completion does not match active send");
        require(!op.pending, "sender completion was not dequeued before processing");
        const std::size_t remaining = op.storage.size() - op.offset;
        if (bytes == 0 || bytes > remaining) {
            active_ = nullptr;
            store.remove(&op.overlapped);
            throw std::runtime_error("send completion made zero progress or exceeded the remaining frame");
        }
        op.offset += bytes;
        if (op.offset != op.storage.size()) {
            submit(store, socket, op);
            return;
        }
        std::unique_ptr<Op> finished = store.remove(&op.overlapped);
        active_ = nullptr;
        (void)finished;
        start_next(store, socket);
    }

private:
    void submit(OpStore& store, SOCKET socket, Op& op) {
        require(op.storage.size() - op.offset <= (std::numeric_limits<ULONG>::max)(),
                "send buffer exceeds WSABUF length");
        reset_overlapped(op);
        op.buffer.buf = op.storage.data() + op.offset;
        op.buffer.len = static_cast<ULONG>(op.storage.size() - op.offset);
        op.pending = true;
        const int rc = WSASend(socket, &op.buffer, 1, nullptr, 0, &op.overlapped, nullptr);
        if (rc == SOCKET_ERROR) {
            const DWORD error = WSAGetLastError();
            if (error != WSA_IO_PENDING) {
                op.pending = false;
                std::unique_ptr<Op> failed = store.remove(&op.overlapped);
                active_ = nullptr;
                (void)failed;
                throw win_error("WSASend", error);
            }
        }
    }

    std::size_t limit_;
    std::deque<std::vector<char>> queued_;
    Op* active_ = nullptr;
    std::uint64_t next_id_ = 1;
};

class FramedReceiver {
public:
    enum class Phase { Header, Payload };

    Op& start(OpStore& store, SOCKET socket) {
        auto op = std::make_unique<Op>();
        op->receive = true;
        op->id = 1;
        op->storage.resize(sizeof(std::uint32_t));
        phase_ = Phase::Header;
        Op& result = store.add(std::move(op));
        submit(socket, result, store);
        return result;
    }

    bool complete(Op& op, DWORD bytes, OpStore& store, SOCKET socket) {
        require(op.receive, "receiver got a send operation");
        require(!op.pending, "receive completion was not dequeued before processing");
        const std::size_t remaining = op.storage.size() - op.offset;
        if (bytes == 0 || bytes > remaining) {
            store.remove(&op.overlapped);
            throw std::runtime_error("receive completion made zero progress or exceeded the remaining buffer");
        }
        op.offset += bytes;
        if (op.offset != op.storage.size()) {
            submit(socket, op, store);
            return false;
        }

        if (phase_ == Phase::Header) {
            std::uint32_t length = 0;
            std::memcpy(&length, op.storage.data(), sizeof(length));
            if (length == 0 || length > kMaxFrame) {
                store.remove(&op.overlapped);
                throw std::runtime_error("frame length is outside protocol limits");
            }
            phase_ = Phase::Payload;
            op.storage.assign(length, 0);
            op.offset = 0;
            submit(socket, op, store);
            return false;
        }

        frame_ = op.storage;
        std::unique_ptr<Op> finished = store.remove(&op.overlapped);
        (void)finished;
        return true;
    }

    const std::vector<char>& frame() const { return frame_; }

private:
    static void submit(SOCKET socket, Op& op, OpStore& store) {
        require(op.storage.size() - op.offset <= (std::numeric_limits<ULONG>::max)(),
                "receive buffer exceeds WSABUF length");
        reset_overlapped(op);
        op.buffer.buf = op.storage.data() + op.offset;
        op.buffer.len = static_cast<ULONG>(op.storage.size() - op.offset);
        DWORD flags = 0;
        op.pending = true;
        const int rc = WSARecv(socket, &op.buffer, 1, nullptr, &flags, &op.overlapped, nullptr);
        if (rc == SOCKET_ERROR) {
            const DWORD error = WSAGetLastError();
            if (error != WSA_IO_PENDING) {
                op.pending = false;
                std::unique_ptr<Op> failed = store.remove(&op.overlapped);
                (void)failed;
                throw win_error("WSARecv", error);
            }
        }
    }

    Phase phase_ = Phase::Header;
    std::vector<char> frame_;
};

HANDLE socket_as_handle(SOCKET socket) {
    return reinterpret_cast<HANDLE>(static_cast<ULONG_PTR>(socket));
}

std::vector<char> framed(const char* text) {
    const std::size_t length = std::strlen(text);
    require(length > 0 && length <= kMaxFrame, "test frame is outside protocol limits");
    std::vector<char> result(sizeof(std::uint32_t) + length);
    const auto wire_length = static_cast<std::uint32_t>(length);
    std::memcpy(result.data(), &wire_length, sizeof(wire_length));
    std::memcpy(result.data() + sizeof(wire_length), text, length);
    return result;
}

void cancel_and_drain(SOCKET socket, OpStore& store, HANDLE port) {
    for (const auto& entry : store.active) {
        if (!entry.second->pending) {
            continue;
        }
        const BOOL cancelled = CancelIoEx(socket_as_handle(socket), entry.first);
        if (!cancelled) {
            const DWORD error = GetLastError();
            // ERROR_NOT_FOUND means the operation already completed or raced with dequeue.
            // ERROR_OPERATION_ABORTED is reported by the eventual failed completion.
            if (error != ERROR_NOT_FOUND) {
                throw win_error("CancelIoEx", error);
            }
        }
    }

    const ULONGLONG deadline = GetTickCount64() + kDrainDeadlineMs;
    while (!store.active.empty()) {
        DWORD bytes = 0;
        ULONG_PTR key = 0;
        OVERLAPPED* overlapped = nullptr;
        const BOOL ok = GetQueuedCompletionStatus(port, &bytes, &key, &overlapped, 100);
        if (overlapped == nullptr) {
            if (!ok && GetLastError() != WAIT_TIMEOUT) {
                throw win_error("GetQueuedCompletionStatus during drain", GetLastError());
            }
        } else {
            // A failed packet still owns the OVERLAPPED until this dequeue.
            store.remove(overlapped);
        }
        if (GetTickCount64() >= deadline) {
            std::fprintf(stderr,
                         "UNSAFE_TO_FREE outstanding=%zu; terminating without stack destructors\n",
                         store.active.size());
            TerminateProcess(GetCurrentProcess(), 0xE1);
        }
    }
}

Socket make_listener() {
    Socket listener(WSASocketW(AF_INET, SOCK_STREAM, IPPROTO_TCP, nullptr, 0, WSA_FLAG_OVERLAPPED));
    require_socket(listener.get(), "WSASocketW(listener)");
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(kPort);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener.get(), reinterpret_cast<const sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
        throw win_error("bind", WSAGetLastError());
    }
    if (listen(listener.get(), 1) == SOCKET_ERROR) {
        throw win_error("listen", WSAGetLastError());
    }
    return listener;
}

int run_server() {
    Winsock winsock;
    Socket listener = make_listener();
    Socket accepted(WSAAccept(listener.get(), nullptr, nullptr, nullptr, 0));
    require_socket(accepted.get(), "WSAAccept");
    Port port(CreateIoCompletionPort(socket_as_handle(accepted.get()), nullptr, 0x53455256, 0));
    require(port.value != nullptr, "CreateIoCompletionPort failed");

    OpStore store;
    try {
        FramedReceiver receiver;
        receiver.start(store, accepted.get());
        BoundedSender sender(kMaxQueuedFrames);
        bool received = false;
        bool timed_out = false;
        const ULONGLONG deadline = GetTickCount64() + kDrainDeadlineMs;

        for (;;) {
            const ULONGLONG now = GetTickCount64();
            if (now >= deadline) {
                timed_out = true;
                break;
            }
            const DWORD remaining = static_cast<DWORD>(deadline - now);
            const DWORD wait_ms = (remaining < kWaitMs) ? remaining : kWaitMs;
            DWORD bytes = 0;
            ULONG_PTR key = 0;
            OVERLAPPED* overlapped = nullptr;
            const BOOL ok = GetQueuedCompletionStatus(port.value, &bytes, &key, &overlapped, wait_ms);
            if (overlapped == nullptr) {
                if (!ok && GetLastError() != WAIT_TIMEOUT) {
                    throw win_error("GetQueuedCompletionStatus", GetLastError());
                }
                continue;
            }

            auto it = store.active.find(overlapped);
            require(it != store.active.end(), "IOCP returned an unknown OVERLAPPED");
            Op& op = *it->second;
            const bool is_receive = op.receive;
            op.pending = false;
            if (!ok) {
                const DWORD error = GetLastError();
                store.remove(overlapped);
                throw win_error(is_receive ? "WSARecv completion" : "WSASend completion", error);
            }

            if (is_receive) {
                received = receiver.complete(op, bytes, store, accepted.get());
                if (received) {
                    sender.enqueue(framed("ack-from-iocp"));
                    sender.start_next(store, accepted.get());
                }
            } else {
                sender.complete(op, bytes, store, accepted.get());
            }
            if (received && !sender.has_active() && store.active.empty()) {
                shutdown(accepted.get(), SD_SEND);
                break;
            }
        }

        if (timed_out || !store.active.empty()) {
            cancel_and_drain(accepted.get(), store, port.value);
            throw std::runtime_error("IOCP deadline reached before completion drain");
        }

        require(receiver.frame() == std::vector<char>({'s','p','l','i','t','-','w','r','i','t','e'}),
                "framed payload mismatch");
        std::printf("PASS overlapped-iocp bytes=%zu framing=complete sender=bounded cancel=drained\n",
                    receiver.frame().size());
        return 0;
    } catch (...) {
        if (!store.active.empty()) {
            try {
                cancel_and_drain(accepted.get(), store, port.value);
            } catch (...) {
                std::fprintf(stderr, "UNSAFE_TO_FREE outstanding=%zu; terminating without stack destructors\n",
                             store.active.size());
                TerminateProcess(GetCurrentProcess(), 0xE2);
            }
        }
        throw;
    }
}

}  // namespace

int main() {
    try {
        return run_server();
    } catch (const std::exception& error) {
        std::fprintf(stderr, "NOT_RUN_OR_FAIL %s\n", error.what());
        return 2;
    }
}
