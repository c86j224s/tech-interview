"""Local socket-pair smoke test; not a server benchmark or race proof."""
import platform
import select
import socket
import sys

if not hasattr(select, 'kqueue'):
    print('SKIP: kqueue is unavailable on this platform')
    sys.exit(0)

receiver, sender = socket.socketpair()
queue = select.kqueue()
try:
    receiver.setblocking(False)
    queue.control([select.kevent(receiver.fileno(), filter=select.KQ_FILTER_READ,
                                 flags=select.KQ_EV_ADD | select.KQ_EV_CLEAR)], 0, 0)
    expected = b'\x00\x02OK'
    sender.sendall(expected)
    sender.shutdown(socket.SHUT_WR)
    events = queue.control([], 8, 1)
    assert events, 'No read-ready event'
    payload = bytearray()
    eof = False
    for _ in range(16):
        try:
            block = receiver.recv(1)
        except BlockingIOError:
            events.extend(queue.control([], 8, 1))
            continue
        if not block:
            eof = True
            break
        payload.extend(block)
    assert bytes(payload) == expected, payload
    assert eof, 'EOF not observed after payload drain'
    assert int.from_bytes(payload[:2], 'big') == len(payload[2:])
    print(platform.platform())
    print('PASS: EV_CLEAR notification, four one-byte reads, then recv EOF')
    print('Event flags:', [event.flags for event in events])
finally:
    queue.close()
    receiver.close()
    sender.close()
