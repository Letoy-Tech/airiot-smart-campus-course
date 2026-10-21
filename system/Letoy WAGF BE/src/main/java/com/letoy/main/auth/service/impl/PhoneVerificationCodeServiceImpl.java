package com.letoy.main.auth.service.impl;

import com.letoy.main.aliyun.config.AliyunProperties;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.common.exception.MyAuthenticationException;
import com.letoy.main.common.exception.SystemException;
import com.letoy.main.aliyun.service.AliyunSmsService;
import com.letoy.main.auth.service.PhoneVerificationCodeService;
import com.letoy.main.user.service.UserInfoService;
import com.letoy.main.common.util.RandomUtil;
import com.letoy.main.common.util.RedisUtil;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class PhoneVerificationCodeServiceImpl implements PhoneVerificationCodeService {

    private static final long CODE_TTL_SECONDS = 300L;
    private static final String LOGIN_CODE_PREFIX = "PHONE_CODE:LOGIN:";
    private static final String BIND_CODE_PREFIX = "PHONE_CODE:BIND:";
    private static final String RESET_CODE_PREFIX = "PHONE_CODE:RESET:";

    private final RedisUtil redisUtil;
    private final UserInfoService userInfoService;
    private final AliyunSmsService aliyunSmsService;
    private final AliyunProperties aliyunProperties;

    public PhoneVerificationCodeServiceImpl(RedisUtil redisUtil,
                                            UserInfoService userInfoService,
                                            AliyunSmsService aliyunSmsService,
                                            AliyunProperties aliyunProperties) {
        this.redisUtil = redisUtil;
        this.userInfoService = userInfoService;
        this.aliyunSmsService = aliyunSmsService;
        this.aliyunProperties = aliyunProperties;
    }

    @Override
    public void sendLoginCode(String countryCode, String phoneNumber) {
        validatePhoneInput(countryCode, phoneNumber);
        if (userInfoService.getUserInfoByPhoneNumber(phoneNumber) == null) {
            throw new SystemException("Phone number does not exist");
        }
        sendCode(buildLoginKey(countryCode, phoneNumber), countryCode, phoneNumber,
                aliyunProperties.getLoginTemplateCode(),
                "Your login verification code is %s.");
    }

    @Override
    public void sendBindCode(String uid, String countryCode, String phoneNumber) {
        validatePhoneInput(countryCode, phoneNumber);
        UserInfo existing = userInfoService.getUserInfoByPhoneNumber(phoneNumber);
        if (existing != null && !existing.getUid().equals(uid)) {
            throw new SystemException("Phone number already exists");
        }
        sendCode(buildBindKey(uid, countryCode, phoneNumber), countryCode, phoneNumber,
                aliyunProperties.getBindPhoneTemplateCode(),
                "Your phone binding verification code is %s.");
    }

    @Override
    public void sendResetCode(String uid, String countryCode, String phoneNumber) {
        validatePhoneInput(countryCode, phoneNumber);
        UserInfo currentUser = userInfoService.getUserInfoByUid(uid);
        if (!phoneNumber.equals(currentUser.getPhoneNumber())) {
            throw new SystemException("Current phone number does not match");
        }
        sendCode(buildResetKey(uid, countryCode, phoneNumber), countryCode, phoneNumber,
                aliyunProperties.getResetPhoneTemplateCode(),
                "Your phone reset verification code is %s.");
    }

    @Override
    public void verifyLoginCode(String countryCode, String phoneNumber, String code) {
        verifyAndConsume(buildLoginKey(countryCode, phoneNumber), code);
    }

    @Override
    public void verifyBindCode(String uid, String countryCode, String phoneNumber, String code) {
        verifyAndConsume(buildBindKey(uid, countryCode, phoneNumber), code);
    }

    @Override
    public void verifyResetCode(String uid, String countryCode, String phoneNumber, String code) {
        verifyAndConsume(buildResetKey(uid, countryCode, phoneNumber), code);
    }

    private void sendCode(String redisKey,
                          String countryCode,
                          String phoneNumber,
                          String templateCode,
                          String globalMessageTemplate) {
        String code = RandomUtil.getCode();
        redisUtil.set(redisKey, code, CODE_TTL_SECONDS);

        if ("+86".equals(countryCode)) {
            if (!StringUtils.hasText(templateCode)) {
                throw new SystemException("Aliyun SMS template code is not configured");
            }
            aliyunSmsService.sendTemplateSms(countryCode, phoneNumber, templateCode, "{\"code\":\"" + code + "\"}");
            return;
        }

        aliyunSmsService.sendGlobalSms(countryCode, phoneNumber, String.format(globalMessageTemplate, code));
    }

    private void verifyAndConsume(String redisKey, String code) {
        if (!StringUtils.hasText(code)) {
            throw new MyAuthenticationException("Verification code is required");
        }
        Object cached = redisUtil.get(redisKey);
        if (!(cached instanceof String cachedCode) || !code.equals(cachedCode)) {
            throw new MyAuthenticationException("Phone number or verification code is incorrect");
        }
        redisUtil.del(redisKey);
    }

    private String buildLoginKey(String countryCode, String phoneNumber) {
        return LOGIN_CODE_PREFIX + normalize(countryCode) + ":" + normalize(phoneNumber);
    }

    private String buildBindKey(String uid, String countryCode, String phoneNumber) {
        return BIND_CODE_PREFIX + uid + ":" + normalize(countryCode) + ":" + normalize(phoneNumber);
    }

    private String buildResetKey(String uid, String countryCode, String phoneNumber) {
        return RESET_CODE_PREFIX + uid + ":" + normalize(countryCode) + ":" + normalize(phoneNumber);
    }

    private void validatePhoneInput(String countryCode, String phoneNumber) {
        if (!StringUtils.hasText(countryCode)) {
            throw new SystemException("Country code is required");
        }
        if (!StringUtils.hasText(phoneNumber)) {
            throw new SystemException("Phone number is required");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
