package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.dto.CampusDtos.*;
import com.letoy.main.campus.entity.CampusBuilding;
import com.letoy.main.campus.entity.SpaceBinding;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.letoy.main.campus.service.CampusJson.*;

@Service
public class CampusMonitoringService {
    private static final long MAX_HISTORY_SPAN = 7L * 24 * 60 * 60 * 1000;
    private static final int HISTORY_LIMIT = 1000;
    private final AiriotClient client;
    private final CampusAccess access;
    private final CampusCatalog catalog;
    private final CampusLocationService locations;
    @Value("${campus.point-stale-after-ms:60000}")
    private long staleAfterMs = 60_000;

    public CampusMonitoringService(AiriotClient client, CampusAccess access, CampusCatalog catalog, CampusLocationService locations) {
        this.client = client;
        this.access = access;
        this.catalog = catalog;
        this.locations = locations;
    }
    public Overview overview() {
        access.requireRead();
        List<Issue> issues = new ArrayList<>();
        List<Space> spaces = readSpaces(issues);
        List<Device> devices = readDevices(spaces, issues);
        long now = System.currentTimeMillis();
        if (issues.stream().filter(issue -> issue.code().equals("TABLE_UNAVAILABLE")).count() == 5) {
            throw CampusException.upstream("AIRIOT 校园数据暂不可用");
        }
        List<Point> points = readPoints(devices, issues, now);
        int actualPoints = (int) points.stream().filter(point -> point.value() != null && point.time() != null
                && !point.quality().equals("invalid")).count();
        if (spaces.size() != 4 || devices.size() != 16 || actualPoints != 28) {
            issues.add(new Issue("INCOMPLETE", "实际读取未达到已批准的 4 空间、16 设备、28 采集点范围", "overview"));
        }
        return new Overview("AIRIOT", CampusCatalog.PROJECT_ID, now, true, spaces, devices, points, issues,
                new Completeness(4, 16, 28, spaces.size(), devices.size(), actualPoints));
    }
    public Items<Space> spaces() {
        access.requireRead();
        List<Issue> issues = new ArrayList<>();
        List<Space> result = readSpaces(issues);
        if (!issues.isEmpty()) throw CampusException.upstream("AIRIOT 空间目录暂不可完整读取");
        return new Items<>(result, System.currentTimeMillis());
    }
    public Items<Device> devices() {
        access.requireRead();
        List<Issue> issues = new ArrayList<>();
        List<Space> spaces = readSpaces(issues);
        List<Device> devices = readDevices(spaces, issues);
        if (!issues.isEmpty()) throw CampusException.upstream("AIRIOT 设备目录暂不可完整读取");
        return new Items<>(devices, System.currentTimeMillis());
    }
    private List<Space> readSpaces(List<Issue> issues) {
        List<Space> spaces = new ArrayList<>();
        CampusLocationService.Locations local = locations.snapshot();
        Map<String, SpaceBinding> bindings = new HashMap<>();
        local.bindings().forEach(binding -> bindings.put(binding.getSpaceId(), binding));
        Map<String, CampusBuilding> buildings = new HashMap<>();
        local.buildings().forEach(building -> buildings.put(building.getId(), building));
        Set<String> seen = new HashSet<>();
        for (JsonNode record : readTable("campus_space", issues)) {
            String id = text(record.get("id"));
            if (id == null || !CampusCatalog.SPACE_IDS.contains(id) || !seen.add(id)) {
                issues.add(new Issue("UNEXPECTED_RECORD", "忽略未批准或重复的空间记录", "campus_space"));
                continue;
            }
            SpaceBinding binding = bindings.get(id);
            CampusBuilding building = binding == null ? null : buildings.get(binding.getBuildingId());
            spaces.add(new Space(id, name(record, id), firstText(record, "space_type", "type"),
                    building == null ? null : building.getCampusId(),
                    building == null ? null : building.getId(), binding == null ? null : binding.getFloor()));
        }
        spaces.sort(Comparator.comparing(Space::id));
        return spaces;
    }
    private List<Device> readDevices(List<Space> spaces, List<Issue> issues) {
        Map<String, String> spaceNames = new HashMap<>();
        spaces.forEach(space -> spaceNames.put(space.id(), space.name()));
        List<Device> devices = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String table : catalog.tables()) {
            for (JsonNode record : readTable(table, issues)) {
                String id = text(record.get("id"));
                CampusCatalog.DeviceSpec spec = catalog.find(id);
                if (spec == null || !spec.table().equals(table) || !seen.add(id)
                        || !Boolean.TRUE.equals(bool(record.get("is_simulated")))) {
                    issues.add(new Issue("UNEXPECTED_RECORD", "忽略未批准、模型不符或重复的设备记录", table));
                    continue;
                }
                String spaceId = text(record.get("location_code"));
                if (spaceId != null && !CampusCatalog.SPACE_IDS.contains(spaceId)) {
                    issues.add(new Issue("UNKNOWN_SPACE", "设备的位置引用不在批准空间范围内", id));
                    spaceId = null;
                }
                Boolean switchOn = spec.controllable() ? bool(record.get("simulated_switch_on")) : null;
                if (spec.controllable() && switchOn == null) {
                    issues.add(new Issue("INVALID_SWITCH", "模拟开关未返回严格 Boolean，禁止将未知状态显示为关闭", id));
                }
                devices.add(new Device(id, table, name(record, id), spec.category(), spaceId,
                        spaceNames.get(spaceId), bool(record.get("online")), time(record.get("commTime")),
                        true, switchOn, spec.tags()));
            }
        }
        devices.sort(Comparator.comparing(Device::tableId).thenComparing(Device::id));
        return devices;
    }
    private JsonNode readTable(String table, List<Issue> issues) {
        try {
            JsonNode result = client.records(table);
            if (result == null || !result.isArray()) throw CampusException.upstream("AIRIOT 记录格式不符合协议");
            return result;
        } catch (AiriotException | CampusException exception) {
            issues.add(new Issue("TABLE_UNAVAILABLE", "此模型读取失败或无权限，实际数量不以期望值代替", table));
            return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        }
    }
    private List<Point> readPoints(List<Device> devices, List<Issue> issues, long now) {
        List<Map<String, String>> refs = new ArrayList<>();
        Map<String, JsonNode> values = new HashMap<>();
        devices.forEach(device -> device.tags().forEach(tag -> refs.add(Map.of("tableId", device.tableId(), "id", device.id(), "tagId", tag.id()))));
        if (!refs.isEmpty()) {
            try {
                JsonNode result = client.latest(refs);
                if (result == null || !result.isArray()) throw CampusException.upstream("AIRIOT 最新值格式不符合协议");
                Set<String> allowed = new HashSet<>();
                refs.forEach(ref -> allowed.add(pointKey(ref.get("tableId"), ref.get("id"), ref.get("tagId"))));
                for (JsonNode value : result) {
                    String key = pointKey(text(value.get("tableId")), text(value.get("id")), text(value.get("tagId")));
                    if (!allowed.contains(key)) {
                        issues.add(new Issue("UNEXPECTED_POINT", "忽略不属于本次批准查询的采集点", "latest"));
                    } else if (values.putIfAbsent(key, value) != null) {
                        issues.add(new Issue("DUPLICATE_POINT", "上游返回重复采集点，保留首次响应并标记数据问题", "latest"));
                    }
                }
            } catch (AiriotException | CampusException exception) {
                issues.add(new Issue("LATEST_UNAVAILABLE", "最新值读取失败或无权限，采集点显示未知", "latest"));
            }
        }
        List<Point> points = new ArrayList<>();
        for (Device device : devices) {
            for (Tag tag : device.tags()) {
                JsonNode raw = values.get(pointKey(device.tableId(), device.id(), tag.id()));
                Double value = raw == null ? null : number(raw.get("value"));
                Long sampledAt = raw == null ? null : time(raw.get("time"));
                String quality = raw == null || raw.path("value").isNull() ? "missing"
                        : value == null || sampledAt == null || sampledAt > now + 5_000 ? "invalid"
                        : now - sampledAt > Math.max(1_000, staleAfterMs) ? "stale" : "fresh";
                points.add(new Point(device.id(), device.tableId(), tag.id(), value, sampledAt, quality, tag.unit()));
            }
        }
        return points;
    }
    public History history(String deviceId, String tagId, long from, long to) {
        access.requireRead();
        CampusCatalog.DeviceSpec spec = catalog.require(deviceId);
        Tag tag = catalog.requireTag(spec, tagId);
        if (from <= 0 || to < from || to - from > MAX_HISTORY_SPAN || to > System.currentTimeMillis() + 300_000) {
            throw CampusException.badRequest("历史查询需使用毫秒时间，区间不超过 7 天且不可查询未来");
        }
        JsonNode raw = client.history(spec.table(), deviceId, tagId, from, to, HISTORY_LIMIT + 1);
        List<Issue> issues = new ArrayList<>();
        List<Sample> samples = mapHistory(raw, tagId, from, to, issues);
        samples.sort(Comparator.comparingLong(Sample::time));
        // A saturated upstream response remains potentially truncated even after invalid/out-of-range rows are removed.
        boolean truncated = samples.size() > HISTORY_LIMIT || rawHistorySampleCount(raw) > HISTORY_LIMIT;
        if (samples.size() > HISTORY_LIMIT) samples = new ArrayList<>(samples.subList(0, HISTORY_LIMIT));
        return new History("AIRIOT", deviceId, tagId, tag.unit(), from, to, System.currentTimeMillis(), samples, truncated, issues);
    }
    static List<Sample> mapHistory(JsonNode raw, String tagId, long from, long to, List<Issue> issues) {
        if (raw == null || !raw.isObject() || !raw.path("results").isArray()) {
            throw CampusException.upstream("AIRIOT 历史响应格式不符合协议");
        }
        List<Sample> samples = new ArrayList<>();
        for (JsonNode result : raw.path("results")) {
            if (result.hasNonNull("error")) {
                issues.add(new Issue("HISTORY_QUERY_FAILED", "AIRIOT 返回历史查询错误", "history"));
                continue;
            }
            JsonNode series = result.path("series");
            if (series.isMissingNode() || series.isNull()) continue; // Valid raw empty history, not zero readings.
            if (!series.isArray()) throw CampusException.upstream("AIRIOT 历史 series 格式不符合协议");
            for (JsonNode item : series) {
                JsonNode columns = item.path("columns");
                JsonNode rows = item.path("values");
                if (!columns.isArray() || !rows.isArray()) throw CampusException.upstream("AIRIOT 历史列/样本格式不符合协议");
                int exactTimeIndex = -1;
                int fallbackTimeIndex = -1;
                int exactValueIndex = -1;
                int fallbackValueIndex = -1;
                for (int i = 0; i < columns.size(); i++) {
                    String column = text(columns.get(i));
                    if ("time".equals(column)) exactTimeIndex = i;
                    if ("_time".equals(column)) fallbackTimeIndex = i;
                    if (tagId.equals(column)) exactValueIndex = i;
                    if ("value".equals(column)) fallbackValueIndex = i;
                }
                int valueIndex = exactValueIndex >= 0 ? exactValueIndex : fallbackValueIndex;
                int timeIndex = exactTimeIndex >= 0 ? exactTimeIndex : fallbackTimeIndex;
                if (timeIndex < 0 || valueIndex < 0) {
                    issues.add(new Issue("UNMAPPED_HISTORY_COLUMNS", "历史未返回时间列或所选采集点列", "history"));
                    continue;
                }
                for (JsonNode row : rows) {
                    Long sampledAt = row.isArray() ? time(row.get(timeIndex)) : null;
                    Double value = row.isArray() ? number(row.get(valueIndex)) : null;
                    if (sampledAt == null || value == null) {
                        issues.add(new Issue("INVALID_HISTORY_SAMPLE", "跳过无法解析的原始历史样本", "history"));
                    } else if (sampledAt >= from && sampledAt <= to) {
                        samples.add(new Sample(sampledAt, value));
                    } else {
                        issues.add(new Issue("OUT_OF_RANGE_HISTORY", "上游返回区间外样本，已排除", "history"));
                    }
                }
            }
        }
        return samples;
    }
    private static long rawHistorySampleCount(JsonNode raw) {
        long count = 0;
        for (JsonNode result : raw.path("results")) {
            for (JsonNode series : result.path("series")) {
                if (series.path("values").isArray()) count += series.path("values").size();
            }
        }
        return count;
    }
    public Alarms alarms(int limit, int skip) {
        access.requireRead();
        validatePage(limit, skip);
        JsonNode result = client.alarms(limit, skip);
        if (result == null || !result.isObject() || !result.path("items").isArray()) {
            throw CampusException.upstream("AIRIOT 报警响应格式不符合协议");
        }
        List<Alarm> alarms = new ArrayList<>();
        List<Issue> issues = new ArrayList<>();
        for (JsonNode row : result.path("items")) {
            String deviceId = reference(row.get("tableData"));
            if (deviceId == null) deviceId = firstText(row, "deviceId", "uid");
            CampusCatalog.DeviceSpec spec = catalog.find(deviceId);
            String table = reference(row.get("table"));
            if (table == null) table = text(row.get("tableId"));
            String id = firstText(row, "id", "_id");
            if (spec == null || id == null || (table != null && !table.equals(spec.table()))) {
                issues.add(new Issue("UNMAPPED_ALARM", "忽略无法确认属于批准模拟设备的报警记录", "alarms"));
                continue;
            }
            String name = row.path("tableData").isObject() ? firstText(row.path("tableData"), "name", "_label") : null;
            String tagId = reference(row.get("warnTag"));
            if (tagId == null) tagId = text(row.get("tagId"));
            String selectedTag = tagId;
            if (tagId != null && spec.tags().stream().noneMatch(tag -> tag.id().equals(selectedTag))) {
                issues.add(new Issue("UNMAPPED_ALARM_TAG", "报警采集点字段未映射为本设备的批准点位", id));
                tagId = null;
            }
            String status = firstText(row, "status");
            String level = firstText(row, "level");
            String message = firstText(row, "desc", "message", "content", "name", "description");
            alarms.add(new Alarm(id, deviceId, name, spec.table(), tagId,
                    message == null ? "AIRIOT 报警（未返回内容）" : message,
                    time(row.get("time")), time(row.get("recoveryTime")), status == null ? "UNKNOWN" : status,
                    level == null ? "UNKNOWN" : level, true));
        }
        Long total = result.path("total").isIntegralNumber() && issues.isEmpty() ? result.path("total").longValue() : null;
        if (alarms.size() > limit) throw CampusException.upstream("AIRIOT 报警数量超出请求上限");
        return new Alarms(alarms, total, System.currentTimeMillis(), issues);
    }
    static void validatePage(int limit, int skip) {
        if (limit < 1 || limit > 100 || skip < 0 || skip > 10_000) throw CampusException.badRequest("分页 limit 为 1–100，skip 为 0–10000");
    }
    private String name(JsonNode record, String id) {
        String name = firstText(record, "name", "_label");
        return name == null ? id : name;
    }
    private String pointKey(String table, String device, String tag) { return table + "/" + device + "/" + tag; }
}
