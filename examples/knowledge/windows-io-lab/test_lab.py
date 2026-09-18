import json
import pathlib

ROOT = pathlib.Path(__file__).parent


def text(name):
    return (ROOT / name).read_text(encoding="utf-8")


def must_contain(name, *tokens):
    value = text(name)
    for token in tokens:
        if token not in value:
            raise AssertionError(f"{name}: missing {token!r}")


must_contain(
    "iocp_overlapped_server.cpp",
    "WSARecv",
    "WSASend",
    "WSA_IO_PENDING",
    "GetQueuedCompletionStatus",
    "CancelIoEx",
    "ERROR_NOT_FOUND",
    "ERROR_OPERATION_ABORTED",
    "op.pending = false",
    "reset_overlapped(op)",
    "Phase::Header",
    "Phase::Payload",
    "OpStore",
    "OVERLAPPED*",
    "UNSAFE_TO_FREE",
    "TerminateProcess",
    "kMaxQueuedFrames",
)
must_contain(
    "split_write_client.cpp",
    "send_all(socket",
    "send_all(socket, frame.data(), 2)",
    "frame.data() + 2, 1",
    "frame.data() + 3",
)
must_contain(
    "rio_iocp_loopback.cpp",
    "RIO_IOCP_COMPLETION",
    "RIOReceive",
    "RIOSend",
    "outstanding",
    "unsafe_terminate",
    "Socket",
    "release()",
    "Iocp.Overlapped",
    "Iocp.CompletionKey",
    "RIODequeueCompletion",
    "RIO_CORRUPT_CQ",
    "RIORegisterBuffer",
    "RIODeregisterBuffer",
    "RIOCloseCompletionQueue",
    "WSAIoctl",
    "release()",
    "outstanding = true",
    "RIOReceive",
    "RIOSend",
)
must_contain(
    "README.md",
    "partial",
    "CancelIoEx",
    "ERROR_NOT_FOUND",
    "RIO_IOCP_COMPLETION",
    "unsafe process-termination",
)

for script in (ROOT / "build.bat", ROOT / "run.bat"):
    must_contain(script.name, "exit /b")
must_contain("run.bat", "run.ps1", "powershell.exe")
must_contain("run.ps1", "WaitForExit(5000)", "Kill()", "rio_iocp_loopback.exe")
must_contain("rio_iocp_loopback.cpp", "results[0].Status == 0", "buffer.Offset += transferred", "buffer.Length -= transferred")

print("PASS source-marker smoke checks only; Windows compilation/runtime NOT_RUN")
