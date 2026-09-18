package com.example.pulsarlab;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InboxStoreTest {
    private static OrderEvent event(boolean poison) {
        return new OrderEvent("evt-1", "order-1", "customer-1", "customer-1", 100, poison);
    }

    @Test
    void duplicateEventDoesNotRepeatEffect() throws Exception {
        try (InboxStore store = new InboxStore(Files.createTempFile("inbox-test-", ".ledger"))) {
            assertTrue(store.apply(event(false)).effectApplied());
            assertFalse(store.apply(event(false)).effectApplied());
            assertEquals(1, store.effectCount());
            assertEquals(1, store.inboxSize());
        }
    }

    @Test
    void sameIdWithDifferentPayloadIsConflict() throws Exception {
        try (InboxStore store = new InboxStore(Files.createTempFile("inbox-test-", ".ledger"))) {
            store.apply(event(false));
            OrderEvent changed = new OrderEvent("evt-1", "order-1", "customer-1", "customer-1", 200, false);
            assertThrows(IllegalStateException.class, () -> store.apply(changed));
            assertEquals(1, store.effectCount());
        }
    }

    @Test
    void poisonEventDoesNotCreateInboxEntry() throws Exception {
        try (InboxStore store = new InboxStore(Files.createTempFile("inbox-test-", ".ledger"))) {
            assertThrows(IllegalArgumentException.class, () -> store.apply(event(true)));
            assertEquals(0, store.effectCount());
            assertEquals(0, store.inboxSize());
        }
    }

    @Test
    void concurrentDuplicateStillAppliesOnce() throws Exception {
        try (InboxStore store = new InboxStore(Files.createTempFile("inbox-test-", ".ledger"))) {
            var pool = Executors.newFixedThreadPool(2);
            CountDownLatch start = new CountDownLatch(1);
            try {
                var first = pool.submit(() -> { start.await(); return store.apply(event(false)); });
                var second = pool.submit(() -> { start.await(); return store.apply(event(false)); });
                start.countDown();
                first.get(2, TimeUnit.SECONDS);
                second.get(2, TimeUnit.SECONDS);
                assertEquals(1, store.effectCount());
            } finally {
                pool.shutdownNow();
            }
        }
    }

    @Test
    void committedEffectSurvivesProcessRestart() throws Exception {
        Path path = Files.createTempFile("inbox-restart-", ".ledger");
        try (InboxStore firstProcess = new InboxStore(path)) {
            assertTrue(firstProcess.apply(event(false)).effectApplied());
        }
        try (InboxStore restartedProcess = new InboxStore(path)) {
            assertFalse(restartedProcess.apply(event(false)).effectApplied());
            assertEquals(1, restartedProcess.effectCount());
            assertEquals(1, restartedProcess.inboxSize());
        }
    }
}
