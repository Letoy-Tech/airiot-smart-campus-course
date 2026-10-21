package edu.campus.v2.user;

import java.util.Optional;

/**
 * 账号存储入口：只定义读写语义，不含 SQL、不做业务判断。
 */
public interface UserRepository {

    Optional<UserAccount> findByUsername(String username);

    /**
     * 仅当该用户名不存在时插入；已存在返回 false，绝不覆盖已有摘要。
     */
    boolean insertIfAbsent(UserAccount account);
}
