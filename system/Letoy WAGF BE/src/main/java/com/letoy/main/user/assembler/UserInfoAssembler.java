package com.letoy.main.user.assembler;

import com.letoy.main.user.dto.request.CreateUserRequest;
import com.letoy.main.user.dto.request.UpdateUserRequest;
import com.letoy.main.user.entity.UserInfo;

public final class UserInfoAssembler {

    private UserInfoAssembler() {
    }

    public static UserInfo toCreateUser(CreateUserRequest request) {
        UserInfo userInfo = new UserInfo();
        userInfo.setUsername(request.getUsername());
        userInfo.setPassword(request.getPassword());
        userInfo.setPhoneNumber(request.getPhoneNumber());
        userInfo.setEmail(request.getEmail());
        userInfo.setNickname(request.getNickname());
        userInfo.setAvatar(request.getAvatar());
        userInfo.setDescription(request.getDescription());
        userInfo.setGender(request.getGender());
        userInfo.setGroupIds(request.getGroupIds());
        userInfo.setRoles(request.getRoles());
        userInfo.setActive(request.getActive());
        userInfo.setAccountLocked(request.getAccountLocked());
        return userInfo;
    }

    public static UserInfo toUpdateUser(String uid, UpdateUserRequest request) {
        UserInfo userInfo = new UserInfo();
        userInfo.setUid(uid);
        userInfo.setUsername(request.getUsername());
        userInfo.setPhoneNumber(request.getPhoneNumber());
        userInfo.setEmail(request.getEmail());
        userInfo.setNickname(request.getNickname());
        userInfo.setAvatar(request.getAvatar());
        userInfo.setDescription(request.getDescription());
        userInfo.setGender(request.getGender());
        userInfo.setGroupIds(request.getGroupIds());
        userInfo.setRoles(request.getRoles());
        userInfo.setActive(request.getActive());
        userInfo.setAccountLocked(request.getAccountLocked());
        return userInfo;
    }
}
