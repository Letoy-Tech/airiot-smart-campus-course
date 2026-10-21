package edu.campus.v2.user;

import java.util.Objects;

/**
 * 账号：用户名、角色、是否可用可以对外说明；passwordHash 只用于校验。
 * 显式覆盖 toString：避免摘要被日志、异常信息或调试输出带出去。
 */
public record UserAccount(String username, Role role, boolean enabled, String passwordHash) {

    public UserAccount {
        Objects.requireNonNull(username, "username");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(passwordHash, "passwordHash");
    }

    @Override
    public String toString() {
        return "UserAccount[username=" + username + ", role=" + role + ", enabled=" + enabled + "]";
    }
}
