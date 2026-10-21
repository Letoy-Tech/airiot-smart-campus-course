package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.util.*;

@Component
public class MockCampusProvider implements CampusProvider {
    private final CatalogReader catalog;
    private final JsonNode raw;
    private final JsonNode historyFixture;

    public MockCampusProvider(CatalogReader catalog, ObjectMapper mapper) {
        this.catalog = catalog;
        raw = catalog.rawPoints();
        Set<String> refs = new HashSet<>();
        for (JsonNode p : raw) {
            var d = device(p.path("deviceId").asText());
            var t = tag(d, p.path("tagId").asText());
            if (!p.path("tableId").asText().equals(d.tableId())
                    || !p.path("unit").asText().equals(t.unit())
                    || !refs.add(d.id() + "/" + t.id()))
                throw new IllegalStateException("Invalid teaching point catalog");
        }
        JsonNode loaded = null;
        var path = catalog.directory().resolve("history-cases.json");
        if (Files.isRegularFile(path)) {
            try {
                loaded = mapper.readTree(path.toFile()).path("data");
                if (!"TEACHING_MOCK".equals(loaded.path("source").asText())
                        || !loaded.path("samples").isArray()) throw new IllegalArgumentException();
                tag(device(loaded.path("deviceId").asText()), loaded.path("tagId").asText());
            } catch (Exception e) {
                throw new IllegalStateException("Invalid teaching history fixture");
            }
        }
        historyFixture = loaded;
    }

    @Override
    public CatalogReader.Items<CatalogReader.Space> spaces() {
        return catalog.allSpaces();
    }

    @Override
    public CatalogReader.Items<CatalogReader.Device> devices() {
        return catalog.allDevices();
    }

    public CatalogReader.Device device(String id) {
        return devices().items().stream()
                .filter(d -> d.id().equals(id))
                .findFirst()
                .orElseThrow(ApiFailure::missing);
    }

    public CatalogReader.Tag tag(CatalogReader.Device device, String id) {
        return device.tags().stream()
                .filter(t -> t.id().equals(id))
                .findFirst()
                .orElseThrow(ApiFailure::missing);
    }

    @Override
    public Map<String, Object> latest(String deviceId) {
        if (deviceId != null) device(deviceId);
        List<Point> items = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        for (JsonNode p : raw) {
            if (deviceId != null && !deviceId.equals(p.path("deviceId").asText())) continue;
            String q = QualityPolicy.classify(p.get("value"), p.get("time"), spaces().observedAt());
            String scope = p.path("deviceId").asText() + "/" + p.path("tagId").asText();
            if (!q.equals("fresh"))
                issues.add(
                        new Issue(
                                "POINT_" + q.toUpperCase(Locale.ROOT),
                                "Teaching point quality: " + q,
                                scope));
            items.add(
                    new Point(
                            p.path("deviceId").asText(),
                            p.path("tableId").asText(),
                            p.path("tagId").asText(),
                            QualityPolicy.value(p.get("value"))
                                    ? p.get("value").doubleValue()
                                    : null,
                            QualityPolicy.time(p.get("time")) ? p.get("time").longValue() : null,
                            q,
                            p.path("unit").asText()));
        }
        return Map.of("items", items, "observedAt", spaces().observedAt(), "issues", issues);
    }

    @Override
    public History history(String deviceId, String tagId, long from, long to) {
        if (from < 0 || to < from || to > QualityPolicy.MAX_EPOCH || to - from > 21_600_000)
            throw ApiFailure.bad();
        var t = tag(device(deviceId), tagId);
        List<JsonNode> samples = new ArrayList<>();
        if (historyFixture != null
                && deviceId.equals(historyFixture.path("deviceId").asText())
                && tagId.equals(historyFixture.path("tagId").asText()))
            historyFixture.path("samples").forEach(samples::add);
        else
            for (JsonNode p : raw)
                if (deviceId.equals(p.path("deviceId").asText())
                        && tagId.equals(p.path("tagId").asText())) samples.add(p);
        return normalizeHistory(
                deviceId, tagId, t.unit(), from, to, spaces().observedAt(), samples);
    }

    public static History normalizeHistory(
            String deviceId,
            String tagId,
            String unit,
            long from,
            long to,
            long observedAt,
            List<JsonNode> raw) {
        List<Issue> issues = new ArrayList<>();
        TreeMap<Long, Sample> samples = new TreeMap<>();
        for (int i = 0; i < raw.size(); i++) {
            JsonNode n = raw.get(i), value = n.get("value"), time = n.get("time");
            if (!QualityPolicy.time(time)
                    || value == null
                    || (!value.isNull() && !QualityPolicy.value(value))) {
                issues.add(
                        new Issue(
                                "HISTORY_INVALID_SAMPLE",
                                "Invalid sample rejected",
                                "sample[" + i + "]"));
                continue;
            }
            long at = time.longValue();
            if (at < from || at > to) continue;
            if (samples.containsKey(at)) {
                issues.add(
                        new Issue(
                                "HISTORY_DUPLICATE_TIME",
                                "First sample retained",
                                "sample[" + i + "]"));
                continue;
            }
            samples.put(at, new Sample(at, value.isNull() ? null : value.doubleValue()));
        }
        return new History(
                "TEACHING_MOCK",
                deviceId,
                tagId,
                unit,
                from,
                to,
                observedAt,
                samples.values().stream().limit(1000).toList(),
                samples.size() > 1000,
                List.copyOf(issues));
    }

    @Override
    public Map<String, Object> alarms(int limit, int skip) {
        return Map.of(
                "items",
                List.of(),
                "total",
                0,
                "observedAt",
                spaces().observedAt(),
                "issues",
                List.of());
    }

    @Override
    public Map<String, Object> status() {
        return Map.of(
                "source",
                "TEACHING_MOCK",
                "configured",
                true,
                "connected",
                true,
                "simulated",
                true,
                "observedAt",
                spaces().observedAt());
    }
}
