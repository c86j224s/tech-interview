module provider.open {
    exports provider.api;
    opens provider.internal to consumer.open;
}
