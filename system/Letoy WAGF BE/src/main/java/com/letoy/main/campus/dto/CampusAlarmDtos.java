package com.letoy.main.campus.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.entity.AlarmCase;
import com.letoy.main.campus.entity.DeviceOwner;
import com.letoy.main.campus.service.CampusException;

import java.util.List;
import java.util.Set;

/** Only locally generated DEMO cases are supported; these DTOs cannot write an upstream alarm. */
public final class CampusAlarmDtos {
    private CampusAlarmDtos() { }
    public record CasePage(List<AlarmCase> items, long total, long observedAt) { }
    public record Handler(String uid, String displayName) { }
    public record Handlers(List<Handler> items, String currentUid) { }
    public record OwnerPage(List<DeviceOwner> items, long observedAt) { }
    public record Scenario(String id, String name, String deviceId, String description) { }
    public record DemoStatus(boolean enabled, String label, List<Scenario> scenarios, List<String> limitations) { }
    public record Action(String uid, String note, long expectedVersion) { }

    public static Action action(JsonNode body, String uidField, String noteField) {
        Set<String> allowed = new java.util.HashSet<>(Set.of("expectedVersion"));
        if (uidField != null) allowed.add(uidField);
        if (noteField != null) allowed.add(noteField);
        if (body == null || !body.isObject()) throw CampusException.badRequest("请求必须为 JSON 对象");
        body.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw CampusException.badRequest("含未允许的字段"); });
        JsonNode version = body.get("expectedVersion");
        if (version == null || !version.isIntegralNumber() || !version.canConvertToLong() || version.longValue() < 0) {
            throw CampusException.badRequest("expectedVersion 必须是非负 JSON 整数");
        }
        String uid = uidField == null ? null : requiredText(body, uidField, 64);
        String note = noteField == null ? null : requiredText(body, noteField, "disposition".equals(noteField) ? 2000 : 500);
        return new Action(uid, note, version.longValue());
    }
    public static void empty(JsonNode body) {
        if (body != null && (!body.isObject() || !body.isEmpty())) throw CampusException.badRequest("演示场景不接收自定义来源、设备或内容");
    }
    private static String requiredText(JsonNode body, String field, int max) {
        JsonNode node = body.get(field);
        if (node == null || !node.isTextual()) throw CampusException.badRequest(field + " 必须为文字");
        String text = node.textValue().trim();
        if (text.isEmpty() || text.length() > max) throw CampusException.badRequest(field + " 需为 1 至 " + max + " 个字符");
        return text;
    }
}
