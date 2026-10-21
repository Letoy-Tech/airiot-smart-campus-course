package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.ArrayList;

class QualityPolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void qualityBoundariesAndMalformedTypes() throws Exception {
        var fixture = mapper.readTree(Path.of("../fixtures/quality-cases.json").toFile());
        long observed = fixture.path("observedAt").asLong();
        for (var c : fixture.path("cases"))
            assertThat(
                            QualityPolicy.classify(
                                    c.path("raw").get("value"),
                                    c.path("raw").get("time"),
                                    observed))
                    .as(c.path("id").asText())
                    .isEqualTo(c.path("expectedQuality").asText());
        assertThat(
                        QualityPolicy.classify(
                                mapper.valueToTree(Double.NaN),
                                mapper.valueToTree(observed),
                                observed))
                .isEqualTo("invalid");
        assertThat(
                        QualityPolicy.classify(
                                mapper.valueToTree(Double.POSITIVE_INFINITY),
                                mapper.valueToTree(observed),
                                observed))
                .isEqualTo("invalid");
        assertThat(QualityPolicy.classify(mapper.valueToTree("bad"), mapper.nullNode(), observed))
                .isEqualTo("invalid");
    }

    @Test
    void historyPreservesNullRejectsInvalidAndTruncatesAfterFiltering() throws Exception {
        var raw = new ArrayList<com.fasterxml.jackson.databind.JsonNode>();
        raw.add(mapper.readTree("{\"time\":5,\"value\":null}"));
        raw.add(mapper.readTree("{\"time\":6,\"value\":\"7\"}"));
        raw.add(mapper.readTree("{\"time\":7.5,\"value\":8}"));
        for (int i = 10; i < 1111; i++)
            raw.add(mapper.readTree("{\"time\":" + i + ",\"value\":0}"));
        var result = MockCampusProvider.normalizeHistory("d", "t", "kW", 0, 2000, 2000, raw);
        assertThat(result.samples()).hasSize(1000);
        assertThat(result.truncated()).isTrue();
        assertThat(result.samples().get(0).value()).isNull();
        assertThat(result.issues()).hasSize(2);
        var bounded = MockCampusProvider.normalizeHistory("d", "t", "kW", 1000, 1100, 2000, raw);
        assertThat(bounded.samples()).hasSize(101);
        assertThat(bounded.truncated()).isFalse();
    }

    @Test
    void unconfiguredAiriotNeverFallsBackToMock() {
        var airiot = new AiriotReadOnlyProvider();
        assertThat(airiot.status().get("connected")).isEqualTo(false);
        assertThatThrownBy(airiot::devices)
                .isInstanceOf(ApiFailure.class)
                .hasMessage("AIRIOT_NOT_CONFIGURED");
    }
}
