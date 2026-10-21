package com.letoy.main.campus.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.service.CampusException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;

/** Explicit business responses; never serialize an AIRIOT identity or raw record. */
public final class CampusDtos {
    private CampusDtos() { }

    public record Capabilities(List<String> roles, boolean canRead, boolean canControl,
                               boolean canAdmin, boolean canAudit, boolean canHandleAlarms,
                               boolean canAssignAlarms, boolean canRunDemoScenarios) { }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Space(String id, String name, String type, String campusId, String buildingId, String floor) { }
    public record Tag(String id, String name, String unit) { }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Device(String id, String tableId, String name, String category, String spaceId,
                         String spaceName, Boolean online, Long communicationTime,
                         boolean simulated, Boolean switchOn, List<Tag> tags) { }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Point(String deviceId, String tableId, String tagId, Double value, Long time,
                        String quality, String unit) { }
    public record Issue(String code, String message, String scope) { }
    public record Completeness(int expectedSpaces, int expectedDevices, int expectedPoints,
                               int actualSpaces, int actualDevices, int actualPoints) { }
    public record Overview(String source, String projectId, long observedAt, boolean simulated,
                           List<Space> spaces, List<Device> devices, List<Point> points,
                           List<Issue> issues, Completeness completeness) { }
    public record Items<T>(List<T> items, long observedAt) { }
    public record Sample(long time, double value) { }
    public record History(String source, String deviceId, String tagId, String unit, long from, long to,
                          long observedAt, List<Sample> samples, boolean truncated, List<Issue> issues) { }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Alarm(String id, String deviceId, String deviceName, String tableId, String tagId,
                        String message, Long time, Long recoveryTime, String status, String level,
                        boolean simulated) { }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Alarms(List<Alarm> items, Long total, long observedAt, List<Issue> issues) { }
    public record SwitchResult(String auditId, String deviceId, boolean before, boolean requested,
                               boolean confirmed, long observedAt) { }
    public record AuditPage(List<com.letoy.main.campus.entity.CommandAudit> items, long total) { }
    public record CreateCampusRequest(@NotBlank @Size(max = 80) String name) { }
    public record CreateBuildingRequest(@NotBlank @Size(max = 64) String campusId,
                                        @NotBlank @Size(max = 80) String name) { }
    public record BindSpaceRequest(@NotBlank @Size(max = 64) String buildingId,
                                   @Size(max = 64) String floor) { }

    /** Jackson normally coerces strings/numbers to booleans. Controls explicitly reject that. */
    public record SwitchRequest(boolean on, String reason, boolean expectedState) {
        public static SwitchRequest parse(JsonNode body) {
            if (body == null || !body.isObject() || !body.path("on").isBoolean()
                    || !body.path("expectedState").isBoolean() || !body.path("reason").isTextual()) {
                throw CampusException.badRequest("on 和 expectedState 必须是 JSON Boolean，reason 必须是文字");
            }
            Set<String> fields = Set.of("on", "reason", "expectedState");
            body.fieldNames().forEachRemaining(field -> {
                if (!fields.contains(field)) throw CampusException.badRequest("模拟控制含未允许的字段");
            });
            String reason = body.path("reason").textValue().trim();
            if (reason.isEmpty() || reason.length() > 500) {
                throw CampusException.badRequest("操作原因需为 1 至 500 个字符");
            }
            return new SwitchRequest(body.path("on").booleanValue(), reason,
                    body.path("expectedState").booleanValue());
        }
    }
}
