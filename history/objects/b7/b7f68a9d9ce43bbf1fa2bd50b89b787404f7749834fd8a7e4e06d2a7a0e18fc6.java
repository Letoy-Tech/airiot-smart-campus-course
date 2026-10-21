package edu.campus.v2.audit;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 audit 记录 → AuditEntry。只做取值与类型转换，不含业务判断。
 */
public class AuditRowMapper implements RowMapper<AuditEntry> {

    @Override
    public AuditEntry mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new AuditEntry(
                rs.getLong("event_time"),
                rs.getString("actor"),
                rs.getString("action"),
                rs.getString("target_id"),
                rs.getString("note"));
    }
}
