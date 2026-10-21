package edu.campus.v2.user;

import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 密码校验：只回答"这组用户名与口令能否通过"，不返回摘要、不写日志、不涉及页面。
 * 允许输入使用不同大小写（MySQL 的排序规则不区分大小写），但返回的身份
 * 一律用数据库记录里的 username，不把输入的大小写当成另一个账号。
 */
@Service
public class UserAuthenticationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAuthenticationService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 校验通过时返回规范身份（用户名来自 MySQL 记录）；失败返回空，不区分原因。
     */
    public Optional<AuthenticatedUser> authenticate(String username, String rawPassword) {
        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isEmpty()) {
            return Optional.empty();
        }
        Optional<UserAccount> found = userRepository.findByUsername(username);
        if (found.isEmpty() || !found.get().enabled()) {
            return Optional.empty();
        }
        UserAccount account = found.get();
        if (!passwordEncoder.matches(rawPassword, account.passwordHash())) {
            return Optional.empty();
        }
        return Optional.of(new AuthenticatedUser(account.username(), account.role()));
    }

    public boolean verifyPassword(String username, String rawPassword) {
        return authenticate(username, rawPassword).isPresent();
    }
}
