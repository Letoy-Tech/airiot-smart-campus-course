package com.letoy.main.user.assembler;

import com.letoy.main.group.assembler.GroupResponseAssembler;
import com.letoy.main.group.dto.response.GroupResponse;
import com.letoy.main.user.dto.response.UserResponse;
import com.letoy.main.user.entity.UserInfo;

import java.util.List;

public final class UserResponseAssembler {

    private UserResponseAssembler() {
    }

    public static UserResponse toResponse(UserInfo userInfo) {
        if (userInfo == null) {
            return null;
        }
        List<GroupResponse> groups = userInfo.getGroups() == null ? null : userInfo.getGroups().stream()
                .map(GroupResponseAssembler::toResponse)
                .toList();
        return UserResponse.builder()
                .uid(userInfo.getUid())
                .username(userInfo.getUsername())
                .phoneNumber(userInfo.getPhoneNumber())
                .email(userInfo.getEmail())
                .nickname(userInfo.getNickname())
                .avatar(userInfo.getAvatar())
                .description(userInfo.getDescription())
                .gender(userInfo.getGender())
                .groupIds(userInfo.getGroupIds())
                .roles(userInfo.getRoles())
                .active(userInfo.getActive())
                .token(userInfo.getToken())
                .refreshToken(userInfo.getRefreshToken())
                .createTime(userInfo.getCreateTime())
                .tokenVersion(userInfo.getTokenVersion())
                .lastPasswordChangeAt(userInfo.getLastPasswordChangeAt())
                .accountLocked(userInfo.getAccountLocked())
                .groups(groups)
                .build();
    }
}
