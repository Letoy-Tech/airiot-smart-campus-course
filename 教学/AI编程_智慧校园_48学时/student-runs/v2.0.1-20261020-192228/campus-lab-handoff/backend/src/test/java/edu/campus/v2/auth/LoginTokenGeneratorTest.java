package edu.campus.v2.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * 令牌生成测试：长度、URL 安全字符集与随机性（不重复）。
 */
class LoginTokenGeneratorTest {

    private final LoginTokenGenerator generator = new LoginTokenGenerator();

    @Test
    void tokenIsUrlSafeAndLongEnough() {
        String token = generator.newToken();

        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        assertThat(token).doesNotContain("=");
    }

    @Test
    void tokensAreNotRepeated() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            tokens.add(generator.newToken());
        }

        assertThat(tokens).hasSize(200);
    }
}
