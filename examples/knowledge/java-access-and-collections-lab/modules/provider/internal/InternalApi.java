package provider.internal;

public final class InternalApi {
    private InternalApi() {}

    private static String secret() { return "private-result"; }

    public static String hidden() {
        return "hidden";
    }
}
