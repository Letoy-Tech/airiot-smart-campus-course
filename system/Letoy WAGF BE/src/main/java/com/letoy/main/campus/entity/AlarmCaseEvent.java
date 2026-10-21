package com.letoy.main.campus.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class AlarmCaseEvent {
    private String id;
    private String caseId;
    private String action;
    private String actorUid;
    private String actorName;
    private String note;
    private String fromState;
    private String toState;
    private String previousAssigneeUid;
    private String assigneeUid;
    private String sourceState;
    private long createdAt;
    private long caseVersion;
}
