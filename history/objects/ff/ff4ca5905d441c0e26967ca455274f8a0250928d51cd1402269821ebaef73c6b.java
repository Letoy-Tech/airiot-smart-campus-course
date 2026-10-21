package edu.campus.v2.alarm;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 alarms 记录 → Alarm：只做取值与类型转换，消息与状态按库里原值返回。
 * simulated 列是 NOT NULL（1=教学模拟），因此直接取布尔值即可。
 */
public class AlarmRowMapper implements RowMapper<Alarm> {

    @Override
    public Alarm mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Alarm(
                rs.getString("id"),
                rs.getString("device_id"),
                rs.getString("message"),
                rs.getString("status"),
                rs.getString("level"),
                rs.getLong("alarm_time"),
                rs.getBoolean("simulated"));
    }
}
