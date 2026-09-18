package client;

import base.Base;

public class Sub extends Base {
    public static int readOwnQualifier(Sub sub) {
        return sub.value;
    }

    // Kept as a documented contrast; the compiling failure case is BadProtectedQualifier.java.
}
