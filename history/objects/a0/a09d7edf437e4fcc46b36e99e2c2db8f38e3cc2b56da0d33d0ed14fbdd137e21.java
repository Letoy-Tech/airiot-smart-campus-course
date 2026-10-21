package edu.campus.v2.caseflow;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;

/**
 * 一行 case_timeline 记录 → CaseTimelineEntry。按 seq 升序读取。
 */
public class CaseTimelineRowMapper implements RowMapper<CaseTimelineEntry> {

    @Override
    public CaseTimelineEntry mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new CaseTimelineEntry(
                rs.getLong("event_time"),
                rs.getString("action"),
                rs.getString("actor"),
                rs.getString("note"));
    }
}
