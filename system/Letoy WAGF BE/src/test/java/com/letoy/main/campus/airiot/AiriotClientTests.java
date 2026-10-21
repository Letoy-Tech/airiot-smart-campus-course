package com.letoy.main.campus.airiot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

/** Real local HTTP contracts; no deployment URL, credentials, mocks or remote writes. */
class AiriotClientTests {
    private static final String KEY = "contract-key-only";
    private static final String SECRET = "contract-secret-only";
    private final ObjectMapper mapper = new ObjectMapper();
    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-04T00:00:00Z").toEpochMilli());
    private final List<Request> requests = new CopyOnWriteArrayList<>();
    private final AtomicInteger tokens = new AtomicInteger();
    private HttpServer server;
    private ExecutorService executor;
    private AiriotProperties properties;
    private AiriotClient client;
    private volatile Behavior behavior;
    private volatile boolean expiryMillis;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.createContext("/", this::handle);
        server.start();
        properties = new AiriotProperties();
        properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/rest/");
        properties.setAppKey(KEY);
        properties.setAppSecret(SECRET);
        client = new AiriotClient(properties, mapper,
                HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build(), clock);
    }

    @AfterEach
    void stop() {
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void obtainsProjectTokenOverHttpAndCachesSecondExpiry() {
        behavior = request -> recordReply(request, "env_demo_01");
        assertEquals("env_demo_01", client.record("campus_environment", "env_demo_01").path("id").asText());
        client.record("campus_environment", "env_demo_01");
        assertEquals(1, tokens.get());
        Request auth = requests.get(0);
        assertEquals("GET", auth.method());
        assertEquals(KEY, auth.query().get("appkey"));
        assertEquals(SECRET, auth.query().get("appsecret"));
        assertNull(auth.authorization());
        assertTrue(requests.stream().allMatch(request -> AiriotProperties.PROJECT_ID.equals(request.project())));
        assertEquals("stub-token-1", requests.get(1).authorization());
        assertFalse(requests.get(1).authorization().startsWith("Bearer"));
    }

    @Test
    void cachesMillisecondExpiryAndRefreshesAfterClockAdvance() {
        expiryMillis = true;
        behavior = request -> recordReply(request, "env_demo_01");
        client.record("campus_environment", "env_demo_01");
        clock.advance(1000);
        client.record("campus_environment", "env_demo_01");
        assertEquals(1, tokens.get());
        clock.advance(3_600_000);
        client.record("campus_environment", "env_demo_01");
        assertEquals(2, tokens.get());
    }

    @Test
    void refreshesRejectedTokenExactlyOnce() {
        behavior = request -> {
            if (!request.path().endsWith("/env_demo_01")) return null;
            return "stub-token-1".equals(request.authorization()) ? new Reply(401, "{}", null)
                    : new Reply(200, "{\"id\":\"env_demo_01\"}", null);
        };
        client.record("campus_environment", "env_demo_01");
        assertEquals(2, tokens.get());
        assertEquals(2, requests.stream().filter(request -> request.path().endsWith("/env_demo_01")).count());
    }

    @Test
    void upstreamAuthenticationNeverBecomesMg401OrLeaksSecrets() {
        behavior = request -> request.path().endsWith("/env_demo_01")
                ? new Reply(401, "{\"message\":\"" + SECRET + "\",\"token\":\"stub-token-1\"}", null) : null;
        AiriotException failure = assertThrows(AiriotException.class,
                () -> client.record("campus_environment", "env_demo_01"));
        assertEquals(502, failure.getHttpStatus());
        assertEquals("AIRIOT_AUTH_FAILED", failure.getCode());
        assertEquals(2, tokens.get());
        assertSafe(failure);
        assertFalse(properties.toString().contains(KEY));
        assertFalse(properties.toString().contains(SECRET));
    }

    @Test
    void refusesUnapprovedTableDevicePointAndSwitchBeforeAnyHttpCall() {
        assertThrows(AiriotException.class, () -> client.records("another_project_table"));
        assertThrows(AiriotException.class, () -> client.record("campus_facility", "env_demo_01"));
        assertThrows(AiriotException.class, () -> client.record("campus_lighting", "light_demo_05"));
        assertThrows(AiriotException.class, () -> client.latest(List.of(Map.of(
                "tableId", "campus_lighting", "id", "light_demo_01", "tagId", "power_kw"))));
        assertThrows(AiriotException.class, () -> client.latest(List.of(Map.of(
                "tableId", "campus_lighting", "id", "light_demo_01", "tagId", "illuminance_lux", "allTag", "true"))));
        assertThrows(AiriotException.class, () -> client.patchSwitch("campus_energy", "energy_demo_01", true));
        assertThrows(AiriotException.class, () -> client.patchSwitch("campus_lighting", "light_demo_01", true));
        assertTrue(requests.isEmpty());
    }

    @Test
    void refusesWrongProjectAndUnconfiguredCredentialsWithoutNetwork() {
        properties.setProjectId("69e0811dd94866e9009c2b3d");
        AiriotException wrongProject = assertThrows(AiriotException.class,
                () -> client.record("campus_environment", "env_demo_01"));
        assertEquals("AIRIOT_CONFIG_INVALID", wrongProject.getCode());
        properties.setProjectId(AiriotProperties.PROJECT_ID);
        properties.setAppSecret("");
        Map<String, Object> status = client.status();
        assertEquals(false, status.get("configured"));
        assertEquals(false, status.get("connected"));
        assertTrue(requests.isEmpty());
    }

    @Test
    void paginatesByActualPageLengthEvenWhenServerClampsRequestedLimit() {
        behavior = request -> {
            if (!request.path().equals("/rest/core/t/campus_environment/d")) return null;
            JsonNode query = mapper.readTree(request.query().get("query"));
            int skip = query.path("skip").asInt();
            assertEquals(100, query.path("limit").asInt());
            assertEquals(4, query.path("filter").path("id").path("$in").size());
            JsonNode projection = query.path("project");
            assertEquals(14, projection.size());
            for (String field : List.of("id", "name", "_label", "_table", "online", "commTime", "connectTime",
                    "location_code", "location_label", "data_source", "is_simulated",
                    "simulated_switch_on", "space_type", "type")) {
                assertEquals(1, projection.path(field).asInt(), field);
            }
            assertFalse(projection.has("*"));
            return skip < 4 ? new Reply(200, "[{\"id\":\"env_demo_0" + (skip + 1) + "\"}]", null)
                    : new Reply(200, "[]", null);
        };
        JsonNode records = client.records("campus_environment");
        assertEquals(4, records.size());
        assertEquals("env_demo_04", records.get(3).path("id").asText());
        assertEquals(List.of(0, 1, 2, 3, 4), requests.stream()
                .filter(request -> request.path().equals("/rest/core/t/campus_environment/d"))
                .map(request -> parseQuery(request).path("skip").asInt()).toList());
    }

    @Test
    void readsCountHeaderAndRejectsPaginationDuplicatesInsteadOfPartialSuccess() {
        properties.setPageSize(2);
        behavior = request -> request.path().equals("/rest/core/t/campus_environment/d")
                ? new Reply(200, "[{\"id\":\"env_demo_01\"},{\"id\":\"env_demo_02\"}]", "4") : null;
        AiriotException failure = assertThrows(AiriotException.class, () -> client.records("campus_environment"));
        assertEquals("AIRIOT_PROTOCOL_ERROR", failure.getCode());
        assertEquals(2, requests.stream().filter(request -> request.path().endsWith("/d")).count());
    }

    @Test
    void latestRequestAndResponseRemainWithinExactPointScope() {
        behavior = request -> {
            if (!request.path().equals("/rest/core/data/latest")) return null;
            assertEquals("POST", request.method());
            JsonNode query = mapper.readTree(request.body());
            assertTrue(query.isArray());
            assertEquals("temperature_c", query.get(0).path("tagId").asText());
            return new Reply(200, "[{\"tableId\":\"campus_environment\",\"id\":\"env_demo_01\","
                    + "\"tagId\":\"temperature_c\",\"value\":22.25,\"time\":1791072000000}]", null);
        };
        List<Map<String, String>> refs = List.of(Map.of("tableId", "campus_environment", "id", "env_demo_01", "tagId", "temperature_c"));
        assertEquals(22.25, client.latest(refs).get(0).path("value").doubleValue());
        behavior = request -> request.path().equals("/rest/core/data/latest")
                ? new Reply(200, "[{\"tableId\":\"campus_environment\",\"id\":\"env_demo_02\",\"tagId\":\"temperature_c\"}]", null) : null;
        assertEquals("AIRIOT_SCOPE_MISMATCH", assertThrows(AiriotException.class, () -> client.latest(refs)).getCode());
    }

    @Test
    void historySendsRawUtcQueryAndPreservesReorderedColumnsAndNulls() {
        long from = clock.millis();
        String response = "{\"results\":[{\"series\":[{\"name\":\"fixture-only\","
                + "\"columns\":[\"temperature_c\",\"time\"],\"values\":[[22.5,\"2026-10-04T00:00:00Z\"],[null,\"2026-10-04T00:00:01Z\"]]}]}]}";
        behavior = request -> {
            if (!request.path().equals("/rest/core/data/query")) return null;
            assertEquals("POST", request.method());
            JsonNode query = mapper.readTree(request.body()).get(0);
            assertEquals("\"temperature_c\"", query.path("fields").get(0).asText());
            assertEquals("time >= '2026-10-04T00:00:00Z'", query.path("where").get(0).asText());
            assertEquals(1001, query.path("limit").asInt());
            assertFalse(query.has("fill"));
            assertFalse(query.has("group"));
            return new Reply(200, response, null);
        };
        JsonNode history = client.history("campus_environment", "env_demo_01", "temperature_c", from, from + 60_000, 1001);
        assertEquals(mapperValue(response), history);
        assertTrue(history.at("/results/0/series/0/values/1/0").isNull());
        assertThrows(AiriotException.class, () -> client.history("campus_environment", "env_demo_01", "temperature_c", from, from + 8 * 86400000L, 1001));
    }

    @Test
    void historyErrorAndMalformedColumnsFailWithoutInventingSamples() {
        behavior = request -> request.path().equals("/rest/core/data/query")
                ? new Reply(200, "{\"results\":[{\"error\":\"" + SECRET + "\"}]}", null) : null;
        AiriotException failure = assertThrows(AiriotException.class,
                () -> client.history("campus_environment", "env_demo_01", "temperature_c", 1, 2, 1));
        assertSafe(failure);
        behavior = request -> request.path().equals("/rest/core/data/query")
                ? new Reply(200, "{\"results\":[{\"series\":[{\"columns\":[\"time\",\"another_tag\"],\"values\":[]}]}]}", null) : null;
        assertThrows(AiriotException.class, () -> client.history("campus_environment", "env_demo_01", "temperature_c", 1, 2, 1));
    }

    @Test
    void alarmsKeepUpstreamStatusesAndExplicitUnknownTotal() {
        behavior = request -> {
            if (!request.path().equals("/rest/warning/warning")) return null;
            JsonNode query = mapper.readTree(request.query().get("query"));
            assertEquals(4, query.at("/filter/tableId/$in").size());
            assertEquals(16, query.at("/filter/uid/$in").size());
            assertFalse(query.path("filter").has("table.id"));
            assertFalse(query.path("filter").has("$or"));
            return new Reply(200, "[{\"id\":\"alarm-fixture\",\"table\":{\"id\":\"campus_environment\"},"
                    + "\"tableData\":{\"id\":\"env_demo_01\"},\"status\":\"upstream-new-state\",\"level\":\"upstream-level\"}]", null);
        };
        JsonNode alarms = client.alarms(50, 0);
        assertTrue(alarms.path("total").isNull());
        assertEquals("upstream-new-state", alarms.at("/items/0/status").asText());
        assertEquals("upstream-level", alarms.at("/items/0/level").asText());
        behavior = request -> request.path().equals("/rest/warning/warning")
                ? new Reply(200, "[{\"id\":\"out-of-scope\",\"table\":{\"id\":\"campus_environment\"},\"uid\":\"real-device\"}]", "1") : null;
        assertEquals("AIRIOT_SCOPE_MISMATCH", assertThrows(AiriotException.class, () -> client.alarms(50, 0)).getCode());
    }

    @Test
    void patchSendsOnlyOneBooleanAndRequiresActualOkStatus() {
        properties.setControlEnabled(true);
        behavior = request -> {
            if (!request.path().endsWith("/facility_demo_01")) return null;
            assertEquals("PATCH", request.method());
            JsonNode patch = mapper.readTree(request.body());
            assertEquals(1, patch.size());
            assertTrue(patch.path("simulated_switch_on").isBoolean());
            assertTrue(patch.path("simulated_switch_on").booleanValue());
            return new Reply(200, "{\"status\":\"OK\"}", null);
        };
        client.patchSwitch("campus_facility", "facility_demo_01", true);
        behavior = request -> request.path().endsWith("/facility_demo_01") ? new Reply(200, "{\"status\":\"FAIL\"}", null) : null;
        assertThrows(AiriotException.class, () -> client.patchSwitch("campus_facility", "facility_demo_01", false));
    }

    @Test
    void statusWhitelistsIdentityAndNeverClaimsBusinessAcceptance() {
        properties.setControlEnabled(true);
        Map<String, Object> status = client.status();
        assertEquals(true, status.get("configured"));
        assertEquals(true, status.get("connected"));
        assertEquals("machine-fixture", status.get("identityId"));
        assertEquals(false, status.get("isSuper"));
        assertEquals(true, status.get("controlEnabled"));
        String serialized = mapper.valueToTree(status).toString();
        assertFalse(serialized.contains(SECRET));
        assertFalse(serialized.contains(KEY));
        assertFalse(serialized.contains("stub-token"));
        assertFalse(status.containsKey("permissions"));
        assertFalse(status.containsKey("token"));
        JsonNode capabilities = mapper.valueToTree(status.get("capabilities"));
        assertEquals("PASS", capabilities.get(0).path("status").asText());
        for (int i = 1; i < capabilities.size(); i++) assertEquals("PENDING", capabilities.get(i).path("status").asText());
    }

    @Test
    void errorHtmlVendorErrorAndTransportFailureAreSafeBusinessFailures() {
        behavior = request -> request.path().endsWith("/env_demo_01")
                ? new Reply(200, "<html>" + SECRET + "</html>", null) : null;
        assertSafe(assertThrows(AiriotException.class, () -> client.record("campus_environment", "env_demo_01")));
        behavior = request -> request.path().endsWith("/env_demo_01")
                ? new Reply(200, "{\"code\":120010002,\"message\":\"" + SECRET + "\",\"detail\":\"" + KEY + "\"}", null) : null;
        AiriotException vendor = assertThrows(AiriotException.class, () -> client.record("campus_environment", "env_demo_01"));
        assertEquals("AIRIOT_UPSTREAM_ERROR", vendor.getCode());
        assertSafe(vendor);
        server.stop(0);
        AiriotException unavailable = assertThrows(AiriotException.class, () -> client.record("campus_environment", "env_demo_01"));
        assertEquals(503, unavailable.getHttpStatus());
        assertSafe(unavailable);
    }

    @Test
    void malformedExpiryNeverUsesAnAssumedTokenLifetime() {
        behavior = request -> request.path().equals("/rest/core/auth/token")
                ? new Reply(200, "{\"token\":\"stub-token-sensitive\",\"expiresAt\":\"" + SECRET + "\"}", null) : null;
        AiriotException failure = assertThrows(AiriotException.class, () -> client.record("campus_environment", "env_demo_01"));
        assertEquals("AIRIOT_PROTOCOL_ERROR", failure.getCode());
        assertSafe(failure);
        assertEquals(1, requests.size());
    }

    @Test
    void rejectsRedirectRatherThanForwardingApplicationSecrets() {
        behavior = request -> request.path().equals("/rest/core/auth/token") ? new Reply(302, "{}", null) : null;
        AiriotException failure = assertThrows(AiriotException.class, () -> client.record("campus_environment", "env_demo_01"));
        assertEquals(502, failure.getHttpStatus());
        assertEquals(1, requests.size());
        assertSafe(failure);
    }

    private Reply recordReply(Request request, String id) {
        return request.path().endsWith("/" + id) ? new Reply(200, "{\"id\":\"" + id + "\"}", null) : null;
    }

    private JsonNode parseQuery(Request request) { return mapperValue(request.query().get("query")); }
    private JsonNode mapperValue(String text) {
        try { return mapper.readTree(text); }
        catch (IOException ex) { throw new AssertionError(ex); }
    }

    private void assertSafe(AiriotException failure) {
        assertNull(failure.getCause());
        StringWriter stack = new StringWriter();
        failure.printStackTrace(new PrintWriter(stack));
        for (String forbidden : List.of(KEY, SECRET, "stub-token", "appsecret=", properties.getBaseUrl())) {
            assertFalse(stack.toString().contains(forbidden));
        }
    }

    private void handle(HttpExchange exchange) throws IOException {
        Map<String, String> query = new HashMap<>();
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw != null) for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            query.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    parts.length == 2 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "");
        }
        Request request = new Request(exchange.getRequestMethod(), exchange.getRequestURI().getPath(), query,
                exchange.getRequestHeaders().getFirst("Authorization"), exchange.getRequestHeaders().getFirst("x-request-project"),
                new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        requests.add(request);
        Reply reply;
        try { reply = behavior == null ? null : behavior.reply(request); }
        catch (Exception ex) { reply = new Reply(500, "{\"message\":\"stub assertion failed\"}", null); }
        if (reply == null && request.path().equals("/rest/core/auth/token")) {
            int number = tokens.incrementAndGet();
            long expiry = clock.millis() + 3_600_000;
            reply = new Reply(200, "{\"token\":\"stub-token-" + number + "\",\"expiresAt\":\""
                    + (expiryMillis ? expiry : expiry / 1000) + "\"}", null);
        }
        if (reply == null && request.path().equals("/rest/core/auth/user")) {
            reply = new Reply(200, "{\"id\":\"machine-fixture\",\"isSuper\":false,\"token\":\"stub-token-1\","
                    + "\"appKey\":\"" + KEY + "\",\"appSecret\":\"" + SECRET + "\",\"permissions\":[\"unneeded\"]}", null);
        }
        if (reply == null) reply = new Reply(404, "{}", null);
        byte[] bytes = reply.body().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        if (reply.count() != null) exchange.getResponseHeaders().set("count", reply.count());
        exchange.sendResponseHeaders(reply.status(), bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    @FunctionalInterface
    private interface Behavior { Reply reply(Request request) throws Exception; }
    private record Request(String method, String path, Map<String, String> query, String authorization, String project, String body) {}
    private record Reply(int status, String body, String count) {}
    private static final class MutableClock extends Clock {
        private final AtomicLong millis;
        private MutableClock(long millis) { this.millis = new AtomicLong(millis); }
        void advance(long value) { millis.addAndGet(value); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(millis.get()); }
    }
}
