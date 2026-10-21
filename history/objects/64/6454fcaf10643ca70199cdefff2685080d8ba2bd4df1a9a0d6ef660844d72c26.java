package cn.campus.course;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    static final String PREFIX = "campus:v2:session:";
    static final Duration SESSION_TTL = Duration.ofSeconds(1800);
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();
    private final String dummyHash = passwords.encode("not-a-course-password");

    public AuthService(JdbcTemplate jdbc, StringRedisTemplate redis, ObjectMapper json) {
        this.jdbc = jdbc;
        this.redis = redis;
        this.json = json;
    }

    public Map<String, Object> login(String username, String password) {
        var rows = jdbc.queryForList("SELECT username, password_hash, role FROM users WHERE username=?", username);
        String hash = rows.isEmpty() ? dummyHash : (String) rows.get(0).get("password_hash");
        boolean matched = passwords.matches(password, hash);
        if (rows.isEmpty() || !matched) {
            throw new ApiException(401, "用户名或口令不正确");
        }
        User user = new User(username, (String) rows.get(0).get("role"));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {
            redis.opsForValue().set(PREFIX + token, json.writeValueAsString(user), SESSION_TTL);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("无法编码登录状态", e);
        }
        return Map.of("token", token, "user", user);
    }

    public User authenticate(String authorization) {
        String raw = redis.opsForValue().get(PREFIX + token(authorization));
        if (raw == null) {
            throw new ApiException(401, "登录已过期，请重新登录");
        }
        try {
            return json.readValue(raw, User.class);
        } catch (JsonProcessingException e) {
            throw new ApiException(401, "登录状态无效，请重新登录");
        }
    }

    public void logout(String authorization) {
        redis.delete(PREFIX + token(authorization));
    }

    private String token(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            throw new ApiException(401, "请先登录");
        }
        String token = header.substring(7);
        if (!token.matches("[A-Za-z0-9_-]{43}")) {
            throw new ApiException(401, "登录状态无效，请重新登录");
        }
        return token;
    }
}
