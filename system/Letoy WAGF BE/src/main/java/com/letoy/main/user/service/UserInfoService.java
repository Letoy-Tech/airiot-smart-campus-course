package com.letoy.main.user.service;

import com.github.pagehelper.PageInfo;
import com.letoy.main.group.entity.GroupsInfo;
import com.letoy.main.user.dto.request.UpdateUserInfoRequest;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.dto.request.UserQueryRequest;

import java.util.List;

public interface UserInfoService {

    UserInfo getUserInfoByUid(String uid);

    UserInfo getUserInfoByUsername(String username);

    UserInfo getUserInfoByPhoneNumber(String phoneNumber);

    List<GroupsInfo> getUserGroups(String uid);

    java.util.List<UserInfo> getAllUsersWithGroups();

    PageInfo<UserInfo> queryUserInfoByConditions(UserQueryRequest queryReq);

    UserInfo createUser(UserInfo userInfo);

    UserInfo updateUser(UserInfo userInfo);

    UserInfo updateCurrentUserInfo(String uid, UpdateUserInfoRequest updateReq);

    void changePassword(String uid, String oldPassword, String newPassword);

    void resetPassword(String uid, String newPassword);

    void updateUserStatus(String uid, boolean active, boolean accountLocked);

    UserInfo bindPhoneNumber(String uid, String phoneNumber);

    UserInfo resetPhoneNumber(String uid, String currentPhoneNumber, String newPhoneNumber);

    void deleteUserInfoByUid(String uid);

    UserInfo bootstrapAdmin(UserInfo userInfo);
}
