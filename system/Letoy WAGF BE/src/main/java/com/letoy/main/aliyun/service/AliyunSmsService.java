package com.letoy.main.aliyun.service;

public interface AliyunSmsService {

    void sendTemplateSms(String countryCode, String phoneNumber, String templateCode, String templateParam);

    void sendGlobalSms(String countryCode, String phoneNumber, String message);
}
