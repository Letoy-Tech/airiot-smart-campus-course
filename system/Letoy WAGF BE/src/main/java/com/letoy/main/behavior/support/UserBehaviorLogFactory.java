package com.letoy.main.behavior.support;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.behavior.config.UserBehaviorLogProperties;
import com.letoy.main.behavior.entity.UserBehaviorLog;
import com.letoy.main.common.util.MyIpUtil;
import com.letoy.main.common.util.RandomUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class UserBehaviorLogFactory {

    private final UserBehaviorLogProperties properties;

    public UserBehaviorLogFactory(UserBehaviorLogProperties properties) {
        this.properties = properties;
    }

    public UserBehaviorLog create(HttpServletRequest request, HttpServletResponse response, long startedAtMillis) {
        long durationMs = Math.max(0L, System.currentTimeMillis() - startedAtMillis);
        int httpStatus = resolveHttpStatus(request, response);
        String outcome = stringAttribute(request, UserBehaviorLogContext.ATTR_OUTCOME);
        String riskLevel = stringAttribute(request, UserBehaviorLogContext.ATTR_RISK_LEVEL);

        if (outcome == null) {
            outcome = defaultOutcome(httpStatus);
        }
        if (riskLevel == null) {
            riskLevel = defaultRiskLevel(httpStatus);
        }

        AuthUser authUser = resolveAuthenticatedUser();
        String uid = firstNonBlank(
                stringAttribute(request, UserBehaviorLogContext.ATTR_UID),
                authUser == null ? null : authUser.getId()
        );
        String username = firstNonBlank(
                stringAttribute(request, UserBehaviorLogContext.ATTR_USERNAME),
                authUser == null ? null : authUser.getUsername()
        );

        String requestUri = request.getRequestURI();
        String queryString = truncate(request.getQueryString(), properties.getMaxQueryStringLength());
        String requestTarget = requestUri;
        if (queryString != null && !queryString.isBlank()) {
            requestTarget = truncate(requestUri + "?" + queryString, properties.getMaxRequestTargetLength());
        }

        return UserBehaviorLog.builder()
                .id(RandomUtil.getRandomId())
                .traceId(resolveTraceId(request))
                .uid(uid)
                .username(username)
                .requestMethod(request.getMethod())
                .requestUri(requestUri)
                .queryString(queryString)
                .requestTarget(requestTarget)
                .clientIp(MyIpUtil.getIpAddr(request))
                .userAgent(truncate(request.getHeader("User-Agent"), properties.getMaxUserAgentLength()))
                .platform(firstNonBlank(request.getHeader("X-Platform"), request.getHeader("Platform")))
                .appVersion(firstNonBlank(request.getHeader("X-App-Version"), request.getHeader("App-Version")))
                .outcome(outcome)
                .riskLevel(riskLevel)
                .httpStatus(httpStatus)
                .businessCode(integerAttribute(request, UserBehaviorLogContext.ATTR_BUSINESS_CODE))
                .errorMessage(truncate(stringAttribute(request, UserBehaviorLogContext.ATTR_ERROR_MESSAGE), properties.getMaxErrorMessageLength()))
                .durationMs(durationMs)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private String resolveTraceId(HttpServletRequest request) {
        String traceId = stringAttribute(request, UserBehaviorLogContext.ATTR_TRACE_ID);
        if (traceId != null) {
            return traceId;
        }
        traceId = RandomUtil.getRandomId();
        request.setAttribute(UserBehaviorLogContext.ATTR_TRACE_ID, traceId);
        return traceId;
    }

    private int resolveHttpStatus(HttpServletRequest request, HttpServletResponse response) {
        Integer status = integerAttribute(request, UserBehaviorLogContext.ATTR_HTTP_STATUS);
        if (status != null) {
            return status;
        }
        return response.getStatus() > 0 ? response.getStatus() : HttpServletResponse.SC_OK;
    }

    private AuthUser resolveAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthUser authUser) {
            return authUser;
        }
        return null;
    }

    private String defaultOutcome(int httpStatus) {
        if (httpStatus >= 500) {
            return UserBehaviorLogContext.OUTCOME_SYSTEM_ERROR;
        }
        if (httpStatus == HttpServletResponse.SC_UNAUTHORIZED) {
            return UserBehaviorLogContext.OUTCOME_AUTH_FAILURE;
        }
        if (httpStatus == HttpServletResponse.SC_FORBIDDEN) {
            return UserBehaviorLogContext.OUTCOME_ACCESS_DENIED;
        }
        if (httpStatus == 429) {
            return UserBehaviorLogContext.OUTCOME_RATE_LIMITED;
        }
        if (httpStatus >= 400) {
            return UserBehaviorLogContext.OUTCOME_BAD_REQUEST;
        }
        return UserBehaviorLogContext.OUTCOME_SUCCESS;
    }

    private String defaultRiskLevel(int httpStatus) {
        if (httpStatus >= 500) {
            return UserBehaviorLogContext.RISK_ERROR;
        }
        if (httpStatus >= 400) {
            return UserBehaviorLogContext.RISK_SUSPICIOUS;
        }
        return UserBehaviorLogContext.RISK_NORMAL;
    }

    private String stringAttribute(HttpServletRequest request, String key) {
        Object value = request.getAttribute(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return text.isBlank() ? null : text;
    }

    private Integer integerAttribute(HttpServletRequest request, String key) {
        Object value = request.getAttribute(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || maxLength <= 0 || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
