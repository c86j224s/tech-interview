package nest;

public class PrivateNest {
    private int value = 7;

    public static class Reader {
        public static int read(PrivateNest owner) {
            return owner.value;
        }
    }
}
