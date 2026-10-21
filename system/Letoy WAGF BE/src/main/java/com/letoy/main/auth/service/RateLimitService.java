package com.letoy.main.auth.service;

import com.letoy.main.common.exception.RequestLimitException;
import com.letoy.main.common.util.RedisUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.concurrent.TimeUnit;

/**
 * 限流服务 - Phase 4: Lua 原子化
 *
 * <p><strong>设计目标</strong>：
 * <ul>
 *   <li>原子化 INCR+EXPIRE：使用 Lua 脚本解决竞态条件</li>
 *   <li>Key 策略优化：区分匿名用户（IP）和已登录用户（UID）</li>
 *   <li>返回 HTTP 429：标准化限流响应</li>
 *   <li>Retry-After header：告知客户端何时可以重试</li>
 * </ul>
 *
 * <p><strong>Before (Phase 3)</strong>:
 * <pre>
 * // 非原子操作，竞态风险
 * long count = redis.incr(key, 1);
 * if (count == 1) {
 *     redis.expire(key, expireTime);  // 如果这里失败，key 永不过期
 * }
 * </pre>
 *
 * <p><strong>After (Phase 4)</strong>:
 * <pre>
 * // Lua 脚本原子化
 * local count = redis.call('INCR', KEYS[1])
 * if count == 1 then
 *     redis.call('EXPIRE', KEYS[1], ARGV[1])
 * end
 * return count
 * </pre>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 4)
 */
@Service
public class RateLimitService {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitService.class);

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Value("${template.app-name:backend-template}")
    private String appName;

    /**
     * Lua 脚本：原子化 INCR + EXPIRE
     * <p>
     * KEYS[1]: Redis key
     * ARGV[1]: 过期时间（秒）
     * 返回值：当前请求次数
     */
    private static final String LUA_SCRIPT_INCR_EXPIRE =
            "local count = redis.call('INCR', KEYS[1]) " +
            "if count == 1 then " +
            "    redis.call('EXPIRE', KEYS[1], ARGV[1]) " +
            "end " +
            "return count";

    private final DefaultRedisScript<Long> rateLimitScript;

    public RateLimitService() {
        this.rateLimitScript = new DefaultRedisScript<>();
        this.rateLimitScript.setScriptText(LUA_SCRIPT_INCR_EXPIRE);
        this.rateLimitScript.setResultType(Long.class);
    }

    /**
     * 检查限流（已登录用户）
     *
     * @param uid 用户 ID
     * @param method HTTP 方法
     * @param uri 请求 URI
     * @param limit 限流次数
     * @param windowSeconds 时间窗口（秒）
     * @return RateLimitResult（包含是否允许、剩余次数、重试时间）
     */
    public RateLimitResult checkRateLimit(String uid, String method, String uri,
                                          int limit, long windowSeconds) {
        String key = buildKey("user", uid, method, uri);
        return executeRateLimit(key, method, uri, limit, windowSeconds, "uid=" + uid);
    }

    /**
     * 检查限流（匿名用户）
     *
     * @param ip 客户端 IP
     * @param method HTTP 方法
     * @param uri 请求 URI
     * @param limit 限流次数
     * @param windowSeconds 时间窗口（秒）
     * @return RateLimitResult
     */
    public RateLimitResult checkRateLimitAnonymous(String ip, String method, String uri,
                                                   int limit, long windowSeconds) {
        String key = buildKey("anon", ip, method, uri);
        return executeRateLimit(key, method, uri, limit, windowSeconds, "ip=" + ip);
    }

    /**
     * 执行限流检查（Lua 脚本原子化）
     */
    private RateLimitResult executeRateLimit(String key, String method, String uri,
                                             int limit, long windowSeconds, String identifier) {
        try {
            // 使用 Lua 脚本原子化执行 INCR + EXPIRE
            Long count = stringRedisTemplate.execute(
                    rateLimitScript,
                    Collections.singletonList(key),
                    String.valueOf(windowSeconds)
            );

            if (count == null) {
                logger.error("Lua 脚本执行失败，降级允许请求: key={}", key);
                return RateLimitResult.allowed(limit, windowSeconds);
            }

            long currentCount = count;
            boolean allowed = currentCount <= limit;
            long remaining = Math.max(0, limit - currentCount);

            // 获取 TTL（计算 Retry-After）
            Long ttl = stringRedisTemplate.getExpire(key, TimeUnit.SECONDS);
            long retryAfter = (ttl != null && ttl > 0) ? ttl : windowSeconds;

            if (!allowed) {
                logger.warn("❌ RATE_LIMIT | {} | {} {} | count={}/{} | retryAfter={}s",
                        identifier, method, uri, currentCount, limit, retryAfter);
            } else {
                logger.debug("✅ RATE_LIMIT_OK | {} | {} {} | count={}/{} | remaining={}",
                        identifier, method, uri, currentCount, limit, remaining);
            }

            return new RateLimitResult(allowed, currentCount, limit, remaining, retryAfter);

        } catch (Exception e) {
            logger.error("限流检查失败，降级允许请求: key={}, error={}", key, e.getMessage());
            // 降级策略：出错时允许请求
            return RateLimitResult.allowed(limit, windowSeconds);
        }
    }

    /**
     * 构建 Redis Key
     * <p>
     * 格式：{appName}:RATE_LIMIT:{type}:{identifier}:{method}:{uri}
     * <p>
     * 示例：
     * - backend-template:RATE_LIMIT:user:U123456:POST:/api/users
     * - backend-template:RATE_LIMIT:anon:192.168.1.100:GET:/api/health
     */
    private String buildKey(String type, String identifier, String method, String uri) {
        return String.format("%s:RATE_LIMIT:%s:%s:%s:%s",
                appName, type, identifier, method, normalizeUri(uri));
    }

    /**
     * 规范化 URI（去除查询参数和路径参数）
     */
    private String normalizeUri(String uri) {
        // 去除查询参数
        int queryIndex = uri.indexOf('?');
        if (queryIndex > 0) {
            uri = uri.substring(0, queryIndex);
        }
        // 去除尾部斜杠
        if (uri.endsWith("/")) {
            uri = uri.substring(0, uri.length() - 1);
        }
        return uri;
    }

    /**
     * 限流结果
     */
    public static class RateLimitResult {
        private final boolean allowed;
        private final long currentCount;
        private final long limit;
        private final long remaining;
        private final long retryAfterSeconds;

        public RateLimitResult(boolean allowed, long currentCount, long limit,
                               long remaining, long retryAfterSeconds) {
            this.allowed = allowed;
            this.currentCount = currentCount;
            this.limit = limit;
            this.remaining = remaining;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public static RateLimitResult allowed(long limit, long windowSeconds) {
            return new RateLimitResult(true, 0, limit, limit, windowSeconds);
        }

        public boolean isAllowed() {
            return allowed;
        }

        public long getCurrentCount() {
            return currentCount;
        }

        public long getLimit() {
            return limit;
        }

        public long getRemaining() {
            return remaining;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }

        /**
         * 创建 HTTP 429 响应异常
         */
        public RequestLimitException toException() {
            return new RequestLimitException(
                    String.format("请求过于频繁，请 %d 秒后重试", retryAfterSeconds)
            );
        }
    }
}
