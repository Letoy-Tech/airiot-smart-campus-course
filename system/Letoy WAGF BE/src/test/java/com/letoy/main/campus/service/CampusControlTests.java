package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.airiot.AiriotProperties;
import com.letoy.main.campus.dto.CampusDtos.*;
import com.letoy.main.campus.entity.CommandAudit;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CampusControlTests {
    private final ObjectMapper json = new ObjectMapper();
    private AiriotClient client;
    private CampusStoreMapper store;
    private UserInfo user;
    private CampusControlService controls;
    private final List<String> outcomes = new ArrayList<>();
    private CommandAudit last;
    @BeforeEach void setup() {
        client = mock(AiriotClient.class);
        store = mock(CampusStoreMapper.class);
        user = UserInfo.builder().uid("TEST_MANAGER").username("TEST_MANAGER").active(true).accountLocked(false).roles("CAMPUS_MANAGER").build();
        UserInfoMapper users = mock(UserInfoMapper.class);
        when(users.getUserInfoByUid("TEST_MANAGER")).thenReturn(user);
        RoleInfoMapper roles = mock(RoleInfoMapper.class);
        when(roles.selectAll(null, 1)).thenReturn(List.of("CAMPUS_MANAGER", "CAMPUS_VIEWER", "ADMIN").stream()
                .map(code -> RoleInfo.builder().roleCode(code).status(1).build()).toList());
        AuthUser principal = new AuthUser();
        principal.setId("TEST_MANAGER");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        when(store.insertAudit(any())).thenAnswer(call -> { last = call.getArgument(0); outcomes.add(last.getOutcome()); return 1; });
        when(store.updateAudit(any())).thenAnswer(call -> { last = call.getArgument(0); outcomes.add(last.getOutcome()); return 1; });
        when(store.lockControl("facility_demo_01")).thenReturn("facility_demo_01");
        when(client.status()).thenReturn(Map.of("controlEnabled", true, "connected", true));
        AiriotProperties properties = new AiriotProperties();
        properties.setControlEnabled(true);
        controls = new CampusControlService(client, new CampusCatalog(), new CampusAccess(users, roles, properties), store, new CampusAuditService(store));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    private com.fasterxml.jackson.databind.JsonNode record(boolean on) throws Exception {
        return json.readTree("{\"id\":\"facility_demo_01\",\"_table\":\"campus_facility\",\"is_simulated\":true,\"simulated_switch_on\":" + on + "}");
    }
    @Test void auditAndObservedStateCommitBeforePatchAndSuccessRequiresReadback() throws Exception {
        when(client.record("campus_facility", "facility_demo_01")).thenReturn(record(false), record(true));
        SwitchResult result = controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 模拟控制", false));
        assertTrue(result.confirmed());
        assertFalse(result.before());
        assertEquals(List.of("PENDING", "PENDING", "CONFIRMED"), outcomes);
        InOrder order = inOrder(store, client);
        order.verify(store).insertAudit(any());
        order.verify(store).lockControl("facility_demo_01");
        order.verify(client).status();
        order.verify(client).record("campus_facility", "facility_demo_01");
        order.verify(store).updateAudit(any());
        order.verify(client).patchSwitch("campus_facility", "facility_demo_01", true);
        order.verify(client).record("campus_facility", "facility_demo_01");
        order.verify(store).updateAudit(any());
    }
    @Test void viewerDenialAndUnapprovedTargetNeverWriteUpstream() {
        user.setRoles("CAMPUS_VIEWER");
        assertEquals(403, assertThrows(CampusException.class,
                () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 拒绝", false))).getStatus());
        assertEquals("DENIED", last.getOutcome());
        verifyNoInteractions(client);
        assertThrows(CampusException.class, () -> controls.switchState("real_device", new SwitchRequest(true, "TEST 拒绝", false)));
        verifyNoInteractions(client);
    }
    @Test void environmentHasNoControlEvenForManager() {
        assertEquals(403, assertThrows(CampusException.class,
                () -> controls.switchState("env_demo_01", new SwitchRequest(true, "TEST 拒绝", false))).getStatus());
        assertEquals("DENIED", last.getOutcome());
        verifyNoInteractions(client);
    }
    @Test void expectedStateConflictIsAuditedAndDoesNotPatch() throws Exception {
        when(client.record(anyString(), anyString())).thenReturn(record(true));
        assertEquals(409, assertThrows(CampusException.class,
                () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 冲突", false))).getStatus());
        assertEquals("CONFLICT", last.getOutcome());
        assertTrue(last.getBefore());
        verify(client, never()).patchSwitch(anyString(), anyString(), anyBoolean());
    }
    @Test void stringBooleanAndRealMarkerAreNeverAccepted() throws Exception {
        when(client.record(anyString(), anyString())).thenReturn(json.readTree("{\"id\":\"facility_demo_01\",\"is_simulated\":true,\"simulated_switch_on\":\"false\"}"));
        assertThrows(CampusException.class, () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 类型", false)));
        verify(client, never()).patchSwitch(anyString(), anyString(), anyBoolean());
        when(client.record(anyString(), anyString())).thenReturn(json.readTree("{\"id\":\"facility_demo_01\",\"is_simulated\":false,\"simulated_switch_on\":false}"));
        assertThrows(CampusException.class, () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 类型", false)));
        verify(client, never()).patchSwitch(anyString(), anyString(), anyBoolean());
    }
    @Test void mismatchAndReadbackFailureRemainFailedAudits() throws Exception {
        when(client.record(anyString(), anyString())).thenReturn(record(false), record(false));
        assertEquals(502, assertThrows(CampusException.class,
                () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 不一致", false))).getStatus());
        assertEquals("MISMATCH", last.getOutcome());
        assertFalse(last.getConfirmed());
        when(client.record(anyString(), anyString())).thenReturn(record(false))
                .thenThrow(new AiriotException("UPSTREAM_DENIED", 502, "TEST readback denied"));
        assertThrows(AiriotException.class, () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 回读失败", false)));
        assertEquals("FAILED", last.getOutcome());
        assertNull(last.getConfirmed());
    }
    @Test void unavailableAuditStorageStopsAllRemoteCalls() {
        doReturn(0).when(store).insertAudit(any());
        assertEquals(503, assertThrows(CampusException.class,
                () -> controls.switchState("facility_demo_01", new SwitchRequest(true, "TEST 审计失败", false))).getStatus());
        verifyNoInteractions(client);
    }
    @Test void strictRequestRejectsCoercionExtraFieldsAndEmptyReason() throws Exception {
        for (String body : List.of("{\"on\":\"true\",\"expectedState\":false,\"reason\":\"TEST\"}",
                "{\"on\":1,\"expectedState\":false,\"reason\":\"TEST\"}",
                "{\"on\":true,\"expectedState\":false,\"reason\":\" \"}",
                "{\"on\":true,\"expectedState\":false,\"reason\":\"TEST\",\"field\":\"physical_switch\"}")) {
            assertThrows(CampusException.class, () -> SwitchRequest.parse(json.readTree(body)));
        }
    }
}
