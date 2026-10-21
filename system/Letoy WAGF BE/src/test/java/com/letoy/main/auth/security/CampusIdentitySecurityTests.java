package com.letoy.main.auth.security;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.auth.service.MyAuthUserService;
import com.letoy.main.auth.service.PrincipalCacheService;
import com.letoy.main.auth.service.TokenRevocationService;
import com.letoy.main.auth.service.impl.VersionBasedRevocationStrategy;
import com.letoy.main.auth.service.impl.MyAuthUserServiceImpl;
import com.letoy.main.behavior.service.UserBehaviorLogService;
import com.letoy.main.behavior.support.UserBehaviorLogFactory;
import com.letoy.main.permission.entity.ApiRule;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CampusIdentitySecurityTests {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    private JwtProperties properties() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("TEST-only-isolated-signing-key-".repeat(4));
        properties.setIssuer("TEST-campus-be");
        properties.setLegacyMode(false);
        return properties;
    }
    private JwtTokenUtil tokens(JwtProperties properties) {
        JwtTokenUtil tokens = new JwtTokenUtil();
        ReflectionTestUtils.setField(tokens, "jwtProperties", properties);
        return tokens;
    }
    @Test void normalAccessBearerAndRevokedVersionAreVerifiedConsistently() {
        JwtProperties properties = properties();
        JwtTokenUtil tokens = tokens(properties);
        UserInfo user = UserInfo.builder().uid("TEST_USER").active(true).roles("CAMPUS_VIEWER").tokenVersion(1).build();
        String token = tokens.generateEnhancedAccessToken(user);
        AuthUser principal = new AuthUser();
        principal.setId(user.getUid());
        assertTrue(tokens.validateToken("Bearer " + token, principal));
        assertEquals(1, tokens.getTokenVersionFromToken("Bearer " + token));
        UserInfoMapper users = mock(UserInfoMapper.class);
        when(users.getTokenVersionByUid("TEST_USER")).thenReturn(2);
        VersionBasedRevocationStrategy revocation = new VersionBasedRevocationStrategy();
        ReflectionTestUtils.setField(revocation, "jwtProperties", properties);
        ReflectionTestUtils.setField(revocation, "jwtTokenUtil", tokens);
        ReflectionTestUtils.setField(revocation, "userInfoMapper", users);
        assertTrue(revocation.isTokenRevoked("Bearer " + token, "TEST_USER"));
        assertTrue(revocation.isTokenRevoked(tokens.generateAccessToken("TEST_USER"), "TEST_USER"));
    }
    @Test void refreshTokenAndForeignIssuerCannotAuthenticateRequests() {
        JwtProperties properties = properties();
        JwtTokenUtil tokens = tokens(properties);
        AuthUser user = new AuthUser();
        user.setId("TEST_USER");
        assertFalse(tokens.validateToken(tokens.generateRefreshToken("TEST_USER"), user));
        JwtProperties foreign = properties();
        foreign.setIssuer("TEST-other-project");
        String token = tokens(foreign).generateAccessToken("TEST_USER");
        assertThrows(com.letoy.main.common.exception.MyAuthenticationException.class, () -> tokens.validateToken(token, user));
    }
    @Test void disabledAndLockedPrincipalsStopBeforeControllerAndSecretObjectsDoNotLogCredentials() throws Exception {
        MyAuthUserService users = mock(MyAuthUserService.class);
        JwtTokenUtil tokens = mock(JwtTokenUtil.class);
        when(tokens.getUidFromToken("TEST-authorization-header")).thenReturn("TEST_USER");
        AuthUser user = new AuthUser();
        user.setId("TEST_USER");
        user.setState(0);
        user.setPassword("TEST-private-password");
        user.setSystemToken("TEST-private-token");
        assertFalse(user.toString().contains("TEST-private"));
        when(users.getUserByUserId("TEST_USER")).thenReturn(user);
        MyOncePerRequestFilter filter = new MyOncePerRequestFilter(users, tokens, mock(TokenRevocationService.class),
                mock(UserBehaviorLogFactory.class), mock(UserBehaviorLogService.class));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/campus/overview");
        request.addHeader("Authorization", "TEST-authorization-header");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        assertEquals(401, response.getStatus());
        verifyNoInteractions(chain);
        user.setState(1);
        user.setAccountLocked(true);
        request = new MockHttpServletRequest("GET", "/campus/overview");
        request.addHeader("Authorization", "TEST-authorization-header");
        response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertEquals(401, response.getStatus());
        verifyNoInteractions(chain);
    }
    @Test void campusManagerInRootGroupStillCannotManageUsersGroupsRolesOrApiRules() {
        DynamicPermission permissions = new DynamicPermission();
        PrincipalCacheService principals = mock(PrincipalCacheService.class);
        ApiRuleMatcher matcher = mock(ApiRuleMatcher.class);
        RoleInfoMapper roles = mock(RoleInfoMapper.class);
        UserInfoMapper users = mock(UserInfoMapper.class);
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("CAMPUS_MANAGER").status(1).build()));
        when(principals.getPrincipal("TEST_MANAGER")).thenReturn(UserInfo.builder().uid("TEST_MANAGER")
                .roles("CAMPUS_MANAGER,ADMIN").groupIds("ROOT").active(true).build());
        when(users.getUserInfoByUid("TEST_MANAGER")).thenReturn(UserInfo.builder().uid("TEST_MANAGER")
                .roles("CAMPUS_MANAGER,ADMIN").groupIds("ROOT").active(true).build());
        ReflectionTestUtils.setField(permissions, "principalCacheService", principals);
        ReflectionTestUtils.setField(permissions, "matcher", matcher);
        ReflectionTestUtils.setField(permissions, "roleInfoMapper", roles);
        ReflectionTestUtils.setField(permissions, "userInfoMapper", users);
        AuthUser user = new AuthUser();
        user.setId("TEST_MANAGER");
        var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
        for (String path : List.of("/users/query", "/users/OTHER/password", "/groups/root", "/roles/ADMIN", "/security/api-rules/1")) {
            assertFalse(permissions.checkPermission(new MockHttpServletRequest("POST", path), auth));
        }
        verifyNoInteractions(matcher);
        ApiRule rule = new ApiRule();
        rule.setGroupPolicy("ANY");
        when(matcher.match("/users/me", "GET")).thenReturn(Optional.of(new ApiRuleMatcher.Match(rule, Map.of())));
        assertTrue(permissions.checkPermission(new MockHttpServletRequest("GET", "/users/me"), auth));
    }
    @Test void pureDisabledAdminAndCachedAdminCannotReenableTheirOwnRoles() {
        DynamicPermission permissions = new DynamicPermission();
        PrincipalCacheService principals = mock(PrincipalCacheService.class);
        UserInfoMapper users = mock(UserInfoMapper.class);
        RoleInfoMapper roles = mock(RoleInfoMapper.class);
        ApiRuleMatcher matcher = mock(ApiRuleMatcher.class);
        UserInfo cachedAdmin = UserInfo.builder().uid("TEST_ADMIN").roles("ADMIN").groupIds("ROOT").active(true).build();
        when(principals.getPrincipal("TEST_ADMIN")).thenReturn(cachedAdmin);
        when(users.getUserInfoByUid("TEST_ADMIN")).thenReturn(cachedAdmin);
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("ADMIN").status(0).build()));
        ReflectionTestUtils.setField(permissions, "principalCacheService", principals);
        ReflectionTestUtils.setField(permissions, "userInfoMapper", users);
        ReflectionTestUtils.setField(permissions, "roleInfoMapper", roles);
        ReflectionTestUtils.setField(permissions, "matcher", matcher);
        AuthUser user = new AuthUser();
        user.setId("TEST_ADMIN");
        var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
        assertFalse(permissions.checkPermission(new MockHttpServletRequest("PUT", "/roles/ADMIN"), auth));
        when(users.getUserInfoByUid("TEST_ADMIN")).thenReturn(UserInfo.builder().uid("TEST_ADMIN")
                .roles("CAMPUS_VIEWER").groupIds("ROOT").active(true).build());
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("ADMIN").status(1).build()));
        assertFalse(permissions.checkPermission(new MockHttpServletRequest("PUT", "/roles/ADMIN"), auth));
        assertFalse(permissions.checkPermission(new MockHttpServletRequest("POST", "/users"), auth));
        verifyNoInteractions(matcher);
    }
    @Test void authenticationAuthoritiesOmitDisabledRoles() {
        UserInfoMapper users = mock(UserInfoMapper.class);
        RoleInfoMapper roles = mock(RoleInfoMapper.class);
        when(users.getUserInfoByUid("TEST_USER")).thenReturn(UserInfo.builder().uid("TEST_USER").username("TEST_USER")
                .active(true).roles("ADMIN,CAMPUS_VIEWER").build());
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("ADMIN").status(0).build(),
                RoleInfo.builder().roleCode("CAMPUS_VIEWER").status(1).build()));
        assertEquals(List.of("ROLE_CAMPUS_VIEWER"), new MyAuthUserServiceImpl(users, roles).getUserByUserId("TEST_USER")
                .getAuthorities().stream().map(org.springframework.security.core.GrantedAuthority::getAuthority).toList());
    }
}
