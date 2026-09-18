package com.example.pulsarlab;

import java.io.EOFException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.zip.CRC32;

/**
 * A small durable inbox/effect ledger for the lab.
 *
 * Each committed effect is one length-prefixed, CRC-protected record containing
 * the event payload, eventId, payload fingerprint, and result. The record is
 * forced before apply returns. A partial final record from a process crash is
 * discarded on reopen. This is a teaching ledger, not a replacement for a
 * transactional database.
 */
public final class InboxStore implements AutoCloseable {
    private static final int MAGIC = 0x50494E42; // PINB
    private static final int HEADER_BYTES = 12;
    private static final int MAX_RECORD_BYTES = 1024 * 1024;
    private static final ConcurrentMap<Path, ReentrantLock> PROCESS_LOCKS = new ConcurrentHashMap<>();

    private final Path path;
    private final FileChannel channel;
    private final ReentrantLock processLock;
    private final Map<String, Entry> entries = new LinkedHashMap<>();

    public InboxStore() {
        try {
            Path temporary = Files.createTempFile("pulsar-inbox-", ".ledger");
            temporary.toFile().deleteOnExit();
            path = temporary.toAbsolutePath();
            processLock = PROCESS_LOCKS.computeIfAbsent(path, ignored -> new ReentrantLock());
            processLock.lock();
            try {
                channel = FileChannel.open(path, java.nio.file.StandardOpenOption.READ,
                        java.nio.file.StandardOpenOption.WRITE);
                try (FileLock ignored = channel.lock()) {
                    reloadAndRepair();
                }
            } catch (IOException | RuntimeException failure) {
                processLock.unlock();
                throw failure;
            }
            processLock.unlock();
        } catch (IOException failure) {
            throw new IllegalStateException("cannot create durable inbox ledger", failure);
        }
    }

    public InboxStore(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        this.path = normalized;
        this.processLock = PROCESS_LOCKS.computeIfAbsent(normalized, ignored -> new ReentrantLock());
        processLock.lock();
        FileChannel opened;
        try {
            Path parent = normalized.getParent();
            if (parent != null) Files.createDirectories(parent);
            opened = FileChannel.open(normalized, java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.READ, java.nio.file.StandardOpenOption.WRITE);
            this.channel = opened;
            try {
                try (FileLock ignored = channel.lock()) {
                    reloadAndRepair();
                }
            } catch (IOException | RuntimeException failure) {
                channel.close();
                throw failure;
            }
        } catch (IOException failure) {
            processLock.unlock();
            throw new IllegalStateException("cannot open durable inbox ledger: " + path, failure);
        } catch (RuntimeException failure) {
            processLock.unlock();
            throw failure;
        }
        processLock.unlock();
    }

    public synchronized Result apply(OrderEvent event) {
        processLock.lock();
        try (FileLock ignored = channel.lock()) {
            reloadAndRepair();
            Entry prior = entries.get(event.eventId());
            if (prior != null) {
                if (!prior.fingerprint().equals(event.fingerprint())) {
                    throw new IllegalStateException("event ID reused with a different payload: " + event.eventId());
                }
                return new Result(false, prior.result());
            }
            if (event.poison()) {
                throw new IllegalArgumentException("poison event: " + event.eventId());
            }
            String result = "applied:" + event.orderId();
            byte[] payload = encodeRecord(event.eventId(), event.encode(), event.fingerprint(), result);
            appendRecord(payload);
            entries.put(event.eventId(), new Entry(event.fingerprint(), result));
            return new Result(true, result);
        } catch (IOException failure) {
            throw new IllegalStateException("durable inbox commit failed: " + path, failure);
        } finally {
            processLock.unlock();
        }
    }

    public synchronized int effectCount() {
        return entries.size();
    }

    public synchronized int inboxSize() {
        return entries.size();
    }

    public Path path() {
        return path;
    }

