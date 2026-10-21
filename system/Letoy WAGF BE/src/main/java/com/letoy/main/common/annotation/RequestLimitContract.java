package com.letoy.main.common.annotation;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.common.exception.RequestLimitException;
import com.letoy.main.auth.service.RateLimitService;
import com.letoy.main.common.util.MyIpUtil;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;

/**
 * 请求限流切面 - Phase 4: Lua 原子化
 *
 * <p><strong>Phase 4 升级</strong>：
 * <ul>
 *   <li>使用 RateLimitService（Lua 脚本原子化）</li>
 *   <li>区分已登录用户（uid）和匿名用户（ip）</li>
 *   <li>返回 HTTP 429 状态码</li>
 *   <li>添加 Retry-After header</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 4 升级)
 */
@Aspect
@Component
public class RequestLimitContract {

    private static final Logger logger = LoggerFactory.getLogger(RequestLimitContract.class);

    @Autowired
    private RateLimitService rateLimitService;

    @Before("within(@org.springframework.web.bind.annotation.RestController *) && @annotation(limit)")
    public void requestLimit(final JoinPoint joinPoint, RequestLimit limit) {
        HttpServletRequest request = findRequest(joinPoint.getArgs());
        String method = request.getMethod();
        String uri = extractUri(request);

        // Phase 4: 区分已登录用户和匿名用户
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        RateLimitService.RateLimitResult result;

        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthUser) {
            // 已登录用户：使用 uid 作为限流 key
            AuthUser authUser = (AuthUser) auth.getPrincipal();
            String uid = authUser.getId();
            result = rateLimitService.checkRateLimit(uid, method, uri, limit.count(), limit.time());
        } else {
            // 匿名用户：使用 IP 作为限流 key
            String ip = MyIpUtil.getIpAddr(request);
            result = rateLimitService.checkRateLimitAnonymous(ip, method, uri, limit.count(), limit.time());
        }

        // 如果限流，抛出异常（GlobalExceptionHandler 会处理为 HTTP 429）
        if (!result.isAllowed()) {
            // 将 retryAfterSeconds 传递给异常，用于设置 Retry-After header
            request.setAttribute("X-RateLimit-Retry-After", result.getRetryAfterSeconds());
            throw result.toException();
        }

        // 设置响应头（告知客户端限流信息）
        request.setAttribute("X-RateLimit-Limit", result.getLimit());
        request.setAttribute("X-RateLimit-Remaining", result.getRemaining());
    }

    private HttpServletRequest findRequest(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof HttpServletRequest) {
                return (HttpServletRequest) arg;
            }
        }
        throw new RequestLimitException("方法中缺失HttpServletRequest参数");
    }

    /**
     * 提取请求 URI（Phase 4: 简化逻辑）
     */
    private String extractUri(HttpServletRequest request) {
        String uri = request.getRequestURI();

        // 去除 context path
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }

        return uri;
    }
}
