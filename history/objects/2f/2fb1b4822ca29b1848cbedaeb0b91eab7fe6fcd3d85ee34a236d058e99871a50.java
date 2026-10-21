package edu.campus.v2.user;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 本机课程演示账号初始化：启动时补齐 admin / manager / viewer，账号已存在则不重置密码。
 * 初始口令只从项目根 .env 的 DEMO_PASSWORD 读取（经 campus.demo.password 传入）；
 * 缺这项配置时明确报出缺项并中止，绝不回退到写死的默认口令。
 * 只把 BCrypt 摘要写入 users 表；日志只写用户名与角色，不写明文、不写摘要。
 */
@Component
public class DemoAccountInitializer implements ApplicationRunner {

    /** 课程固定的三个演示账号，三个账号共用同一份本机初始口令。 */
    static final List<DemoAccount> DEMO_ACCOUNTS = List.of(
            new DemoAccount("admin", Role.ADMIN),
            new DemoAccount("manager", Role.MANAGER),
            new DemoAccount("viewer", Role.VIEWER));

    private static final Logger log = LoggerFactory.getLogger(DemoAccountInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String demoPassword;

    public DemoAccountInitializer(UserRepository userRepository,
                                  PasswordEncoder passwordEncoder,
                                  @Value("${campus.demo.password:}") String demoPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.demoPassword = demoPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        String password = requireDemoPassword();
        for (DemoAccount demo : DEMO_ACCOUNTS) {
            if (createIfAbsent(demo, password)) {
                log.info("已创建课程演示账号：{}（{}）", demo.username(), demo.role());
            } else {
                log.info("课程演示账号已存在，保留原密码：{}（{}）", demo.username(), demo.role());
            }
        }
    }

    /** 不存在才插入；返回 true 表示本次新建，false 表示已存在且未改动。 */
    private boolean createIfAbsent(DemoAccount demo, String password) {
        if (userRepository.findByUsername(demo.username()).isPresent()) {
            return false;
        }
        UserAccount account = new UserAccount(
                demo.username(), demo.role(), true, passwordEncoder.encode(password));
        return userRepository.insertIfAbsent(account);
    }

    /** 缺配置时说明缺项后中止启动；不回退到任何写死口令。 */
    private String requireDemoPassword() {
        if (demoPassword == null || demoPassword.isBlank()) {
            throw new IllegalStateException(
                    "缺少配置项 DEMO_PASSWORD：请在项目根 .env 中提供本机课程初始口令后重启；"
                            + "本程序不使用任何写死的默认口令。");
        }
        return demoPassword;
    }

    /** 演示账号定义：用户名与角色固定，口令来自本机配置。 */
    record DemoAccount(String username, Role role) {
    }
}
