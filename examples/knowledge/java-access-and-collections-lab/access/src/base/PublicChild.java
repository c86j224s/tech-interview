package base;

class HiddenParent {
    public String inherited() { return "inherited-public"; }
}

public final class PublicChild extends HiddenParent {}
