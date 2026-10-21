package com.letoy.main.auth.security;

import com.letoy.main.permission.entity.ApiRule;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.auth.service.PrincipalCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 动态权限检查器
 *
 * <p><strong>Phase 3: 权限缓存优化</strong>
 * - 使用 PrincipalCacheService 缓存用户信息，减少 DB 查询
 * - 结构化日志：记录 userId/uri/ruleMatched/decision/reason
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 3 升级)
 */
@Component
public class DynamicPermission {

    private static final Logger logger = LoggerFactory.getLogger(DynamicPermission.class);

    @Resource private ApiRuleMatcher matcher;

    // Phase 3: 引入 Principal 缓存
    @Resource private PrincipalCacheService principalCacheService;
    @Resource private com.letoy.main.role.mapper.RoleInfoMapper roleInfoMapper;
    @Resource private com.letoy.main.user.mapper.UserInfoMapper userInfoMapper;

    public boolean checkPermission(HttpServletRequest req, Authentication auth) {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) return true;

        String uri = req.getRequestURI();
        String method = req.getMethod();

        if (auth == null) {
            logger.debug("🔴 PERMISSION CHECK FAILED | {} {} | auth=null | 原因：SecurityContext中没有认证信息", method, uri);
            logger.debug("   可能原因：1) 请求未包含token  2) token无效/过期  3) MyOncePerRequestFilter未正确设置SecurityContext");
            return false;
        }

        Object principal = auth.getPrincipal();
        if (!(principal instanceof AuthUser au)) {
            logger.debug("🔴 PERMISSION CHECK FAILED | {} {} | principal类型={} | 期望类型=AuthUser",
                        method, uri, principal != null ? principal.getClass().getSimpleName() : "null");
            logger.debug("   → 这是BUG！Principal应该是AuthUser对象，但实际是: {}", principal);
            return false;
        }

        String uid = au.getId();

        // Phase 3: 使用缓存获取用户信息（减少 DB 查询）
        UserInfo caller = principalCacheService.getPrincipal(uid);
        if (caller == null) {
            logDecision(uid, method, uri, null, false, "CALLER_NOT_FOUND", null);
            return false;
        }

        // Administrative actions always consult current DB identity and enabled role definitions.
        // Neither a ROOT group nor a cached ADMIN role can restore a revoked/disabled role.
        if (isTemplateManagement(uri)) {
            UserInfo current = userInfoMapper.getUserInfoByUid(uid);
            if (current == null || !Boolean.TRUE.equals(current.getActive()) || Boolean.TRUE.equals(current.getAccountLocked())) {
                logDecision(uid, method, uri, null, false, "CURRENT_IDENTITY_DENIED", null);
                return false;
            }
            Set<String> currentRoles = csvToSet(current.getRoles());
            boolean enabledAdmin = roleInfoMapper.selectAll(null, 1).stream()
                    .anyMatch(role -> Integer.valueOf(1).equals(role.getStatus()) && currentRoles.contains(role.getRoleCode())
                            && ("ADMIN".equals(role.getRoleCode()) || "SUPER_ADMIN".equals(role.getRoleCode())));
            if (!enabledAdmin) {
                logDecision(uid, method, uri, null, false, "ENABLED_ADMIN_ROLE_REQUIRED", null);
                return false;
            }
            caller = current;
        }

        Set<String> callerGroups = csvToSet(caller.getGroupIds());
        if (callerGroups.isEmpty()) {
            logDecision(uid, method, uri, null, false, "NO_GROUPS", null);
            return false;
        }

        Optional<ApiRuleMatcher.Match> opt = matcher.match(uri, method);
        if (opt.isEmpty()) {
            logDecision(uid, method, uri, null, false, "NO_RULE_MATCHED", null);
            logger.warn("未匹配到规则: {} {}", method, uri);
            return false;
        }
        ApiRule rule = opt.get().getRule();
        Map<String,String> vars = opt.get().getPathVars();

