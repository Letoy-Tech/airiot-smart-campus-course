package edu.campus.v2.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 密码校验测试：直接用内存替身，不连数据库、不发 HTTP。
 */
class UserAuthenticationServiceTest {

    private static final String DEMO_PASSWORD = "LocalCourseOnly-9pQ4";

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final InMemoryUserRepository repository = new InMemoryUserRepository();
    private final UserAuthenticationService authentication =
            new UserAuthenticationService(repository, encoder);

    @Test
    void acceptsCorrectPassword() {
        repository.insertIfAbsent(new UserAccount("admin", Role.ADMIN, true, encoder.encode(DEMO_PASSWORD)));

        assertTrue(authentication.verifyPassword("admin", DEMO_PASSWORD));
    }

    @Test
    void rejectsWrongPassword() {
        repository.insertIfAbsent(new UserAccount("admin", Role.ADMIN, true, encoder.encode(DEMO_PASSWORD)));

        assertFalse(authentication.verifyPassword("admin", DEMO_PASSWORD + "x"));
        assertFalse(authentication.verifyPassword("admin", ""));
        assertFalse(authentication.verifyPassword("admin", null));
    }

    @Test
    void rejectsUnknownUser() {
        assertFalse(authentication.verifyPassword("ghost", DEMO_PASSWORD));
        assertFalse(authentication.verifyPassword(" ", DEMO_PASSWORD));
        assertFalse(authentication.verifyPassword(null, DEMO_PASSWORD));
    }

    @Test
    void rejectsDisabledAccountEvenWithCorrectPassword() {
        repository.insertIfAbsent(new UserAccount("manager", Role.MANAGER, false, encoder.encode(DEMO_PASSWORD)));

        assertFalse(authentication.verifyPassword("manager", DEMO_PASSWORD));
    }

    @Test
    void canonicalUsernameComesFromStoredAccountNotInputCase() {
        // 模拟 MySQL 不区分大小写的查询：输入 MANAGER 也能查到 manager 这条记录
        UserAccount stored = new UserAccount("manager", Role.MANAGER, true, encoder.encode(DEMO_PASSWORD));
        UserRepository caseInsensitive = new UserRepository() {
            @Override
            public Optional<UserAccount> findByUsername(String username) {
                return "manager".equalsIgnoreCase(username) ? Optional.of(stored) : Optional.empty();
            }

            @Override
            public boolean insertIfAbsent(UserAccount account) {
                throw new UnsupportedOperationException("本测试只做查询");
            }
        };
        UserAuthenticationService service = new UserAuthenticationService(caseInsensitive, encoder);

        Optional<AuthenticatedUser> user = service.authenticate("MANAGER", DEMO_PASSWORD);

        assertTrue(user.isPresent());
        assertEquals("manager", user.get().username(), "身份必须用数据库里的规范写法");
        assertEquals(Role.MANAGER, user.get().role());
    }

    @Test
    void eachAccountKeepsItsOwnPassword() {
        repository.insertIfAbsent(new UserAccount("admin", Role.ADMIN, true, encoder.encode("FirstOnly-11aa")));
        repository.insertIfAbsent(new UserAccount("viewer", Role.VIEWER, true, encoder.encode("SecondOnly-22bb")));

        assertTrue(authentication.verifyPassword("admin", "FirstOnly-11aa"));
        assertFalse(authentication.verifyPassword("admin", "SecondOnly-22bb"));
        assertTrue(authentication.verifyPassword("viewer", "SecondOnly-22bb"));
    }
}
