package com.example.pulsarlab;

import org.apache.pulsar.client.api.BatcherBuilder;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.TypedMessageBuilder;

import java.util.concurrent.TimeUnit;

public final class Producer implements AutoCloseable {
    private final PulsarClient client;
    private final org.apache.pulsar.client.api.Producer<byte[]> producer;

    public Producer(String serviceUrl, String topic) throws Exception {
        client = newClient(serviceUrl);
        var builder = client.newProducer().topic(topic).enableBatching(true).batchingMaxMessages(8);
        producer = builder.create();
    }

    public Producer(String serviceUrl, String topic, boolean keySharedBatching) throws Exception {
        client = newClient(serviceUrl);
        var builder = client.newProducer().topic(topic).enableBatching(true).batcherBuilder(BatcherBuilder.KEY_BASED);
        producer = builder.create();
    }

    public String send(OrderEvent event) throws Exception {
        TypedMessageBuilder<byte[]> message = producer.newMessage().key(event.key()).property("eventId", event.eventId()).value(event.bytes());
        return message.send().toString();
    }

    private static PulsarClient newClient(String serviceUrl) throws Exception {
        var builder = PulsarClient.builder().serviceUrl(serviceUrl).operationTimeout(10, TimeUnit.SECONDS);
        String listenerName = System.getenv("PULSAR_LISTENER_NAME");
        if (listenerName != null && !listenerName.isBlank()) {
            builder.listenerName(listenerName);
        }
        return builder.build();
    }

    @Override
    public void close() throws Exception {
        try {
            producer.close();
        } finally {
            client.close();
        }
    }
}
