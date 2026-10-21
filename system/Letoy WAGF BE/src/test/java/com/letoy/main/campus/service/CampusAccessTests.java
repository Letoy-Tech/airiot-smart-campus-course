package com.letoy.main.campus.service;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotProperties;
import com.letoy.main.campus.dto.CampusDtos.*;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CampusAccessTests {
    private UserInfoMapper users;
    private RoleInfoMapper roles;
    private CampusAccess access;
    private AiriotProperties properties;
    @BeforeEach void setup() {
        users = mock(UserInfoMapper.class);
        roles = mock(RoleInfoMapper.class);
        when(roles.selectAll(null, 1)).thenReturn(List.of("SUPER_ADMIN", "ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER").stream()
                .map(code -> RoleInfo.builder().roleCode(code).status(1).build()).toList());
        properties = new AiriotProperties();
        properties.setControlEnabled(true);
        access = new CampusAccess(users, roles, properties);
        AuthUser principal = new AuthUser();
        principal.setId("TEST_USER");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    private void current(String role) {
        when(users.getUserInfoByUid("TEST_USER")).thenReturn(UserInfo.builder().uid("TEST_USER").username("TEST_USER")
                .active(true).accountLocked(false).roles(role).groupIds("ROOT").build());
    }
    @Test void databaseRolesOverrideAnyStaleOrForgedPrincipalAuthorities() {
        current("CAMPUS_VIEWER");
        Capabilities capabilities = access.capabilities();
        assertTrue(capabilities.canRead());
        assertFalse(capabilities.canControl());
        assertFalse(capabilities.canAdmin());
        assertFalse(capabilities.canAudit());
        assertEquals(403, assertThrows(CampusException.class, access::requireAdmin).getStatus());
    }
    @Test void managerCanControlButCannotCreateLocationsOrSeeSecrets() {
        current("CAMPUS_MANAGER");
        assertTrue(access.capabilities().canControl());
        assertFalse(access.capabilities().canAdmin());
        CampusStoreMapper store = mock(CampusStoreMapper.class);
        AiriotClient client = mock(AiriotClient.class);
        CampusLocationService service = new CampusLocationService(store, access, client);
        assertThrows(CampusException.class, () -> service.createCampus(new CreateCampusRequest("TEST 校区")));
        verifyNoInteractions(store, client);
    }
    @Test void disabledRoleImmediatelyRevokesCapability() {
        current("CAMPUS_MANAGER,ADMIN");
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("CAMPUS_VIEWER").status(1).build(),
                RoleInfo.builder().roleCode("ADMIN").status(0).build()));
        assertFalse(access.capabilities().canRead());
        assertFalse(access.capabilities().canControl());
        assertFalse(access.capabilities().canAdmin());
    }
    @Test void disabledAndLockedAccountsAreRejectedAtBusinessBoundary() {
        current("ADMIN");
        UserInfo user = users.getUserInfoByUid("TEST_USER");
        user.setActive(false);
        assertThrows(CampusException.class, access::capabilities);
        user.setActive(true);
        user.setAccountLocked(true);
        assertThrows(CampusException.class, access::capabilities);
    }
    @Test void adminCapabilitiesAndUnauthenticatedRejection() {
        current("ADMIN");
        assertTrue(access.capabilities().canAudit());
        assertTrue(access.capabilities().canAdmin());
        SecurityContextHolder.clearContext();
        assertEquals(401, assertThrows(CampusException.class, access::capabilities).getStatus());
    }
    @Test void disabledRemoteControlsHideAdminControlWithoutRevokingDemoOperations() {
        current("ADMIN");
        properties.setControlEnabled(false);
        Capabilities capabilities = access.capabilities();
        assertFalse(capabilities.canControl());
        assertTrue(capabilities.canRead());
        assertTrue(capabilities.canHandleAlarms());
        assertTrue(capabilities.canAssignAlarms());
        assertTrue(capabilities.canRunDemoScenarios());
        assertTrue(capabilities.canAdmin());
        assertTrue(capabilities.canAudit());
        assertDoesNotThrow(access::requireRead);
        assertDoesNotThrow(() -> access.requireHandleAlarms(access.actor()));
        assertEquals(403, assertThrows(CampusException.class, () -> access.requireControl(access.actor())).getStatus());
    }
    @Test void disabledRemoteControlsPreserveManagerReadsAndAssignedEventHandling() {
        current("CAMPUS_MANAGER");
        properties.setControlEnabled(false);
        Capabilities capabilities = access.capabilities();
        assertFalse(capabilities.canControl());
        assertTrue(capabilities.canRead());
        assertTrue(capabilities.canHandleAlarms());
        assertFalse(capabilities.canAssignAlarms());
        assertFalse(capabilities.canRunDemoScenarios());
        assertDoesNotThrow(access::requireRead);
        assertDoesNotThrow(() -> access.requireHandleAlarms(access.actor()));
        assertEquals(403, assertThrows(CampusException.class, () -> access.requireControl(access.actor())).getStatus());
        properties.setControlEnabled(true);
        assertTrue(access.capabilities().canControl());
        assertTrue(access.capabilities().canHandleAlarms());
    }
    @Test void viewerRemainsReadOnlyRegardlessOfRemoteControlFlag() {
        current("CAMPUS_VIEWER");
        for (boolean enabled : new boolean[]{false, true}) {
            properties.setControlEnabled(enabled);
            Capabilities capabilities = access.capabilities();
            assertTrue(capabilities.canRead());
            assertFalse(capabilities.canControl());
            assertFalse(capabilities.canHandleAlarms());
            assertFalse(capabilities.canAssignAlarms());
            assertFalse(capabilities.canRunDemoScenarios());
            assertEquals(403, assertThrows(CampusException.class, () -> access.requireControl(access.actor())).getStatus());
            assertEquals(403, assertThrows(CampusException.class, () -> access.requireHandleAlarms(access.actor())).getStatus());
        }
    }
}
