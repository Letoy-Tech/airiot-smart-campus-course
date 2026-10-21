package com.letoy.main.campus.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class CommandAudit {
    private String id;
    private String actorId;
    private String actorName;
    private String deviceId;
    private String tableId;
    private Boolean before;
    private Boolean requested;
    private Boolean confirmed;
    private String outcome;
    private String reason;
    private long createdAt;
    private String error;
}
