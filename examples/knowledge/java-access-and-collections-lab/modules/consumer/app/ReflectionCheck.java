package app;

public final class ReflectionCheck {
    public static void main(String[] args) throws Exception {
        var type = Class.forName("provider.internal.InternalApi");
        var method = type.getDeclaredMethod("secret");
        boolean opened = method.trySetAccessible();
        boolean expected = Boolean.parseBoolean(args[0]);
        if (opened != expected) throw new AssertionError("opens boundary: " + opened);
        if (opened && !"private-result".equals(method.invoke(null))) {
            throw new AssertionError("reflection result");
        }
        System.out.println("PASS reflection opens=" + opened);
    }
}
