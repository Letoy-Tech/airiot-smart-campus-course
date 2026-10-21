package edu.campus.v2.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import edu.campus.v2.web.ApiErrors;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 角色检查：只处理带 @RequireRole 的接口。
 * 已登录但角色不符 → 403；没有会话 → 401（正常会被 SessionAuthFilter 提前拦住）。
 */
@Component
public class RoleInterceptor implements HandlerInterceptor {

    private final ObjectMapper objectMapper;

    public RoleInterceptor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequireRole required = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (required == null) {
            required = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
        }
        if (required == null) {
            return true;
        }

        Object current = request.getAttribute(SessionAuthFilter.CURRENT_USER_ATTRIBUTE);
        if (!(current instanceof AuthenticatedUser user)) {
            ApiErrors.write(objectMapper, response, HttpServletResponse.SC_UNAUTHORIZED,
                    "未登录或会话已过期");
            return false;
        }

        for (Role allowed : required.value()) {
            if (allowed == user.role()) {
                return true;
            }
        }
        ApiErrors.write(objectMapper, response, HttpServletResponse.SC_FORBIDDEN,
                "已登录但无权执行该操作");
        return false;
    }
}
