package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest
@ActiveProfiles("teacher-db")
@EnabledIfEnvironmentVariable(named = "COURSE_TEST_MYSQL", matches = "true")
@Import(SnapshotConsistencyTest.Config.class)
class SnapshotConsistencyTest {
    static final List<Map<String, Object>> EVIDENCE = new ArrayList<>();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        String url = System.getenv("COURSE_DB_URL");
        if (!"true".equals(System.getenv("COURSE_ALLOW_TEST_RESET"))
                || url == null
                || !url.startsWith("jdbc:mysql://"))
            throw new IllegalStateException("Explicit TEST database reset authorization required");
        String schema = java.net.URI.create(url.substring(5)).getPath().substring(1);
        if (!schema.matches("campus_course_[A-Za-z0-9_]+") || !schema.endsWith("_test"))
            throw new IllegalStateException("Dedicated teaching TEST schema required");
        for (String uid : List.of("admin", "manager-a", "manager-b", "viewer")) {
            String password = UUID.randomUUID().toString();
            registry.add("course.passwords." + uid, () -> password);
        }
        registry.add(
                "course.catalog-path",
                () -> Path.of("../fixtures/catalog.json").toAbsolutePath().toString());
        registry.add("spring.flyway.enabled", () -> true);
        registry.add("course.source", () -> "TEACHING_MOCK");
        // Deliberately simulate a teacher database/pool whose default does not provide a snapshot.
        // This affects this test context only; never SET GLOBAL or alter a teacher server.
        registry.add(
                "spring.datasource.hikari.transaction-isolation",
                () -> "TRANSACTION_READ_COMMITTED");
    }

    @Autowired OperationsService operations;
    @Autowired LocationService locations;
    @Autowired JdbcTemplate jdbc;
    @Autowired SnapshotProbe probe;

    @BeforeEach
    void verifyTestDatabaseAndPoolDefault() {
        assertThat(jdbc.queryForObject("SELECT DATABASE()", String.class))
                .matches("campus_course_[A-Za-z0-9_]+")
                .endsWith("_test");
        assertThat(jdbc.queryForObject("SELECT @@transaction_isolation", String.class))
                .isEqualTo("READ-COMMITTED");
    }

    @AfterAll
    static void saveEvidence() throws Exception {
        new ObjectMapper()
                .writerWithDefaultPrettyPrinter()
                .writeValue(
                        Path.of("target/mysql-snapshot-evidence.json").toFile(),
                        Map.of(
                                "recordedAt",
                                java.time.Instant.now().toString(),
                                "poolDefault",
                                "READ-COMMITTED",
                                "scenarios",
                                EVIDENCE));
    }

    @FunctionalInterface
    interface SqlWrite {
        void run(Connection connection) throws Exception;
    }

    private void sql(Connection connection, String statement, Object... values) throws Exception {
        try (var prepared = connection.prepareStatement(statement)) {
            for (int i = 0; i < values.length; i++) prepared.setObject(i + 1, values[i]);
            assertThat(prepared.executeUpdate()).isEqualTo(1);
        }
    }

    private <T> T readDuringCommit(String method, Callable<T> read, SqlWrite write)
            throws Exception {
        probe.arm(method);
        var pool = Executors.newSingleThreadExecutor();
        try {
            Future<T> reading = pool.submit(read);
            assertThat(probe.firstRead.await(10, TimeUnit.SECONDS)).isTrue();
            long writerConnection;
            try (Connection connection =
                    DriverManager.getConnection(
                            System.getenv("COURSE_DB_URL"),
                            System.getenv("COURSE_DB_USERNAME"),
                            System.getenv("COURSE_DB_PASSWORD"))) {
                connection.setAutoCommit(false);
                try (var result =
                        connection.createStatement().executeQuery("SELECT CONNECTION_ID()")) {
                    result.next();
                    writerConnection = result.getLong(1);
                }
                write.run(connection);
                connection.commit();
            }
            probe.committed.countDown();
            T result = reading.get(10, TimeUnit.SECONDS);
            assertThat(probe.isolation).isEqualTo(Connection.TRANSACTION_REPEATABLE_READ);
            assertThat(probe.connectionId).isNotEqualTo(writerConnection);
            assertThat(jdbc.queryForObject("SELECT @@transaction_isolation", String.class))
                    .isEqualTo("READ-COMMITTED");
            EVIDENCE.add(
                    Map.of(
                            "readMethod",
                            method,
                            "readerIsolation",
                            "REPEATABLE-READ",
                            "readerConnectionId",
                            probe.connectionId,
                            "writerConnectionId",
                            writerConnection,
                            "writerCommittedBetweenSelects",
                            true,
                            "poolDefaultPreserved",
                            true));
            return result;
        } finally {
            probe.committed.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void ownerAndTimelineKeepSameSnapshotAcrossConcurrentCommit() throws Exception {
        String id = "teaching_light_04";
        jdbc.update("DELETE FROM course_owner_event WHERE device_id=?", id);
        jdbc.update(
                "UPDATE course_owner SET owner_uid=NULL,owner_name=NULL,version=0,updated_at=NULL"
                    + " WHERE device_id=?",
                id);
        var result =
                readDuringCommit(
                        "owner",
                        () -> operations.owner(id),
                        connection -> {
                            sql(
                                    connection,
                                    "UPDATE course_owner SET"
                                        + " owner_uid='manager-b',owner_name='B',version=1,updated_at=1"
                                        + " WHERE device_id=?",
                                    id);
                            sql(
                                    connection,
                                    "INSERT INTO"
                                        + " course_owner_event(id,device_id,actor_uid,actor_name,note,owner_uid,created_at,version)"
                                        + " VALUES(?,?,'admin','Admin','snapshot"
                                        + " test','manager-b',1,1)",
                                    UUID.randomUUID().toString(),
                                    id);
                        });
        assertThat(result.version).isZero();
        assertThat(result.timeline).isEmpty();
        var current = operations.owner(id);
        assertThat(current.version).isEqualTo(1);
        assertThat(current.timeline).hasSize(1);
        assertThat(current.timeline.get(0).version).isEqualTo(1);
    }

    @Test
    void caseAndTimelineKeepSameSnapshotAcrossConcurrentCommit() throws Exception {
        String id = UUID.randomUUID().toString();
        jdbc.update(
                "INSERT INTO course_alarm_case(id,state,simulated,version)"
                    + " VALUES(?,'IN_PROGRESS',TRUE,1)",
                id);
        try {
            jdbc.update(
                    "INSERT INTO course_case_event(id,case_id,action,created_at,case_version)"
                        + " VALUES(?,?,'START',1,1)",
                    UUID.randomUUID().toString(),
                    id);
            var result =
                    readDuringCommit(
                            "alarmCase",
                            () -> operations.detail(id),
                            connection -> {
                                sql(
                                        connection,
                                        "UPDATE course_alarm_case SET version=2,updated_at=2 WHERE"
                                            + " id=?",
                                        id);
                                sql(
                                        connection,
                                        "INSERT INTO"
                                            + " course_case_event(id,case_id,action,created_at,case_version)"
                                            + " VALUES(?,?,'NOTE',2,2)",
                                        UUID.randomUUID().toString(),
                                        id);
                            });
            assertThat(result.version).isEqualTo(1);
            assertThat(result.timeline).hasSize(1);
            assertThat(result.timeline.get(0).caseVersion).isEqualTo(1);
            var current = operations.detail(id);
            assertThat(current.version).isEqualTo(2);
            assertThat(current.timeline).hasSize(2);
        } finally {
            jdbc.update("DELETE FROM course_case_event WHERE case_id=?", id);
            jdbc.update("DELETE FROM course_alarm_case WHERE id=?", id);
        }
    }

    @Test
    void filteredPageAndCountKeepSameSnapshotAcrossConcurrentInsert() throws Exception {
        String id = UUID.randomUUID().toString();
        String uid = "snapshot-" + UUID.randomUUID();
        try {
            var result =
                    readDuringCommit(
                            "cases",
                            () -> operations.list(null, "NEW", uid, 50, 0),
                            connection ->
                                    sql(
                                            connection,
                                            "INSERT INTO"
                                                + " course_alarm_case(id,state,assignee_uid,simulated,version)"
                                                + " VALUES(?,'NEW',?,TRUE,1)",
                                            id,
                                            uid));
            assertThat((List<?>) result.get("items")).isEmpty();
            assertThat(((Number) result.get("total")).longValue()).isZero();
            assertThat(((Number) operations.list(null, "NEW", uid, 50, 0).get("total")).longValue())
                    .isEqualTo(1);
        } finally {
            jdbc.update("DELETE FROM course_alarm_case WHERE id=?", id);
        }
    }

    @Test
    void locationsDoNotMixNewBuildingsWithOldCampusList() throws Exception {
        String campus = UUID.randomUUID().toString(), building = UUID.randomUUID().toString();
        try {
            var result =
                    readDuringCommit(
                            "campuses",
                            locations::locations,
                            connection -> {
                                sql(
                                        connection,
                                        "INSERT INTO course_campus(id,name) VALUES(?,?)",
                                        campus,
                                        "Snapshot " + campus);
                                sql(
                                        connection,
                                        "INSERT INTO course_building(id,campus_id,name)"
                                            + " VALUES(?,?,'Snapshot building')",
                                        building,
                                        campus);
                            });
            assertThat((List<?>) result.get("campuses"))
                    .noneMatch(value -> ((CourseModels.Campus) value).id().equals(campus));
            assertThat((List<?>) result.get("buildings"))
                    .noneMatch(value -> ((CourseModels.Building) value).id().equals(building));
            assertThat((List<?>) locations.locations().get("buildings"))
                    .anyMatch(value -> ((CourseModels.Building) value).id().equals(building));
        } finally {
            jdbc.update("DELETE FROM course_building WHERE id=?", building);
            jdbc.update("DELETE FROM course_campus WHERE id=?", campus);
        }
    }

    @Test
    void mappedSpacesDoNotMixNewBindingWithOldBuildingList() throws Exception {
        String campus = UUID.randomUUID().toString(), building = UUID.randomUUID().toString();
        String space = "teaching_space_04";
        jdbc.update("DELETE FROM course_space_binding WHERE space_id=?", space);
        try {
            var result =
                    readDuringCommit(
                            "buildings",
                            locations::spaces,
                            connection -> {
                                sql(
                                        connection,
                                        "INSERT INTO course_campus(id,name) VALUES(?,?)",
                                        campus,
                                        "Snapshot " + campus);
                                sql(
                                        connection,
                                        "INSERT INTO course_building(id,campus_id,name)"
                                            + " VALUES(?,?,'Snapshot building')",
                                        building,
                                        campus);
                                sql(
                                        connection,
                                        "INSERT INTO"
                                            + " course_space_binding(space_id,building_id,floor)"
                                            + " VALUES(?,?,'4')",
                                        space,
                                        building);
                            });
            assertThat(
                            result.items().stream()
                                    .filter(s -> s.id().equals(space))
                                    .findFirst()
                                    .orElseThrow()
                                    .buildingId())
                    .isNull();
            assertThat(
                            locations.spaces().items().stream()
                                    .filter(s -> s.id().equals(space))
                                    .findFirst()
                                    .orElseThrow()
                                    .buildingId())
                    .isEqualTo(building);
        } finally {
            jdbc.update("DELETE FROM course_space_binding WHERE space_id=?", space);
            jdbc.update("DELETE FROM course_building WHERE id=?", building);
            jdbc.update("DELETE FROM course_campus WHERE id=?", campus);
        }
    }

    @TestConfiguration
    static class Config {
        @Bean
        SnapshotProbe snapshotProbe() {
            return new SnapshotProbe();
        }
    }

    @Intercepts(
            @Signature(
                    type = Executor.class,
                    method = "query",
                    args = {
                        MappedStatement.class,
                        Object.class,
                        RowBounds.class,
                        ResultHandler.class
                    }))
    static class SnapshotProbe implements Interceptor {
        volatile String method;
        volatile int isolation;
        volatile long connectionId;
        CountDownLatch firstRead, committed;

        void arm(String method) {
            firstRead = new CountDownLatch(1);
            committed = new CountDownLatch(1);
            this.method = method;
        }

        public Object intercept(Invocation invocation) throws Throwable {
            String id = ((MappedStatement) invocation.getArgs()[0]).getId();
            Object result = invocation.proceed();
            if (method != null && id.endsWith("." + method)) {
                method = null;
                Connection connection =
                        ((Executor) invocation.getTarget()).getTransaction().getConnection();
                isolation = connection.getTransactionIsolation();
                try (var query =
                        connection.createStatement().executeQuery("SELECT CONNECTION_ID()")) {
                    query.next();
                    connectionId = query.getLong(1);
                }
                firstRead.countDown();
                if (!committed.await(10, TimeUnit.SECONDS))
                    throw new IllegalStateException("Writer did not commit");
            }
            return result;
        }
    }
}
