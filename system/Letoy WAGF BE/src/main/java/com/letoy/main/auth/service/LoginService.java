package com.letoy.main.auth.service;

import com.letoy.main.user.entity.UserInfo;
import jakarta.servlet.http.HttpServletRequest;

public interface LoginService {

    UserInfo login(String username, String password, HttpServletRequest request);

    UserInfo loginByPhoneCode(String phoneNumber, HttpServletRequest request);
}
