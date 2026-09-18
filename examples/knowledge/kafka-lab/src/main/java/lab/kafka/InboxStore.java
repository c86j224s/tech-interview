package lab.kafka;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Durable file-backed stand-in for an inbox unique constraint; not a DB transaction. */
public final class InboxStore {
    private static final String VERSION = "v1";
    private static final int MAX_EVENT_ID_BYTES = 256;
    private static final int MAX_PAYLOAD_BYTES = 16 * 1024;
    private static final long MAX_FILE_BYTES = 8L * 1024 * 1024;

    private final Map<String, String> applied = new LinkedHashMap<>();
    private final Path file;

    public InboxStore() {
        this(Path.of(System.getenv().getOrDefault("INBOX_FILE", ".lab-inbox/events.log")));
    }

    public InboxStore(Path file) {
        if (file == null) throw new IllegalArgumentException("file must not be null");
        this.file = file;
        load();
    }

    public synchronized boolean applyOnce(String eventId, String payload) {
        validate(eventId, payload);
        String existing = applied.get(eventId);
        if (existing != null) {
            if (!existing.equals(payload)) throw new IllegalArgumentException("eventId has a different payload");
            return false;
        }
        Map<String, String> next = new LinkedHashMap<>(applied);
        next.put(eventId, payload);
        persist(next);
        applied.put(eventId, payload);
        return true;
    }

    public synchronized int size() { return applied.size(); }
    public synchronized String payload(String eventId) { return applied.get(eventId); }

    private void load() {
        if (!Files.exists(file)) return;
        try {
            if (Files.size(file) > MAX_FILE_BYTES) throw new IllegalStateException("inbox file exceeds bound");
            byte[] bytes = Files.readAllBytes(file);
            if (bytes.length > 0 && bytes[bytes.length - 1] != '\n') {
                throw new IllegalStateException("inbox file ends with an incomplete record");
            }
            String content = new String(bytes, StandardCharsets.UTF_8);
            for (String line : content.split("\\n", -1)) {
                if (!line.isEmpty()) loadRecord(line);
            }
        } catch (IOException e) {
            throw new IllegalStateException("inbox load failed", e);
        }
    }

    private void loadRecord(String line) {
        String[] fields = line.split("\\t", -1);
        if (fields.length != 4 || !VERSION.equals(fields[0])) {
            throw new IllegalStateException("invalid inbox record");
        }
        try {
            String eventId = new String(HexFormat.of().parseHex(fields[1]), StandardCharsets.UTF_8);
            String payload = new String(HexFormat.of().parseHex(fields[2]), StandardCharsets.UTF_8);
            validate(eventId, payload);
            if (!checksum(eventId, payload).equals(fields[3])) throw new IllegalStateException("inbox checksum mismatch");
            String previous = applied.putIfAbsent(eventId, payload);
            if (previous != null && !previous.equals(payload)) {
                throw new IllegalStateException("eventId has a different payload");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("invalid inbox encoding", e);
        }
    }

    private void persist(Map<String, String> next) {
        Path parent = file.toAbsolutePath().getParent();
        try {
            if (parent != null) Files.createDirectories(parent);
            StringBuilder content = new StringBuilder();
            for (Map.Entry<String, String> entry : next.entrySet()) {
                content.append(VERSION).append('\t')
                        .append(hex(entry.getKey())).append('\t')
                        .append(hex(entry.getValue())).append('\t')
                        .append(checksum(entry.getKey(), entry.getValue())).append('\n');
            }
            byte[] bytes = content.toString().getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_FILE_BYTES) throw new IllegalStateException("inbox file exceeds bound");
            Path temp = file.resolveSibling(file.getFileName() + "." + UUID.randomUUID() + ".tmp");
            try {
                try (FileChannel channel = FileChannel.open(temp, StandardOpenOption.CREATE_NEW,
                        StandardOpenOption.WRITE)) {
                    ByteBuffer buffer = ByteBuffer.wrap(bytes);
                    while (buffer.hasRemaining()) channel.write(buffer);
                    channel.force(true);
                }
                try {
                    Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException e) {
                    throw new IOException("this lab requires atomic replacement on one filesystem", e);
                }
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException e) {
            throw new IllegalStateException("inbox atomic replace failed", e);
        }
    }

    private static void validate(String eventId, String payload) {
        if (eventId == null || eventId.isBlank()) throw new IllegalArgumentException("eventId must not be blank");
        if (payload == null) throw new IllegalArgumentException("payload must not be null");
        if (eventId.getBytes(StandardCharsets.UTF_8).length > MAX_EVENT_ID_BYTES) {
            throw new IllegalArgumentException("eventId exceeds bound");
        }
        if (payload.getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            throw new IllegalArgumentException("payload exceeds bound");
        }
    }

    private static String hex(String value) {
        return HexFormat.of().formatHex(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String checksum(String eventId, String payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(eventId.getBytes(StandardCharsets.UTF_8));
            digest.update((byte) 0);
            digest.update(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError(e);
        }
    }
}
