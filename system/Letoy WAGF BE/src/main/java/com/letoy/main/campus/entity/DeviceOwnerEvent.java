package com.letoy.main.campus.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class DeviceOwnerEvent {
    private String id;
    private String deviceId;
    private String actorUid;
    private String actorName;
    private String note;
    private String previousOwnerUid;
    private String ownerUid;
    private long createdAt;
    private long version;
}
