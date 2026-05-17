from __future__ import annotations

import unittest

from app.idempotency import IdempotencyStore


class TestIdempotencyStore(unittest.TestCase):
    def test_idempotency_store_detects_duplicates_and_eviction(self):
        store = IdempotencyStore(max_keys=2)

        self.assertFalse(store.contains("event-1"))

        store.add("event-1")
        store.add("event-2")

        self.assertTrue(store.contains("event-1"))
        self.assertTrue(store.contains("event-2"))

        store.add("event-3")

        self.assertEqual(store.size(), 2)
        self.assertFalse(store.contains("event-1"))
        self.assertTrue(store.contains("event-2"))
        self.assertTrue(store.contains("event-3"))
