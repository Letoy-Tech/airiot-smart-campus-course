package edu.campus.v2.space;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 spaces 记录 → Space。只做取值与类型转换，不含 SQL 与业务判断。
 */
public class SpaceRowMapper implements RowMapper<Space> {

    @Override
    public Space mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Space(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("building"),
                rs.getString("floor"));
    }
}
