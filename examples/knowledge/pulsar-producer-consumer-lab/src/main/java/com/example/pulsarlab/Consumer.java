package com.example.pulsarlab;

import org.apache.pulsar.client.api.DeadLetterPolicy;
import org.apache.pulsar.client.api.Message;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.SubscriptionInitialPosition;
import org.apache.pulsar.client.api.SubscriptionType;

import java.util.concurrent.TimeUnit;

public final class Consumer implements AutoCloseable {
    private final PulsarClient client;
    private final org.apache.pulsar.client.api.Consumer<byte[]> consumer;
    private final SubscriptionType type;
    private final InboxStore inbox;

    public Consumer(String serviceUrl, String topic, String subscription, SubscriptionType type, InboxStore inbox) throws Exception {
        this.type = type;
        this.inbox = inbox;
        var clientBuilder = PulsarClient.builder().serviceUrl(serviceUrl).operationTimeout(10, TimeUnit.SECONDS);
        String listenerName = System.getenv("PULSAR_LISTENER_NAME");
        if (listenerName != null && !listenerName.isBlank()) {
            clientBuilder.listenerName(listenerName);
        }
        client = clientBuilder.build();
        var dlq = DeadLetterPolicy.builder()
                .maxRedeliverCount(3)
                .deadLetterTopic(topic + "-" + subscription + "-DLQ")
                .retryLetterTopic(topic + "-" + subscription + "-RETRY")
                .build();
        var builder = client.newConsumer().topic(topic).subscriptionName(subscription).subscriptionType(type)
                .subscriptionInitialPosition(SubscriptionInitialPosition.Earliest)
                .ackTimeout(30, TimeUnit.SECONDS).receiverQueueSize(16);
        if (type == SubscriptionType.Shared) {
            builder = builder.enableRetry(true).deadLetterPolicy(dlq);
        }
        try {
            consumer = builder.subscribe();
            System.out.printf("READY subscription=%s type=%s%n", subscription, type);
        } catch (Exception failure) {
            client.close();
            throw failure;
        }
    }

    public boolean receiveAndProcess(int timeout, TimeUnit unit) throws Exception {
        Message<byte[]> message = consumer.receive(timeout, unit);
        if (message == null) return false;
        try {
            OrderEvent event = OrderEvent.decode(message.getData());
            InboxStore.Result result = inbox.apply(event);
            System.out.printf("COMMIT eventId=%s applied=%s messageId=%s redelivery=%d%n",
                    event.eventId(), result.effectApplied(), message.getMessageId(), message.getRedeliveryCount());
            long ackDelayMillis = Long.parseLong(System.getenv().getOrDefault("PULSAR_ACK_DELAY_MS", "0"));
            if (ackDelayMillis < 0 || ackDelayMillis > 10_000) throw new IllegalArgumentException("ACK delay must be 0..10000 ms");
            if (ackDelayMillis > 0) Thread.sleep(ackDelayMillis);
            consumer.acknowledge(message);
            System.out.printf("ACK eventId=%s applied=%s result=%s messageId=%s%n", event.eventId(), result.effectApplied(), result.result(), message.getMessageId());
        } catch (RuntimeException failure) {
            System.err.printf("NACK eventId=%s error=%s%n", message.getProperty("eventId"), failure.getMessage());
            if (type == SubscriptionType.Shared) {
                consumer.reconsumeLater(message, 1, TimeUnit.SECONDS);
            } else {
                consumer.negativeAcknowledge(message);
            }
        }
        return true;
    }

    @Override
    public void close() throws Exception {
        try {
            consumer.close();
        } finally {
            client.close();
        }
    }
}
