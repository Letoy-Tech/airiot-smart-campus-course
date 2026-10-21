package com.letoy.main.user.controller;

import com.github.pagehelper.PageInfo;
import com.letoy.main.auth.security.JwtTokenUtil;
import com.letoy.main.common.assembler.PageResponseAssembler;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.dto.response.PageResponse;
import com.letoy.main.auth.service.PhoneVerificationCodeService;
import com.letoy.main.common.dto.request.PhoneCodeSendRequest;
import com.letoy.main.group.assembler.GroupResponseAssembler;
import com.letoy.main.group.dto.response.GroupResponse;
import com.letoy.main.user.assembler.UserInfoAssembler;
import com.letoy.main.user.assembler.UserOrganizationResponseAssembler;
import com.letoy.main.user.assembler.UserResponseAssembler;
import com.letoy.main.user.dto.request.BindPhoneRequest;
import com.letoy.main.user.dto.request.ChangeOwnPasswordRequest;
import com.letoy.main.user.dto.request.CreateUserRequest;
import com.letoy.main.user.dto.request.ResetPasswordRequest;
import com.letoy.main.user.dto.request.ResetPhoneRequest;
import com.letoy.main.user.dto.request.UpdateUserInfoRequest;
import com.letoy.main.user.dto.request.UpdateStatusRequest;
import com.letoy.main.user.dto.request.UpdateUserRequest;
import com.letoy.main.user.dto.request.UserQueryRequest;
import com.letoy.main.user.dto.response.UserOrganizationResponse;
import com.letoy.main.user.dto.response.UserResponse;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.service.UserInfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/users")
@Tag(name = "User management")
public class UserInfoController {

    private final UserInfoService userInfoService;
    private final PhoneVerificationCodeService phoneVerificationCodeService;
    private final JwtTokenUtil jwtTokenUtil;

