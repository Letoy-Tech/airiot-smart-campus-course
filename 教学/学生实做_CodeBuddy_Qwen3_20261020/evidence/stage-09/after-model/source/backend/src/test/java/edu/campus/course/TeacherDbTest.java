package edu.campus.course;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("teacher-db")
@EnabledIfEnvironmentVariable(named = "COURSE_TEST_MYSQL", matches = "true")
@Import(TeacherDbTest.ProbeConfig.class)
class TeacherDbTest {
    static final Map<String, String> PASSWORDS =
            Map.of(
                    "admin",
                    UUID.randomUUID().toString(),
                    "manager-a",
                    UUID.randomUUID().toString(),
                    "manager-b",
                    UUID.randomUUID().toString(),
                    "viewer",
                    UUID.randomUUID().toString());
    static final List<Map<String, Object>> EVIDENCE = new ArrayList<>();
    static String verifiedSchema;
    static String verifiedMySqlVersion;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        String url = System.getenv("COURSE_DB_URL");
        if (!"true".equals(System.getenv("COURSE_ALLOW_TEST_RESET"))
                || url == null
                || !url.startsWith("jdbc:mysql://"))
            throw new IllegalStateException("Explicit TEST database reset authorization required");
        String schema = java.net.URI.create(url.substring(5)).getPath().substring(1);
        if (!schema.matches("campus_course_[A-Za-z0-9_]+") || !schema.endsWith("_test"))
            throw new IllegalStateException("Dedicated teaching TEST schema required");
        PASSWORDS.forEach((u, p) -> r.add("course.passwords." + u, () -> p));
        r.add(
                "course.catalog-path",
                () -> Path.of("../fixtures/catalog.json").toAbsolutePath().toString());
        r.add("spring.flyway.enabled", () -> true);
        r.add("course.demo-enabled", () -> true);
        r.add("course.source", () -> "TEACHING_MOCK");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Probe probe;

    @BeforeEach
    void isolateTestData() {
        String schema = jdbc.queryForObject("SELECT DATABASE()", String.class);
        if (schema == null
                || !schema.matches("campus_course_[A-Za-z0-9_]+")
                || !schema.endsWith("_test"))
            throw new IllegalStateException("Refusing to reset non-teaching database");
        verifiedSchema = schema;
        verifiedMySqlVersion = jdbc.queryForObject("SELECT VERSION()", String.class);
        probe.clear();
        for (String table :
                List.of(
                        "course_case_event",
                        "course_alarm_case",
                        "course_owner_event",
                        "course_space_binding",
                        "course_building",
                        "course_campus")) jdbc.update("DELETE FROM " + table);
        jdbc.update(
                "UPDATE course_owner SET owner_uid=NULL,owner_name=NULL,version=0,updated_at=NULL");
        jdbc.update(
                "UPDATE course_identity SET enabled=TRUE,roles=CASE uid WHEN 'admin' THEN"
                        + " 'ADMIN,CAMPUS_VIEWER' WHEN 'viewer' THEN 'CAMPUS_VIEWER' ELSE"
                        + " 'CAMPUS_MANAGER' END");
    }

    @AfterEach
    void cleanProbe() {
        probe.clear();
    }

    @AfterAll
    static void evidence() throws Exception {
        Path output = Path.of("target/mysql-transaction-evidence.json");
        new ObjectMapper()
                .writerWithDefaultPrettyPrinter()
                .writeValue(
                        output.toFile(),
                        Map.of(
                                "database", verifiedSchema,
                                "mysqlVersion", verifiedMySqlVersion,
                                "javaVersion", System.getProperty("java.version"),
                                "recordedAt", java.time.Instant.now().toString(),
                                "scenarios", EVIDENCE));
    }

    record Client(MockHttpSession session, String header, String token) {}

    Client csrf(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        var response = mvc.perform(request).andExpect(status().isOk()).andReturn();
        JsonNode data = data(response);
        return new Client(
                (MockHttpSession) response.getRequest().getSession(),
                data.path("headerName").asText(),
                data.path("token").asText());
    }

