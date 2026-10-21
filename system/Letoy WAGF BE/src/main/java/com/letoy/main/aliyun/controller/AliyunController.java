package com.letoy.main.aliyun.controller;

import com.letoy.main.aliyun.dto.request.CaptchaVerifyRequest;
import com.letoy.main.aliyun.dto.request.SendGlobalSmsRequest;
import com.letoy.main.aliyun.dto.request.SendTemplateSmsRequest;
import com.letoy.main.aliyun.dto.response.CaptchaVerifyResponse;
import com.letoy.main.common.annotation.RequestLimit;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.aliyun.service.AliyunCaptchaService;
import com.letoy.main.aliyun.service.AliyunSmsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/aliyun")
@Tag(name = "Aliyun integration")
public class AliyunController {

    private final AliyunCaptchaService aliyunCaptchaService;
    private final AliyunSmsService aliyunSmsService;

    public AliyunController(AliyunCaptchaService aliyunCaptchaService, AliyunSmsService aliyunSmsService) {
        this.aliyunCaptchaService = aliyunCaptchaService;
        this.aliyunSmsService = aliyunSmsService;
    }

    @RequestLimit(count = 1, time = 60)
    @PostMapping("/captcha/verify")
    @Operation(summary = "Verify Aliyun captcha")
    public ApiResponse<CaptchaVerifyResponse> captchaVerify(@Valid @RequestBody CaptchaVerifyRequest request) {
        return ApiResponse.success(new CaptchaVerifyResponse(
                aliyunCaptchaService.verify(request.getCaptchaVerifyParam())
        ));
    }

    @PostMapping("/sms/template")
    @Operation(summary = "Send Aliyun template SMS")
    public ApiResponse<Void> sendTemplateSms(@Valid @RequestBody SendTemplateSmsRequest request) {
        aliyunSmsService.sendTemplateSms(
                request.getCountryCode(),
                request.getPhoneNumber(),
                request.getTemplateCode(),
                request.getTemplateParam()
        );
        return ApiResponse.success();
    }

    @PostMapping("/sms/global")
    @Operation(summary = "Send Aliyun global SMS")
    public ApiResponse<Void> sendGlobalSms(@Valid @RequestBody SendGlobalSmsRequest request) {
        aliyunSmsService.sendGlobalSms(
                request.getCountryCode(),
                request.getPhoneNumber(),
                request.getMessage()
        );
        return ApiResponse.success();
    }
}
