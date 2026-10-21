package edu.campus.v2.alarm;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * alarms 表的只读查询入口：本课程不提供报警写操作。
 * 排序固定为原始时间、编号，便于页面稳定显示。
 */
@Repository
public class AlarmRepository {

    private static final String SELECT_ALL_ORDER_BY_TIME = """
            SELECT id, device_id, message, status, `level`, alarm_time, simulated
            FROM alarms
            ORDER BY alarm_time, id""";

    private final JdbcTemplate jdbcTemplate;

    public AlarmRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Alarm> findAllOrderByTime() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_TIME, new AlarmRowMapper());
    }
}
