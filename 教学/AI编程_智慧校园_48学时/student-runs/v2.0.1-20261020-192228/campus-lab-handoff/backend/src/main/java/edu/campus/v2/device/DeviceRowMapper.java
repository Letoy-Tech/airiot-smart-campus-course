package edu.campus.v2.device;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 devices 记录 → Device。
 * 只负责列的取值与类型转换，不含 SQL 与业务判断。
 */
public class DeviceRowMapper implements RowMapper<Device> {

    @Override
    public Device mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Device(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("category"),
                rs.getString("space_id"),
                toBoolean(rs.getObject("online")),
                Boolean.TRUE.equals(toBoolean(rs.getObject("simulated"))));
    }

    /**
     * TINYINT(1) 在不同驱动配置下可能返回 Boolean 或数字。
     * 关键点：SQL NULL 必须返回 null，不能用 getBoolean 那样把 NULL 变成 false。
     */
    static Boolean toBoolean(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Boolean value) {
            return value;
        }
        if (raw instanceof Number value) {
            return value.intValue() != 0;
        }
        return Boolean.valueOf(raw.toString());
    }
}
