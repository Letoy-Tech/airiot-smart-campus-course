package edu.campus.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;

/** MVC + actual fixed fixtures + real security rules; no MySQL, socket or remote provider. */
@WebMvcTest(controllers = {FullCampusController.class, CommandAuditController.class})
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("teacher-db")
@Import({SecurityConfiguration.class, ReadOnlyModelsTest.FixtureBeans.class})
class ReadOnlyModelsTest {
    static final long OBSERVED = 1792303200000L;
    static final long QUERIED = OBSERVED + 86_400_000;

    @TestConfiguration
    static class FixtureBeans {
        @Bean
        @org.springframework.context.annotation.Primary
        MockCampusProvider fixtureProvider(ObjectMapper mapper) {
            CatalogReader catalog = new CatalogReader(mapper,
                    Path.of("../fixtures/catalog.json").toAbsolutePath().toString());
            return new MockCampusProvider(catalog, mapper,
                    Clock.fixed(Instant.ofEpochMilli(QUERIED), ZoneOffset.UTC));
        }

        @Bean
        AiriotReadOnlyProvider airiot() {
            return new AiriotReadOnlyProvider();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean AccountDirectory accounts;
    @MockitoBean LocationService locations;
    @MockitoBean OperationsService operations;

    @BeforeEach
    void identities() {
        for (String role : Set.of("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER")) {
            when(accounts.find(role)).thenReturn(Optional.of(
                    new AccountDirectory.Account(role, role, "test-only-unused-hash", true,
                            Set.of(role))));
        }
    }

    JsonNode read(String path, String role) throws Exception {
        var result = mvc.perform(get(path).with(user(role).roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0)).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    @Test
    void alarmsRequireCampusRoleWhileAuditRequiresCurrentAdmin() throws Exception {
        mvc.perform(get("/api/campus/alarms")).andExpect(status().isUnauthorized());
        read("/api/campus/alarms", "CAMPUS_VIEWER");
        for (String role : Set.of("CAMPUS_VIEWER", "CAMPUS_MANAGER")) {
            mvc.perform(get("/api/campus/command-audit").with(user(role).roles(role)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value("ACCESS_DENIED"));
        }
        read("/api/campus/command-audit", "ADMIN");
        when(accounts.find("ADMIN")).thenReturn(Optional.of(new AccountDirectory.Account(
                "ADMIN", "revoked", "unused", true, Set.of("CAMPUS_VIEWER"))));
        mvc.perform(get("/api/campus/command-audit").with(user("ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void rawAlarmPaginationKeepsTrueTotalRawStatesAndNullableFields() throws Exception {
        JsonNode first = read("/api/campus/alarms?limit=2&skip=0", "CAMPUS_VIEWER");
        JsonNode second = read("/api/campus/alarms?limit=2&skip=2", "CAMPUS_VIEWER");
        JsonNode last = read("/api/campus/alarms?limit=2&skip=4", "CAMPUS_VIEWER");
        assertThat(first.path("total").intValue()).isEqualTo(5);
        assertThat(first.path("items").size()).isEqualTo(2);
        assertThat(second.path("items").get(0).path("id").asText()).isEqualTo("teaching_alarm_004");
        assertThat(second.path("items").get(0).path("status").asText()).isEqualTo("vendor:17");
        assertThat(second.path("items").get(1).path("level").asText()).isEqualTo("vendor-L7");
        assertThat(last.path("items").size()).isEqualTo(1);
        assertThat(last.path("items").get(0).path("occurredAt").isNull()).isTrue();
        assertThat(last.path("items").get(0).path("deviceId").isNull()).isTrue();
        assertThat(first.path("items").get(1).path("time"))
                .isEqualTo(first.path("items").get(1).path("occurredAt"));
        assertThat(first.path("items").get(1).path("recoveryTime"))
                .isEqualTo(first.path("items").get(1).path("recoveredAt"));
        JsonNode beyond = read("/api/campus/alarms?skip=10000", "CAMPUS_VIEWER");
        assertThat(beyond.path("items").isEmpty()).isTrue();
        assertThat(beyond.path("total").intValue()).isEqualTo(5);
        assertThat(first.path("observedAt").longValue()).isEqualTo(OBSERVED);
        assertThat(first.path("queriedAt").longValue()).isEqualTo(QUERIED);
    }

    @Test
    void explicitEmptyAndFailureAreDistinctAndNeverChangeNextNormalRead() throws Exception {
        for (String route : new String[] {"alarms", "command-audit"}) {
            JsonNode empty = read("/api/campus/" + route + "?scenario=empty", "ADMIN");
            assertThat(empty.path("total").intValue()).isZero();
            assertThat(empty.path("items").isEmpty()).isTrue();
            mvc.perform(get("/api/campus/" + route + "?scenario=failure")
                            .with(user("ADMIN").roles("ADMIN")))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.message").value("MOCK_READ_FAILURE"))
                    .andExpect(jsonPath("$.data").isEmpty());
            assertThat(read("/api/campus/" + route, "ADMIN").path("total").intValue()).isPositive();
        }
        verifyNoInteractions(locations, operations);
    }

    @Test
    void historyProvidesFourSpaceComparisonsWithoutBreakingLegacyFourPointExercise() throws Exception {
        for (int i = 1; i <= 4; i++) {
            for (String[] point : new String[][] {{"env", "temperature", "°C"},
                    {"env", "humidity", "%"}, {"energy", "power", "kW"},
                    {"energy", "voltage", "V"}}) {
                String id = "teaching_" + point[0] + "_0" + i;
                JsonNode history = read(historyUrl(id, point[1]), "CAMPUS_VIEWER");
                assertThat(history.path("samples").size()).isGreaterThanOrEqualTo(4);
                assertThat(history.path("unit").asText()).isEqualTo(point[2]);
                assertThat(history.path("observedAt").longValue()).isEqualTo(OBSERVED);
                assertThat(history.path("queriedAt").longValue()).isEqualTo(QUERIED);
            }
        }
        JsonNode legacy = read(historyUrl("teaching_energy_01", "power"), "CAMPUS_VIEWER");
        assertThat(legacy.path("samples").size()).isEqualTo(4);
        assertThat(legacy.path("samples").get(1).path("value").isNull()).isTrue();
        assertThat(legacy.path("samples").get(2).path("value").doubleValue()).isZero();
        JsonNode missing = read(historyUrl("teaching_env_02", "humidity"), "CAMPUS_VIEWER");
        assertThat(missing.path("samples").get(2).path("value").isNull()).isTrue();
    }

    private String historyUrl(String device, String tag) {
        return "/api/campus/history?deviceId=" + device + "&tagId=" + tag
                + "&from=" + (OBSERVED - 3600000) + "&to=" + OBSERVED;
    }

    @Test
    void oneHistoryFailureDoesNotReplaceOtherDevicesOrMutateFixtures() throws Exception {
        String failed = historyUrl("teaching_energy_03", "power");
        mvc.perform(get(failed + "&scenario=failure").with(user("CAMPUS_VIEWER").roles("CAMPUS_VIEWER")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("MOCK_READ_FAILURE"));
        assertThat(read(historyUrl("teaching_energy_02", "power"), "CAMPUS_VIEWER")
                .path("samples").size()).isEqualTo(6);
        assertThat(read(failed + "&scenario=empty", "CAMPUS_VIEWER").path("samples").isEmpty()).isTrue();
        assertThat(read(failed, "CAMPUS_VIEWER").path("samples").size()).isEqualTo(6);
    }

    @Test
    void auditIsClearlyInventedHistoryAndCannotBeWrittenViaReadEndpoint() throws Exception {
        JsonNode audit = read("/api/campus/command-audit?limit=1&skip=1", "ADMIN");
        assertThat(audit.path("total").intValue()).isEqualTo(3);
        assertThat(audit.path("items").size()).isEqualTo(1);
        assertThat(audit.path("sampleKind").asText()).isEqualTo("HISTORICAL_TEACHING_SAMPLE");
        JsonNode row = audit.path("items").get(0);
        assertThat(row.path("source").asText()).isEqualTo("TEACHING_MOCK");
        assertThat(row.path("simulated").booleanValue()).isTrue();
        assertThat(row.path("outcome").asText()).isEqualTo("READBACK_MISMATCH");
        assertThat(row.path("requested").booleanValue()).isFalse();
        assertThat(row.path("confirmed").booleanValue()).isTrue();
        mvc.perform(post("/api/campus/command-audit").with(user("ADMIN").roles("ADMIN")).with(csrf()))
                .andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(locations, operations);
    }

    @Test
    void malformedReadQueriesAreRejectedInsteadOfSilentlySelectingFixtures() throws Exception {
        for (String query : new String[] {"limit=0", "limit=101", "skip=-1", "skip=10001",
                "limit=1.5", "scenario=other", "deviceId=unknown"}) {
            mvc.perform(get("/api/campus/alarms?" + query).with(user("CAMPUS_VIEWER").roles("CAMPUS_VIEWER")))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get(historyUrl("unknown", "power")).with(user("CAMPUS_VIEWER").roles("CAMPUS_VIEWER")))
                .andExpect(status().isNotFound());
    }
}
