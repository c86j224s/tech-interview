package app;

import provider.internal.InternalApi;

public final class BadMain {
    public static void main(String[] args) {
        System.out.println(InternalApi.hidden());
    }
}
