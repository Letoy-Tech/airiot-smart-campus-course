package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class CatalogReader {
    public record Space(
            String id,
            String name,
            String type,
            String campusId,
            String buildingId,
            String floor) {}

    public record Tag(String id, String name, String unit) {}

    public record Device(
            String id,
            String tableId,
            String name,
            String category,
            String spaceId,
            String spaceName,
            Boolean online,
            Long communicationTime,
            boolean simulated,
            Boolean switchOn,
            List<Tag> tags) {}

    public record Items<T>(List<T> items, long observedAt) {}

    private final Items<Space> spaces;
    private final Items<Device> devices;
    private final Items<Space> allSpaces;
    private final Items<Device> allDevices;
    private final JsonNode points;
    private final Path directory;

    public CatalogReader(ObjectMapper mapper, @Value("${course.catalog-path}") String file) {
        try {
            Path path = Path.of(file);
            this.directory = path.toAbsolutePath().getParent();
            if (!Files.isRegularFile(path) || Files.size(path) > 1_048_576)
                throw new IllegalArgumentException();
            JsonNode root = mapper.readTree(path.toFile());
            require(
                    root.isObject()
                            && "TEACHING_MOCK".equals(text(root, "source"))
                            && root.path("simulated").isBoolean()
                            && root.path("simulated").booleanValue());
            require(
                    root.path("schemaVersion").isIntegralNumber()
                            && root.path("schemaVersion").canConvertToInt()
                            && root.path("schemaVersion").intValue() == 1);
            long observedAt = timestamp(root.get("observedAt"));
            require(root.path("spaces").isArray() && !root.path("spaces").isEmpty());
            require(root.path("devices").isArray() && root.path("devices").size() >= 2);
            List<Space> selectedSpaces = new ArrayList<>();
            List<Space> fullSpaces = new ArrayList<>();
            Set<String> spaceIds = new java.util.HashSet<>();
            for (JsonNode space : root.path("spaces")) {
                String id = text(space, "id");
                require(spaceIds.add(id));
                Space value =
                        new Space(
                                id,
                                text(space, "name"),
                                nullableText(space, "type"),
                                nullableText(space, "campusId"),
                                nullableText(space, "buildingId"),
                                nullableText(space, "floor"));
                fullSpaces.add(value);
                if (id.equals("teaching_space_01")) selectedSpaces.add(value);
            }
            require(selectedSpaces.size() == 1);
            this.spaces = new Items<>(List.copyOf(selectedSpaces), observedAt);
            this.allSpaces = new Items<>(List.copyOf(fullSpaces), observedAt);
            List<Device> loaded = new ArrayList<>();
            List<Device> fullDevices = new ArrayList<>();
            Set<String> ids = new java.util.HashSet<>();
            for (JsonNode node : root.path("devices")) {
                String id = text(node, "id");
                require(ids.add(id));
                String category = text(node, "category");
                require(Set.of("environment", "energy", "facility", "lighting").contains(category));
                require(
                        node.path("simulated").isBoolean()
                                && node.path("simulated").booleanValue());
                String spaceId = nullableText(node, "spaceId");
                require(spaceId == null || spaceIds.contains(spaceId));
                require(node.path("tags").isArray() && !node.path("tags").isEmpty());
                List<Tag> tags = new ArrayList<>();
                Set<String> tagIds = new java.util.HashSet<>();
                for (JsonNode tag : node.path("tags")) {
                    String tagId = text(tag, "id");
                    require(tagIds.add(tagId) && tag.path("unit").isTextual());
                    tags.add(new Tag(tagId, text(tag, "name"), tag.path("unit").textValue()));
                }
                Boolean online = nullableBoolean(node, "online");
                Long communicationTime =
                        node.get("communicationTime") == null
                                        || node.get("communicationTime").isNull()
                                ? null
                                : timestamp(node.get("communicationTime"));
                Device value =
                        new Device(
                                id,
                                text(node, "tableId"),
                                text(node, "name"),
                                category,
                                spaceId,
                                nullableText(node, "spaceName"),
                                online,
                                communicationTime,
                                true,
                                nullableBoolean(node, "switchOn"),
                                List.copyOf(tags));
                fullDevices.add(value);
                if (Set.of("teaching_env_01", "teaching_energy_01").contains(id)) {
                    require("teaching_space_01".equals(spaceId));
                    require(
                            category.equals(
                                    id.equals("teaching_env_01") ? "environment" : "energy"));
                    loaded.add(value);
                }
            }
            require(loaded.size() == 2);
            this.devices = new Items<>(List.copyOf(loaded), observedAt);
            this.allDevices = new Items<>(List.copyOf(fullDevices), observedAt);
            require(root.path("points").isArray());
            this.points = root.path("points").deepCopy();
        } catch (Exception exception) {
            // Never dump a malformed input file or its contents into startup logs.
            throw new IllegalStateException("Invalid or unavailable first-chain teaching catalog");
        }
    }

    public Items<Space> spaces() {
        return spaces;
    }

    public Items<Device> devices() {
        return devices;
    }

    public Items<Space> allSpaces() {
        return allSpaces;
    }

    public Items<Device> allDevices() {
        return allDevices;
    }

    public JsonNode rawPoints() {
        return points.deepCopy();
    }

    public Path directory() {
        return directory;
    }

    private static void require(boolean condition) {
        if (!condition) throw new IllegalArgumentException();
    }

    private static String text(JsonNode node, String key) {
        require(
                node != null
                        && node.path(key).isTextual()
                        && !node.path(key).textValue().isBlank());
        return node.path(key).textValue();
    }

    private static String nullableText(JsonNode node, String key) {
        JsonNode value = node.get(key);
        if (value == null || value.isNull()) return null;
        require(value.isTextual());
        return value.textValue();
    }

    private static Boolean nullableBoolean(JsonNode node, String key) {
        JsonNode value = node.get(key);
        if (value == null || value.isNull()) return null;
        require(value.isBoolean());
        return value.booleanValue();
    }

    private static long timestamp(JsonNode value) {
        require(QualityPolicy.time(value));
        return value.longValue();
    }
}
