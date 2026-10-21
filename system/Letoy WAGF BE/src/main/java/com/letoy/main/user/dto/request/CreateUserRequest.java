package com.letoy.main.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateUserRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    private String phoneNumber;

    @Email(message = "Email format is invalid")
    private String email;

    private String nickname;
    private String avatar;
    private String description;
    private Integer gender;
    private String groupIds;
    private String roles;
    private Boolean active;
    private Boolean accountLocked;
}
