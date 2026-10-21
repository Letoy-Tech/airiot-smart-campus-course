package edu.campus.v2.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/**
 * Redis 会话存储测试：用替身验证键前缀、TTL 与失败处理，
 * 不连真实 Redis（本课不启动服务）。
 */
@SuppressWarnings("unchecked")
class RedisLoginSessionStoreTest {

    private static final String TOKEN = "token-7Hk3";
    private static final String KEY = "campus:v2:session:" + TOKEN;
    private static final Duration TTL = Duration.ofSeconds(1800);

    private final ValueOperations<String, String> valueOps = mock(ValueOperations.class);
    private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
    private final RedisLoginSessionStore store =
            new RedisLoginSessionStore(redisTemplate, new ObjectMapper());

    @BeforeEach
    void setUp() {
        given(redisTemplate.opsForValue()).willReturn(valueOps);
    }

    @Test
    void saveUsesCourseKeyPrefixAndTtl() {
        store.save(TOKEN, new AuthenticatedUser("manager", Role.MANAGER), TTL);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> value = ArgumentCaptor.forClass(String.class);
        then(valueOps).should().set(key.capture(), value.capture(), eq(TTL));

        assertThat(key.getValue()).isEqualTo("campus:v2:session:token-7Hk3");
        assertThat(value.getValue()).contains("\"username\":\"manager\"");
        assertThat(value.getValue()).contains("\"role\":\"MANAGER\"");
        // 会话只存身份，不存任何口令材料
        assertThat(value.getValue()).doesNotContainIgnoringCase("password");
    }

    @Test
    void findReturnsStoredIdentity() {
        given(valueOps.get(KEY)).willReturn("{\"username\":\"manager\",\"role\":\"MANAGER\"}");

        Optional<AuthenticatedUser> found = store.find(TOKEN);

        assertThat(found).contains(new AuthenticatedUser("manager", Role.MANAGER));
    }

    @Test
    void findTreatsMissingKeyAsExpired() {
        given(valueOps.get(KEY)).willReturn(null);

        assertThat(store.find(TOKEN)).isEmpty();
    }

    @Test
    void findTreatsBrokenValueAsExpired() {
        given(valueOps.get(KEY)).willReturn("not-a-json");

        assertThat(store.find(TOKEN)).isEmpty();
    }

    @Test
    void deleteUsesSameKey() {
        store.delete(TOKEN);

        then(redisTemplate).should().delete(KEY);
    }

    @Test
    void connectionFailureOnSaveBecomesUnavailable() {
        willThrow(new RedisConnectionFailureException("down"))
                .given(valueOps).set(eq(KEY), org.mockito.ArgumentMatchers.anyString(), eq(TTL));

        assertThatThrownBy(() -> store.save(TOKEN, new AuthenticatedUser("admin", Role.ADMIN), TTL))
                .isInstanceOf(SessionStoreUnavailableException.class);
    }

    @Test
    void connectionFailureOnFindBecomesUnavailable() {
        given(valueOps.get(KEY)).willThrow(new RedisConnectionFailureException("down"));

        assertThatThrownBy(() -> store.find(TOKEN))
                .isInstanceOf(SessionStoreUnavailableException.class);
    }

    @Test
    void connectionFailureOnDeleteBecomesUnavailable() {
        given(redisTemplate.delete(KEY)).willThrow(new RedisConnectionFailureException("down"));

        assertThatThrownBy(() -> store.delete(TOKEN))
                .isInstanceOf(SessionStoreUnavailableException.class);
    }
}
