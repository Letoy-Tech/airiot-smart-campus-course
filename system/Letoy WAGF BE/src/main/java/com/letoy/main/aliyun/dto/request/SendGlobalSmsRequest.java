package com.letoy.main.aliyun.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendGlobalSmsRequest {

    @NotBlank(message = "Country code is required")
    private String countryCode;

    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    @NotBlank(message = "Message is required")
    private String message;
}
