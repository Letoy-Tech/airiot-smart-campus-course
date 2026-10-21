package edu.campus.v2.caseflow;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * cases 与 case_timeline 的读写入口：只放 SQL 与行映射，不做业务判断。
 * 事件与创建时间线由服务层放在同一个事务里写入，读取时再按 case_id 拼回时间线。
 */
@Repository
public class CaseRepository {

    private static final String SELECT_ALL_ORDER_BY_CREATED = """
            SELECT id, device_id, message, state, assignee, source_state,
                   verified, note, conclusion, version
            FROM cases
            ORDER BY created_at, id""";

    private static final String SELECT_BY_ID = """
            SELECT id, device_id, message, state, assignee, source_state,
                   verified, note, conclusion, version
            FROM cases
            WHERE id = ?""";

    private static final String SELECT_TIMELINE_ALL = """
            SELECT case_id, event_time, `action`, actor, note
            FROM case_timeline
            ORDER BY case_id, seq""";

    private static final String SELECT_TIMELINE_BY_CASE = """
            SELECT event_time, `action`, actor, note
            FROM case_timeline
            WHERE case_id = ?
            ORDER BY seq""";

    // 创建时间与更新时间都由服务层生成后传入，SQL 里不使用 NOW()。
    private static final String INSERT_CASE = """
            INSERT INTO cases (id, device_id, message, state, assignee, source_state,
                               verified, note, conclusion, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""";

    private static final String INSERT_TIMELINE = """
            INSERT INTO case_timeline (case_id, seq, `action`, actor, note, event_time)
            VALUES (?, ?, ?, ?, ?, ?)""";

    private static final String NEXT_TIMELINE_SEQ = """
            SELECT COALESCE(MAX(seq), 0) + 1
            FROM case_timeline
            WHERE case_id = ?""";

    // 三个动作都以 version 作为条件：版本已变化时 0 行受影响，调用方按 409 处理。
    private static final String UPDATE_ASSIGN = """
            UPDATE cases
            SET state = 'ASSIGNED', assignee = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private static final String UPDATE_START = """
            UPDATE cases
            SET state = 'IN_PROGRESS', version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private static final String UPDATE_NOTE = """
            UPDATE cases
            SET note = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private static final String UPDATE_RECOVER = """
            UPDATE cases
            SET source_state = 'RECOVERED', version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private static final String UPDATE_VERIFY = """
            UPDATE cases
            SET verified = 1, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private static final String UPDATE_CLOSE = """
            UPDATE cases
            SET state = 'CLOSED', conclusion = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?""";

    private final JdbcTemplate jdbcTemplate;

    public CaseRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 按创建时间升序返回全部事件，并各自带上按 seq 升序的时间线。 */
    public List<Case> findAllOrderByCreatedAt() {
        List<Case> cases = jdbcTemplate.query(SELECT_ALL_ORDER_BY_CREATED, new CaseRowMapper());

        Map<String, List<CaseTimelineEntry>> timelineByCase = new HashMap<>();
        jdbcTemplate.query(SELECT_TIMELINE_ALL, rs -> {
            String caseId = rs.getString("case_id");
            timelineByCase.computeIfAbsent(caseId, key -> new ArrayList<>())
                    .add(new CaseTimelineEntry(
                            rs.getLong("event_time"),
                            rs.getString("action"),
                            rs.getString("actor"),
                            rs.getString("note")));
        });

        return cases.stream()
                .map(item -> item.withTimeline(
                        timelineByCase.getOrDefault(item.id(), List.of())))
                .toList();
    }

    public Optional<Case> findById(String id) {
        List<Case> found = jdbcTemplate.query(SELECT_BY_ID, new CaseRowMapper(), id);
        if (found.isEmpty()) {
            return Optional.empty();
        }

        List<CaseTimelineEntry> timeline =
                jdbcTemplate.query(SELECT_TIMELINE_BY_CASE, new CaseTimelineRowMapper(), id);
        return Optional.of(found.get(0).withTimeline(timeline));
    }

    /** 写入事件与本次创建的时间线；调用方负责事务，任一条失败则一起回滚。 */
    public void insert(Case item, long createdAt, List<CaseTimelineEntry> timeline) {
        jdbcTemplate.update(INSERT_CASE,
                item.id(),
                item.deviceId(),
                item.message(),
                item.state(),
                item.assignee(),
                item.sourceState(),
                item.verified(),
                item.note(),
                item.conclusion(),
                item.version(),
                createdAt,
                createdAt);

        for (int index = 0; index < timeline.size(); index += 1) {
            insertTimeline(item.id(), index + 1, timeline.get(index));
        }
    }

    /** 事件动作：按 version 条件更新；返回 0 表示版本已变化，调用方必须按冲突处理。 */
    public int updateAssign(String id, String assignee, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_ASSIGN, assignee, updatedAt, id, expectedVersion);
    }

    public int updateStart(String id, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_START, updatedAt, id, expectedVersion);
    }

    public int updateNote(String id, String note, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_NOTE, note, updatedAt, id, expectedVersion);
    }

    public int updateRecover(String id, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_RECOVER, updatedAt, id, expectedVersion);
    }

    public int updateVerify(String id, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_VERIFY, updatedAt, id, expectedVersion);
    }

    public int updateClose(String id, String conclusion, int expectedVersion, long updatedAt) {
        return jdbcTemplate.update(UPDATE_CLOSE, conclusion, updatedAt, id, expectedVersion);
    }

    /** 与本次动作在同一事务中调用：条件更新成功后，同一事件不会再有别的动作插入。 */
    public int nextTimelineSeq(String caseId) {
        Integer seq = jdbcTemplate.queryForObject(NEXT_TIMELINE_SEQ, Integer.class, caseId);
        return seq == null ? 1 : seq;
    }

    public void insertTimeline(String caseId, int seq, CaseTimelineEntry entry) {
        jdbcTemplate.update(INSERT_TIMELINE,
                caseId,
                seq,
                entry.action(),
                entry.actor(),
                entry.note(),
                entry.time());
    }
}
