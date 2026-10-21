package edu.campus.v2.caseflow;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 cases 记录 → Case（时间线先留空）。只做取值与类型转换，不含 SQL 与业务判断。
 */
public class CaseRowMapper implements RowMapper<Case> {

    @Override
    public Case mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new Case(
                rs.getString("id"),
                rs.getString("device_id"),
                rs.getString("message"),
                rs.getString("state"),
                rs.getString("assignee"),
                rs.getString("source_state"),
                rs.getBoolean("verified"),
                rs.getString("note"),
                rs.getString("conclusion"),
                rs.getInt("version"),
                java.util.List.of());
    }
}
