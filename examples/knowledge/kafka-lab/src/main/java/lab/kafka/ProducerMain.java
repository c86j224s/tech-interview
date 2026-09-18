package lab.kafka;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;

import java.nio.charset.StandardCharsets;
import java.util.Properties;

/** Produces a finite, keyed sequence with an event-id header for inbox deduplication. */
public final class ProducerMain {
    public static void main(String[] args) throws Exception {
        int count = args.length == 0 ? 6 : Integer.parseInt(args[0]);
        if (count < 1 || count > 100) throw new IllegalArgumentException("count must be 1..100");
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:19092");
        Properties p = new Properties();
        p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        p.put(ProducerConfig.ACKS_CONFIG, "all");
        p.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, "true");
        p.put(ProducerConfig.CLIENT_ID_CONFIG, "lab-producer");
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(p)) {
            for (int i = 0; i < count; i++) {
                String eventId = "evt-" + i;
                ProducerRecord<String, String> record = new ProducerRecord<>("lab-events", "acct-7", "amount=" + (i + 1));
                record.headers().add("event-id", eventId.getBytes(StandardCharsets.UTF_8));
                var result = producer.send(record);
                if (eventId.equals(System.getenv("KILL_BEFORE_ACK_EVENT_ID"))) {
                    System.err.println("KILL_BEFORE_ACK eventId=" + eventId);
                    Runtime.getRuntime().halt(43);
                }
                RecordMetadata metadata = result.get();
                System.out.printf("eventId=%s partition=%d offset=%d%n", eventId, metadata.partition(), metadata.offset());
            }
            producer.flush();
        }
    }
}
