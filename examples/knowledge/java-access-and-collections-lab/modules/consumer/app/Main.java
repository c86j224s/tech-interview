package app;

import provider.api.PublicApi;

public final class Main {
    private Main() {}

    public static void main(String[] args) {
        if (!"visible".equals(PublicApi.visible())) {
            throw new AssertionError("exported API mismatch");
        }
        System.out.println("PASS: exported public type is readable");
    }
}
