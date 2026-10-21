package com.letoy.main.auth.service.impl;

import com.letoy.main.auth.mapper.TokenInfoMapper;
import com.letoy.main.behavior.support.UserBehaviorLogContext;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.auth.entity.RefreshToken;
import com.letoy.main.auth.entity.TokenInfo;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.common.exception.MyAuthenticationException;
import com.letoy.main.auth.service.LoginService;
import com.letoy.main.auth.service.RefreshTokenService;
import com.letoy.main.auth.security.JwtTokenUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;

@Service
public class LoginServiceImpl implements LoginService {

    private final UserInfoMapper userInfoMapper;
    private final TokenInfoMapper tokenInfoMapper;
    private final JwtTokenUtil jwtTokenUtil;
    private final RefreshTokenService refreshTokenService;
    private final BCryptPasswordEncoder passwordEncoder;

    public LoginServiceImpl(UserInfoMapper userInfoMapper,
                            TokenInfoMapper tokenInfoMapper,
                            JwtTokenUtil jwtTokenUtil,
                            RefreshTokenService refreshTokenService,
                            BCryptPasswordEncoder passwordEncoder) {
        this.userInfoMapper = userInfoMapper;
        this.tokenInfoMapper = tokenInfoMapper;
        this.jwtTokenUtil = jwtTokenUtil;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public UserInfo login(String username, String password, HttpServletRequest request) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new MyAuthenticationException("Username or password is empty");
        }

        UserInfo userInfo = userInfoMapper.getUserInfoPasswordByUsername(username);
        if (userInfo == null || userInfo.getPassword() == null || !passwordEncoder.matches(password, userInfo.getPassword())) {
            throw new MyAuthenticationException("Username or password is incorrect");
        }
        return issueLoginTokens(userInfo, request);
    }

    @Override
    @Transactional
    public UserInfo loginByPhoneCode(String phoneNumber, HttpServletRequest request) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new MyAuthenticationException("Phone number is empty");
        }
        UserInfo userInfo = userInfoMapper.getUserInfoByPhoneNumber(phoneNumber);
        if (userInfo == null) {
            throw new MyAuthenticationException("Phone number or verification code is incorrect");
        }
        return issueLoginTokens(userInfo, request);
    }

    private UserInfo issueLoginTokens(UserInfo userInfo, HttpServletRequest request) {
        if (Boolean.FALSE.equals(userInfo.getActive())) {
            throw new MyAuthenticationException("User is disabled");
        }
        if (Boolean.TRUE.equals(userInfo.getAccountLocked())) {
            throw new MyAuthenticationException("User is locked");
        }

        request.setAttribute(UserBehaviorLogContext.ATTR_UID, userInfo.getUid());
        request.setAttribute(UserBehaviorLogContext.ATTR_USERNAME, userInfo.getUsername());

        String accessToken = jwtTokenUtil.generateEnhancedAccessToken(userInfo);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(
                userInfo.getUid(),
                jwtTokenUtil.getJtiFromToken(accessToken),
                request
        );

        TokenInfo tokenInfo = new TokenInfo(userInfo.getUid(), accessToken, userInfo.getUsername());
        if (tokenInfoMapper.updateTokenInfo(tokenInfo) == 0) {
            tokenInfoMapper.createNewTokenInfo(tokenInfo);
        }

        UserInfo response = userInfoMapper.getUserInfoByUid(userInfo.getUid());
        response.setToken(accessToken);
        response.setRefreshToken(refreshToken.getRefreshToken());
        return response;
    }
}
