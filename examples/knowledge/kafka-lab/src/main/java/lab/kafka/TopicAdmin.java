package lab.kafka;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;

import java.util.List;
import java.util.Map;
import java.util.Properties;

/** Creates the finite lab topic and never enables implicit topic creation. */
public final class TopicAdmin {
    public static void main(String[] args) throws Exception {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP", "localhost:19092");
        Properties p = new Properties();
        p.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        try (Admin admin = Admin.create(p)) {
            admin.createTopics(List.of(new NewTopic("lab-events", 1, (short) 1)
                    .configs(Map.of("retention.ms", "600000")))).all().get();
        }
        System.out.println("created topic=lab-events partitions=1 replicationFactor=1");
    }
}
