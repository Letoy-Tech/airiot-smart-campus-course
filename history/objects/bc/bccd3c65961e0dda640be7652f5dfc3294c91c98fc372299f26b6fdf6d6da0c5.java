package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

class CatalogReaderTest {
    final ObjectMapper mapper = new ObjectMapper();
    @TempDir Path directory;

    ObjectNode fixture() throws Exception {
        return (ObjectNode)
                mapper.readTree(Path.of("src/test/resources/catalog-test.json").toFile());
    }

    CatalogReader read(ObjectNode json) throws Exception {
        Path file = directory.resolve("catalog.json");
        mapper.writeValue(file.toFile(), json);
        return new CatalogReader(mapper, file.toString());
    }

    @Test
    void fixedClockAndUnknownValuesArePreserved() throws Exception {
        CatalogReader reader = read(fixture());
        assertThat(reader.devices().observedAt()).isEqualTo(1792303200000L);
        assertThat(reader.devices().items().get(1).online()).isNull();
        assertThat(reader.devices().items().get(1).communicationTime()).isNull();
    }

    @Test
    void mismatchedSourceOrSimulationFailsClosed() throws Exception {
        ObjectNode json = fixture();
        json.put("source", "AIRIOT");
        assertThatThrownBy(() -> read(json)).isInstanceOf(IllegalStateException.class);
        json.put("source", "TEACHING_MOCK");
        json.put("simulated", false);
        assertThatThrownBy(() -> read(json)).isInstanceOf(IllegalStateException.class);
        json.put("simulated", true);
        ((ObjectNode) json.path("devices").get(0)).put("simulated", false);
        assertThatThrownBy(() -> read(json)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void stringBooleanAndFractionalTimeAreRejected() throws Exception {
        ObjectNode json = fixture();
        ((ObjectNode) json.path("devices").get(1)).put("online", "false");
        assertThatThrownBy(() -> read(json)).isInstanceOf(IllegalStateException.class);
        ObjectNode second = fixture();
        second.put("observedAt", 1792303200000.5);
        assertThatThrownBy(() -> read(second)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void duplicateIdsAndMissingSelectionAreRejected() throws Exception {
        ObjectNode json = fixture();
        ((ObjectNode) json.path("devices").get(1)).put("id", "teaching_env_01");
        assertThatThrownBy(() -> read(json)).isInstanceOf(IllegalStateException.class);
        ObjectNode second = fixture();
        ((ObjectNode) second.path("spaces").get(0)).put("id", "other-space");
        assertThatThrownBy(() -> read(second)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void realCourseCatalogCanBeSelectedWithoutLeakingFullFixture() {
        // Also exercise the delivered shared fixture, rather than only our isolated unit input.
        CatalogReader reader = new CatalogReader(mapper, "../fixtures/catalog.json");
        assertThat(reader.spaces().items()).hasSize(1);
        assertThat(reader.devices().items())
                .extracting(CatalogReader.Device::id)
                .containsExactly("teaching_env_01", "teaching_energy_01");
        assertThat(reader.devices().items().get(0).online()).isTrue();
        assertThat(reader.devices().items().get(1).online()).isNull();
    }
}
