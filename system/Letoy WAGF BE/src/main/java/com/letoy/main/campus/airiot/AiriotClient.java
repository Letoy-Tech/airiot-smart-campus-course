package com.letoy.main.campus.airiot;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The only HTTP boundary to the isolated simulated campus project. No fallback data. */
@Component
public class AiriotClient {
    private static final int MAX_BODY_BYTES = 4 * 1024 * 1024;
    private static final Map<String, List<String>> RECORDS = Map.of(
            "campus_space", List.of("demo_room_101", "demo_room_102", "demo_room_103", "demo_room_104"),
            "campus_environment", deviceIds("env_demo_"),
            "campus_energy", deviceIds("energy_demo_"),
            "campus_facility", deviceIds("facility_demo_"),
            "campus_lighting", deviceIds("light_demo_"));
    private static final Map<String, Set<String>> TAGS = Map.of(
            "campus_environment", Set.of("temperature_c", "humidity_pct"),
            "campus_energy", Set.of("voltage_v", "power_kw"),
            "campus_facility", Set.of("run_state", "equipment_temperature_c"),
            "campus_lighting", Set.of("illuminance_lux"));
    private static final Set<String> POINT_KEYS = Set.of("tableId", "id", "tagId");
    private static final List<String> RECORD_FIELDS = List.of(
            "id", "name", "_label", "_table", "online", "commTime", "connectTime",
            "location_code", "location_label", "data_source", "is_simulated",
            "simulated_switch_on", "space_type", "type");

    private final AiriotProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final Clock clock;
    private volatile TokenState cachedToken;

    @Autowired
    public AiriotClient(AiriotProperties properties, ObjectMapper mapper) {
        this(properties, mapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build(), Clock.systemUTC());
    }

    AiriotClient(AiriotProperties properties, ObjectMapper mapper, HttpClient http, Clock clock) {
        this.properties = properties;
        this.mapper = mapper;
        this.http = http;
        this.clock = clock;
    }

    public JsonNode records(String table) {
        requireTable(table);
        ArrayNode all = mapper.createArrayNode();
        Set<String> seen = new HashSet<>();
        Long total = null;
        int skip = 0;
        validateConfiguration();
        for (int page = 0; page < properties.getMaxPages(); page++) {
            ObjectNode query = recordQuery(table);
            query.put("limit", properties.getPageSize());
            query.put("skip", skip);
            query.putObject("sort").put("id", 1);
            query.put("withCount", true);
            Reply reply = authenticated("GET", "/core/t/" + table + "/d?query=" + encodeJson(query), null);
            JsonNode items = requireArray(reply.body());
            Long pageTotal = count(reply.headers());
            if (pageTotal != null) {
                if (pageTotal > RECORDS.get(table).size() || (total != null && !total.equals(pageTotal))) {
                    throw protocol("AIRIOT 分页范围或总数发生变化，请重试");
                }
                total = pageTotal;
            }
            if (items.isEmpty()) {
                if (total != null && all.size() < total) throw protocol("AIRIOT 分页未返回完整记录");
                return all;
            }
            for (JsonNode item : items) {
                requireRecordResponse(table, item);
                if (!seen.add(item.path("id").asText())) throw protocol("AIRIOT 分页重复，无法确认完整记录");
                all.add(item);
            }
            skip += items.size();
            if (total != null && all.size() == total) return all;
            if (total != null && all.size() > total) throw protocol("AIRIOT 分页总数不一致");
        }
        throw new AiriotException("AIRIOT_PAGINATION_LIMIT", 502, "AIRIOT 分页超出安全上限，未返回部分结果");
    }

    public JsonNode record(String table, String id) {
        requireRecord(table, id);
        JsonNode node = authenticated("GET", "/core/t/" + table + "/d/" + id, null).body();
        requireRecordResponse(table, node);
        if (!id.equals(node.path("id").asText())) throw protocol("AIRIOT 返回的记录与目标不一致");
        return node;
    }

