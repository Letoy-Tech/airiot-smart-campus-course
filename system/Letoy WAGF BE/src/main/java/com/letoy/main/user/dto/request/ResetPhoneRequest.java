package com.letoy.main.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ResetPhoneRequest {

    @NotBlank(message = "Country code is required")
    private String countryCode;

    @NotBlank(message = "Current phone number is required")
    private String currentPhoneNumber;

    @NotBlank(message = "New phone number is required")
    private String newPhoneNumber;

    @NotBlank(message = "Code is required")
    @Pattern(regexp = "\\d{6}", message = "Code must be 6 digits")
    private String code;
}
