package com.letoy.main.user.mapper;

import com.letoy.main.user.entity.UserInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserInfoMapper {

    int createUserInfoByUserInfo(UserInfo userInfo);

    UserInfo getUserInfoByUid(@Param("uid") String uid);

    UserInfo getUserInfoByUsername(@Param("username") String username);

    UserInfo getUserInfoPasswordByUsername(@Param("username") String username);

    UserInfo getUserInfoByPhoneNumber(@Param("phoneNumber") String phoneNumber);

    List<UserInfo> getAllUsers();

    List<UserInfo> queryUserInfoByConditions(
            @Param("username") String username,
            @Param("nickname") String nickname,
            @Param("groupId") String groupId,
            @Param("gender") Integer gender,
            @Param("active") Boolean active
    );

    int updateUserInfoByUidWithUserInfo(UserInfo userInfo);

    int resetUserInfoPassword(@Param("password") String password, @Param("uid") String uid);

    int deleteUserInfoByUid(@Param("uid") String uid);

    Integer getTokenVersionByUid(@Param("uid") String uid);

    int incrementTokenVersion(@Param("uid") String uid);

    int updateLastPasswordChangeAt(@Param("uid") String uid);

    int updateAccountLocked(@Param("uid") String uid, @Param("locked") boolean locked);

    int updatePhoneNumberByUid(@Param("uid") String uid, @Param("phoneNumber") String phoneNumber);

    long countUsers();
}
