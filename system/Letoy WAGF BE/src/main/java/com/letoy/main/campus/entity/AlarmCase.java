package com.letoy.main.campus.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class AlarmCase {
    private String id;
    private String sourceType;
    private String sourceScope;
    private String sourceId;
    private String scenario;
    private boolean simulated;
    private String deviceId;
    private String deviceName;
    private String message;
    private String level;
    private long occurredAt;
    private String sourceState;
    private String sourceRawStatus;
    private Long sourceRecoveredAt;
    private long sourceObservedAt;
    private Long sourceVerifiedAt;
    private String sourceCheckOutcome;
    private String state;
    private String assigneeUid;
    private String assigneeName;
    private long createdAt;
    private long updatedAt;
    private Long closedAt;
    private String disposition;
    private long version;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<AlarmCaseEvent> timeline;
}