    public JsonNode latest(List<Map<String, String>> refs) {
        if (refs == null || refs.isEmpty() || refs.size() > 28) throw target("最新值目标数量无效");
        Set<String> requested = new HashSet<>();
        for (Map<String, String> ref : refs) {
            if (ref == null || !ref.keySet().equals(POINT_KEYS)) throw target("最新值目标结构无效");
            requirePoint(ref.get("tableId"), ref.get("id"), ref.get("tagId"));
            if (!requested.add(pointKey(ref.get("tableId"), ref.get("id"), ref.get("tagId")))) {
                throw target("最新值目标重复");
            }
        }
        JsonNode values = requireArray(authenticated("POST", "/core/data/latest", mapper.valueToTree(refs)).body());
        Set<String> returned = new HashSet<>();
        for (JsonNode value : values) {
            if (!value.isObject() || !value.path("tableId").isTextual()
                    || !value.path("id").isTextual() || !value.path("tagId").isTextual()) {
                throw protocol("AIRIOT 最新值目标结构无效");
            }
            String key = pointKey(value.path("tableId").asText(), value.path("id").asText(), value.path("tagId").asText());
            if (!requested.contains(key) || !returned.add(key)) throw scopeMismatch();
        }
        // Missing/invalid individual values are preserved for explicit business quality indicators.
        return values;
    }

    public JsonNode history(String table, String id, String tag, long from, long to, int limit) {
        requirePoint(table, id, tag);
        validateConfiguration();
        long maximumSpan = Duration.ofHours(properties.getMaxHistorySpanHours()).toMillis();
        if (from < 0 || to <= from || to - from > maximumSpan || limit < 1 || limit > 10000) {
            throw target("历史时间范围或样本上限无效");
        }
        ObjectNode query = mapper.createObjectNode();
        query.putArray("fields").add("\"" + tag + "\"");
        query.put("tableId", table);
        query.put("id", id);
        query.putArray("where").add("time >= '" + Instant.ofEpochMilli(from) + "'")
                .add("time <= '" + Instant.ofEpochMilli(to) + "'");
        query.put("order", "time asc");
        query.put("limit", limit);
        query.put("offset", 0);
        ArrayNode request = mapper.createArrayNode().add(query);
        JsonNode response = authenticated("POST", "/core/data/query", request).body();
        if (!response.isObject() || !response.path("results").isArray()) throw protocol("AIRIOT 历史响应结构无效");
        for (JsonNode result : response.path("results")) {
            if (!result.isObject() || result.has("error")) throw protocol("AIRIOT 历史查询失败");
            if (!result.has("series")) continue; // Influx-style empty result, not invented samples.
            for (JsonNode series : requireArray(result.path("series"))) {
                if (!series.isObject() || !series.path("columns").isArray() || !series.path("values").isArray()) {
                    throw protocol("AIRIOT 历史列结构无效");
                }
                Set<String> columns = new HashSet<>();
                for (JsonNode column : series.path("columns")) {
                    if (!column.isTextual() || !columns.add(column.asText())) throw protocol("AIRIOT 历史列结构无效");
                }
                if (!columns.contains("time") || !columns.contains(tag)) throw protocol("AIRIOT 历史未返回请求列");
                for (JsonNode row : series.path("values")) {
                    if (!row.isArray() || row.size() != columns.size()) throw protocol("AIRIOT 历史行列不一致");
                }
            }
        }
        return response;
    }

    public JsonNode alarms(int limit, int skip) {
        if (limit < 1 || limit > 200 || skip < 0 || skip > 100000) throw target("报警分页参数无效");
        ObjectNode query = mapper.createObjectNode();
        query.put("limit", limit).put("skip", skip).put("withCount", true);
        query.putObject("sort").put("time", -1).put("id", 1);
        ObjectNode filter = query.putObject("filter");
        ArrayNode tables = filter.putObject("tableId").putArray("$in");
        TAGS.keySet().stream().sorted().forEach(tables::add);
        ArrayNode allowedIds = mapper.createArrayNode();
        TAGS.keySet().stream().sorted().forEach(table -> RECORDS.get(table).forEach(allowedIds::add));
        filter.putObject("uid").set("$in", allowedIds);
        Reply reply = authenticated("GET", "/warning/warning?query=" + encodeJson(query), null);
        JsonNode items = requireArray(reply.body());
        for (JsonNode alarm : items) {
            if (!alarm.isObject()) throw protocol("AIRIOT 报警记录结构无效");
            String table = alarm.path("table").path("id").asText(null);
            String id = alarm.path("uid").asText(null);
            String recordId = alarm.path("tableData").path("id").asText(null);
            if (table == null || !TAGS.containsKey(table) || !(allowedRecord(table, id) || allowedRecord(table, recordId))) {
                throw scopeMismatch();
            }
            if (id != null && !allowedRecord(table, id)) throw scopeMismatch();
            if (recordId != null && !allowedRecord(table, recordId)) throw scopeMismatch();
        }
        ObjectNode result = mapper.createObjectNode();
        result.set("items", items);
        Long total = count(reply.headers());
        if (total == null) result.putNull("total"); else result.put("total", total);
        return result;
    }