        String policy = safe(rule.getGroupPolicy());
        boolean ok = switch (policy) {
            case "ANY" -> true;
            case "ALLOWLIST" -> {
                Set<String> allowedGroups = csvToSet(rule.getAllowedGroupIds());
                boolean allowed = hasIntersection(callerGroups, allowedGroups);
                if (!allowed) {
                    logDecision(uid, method, uri, policy, false,
                            "GROUP_NOT_IN_ALLOWLIST",
                            String.format("callerGroups=%s, allowedGroups=%s", callerGroups, allowedGroups));
                }
                yield allowed;
            }
            case "DIRECT_PATH" -> {
                String k = rule.getGroupIdPathVar();
                boolean allowed = (k != null && callerGroups.contains(vars.get(k)));
                if (!allowed) {
                    logDecision(uid, method, uri, policy, false,
                            "GROUP_NOT_IN_PATH",
                            String.format("callerGroups=%s, pathVar=%s, pathValue=%s",
                                    callerGroups, k, vars.get(k)));
                }
                yield allowed;
            }
            case "BY_USER_GROUP" -> {
                String k = rule.getUserIdPathVar();
                if (k == null) {
                    logDecision(uid, method, uri, policy, false, "NO_USER_ID_PATH_VAR", null);
                    yield false;
                }
                String userId = vars.get(k);
                if (userId == null) {
                    logDecision(uid, method, uri, policy, false, "USER_ID_NOT_IN_PATH",
                            String.format("pathVar=%s", k));
                    yield false;
                }

                // Phase 3: 使用缓存获取目标用户信息
                UserInfo target = principalCacheService.getPrincipal(userId);
                boolean allowed = target != null && hasIntersection(callerGroups, csvToSet(target.getGroupIds()));
                if (!allowed) {
                    logDecision(uid, method, uri, policy, false,
                            "NO_GROUP_INTERSECTION",
                            String.format("callerGroups=%s, targetGroups=%s",
                                    callerGroups, target != null ? csvToSet(target.getGroupIds()) : "null"));
                }
                yield allowed;
            }
            default -> {
                logDecision(uid, method, uri, policy, false, "UNKNOWN_POLICY", null);
                yield false;
            }
        };

        if (ok) {
            logDecision(uid, method, uri, policy, true, "ALLOWED", null);
        }

        return ok;
    }

    /**
     * 结构化日志记录权限决策（Phase 3）
     *
     * @param uid 用户 ID
     * @param method HTTP 方法
     * @param uri 请求 URI
     * @param policy 权限策略
     * @param decision 决策结果（true=允许, false=拒绝）
     * @param reason 原因代码
     * @param details 详细信息
     */
    private void logDecision(String uid, String method, String uri, String policy,
                             boolean decision, String reason, String details) {
        if (decision) {
            logger.debug("✅ ALLOW | uid={} | {} {} | policy={} | reason={}",
                    uid, method, uri, policy, reason);
        } else {
            logger.info("❌ DENY | uid={} | {} {} | policy={} | reason={} | details={}",
                    uid, method, uri, policy, reason, details != null ? details : "");
        }
    }

    private static String safe(String s){ return s==null? "ANY" : s.trim().toUpperCase(); }

    private static boolean isTemplateManagement(String uri) {
        if (uri.equals("/users/me") || uri.startsWith("/users/me/")) return false;
        return List.of("/users", "/groups", "/roles", "/security/api-rules", "/aliyun", "/ai", "/dashboard")
                .stream().anyMatch(prefix -> uri.equals(prefix) || uri.startsWith(prefix + "/"));
    }

    private static Set<String> csvToSet(String csv) {
        if (csv == null || csv.isBlank()) return Collections.emptySet();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(x -> !x.isEmpty())
                .collect(Collectors.toSet());
    }
    private static boolean hasIntersection(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return false;
        for (String s : a) if (b.contains(s)) return true;
        return false;
    }
}
