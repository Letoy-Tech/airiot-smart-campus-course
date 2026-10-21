package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

class HistoryFixtureTest {
    final ObjectMapper mapper = new ObjectMapper();
    @TempDir Path directory;

    ObjectNode fixture() throws Exception {
        return (ObjectNode) mapper.readTree(Path.of("../fixtures/history-cases.json").toFile());
    }

    MockCampusProvider provider(ObjectNode fixture) throws Exception {
        Path catalog = directory.resolve("catalog.json");
        Files.copy(
                Path.of("../fixtures/catalog.json"),
                catalog,
                java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        mapper.writeValue(directory.resolve("history-cases.json").toFile(), fixture);
        return new MockCampusProvider(new CatalogReader(mapper, catalog.toString()), mapper);
    }

    @Test
    void validPowerHistoryPreservesUnitsNullAndRealZero() throws Exception {
        var result =
                provider(fixture())
                        .history("teaching_energy_01", "power", 1792302300000L, 1792303200000L);
        assertThat(result.unit()).isEqualTo("kW");
        assertThat(result.samples()).hasSize(4);
        assertThat(result.samples().get(0).value()).isEqualTo(1.2);
        assertThat(result.samples().get(1).value()).isNull();
        assertThat(result.samples().get(2).value()).isZero();
        assertThat(result.issues()).isEmpty();
    }

    @Test
    void missingInvalidOrMismatchedUnitIsRejectedWithoutRelabeling() throws Exception {
        for (var unit :
                new com.fasterxml.jackson.databind.JsonNode[] {
                    mapper.valueToTree("V"),
                    mapper.valueToTree("kWh"),
                    mapper.nullNode(),
                    mapper.valueToTree(7),
                    mapper.valueToTree("")
                }) {
            ObjectNode fixture = fixture();
            ((ObjectNode) fixture.path("data")).set("unit", unit);
            assertThatThrownBy(() -> provider(fixture))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("matching unit required; samples not relabeled");
        }
        ObjectNode missing = fixture();
        ((ObjectNode) missing.path("data")).remove("unit");
        assertThatThrownBy(() -> provider(missing)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failedResponseEnvelopeCannotBecomeSuccessfulHistory() throws Exception {
        for (var code :
                new com.fasterxml.jackson.databind.JsonNode[] {
                    mapper.valueToTree(503),
                    mapper.valueToTree("0"),
                    mapper.valueToTree(0.0),
                    mapper.nullNode(),
                    mapper.valueToTree(4294967296L)
                }) {
            ObjectNode fixture = fixture();
            fixture.set("code", code);
            assertThatThrownBy(() -> provider(fixture)).isInstanceOf(IllegalStateException.class);
        }
    }
}
