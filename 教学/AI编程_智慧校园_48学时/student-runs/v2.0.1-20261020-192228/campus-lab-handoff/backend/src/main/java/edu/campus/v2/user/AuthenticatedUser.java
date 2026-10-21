package edu.campus.v2.user;

import java.util.Objects;

/**
 * 已通过校验的身份：username 一律取自 MySQL 中的账号记录（规范写法），
 * 不是用户输入的大小写形式。只含用户名与角色，不含任何口令材料。
 */
public record AuthenticatedUser(String username, Role role) {

    public AuthenticatedUser {
        Objects.requireNonNull(username, "username");
        Objects.requireNonNull(role, "role");
    }
}
