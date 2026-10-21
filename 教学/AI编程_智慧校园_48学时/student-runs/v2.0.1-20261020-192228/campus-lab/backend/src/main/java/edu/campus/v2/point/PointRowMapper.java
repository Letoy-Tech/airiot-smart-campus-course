package edu.campus.v2.point;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 points 记录 → Point。
 * 关键点：value 与 sample_time 的 SQL NULL 必须原样返回 null；
 * 不能用 getDouble / getLong 那样把 NULL 变成 0，因为 0 在读数里是有效值。
 */
public class PointRowMapper implements RowMapper<Point> {

    @Override
    public Point mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Point(
                rs.getString("device_id"),
                rs.getString("tag_id"),
                PointValues.toDouble(rs.getObject("value")),
                rs.getString("unit"),
                PointValues.toLong(rs.getObject("sample_time")),
                rs.getString("quality"));
    }
}
