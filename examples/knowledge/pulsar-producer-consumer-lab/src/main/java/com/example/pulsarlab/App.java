package com.example.pulsarlab;

import org.apache.pulsar.client.api.SubscriptionType;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

public final class App {
    private App() { }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            throw new IllegalArgumentException("usage: App producer|consumer serviceUrl [topic] [subscription] [type] [keyBasedBatching]");
        }
        String role = args[0];
        String serviceUrl = args[1];
        String topic = args.length > 2 ? args[2] : "persistent://public/default/orders";
        if (role.equals("producer")) {
            boolean keySharedBatching = args.length > 3 && Boolean.parseBoolean(args[3]);
            int count = args.length > 4 ? Integer.parseInt(args[4]) : 3;
            if (count < 1 || count > 1000) throw new IllegalArgumentException("producer count must be 1..1000");
            try (Producer producer = keySharedBatching
                    ? new Producer(serviceUrl, topic, true)
                    : new Producer(serviceUrl, topic)) {
                String suffix = Long.toUnsignedString(System.nanoTime());
                for (int i = 1; i <= count; i++) {
                    OrderEvent event = new OrderEvent("evt-" + suffix + "-" + i, "order-" + i, "customer-1", "customer-1", i * 100, false);
                    System.out.printf("SEND eventId=%s messageId=%s%n", event.eventId(), producer.send(event));
                }
            }
            return;
        }
        if (role.equals("consumer")) {
            String subscription = args.length > 3 ? args[3] : "orders-shared";
            SubscriptionType type = args.length > 4 ? SubscriptionType.valueOf(args[4]) : SubscriptionType.Shared;
            Path ledger = Path.of(System.getenv().getOrDefault("PULSAR_INBOX_LEDGER", "var/inbox.ledger"));
            try (InboxStore inbox = new InboxStore(ledger);
                 Consumer consumer = new Consumer(serviceUrl, topic, subscription, type, inbox)) {
                long seconds = Long.parseLong(System.getenv().getOrDefault("PULSAR_CONSUMER_SECONDS", "20"));
                if (seconds < 1 || seconds > 180) throw new IllegalArgumentException("consumer seconds must be 1..180");
                long idleDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
                while (System.nanoTime() < idleDeadline) {
                    consumer.receiveAndProcess(1, TimeUnit.SECONDS);
                }
                System.out.printf("SUMMARY effects=%d inbox=%d ledger=%s%n", inbox.effectCount(), inbox.inboxSize(), inbox.path());
            }
            return;
        }
        throw new IllegalArgumentException("role must be producer or consumer");
    }
}
