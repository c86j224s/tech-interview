#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <mswsock.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <array>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>

#pragma comment(lib, "Ws2_32.lib")

#ifndef WSA_FLAG_REGISTERED_IO
#define WSA_FLAG_REGISTERED_IO 0x00000100
#endif

namespace {
constexpr unsigned short kPort = 39556;
constexpr ULONG kCqCapacity = 4;
constexpr ULONG kOne = 1;
constexpr std::size_t kBufferSize = 128;
constexpr DWORD kWaitMs = 1000;
constexpr DWORD kDrainDeadlineMs = 3000;

std::runtime_error win_error(const char* what, int code) {
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
            throw win_error("WSAStartup", rc);
        }
    }
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

struct Endpoint {
    SOCKET socket = INVALID_SOCKET;
    RIO_EXTENSION_FUNCTION_TABLE rio{};
    RIO_CQ cq = RIO_INVALID_CQ;
    RIO_RQ rq = RIO_INVALID_RQ;
    RIO_BUFFERID buffer_id = RIO_INVALID_BUFFERID;
    std::unique_ptr<std::array<char, kBufferSize>> memory =
        std::make_unique<std::array<char, kBufferSize>>();
    RIO_BUF buffer{};
    OVERLAPPED notification_overlapped{};
    void* notification_key = nullptr;
    char receive_tag = 0;
    char send_tag = 0;
    bool outstanding = false;

    Endpoint() = default;
    Endpoint(const Endpoint&) = delete;
    Endpoint& operator=(const Endpoint&) = delete;
    Endpoint(Endpoint&&) = delete;
    Endpoint& operator=(Endpoint&&) = delete;
    ~Endpoint() {
        if (outstanding) {
            std::fprintf(stderr,
                         "UNSAFE_TO_FREE RIO outstanding operation; terminating without destructors\n");
            TerminateProcess(GetCurrentProcess(), 0xE1);
        }
        if (buffer_id != RIO_INVALID_BUFFERID && rio.RIODeregisterBuffer != nullptr) {
            rio.RIODeregisterBuffer(buffer_id);
        }
        if (cq != RIO_INVALID_CQ && rio.RIOCloseCompletionQueue != nullptr) {
            rio.RIOCloseCompletionQueue(cq);
        }
        if (socket != INVALID_SOCKET) {
            closesocket(socket);
        }
    }
};

void load_table(Endpoint& endpoint) {
    endpoint.rio.cbSize = sizeof(endpoint.rio);
    GUID id = WSAID_MULTIPLE_RIO;
    DWORD returned = 0;
    if (WSAIoctl(endpoint.socket, SIO_GET_MULTIPLE_EXTENSION_FUNCTION_POINTER,
                 &id, sizeof(id), &endpoint.rio, sizeof(endpoint.rio), &returned,
                 nullptr, nullptr) == SOCKET_ERROR) {
        throw win_error("WSAIoctl(WSAID_MULTIPLE_RIO)", WSAGetLastError());
    }
    require(endpoint.rio.RIOCreateCompletionQueue != nullptr &&
            endpoint.rio.RIOCreateRequestQueue != nullptr &&
            endpoint.rio.RIORegisterBuffer != nullptr &&
            endpoint.rio.RIODeregisterBuffer != nullptr &&
            endpoint.rio.RIODequeueCompletion != nullptr &&
            endpoint.rio.RIOCloseCompletionQueue != nullptr &&
            endpoint.rio.RIONotify != nullptr && endpoint.rio.RIOSend != nullptr &&
            endpoint.rio.RIOReceive != nullptr, "provider table is incomplete");
}

