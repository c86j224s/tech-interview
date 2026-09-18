package client;

import base.Base;
import nest.PrivateNest;

public final class AccessPass {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Sub sub = new Sub();
        check(Sub.readOwnQualifier(sub) == 1, "protected member through Sub qualifier");
        check(PrivateNest.Reader.read(new PrivateNest()) == 7, "private member through nested type");
        check(!java.lang.reflect.Modifier.isFinal(Base.class.getModifiers()), "Base remains extensible");
        System.out.println("PASS: protected qualifier, private nest access");
    }
}
