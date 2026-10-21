package cn.campus.course;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CampusService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public CampusService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<Map<String, Object>> devices() {
        return jdbc.query("SELECT * FROM devices ORDER BY id", (rs, i) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getString("id"));
            item.put("name", rs.getString("name"));
            item.put("category", rs.getString("category"));
            item.put("spaceId", rs.getString("space_id"));
            item.put("online", rs.getObject("online") == null ? null : rs.getBoolean("online"));
            item.put("simulated", rs.getBoolean("simulated"));
            return item;
        });
    }

    public List<Map<String, Object>> spaces() {
        return jdbc.queryForList("SELECT id, name, building, floor FROM spaces ORDER BY id");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        return Map.of("spaces", spaces(), "devices", devices(), "points", payloads("points"),
                "history", payloads("history"), "alarms", payloads("alarms"));
    }

    private List<Object> payloads(String table) {
        // table 只来自上面三个固定字符串，不接受客户端提供的 SQL 标识符。
        return jdbc.query("SELECT payload FROM " + table + " ORDER BY device_id", (rs, i) -> decode(rs.getString(1), Object.class));
    }

    @Transactional
    public Map<String, Object> updateSpace(User user, String id, String building, String floor) {
        user.requireAdmin();
        if (jdbc.update("UPDATE spaces SET building=?, floor=? WHERE id=?", building.trim(), floor.trim(), id) == 0) {
            throw new ApiException(404, "没有找到这个空间");
        }
        audit(user, "space.update", id, "更新楼栋和楼层");
        return jdbc.queryForMap("SELECT id,name,building,floor FROM spaces WHERE id=?", id);
    }

    public List<Map<String, Object>> owners() {
        return jdbc.query("SELECT * FROM owners ORDER BY device_id", (rs, i) -> owner(rs));
    }

    @Transactional
    public Map<String, Object> updateOwner(User user, String deviceId, String username, String note, long expectedVersion) {
        user.requireAdmin();
        if (!"manager".equals(username)) {
            throw new ApiException(400, "本课责任人请填写 manager");
        }
        lockDevice(deviceId);
        var current = jdbc.query("SELECT * FROM owners WHERE device_id=? FOR UPDATE", (rs, i) -> owner(rs), deviceId);
        long version = current.isEmpty() ? 0 : ((Number) current.get(0).get("version")).longValue();
        if (expectedVersion != version) {
            throw new ApiException(409, "责任记录已更新，请刷新后重新决定；不要直接重复提交");
        }
        if (current.isEmpty()) {
            jdbc.update("INSERT INTO owners(device_id,username,note,version) VALUES(?,?,?,1)", deviceId, username, note.trim());
        } else {
            jdbc.update("UPDATE owners SET username=?,note=?,version=? WHERE device_id=?", username, note.trim(), version + 1, deviceId);
        }
        audit(user, "owner.update", deviceId, "登记责任人为 " + username);
        return Map.of("deviceId", deviceId, "username", username, "note", note.trim(), "version", version + 1);
    }

    public List<CaseRecord> cases() {
        return jdbc.query("SELECT * FROM cases ORDER BY id DESC", (rs, i) -> caseRecord(rs));
    }

    @Transactional
    public CaseRecord createCase(User user, String deviceId, String message) {
        user.requireAdmin();
        lockDevice(deviceId);
        var owners = jdbc.queryForList("SELECT username FROM owners WHERE device_id=?", String.class, deviceId);
        CaseRecord item = new CaseRecord();
        item.id = UUID.randomUUID().toString();
        item.deviceId = deviceId;
        item.message = message.trim();
        item.assignee = owners.isEmpty() ? null : owners.get(0);
        item.state = item.assignee == null ? "NEW" : "ASSIGNED";
        item.sourceState = "ACTIVE";
        item.verified = false;
        item.note = "";
        item.conclusion = "";
        item.version = 1;
        item.timeline.add(Map.of("time", System.currentTimeMillis(), "username", user.username(),
                "action", "create", "note", "仅课堂演练，不是上游报警", "version", 1));
        jdbc.update("INSERT INTO cases(id,device_id,message,state,assignee,source_state,verified,note,conclusion,version,timeline) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?)", item.id, item.deviceId, item.message, item.state, item.assignee,
                item.sourceState, item.verified, item.note, item.conclusion, item.version, encode(item.timeline));
        audit(user, "case.create", item.id, item.message);
        return item;
    }

    @Transactional
    public CaseRecord act(User user, String id, String action, long expectedVersion, String note, String username) {
        var rows = jdbc.query("SELECT * FROM cases WHERE id=? FOR UPDATE", (rs, i) -> caseRecord(rs), id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "没有找到这个演练事件");
        }
        CaseRecord item = rows.get(0);
        CaseRules.apply(item, user, action, expectedVersion, note, username);
        jdbc.update("UPDATE cases SET state=?,assignee=?,source_state=?,verified=?,note=?,conclusion=?,version=?,timeline=? WHERE id=?",
                item.state, item.assignee, item.sourceState, item.verified, item.note, item.conclusion,
                item.version, encode(item.timeline), item.id);
        audit(user, "case." + action, id, note == null ? "" : note.trim());
        return item;
    }

    public List<Map<String, Object>> audit(User user) {
        user.requireAdmin();
        return jdbc.queryForList("SELECT id,time,username,action,target,detail FROM audit ORDER BY id DESC");
    }

    private void audit(User user, String action, String target, String detail) {
        jdbc.update("INSERT INTO audit(time,username,action,target,detail) VALUES(?,?,?,?,?)",
                System.currentTimeMillis(), user.username(), action, target, detail);
    }

    private void lockDevice(String id) {
        if (jdbc.queryForList("SELECT id FROM devices WHERE id=? FOR UPDATE", String.class, id).isEmpty()) {
            throw new ApiException(404, "没有找到这个设备");
        }
    }

    private Map<String, Object> owner(ResultSet rs) throws SQLException {
        return Map.of("deviceId", rs.getString("device_id"), "username", rs.getString("username"),
                "note", rs.getString("note"), "version", rs.getLong("version"));
    }

    private CaseRecord caseRecord(ResultSet rs) throws SQLException {
        CaseRecord item = new CaseRecord();
        item.id = rs.getString("id");
        item.deviceId = rs.getString("device_id");
        item.message = rs.getString("message");
        item.state = rs.getString("state");
        item.assignee = rs.getString("assignee");
        item.sourceState = rs.getString("source_state");
        item.verified = rs.getBoolean("verified");
        item.note = rs.getString("note");
        item.conclusion = rs.getString("conclusion");
        item.version = rs.getLong("version");
        try {
            item.timeline = json.readValue(rs.getString("timeline"), new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("事件历史格式错误", e);
        }
        return item;
    }

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("无法编码数据", e);
        }
    }

    private <T> T decode(String value, Class<T> type) {
        try {
            return json.readValue(value, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("无法读取练习数据", e);
        }
    }
}
