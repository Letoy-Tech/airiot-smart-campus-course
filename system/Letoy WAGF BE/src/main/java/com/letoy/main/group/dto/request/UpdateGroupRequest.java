package com.letoy.main.group.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateGroupRequest {
    private String groupName;
    private String groupDescription;
    private String parentGroupId;

    @Min(value = 0, message = "Sort order must be greater than or equal to 0")
    private Integer sortOrder;

    @Min(value = 0, message = "Status must be greater than or equal to 0")
    private Integer status;
}
