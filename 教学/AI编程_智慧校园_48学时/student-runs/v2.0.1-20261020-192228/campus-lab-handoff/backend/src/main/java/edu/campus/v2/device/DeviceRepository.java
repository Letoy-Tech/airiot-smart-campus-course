package edu.campus.v2.device;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * devices 表的查询入口：只放 SQL 与行映射，不处理 HTTP、不做业务判断。
 */
@Repository
public class DeviceRepository {

    private static final String SELECT_ALL_ORDER_BY_ID = """
            SELECT id, name, category, space_id, online, simulated
            FROM devices
            ORDER BY id""";

    private static final String EXISTS_BY_ID = """
            SELECT COUNT(*)
            FROM devices
            WHERE id = ?""";

    private final JdbcTemplate jdbcTemplate;

    public DeviceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Device> findAllOrderById() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_ID, new DeviceRowMapper());
    }

    /** 只回答“这台设备在不在”，用于责任登记前的外键校验。 */
    public boolean existsById(String id) {
        Integer count = jdbcTemplate.queryForObject(EXISTS_BY_ID, Integer.class, id);
        return count != null && count > 0;
    }
}
