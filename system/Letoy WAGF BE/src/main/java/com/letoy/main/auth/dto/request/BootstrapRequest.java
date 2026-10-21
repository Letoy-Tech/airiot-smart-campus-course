package com.letoy.main.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BootstrapRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    private String nickname;

    @Email(message = "Email format is invalid")
    private String email;

    private String phoneNumber;
    private String groupIds;
    private String roles;
}
