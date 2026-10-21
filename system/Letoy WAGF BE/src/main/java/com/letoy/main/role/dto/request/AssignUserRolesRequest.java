package com.letoy.main.role.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class AssignUserRolesRequest {

    @NotEmpty(message = "Role codes are required")
    private List<@NotBlank(message = "Role code cannot be blank") String> roleCodes;
}