std::unique_ptr<Endpoint> make_endpoint(SOCKET socket, HANDLE notification_port, void* key) {
    auto endpoint = std::make_unique<Endpoint>();
    endpoint->socket = socket;
    load_table(*endpoint);
    endpoint->notification_key = key;

    RIO_NOTIFICATION_COMPLETION completion{};
    completion.Type = RIO_IOCP_COMPLETION;
    completion.Iocp.IocpHandle = notification_port;
    completion.Iocp.CompletionKey = key;
    completion.Iocp.Overlapped = &endpoint->notification_overlapped;
    endpoint->cq = endpoint->rio.RIOCreateCompletionQueue(kCqCapacity, &completion);
    if (endpoint->cq == RIO_INVALID_CQ) {
        throw win_error("RIOCreateCompletionQueue", WSAGetLastError());
    }
    endpoint->rq = endpoint->rio.RIOCreateRequestQueue(endpoint->socket, kOne, kOne, kOne, kOne,
                                                        endpoint->cq, endpoint->cq, nullptr);
    if (endpoint->rq == RIO_INVALID_RQ) {
        throw win_error("RIOCreateRequestQueue", WSAGetLastError());
    }
    endpoint->buffer_id = endpoint->rio.RIORegisterBuffer(endpoint->memory->data(),
                                                           static_cast<DWORD>(kBufferSize));
    if (endpoint->buffer_id == RIO_INVALID_BUFFERID) {
        throw win_error("RIORegisterBuffer", WSAGetLastError());
    }
    endpoint->buffer = {endpoint->buffer_id, 0, static_cast<ULONG>(kBufferSize)};
    return endpoint;
}

void arm(const Endpoint& endpoint) {
    const int rc = endpoint.rio.RIONotify(endpoint.cq);
    if (rc != ERROR_SUCCESS) {
        throw win_error("RIONotify", rc);
    }
}

bool dequeue_one(Endpoint& endpoint, void* expected_context, ULONG& bytes) {
    std::array<RIORESULT, 2> results{};
    const ULONG count = endpoint.rio.RIODequeueCompletion(endpoint.cq, results.data(), results.size());
    if (count == RIO_CORRUPT_CQ) {
        throw std::runtime_error("RIO_CORRUPT_CQ");
    }
    if (count == 0) {
        return false;
    }
    require(count == 1, "RIO lab expected one completion per dedicated CQ");
    require(results[0].RequestContext == expected_context, "unexpected RIO RequestContext");
    endpoint.outstanding = false;
    require(results[0].Status == 0, "RIO operation failed");
    bytes = results[0].BytesTransferred;
    require(bytes > 0 && bytes <= endpoint.buffer.Length, "RIO completion has invalid byte count");
    std::printf("RIO completion status=%lu bytes=%lu context=%p\n",
                static_cast<unsigned long>(results[0].Status),
                static_cast<unsigned long>(results[0].BytesTransferred),
                results[0].RequestContext);
    return true;
}

Socket make_listener() {
    Socket listener(WSASocketW(AF_INET, SOCK_STREAM, IPPROTO_TCP, nullptr, 0,
                               WSA_FLAG_REGISTERED_IO | WSA_FLAG_OVERLAPPED));
    require_socket(listener.value, "WSASocketW(listener)");
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(kPort);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener.value, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
        throw win_error("bind", WSAGetLastError());
    }
    if (listen(listener.value, 1) == SOCKET_ERROR) {
        throw win_error("listen", WSAGetLastError());
    }
    return listener;
}

[[noreturn]] void unsafe_terminate(const char* reason, std::size_t outstanding) {
    std::fprintf(stderr, "UNSAFE_TO_FREE outstanding=%zu reason=%s; terminating without destructors\n",
                 outstanding, reason);
    TerminateProcess(GetCurrentProcess(), 0xE2);
    std::abort();
}

