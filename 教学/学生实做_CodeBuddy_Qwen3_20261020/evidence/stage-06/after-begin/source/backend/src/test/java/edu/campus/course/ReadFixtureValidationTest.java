package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.function.Consumer;

class ReadFixtureValidationTest {
    @TempDir Path directory;
    final ObjectMapper mapper = new ObjectMapper();

    MockCampusProvider provider(String changed, Consumer<ObjectNode> change) throws Exception {
        for (String file : new String[] {"catalog.json", "history-cases.json", "history-series.json",
                "raw-alarms.json", "command-audit.json"}) {
            Files.copy(Path.of("../fixtures", file), directory.resolve(file), StandardCopyOption.REPLACE_EXISTING);
        }
        if (changed != null) {
            ObjectNode value = (ObjectNode) mapper.readTree(directory.resolve(changed).toFile());
            change.accept(value);
            mapper.writeValue(directory.resolve(changed).toFile(), value);
        }
        return new MockCampusProvider(new CatalogReader(mapper, directory.resolve("catalog.json").toString()), mapper);
    }

    @Test
    void rawSourceMarkersDeviceReferencesAndTemporalOrderAreValidated() throws Exception {
        for (Consumer<ObjectNode> corrupt : java.util.List.<Consumer<ObjectNode>>of(
                n -> n.put("source", "AIRIOT"),
                n -> ((ObjectNode) n.path("items").get(0)).put("simulated", false),
                n -> ((ObjectNode) n.path("items").get(0)).put("deviceId", "nonexistent"),
                n -> ((ObjectNode) n.path("items").get(0)).put("occurredAt", "1792302600000"),
                n -> ((ObjectNode) n.path("items").get(1)).put("recoveredAt", 0),
                n -> ((ObjectNode) n.path("items").get(1)).put("id", "teaching_alarm_001"))) {
            assertThatThrownBy(() -> provider("raw-alarms.json", corrupt)).isInstanceOf(RuntimeException.class);
        }
    }

    @Test
    void auditCannotOmitItsInventedHistoryProvenanceOrCoerceBooleanStrings() throws Exception {
        assertThatThrownBy(() -> provider("command-audit.json", n -> n.remove("sampleKind")))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> provider("command-audit.json",
                n -> ((ObjectNode) n.path("items").get(0)).put("requested", "true")))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void multiDeviceHistoryRejectsWrongUnitsDuplicateKeysAndInventedInvalidSamples() throws Exception {
        assertThatThrownBy(() -> provider("history-series.json",
                n -> ((ObjectNode) n.path("series").get(0)).put("unit", "kWh")))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> provider("history-series.json", n ->
                ((com.fasterxml.jackson.databind.node.ArrayNode) n.path("series"))
                        .add(n.path("series").get(0).deepCopy())))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> provider("history-series.json", n ->
                ((ObjectNode) n.path("series").get(0).path("samples").get(0)).put("value", "0")))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void absentNewReadFixtureIsUnavailableNotAFalseSuccessfulEmptyList() throws Exception {
        provider(null, null);
        Files.delete(directory.resolve("raw-alarms.json"));
        var without = new MockCampusProvider(new CatalogReader(mapper,
                directory.resolve("catalog.json").toString()), mapper);
        assertThatThrownBy(() -> without.alarms(50, 0))
                .isInstanceOf(ApiFailure.class).hasMessage("TEACHING_FIXTURE_UNAVAILABLE");
    }
}
