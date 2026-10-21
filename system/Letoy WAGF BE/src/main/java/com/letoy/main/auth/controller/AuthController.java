package com.letoy.main.auth.controller;

import com.letoy.main.auth.assembler.AuthUserAssembler;
import com.letoy.main.auth.dto.request.BootstrapRequest;
import com.letoy.main.auth.dto.request.LoginRequest;
import com.letoy.main.auth.dto.request.PhoneCodeLoginRequest;
import com.letoy.main.auth.dto.request.TokenRequest;
import com.letoy.main.auth.dto.response.TokenRefreshResponse;
import com.letoy.main.auth.security.JwtProperties;
import com.letoy.main.auth.security.JwtTokenUtil;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.dto.request.PhoneCodeSendRequest;
import com.letoy.main.user.assembler.UserResponseAssembler;
import com.letoy.main.user.dto.response.UserResponse;
import com.letoy.main.auth.service.LoginService;
import com.letoy.main.auth.service.PhoneVerificationCodeService;
import com.letoy.main.user.service.UserInfoService;
import com.letoy.main.auth.service.RefreshTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/auth")
@Tag(name = "Authentication")
public class AuthController {

    private final LoginService loginService;
    private final PhoneVerificationCodeService phoneVerificationCodeService;
    private final RefreshTokenService refreshTokenService;
    private final UserInfoService userInfoService;
    private final JwtTokenUtil jwtTokenUtil;
    private final JwtProperties jwtProperties;

    public AuthController(LoginService loginService,
                          PhoneVerificationCodeService phoneVerificationCodeService,
                          RefreshTokenService refreshTokenService,
                          UserInfoService userInfoService,
                          JwtTokenUtil jwtTokenUtil,
                          JwtProperties jwtProperties) {
        this.loginService = loginService;
        this.phoneVerificationCodeService = phoneVerificationCodeService;
        this.refreshTokenService = refreshTokenService;
        this.userInfoService = userInfoService;
        this.jwtTokenUtil = jwtTokenUtil;
        this.jwtProperties = jwtProperties;
    }

    @PostMapping("/bootstrap")
    @Operation(summary = "Create the first administrator when the system is empty")
    public ApiResponse<UserResponse> bootstrap(@Valid @RequestBody BootstrapRequest request,
                                               HttpServletRequest httpServletRequest) {
        var bootstrapUser = AuthUserAssembler.toBootstrapUser(request);
        userInfoService.bootstrapAdmin(bootstrapUser);
        return ApiResponse.success(UserResponseAssembler.toResponse(
                loginService.login(request.getUsername(), request.getPassword(), httpServletRequest)
        ));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with username and password")
    public ApiResponse<UserResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpServletRequest) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                loginService.login(request.getUsername(), request.getPassword(), httpServletRequest)
        ));
    }

    @PostMapping("/login/phone-code/send")
    @Operation(summary = "Send phone verification code for login")
    public ApiResponse<Void> sendPhoneLoginCode(@Valid @RequestBody PhoneCodeSendRequest request) {
        phoneVerificationCodeService.sendLoginCode(request.getCountryCode(), request.getPhoneNumber());
        return ApiResponse.success();
    }

    @PostMapping("/login/phone-code")
    @Operation(summary = "Login with phone verification code")
    public ApiResponse<UserResponse> loginByPhoneCode(@Valid @RequestBody PhoneCodeLoginRequest request,
                                                      HttpServletRequest httpServletRequest) {
        phoneVerificationCodeService.verifyLoginCode(
                request.getCountryCode(),
                request.getPhoneNumber(),
                request.getCode()
        );
        return ApiResponse.success(UserResponseAssembler.toResponse(
                loginService.loginByPhoneCode(request.getPhoneNumber(), httpServletRequest)
        ));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user")
    public ApiResponse<UserResponse> me(@RequestHeader("Authorization") String token) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.getUserInfoByUid(jwtTokenUtil.getUidFromToken(token))
        ));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token")
    public ApiResponse<TokenRefreshResponse> refreshToken(@Valid @RequestBody TokenRequest request) {
        String accessToken = refreshTokenService.refreshAccessToken(request.getRefreshToken());
        return ApiResponse.success(new TokenRefreshResponse(
                accessToken,
                "Bearer",
                Math.toIntExact(jwtProperties.getAccessTokenExpiration() / 1000)
        ));
    }

    @PostMapping("/revoke")
    @Operation(summary = "Revoke refresh token")
    public ApiResponse<Void> revokeToken(@Valid @RequestBody TokenRequest request) {
        refreshTokenService.revokeRefreshToken(request.getRefreshToken(), "USER_LOGOUT");
        return ApiResponse.success();
    }
}
