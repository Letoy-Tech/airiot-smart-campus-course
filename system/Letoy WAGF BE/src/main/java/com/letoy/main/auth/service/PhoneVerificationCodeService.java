package com.letoy.main.auth.service;

public interface PhoneVerificationCodeService {

    void sendLoginCode(String countryCode, String phoneNumber);

    void sendBindCode(String uid, String countryCode, String phoneNumber);

    void sendResetCode(String uid, String countryCode, String phoneNumber);

    void verifyLoginCode(String countryCode, String phoneNumber, String code);

    void verifyBindCode(String uid, String countryCode, String phoneNumber, String code);

    void verifyResetCode(String uid, String countryCode, String phoneNumber, String code);
}
