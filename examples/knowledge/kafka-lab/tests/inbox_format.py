"""Reader for the Java InboxStore v1 format, not a second inbox implementation."""
import hashlib
from pathlib import Path


def read_inbox(path):
    data = Path(path).read_bytes()
    if len(data) > 8 * 1024 * 1024 or (data and not data.endswith(b"\n")):
        raise ValueError("oversized or incomplete inbox")
    records = {}
    for line in data.splitlines():
        if not line:
            continue
        version, raw_id, raw_payload, checksum = line.decode("ascii").split("\t")
        if version != "v1":
            raise ValueError("unsupported inbox version")
        event = bytes.fromhex(raw_id)
        payload = bytes.fromhex(raw_payload)
        if hashlib.sha256(event + b"\0" + payload).hexdigest() != checksum:
            raise ValueError("checksum mismatch")
        event_id = event.decode("utf-8")
        if event_id in records:
            raise ValueError("duplicate event ID")
        records[event_id] = payload.decode("utf-8")
    return records
