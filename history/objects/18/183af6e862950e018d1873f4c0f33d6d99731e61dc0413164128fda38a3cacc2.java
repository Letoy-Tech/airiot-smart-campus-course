package edu.campus.v2.owner;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * owners 表的读写入口：只放 SQL 与行映射，不做业务判断。
 * 版本比对放在 UPDATE 的 WHERE 条件里，避免“先读后写”被并发覆盖。
 */
@Repository
public class OwnerRepository {

    private static final String SELECT_ALL_ORDER_BY_DEVICE = """
            SELECT device_id, username, note, version
            FROM owners
            ORDER BY device_id""";

    private static final String SELECT_BY_DEVICE = """
            SELECT device_id, username, note, version
            FROM owners
            WHERE device_id = ?""";

    // 首次登记固定写 version=1：没有记录时当前版本视为 0。
    private static final String INSERT_OWNER = """
            INSERT INTO owners (device_id, username, note, version)
            VALUES (?, ?, ?, 1)""";

    // 乐观锁：只有库里的 version 仍等于提交的版本才更新，否则 0 行受影响。
    private static final String UPDATE_WITH_VERSION = """
            UPDATE owners
            SET username = ?, note = ?, version = version + 1
            WHERE device_id = ? AND version = ?""";

    private final JdbcTemplate jdbcTemplate;

    public OwnerRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Owner> findAllOrderByDeviceId() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_DEVICE, new OwnerRowMapper());
    }

    public Optional<Owner> findByDeviceId(String deviceId) {
        return jdbcTemplate.query(SELECT_BY_DEVICE, new OwnerRowMapper(), deviceId)
                .stream()
                .findFirst();
    }

    /** 参数按占位符绑定；device_id 是主键，重复插入会抛 DuplicateKeyException。 */
    public int insert(String deviceId, String username, String note) {
        return jdbcTemplate.update(INSERT_OWNER, deviceId, username, note);
    }

    /** 返回受影响行数：0 表示版本已变化（或记录已被删除），调用方必须按冲突处理。 */
    public int updateWithVersion(String deviceId, String username, String note, int expectedVersion) {
        return jdbcTemplate.update(UPDATE_WITH_VERSION, username, note, deviceId, expectedVersion);
    }
}
