package edu.campus.v2.auth;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;

/**
 * 登录令牌生成：SecureRandom 取 32 字节（256 位），Base64URL 无填充编码。
 * 不用时间戳、用户名或计数器拼令牌；令牌只在响应体返回一次，不写日志。
 */
@Component
public class LoginTokenGenerator {

    private static final int TOKEN_BYTES = 32;
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final SecureRandom secureRandom = new SecureRandom();

    public String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }
}
