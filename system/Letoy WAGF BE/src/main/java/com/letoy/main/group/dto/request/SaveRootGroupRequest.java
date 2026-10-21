package com.letoy.main.group.dto.request;

import com.letoy.main.group.entity.GroupsInfo;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveRootGroupRequest {

    @NotBlank(message = "Group ID is required")
    private String groupId;

    @NotBlank(message = "Group name is required")
    private String groupName;

    private String groupDescription;

    @Min(value = 0, message = "Sort order must be greater than or equal to 0")
    private Integer sortOrder = 0;

    @Min(value = 0, message = "Status must be greater than or equal to 0")
    private Integer status = GroupsInfo.STATUS_ENABLED;
}
