package com.letoy.main.behavior.support;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.behavior.config.UserBehaviorLogProperties;
import com.letoy.main.behavior.entity.UserBehaviorLog;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class UserBehaviorLogFactoryTests {

    private final UserBehaviorLogFactory factory = new UserBehaviorLogFactory(new UserBehaviorLogProperties());

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldBuildSuccessLogFromAuthenticatedRequest() {
        AuthUser authUser = new AuthUser();
        authUser.setId("U1001");
        authUser.setUsername("example-user");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(authUser, null, List.of())
        );

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/users/me");
        request.setQueryString("tab=profile");
        request.addHeader("User-Agent", "JUnit");
        request.addHeader("X-Platform", "admin-web");
        request.addHeader("X-App-Version", "1.2.3");
        request.setRemoteAddr("127.0.0.1");

        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        UserBehaviorLog log = factory.create(request, response, System.currentTimeMillis() - 25L);

        assertNotNull(log.getId());
        assertEquals("U1001", log.getUid());
        assertEquals("example-user", log.getUsername());
        assertEquals("GET", log.getRequestMethod());
        assertEquals("/users/me?tab=profile", log.getRequestTarget());
        assertEquals("SUCCESS", log.getOutcome());
        assertEquals("NORMAL", log.getRiskLevel());
        assertEquals("admin-web", log.getPlatform());
        assertEquals("1.2.3", log.getAppVersion());
        assertEquals(200, log.getHttpStatus());
    }

    @Test
    void shouldUseRequestAttributesForSuspiciousFailures() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/login");
        request.setAttribute(UserBehaviorLogContext.ATTR_OUTCOME, UserBehaviorLogContext.OUTCOME_AUTH_FAILURE);
        request.setAttribute(UserBehaviorLogContext.ATTR_RISK_LEVEL, UserBehaviorLogContext.RISK_SUSPICIOUS);
        request.setAttribute(UserBehaviorLogContext.ATTR_BUSINESS_CODE, 1007);
        request.setAttribute(UserBehaviorLogContext.ATTR_ERROR_MESSAGE, "Username or password is incorrect");
        request.setAttribute(UserBehaviorLogContext.ATTR_UID, "ANON");
        request.addHeader("User-Agent", "JUnit");

        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(401);

        UserBehaviorLog log = factory.create(request, response, System.currentTimeMillis());

        assertEquals("AUTH_FAILURE", log.getOutcome());
        assertEquals("SUSPICIOUS", log.getRiskLevel());
        assertEquals(1007, log.getBusinessCode());
        assertEquals("Username or password is incorrect", log.getErrorMessage());
        assertEquals("ANON", log.getUid());
        assertEquals(401, log.getHttpStatus());
    }
}
