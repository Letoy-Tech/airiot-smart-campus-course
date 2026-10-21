package com.letoy.main.aliyun.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendTemplateSmsRequest {

    @NotBlank(message = "Country code is required")
    private String countryCode;

    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    @NotBlank(message = "Template code is required")
    private String templateCode;

    @NotBlank(message = "Template param is required")
    private String templateParam;
}
