package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

final class CampusJson {
    private CampusJson() { }
    static String text(JsonNode node) {
        if (node == null || node.isNull() || !node.isValueNode()) return null;
        String value = node.asText().trim();
        return value.isEmpty() ? null : value;
    }
    static String firstText(JsonNode row, String... fields) {
        for (String field : fields) {
            String value = text(row.get(field));
            if (value != null) return value;
        }
        return null;
    }
    static Boolean bool(JsonNode node) {
        return node != null && node.isBoolean() ? node.booleanValue() : null;
    }
    static Double number(JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            if (!node.isNumber() && !node.isTextual()) return null;
            double value = node.isNumber() ? node.doubleValue() : Double.parseDouble(node.textValue().trim());
            return Double.isFinite(value) ? value : null;
        } catch (NumberFormatException exception) { return null; }
    }
    static Long time(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isIntegralNumber() || (node.isTextual() && node.textValue().matches("[0-9]+"))) {
            try {
                long value = node.isIntegralNumber() ? node.longValue() : Long.parseLong(node.textValue());
                if (value <= 0) return null;
                // AIRIOT variants use epoch seconds or milliseconds; all MG responses use milliseconds.
                return value < 100_000_000_000L ? Math.multiplyExact(value, 1000L) : value;
            } catch (ArithmeticException | NumberFormatException exception) { return null; }
        }
        if (node.isTextual()) {
            try { return Instant.parse(node.textValue()).toEpochMilli(); }
            catch (DateTimeParseException ignored) {
                try { return OffsetDateTime.parse(node.textValue()).toInstant().toEpochMilli(); }
                catch (DateTimeParseException exception) { return null; }
            }
        }
        return null;
    }
    static String reference(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isObject()) return firstText(node, "id", "_id");
        return text(node);
    }
}
