package cn.campus.course;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class AuthServiceTest {
    JdbcTemplate jdbc;
    StringRedisTemplate redis;
    ValueOperations<String, String> values;
    AuthService auth;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setup() {
        jdbc = mock(JdbcTemplate.class);
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        auth = new AuthService(jdbc, redis, new ObjectMapper());
    }

    @Test
    void loginStoresRandomTokenForExactlyThirtyMinutesWithoutHashInResponse() {
        String hash = new BCryptPasswordEncoder().encode("unit-test-only-password");
        when(jdbc.queryForList(anyString(), eq("admin")))
                .thenReturn(List.of(Map.of("username", "admin", "role", "ADMIN", "password_hash", hash)));
        Map<String, Object> result = auth.login("admin", "unit-test-only-password");
        String token = (String) result.get("token");
        assertTrue(token.matches("[A-Za-z0-9_-]{43}"));
        ArgumentCaptor<String> stored = ArgumentCaptor.forClass(String.class);
        verify(values).set(eq(AuthService.PREFIX + token), stored.capture(), eq(AuthService.SESSION_TTL));
        assertTrue(stored.getValue().contains("\"role\":\"ADMIN\""));
        assertFalse(stored.getValue().contains("password"));
        assertFalse(result.toString().contains(hash));
        assertEquals(1800, AuthService.SESSION_TTL.toSeconds());
    }

    @Test
    void missingSessionIsUnauthorizedWithoutSilentRefresh() {
        String token = "a".repeat(43);
        when(values.get(AuthService.PREFIX + token)).thenReturn(null);
        assertEquals(401, assertThrows(ApiException.class, () -> auth.authenticate("Bearer " + token)).status());
        verify(values, never()).set(anyString(), anyString(), any(java.time.Duration.class));
    }

    @Test
    void logoutDeletesOnlyCurrentToken() {
        String token = "b".repeat(43);
        auth.logout("Bearer " + token);
        verify(redis).delete(AuthService.PREFIX + token);
        verifyNoMoreInteractions(redis);
    }
}
