package client;

import base.PackageOnly;

public class BadPackageAccess {
    public static String read() {
        return PackageOnly.value();
    }
}
