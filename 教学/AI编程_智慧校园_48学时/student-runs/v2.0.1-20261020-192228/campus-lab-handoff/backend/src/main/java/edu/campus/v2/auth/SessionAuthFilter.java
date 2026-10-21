package edu.campus.v2.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.web.ApiErrors;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 会话守门：/api 下除 /api/health 与 /api/login 外，一律要求 Authorization: Bearer &lt;token&gt;。
 * 令牌有效时把身份放进请求属性，供控制器与角色拦截器使用。
 * 缺令牌或会话过期 → 401；Redis 不可用 → 503（不放行，也不伪造成功）。
 * 本类不写任何请求日志：Authorization 与令牌都不进日志。
 */
@Component
public class SessionAuthFilter extends OncePerRequestFilter {

    /** 请求属性名：已登录身份（AuthenticatedUser）。 */
    public static final String CURRENT_USER_ATTRIBUTE = "campus.currentUser";

    /** 请求属性名：本次请求使用的令牌，退出时用它删除同一个会话。 */
    public static final String CURRENT_TOKEN_ATTRIBUTE = "campus.currentToken";

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final Set<String> PUBLIC_PATHS = Set.of("/api/health", "/api/login");

    private final LoginSessionStore sessionStore;
    private final ObjectMapper objectMapper;

    public SessionAuthFilter(LoginSessionStore sessionStore, ObjectMapper objectMapper) {
        this.sessionStore = sessionStore;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = requestPath(request);
        return !path.startsWith("/api/") || PUBLIC_PATHS.contains(path);
    }

    /** 取去掉 context path 的请求路径：真实容器与测试里都能得到 /api/... 这样的值。 */
    private static String requestPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        return path == null ? "" : path;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = bearerToken(request);
        if (token == null) {
            ApiErrors.write(objectMapper, response, HttpServletResponse.SC_UNAUTHORIZED,
                    "未登录：缺少 Bearer 令牌");
            return;
        }

        Optional<AuthenticatedUser> user;
        try {
            user = sessionStore.find(token);
        } catch (SessionStoreUnavailableException unavailable) {
            ApiErrors.write(objectMapper, response, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "会话服务暂时不可用，请稍后重试");
            return;
        }

        if (user.isEmpty()) {
            ApiErrors.write(objectMapper, response, HttpServletResponse.SC_UNAUTHORIZED,
                    "未登录或会话已过期");
            return;
        }

        request.setAttribute(CURRENT_USER_ATTRIBUTE, user.get());
        request.setAttribute(CURRENT_TOKEN_ATTRIBUTE, token);
        filterChain.doFilter(request, response);
    }

    /** 只接受 "Bearer <token>"；格式不对按缺令牌处理。 */
    private static String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (header == null
                || !header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }
}
