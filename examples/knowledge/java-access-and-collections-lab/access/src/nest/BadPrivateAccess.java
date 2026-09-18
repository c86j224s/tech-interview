package nest;

public class BadPrivateAccess {
    public static int read(PrivateNest owner) {
        return owner.value;
    }
}