    public UserInfoController(UserInfoService userInfoService,
                              PhoneVerificationCodeService phoneVerificationCodeService,
                              JwtTokenUtil jwtTokenUtil) {
        this.userInfoService = userInfoService;
        this.phoneVerificationCodeService = phoneVerificationCodeService;
        this.jwtTokenUtil = jwtTokenUtil;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user")
    public ApiResponse<UserResponse> currentUser(@RequestHeader("Authorization") String token) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.getUserInfoByUid(jwtTokenUtil.getUidFromToken(token))
        ));
    }

    @GetMapping("/organization/all")
    @Operation(summary = "Get all user organization information")
    public ApiResponse<List<UserOrganizationResponse>> getAllUserOrganizations() {
        return ApiResponse.success(userInfoService.getAllUsersWithGroups().stream()
                .map(UserOrganizationResponseAssembler::toResponse)
                .toList());
    }

    @PostMapping("/query")
    @Operation(summary = "Query users")
    public ApiResponse<PageResponse<UserResponse>> query(@Valid @RequestBody UserQueryRequest request) {
        PageInfo<UserInfo> pageInfo = userInfoService.queryUserInfoByConditions(request);
        return ApiResponse.success(PageResponseAssembler.toPageResponse(
                pageInfo,
                UserResponseAssembler::toResponse
        ));
    }

    @GetMapping("/{uid}")
    @Operation(summary = "Get user by uid")
    public ApiResponse<UserResponse> get(@PathVariable String uid) {
        return ApiResponse.success(UserResponseAssembler.toResponse(userInfoService.getUserInfoByUid(uid)));
    }

    @GetMapping("/{uid}/groups")
    @Operation(summary = "Get all groups bound to a user")
    public ApiResponse<List<GroupResponse>> getUserGroups(@PathVariable String uid) {
        return ApiResponse.success(userInfoService.getUserGroups(uid).stream()
                .map(GroupResponseAssembler::toResponse)
                .toList());
    }

    @PostMapping
    @Operation(summary = "Create user")
    public ApiResponse<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.createUser(UserInfoAssembler.toCreateUser(request))
        ));
    }

    @PutMapping("/{uid}")
    @Operation(summary = "Update user")
    public ApiResponse<UserResponse> update(@PathVariable String uid, @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.updateUser(UserInfoAssembler.toUpdateUser(uid, request))
        ));
    }

    @PutMapping("/me/profile")
    @Operation(summary = "Update current user profile")
    public ApiResponse<UserResponse> updateProfile(@RequestHeader("Authorization") String token,
                                                   @Valid @RequestBody UpdateUserInfoRequest request) {
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.updateCurrentUserInfo(jwtTokenUtil.getUidFromToken(token), request)
        ));
    }

    @PutMapping("/me/password")
    @Operation(summary = "Change current user password")
    public ApiResponse<Void> changePassword(@RequestHeader("Authorization") String token,
                                            @Valid @RequestBody ChangeOwnPasswordRequest request) {
        userInfoService.changePassword(
                jwtTokenUtil.getUidFromToken(token),
                request.getOldPassword(),
                request.getNewPassword()
        );
        return ApiResponse.success();
    }

    @PostMapping("/me/phone/bind-code/send")
    @Operation(summary = "Send verification code to bind a phone number")
    public ApiResponse<Void> sendBindPhoneCode(@RequestHeader("Authorization") String token,
                                               @Valid @RequestBody PhoneCodeSendRequest request) {
        phoneVerificationCodeService.sendBindCode(
                jwtTokenUtil.getUidFromToken(token),
                request.getCountryCode(),
                request.getPhoneNumber()
        );
        return ApiResponse.success();
    }

    @PutMapping("/me/phone/bind")
    @Operation(summary = "Bind a phone number with verification code")
    public ApiResponse<UserResponse> bindPhone(@RequestHeader("Authorization") String token,
                                               @Valid @RequestBody BindPhoneRequest request) {
        String uid = jwtTokenUtil.getUidFromToken(token);
        phoneVerificationCodeService.verifyBindCode(uid, request.getCountryCode(), request.getPhoneNumber(), request.getCode());
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.bindPhoneNumber(uid, request.getPhoneNumber())
        ));
    }

    @PostMapping("/me/phone/reset-code/send")
    @Operation(summary = "Send verification code to the current phone before reset")
    public ApiResponse<Void> sendResetPhoneCode(@RequestHeader("Authorization") String token,
                                                @Valid @RequestBody PhoneCodeSendRequest request) {
        phoneVerificationCodeService.sendResetCode(
                jwtTokenUtil.getUidFromToken(token),
                request.getCountryCode(),
                request.getPhoneNumber()
        );
        return ApiResponse.success();
    }

    @PutMapping("/me/phone/reset")
    @Operation(summary = "Reset current phone number")
    public ApiResponse<UserResponse> resetPhone(@RequestHeader("Authorization") String token,
                                                @Valid @RequestBody ResetPhoneRequest request) {
        String uid = jwtTokenUtil.getUidFromToken(token);
        phoneVerificationCodeService.verifyResetCode(uid, request.getCountryCode(), request.getCurrentPhoneNumber(), request.getCode());
        return ApiResponse.success(UserResponseAssembler.toResponse(
                userInfoService.resetPhoneNumber(uid, request.getCurrentPhoneNumber(), request.getNewPhoneNumber())
        ));
    }

    @PutMapping("/{uid}/password")
    @Operation(summary = "Reset user password")
    public ApiResponse<Void> resetPassword(@PathVariable String uid,
                                           @Valid @RequestBody ResetPasswordRequest request) {
        userInfoService.resetPassword(uid, request.getNewPassword());
        return ApiResponse.success();
    }

    @PatchMapping("/{uid}/status")
    @Operation(summary = "Update user status")
    public ApiResponse<Void> updateStatus(@PathVariable String uid,
                                          @Valid @RequestBody UpdateStatusRequest request) {
        userInfoService.updateUserStatus(uid, request.isActive(), request.isAccountLocked());
        return ApiResponse.success();
    }

    @DeleteMapping("/{uid}")
    @Operation(summary = "Delete user")
    public ApiResponse<Void> delete(@PathVariable String uid) {
        userInfoService.deleteUserInfoByUid(uid);
        return ApiResponse.success();
    }
}
