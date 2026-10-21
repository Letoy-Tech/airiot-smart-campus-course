package com.letoy.main.aliyun.service.impl;

import com.aliyun.captcha20230305.Client;
import com.aliyun.captcha20230305.models.VerifyIntelligentCaptchaRequest;
import com.aliyun.captcha20230305.models.VerifyIntelligentCaptchaResponse;
import com.aliyun.tea.TeaException;
import com.aliyun.teaopenapi.models.Config;
import com.letoy.main.aliyun.config.AliyunProperties;
import com.letoy.main.common.exception.SystemException;
import com.letoy.main.aliyun.service.AliyunCaptchaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AliyunCaptchaServiceImpl implements AliyunCaptchaService {

    private static final Logger log = LoggerFactory.getLogger(AliyunCaptchaServiceImpl.class);

    private final AliyunProperties aliyunProperties;

    public AliyunCaptchaServiceImpl(AliyunProperties aliyunProperties) {
        this.aliyunProperties = aliyunProperties;
    }

    @Override
    public boolean verify(String captchaVerifyParam) {
        ensureConfigured();

        Config config = new Config();
        config.accessKeyId = aliyunProperties.getAccessKeyId();
        config.accessKeySecret = aliyunProperties.getAccessKeySecret();
        config.endpoint = aliyunProperties.getCaptchaEndpoint();
        config.connectTimeout = aliyunProperties.getConnectTimeout();
        config.readTimeout = aliyunProperties.getReadTimeout();

        try {
            Client client = new Client(config);
            VerifyIntelligentCaptchaRequest request = new VerifyIntelligentCaptchaRequest();
            request.sceneId = aliyunProperties.getCaptchaSceneId();
            request.captchaVerifyParam = captchaVerifyParam;

            VerifyIntelligentCaptchaResponse response = client.verifyIntelligentCaptcha(request);
            return response != null
                    && response.getBody() != null
                    && response.getBody().getResult() != null
                    && Boolean.TRUE.equals(response.getBody().getResult().getVerifyResult());
        } catch (TeaException exception) {
            log.error("Aliyun captcha verification failed: {}", exception.getMessage(), exception);
            return true;
        } catch (Exception exception) {
            log.error("Aliyun captcha verification error", exception);
            return true;
        }
    }

    private void ensureConfigured() {
        if (!StringUtils.hasText(aliyunProperties.getAccessKeyId())
                || !StringUtils.hasText(aliyunProperties.getAccessKeySecret())
                || !StringUtils.hasText(aliyunProperties.getCaptchaSceneId())) {
            throw new SystemException("Aliyun captcha is not configured");
        }
    }
}
