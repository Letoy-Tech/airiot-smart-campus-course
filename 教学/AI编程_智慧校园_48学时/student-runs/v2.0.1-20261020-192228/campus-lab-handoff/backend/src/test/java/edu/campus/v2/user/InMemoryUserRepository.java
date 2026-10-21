package edu.campus.v2.user;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 测试用替身：只在内存里记住写入的账号，不连数据库、不读 .env。
 */
final class InMemoryUserRepository implements UserRepository {

    private final Map<String, UserAccount> accounts = new LinkedHashMap<>();

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        return Optional.ofNullable(accounts.get(username));
    }

    @Override
    public boolean insertIfAbsent(UserAccount account) {
        if (accounts.containsKey(account.username())) {
            return false;
        }
        accounts.put(account.username(), account);
        return true;
    }

    Map<String, UserAccount> accounts() {
        return accounts;
    }
}
