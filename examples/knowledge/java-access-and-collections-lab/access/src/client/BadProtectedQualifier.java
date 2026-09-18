package client;

import base.Base;

public class BadProtectedQualifier extends Base {
    public static int read(Base base) {
        return base.value;
    }
}
