#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

#pragma comment(lib, "Ws2_32.lib")

namespace {
constexpr unsigned short kPort = 39555;
constexpr std::uint32_t kMaxFrame = 1024 * 1024;

std::runtime_error win_error(const char* what, DWORD code) {
    return std::runtime_error(std::string(what) + " failed: " + std::to_string(code));
}

void require(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
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
    ~Winsock() { WSACleanup(); }
};

struct Socket {
    explicit Socket(SOCKET value) : value(value) {}
    ~Socket() {
        if (value != INVALID_SOCKET) {
            closesocket(value);
        }
    }
    SOCKET value;
};

void send_all(SOCKET socket, const char* data, std::size_t length) {
    while (length != 0) {
        const int sent = send(socket, data, static_cast<int>(length), 0);
        if (sent == SOCKET_ERROR) {
            throw win_error("send", WSAGetLastError());
        }
        require(sent > 0, "send made no progress");
        data += sent;
        length -= static_cast<std::size_t>(sent);
    }
}

void receive_exact(SOCKET socket, char* data, std::size_t length) {
    while (length != 0) {
        const int received = recv(socket, data, static_cast<int>(length), 0);
        if (received == SOCKET_ERROR) {
            throw win_error("recv", WSAGetLastError());
        }
        require(received > 0, "peer closed before the complete ACK frame");
        data += received;
        length -= static_cast<std::size_t>(received);
    }
}

std::vector<char> receive_frame(SOCKET socket) {
    std::uint32_t length = 0;
    receive_exact(socket, reinterpret_cast<char*>(&length), sizeof(length));
    require(length > 0 && length <= kMaxFrame, "ACK frame length is outside protocol limits");
    std::vector<char> payload(length);
    receive_exact(socket, payload.data(), payload.size());
    return payload;
}

void send_split_frame(SOCKET socket) {
    const char payload[] = "split-write";
    const auto length = static_cast<std::uint32_t>(sizeof(payload) - 1);
    std::vector<char> frame(sizeof(length) + sizeof(payload) - 1);
    std::memcpy(frame.data(), &length, sizeof(length));
    std::memcpy(frame.data() + sizeof(length), payload, sizeof(payload) - 1);

    send_all(socket, frame.data(), 2);
    Sleep(25);
    send_all(socket, frame.data() + 2, 1);
    Sleep(25);
    send_all(socket, frame.data() + 3, frame.size() - 3);
}

int run_client() {
    Winsock winsock;
    Socket socket(WSASocketW(AF_INET, SOCK_STREAM, IPPROTO_TCP, nullptr, 0, 0));
    require(socket.value != INVALID_SOCKET, "WSASocketW failed");

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(kPort);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(socket.value, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
        throw win_error("connect", WSAGetLastError());
    }
    send_split_frame(socket.value);
    const std::vector<char> ack = receive_frame(socket.value);
    require(ack == std::vector<char>({'a','c','k','-','f','r','o','m','-','i','o','c','p'}),
            "ACK payload mismatch");
    shutdown(socket.value, SD_SEND);
    std::printf("PASS split-write-client frame=split ack=verified\n");
    return 0;
}

}  // namespace

int main() {
    try {
        return run_client();
    } catch (const std::exception& error) {
        std::fprintf(stderr, "NOT_RUN_OR_FAIL %s\n", error.what());
        return 2;
    }
}
