package edu.campus.v2.audit;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * audit 表的读写入口：只放 SQL 与行映射，不做业务判断。
 * 写入由各业务 Service 在同一个数据库事务里调用：主记录与审计要么一起成功，要么一起回滚。
 * 读取只返回已提交的记录；失败的操作没有成功事务，因此不会出现在这里。
 */
@Repository
public class AuditRepository {

    private static final String INSERT_AUDIT = """
            INSERT INTO audit (actor, `action`, target_id, note, event_time)
            VALUES (?, ?, ?, ?, ?)""";

    private static final String SELECT_ALL_ORDER_BY_EVENT_TIME = """
            SELECT event_time, actor, `action`, target_id, note
            FROM audit
            ORDER BY event_time, id""";

    private final JdbcTemplate jdbcTemplate;

    public AuditRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(String actor, String action, String targetId, String note, long eventTime) {
        jdbcTemplate.update(INSERT_AUDIT, actor, action, targetId, note, eventTime);
    }

    public List<AuditEntry> findAllOrderByEventTime() {
        return jdbcTemplate.query(SELECT_ALL_ORDER_BY_EVENT_TIME, new AuditRowMapper());
    }
}
