package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.time.Clock;
import java.util.*;

/** Immutable, invented read samples. No commands are sent and no business rows are written. */
final class TeachingReadSamples {
    static final String SOURCE = "TEACHING_MOCK";
    static final String AUDIT_KIND = "HISTORICAL_TEACHING_SAMPLE";

    record RawAlarm(
            String id, String deviceId, String deviceName, String tableId, String tagId,
            String message, Long time, Long recoveryTime, String status, String level,
            boolean simulated, String source, Long occurredAt, Long recoveredAt) {}

    record CommandAudit(
            String id, String actorId, String actorName, String deviceId, String tableId,
            Boolean before, boolean requested, Boolean confirmed, String outcome, String reason,
            long createdAt, String error, String source, boolean simulated, String sampleKind) {}

    private final CatalogReader catalog;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final List<RawAlarm> alarms;
    private final List<CommandAudit> audit;

    TeachingReadSamples(CatalogReader catalog, ObjectMapper mapper, Clock clock) {
        this.catalog = catalog;
        this.mapper = mapper;
        this.clock = clock;
        alarms = readAlarms();
        audit = readAudit();
    }

    JsonNode read(String name, String kind) {
        var file = catalog.directory().resolve(name);
        if (!Files.exists(file)) return null;
        try {
            require(Files.isRegularFile(file) && Files.size(file) <= 1_048_576);
            JsonNode root = mapper.readTree(file.toFile());
            require(root.isObject() && root.path("schemaVersion").isInt()
                    && root.path("schemaVersion").intValue() == 1);
            require(kind.equals(text(root, "kind")));
            marked(root);
            require(QualityPolicy.time(root.get("observedAt"))
                    && root.path("observedAt").longValue() == catalog.allSpaces().observedAt());
            return root;
        } catch (Exception e) {
            throw new IllegalStateException("Invalid teaching read fixture: " + name);
        }
    }

    private List<RawAlarm> readAlarms() {
        JsonNode root = read("raw-alarms.json", "RAW_ALARM_SAMPLES");
        if (root == null) return null;
        require(root.path("items").isArray());
        List<RawAlarm> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode n : root.path("items")) {
            marked(n);
            String id = text(n, "id");
            require(ids.add(id));
            String deviceId = nullableText(n, "deviceId");
            String tableId = nullableText(n, "tableId");
            String tagId = nullableText(n, "tagId");
            reference(deviceId, tableId, tagId);
            Long occurred = timestamp(n, "occurredAt"), recovered = timestamp(n, "recoveredAt");
            require(recovered == null || (occurred != null && recovered >= occurred));
            result.add(new RawAlarm(id, deviceId, nullableText(n, "deviceName"), tableId, tagId,
                    text(n, "message"), occurred, recovered, text(n, "status"), text(n, "level"),
                    true, SOURCE, occurred, recovered));
        }
        result.sort(Comparator.comparing(RawAlarm::occurredAt,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(RawAlarm::id, Comparator.reverseOrder()));
        return List.copyOf(result);
    }

    private List<CommandAudit> readAudit() {
        JsonNode root = read("command-audit.json", "COMMAND_AUDIT_SAMPLES");
        if (root == null) return null;
        require(AUDIT_KIND.equals(text(root, "sampleKind")) && root.path("items").isArray());
        List<CommandAudit> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode n : root.path("items")) {
            marked(n);
            require(AUDIT_KIND.equals(text(n, "sampleKind")));
            String id = text(n, "id");
            require(ids.add(id));
            String deviceId = text(n, "deviceId"), tableId = text(n, "tableId");
            reference(deviceId, tableId, null);
            Long created = timestamp(n, "createdAt");
            require(created != null && n.path("requested").isBoolean());
            result.add(new CommandAudit(id, text(n, "actorId"), text(n, "actorName"), deviceId,
                    tableId, bool(n, "before"), n.path("requested").booleanValue(),
                    bool(n, "confirmed"), text(n, "outcome"), text(n, "reason"), created,
                    nullableText(n, "error"), SOURCE, true, AUDIT_KIND));
        }
        result.sort(Comparator.comparingLong(CommandAudit::createdAt).reversed()
                .thenComparing(CommandAudit::id, Comparator.reverseOrder()));
        return List.copyOf(result);
    }

    Map<String, Object> alarms(int limit, int skip, String scenario) {
        return page(alarms, limit, skip, scenario, false);
    }

    Map<String, Object> audit(int limit, int skip, String scenario) {
        return page(audit, limit, skip, scenario, true);
    }

    private Map<String, Object> page(
            List<?> rows, int limit, int skip, String scenario, boolean historicalAudit) {
        if (limit < 1 || limit > 100 || skip < 0 || skip > 10000) throw ApiFailure.bad();
        scenario(scenario);
        if (rows == null) throw new ApiFailure(503, "TEACHING_FIXTURE_UNAVAILABLE");
        List<?> selected = scenario.equals("empty") ? List.of() : rows;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", selected.subList(Math.min(skip, selected.size()),
                (int) Math.min((long) skip + limit, selected.size())));
        result.put("total", selected.size());
        result.put("observedAt", catalog.allSpaces().observedAt());
        result.put("queriedAt", clock.millis());
        result.put("source", SOURCE);
        result.put("simulated", true);
        result.put("issues", List.of());
        if (historicalAudit) result.put("sampleKind", AUDIT_KIND);
        return Collections.unmodifiableMap(result);
    }

    static void scenario(String scenario) {
        if (!Set.of("normal", "empty", "failure").contains(scenario)) throw ApiFailure.bad();
        if (scenario.equals("failure")) throw new ApiFailure(503, "MOCK_READ_FAILURE");
    }

    private void reference(String id, String table, String tag) {
        if (id == null) {
            require(table == null && tag == null);
            return;
        }
        var device = catalog.allDevices().items().stream()
                .filter(d -> d.id().equals(id)).findFirst().orElseThrow();
        require(device.tableId().equals(table));
        if (tag != null) require(device.tags().stream().anyMatch(t -> t.id().equals(tag)));
    }

    private static void marked(JsonNode n) {
        require(SOURCE.equals(text(n, "source")) && n.path("simulated").isBoolean()
                && n.path("simulated").booleanValue());
    }

    static String text(JsonNode n, String key) {
        require(n.path(key).isTextual() && !n.path(key).textValue().isBlank());
        return n.path(key).textValue();
    }

    private static String nullableText(JsonNode n, String key) {
        require(n.has(key));
        return n.path(key).isNull() ? null : text(n, key);
    }

    private static Long timestamp(JsonNode n, String key) {
        require(n.has(key));
        if (n.path(key).isNull()) return null;
        require(QualityPolicy.time(n.get(key)));
        return n.path(key).longValue();
    }

    private static Boolean bool(JsonNode n, String key) {
        require(n.has(key) && (n.path(key).isBoolean() || n.path(key).isNull()));
        return n.path(key).isNull() ? null : n.path(key).booleanValue();
    }

    static void require(boolean condition) {
        if (!condition) throw new IllegalStateException("Invalid teaching read sample");
    }
}
