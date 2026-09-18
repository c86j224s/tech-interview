package lab.kafka;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

final class CheckpointTest {
    @Test
    void advancesOnlyAcrossContiguousCompletedOffsets() {
        Checkpoint c = new Checkpoint(10);
        c.delivered(10);
        c.delivered(11);
        c.delivered(12);
        assertEquals(10, c.markCompleted(11));
        assertEquals(10, c.markCompleted(12));
        assertEquals(13, c.markCompleted(10));
        assertEquals(0, c.pendingCount());
    }

    @Test
    void rejectsCompletionThatWasNotDelivered() {
        Checkpoint c = new Checkpoint(10);
        assertThrows(IllegalArgumentException.class, () -> c.markCompleted(11));
    }

    @Test
    void rejectsDuplicateCompletionAndOutOfOrderDelivery() {
        Checkpoint c = new Checkpoint(10);
        c.delivered(10);
        assertThrows(IllegalArgumentException.class, () -> c.delivered(10));
        c.markCompleted(10);
        assertThrows(IllegalArgumentException.class, () -> c.markCompleted(10));
    }

    @Test
    void reloadsInboxAndRejectsDuplicateEventId() throws Exception {
        java.nio.file.Path file = java.nio.file.Files.createTempFile("kafka-lab-inbox", ".log");
        try {
            InboxStore first = new InboxStore(file);
            assertEquals(true, first.applyOnce("evt-1", "amount=1"));
            InboxStore second = new InboxStore(file);
            assertEquals(false, second.applyOnce("evt-1", "amount=1"));
            assertThrows(IllegalArgumentException.class, () -> second.applyOnce("evt-1", "amount=changed"));
            assertEquals(true, second.applyOnce("evt-2", "amount=2\tline\nnext\\part"));
            InboxStore third = new InboxStore(file);
            assertEquals("amount=2\tline\nnext\\part", third.payload("evt-2"));
            assertEquals(2, third.size());
        } finally {
            java.nio.file.Files.deleteIfExists(file);
        }
    }
}
