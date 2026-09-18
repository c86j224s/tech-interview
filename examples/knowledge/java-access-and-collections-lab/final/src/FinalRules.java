public final class FinalRules {
    private FinalRules() {}

    public final void stable() {
        System.out.println("stable");
    }

    public static void main(String[] args) {
        if (!java.lang.reflect.Modifier.isFinal(FinalRules.class.getModifiers())) {
            throw new AssertionError("class must be final");
        }
        try {
            if (!java.lang.reflect.Modifier.isFinal(FinalRules.class.getDeclaredMethod("stable").getModifiers())) {
                throw new AssertionError("method must be final");
            }
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
        System.out.println("PASS: final class and final method modifiers observed");
    }
}
