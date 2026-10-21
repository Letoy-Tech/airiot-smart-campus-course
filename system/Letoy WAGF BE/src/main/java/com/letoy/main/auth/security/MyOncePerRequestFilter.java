package com.letoy.main.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.auth.service.MyAuthUserService;
import com.letoy.main.auth.service.TokenRevocationService;
import com.letoy.main.behavior.entity.UserBehaviorLog;
import com.letoy.main.behavior.service.UserBehaviorLogService;
import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.behavior.support.UserBehaviorLogFactory;
import com.letoy.main.common.enums.ErrorCode;
import com.letoy.main.common.exception.MyAuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;

@Component
public class MyOncePerRequestFilter extends OncePerRequestFilter {

    private final MyAuthUserService myAuthUserService;
    private final JwtTokenUtil jwtTokenUtil;
    private final TokenRevocationService tokenRevocationService;
    private final UserBehaviorLogFactory userBehaviorLogFactory;
    private final UserBehaviorLogService userBehaviorLogService;

    public MyOncePerRequestFilter(MyAuthUserService myAuthUserService,
                                  JwtTokenUtil jwtTokenUtil,
                                  TokenRevocationService tokenRevocationService,
                                  UserBehaviorLogFactory userBehaviorLogFactory,
                                  UserBehaviorLogService userBehaviorLogService) {
        this.myAuthUserService = myAuthUserService;
        this.jwtTokenUtil = jwtTokenUtil;
        this.tokenRevocationService = tokenRevocationService;
        this.userBehaviorLogFactory = userBehaviorLogFactory;
        this.userBehaviorLogService = userBehaviorLogService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        long startedAtMillis = System.currentTimeMillis();
        String headerToken = request.getHeader("Authorization");
        try {
            if (headerToken != null && !headerToken.isBlank()) {
                String userId = jwtTokenUtil.getUidFromToken(headerToken);
                if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    AuthUser authUser = myAuthUserService.getUserByUserId(userId);
                    if (authUser == null) {
                        throw new MyAuthenticationException("User does not exist");
                    }
                    if (!authUser.isEnabled() || !authUser.isAccountNonLocked()) {
                        throw new MyAuthenticationException("User is disabled or locked");
                    }
                    boolean valid = jwtTokenUtil.validateToken(headerToken, authUser);
                    if (!valid || tokenRevocationService.isTokenRevoked(headerToken, userId)) {
                        throw new MyAuthenticationException("Token is invalid");
                    }
                    request.setAttribute(UserBehaviorLogContext.ATTR_UID, authUser.getId());
                    request.setAttribute(UserBehaviorLogContext.ATTR_USERNAME, authUser.getUsername());
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            authUser,
                            null,
                            authUser.getAuthorities()
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
            chain.doFilter(request, response);
            if (request.getAttribute(UserBehaviorLogContext.ATTR_OUTCOME) == null && response.getStatus() < HttpServletResponse.SC_BAD_REQUEST) {
                UserBehaviorLogContext.markSuccess(request);
            }
        } catch (MyAuthenticationException exception) {
            UserBehaviorLogContext.mark(
                    request,
                    UserBehaviorLogContext.OUTCOME_AUTH_FAILURE,
                    UserBehaviorLogContext.RISK_SUSPICIOUS,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    ErrorCode.AUTH_TOKEN_INVALID.getCode(),
                    exception.getMessage()
            );
            writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, "auth_error.authenticate_fail");
        } finally {
            UserBehaviorLog behaviorLog = userBehaviorLogFactory.create(request, response, startedAtMillis);
            userBehaviorLogService.record(behaviorLog);
        }
    }

    private void writeJson(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(code);
        response.setContentType("application/json;charset=UTF-8");
        HashMap<String, Object> payload = new HashMap<>();
        payload.put("status", code);
        payload.put("msg", message);
        PrintWriter out = response.getWriter();
        out.write(new ObjectMapper().writeValueAsString(payload));
        out.flush();
        out.close();
    }
}