    Client login(String uid) throws Exception {
        Client c = csrf(null);
        mvc.perform(
                        post("/api/auth/login")
                                .session(c.session)
                                .header(c.header, c.token)
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("username", uid)
                                .param("password", PASSWORDS.get(uid)))
                .andExpect(status().isOk());
        return csrf(c.session);
    }

    JsonNode data(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString()).path("data");
    }

    MvcResult write(Client c, String method, String path, String body, int expected)
            throws Exception {
        return mvc.perform(
                        (method.equals("PUT") ? put(path) : post(path))
                                .session(c.session)
                                .header(c.header, c.token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().is(expected))
                .andReturn();
    }

    JsonNode read(Client c, String path, int status) throws Exception {
        return data(
                mvc.perform(get(path).session(c.session))
                        .andExpect(status().is(status))
                        .andReturn());
    }

    String body(long v, String key, String value) throws Exception {
        var node = json.createObjectNode().put("expectedVersion", v);
        if (key != null) node.put(key, value);
        return node.toString();
    }

    JsonNode trigger(Client admin) throws Exception {
        return data(
                write(
                        admin,
                        "POST",
                        "/api/campus/demo-alarm-scenarios/temperature-patrol/trigger",
                        "{}",
                        200));
    }

    JsonNode action(Client c, JsonNode event, String action, String field, String value, int status)
            throws Exception {
        return data(
                write(
                        c,
                        "POST",
                        "/api/campus/alarm-cases/" + event.path("id").asText() + "/" + action,
                        body(event.path("version").asLong(), field, value),
                        status));
    }

    JsonNode assign(Client admin, JsonNode event, String uid) throws Exception {
        var request =
                json.createObjectNode()
                        .put("expectedVersion", event.path("version").asLong())
                        .put("assigneeUid", uid)
                        .put("note", "明确分派");
        return data(
                write(
                        admin,
                        "POST",
                        "/api/campus/alarm-cases/" + event.path("id").asText() + "/assign",
                        request.toString(),
                        200));
    }

    JsonNode active(Client admin, Client a) throws Exception {
        return action(a, assign(admin, trigger(admin), "manager-a"), "start", "note", "开始处置", 200);
    }

    @Test
    void fullMonitoringHistoryAndUnconfiguredIntegration() throws Exception {
        Client viewer = login("viewer");
        JsonNode overview = read(viewer, "/api/campus/overview", 200);
        assertThat(overview.path("spaces").size()).isEqualTo(4);
        assertThat(overview.path("devices").size()).isEqualTo(16);
        assertThat(overview.path("points").size()).isEqualTo(28);
        assertThat(overview.path("source").asText()).isEqualTo("TEACHING_MOCK");
        JsonNode h =
                read(
                        viewer,
                        "/api/campus/history?deviceId=teaching_energy_01&tagId=power&from=1792302300000&to=1792303200000",
                        200);
        assertThat(h.path("samples").size()).isEqualTo(4);
        assertThat(h.path("samples").get(1).path("value").isNull()).isTrue();
        read(
                viewer,
                "/api/campus/history?deviceId=teaching_energy_01&tagId=power&from=0&to=21600001",
                400);
        read(viewer, "/api/campus/history?deviceId=teaching_energy_01&tagId=none&from=0&to=1", 404);
        read(viewer, "/api/campus/integrations/airiot/status", 403);
        assertThat(
                        read(login("admin"), "/api/campus/integrations/airiot/status", 200)
                                .path("connected")
                                .asBoolean())
                .isFalse();
    }

    @Test
    void spaceBindingRejectsMissingReferences() throws Exception {
        Client admin = login("admin");
        write(admin, "POST", "/api/campus/locations/campuses", "{\"name\":\" \"}", 400);
        write(
                admin,
                "POST",
                "/api/campus/locations/buildings",
                "{\"name\":\"一号楼\",\"campusId\":\"missing\"}",
                404);
        JsonNode campus =
                data(
                        write(
                                admin,
                                "POST",
                                "/api/campus/locations/campuses",
                                "{\"name\":\"教学校园\"}",
                                200));
        write(admin, "POST", "/api/campus/locations/campuses", "{\"name\":\"教学校园\"}", 409);
        JsonNode building =
                data(
                        write(
                                admin,
                                "POST",
                                "/api/campus/locations/buildings",
                                json.createObjectNode()
                                        .put("campusId", campus.path("id").asText())
                                        .put("name", "一号楼")
                                        .toString(),
                                200));
        String binding =
                json.createObjectNode()
                        .put("buildingId", building.path("id").asText())
                        .put("floor", "2F")
                        .toString();
        write(admin, "PUT", "/api/campus/locations/spaces/unknown", binding, 404);
        write(
                admin,
                "PUT",
                "/api/campus/locations/spaces/teaching_space_01",
                "{\"buildingId\":\"missing\"}",
                404);
        write(admin, "PUT", "/api/campus/locations/spaces/teaching_space_01", binding, 200);
        JsonNode space = read(admin, "/api/campus/spaces", 200).path("items").get(0);
        assertThat(space.path("campusId").asText()).isEqualTo(campus.path("id").asText());
        assertThat(space.path("floor").asText()).isEqualTo("2F");
        write(login("viewer"), "POST", "/api/campus/locations/campuses", "{\"name\":\"拒绝\"}", 403);
    }

    @Test
    void closeRequiresAllServerFacts() throws Exception {
        Client admin = login("admin"), a = login("manager-a");
        JsonNode c = active(admin, a);
        action(a, c, "close", "disposition", "不能关闭", 409);
        c = action(a, c, "notes", "note", "实际处置记录", 200);
        c = action(a, c, "verify-recovery", null, null, 200);
        assertThat(c.path("sourceCheckOutcome").asText()).isEqualTo("UNKNOWN");
        action(a, c, "close", "disposition", "来源未恢复", 409);
        c =
                data(
                        write(
                                admin,
                                "POST",
                                "/api/campus/demo-alarm-events/"
                                        + c.path("id").asText()
                                        + "/recover",
                                body(c.path("version").asLong(), null, null),
                                200));
        JsonNode repeated =
                data(
                        write(
                                admin,
                                "POST",
                                "/api/campus/demo-alarm-events/"
                                        + c.path("id").asText()
                                        + "/recover",
                                body(c.path("version").asLong(), null, null),
                                200));
        assertThat(repeated).isEqualTo(c);
        action(a, c, "close", "disposition", "还未核实", 409);
        c = action(a, c, "verify-recovery", null, null, 200);
        assertThat(c.path("sourceCheckOutcome").asText()).isEqualTo("PASS");
        c = action(a, c, "close", "disposition", "核实完成", 200);
        assertThat(c.path("state").asText()).isEqualTo("CLOSED");
        action(a, c, "notes", "note", "关闭后不能追加", 409);
        write(
                admin,
                "POST",
                "/api/campus/demo-alarm-events/" + c.path("id").asText() + "/recover",
                body(c.path("version").asLong(), null, null),
                409);
    }

    @Test
    void permissionsStrictInputAndReassignmentRequireNewStart() throws Exception {
        Client admin = login("admin"),
                a = login("manager-a"),
                b = login("manager-b"),
                viewer = login("viewer");
        JsonNode c = active(admin, a);
        action(b, c, "notes", "note", "其他负责人拒绝", 403);
        action(viewer, c, "notes", "note", "查看者拒绝", 403);
        String path = "/api/campus/alarm-cases/" + c.path("id").asText() + "/notes";
        for (String version : List.of("\"3\"", "true", "3.0", "-1"))
            write(a, "POST", path, "{\"expectedVersion\":" + version + ",\"note\":\"非法版本\"}", 400);
        write(
                a,
                "POST",
                path,
                "{\"expectedVersion\":3,\"note\":\"伪造\",\"actorUid\":\"admin\"}",
                400);
        JsonNode old = c;
        c = action(a, c, "notes", "note", "保留原处置", 200);
        action(a, old, "notes", "note", "旧版本拒绝", 409);
        c = assign(admin, c, "manager-b");
        action(a, c, "notes", "note", "原负责人拒绝", 403);
        action(b, c, "notes", "note", "新负责人尚未开始", 409);
        c = action(b, c, "start", "note", "重新开始", 200);
        action(b, c, "notes", "note", "新负责人记录", 200);
    }

    @Test
    void ownerRequiresCurrentVersionAndChangesOnlyFutureAssignment() throws Exception {
        Client admin = login("admin");
        JsonNode prior = assign(admin, trigger(admin), "manager-a");
        String path = "/api/campus/device-owners/teaching_env_01";
        JsonNode first =
                data(
                        write(
                                admin,
                                "PUT",
                                path,
                                "{\"expectedVersion\":0,\"ownerUid\":\"manager-b\",\"note\":\"责任变更\"}",
                                200));
        write(
                admin,
                "PUT",
                path,
                "{\"expectedVersion\":0,\"ownerUid\":\"manager-a\",\"note\":\"旧版本\"}",
                409);
        assertThat(first.path("version").asLong()).isEqualTo(1);
        assertThat(first.path("timeline").size()).isEqualTo(1);
        assertThat(read(admin, "/api/campus/alarm-cases/" + prior.path("id").asText(), 200))
                .isEqualTo(prior);
        assertThat(trigger(admin).path("assigneeUid").asText()).isEqualTo("manager-b");
        write(
                admin,
                "PUT",
                path,
                "{\"expectedVersion\":1,\"ownerUid\":\"viewer\",\"note\":\"无处理资格\"}",
                400);
    }

    @Test
    void currentDatabaseIdentityControlsExistingSession() throws Exception {
        Client admin = login("admin");
        jdbc.update("UPDATE course_identity SET roles='CAMPUS_VIEWER' WHERE uid='admin'");
        assertThat(read(admin, "/api/campus/capabilities", 200).path("canAdmin").asBoolean())
                .isFalse();
        write(
                admin,
                "POST",
                "/api/campus/demo-alarm-scenarios/temperature-patrol/trigger",
                "{}",
                403);
        read(admin, "/api/campus/devices", 200);
        jdbc.update("UPDATE course_identity SET roles='ADMIN,CAMPUS_VIEWER' WHERE uid='admin'");
        assertThat(read(admin, "/api/campus/capabilities", 200).path("canAdmin").asBoolean())
                .isTrue();
        jdbc.update("UPDATE course_identity SET enabled=FALSE WHERE uid='admin'");
        read(admin, "/api/campus/devices", 401);
    }

    @Test
    void filterBeforePaginationAndStableSort() throws Exception {
        Client admin = login("admin"), viewer = login("viewer");
        for (int i = 0; i < 4; i++) trigger(admin);
        JsonNode first = read(viewer, "/api/campus/alarm-cases?state=NEW&limit=2&skip=0", 200);
        JsonNode second = read(viewer, "/api/campus/alarm-cases?state=NEW&limit=2&skip=2", 200);
        assertThat(first.path("total").asLong()).isEqualTo(4);
        assertThat(first.path("items").size()).isEqualTo(2);
        Set<String> ids = new HashSet<>();
        first.path("items").forEach(c -> ids.add(c.path("id").asText()));
        second.path("items").forEach(c -> ids.add(c.path("id").asText()));
        assertThat(ids).hasSize(4);
        assertThat(
                        read(viewer, "/api/campus/alarm-cases?state=NEW&limit=2&skip=4", 200)
                                .path("items")
                                .isEmpty())
                .isTrue();
        assertThat(read(viewer, "/api/campus/alarm-cases?state=CLOSED", 200).path("total").asLong())
                .isZero();
        read(viewer, "/api/campus/alarm-cases?limit=101", 400);
        read(viewer, "/api/campus/alarm-cases?skip=10001", 400);
    }

    List<Integer> compete(
            Client c1,
            Client c2,
            String method,
            String path,
            String body1,
            String body2,
            String lock)
            throws Exception {
        probe.arm(lock);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            var requests =
                    List.of(
                            pool.submit(() -> rawWrite(c1, method, path, body1)),
                            pool.submit(() -> rawWrite(c2, method, path, body2)));
            List<Integer> statuses = new ArrayList<>();
            for (var future : requests) statuses.add(future.get(15, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
            assertThat(probe.connections).hasSize(2);
            return statuses;
        } finally {
            pool.shutdownNow();
            probe.target = null;
        }
    }

    int rawWrite(Client c, String method, String path, String body) throws Exception {
        return mvc.perform(
                        (method.equals("PUT") ? put(path) : post(path))
                                .session(c.session)
                                .header(c.header, c.token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    @Test
    void concurrentNotesUseTwoConnectionsAndOnlyOneVersionWins() throws Exception {
        Client admin = login("admin"), a1 = login("manager-a"), a2 = login("manager-a");
        JsonNode c = active(admin, a1);
        for (int i = 0; i < 4; i++) c = action(a1, c, "notes", "note", "并发前准备记录" + i, 200);
        long version = c.path("version").asLong();
        String id = c.path("id").asText();
        int timeline = c.path("timeline").size();
        var statuses =
                compete(
                        a1,
                        a2,
                        "POST",
                        "/api/campus/alarm-cases/" + id + "/notes",
                        body(version, "note", "并发甲"),
                        body(version, "note", "并发乙"),
                        "lockCase");
        JsonNode after = read(admin, "/api/campus/alarm-cases/" + id, 200);
        assertThat(after.path("version").asLong()).isEqualTo(version + 1);
        assertThat(after.path("timeline").size()).isEqualTo(timeline + 1);
        EVIDENCE.add(
                Map.of(
                        "scenario",
                        "event_concurrent_notes",
                        "statuses",
                        statuses,
                        "mysqlConnections",
                        Set.copyOf(probe.connections),
                        "versionBefore",
                        version,
                        "versionAfter",
                        version + 1,
                        "timelineAdded",
                        1));
    }

    @Test
    void concurrentOwnersUseTwoConnectionsAndKeepExistingEvent() throws Exception {
        Client a1 = login("admin"), a2 = login("admin");
        JsonNode prior = assign(a1, trigger(a1), "manager-a");
        var statuses =
                compete(
                        a1,
                        a2,
                        "PUT",
                        "/api/campus/device-owners/teaching_env_01",
                        "{\"expectedVersion\":0,\"ownerUid\":\"manager-a\",\"note\":\"并发甲\"}",
                        "{\"expectedVersion\":0,\"ownerUid\":\"manager-b\",\"note\":\"并发乙\"}",
                        "lockOwner");
        JsonNode after = read(a1, "/api/campus/device-owners/teaching_env_01", 200);
        assertThat(after.path("version").asLong()).isEqualTo(1);
        assertThat(after.path("timeline").size()).isEqualTo(1);
        assertThat(read(a1, "/api/campus/alarm-cases/" + prior.path("id").asText(), 200))
                .isEqualTo(prior);
        EVIDENCE.add(
                Map.of(
                        "scenario",
                        "owner_concurrent_update",
                        "statuses",
                        statuses,
                        "mysqlConnections",
                        Set.copyOf(probe.connections),
                        "versionAfter",
                        1,
                        "timelineAdded",
                        1,
                        "priorEventUnchanged",
                        true));
    }

    @Test
    void caseTimelineFailureRollsBackAlreadyExecutedMasterUpdate() throws Exception {
        Client admin = login("admin"), a = login("manager-a");
        JsonNode c = active(admin, a);
        for (int i = 0; i < 4; i++) c = action(a, c, "notes", "note", "回滚前准备记录" + i, 200);
        String id = c.path("id").asText();
        var before = snapshot(true, id);
        probe.armFault("insertCaseEvent");
        action(a, c, "notes", "note", "应回滚", 500);
        assertThat(probe.updatedVersion).isEqualTo(c.path("version").asLong() + 1);
        var after = snapshot(true, id);
        assertRollback(before, after, id);
        JsonNode normal = action(a, c, "notes", "note", "同对象同版本正常对照", 200);
        var control = snapshot(true, id);
        assertThat(normal.path("version").asLong()).isEqualTo(c.path("version").asLong() + 1);
        assertThat(control.timeline.size()).isEqualTo(before.timeline.size() + 1);
        recordRollback("event_timeline_rollback", id, before, after, control);
    }

    @Test
    void ownerTimelineFailureRollsBackAlreadyExecutedMasterUpdate() throws Exception {
        Client admin = login("admin");
        JsonNode prior = assign(admin, trigger(admin), "manager-a");
        var before = snapshot(false, "teaching_env_01");
        probe.armFault("insertOwnerEvent");
        write(
                admin,
                "PUT",
                "/api/campus/device-owners/teaching_env_01",
                "{\"expectedVersion\":0,\"ownerUid\":\"manager-b\",\"note\":\"应回滚\"}",
                500);
        assertThat(probe.updatedVersion).isEqualTo(1);
        var after = snapshot(false, "teaching_env_01");
        assertRollback(before, after, "teaching_env_01");
        assertThat(read(admin, "/api/campus/alarm-cases/" + prior.path("id").asText(), 200))
                .isEqualTo(prior);
        write(
                admin,
                "PUT",
                "/api/campus/device-owners/teaching_env_01",
                "{\"expectedVersion\":0,\"ownerUid\":\"manager-b\",\"note\":\"同版本正常对照\"}",
                200);
        var control = snapshot(false, "teaching_env_01");
        assertThat(((Number) control.master.get("version")).longValue()).isEqualTo(1);
        assertThat(control.timeline.size()).isEqualTo(before.timeline.size() + 1);
        assertThat(read(admin, "/api/campus/alarm-cases/" + prior.path("id").asText(), 200))
                .isEqualTo(prior);
        recordRollback("owner_timeline_rollback", "teaching_env_01", before, after, control);
    }

    record Snapshot(
            long connectionId, Map<String, Object> master, List<Map<String, Object>> timeline) {}

    Snapshot snapshot(boolean event, String id) throws Exception {
        // DriverManager creates a NEW physical connection, independent from the Hikari transaction
        // pool.
        try (var connection =
                java.sql.DriverManager.getConnection(
                        System.getenv("COURSE_DB_URL"),
                        System.getenv("COURSE_DB_USERNAME"),
                        System.getenv("COURSE_DB_PASSWORD"))) {
            long connectionId;
            try (var statement = connection.createStatement();
                    var rows = statement.executeQuery("SELECT CONNECTION_ID()")) {
                rows.next();
                connectionId = rows.getLong(1);
            }
            String master =
                    event
                            ? "SELECT * FROM course_alarm_case WHERE id=?"
                            : "SELECT * FROM course_owner WHERE device_id=?";
            String timeline =
                    event
                            ? "SELECT * FROM course_case_event WHERE case_id=? ORDER BY"
                                    + " case_version,id"
                            : "SELECT * FROM course_owner_event WHERE device_id=? ORDER BY"
                                    + " version,id";
            return new Snapshot(
                    connectionId,
                    query(connection, master, id).get(0),
                    query(connection, timeline, id));
        }
    }

    List<Map<String, Object>> query(java.sql.Connection connection, String sql, String id)
            throws Exception {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, id);
            try (var rows = statement.executeQuery()) {
                List<Map<String, Object>> result = new ArrayList<>();
                var meta = rows.getMetaData();
                while (rows.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= meta.getColumnCount(); i++)
                        row.put(meta.getColumnLabel(i), rows.getObject(i));
                    result.add(row);
                }
                return result;
            }
        }
    }

    void assertRollback(Snapshot before, Snapshot after, String id) {
        assertThat(probe.faultHit).isTrue();
        assertThat(probe.rowsAffected).isEqualTo(1);
        assertThat(probe.objectId).isEqualTo(id);
        assertThat(after.connectionId)
                .isNotEqualTo(before.connectionId)
                .isNotEqualTo(probe.faultConnectionId);
        assertThat(after.master).isEqualTo(before.master);
        assertThat(after.timeline).isEqualTo(before.timeline);
    }

    void recordRollback(
            String scenario, String id, Snapshot before, Snapshot after, Snapshot control) {
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("scenario", scenario);
        evidence.put("objectId", id);
        evidence.put("httpStatus", 500);
        evidence.put("faultHit", probe.faultHit);
        evidence.put("rowsAffectedBeforeFault", probe.rowsAffected);
        evidence.put("versionObservedInsideTransaction", probe.updatedVersion);
        evidence.put(
                "connectionIds",
                Map.of(
                        "before",
                        before.connectionId,
                        "fault",
                        probe.faultConnectionId,
                        "after",
                        after.connectionId,
                        "normalControlRead",
                        control.connectionId));
        evidence.put("versionBefore", before.master.get("version"));
        evidence.put("versionAfterFailure", after.master.get("version"));
        evidence.put("timelineBefore", before.timeline.size());
        evidence.put("timelineAfterFailure", after.timeline.size());
        evidence.put("masterSnapshotUnchanged", true);
        evidence.put("timelineSnapshotUnchanged", true);
        evidence.put(
                "normalControl",
                Map.of(
                        "httpStatus",
                        200,
                        "version",
                        control.master.get("version"),
                        "timeline",
                        control.timeline.size()));
        EVIDENCE.add(evidence);
    }

    @TestConfiguration
    static class ProbeConfig {
        @Bean
        Probe transactionProbe() {
            return new Probe();
        }
    }

    @Intercepts({
        @Signature(
                type = Executor.class,
                method = "query",
                args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}),
        @Signature(
                type = Executor.class,
                method = "update",
                args = {MappedStatement.class, Object.class})
    })
    static class Probe implements Interceptor {
        volatile String target, fail, objectId;
        volatile long updatedVersion, faultConnectionId;
        volatile int rowsAffected;
        volatile boolean faultHit;
        CyclicBarrier barrier;
        final Set<Long> connections = ConcurrentHashMap.newKeySet();

        void arm(String name) {
            clear();
            target = name;
            barrier = new CyclicBarrier(2);
        }

        void armFault(String name) {
            clear();
            fail = name;
        }

        void clear() {
            target = null;
            fail = null;
            updatedVersion = -1;
            rowsAffected = 0;
            faultHit = false;
            faultConnectionId = -1;
            objectId = null;
            connections.clear();
        }

        @Override
        public Object intercept(Invocation invocation) throws Throwable {
            String method = ((MappedStatement) invocation.getArgs()[0]).getId();
            if (target != null && method.endsWith("." + target)) {
                var connection =
                        ((Executor) invocation.getTarget()).getTransaction().getConnection();
                try (var statement = connection.createStatement();
                        var row = statement.executeQuery("SELECT CONNECTION_ID()")) {
                    row.next();
                    connections.add(row.getLong(1));
                }
                barrier.await(10, TimeUnit.SECONDS);
            }
            if (fail != null && method.endsWith("." + fail)) {
                boolean isCase = fail.equals("insertCaseEvent");
                fail = null;
                var connection =
                        ((Executor) invocation.getTarget()).getTransaction().getConnection();
                faultHit = true;
                try (var statement = connection.createStatement();
                        var row = statement.executeQuery("SELECT CONNECTION_ID()")) {
                    row.next();
                    faultConnectionId = row.getLong(1);
                }
                String sql =
                        isCase
                                ? "SELECT version FROM course_alarm_case WHERE id=?"
                                : "SELECT version FROM course_owner WHERE device_id=?";
                String id =
                        isCase
                                ? ((CourseModels.CaseEvent) invocation.getArgs()[1]).caseId
                                : ((CourseModels.OwnerEvent) invocation.getArgs()[1]).deviceId;
                try (var statement = connection.prepareStatement(sql)) {
                    statement.setString(1, id);
                    try (var row = statement.executeQuery()) {
                        row.next();
                        updatedVersion = row.getLong(1);
                    }
                }
                throw new org.apache.ibatis.exceptions.PersistenceException(
                        "Test-only injected timeline failure");
            }
            Object result = invocation.proceed();
            if (fail != null
                    && (method.endsWith(".updateCase") || method.endsWith(".updateOwner"))) {
                rowsAffected = ((Number) result).intValue();
                objectId =
                        method.endsWith(".updateCase")
                                ? ((CourseModels.AlarmCase) invocation.getArgs()[1]).id
                                : ((CourseModels.Owner) invocation.getArgs()[1]).deviceId;
            }
            return result;
        }
    }
}
