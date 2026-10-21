package com.letoy.main.auth.service.impl;

import com.letoy.main.auth.entity.RefreshToken;
import com.letoy.main.auth.mapper.RefreshTokenMapper;
import com.letoy.main.auth.security.JwtProperties;
import com.letoy.main.auth.security.JwtTokenUtil;
import com.letoy.main.auth.security.MyOncePerRequestFilter;
import com.letoy.main.behavior.service.UserBehaviorLogService;
import com.letoy.main.behavior.support.UserBehaviorLogFactory;
import com.letoy.main.common.exception.MyAuthenticationException;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real JWT generation/validation with only isolated in-memory mapper doubles. */
class RefreshTokenFlowTests {
    private UserInfo user;
    private UserInfoMapper users;
    private RoleInfoMapper roles;
    private JwtTokenUtil tokens;
    private RefreshTokenServiceImpl refresh;
    private VersionBasedRevocationStrategy revocation;
    @BeforeEach void setup() {
        user = UserInfo.builder().uid("TEST_REFRESH").username("TEST_REFRESH").active(true).accountLocked(false)
                .tokenVersion(1).roles("CAMPUS_VIEWER").build();
        users = mock(UserInfoMapper.class);
        when(users.getUserInfoByUid(user.getUid())).thenReturn(user);
        when(users.getTokenVersionByUid(user.getUid())).thenAnswer(call -> user.getTokenVersion());
        roles = mock(RoleInfoMapper.class);
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("CAMPUS_VIEWER").status(1).build()));
        JwtProperties properties = new JwtProperties();
        properties.setSecret("TEST-isolated-refresh-signing-key-".repeat(4));
        properties.setIssuer("TEST-campus-refresh");
        properties.setLegacyMode(false);
        tokens = new JwtTokenUtil();
        ReflectionTestUtils.setField(tokens, "jwtProperties", properties);
        revocation = new VersionBasedRevocationStrategy();
        ReflectionTestUtils.setField(revocation, "jwtProperties", properties);
        ReflectionTestUtils.setField(revocation, "jwtTokenUtil", tokens);
        ReflectionTestUtils.setField(revocation, "userInfoMapper", users);
        RefreshTokenMapper store = mock(RefreshTokenMapper.class);
        AtomicReference<RefreshToken> saved = new AtomicReference<>();
        when(store.insert(any())).thenAnswer(call -> { RefreshToken token = call.getArgument(0); token.setId(42L); saved.set(token); return 1; });
        when(store.findByToken(anyString())).thenAnswer(call -> saved.get() != null && saved.get().getRefreshToken().equals(call.getArgument(0)) ? saved.get() : null);
        refresh = new RefreshTokenServiceImpl();
        ReflectionTestUtils.setField(refresh, "refreshTokenMapper", store);
        ReflectionTestUtils.setField(refresh, "jwtTokenUtil", tokens);
        ReflectionTestUtils.setField(refresh, "tokenRevocationService", revocation);
        ReflectionTestUtils.setField(refresh, "userInfoMapper", users);
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void createRefreshAndAuthenticateNewAccessThroughActualFilter() throws Exception {
        RefreshToken token = refresh.createRefreshToken(user.getUid(), "TEST-access-jti", new MockHttpServletRequest());
        assertEquals(1, tokens.getTokenVersionFromToken(token.getRefreshToken()));
        String access = refresh.refreshAccessToken(token.getRefreshToken());
        assertEquals(1, tokens.getTokenVersionFromToken(access));
        assertFalse(revocation.isTokenRevoked("Bearer " + access, user.getUid()));
        MyOncePerRequestFilter filter = new MyOncePerRequestFilter(new MyAuthUserServiceImpl(users, roles), tokens, revocation,
                mock(UserBehaviorLogFactory.class), mock(UserBehaviorLogService.class));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/campus/overview");
        request.addHeader("Authorization", "Bearer " + access);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        assertEquals(200, response.getStatus());
        assertEquals(user.getUid(), ((com.letoy.main.auth.entity.AuthUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getId());
    }
    @Test void revokedVersionDisabledAndLockedUsersCannotRefresh() {
        RefreshToken token = refresh.createRefreshToken(user.getUid(), "TEST-access-jti", new MockHttpServletRequest());
        user.setActive(false);
        assertThrows(MyAuthenticationException.class, () -> refresh.refreshAccessToken(token.getRefreshToken()));
        user.setActive(true);
        user.setAccountLocked(true);
        assertThrows(MyAuthenticationException.class, () -> refresh.refreshAccessToken(token.getRefreshToken()));
        user.setAccountLocked(false);
        user.setTokenVersion(2);
        assertThrows(MyAuthenticationException.class, () -> refresh.refreshAccessToken(token.getRefreshToken()));
    }
}
