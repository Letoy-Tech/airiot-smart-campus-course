package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Set;

public final class Inputs {
    private Inputs() {}

    public static void fields(JsonNode body, String... allowed) {
        if (body == null || !body.isObject()) throw ApiFailure.bad();
        Set<String> names = Set.of(allowed);
        body.fieldNames()
                .forEachRemaining(
                        name -> {
                            if (!names.contains(name)) throw ApiFailure.bad();
                        });
    }

    public static String text(JsonNode body, String key, int max) {
        JsonNode value = body.get(key);
        if (value == null || !value.isTextual()) throw ApiFailure.bad();
        String s = value.textValue().strip();
        if (s.isEmpty() || s.length() > max) throw ApiFailure.bad();
        return s;
    }

    public static String nullableText(JsonNode body, String key, int max) {
        if (!body.has(key) || body.get(key).isNull()) return null;
        return text(body, key, max);
    }

    public static long version(JsonNode body) {
        JsonNode v = body.get("expectedVersion");
        if (v == null || !v.isIntegralNumber() || !v.canConvertToLong() || v.longValue() < 0)
            throw ApiFailure.bad();
        return v.longValue();
    }

    public static long integer(String s, long min, long max) {
        if (s == null || !s.matches("[0-9]+")) throw ApiFailure.bad();
        try {
            long n = Long.parseLong(s);
            if (n < min || n > max) throw ApiFailure.bad();
            return n;
        } catch (NumberFormatException e) {
            throw ApiFailure.bad();
        }
    }
}
