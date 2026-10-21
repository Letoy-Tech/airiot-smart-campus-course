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

    private final JdbcTemplate jdbcTemplate;

    public DeviceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Device> findAllOrderById() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_ID, new DeviceRowMapper());
    }
}
