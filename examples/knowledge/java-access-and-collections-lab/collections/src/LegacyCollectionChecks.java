import java.util.ArrayList;
import java.util.Collections;
import java.util.ConcurrentModificationException;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.List;
import java.util.Vector;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class LegacyCollectionChecks {
    private LegacyCollectionChecks() {}

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void expect(Class<? extends Throwable> type, Runnable action, String name) {
        try {
            action.run();
        } catch (Throwable actual) {
            check(type.isInstance(actual), name + " threw " + actual);
            return;
        }
        throw new AssertionError(name + " did not throw " + type.getSimpleName());
    }

    private static void synchronizedWrapperNeedsTraversalLock() {
        List<String> backing = new ArrayList<>();
        List<String> list = Collections.synchronizedList(backing);
        list.add("A");
        synchronized (list) {
            Iterator<String> iterator = list.iterator();
            check(iterator.next().equals("A"), "locked wrapper traversal");
        }
        backing.add("B");
        check(list.size() == 2, "wrapper is backed by source");
    }

    private static void vectorIteratorIsBestEffortFailFast() {
        Vector<String> vector = new Vector<>();
        vector.add("A");
        Iterator<String> iterator = vector.iterator();
        vector.add("B");
        expect(ConcurrentModificationException.class, iterator::next, "Vector iterator");
    }

    private static void vectorEnumerationIsNotFailFast() {
        Vector<String> vector = new Vector<>();
        vector.add("A");
        java.util.Enumeration<String> enumeration = vector.elements();
        vector.add("B");
        int count = 0;
        while (enumeration.hasMoreElements()) {
            enumeration.nextElement();
            count++;
        }
        check(count >= 1, "Vector enumeration returned elements");
    }

    private static void hashtableRejectsNullAndUsesLegacyEnumeration() {
        Hashtable<String, String> table = new Hashtable<>();
        expect(NullPointerException.class, () -> table.put(null, "value"), "Hashtable null key");
        table.put("A", "one");
        java.util.Enumeration<String> keys = table.keys();
        check(keys.hasMoreElements() && keys.nextElement().equals("A"), "Hashtable key enumeration");
    }

    private static void copyOnWriteIteratorIsSnapshot() {
        CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>(List.of("A", "B"));
        Iterator<String> iterator = list.iterator();
        list.add("C");
        check(iterator.next().equals("A"), "snapshot first");
        check(iterator.next().equals("B"), "snapshot second");
        check(!iterator.hasNext(), "snapshot excludes later add");
        expect(UnsupportedOperationException.class, iterator::remove, "CopyOnWrite iterator remove");
    }

    private static void concurrentQueueIteratorIsWeaklyConsistent() {
        ConcurrentLinkedQueue<String> queue = new ConcurrentLinkedQueue<>();
        queue.add("A");
        Iterator<String> iterator = queue.iterator();
        queue.add("B");
        check(iterator.hasNext(), "queue iterator remains usable");
    }

    public static void main(String[] args) {
        synchronizedWrapperNeedsTraversalLock();
        vectorIteratorIsBestEffortFailFast();
        vectorEnumerationIsNotFailFast();
        hashtableRejectsNullAndUsesLegacyEnumeration();
        copyOnWriteIteratorIsSnapshot();
        concurrentQueueIteratorIsWeaklyConsistent();
        System.out.println("PASS: synchronized wrapper, Vector, Hashtable, CopyOnWriteArrayList, ConcurrentLinkedQueue");
        System.out.println("Scope: API contracts and deterministic local checks; not a proof of all concurrent schedules");
    }
}
