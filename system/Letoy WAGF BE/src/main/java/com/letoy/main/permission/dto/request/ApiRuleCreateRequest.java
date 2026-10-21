package com.letoy.main.permission.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApiRuleCreateRequest {

    @NotBlank(message = "Rule name is required")
    private String name;

    @NotBlank(message = "Pattern is required")
    private String pattern;

    private String methods;
    private String groupPolicy = "ANY";
    private String allowedGroupIds;
    private String groupIdPathVar;
    private String userIdPathVar;

    @Min(value = 0, message = "Priority must be greater than or equal to 0")
    private Integer priority = 0;

    private Boolean enabled = true;
}
