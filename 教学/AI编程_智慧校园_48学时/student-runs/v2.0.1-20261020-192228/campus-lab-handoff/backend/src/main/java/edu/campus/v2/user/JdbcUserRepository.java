package edu.campus.v2.user;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * users 表的 JDBC 实现：SQL 只在这里出现，不含口令生成与业务判断。
 */
@Repository
public class JdbcUserRepository implements UserRepository {

    private static final String SELECT_BY_USERNAME = """
            SELECT username, role, enabled, password_hash
            FROM users
            WHERE username = ?""";

    private static final String INSERT_IF_ABSENT = """
            INSERT INTO users (username, password_hash, role, enabled)
            VALUES (?, ?, ?, ?)""";

    private static final RowMapper<UserAccount> ROW_MAPPER = JdbcUserRepository::mapRow;

    private final JdbcTemplate jdbcTemplate;

    public JdbcUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        List<UserAccount> rows = jdbcTemplate.query(SELECT_BY_USERNAME, ROW_MAPPER, username);
        return rows.stream().findFirst();
    }

    @Override
    public boolean insertIfAbsent(UserAccount account) {
        try {
            return jdbcTemplate.update(INSERT_IF_ABSENT,
                    account.username(),
                    account.passwordHash(),
                    account.role().name(),
                    account.enabled() ? 1 : 0) == 1;
        } catch (DuplicateKeyException alreadyExists) {
            // 唯一索引 uk_users_username 兜底：重复启动或并发时视为“已存在”，保留原密码
            return false;
        }
    }

    private static UserAccount mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new UserAccount(
                rs.getString("username"),
                Role.valueOf(rs.getString("role")),
                rs.getBoolean("enabled"),
                rs.getString("password_hash"));
    }
}
