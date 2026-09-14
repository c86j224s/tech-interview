import java.lang.annotation.*;
import java.util.*;
import java.util.concurrent.*;

public final class VerifyJavaStudy {
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    static class A { String label = "A"; String f(Object v) { return "A:Object"; } }
    static class B extends A {
        String label = "B";
        @Override String f(Object v) { return "B:Object"; }
        String f(String v) { return "B:String"; }
    }
    static class Box<T> { void put(T value) {} }
    static class TextBox extends Box<String> { @Override void put(String value) {} }
    @Retention(RetentionPolicy.RUNTIME) @Target(ElementType.TYPE)
    @Repeatable(Marks.class) @interface Mark { String value(); }
    @Retention(RetentionPolicy.RUNTIME) @Target(ElementType.TYPE)
    @interface Marks { Mark[] value(); }
    @Mark("a") @Mark("b") static class Marked {}
    static final ThreadLocal<String> USER = new ThreadLocal<>();
    static final class Counter {
        private int value;
        synchronized void increment() { value++; }
        synchronized int get() { return value; }
    }
    static class Resource implements AutoCloseable {
        @Override public void close() { throw new IllegalStateException("close"); }
    }
    @SuppressWarnings({"rawtypes", "unchecked"})
    public static void main(String[] args) throws Exception {
        Integer x = 127, y = 127;
        check(x == y, "constant boxing identity");
        Integer absent = null;
        boolean unboxingFailed = false;
        try { int ignored = absent + 1; }
        catch (NullPointerException expected) { unboxingFailed = true; }
        check(unboxingFailed, "null unboxing");
        check(!Objects.equals(Integer.valueOf(1), Long.valueOf(1)), "wrapper type equality");
        int[] calls = {0};
        Optional.of(1).orElseGet(() -> { calls[0]++; return 2; });
        check(calls[0] == 0, "lazy default");
        A a = new B();
        check(a.f("hi").equals("B:Object"), "overload then override");
        check(((B)a).f("hi").equals("B:String"), "cast changes overload");
        check(a.label.equals("A") && ((B)a).label.equals("B"), "field hiding");
        check(Arrays.stream(TextBox.class.getDeclaredMethods()).anyMatch(m -> m.isBridge()), "bridge exists");
        List<String> strings = new ArrayList<>();
        List raw = strings;
        raw.add(1);
        boolean castFailed = false;
        try { String ignored = strings.get(0); }
        catch (ClassCastException expected) { castFailed = true; }
        check(castFailed, "raw heap pollution");
        check(Marked.class.getAnnotationsByType(Mark.class).length == 2, "repeatable lookup");
        var source = new ArrayList<String>();
        source.add("Java");
        var view = Collections.unmodifiableList(source);
        var copy = List.copyOf(source);
        source.add("JVM");
        check(view.size() == 2 && copy.size() == 1, "view vs copy");
        var mutable = new StringBuilder("a");
        var immutableList = List.copyOf(List.of(mutable));
        mutable.append("b");
        check(immutableList.get(0).toString().equals("ab"), "element remains mutable");
        try (var pool = Executors.newSingleThreadExecutor()) {
            pool.submit(() -> { USER.set("A"); try { check(USER.get().equals("A"), "context set"); } finally { USER.remove(); } }).get();
            check(pool.submit(() -> USER.get()).get() == null, "thread local cleared");
        }
        var counter = new Counter();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 4; i++) futures.add(pool.submit(() -> {
                for (int j = 0; j < 1000; j++) counter.increment();
            }));
            for (var future : futures) future.get();
        }
        check(counter.get() == 4000, "monitor counter");
        check(CompletableFuture.completedFuture(2).thenCompose(v -> CompletableFuture.completedFuture(v * 3)).join() == 6, "compose");
        try (var resource = new Resource()) { throw new IllegalArgumentException("body"); }
        catch (IllegalArgumentException expected) {
            check(expected.getSuppressed().length == 1, "suppressed close failure");
        }
        System.out.println(System.getProperty("java.version") + " PASS: boxing, dispatch, bridge, annotations, copies, ThreadLocal, monitor, virtual-thread tasks, cleanup");
        System.out.println("Scope: bounded functional examples; not JMM proof, JFR/JMH, class-loader leak or production I/O validation");
    }
}
