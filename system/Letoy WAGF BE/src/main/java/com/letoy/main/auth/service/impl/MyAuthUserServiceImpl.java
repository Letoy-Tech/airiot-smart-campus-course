package com.letoy.main.auth.service.impl;

import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.auth.service.MyAuthUserService;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import com.letoy.main.role.mapper.RoleInfoMapper;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MyAuthUserServiceImpl implements MyAuthUserService {

    private final UserInfoMapper userInfoMapper;
    private final RoleInfoMapper roleInfoMapper;

    public MyAuthUserServiceImpl(UserInfoMapper userInfoMapper, RoleInfoMapper roleInfoMapper) {
        this.userInfoMapper = userInfoMapper;
        this.roleInfoMapper = roleInfoMapper;
    }

    @Override
    public AuthUser getUserByUserId(String userId) {
        UserInfo user = userInfoMapper.getUserInfoByUid(userId);
        if (user == null) {
            return null;
        }

        AuthUser authUser = new AuthUser();
        authUser.setId(user.getUid());
        authUser.setUsername(user.getUsername());
        authUser.setPhoneNumber(user.getPhoneNumber());
        authUser.setPassword(user.getPassword());
        authUser.setState(Boolean.TRUE.equals(user.getActive()) ? 1 : 0);
        authUser.setAccountLocked(user.getAccountLocked());

        Collection<GrantedAuthority> authorities = new ArrayList<>();
        Set<String> enabledRoles = roleInfoMapper.selectAll(null, 1).stream()
                .filter(role -> Integer.valueOf(1).equals(role.getStatus()))
                .map(com.letoy.main.role.entity.RoleInfo::getRoleCode).collect(Collectors.toSet());
        for (String role : user.getRoleList()) {
            if (!enabledRoles.contains(role)) continue;
            String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
            authorities.add(new SimpleGrantedAuthority(authority));
        }
        authUser.setAuthorities(authorities);
        return authUser;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserInfo user = userInfoMapper.getUserInfoPasswordByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("User not found");
        }
        return getUserByUserId(user.getUid());
    }
}
