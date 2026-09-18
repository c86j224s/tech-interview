#!/usr/bin/env python3
import hashlib
import tempfile
import unittest
from pathlib import Path
from inbox_format import read_inbox


class InboxStoreFormatTest(unittest.TestCase):
    def test_checksum_and_duplicate_payload_contract(self):
        event_id = "evt-1"
        payload = "amount=1"
        digest = hashlib.sha256(event_id.encode() + b"\0" + payload.encode()).hexdigest()
        record = f"v1\t{event_id.encode().hex()}\t{payload.encode().hex()}\t{digest}\n"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.log"
            path.write_text(record, encoding="utf-8")
            self.assertEqual(read_inbox(path), {event_id: payload})
            path.write_text(record + record, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                read_inbox(path)
            path.write_text(record.replace(digest, "0" * 64), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "checksum"):
                read_inbox(path)

    def test_incomplete_record_is_detectable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.log"
            path.write_text("v1\tdeadbeef", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "incomplete"):
                read_inbox(path)


if __name__ == "__main__":
    unittest.main()
