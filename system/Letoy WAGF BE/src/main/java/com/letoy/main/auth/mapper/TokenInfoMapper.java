package com.letoy.main.auth.mapper;

import com.letoy.main.auth.entity.TokenInfo;
import com.letoy.main.user.entity.UserInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.springframework.stereotype.Component;

import java.util.List;

@Mapper
@Component
public interface TokenInfoMapper {
    int updateTokenInfo(TokenInfo tokenInfo);
    int cleanToken(String token);
    TokenInfo getTokenInfoByUid(String uid);
    int createNewTokenInfo(TokenInfo tokenInfo);
    int initTokenInfoByUserInfoList(@Param("userInfoList") List<UserInfo> userInfoList);
    int deleteTokenInfoByUid(String userId);
    int cleanAllData();
}
