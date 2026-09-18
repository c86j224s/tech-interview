package lab.kafka;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

/** Single-partition Kafka consumer; effects are inbox-gated and commits are contiguous. */
public final class InboxWorker {
    private static final String TOPIC = "lab-events";
    private static final String GROUP = "lab-inbox";
    private static final int PARTITION = 0;

    public static void main(String[] args) {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:19092");
        String stopAfter = System.getenv("STOP_AFTER_EVENT_ID");
        boolean killBeforeCommit = Boolean.parseBoolean(System.getenv().getOrDefault("KILL_BEFORE_COMMIT", "false"));
        int maxRecords = Integer.parseInt(System.getenv().getOrDefault("MAX_RECORDS", "0"));
        long idleDeadlineMs = Long.parseLong(System.getenv().getOrDefault("IDLE_DEADLINE_MS", "30000"));
        long totalDeadlineMs = Long.parseLong(System.getenv().getOrDefault("TOTAL_DEADLINE_MS", "120000"));
        if (maxRecords < 0 || maxRecords > 1000) throw new IllegalArgumentException("MAX_RECORDS must be 0..1000");
        if (idleDeadlineMs < 1 || totalDeadlineMs < idleDeadlineMs) throw new IllegalArgumentException("invalid deadlines");
        Properties p = new Properties();
        p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        p.put(ConsumerConfig.GROUP_ID_CONFIG, GROUP);
        p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        p.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        p.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "10");
        p.put(ConsumerConfig.CLIENT_ID_CONFIG, "lab-inbox-worker");

        AtomicBoolean closing = new AtomicBoolean(false);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> closing.set(true), "shutdown-hook"));
        InboxStore inbox = new InboxStore();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(p)) {
            Map<TopicPartition, Checkpoint> checkpoints = new HashMap<>();
            LoggingRebalanceListener listener = new LoggingRebalanceListener(checkpoints);
            consumer.subscribe(List.of(TOPIC), listener);
            long startedAt = System.nanoTime();
            long lastRecordAt = startedAt;
            while (!closing.get()) {
                long now = System.nanoTime();
                if (elapsedMs(startedAt, now) >= totalDeadlineMs || elapsedMs(lastRecordAt, now) >= idleDeadlineMs) {
                    throw new IllegalStateException("consumer deadline expired");
                }
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(250));
                if (records.isEmpty()) continue;
                lastRecordAt = System.nanoTime();
                for (var record : records) {
                    if (record.partition() != PARTITION) throw new IllegalStateException("fixture only supports partition 0");
                    TopicPartition topicPartition = new TopicPartition(record.topic(), record.partition());
                    Checkpoint checkpoint = checkpoints.computeIfAbsent(topicPartition, ignored -> new Checkpoint(record.offset()));
                    checkpoint.delivered(record.offset());
                    var header = record.headers().lastHeader("event-id");
                    String eventId = header == null
                            ? record.key() + "@" + record.offset()
                            : new String(header.value(), StandardCharsets.UTF_8);
                    boolean applied = inbox.applyOnce(eventId, record.value());
                    System.out.printf("eventId=%s partition=%d offset=%d inboxApplied=%s nextCandidate=%d%n",
                            eventId, record.partition(), record.offset(), applied, checkpoint.nextCommit());
                    checkpoint.markCompleted(record.offset());
                    if (maxRecords > 0 && inbox.size() >= maxRecords) closing.set(true);
                    if (eventId.equals(stopAfter)) {
                        if (killBeforeCommit) {
                            System.err.println("KILL_BEFORE_COMMIT eventId=" + eventId);
                            Runtime.getRuntime().halt(42);
                        }
                        closing.set(true);
                        break;
                    }
                }
                Checkpoint checkpoint = checkpoints.get(new TopicPartition(TOPIC, PARTITION));
                if (checkpoint != null && checkpoint.nextCommit() > 0) commitContiguous(consumer, checkpoint.nextCommit());
            }
        }
    }

    private static long elapsedMs(long start, long now) {
        return Duration.ofNanos(now - start).toMillis();
    }

    private static void commitContiguous(KafkaConsumer<String, String> consumer, long offset) {
        TopicPartition tp = new TopicPartition(TOPIC, PARTITION);
        consumer.commitSync(Map.of(tp, new OffsetAndMetadata(offset)));
        System.out.printf("committed partition=%d offset=%d%n", tp.partition(), offset);
    }

    private static final class LoggingRebalanceListener implements ConsumerRebalanceListener {
        private final Map<TopicPartition, Checkpoint> checkpoints;

        private LoggingRebalanceListener(Map<TopicPartition, Checkpoint> checkpoints) {
            this.checkpoints = checkpoints;
        }

        @Override
        public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
            for (TopicPartition partition : partitions) checkpoints.remove(partition);
            System.out.printf("rebalance revoked=%s checkpointReset=true%n", partitions);
        }

        @Override
        public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
            for (TopicPartition partition : partitions) checkpoints.remove(partition);
            System.out.printf("rebalance assigned=%s checkpointReset=true%n", partitions);
        }

        @Override
        public void onPartitionsLost(Collection<TopicPartition> partitions) {
            for (TopicPartition partition : partitions) checkpoints.remove(partition);
            System.out.printf("rebalance lost=%s checkpointReset=true%n", partitions);
        }
    }
}
