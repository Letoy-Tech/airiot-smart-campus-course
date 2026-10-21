package com.letoy.main.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.enums.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class MyAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger logger = LoggerFactory.getLogger(MyAccessDeniedHandler.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        logger.warn("Access denied for {} {}", request.getMethod(), request.getRequestURI());

        UserBehaviorLogContext.mark(
                request,
                UserBehaviorLogContext.OUTCOME_ACCESS_DENIED,
                UserBehaviorLogContext.RISK_SUSPICIOUS,
                HttpServletResponse.SC_FORBIDDEN,
                ErrorCode.AUTHZ_ACCESS_DENIED.getCode(),
                accessDeniedException.getMessage()
        );

        ApiResponse<Void> body = ApiResponse.<Void>error(ErrorCode.AUTHZ_ACCESS_DENIED, "Access denied")
                .path(request.getRequestURI());

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }
}
