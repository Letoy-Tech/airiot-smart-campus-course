package com.letoy.main.user.assembler;

import com.letoy.main.group.assembler.GroupResponseAssembler;
import com.letoy.main.group.dto.response.GroupResponse;
import com.letoy.main.user.dto.response.UserOrganizationResponse;
import com.letoy.main.user.entity.UserInfo;

import java.util.List;

public final class UserOrganizationResponseAssembler {

    private UserOrganizationResponseAssembler() {
    }

    public static UserOrganizationResponse toResponse(UserInfo userInfo) {
        if (userInfo == null) {
            return null;
        }
        List<GroupResponse> groups = userInfo.getGroups() == null ? List.of() : userInfo.getGroups().stream()
                .map(GroupResponseAssembler::toResponse)
                .toList();
        return UserOrganizationResponse.builder()
                .uid(userInfo.getUid())
                .username(userInfo.getUsername())
                .nickname(userInfo.getNickname())
                .groupIds(userInfo.getGroupIds())
                .roles(userInfo.getRoles())
                .active(userInfo.getActive())
                .accountLocked(userInfo.getAccountLocked())
                .groups(groups)
                .build();
    }
}
