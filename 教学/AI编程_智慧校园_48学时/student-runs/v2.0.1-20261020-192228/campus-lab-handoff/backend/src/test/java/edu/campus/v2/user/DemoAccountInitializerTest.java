package edu.campus.v2.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 账号建立测试：不需要数据库、不启动 Spring 上下文、不读真实 .env。
 * 本测试里的口令只是测试替身，不是课程真实配置。
 */
class DemoAccountInitializerTest {

    private static final String DEMO_PASSWORD = "LocalCourseOnly-3tR7";

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final InMemoryUserRepository repository = new InMemoryUserRepository();

    private DemoAccountInitializer initializer(String password) {
        return new DemoAccountInitializer(repository, encoder, password);
    }

    @Test
    void createsAdminManagerViewerWithBcryptHashesOnly() {
        initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());

        assertEquals(3, repository.accounts().size());
        assertBcryptAccount("admin", Role.ADMIN);
        assertBcryptAccount("manager", Role.MANAGER);
        assertBcryptAccount("viewer", Role.VIEWER);
    }

    @Test
    void createdAccountsPassPasswordVerification() {
        initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());
        UserAuthenticationService authentication =
                new UserAuthenticationService(repository, encoder);

        assertTrue(authentication.verifyPassword("admin", DEMO_PASSWORD));
        assertTrue(authentication.verifyPassword("manager", DEMO_PASSWORD));
        assertTrue(authentication.verifyPassword("viewer", DEMO_PASSWORD));
        assertFalse(authentication.verifyPassword("admin", DEMO_PASSWORD + "x"));
    }

    @Test
    void keepsExistingAccountAndItsPassword() {
        // 已存在的账号哪怕摘要看起来像占位符，也不得被启动流程改写
        String existingHash = "$2a$10$" + "x".repeat(53);
        repository.accounts().put("admin", new UserAccount("admin", Role.ADMIN, true, existingHash));

        initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());

        assertEquals(existingHash, repository.accounts().get("admin").passwordHash());
        assertNotNull(repository.accounts().get("manager"));
        assertNotNull(repository.accounts().get("viewer"));
        assertTrue(encoder.matches(DEMO_PASSWORD, repository.accounts().get("manager").passwordHash()));
    }

    @Test
    void runningTwiceDoesNotChangeHashes() {
        initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());
        String adminHash = repository.accounts().get("admin").passwordHash();

        initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());

        assertEquals(adminHash, repository.accounts().get("admin").passwordHash());
    }

    @Test
    void missingPasswordReportsMissingItemAndCreatesNothing() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> initializer("").run(new DefaultApplicationArguments()));

        assertTrue(error.getMessage().contains("DEMO_PASSWORD"));
        assertTrue(repository.accounts().isEmpty());
    }

    @Test
    void blankPasswordIsAlsoTreatedAsMissing() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> initializer("   ").run(new DefaultApplicationArguments()));

        assertTrue(error.getMessage().contains("DEMO_PASSWORD"));
        assertTrue(repository.accounts().isEmpty());
    }

    @Test
    void nullPasswordIsAlsoTreatedAsMissing() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> initializer(null).run(new DefaultApplicationArguments()));

        assertTrue(error.getMessage().contains("DEMO_PASSWORD"));
        assertTrue(repository.accounts().isEmpty());
    }

    @Test
    void logsContainUsernamesButNoPlaintextOrHash() {
        Logger logger = (Logger) LoggerFactory.getLogger(DemoAccountInitializer.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            initializer(DEMO_PASSWORD).run(new DefaultApplicationArguments());
        } finally {
            logger.detachAppender(appender);
        }

        String logs = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .collect(Collectors.joining("\n"));

        assertTrue(logs.contains("admin"));
        assertFalse(logs.contains(DEMO_PASSWORD));
        for (UserAccount account : repository.accounts().values()) {
            assertFalse(logs.contains(account.passwordHash()));
            assertFalse(account.toString().contains(account.passwordHash()));
        }
    }

    private void assertBcryptAccount(String username, Role expectedRole) {
        UserAccount account = repository.accounts().get(username);
        assertNotNull(account, "应创建账号 " + username);
        assertEquals(expectedRole, account.role());
        assertTrue(account.enabled());

        String hash = account.passwordHash();
        assertNotEquals(DEMO_PASSWORD, hash);
        assertTrue(hash.startsWith("$2"), "应为 BCrypt 摘要");
        assertEquals(60, hash.length(), "BCrypt 摘要固定 60 字符");
        assertFalse(hash.contains(DEMO_PASSWORD));
        assertTrue(encoder.matches(DEMO_PASSWORD, hash));
    }
}
