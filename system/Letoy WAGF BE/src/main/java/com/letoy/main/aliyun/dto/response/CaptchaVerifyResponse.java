package com.letoy.main.aliyun.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CaptchaVerifyResponse {
    private boolean verified;
}
