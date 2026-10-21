package edu.campus.v2.auth;

import edu.campus.v2.user.AuthenticatedUser;
import java.time.Duration;
import java.util.Optional;

/**
 * 登录会话存储：只按令牌读写"用户名 + 角色"，不保存口令或摘要。
 */
public interface LoginSessionStore {

    void save(String token, AuthenticatedUser user, Duration ttl);

    Optional<AuthenticatedUser> find(String token);

    void delete(String token);
}
