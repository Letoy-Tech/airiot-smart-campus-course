package edu.campus.v2.point;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * points 表的查询入口：只放 SQL 与行映射。
 * 排序固定为 device_id、tag_id，避免同一份数据每次返回顺序不同。
 */
@Repository
public class PointRepository {

    private static final String SELECT_ALL_ORDER_BY_DEVICE_AND_TAG = """
            SELECT device_id, tag_id, `value`, unit, sample_time, quality
            FROM points
            ORDER BY device_id, tag_id""";

    private final JdbcTemplate jdbcTemplate;

    public PointRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Point> findAllOrderByDeviceAndTag() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_DEVICE_AND_TAG, new PointRowMapper());
    }
}