    public void patchSwitch(String table, String id, boolean on) {
        requireRecord(table, id);
        if (!Set.of("campus_facility", "campus_lighting").contains(table)) throw target("目标没有模拟开关");
        if (!properties.isControlEnabled()) {
            throw new AiriotException("AIRIOT_CONTROL_DISABLED", 503, "AIRIOT 模拟控制尚未启用");
        }
        ObjectNode patch = mapper.createObjectNode().put("simulated_switch_on", on);
        JsonNode response = authenticated("PATCH", "/core/t/" + table + "/d/" + id, patch).body();
        if (!response.isObject() || !"OK".equals(response.path("status").asText())) {
            throw protocol("AIRIOT 未确认模拟字段更新");
        }
        // Business service must read the same record back and confirm the Boolean before success.
    }

    public Map<String, Object> status() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("configured", false);
        result.put("connected", false);
        result.put("projectId", AiriotProperties.PROJECT_ID);
        result.put("baseUrl", safeBaseUrl());
        result.put("identityId", null);
        result.put("isSuper", null);
        result.put("checkedAt", clock.millis());
        result.put("controlEnabled", false);
        List<Map<String, String>> capabilities = new ArrayList<>();
        result.put("capabilities", capabilities);
        try {
            validateConfiguration();
            result.put("configured", true);
            JsonNode identity = authenticated("GET", "/core/auth/user", null).body();
            if (!identity.isObject() || !identity.path("id").isTextual() || !identity.path("isSuper").isBoolean()) {
                throw protocol("AIRIOT 身份响应结构无效");
            }
            String identityId = identity.path("id").asText();
            if (!identityId.matches("[A-Za-z0-9_-]{1,128}") || containsCredential(identityId)) {
                throw protocol("AIRIOT 身份标识无效");
            }
            result.put("connected", true);
            result.put("identityId", identityId);
            result.put("isSuper", identity.path("isSuper").booleanValue());
            result.put("controlEnabled", properties.isControlEnabled());
            result.put("message", "机器身份连接成功；业务能力需要分别验收");
            capabilities.add(capability("authentication", "PASS", "专用应用已获取项目身份"));
        } catch (AiriotException ex) {
            result.put("message", ex.getMessage());
            capabilities.add(capability("authentication", Boolean.TRUE.equals(result.get("configured")) ? "FAIL" : "PENDING", ex.getMessage()));
        }
        for (String name : List.of("records", "latest", "history", "alarms", "simulatedControl")) {
            capabilities.add(capability(name, "PENDING", "接入状态不替代业务接口验收"));
        }
        return result;
    }

    private Reply authenticated(String method, String path, JsonNode body) {
        validateConfiguration();
        for (int attempt = 0; attempt < 2; attempt++) {
            String token = token();
            HttpResponse<String> response = send(method, path, body, token);
            if (response.statusCode() == 401 && attempt == 0) {
                invalidate(token);
                continue;
            }
            requireSuccess(response.statusCode());
            return new Reply(parse(response.body()), response.headers());
        }
        throw new AiriotException("AIRIOT_AUTH_FAILED", 502, "AIRIOT 项目应用鉴权失败，请检查后端接入配置");
    }

    private synchronized String token() {
        long now = clock.millis();
        if (cachedToken != null && now < cachedToken.refreshAt()) return cachedToken.value();
        String path = "/core/auth/token?appkey=" + encode(properties.getAppKey()) + "&appsecret=" + encode(properties.getAppSecret());
        HttpResponse<String> response = send("GET", path, null, null);
        requireSuccess(response.statusCode());
        JsonNode output = parse(response.body());
        JsonNode token = output.path("token");
        if (!output.isObject() || !token.isTextual() || token.asText().isBlank()
                || token.asText().length() > 16384 || token.asText().contains("\r") || token.asText().contains("\n")) {
            throw protocol("AIRIOT 未返回有效项目令牌");
        }
        long expiresAt;
        try {
            JsonNode expiry = output.path("expiresAt");
            if (!expiry.isIntegralNumber() && !expiry.isTextual()) throw new NumberFormatException();
            expiresAt = Long.parseLong(expiry.asText());
            if (expiresAt < 1_000_000_000_000L) expiresAt = Math.multiplyExact(expiresAt, 1000);
        } catch (ArithmeticException | NumberFormatException ex) {
            throw protocol("AIRIOT 令牌过期时间无效");
        }
        if (expiresAt <= now) throw protocol("AIRIOT 返回的项目令牌已过期");
        long skew = Math.min(30000, (expiresAt - now) / 2);
        cachedToken = new TokenState(token.asText(), expiresAt - skew);
        return cachedToken.value();
    }

    private synchronized void invalidate(String rejected) {
        if (cachedToken != null && cachedToken.value().equals(rejected)) cachedToken = null;
    }

    private HttpResponse<String> send(String method, String path, JsonNode body, String token) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(normalizedBaseUrl() + path))
                    .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                    .header("x-request-project", AiriotProperties.PROJECT_ID)
                    .header("Accept", "application/json");
            if (token != null) request.header("Authorization", token);
            if (body == null) request.method(method, HttpRequest.BodyPublishers.noBody());
            else request.header("Content-Type", "application/json").method(method,
                    HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body), StandardCharsets.UTF_8));
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.body() == null || response.body().getBytes(StandardCharsets.UTF_8).length > MAX_BODY_BYTES) {
                throw protocol("AIRIOT 响应大小无效");
            }
            return response;
        } catch (HttpTimeoutException ex) {
            throw new AiriotException("AIRIOT_TIMEOUT", 503, "AIRIOT 请求超时，请稍后重试");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiriotException("AIRIOT_UNAVAILABLE", 503, "AIRIOT 请求被中断");
        } catch (IOException | IllegalArgumentException ex) {
            // Do not attach the cause: Java HTTP/JSON exception messages may contain secret URLs/bodies.
            throw new AiriotException("AIRIOT_UNAVAILABLE", 503, "AIRIOT 连接暂时不可用");
        }
    }

    private void validateConfiguration() {
        if (!AiriotProperties.PROJECT_ID.equals(properties.getProjectId())
                || properties.getTimeoutSeconds() < 1 || properties.getTimeoutSeconds() > 60
                || properties.getPageSize() < 1 || properties.getPageSize() > 1000
                || properties.getMaxPages() < 1 || properties.getMaxPages() > 1000
                || properties.getMaxHistorySpanHours() < 1 || properties.getMaxHistorySpanHours() > 168) {
            throw new AiriotException("AIRIOT_CONFIG_INVALID", 503, "AIRIOT 项目或接入范围配置无效");
        }
        if (properties.getAppKey() == null || properties.getAppKey().isBlank()
                || properties.getAppSecret() == null || properties.getAppSecret().isBlank()) {
            throw new AiriotException("AIRIOT_NOT_CONFIGURED", 503, "请在后端配置专用 AIRIOT 应用凭证");
        }
        try {
            URI uri = URI.create(normalizedBaseUrl());
            boolean loopback = Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(uri.getHost());
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && loopback))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new AiriotException("AIRIOT_CONFIG_INVALID", 503, "AIRIOT 基址配置无效，需要 HTTPS 或本地回环地址");
        }
    }

    private String normalizedBaseUrl() {
        String base = properties.getBaseUrl();
        if (base == null) return "";
        return base.strip().replaceAll("/+$", "");
    }

    private String safeBaseUrl() {
        try {
            URI uri = URI.create(normalizedBaseUrl());
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) return "";
            return containsCredential(normalizedBaseUrl()) ? "[REDACTED]" : normalizedBaseUrl();
        } catch (IllegalArgumentException ex) { return ""; }
    }

    private boolean containsCredential(String value) {
        return containsNonEmpty(value, properties.getAppKey()) || containsNonEmpty(value, properties.getAppSecret())
                || (cachedToken != null && containsNonEmpty(value, cachedToken.value()));
    }

    private static boolean containsNonEmpty(String value, String secret) {
        return secret != null && !secret.isBlank() && value.contains(secret);
    }

    private JsonNode parse(String body) {
        try {
            JsonNode node = mapper.readTree(body);
            if (node == null) throw protocol("AIRIOT 返回空响应");
            if (node.isObject() && node.has("code") && node.has("message") && (node.has("detail") || node.size() <= 4)) {
                throw new AiriotException("AIRIOT_UPSTREAM_ERROR", 502, "AIRIOT 返回业务错误，请检查项目应用权限");
            }
            return node;
        } catch (JsonProcessingException ex) { throw protocol("AIRIOT 未返回有效 JSON"); }
    }

    private String encodeJson(JsonNode node) {
        try { return encode(mapper.writeValueAsString(node)); }
        catch (JsonProcessingException ex) { throw protocol("AIRIOT 请求编码失败"); }
    }

    private ObjectNode recordQuery(String table) {
        ObjectNode query = mapper.createObjectNode();
        ArrayNode ids = query.putObject("filter").putObject("id").putArray("$in");
        RECORDS.get(table).forEach(ids::add);
        // AIRIOT list responses otherwise contain only metadata, hiding simulation/location fields.
        ObjectNode projection = query.putObject("project");
        RECORD_FIELDS.forEach(field -> projection.put(field, 1));
        return query;
    }

    private static List<String> deviceIds(String prefix) {
        return List.of(prefix + "01", prefix + "02", prefix + "03", prefix + "04");
    }

    private static void requireTable(String table) {
        if (table == null || !RECORDS.containsKey(table)) throw target("数据表不在校园接入范围");
    }

    private static void requireRecord(String table, String id) {
        requireTable(table);
        if (id == null || !RECORDS.get(table).contains(id)) throw target("记录不在校园接入范围");
    }

    private static boolean allowedRecord(String table, String id) {
        return table != null && id != null && RECORDS.containsKey(table) && RECORDS.get(table).contains(id);
    }

    private static void requirePoint(String table, String id, String tag) {
        requireRecord(table, id);
        if (!TAGS.containsKey(table) || tag == null || !TAGS.get(table).contains(tag)) throw target("采集点不在校园接入范围");
    }

    private static void requireRecordResponse(String table, JsonNode node) {
        if (!node.isObject() || !node.path("id").isTextual()) throw protocol("AIRIOT 记录结构无效");
        if (!RECORDS.get(table).contains(node.path("id").asText())) throw scopeMismatch();
    }

    private static JsonNode requireArray(JsonNode node) {
        if (!node.isArray()) throw protocol("AIRIOT 未返回预期数组");
        return node;
    }

    private static void requireSuccess(int status) {
        if (status >= 200 && status < 300) return;
        if (status == 401) throw new AiriotException("AIRIOT_AUTH_FAILED", 502, "AIRIOT 项目应用鉴权失败，请检查后端接入配置");
        if (status == 403) throw new AiriotException("AIRIOT_PERMISSION_DENIED", 502, "AIRIOT 项目应用无此接口权限");
        if (status == 429 || status >= 500) throw new AiriotException("AIRIOT_UNAVAILABLE", 503, "AIRIOT 服务暂时不可用");
        throw new AiriotException("AIRIOT_UPSTREAM_ERROR", 502, "AIRIOT 拒绝请求，请检查接口与项目权限");
    }

    private static Long count(HttpHeaders headers) {
        try {
            String raw = headers.firstValue("count").orElse(null);
            if (raw == null) return null;
            long value = Long.parseLong(raw);
            return value >= 0 ? value : null;
        } catch (NumberFormatException ex) { return null; }
    }

    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String pointKey(String table, String id, String tag) { return table + "/" + id + "/" + tag; }
    private static Map<String, String> capability(String name, String status, String detail) {
        return Map.of("name", name, "status", status, "detail", detail);
    }
    private static AiriotException target(String message) { return new AiriotException("AIRIOT_TARGET_INVALID", 400, message); }
    private static AiriotException protocol(String message) { return new AiriotException("AIRIOT_PROTOCOL_ERROR", 502, message); }
    private static AiriotException scopeMismatch() { return new AiriotException("AIRIOT_SCOPE_MISMATCH", 502, "AIRIOT 返回对象超出请求范围"); }
    private record Reply(JsonNode body, HttpHeaders headers) {}
    private record TokenState(String value, long refreshAt) {
        @Override public String toString() { return "TokenState{[REDACTED]}"; }
    }
}
