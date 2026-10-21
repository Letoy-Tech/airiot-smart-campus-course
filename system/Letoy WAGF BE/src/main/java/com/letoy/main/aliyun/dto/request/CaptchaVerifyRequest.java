package com.letoy.main.aliyun.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CaptchaVerifyRequest {

    @NotBlank(message = "Captcha verify param is required")
    private String captchaVerifyParam;
}
