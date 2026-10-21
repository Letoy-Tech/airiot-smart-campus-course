package com.letoy.main.aliyun.service.impl;

import com.aliyun.auth.credentials.Credential;
import com.aliyun.auth.credentials.provider.StaticCredentialProvider;
import com.aliyun.sdk.service.dysmsapi20170525.AsyncClient;
import com.aliyun.sdk.service.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.sdk.service.dysmsapi20170525.models.SendSmsResponse;
import com.aliyuncs.CommonRequest;
import com.aliyuncs.CommonResponse;
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.exceptions.ClientException;
import com.aliyuncs.http.MethodType;
import com.aliyuncs.profile.DefaultProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.letoy.main.aliyun.config.AliyunProperties;
import com.letoy.main.common.exception.SystemException;
import com.letoy.main.aliyun.service.AliyunSmsService;
import darabonba.core.client.ClientOverrideConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.concurrent.ExecutionException;

@Service
public class AliyunSmsServiceImpl implements AliyunSmsService {

    private static final Logger log = LoggerFactory.getLogger(AliyunSmsServiceImpl.class);

    private final AliyunProperties aliyunProperties;
    private final ObjectMapper objectMapper;

    public AliyunSmsServiceImpl(AliyunProperties aliyunProperties, ObjectMapper objectMapper) {
        this.aliyunProperties = aliyunProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public void sendTemplateSms(String countryCode, String phoneNumber, String templateCode, String templateParam) {
        ensureConfigured();
        if (!StringUtils.hasText(templateCode)) {
            throw new SystemException("Aliyun SMS template code is required");
        }
        if (!StringUtils.hasText(aliyunProperties.getSmsSignName())) {
            throw new SystemException("Aliyun SMS sign name is not configured");
        }

        StaticCredentialProvider provider = StaticCredentialProvider.create(Credential.builder()
                .accessKeyId(aliyunProperties.getAccessKeyId())
                .accessKeySecret(aliyunProperties.getAccessKeySecret())
                .build());

        AsyncClient client = AsyncClient.builder()
                .region(aliyunProperties.getSmsRegion())
                .credentialsProvider(provider)
                .overrideConfiguration(ClientOverrideConfiguration.create()
                        .setEndpointOverride(aliyunProperties.getSmsEndpoint()))
                .build();

        try {
            SendSmsRequest request = SendSmsRequest.builder()
                    .signName(aliyunProperties.getSmsSignName())
                    .templateCode(templateCode)
                    .phoneNumbers(countryCode + phoneNumber)
                    .templateParam(templateParam)
                    .build();
            SendSmsResponse response = client.sendSms(request).get();
            JsonNode body = objectMapper.valueToTree(response).path("body");
            String code = readText(body, "code", "Code");
            if ("isv.BUSINESS_LIMIT_CONTROL".equals(code)) {
                throw new SystemException("server_error.send_sms_to_limit");
            }
            if (!"OK".equals(code)) {
                throw new SystemException("server_error.send_sms_fail");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new SystemException("Aliyun SMS request interrupted");
        } catch (ExecutionException exception) {
            log.error("Aliyun template SMS request failed", exception);
            throw new SystemException("server_error.send_sms_fail");
        } finally {
            client.close();
        }
    }

    @Override
    public void sendGlobalSms(String countryCode, String phoneNumber, String message) {
        ensureConfigured();
        if (!StringUtils.hasText(message)) {
            throw new SystemException("Aliyun global SMS message is required");
        }

        DefaultProfile profile = DefaultProfile.getProfile(
                aliyunProperties.getGlobalSmsRegion(),
                aliyunProperties.getAccessKeyId(),
                aliyunProperties.getAccessKeySecret()
        );
        IAcsClient client = new DefaultAcsClient(profile);

        CommonRequest request = new CommonRequest();
        request.setSysMethod(MethodType.POST);
        request.setSysDomain(aliyunProperties.getGlobalSmsDomain());
        request.setSysVersion("2017-05-25");
        request.setSysAction("SendMessageToGlobe");
        request.putQueryParameter("To", countryCode.replace("+", "") + phoneNumber);
        request.putQueryParameter("Message", message);
        request.putQueryParameter("Type", "OTP");

        try {
            CommonResponse response = client.getCommonResponse(request);
            JsonNode body = objectMapper.readTree(response.getData());
            String code = readText(body, "code", "Code");
            if (!"OK".equals(code)) {
                throw new SystemException("server_error.send_sms_fail");
            }
        } catch (ClientException | IOException exception) {
            log.error("Aliyun global SMS request failed", exception);
            throw new SystemException("server_error.send_sms_fail");
        }
    }

    private void ensureConfigured() {
        if (!StringUtils.hasText(aliyunProperties.getAccessKeyId())
                || !StringUtils.hasText(aliyunProperties.getAccessKeySecret())) {
            throw new SystemException("Aliyun SMS is not configured");
        }
    }

    private String readText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode valueNode = node.path(fieldName);
            if (!valueNode.isMissingNode() && !valueNode.isNull()) {
                String value = valueNode.asText();
                if (StringUtils.hasText(value)) {
                    return value;
                }
            }
        }
        return "";
    }
}