    private void appendRecord(byte[] payload) throws IOException {
        if (payload.length < 1 || payload.length > MAX_RECORD_BYTES) {
            throw new IllegalArgumentException("inbox record exceeds maximum size");
        }
        ByteBuffer frame = ByteBuffer.allocate(HEADER_BYTES + payload.length);
        frame.putInt(MAGIC).putInt(payload.length).putInt(crc(payload)).put(payload).flip();
        long start = channel.size();
        while (frame.hasRemaining()) channel.write(frame, start + frame.position());
        channel.force(true);
    }

    private void reloadAndRepair() throws IOException {
        entries.clear();
        long position = 0;
        long size = channel.size();
        while (position < size) {
            long remaining = size - position;
            if (remaining < HEADER_BYTES) {
                channel.truncate(position);
                break;
            }
            ByteBuffer header = ByteBuffer.allocate(HEADER_BYTES);
            readFully(header, position);
            header.flip();
            int magic = header.getInt();
            int length = header.getInt();
            int expectedCrc = header.getInt();
            if (magic != MAGIC) {
                throw corruption(position, "invalid magic");
            }
            if (length < 1 || length > MAX_RECORD_BYTES) {
                throw corruption(position, "invalid record length: " + length);
            }
            if (size - position - HEADER_BYTES < length) {
                channel.truncate(position);
                break;
            }
            ByteBuffer body = ByteBuffer.allocate(length);
            readFully(body, position + HEADER_BYTES);
            body.flip();
            byte[] payload = new byte[length];
            body.get(payload);
            if (crc(payload) != expectedCrc) {
                throw corruption(position, "CRC mismatch");
            }
            decodeRecord(payload);
            position += HEADER_BYTES + (long) length;
        }
        channel.force(true);
    }

    private IllegalStateException corruption(long position, String detail) {
        return new IllegalStateException("corrupt inbox ledger at byte " + position + ": " + detail);
    }

    private void decodeRecord(byte[] payload) {
        String[] fields = new String(payload, StandardCharsets.UTF_8).split("\\t", -1);
        if (fields.length != 4) throw new IllegalStateException("invalid inbox ledger record");
        String eventId = decode(fields[0]);
        String eventPayload = decode(fields[1]);
        String fingerprint = decode(fields[2]);
        String result = decode(fields[3]);
        if (eventId.isBlank() || eventPayload.isBlank() || fingerprint.isBlank()) {
            throw new IllegalStateException("invalid inbox ledger identity");
        }
        entries.put(eventId, new Entry(fingerprint, result));
    }

    private static byte[] encodeRecord(String eventId, String eventPayload, String fingerprint, String result) {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        byte[] encoded = (encoder.encodeToString(eventId.getBytes(StandardCharsets.UTF_8)) + "\t"
                + encoder.encodeToString(eventPayload.getBytes(StandardCharsets.UTF_8)) + "\t"
                + encoder.encodeToString(fingerprint.getBytes(StandardCharsets.UTF_8)) + "\t"
                + encoder.encodeToString(result.getBytes(StandardCharsets.UTF_8)))
                .getBytes(StandardCharsets.UTF_8);
        if (encoded.length > MAX_RECORD_BYTES) {
            throw new IllegalArgumentException("inbox record exceeds maximum size");
        }
        return encoded;
    }

    private static String decode(String value) {
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }

    private static int crc(byte[] payload) {
        CRC32 checksum = new CRC32();
        checksum.update(payload);
        return (int) checksum.getValue();
    }

    private void readFully(ByteBuffer buffer, long position) throws IOException {
        while (buffer.hasRemaining()) {
            int read = channel.read(buffer, position + buffer.position());
            if (read < 0) throw new EOFException("truncated inbox ledger");
        }
    }

    @Override
    public synchronized void close() {
        processLock.lock();
        try {
            channel.close();
        } catch (IOException failure) {
            throw new IllegalStateException("cannot close durable inbox ledger", failure);
        } finally {
            processLock.unlock();
        }
    }

    private record Entry(String fingerprint, String result) { }
    public record Result(boolean effectApplied, String result) { }
}
