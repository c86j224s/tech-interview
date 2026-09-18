package lab.kafka;

import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;

/** Computes the next safe commit from delivered order and completed offsets. */
public final class Checkpoint {
    private final ArrayDeque<Long> delivered = new ArrayDeque<>();
    private final Set<Long> completed = new HashSet<>();
    private long nextCommit;

    public Checkpoint(long initialOffset) {
        if (initialOffset < 0) throw new IllegalArgumentException("initialOffset must be non-negative");
        nextCommit = initialOffset;
    }

    public void delivered(long offset) {
        if (offset < nextCommit) throw new IllegalArgumentException("offset precedes checkpoint");
        if (!delivered.isEmpty() && offset <= delivered.peekLast()) {
            throw new IllegalArgumentException("offsets must be delivered in order");
        }
        delivered.addLast(offset);
    }

    public long markCompleted(long offset) {
        if (!delivered.contains(offset)) throw new IllegalArgumentException("offset was not delivered");
        if (!completed.add(offset)) throw new IllegalArgumentException("offset was already completed");
        while (!delivered.isEmpty() && completed.remove(delivered.peekFirst())) {
            nextCommit = delivered.removeFirst() + 1;
        }
        return nextCommit;
    }

    public long nextCommit() { return nextCommit; }
    public int pendingCount() { return delivered.size(); }
}