int run_rio() {
    Winsock winsock;
    Socket listener = make_listener();
    Socket peer(WSASocketW(AF_INET, SOCK_STREAM, IPPROTO_TCP, nullptr, 0,
                           WSA_FLAG_REGISTERED_IO | WSA_FLAG_OVERLAPPED));
    require_socket(peer.value, "WSASocketW(peer)");

    sockaddr_in address{};
    int address_size = sizeof(address);
    if (getsockname(listener.value, reinterpret_cast<sockaddr*>(&address), &address_size) == SOCKET_ERROR) {
        throw win_error("getsockname", WSAGetLastError());
    }
    if (connect(peer.value, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
        throw win_error("connect", WSAGetLastError());
    }
    Socket accepted(WSAAccept(listener.value, nullptr, nullptr, nullptr, 0));
    require_socket(accepted.value, "WSAAccept");

    Port port(CreateIoCompletionPort(reinterpret_cast<HANDLE>(static_cast<ULONG_PTR>(accepted.value)),
                                     nullptr, 0x52494F53, 0));
    require(port.value != nullptr, "CreateIoCompletionPort(accepted) failed");
    HANDLE peer_port = CreateIoCompletionPort(reinterpret_cast<HANDLE>(static_cast<ULONG_PTR>(peer.value)),
                                               port.value, 0x52494F50, 0);
    require(peer_port == port.value, "CreateIoCompletionPort(peer) failed");

    auto server = make_endpoint(accepted.release(), port.value, reinterpret_cast<void*>(0x53455256));
    auto client = make_endpoint(peer.release(), port.value, reinterpret_cast<void*>(0x434C4945));
    const char payload[] = "rio-loopback";
    std::memcpy(client->memory->data(), payload, sizeof(payload) - 1);

    server->buffer.Length = static_cast<ULONG>(sizeof(payload) - 1);
    arm(*server);
    arm(*client);
    server->outstanding = true;
    if (!server->rio.RIOReceive(server->rq, &server->buffer, 1, 0, &server->receive_tag)) {
        server->outstanding = false;
        throw win_error("RIOReceive", WSAGetLastError());
    }
    client->outstanding = true;
    client->buffer.Length = static_cast<ULONG>(sizeof(payload) - 1);
    if (!client->rio.RIOSend(client->rq, &client->buffer, 1, 0, &client->send_tag)) {
        // The receive remains outstanding; do not unwind through Endpoint destructors.
        unsafe_terminate("RIOSend submission failed after receive became outstanding", 2);
    }

    std::size_t outstanding = 2;
    const ULONGLONG deadline = GetTickCount64() + kDrainDeadlineMs;
    while (outstanding != 0) {
        if (GetTickCount64() >= deadline) {
            // No provider-independent RIO cancellation contract is assumed.
            unsafe_terminate("RIO cancellation contract unavailable", outstanding);
        }
        DWORD bytes = 0;
        ULONG_PTR key = 0;
        OVERLAPPED* overlapped = nullptr;
        const BOOL ok = GetQueuedCompletionStatus(port.value, &bytes, &key, &overlapped, kWaitMs);
        if (overlapped == nullptr) {
            if (!ok && GetLastError() != WAIT_TIMEOUT) {
                unsafe_terminate("IOCP notification failure", outstanding);
            }
            continue;
        }

        if (!ok) unsafe_terminate("failed RIO notification", outstanding);
        Endpoint* endpoint = nullptr;
        bool receiving = false;
        if (key == reinterpret_cast<ULONG_PTR>(server->notification_key) &&
            overlapped == &server->notification_overlapped) {
            endpoint = server.get();
            receiving = true;
        } else if (key == reinterpret_cast<ULONG_PTR>(client->notification_key) &&
                   overlapped == &client->notification_overlapped) {
            endpoint = client.get();
        } else {
            unsafe_terminate("unknown RIO notification identity", outstanding);
        }
        ULONG transferred = 0;
        void* tag = receiving ? static_cast<void*>(&endpoint->receive_tag)
                              : static_cast<void*>(&endpoint->send_tag);
        if (!dequeue_one(*endpoint, tag, transferred)) {
            arm(*endpoint);
            continue;
        }
        endpoint->buffer.Offset += transferred;
        endpoint->buffer.Length -= transferred;
        if (endpoint->buffer.Length == 0) {
            --outstanding;
            continue;
        }
        // Reuse only the completed buffer suffix, with a fresh CQ notification.
        arm(*endpoint);
        endpoint->outstanding = true;
        const BOOL admitted = receiving
            ? endpoint->rio.RIOReceive(endpoint->rq, &endpoint->buffer, 1, 0, tag)
            : endpoint->rio.RIOSend(endpoint->rq, &endpoint->buffer, 1, 0, tag);
        if (!admitted) unsafe_terminate("RIO suffix submission failed", outstanding);
    }

    require(std::memcmp(server->memory->data(), payload, sizeof(payload) - 1) == 0,
            "RIO loopback payload mismatch");
    // Graceful protocol boundary: both results were dequeued before cleanup.
    shutdown(client->socket, SD_SEND);
    shutdown(server->socket, SD_SEND);
    std::printf("PASS rio notification=iocp cq-drain=complete memory=stable runtime-table=yes\n");
    return 0;
}

}  // namespace

int main() {
    try {
        return run_rio();
    } catch (const std::exception& error) {
        std::fprintf(stderr, "NOT_RUN_OR_FAIL %s\n", error.what());
        return 2;
    }
}
