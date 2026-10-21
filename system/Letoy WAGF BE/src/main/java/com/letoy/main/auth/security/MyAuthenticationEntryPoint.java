package com.letoy.main.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.enums.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class MyAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final Logger logger = LoggerFactory.getLogger(MyAuthenticationEntryPoint.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        logger.debug("Authentication failed for {} {}: {}",
                request.getMethod(), request.getRequestURI(), authException.getMessage());

        UserBehaviorLogContext.mark(
                request,
                UserBehaviorLogContext.OUTCOME_AUTH_FAILURE,
                UserBehaviorLogContext.RISK_SUSPICIOUS,
                HttpServletResponse.SC_UNAUTHORIZED,
                ErrorCode.AUTH_TOKEN_INVALID.getCode(),
                authException.getMessage()
        );

        ApiResponse<Void> body = ApiResponse.<Void>error(ErrorCode.AUTH_TOKEN_INVALID, "Authentication failed")
                .path(request.getRequestURI());

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }
}
