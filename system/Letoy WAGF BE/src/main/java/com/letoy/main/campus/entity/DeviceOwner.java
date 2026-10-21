package com.letoy.main.campus.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class DeviceOwner {
    private String deviceId;
    private String ownerUid;
    private String ownerName;
    private long version;
    private Long updatedAt;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<DeviceOwnerEvent> timeline;
}
