# Windows IOCP·RIO loopback lab

This bounded loopback lab separates overlapped IOCP completion from RIO notification and CQ results. Windows compilation/runtime remain NOT_RUN on the macOS host.

## Files

- `iocp_overlapped_server.cpp`: dedicated overlapped Winsock example. Each `WSAOVERLAPPED` is heap-owned in `OpStore`; completion keys are stable pointers, and the map owns the operation until its IOCP packet is dequeued.
- `split_write_client.cpp`: sends one length-prefixed `split-write` frame in three writes, so the server must accumulate a TCP stream rather than assume one receive is one frame.
- `rio_iocp_loopback.cpp`: separate RIO data and notification example using `RIO_IOCP_COMPLETION`, dedicated `OVERLAPPED` values, stable completion keys, a runtime function table, initialization checks, stable send/receive buffers, and CQ draining. It does not claim a provider-independent RIO cancellation primitive.
- `build.bat` and `run.bat`: build all three binaries. `run.bat` delegates to `run.ps1`, which starts the overlapped server, waits for the split-write client and server exit, then runs RIO with bounded waits and cleanup. A timeout kills the child process rather than pretending it drained.
- `test_lab.py`: source-marker smoke checks only, not API or runtime verification.

## IOCP operation ownership

`WSARecv` and `WSASend` use `WSAOVERLAPPED` objects that remain valid until their completion has been dequeued. `OpStore` gives every operation a stable heap address and keeps its buffer storage alive. A synchronous return of zero is not an IOCP packet; it means the operation completed immediately. `SOCKET_ERROR` with `WSA_IO_PENDING` means the overlapped operation started and a later completion is expected. Any other error means no completion will occur for that submission.

The server treats a successful completion with `bytes == 0` as an orderly TCP receive close, not as a complete frame. A successful send completion with zero bytes is treated as no progress and fails rather than spinning. A failed `GetQueuedCompletionStatus` call with a non-null `OVERLAPPED` is still a dequeued failed-I/O packet; the operation is removed only then. A timeout has a null `OVERLAPPED` and does not release anything.

The sender is bounded: at most four complete frames may be queued or active. It owns one active send and resubmits only the unsent suffix when a completion reports a partial transfer. It does not interpret a successful send as peer application acknowledgement.

## Framing

The wire format is a little-endian `uint32_t` payload length followed by exactly that many payload bytes. The receiver has one stable operation and resubmits the remaining prefix/suffix until the header and payload are complete. The split-write client deliberately separates the header and payload writes. The parser rejects zero lengths, lengths larger than 1 MiB, premature EOF, and completion counts larger than the remaining buffer.

## Cancellation and drain

For overlapped Winsock operations, the server calls `CancelIoEx` with the socket handle and the exact `OVERLAPPED` pointer for every active operation. A successful call requests cancellation; it does not wait. `ERROR_NOT_FOUND` means there was no request matching that pointer at the instant of the call, so the operation may have already completed or raced with completion. In either case, the operation remains owned until its completion packet is dequeued. The drain loop handles normal and failed packets and only then permits operation memory to be reclaimed.

The drain deadline is a diagnostic boundary, not permission to free. If the provider or driver does not produce a completion by the deadline, the process prints `UNSAFE_TO_FREE` and calls `TerminateProcess`; it does not unwind stack destructors that could close a socket or free an `OVERLAPPED` still referenced by the system. Microsoft explicitly says `CancelIoEx` does not guarantee cancellation and that the `OVERLAPPED` must not be freed or reused until completion. This is intentionally an unsafe process-termination escape hatch, not a claim of safe cancellation.

## RIO notification and cleanup

`RIO_IOCP_COMPLETION` is configured separately from the overlapped data path. The RIO CQ gets its own `OVERLAPPED` and completion key; the IOCP packet identifies that notification, after which the application must call `RIODequeueCompletion` on the corresponding CQ. The notification packet is not a `RIORESULT`. `RIODequeueCompletion` returning zero means the CQ currently has no result; `RIO_CORRUPT_CQ` is a distinct corruption result. `RIORESULT.Status == 0` indicates success for that operation, but `BytesTransferred == 0` still requires operation-specific interpretation; it is not automatically a frame success.

The RIO sample drains both endpoint CQs before deregistering the stable send/receive buffers or closing either CQ. Its outstanding guard is established before the first successful RIO operation; after any operation is admitted, exceptions do not unwind through endpoint destructors. It has initialization rollback through local ownership and does not run a data operation through a guessed provider cancellation path. If production code needs RIO shutdown, use an explicit graceful peer-close protocol, stop new submissions, drain observable results, and close only after outstanding work is zero. A graceful peer close is a protocol boundary, not proof that a pending RIO operation was canceled. If a provider-specific RIO cancellation mechanism cannot be established from its contract, do not label a deadline exit as cancellation; use the unsafe process-termination boundary above rather than stack cleanup.

## Official contract boundaries

The linked learning note lists the Microsoft Learn references:

- `WSARecv` and `WSASend`: immediate zero, `WSA_IO_PENDING`, no-completion errors, buffer lifetime, partial byte-stream behavior, and orderly receive EOF.
- `CreateIoCompletionPort` and `GetQueuedCompletionStatus`: overlapped socket association, completion keys, timeout/null-overlapped distinction, and failed packets with non-null `OVERLAPPED`.
- `CancelIoEx`: request-versus-completion distinction, `ERROR_NOT_FOUND`, `ERROR_OPERATION_ABORTED`, and the no-free-before-completion rule.
- `RIO_NOTIFICATION_COMPLETION` and `RIONotify`: dedicated IOCP `OVERLAPPED`, completion key, and dequeue-after-notification rule.
- `RIODequeueCompletion`, `RIODeregisterBuffer`, and `RIOCloseCompletionQueue`: zero versus corruption, result ownership, no early deregistration, and silently dropped completions after CQ invalidation.

No claim is made that this package was compiled or run on Windows, that the target RIO provider accepts the registered socket flag, or that any provider-specific RIO cancellation behavior is portable.
