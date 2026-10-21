package edu.campus.v2.history;

import edu.campus.v2.point.PointValues;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * history_samples 表的查询入口。
 * 单位用 JOIN points 取得，保证历史与点位单位一致；时间只按库里样本值排序，不生成新样本。
 */
@Repository
public class HistoryRepository {

    /** 包内可见：测试用它确认单位取自 points、样本按时间排序。 */
    static final String SELECT_ALL_ORDER_BY_POINT_AND_TIME = """
            SELECT h.device_id, h.tag_id, p.unit, h.sample_time, h.value
            FROM history_samples h
            JOIN points p ON p.device_id = h.device_id AND p.tag_id = h.tag_id
            ORDER BY h.device_id, h.tag_id, h.sample_time""";

    private final JdbcTemplate jdbcTemplate;

    public HistoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<History> findAllGroupedByPoint() {
        List<HistoryRow> rows = jdbcTemplate.query(SELECT_ALL_ORDER_BY_POINT_AND_TIME, (rs, rowNum) ->
                new HistoryRow(
                        rs.getString("device_id"),
                        rs.getString("tag_id"),
                        rs.getString("unit"),
                        rs.getLong("sample_time"),
                        PointValues.toDouble(rs.getObject("value"))));
        return HistoryGrouping.group(rows);
    }
}
