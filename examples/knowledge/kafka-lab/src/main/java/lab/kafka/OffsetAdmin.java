package lab.kafka;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;

import java.util.List;
import java.util.Map;
import java.util.Properties;

/** Reads the committed group offset as broker-coordinator evidence. */
public final class OffsetAdmin {
    private static final String TOPIC = "lab-events";
    private static final String GROUP = "lab-inbox";

    public static void main(String[] args) throws Exception {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:19092");
        Properties p = new Properties();
        p.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        try (Admin admin = Admin.create(p)) {
            Map<TopicPartition, OffsetAndMetadata> offsets = admin.listConsumerGroupOffsets(GROUP)
                    .partitionsToOffsetAndMetadata().get();
            OffsetAndMetadata offset = offsets.get(new TopicPartition(TOPIC, 0));
            if (offset == null) throw new IllegalStateException("no committed offset for " + GROUP);
            System.out.printf("group=%s partition=0 offset=%d%n", GROUP, offset.offset());
        }
    }
}
