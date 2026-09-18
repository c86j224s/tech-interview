#!/usr/bin/env python3
import unittest


class Checkpoint:
    def __init__(self, initial):
        self.delivered = []
        self.completed = set()
        self.next_commit = initial

    def deliver(self, offset):
        if self.delivered and offset <= self.delivered[-1]:
            raise ValueError("offsets must be delivered in order")
        self.delivered.append(offset)

    def complete(self, offset):
        if offset not in self.delivered:
            raise ValueError("offset was not delivered")
        self.completed.add(offset)
        while self.delivered and self.delivered[0] in self.completed:
            finished = self.delivered.pop(0)
            self.completed.remove(finished)
            self.next_commit = finished + 1


class Inbox:
    def __init__(self):
        self.events = {}

    def apply_once(self, event_id, payload):
        if not event_id:
            raise ValueError("event_id must not be empty")
        if event_id in self.events:
            return False
        self.events[event_id] = payload
        return True


class CheckpointTest(unittest.TestCase):
    def test_completion_must_be_contiguous(self):
        checkpoint = Checkpoint(10)
        for offset in (10, 11, 12):
            checkpoint.deliver(offset)
        checkpoint.complete(11)
        checkpoint.complete(12)
        self.assertEqual(checkpoint.next_commit, 10)
        checkpoint.complete(10)
        self.assertEqual(checkpoint.next_commit, 13)

    def test_duplicate_inbox_effect_is_rejected(self):
        inbox = Inbox()
        self.assertTrue(inbox.apply_once("evt-1", "amount=1"))
        self.assertFalse(inbox.apply_once("evt-1", "amount=1"))
        self.assertEqual(inbox.events, {"evt-1": "amount=1"})

    def test_empty_event_id_is_rejected(self):
        with self.assertRaises(ValueError):
            Inbox().apply_once("", "amount=1")

    def test_checkpoint_rejects_duplicate_delivery(self):
        checkpoint = Checkpoint(10)
        checkpoint.deliver(10)
        with self.assertRaises(ValueError):
            checkpoint.deliver(10)
        checkpoint.complete(10)
        self.assertEqual(checkpoint.next_commit, 11)


if __name__ == "__main__":
    unittest.main()
