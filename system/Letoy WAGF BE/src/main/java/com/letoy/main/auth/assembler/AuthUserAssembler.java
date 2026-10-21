package com.letoy.main.auth.assembler;

import com.letoy.main.auth.dto.request.BootstrapRequest;
import com.letoy.main.user.entity.UserInfo;

public final class AuthUserAssembler {

    private AuthUserAssembler() {
    }

    public static UserInfo toBootstrapUser(BootstrapRequest request) {
        UserInfo userInfo = new UserInfo();
        userInfo.setUsername(request.getUsername());
        userInfo.setPassword(request.getPassword());
        userInfo.setNickname(request.getNickname());
        userInfo.setEmail(request.getEmail());
        userInfo.setPhoneNumber(request.getPhoneNumber());
        userInfo.setGroupIds(request.getGroupIds());
        userInfo.setRoles(request.getRoles());
        return userInfo;
    }
}
