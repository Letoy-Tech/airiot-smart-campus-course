package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.airiot.AiriotProperties;
import com.letoy.main.campus.dto.CampusDtos.*;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CampusMonitoringTests {
    private final ObjectMapper json = new ObjectMapper();
    private AiriotClient client;
    private CampusMonitoringService monitoring;

    @BeforeEach
    void setup() throws Exception {
        client = mock(AiriotClient.class);
        UserInfoMapper users = mock(UserInfoMapper.class);
        when(users.getUserInfoByUid("TEST_MANAGER")).thenReturn(UserInfo.builder().uid("TEST_MANAGER")
                .username("TEST_MANAGER").active(true).accountLocked(false).roles("CAMPUS_MANAGER").build());
        AuthUser principal = new AuthUser();
        principal.setId("TEST_MANAGER");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        CampusStoreMapper store = mock(CampusStoreMapper.class);
        when(store.campuses()).thenReturn(List.of());
        when(store.buildings()).thenReturn(List.of());
        when(store.bindings()).thenReturn(List.of());
        RoleInfoMapper roles = mock(RoleInfoMapper.class);
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("CAMPUS_MANAGER").status(1).build()));
        AiriotProperties properties = new AiriotProperties();
        properties.setControlEnabled(true);
        CampusAccess access = new CampusAccess(users, roles, properties);
        monitoring = new CampusMonitoringService(client, access, new CampusCatalog(), new CampusLocationService(store, access, client));
        for (String table : List.of("campus_space", "campus_environment", "campus_energy", "campus_facility", "campus_lighting")) {
            when(client.records(table)).thenReturn(fixture(table));
        }
        when(client.latest(anyList())).thenReturn(fixture("latest"));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    private JsonNode fixture(String name) throws Exception {
        return json.readTree(getClass().getResourceAsStream("/campus/" + name + ".json"));
    }
    @Test void mapsCapturedRecordsWithoutInventingLocationsOrOnlineState() {
        Overview overview = monitoring.overview();
        assertEquals(new Completeness(4, 16, 28, 4, 16, 28), overview.completeness());
        assertTrue(overview.spaces().stream().allMatch(space -> space.campusId() == null && space.buildingId() == null && space.floor() == null));
        Device env4 = overview.devices().stream().filter(device -> device.id().equals("env_demo_04")).findFirst().orElseThrow();
        assertNull(env4.online());
        assertEquals("demo_room_104", env4.spaceId());
        assertEquals("演示公共走廊104", env4.spaceName());
        Device env1 = overview.devices().stream().filter(device -> device.id().equals("env_demo_01")).findFirst().orElseThrow();
        assertNull(env1.communicationTime()); // connectTime is not communication time.
        assertTrue(overview.points().stream().noneMatch(point -> point.unit().equals("kWh")));
    }
    @Test void incompleteModelAndLatestFailureRemainUnknownInsteadOfExpectedCounts() {
        when(client.records("campus_lighting")).thenThrow(new AiriotException("DENIED", 502, "TEST denied"));
        when(client.latest(anyList())).thenThrow(new AiriotException("DENIED", 502, "TEST denied"));
        Overview overview = monitoring.overview();
        assertEquals(12, overview.completeness().actualDevices());
        assertEquals(0, overview.completeness().actualPoints());
        assertEquals(24, overview.points().size());
        assertTrue(overview.points().stream().allMatch(point -> point.value() == null && point.quality().equals("missing")));
        assertTrue(overview.issues().stream().anyMatch(issue -> issue.code().equals("TABLE_UNAVAILABLE")));
    }
    @Test void allModelFailuresAreUnavailable() {
        when(client.records(anyString())).thenThrow(new AiriotException("DENIED", 502, "TEST denied"));
        assertEquals(502, assertThrows(CampusException.class, monitoring::overview).getStatus());
    }
    @Test void recordsMarkedAsRealCannotBecomeSimulatedDevices() throws Exception {
        ArrayNode records = (ArrayNode) fixture("campus_environment");
        ((com.fasterxml.jackson.databind.node.ObjectNode) records.get(0)).put("is_simulated", false);
        when(client.records("campus_environment")).thenReturn(records);
        assertEquals(15, monitoring.overview().completeness().actualDevices());
    }
    @Test void historyUsesReturnedColumnNamesAndRawValuesWithoutFilling() throws Exception {
        long from = 1_791_053_776_000L;
        long to = from + 10_000;
        when(client.history("campus_environment", "env_demo_01", "temperature_c", from, to, 1001))
                .thenReturn(json.readTree("{\"results\":[{\"series\":[{\"columns\":[\"temperature_c\",\"time\"],\"values\":[[\"25.5\",1791053777001],[null,1791053778001],[9,1791053999001]]}]}]}"));
        History result = monitoring.history("env_demo_01", "temperature_c", from, to);
        assertEquals(List.of(new Sample(1_791_053_777_001L, 25.5)), result.samples());
        assertEquals(2, result.issues().size());
        assertFalse(result.truncated());
    }
    @Test void emptyHistoryIsEmptyAndIllegalPointOrSpanNeverReachesUpstream() throws Exception {
        when(client.history(anyString(), anyString(), anyString(), anyLong(), anyLong(), anyInt()))
                .thenReturn(json.readTree("{\"results\":[{}]}"));
        assertTrue(monitoring.history("energy_demo_01", "power_kw", 1_791_053_776_000L, 1_791_053_777_000L).samples().isEmpty());
        clearInvocations(client);
        assertThrows(CampusException.class, () -> monitoring.history("energy_demo_01", "kwh", 1_791_053_776_000L, 1_791_053_777_000L));
        assertThrows(CampusException.class, () -> monitoring.history("real_device", "power_kw", 1, 2));
        assertThrows(CampusException.class, () -> monitoring.history("energy_demo_01", "power_kw", 1, 9L * 24 * 60 * 60 * 1000));
        verifyNoInteractions(client);
    }
    @Test void unparseableHistoryIsNotAReportedSuccessfulEmptySeries() throws Exception {
        assertEquals(502, assertThrows(CampusException.class,
                () -> CampusMonitoringService.mapHistory(json.readTree("[]"), "power_kw", 1, 2, new ArrayList<>())).getStatus());
    }
    @Test void exactHistoryTagAndTimeColumnsWinOverGenericAliases() throws Exception {
        long from = 1_791_053_776_000L;
        JsonNode raw = json.readTree("{\"results\":[{\"series\":[{\"columns\":[\"time\",\"temperature_c\",\"value\",\"_time\"],"
                + "\"values\":[[1791053777001,22,999,1791053779001]]}]}]}");
        assertEquals(List.of(new Sample(1_791_053_777_001L, 22)),
                CampusMonitoringService.mapHistory(raw, "temperature_c", from, from + 10000, new ArrayList<>()));
    }
    @Test void rawSaturatedHistoryIsTruncatedEvenWhenInvalidSamplesAreRemoved() throws Exception {
        long from = 1_791_053_776_000L;
        com.fasterxml.jackson.databind.node.ObjectNode raw = (com.fasterxml.jackson.databind.node.ObjectNode)
                json.readTree("{\"results\":[{\"series\":[{\"columns\":[\"time\",\"temperature_c\"],\"values\":[]}]}]}");
        ArrayNode rows = (ArrayNode) raw.path("results").get(0).path("series").get(0).path("values");
        for (int i = 0; i < 1001; i++) {
            ArrayNode row = rows.addArray().add(from + i);
            if (i < 2) row.addNull(); else row.add(22);
        }
        when(client.history("campus_environment", "env_demo_01", "temperature_c", from, from + 10000, 1001)).thenReturn(raw);
        History history = monitoring.history("env_demo_01", "temperature_c", from, from + 10000);
        assertTrue(history.truncated());
        assertEquals(999, history.samples().size());
        assertEquals(2, history.issues().size());
    }
    @Test void alarmEnumsArePreservedAndUnapprovedObjectsExcluded() throws Exception {
        when(client.alarms(50, 0)).thenReturn(json.readTree("{\"total\":2,\"items\":[{\"id\":\"alarm1\",\"table\":{\"id\":\"campus_environment\"},\"tableData\":{\"id\":\"env_demo_01\",\"name\":\"实际名称\"},\"warnTag\":{\"id\":\"temperature_c\"},\"status\":\"ACTIVE_ENUM_7\",\"level\":\"HIGH_ENUM_8\",\"time\":1791053777001,\"message\":\"TEST 模拟报警\"},{\"id\":\"other\",\"uid\":\"real_device\",\"status\":\"0\"}]}"));
        Alarms result = monitoring.alarms(50, 0);
        assertEquals(1, result.items().size());
        assertEquals("ACTIVE_ENUM_7", result.items().get(0).status());
        assertEquals("HIGH_ENUM_8", result.items().get(0).level());
        assertNull(result.total());
        assertEquals("UNMAPPED_ALARM", result.issues().get(0).code());
    }
    @Test void officialAlarmDescriptionIsMappedBeforeFallbackLabels() throws Exception {
        when(client.alarms(50, 0)).thenReturn(json.readTree("{\"total\":1,\"items\":[{\"id\":\"a\","
                + "\"table\":{\"id\":\"campus_environment\"},\"uid\":\"env_demo_01\",\"desc\":\"温度过高\",\"message\":\"备用标签\"}]}"));
        assertEquals("温度过高", monitoring.alarms(50, 0).items().get(0).message());
    }
}
