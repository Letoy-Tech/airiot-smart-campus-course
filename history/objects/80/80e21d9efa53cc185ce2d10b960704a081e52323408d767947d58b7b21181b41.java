package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;

public final class QualityPolicy {
    public static final long MAX_EPOCH = 8_640_000_000_000_000L;

    private QualityPolicy() {}

    public static boolean time(JsonNode n) {
        return n != null
                && n.isIntegralNumber()
                && n.canConvertToLong()
                && n.longValue() >= 0
                && n.longValue() <= MAX_EPOCH;
    }

    public static boolean value(JsonNode n) {
        return n != null && n.isNumber() && Double.isFinite(n.doubleValue());
    }

    private static boolean missing(JsonNode n) {
        return n == null || n.isNull();
    }

    public static String classify(JsonNode value, JsonNode time, long observedAt) {
        // STUDENT_TODO_C07_BEGIN
        return "missing"; // TODO-C07：仅为可编译起点，须按合同实现所有质量分支。
        // STUDENT_TODO_C07_END
    }
}
