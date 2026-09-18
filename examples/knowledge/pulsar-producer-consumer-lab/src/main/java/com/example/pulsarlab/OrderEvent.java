package com.example.pulsarlab;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

public record OrderEvent(String eventId, String orderId, String customerId, String key, int amount, boolean poison) {
    public OrderEvent {
        if (eventId == null || eventId.isBlank() || orderId == null || orderId.isBlank() ||
                customerId == null || customerId.isBlank() || key == null || key.isBlank() || amount <= 0) {
            throw new IllegalArgumentException("event fields must be non-empty and amount must be positive");
        }
        for (String field : new String[]{eventId, orderId, customerId, key}) {
            if (!field.matches("[A-Za-z0-9._:-]{1,128}")) {
                throw new IllegalArgumentException("identity must be 1..128 simple ASCII characters");
            }
        }
    }

    public String encode() {
        return String.join("|", eventId, orderId, customerId, key, Integer.toString(amount), Boolean.toString(poison));
    }

    public byte[] bytes() {
        return encode().getBytes(StandardCharsets.UTF_8);
    }

    public String fingerprint() {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes()));
        } catch (NoSuchAlgorithmException impossible) {
            throw new AssertionError(impossible);
        }
    }

    public static OrderEvent decode(byte[] bytes) {
        if (bytes.length > 1024) throw new IllegalArgumentException("event payload exceeds 1024 bytes");
        String[] fields = new String(bytes, StandardCharsets.UTF_8).split("\\|", -1);
        if (fields.length != 6) {
            throw new IllegalArgumentException("expected six pipe-delimited fields");
        }
        if (!fields[5].equals("true") && !fields[5].equals("false")) throw new IllegalArgumentException("invalid poison flag");
        return new OrderEvent(fields[0], fields[1], fields[2], fields[3], Integer.parseInt(fields[4]), Boolean.parseBoolean(fields[5]));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof OrderEvent event && encode().equals(event.encode());
    }

    @Override
    public int hashCode() {
        return Objects.hash(encode());
    }
}
