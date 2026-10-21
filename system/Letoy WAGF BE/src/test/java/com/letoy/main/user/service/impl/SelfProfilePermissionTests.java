package com.letoy.main.user.service.impl;

import com.letoy.main.auth.mapper.TokenInfoMapper;
import com.letoy.main.auth.service.PrincipalCacheService;
import com.letoy.main.group.service.GroupsInfoService;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.role.mapper.UserRoleMapper;
import com.letoy.main.user.dto.request.UpdateUserInfoRequest;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SelfProfilePermissionTests {
    private UserInfoServiceImpl service(UserInfoMapper users) {
        return new UserInfoServiceImpl(users, mock(TokenInfoMapper.class), mock(UserRoleMapper.class), mock(RoleInfoMapper.class),
                mock(GroupsInfoService.class), mock(PrincipalCacheService.class), new BCryptPasswordEncoder());
    }
    @Test void selfProfileCannotModifyPermissionGroups() {
        UserInfoMapper users = mock(UserInfoMapper.class);
        UpdateUserInfoRequest request = new UpdateUserInfoRequest();
        request.setGroupIds("ROOT");
        assertThrows(IllegalArgumentException.class, () -> service(users).updateCurrentUserInfo("TEST_VIEWER", request));
        verifyNoInteractions(users);
    }
    @Test void safeProfileUpdatesNeverWriteRolesOrGroupIds() {
        UserInfoMapper users = mock(UserInfoMapper.class);
        when(users.getUserInfoByUid("TEST_VIEWER")).thenReturn(UserInfo.builder().uid("TEST_VIEWER")
                .username("TEST_VIEWER").groupIds("BUSINESS").roles("CAMPUS_VIEWER").build());
        UpdateUserInfoRequest request = new UpdateUserInfoRequest();
        request.setNickname("TEST 昵称");
        service(users).updateCurrentUserInfo("TEST_VIEWER", request);
        ArgumentCaptor<UserInfo> update = ArgumentCaptor.forClass(UserInfo.class);
        verify(users).updateUserInfoByUidWithUserInfo(update.capture());
        assertEquals("TEST_VIEWER", update.getValue().getUid());
        assertEquals("TEST 昵称", update.getValue().getNickname());
        assertNull(update.getValue().getGroupIds());
        assertNull(update.getValue().getRoles());
    }
}
