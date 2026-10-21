package com.letoy.main.role.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveRoleRequest {
    private String roleCode;

    @NotBlank(message = "Role name is required")
    private String roleName;

    private String description;

    @Min(value = 0, message = "Sort order must be greater than or equal to 0")
    private Integer sortOrder;

    @Min(value = 0, message = "Status must be greater than or equal to 0")
    private Integer status;
}
