package edu.campus.v2.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.campus.v2.user.AuthenticatedUser;
import java.time.Duration;
import java.util.Optional;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Redis 实现：键为 campus:v2:session:&lt;token&gt;，值为 {username, role} 的 JSON，TTL 由调用方给出。
 * 本课程 Redis 关闭了 RDB 与 AOF，会话只活在内存里：redis 进程重启后自动失效。
 * 所有 Redis 访问失败都转成 SessionStoreUnavailableException，由上层返回 503。
 */
@Component
public class RedisLoginSessionStore implements LoginSessionStore {

    /** 课程约定前缀：不要改，否则会话无法按课程说明定位。 */
    static final String KEY_PREFIX = "campus:v2:session:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisLoginSessionStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void save(String token, AuthenticatedUser user, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(key(token), toJson(user), ttl);
        } catch (DataAccessException unavailable) {
            throw new SessionStoreUnavailableException("写入登录会话失败：Redis 不可用", unavailable);
        }
    }

    @Override
    public Optional<AuthenticatedUser> find(String token) {
        String json;
        try {
            json = redisTemplate.opsForValue().get(key(token));
        } catch (DataAccessException unavailable) {
            throw new SessionStoreUnavailableException("读取登录会话失败：Redis 不可用", unavailable);
        }
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, AuthenticatedUser.class));
        } catch (JsonProcessingException brokenValue) {
            // 值无法解析时按“会话无效”处理，不猜测、不放行
            return Optional.empty();
        }
    }

    @Override
    public void delete(String token) {
        try {
            redisTemplate.delete(key(token));
        } catch (DataAccessException unavailable) {
            throw new SessionStoreUnavailableException("删除登录会话失败：Redis 不可用", unavailable);
        }
    }

    private static String key(String token) {
        return KEY_PREFIX + token;
    }

    private String toJson(AuthenticatedUser user) {
        try {
            return objectMapper.writeValueAsString(user);
        } catch (JsonProcessingException unexpected) {
            throw new IllegalStateException("会话内容无法序列化", unexpected);
        }
    }
}
