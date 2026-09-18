package client;

import base.PublicChild;

public final class InheritedAccess {
    public static void main(String[] args) {
        if (!"inherited-public".equals(new PublicChild().inherited())) {
            throw new AssertionError("public inherited method");
        }
        System.out.println("PASS public inherited member through accessible subclass");
    }
}
