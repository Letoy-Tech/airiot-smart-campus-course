package com.letoy.main.aliyun.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "aliyun")
public class AliyunProperties {

    private String accessKeyId;
    private String accessKeySecret;
    private String smsSignName;
    private String smsRegion = "cn-hongkong";
    private String smsEndpoint = "dysmsapi.aliyuncs.com";
    private String globalSmsRegion = "cn-hangzhou";
    private String globalSmsDomain = "dysmsapi.aliyuncs.com";
    private String captchaEndpoint = "captcha.cn-shanghai.aliyuncs.com";
    private String captchaSceneId;
    private String loginTemplateCode;
    private String bindPhoneTemplateCode;
    private String resetPhoneTemplateCode;
    private Integer connectTimeout = 5000;
    private Integer readTimeout = 5000;
}
