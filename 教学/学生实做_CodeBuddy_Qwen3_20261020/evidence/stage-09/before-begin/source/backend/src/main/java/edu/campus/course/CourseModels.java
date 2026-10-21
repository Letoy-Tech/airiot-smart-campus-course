package edu.campus.course;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

public final class CourseModels {
    private CourseModels() {}

    public record Campus(String id, String name) {}

    public record Building(String id, String campusId, String name) {}

    public record Binding(String spaceId, String buildingId, String floor) {}

    public record UserState(String uid, boolean enabled, String roles) {}

    public static class AlarmCase {
        public String id;
        public String sourceType;
        public String sourceScope;
        public String sourceId;
        public String scenario;
        public String deviceId;
        public String deviceName;
        public String message;
        public String level;
        public String sourceState;
        public String sourceRawStatus;
        public String sourceCheckOutcome;
        public String state;
        public String assigneeUid;
        public String assigneeName;
        public String disposition;
        public Long occurredAt;
        public Long sourceRecoveredAt;
        public Long sourceObservedAt;
        public Long sourceVerifiedAt;
        public Long createdAt;
        public Long updatedAt;
        public Long closedAt;
        public boolean simulated = true;
        public long version;

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public List<CaseEvent> timeline;
    }

    public static class CaseEvent {
        public String id;
        public String caseId;
        public String action;
        public String actorUid;
        public String actorName;
        public String note;
        public String fromState;
        public String toState;
        public String previousAssigneeUid;
        public String assigneeUid;
        public String sourceState;
        public long createdAt;
        public long caseVersion;
    }

    public static class Owner {
        public String deviceId;
        public String ownerUid;
        public String ownerName;
        public long version;
        public Long updatedAt;

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public List<OwnerEvent> timeline;
    }

    public static class OwnerEvent {
        public String id;
        public String deviceId;
        public String actorUid;
        public String actorName;
        public String note;
        public String previousOwnerUid;
        public String ownerUid;
        public long createdAt;
        public long version;
    }
}
