package com.letoy.main.user.service.impl;

import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import com.letoy.main.group.entity.GroupsInfo;
import com.letoy.main.group.service.GroupsInfoService;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.auth.mapper.TokenInfoMapper;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.role.mapper.UserRoleMapper;
import com.letoy.main.auth.entity.TokenInfo;
import com.letoy.main.user.dto.request.UpdateUserInfoRequest;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.dto.request.UserQueryRequest;
import com.letoy.main.common.exception.SystemException;
import com.letoy.main.user.service.UserInfoService;
import com.letoy.main.auth.service.PrincipalCacheService;
import com.letoy.main.common.util.RandomUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserInfoServiceImpl implements UserInfoService {

    private static final String DEFAULT_ROLE = "USER";

    private final UserInfoMapper userInfoMapper;
    private final TokenInfoMapper tokenInfoMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleInfoMapper roleInfoMapper;
    private final GroupsInfoService groupsInfoService;
    private final PrincipalCacheService principalCacheService;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserInfoServiceImpl(UserInfoMapper userInfoMapper,
                               TokenInfoMapper tokenInfoMapper,
                               UserRoleMapper userRoleMapper,
                               RoleInfoMapper roleInfoMapper,
                               GroupsInfoService groupsInfoService,
                               PrincipalCacheService principalCacheService,
                               BCryptPasswordEncoder passwordEncoder) {
        this.userInfoMapper = userInfoMapper;
        this.tokenInfoMapper = tokenInfoMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleInfoMapper = roleInfoMapper;
        this.groupsInfoService = groupsInfoService;
        this.principalCacheService = principalCacheService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public UserInfo getUserInfoByUid(String uid) {
        UserInfo userInfo = userInfoMapper.getUserInfoByUid(uid);
        if (userInfo == null) {
            throw new SystemException("User does not exist");
        }
        return userInfo;
    }

    @Override
    public UserInfo getUserInfoByUsername(String username) {
        return userInfoMapper.getUserInfoByUsername(username);
    }

    @Override
    public UserInfo getUserInfoByPhoneNumber(String phoneNumber) {
        return userInfoMapper.getUserInfoByPhoneNumber(phoneNumber);
    }

    @Override
    public List<GroupsInfo> getUserGroups(String uid) {
        UserInfo userInfo = getUserInfoByUid(uid);
        return groupsInfoService.getByGroupIds(userInfo.getGroupIdList());
    }

    @Override
    public List<UserInfo> getAllUsersWithGroups() {
        return enrichUsersWithGroups(userInfoMapper.getAllUsers());
    }

    @Override
    public PageInfo<UserInfo> queryUserInfoByConditions(UserQueryRequest queryReq) {
        int currentPage = queryReq.getCurrentPage() == null || queryReq.getCurrentPage() < 1 ? 1 : queryReq.getCurrentPage();
        int pageSize = queryReq.getPageSize() == null || queryReq.getPageSize() < 1 ? 10 : queryReq.getPageSize();
        PageHelper.startPage(currentPage, pageSize);
        return new PageInfo<>(userInfoMapper.queryUserInfoByConditions(
                queryReq.getUsername(),
                queryReq.getNickname(),
                queryReq.getGroupId(),
                queryReq.getGender(),
                queryReq.getActive()
        ));
    }

    @Override
    @Transactional
    public UserInfo createUser(UserInfo userInfo) {
        validateBeforeCreate(userInfo);

        userInfo.setUid(RandomUtil.getRandomId());
        userInfo.setPassword(passwordEncoder.encode(userInfo.getPassword()));
        userInfo.setCreateTime(LocalDateTime.now());
        userInfo.setTokenVersion(1);
        userInfo.setLastPasswordChangeAt(LocalDateTime.now());
        userInfo.setAccountLocked(Boolean.TRUE.equals(userInfo.getAccountLocked()));
        userInfo.setActive(userInfo.getActive() == null || userInfo.getActive());
        userInfo.setRoles(normalizeRoles(userInfo.getRoles()));

        userInfoMapper.createUserInfoByUserInfo(userInfo);
        tokenInfoMapper.createNewTokenInfo(new TokenInfo(userInfo.getUid(), "", userInfo.getUsername()));
        syncUserRoles(userInfo.getUid(), userInfo.getRoles());
        principalCacheService.refreshPrincipal(userInfo.getUid());
        return getUserInfoByUid(userInfo.getUid());
    }

    @Override
    @Transactional
    public UserInfo updateUser(UserInfo userInfo) {
        UserInfo existing = getUserInfoByUid(userInfo.getUid());
        if (userInfo.getUsername() != null && !userInfo.getUsername().equals(existing.getUsername())) {
            UserInfo duplicated = userInfoMapper.getUserInfoByUsername(userInfo.getUsername());
            if (duplicated != null && !duplicated.getUid().equals(userInfo.getUid())) {
                throw new SystemException("Username already exists");
            }
        }
        if (userInfo.getRoles() != null) {
            userInfo.setRoles(normalizeRoles(userInfo.getRoles()));
        }
        userInfoMapper.updateUserInfoByUidWithUserInfo(userInfo);
        if (userInfo.getRoles() != null) {
            syncUserRoles(userInfo.getUid(), userInfo.getRoles());
        }
        principalCacheService.refreshPrincipal(userInfo.getUid());
        return getUserInfoByUid(userInfo.getUid());
    }

    @Override
    @Transactional
    public UserInfo updateCurrentUserInfo(String uid, UpdateUserInfoRequest updateReq) {
        if (updateReq.getGroupIds() != null) {
            throw new IllegalArgumentException("个人资料接口不允许修改权限组，请由管理员操作");
        }
        UserInfo update = new UserInfo();
        update.setUid(uid);
        update.setNickname(updateReq.getNickname());
        update.setGender(updateReq.getGender());
        update.setDescription(updateReq.getDescription());
        update.setAvatar(updateReq.getAvatar());
        update.setEmail(updateReq.getEmail());
        return updateUser(update);
    }

    @Override
    @Transactional
    public void changePassword(String uid, String oldPassword, String newPassword) {
        UserInfo userInfo = userInfoMapper.getUserInfoPasswordByUsername(getUserInfoByUid(uid).getUsername());
        if (userInfo == null || userInfo.getPassword() == null || !passwordEncoder.matches(oldPassword, userInfo.getPassword())) {
            throw new SystemException("Old password is incorrect");
        }
        resetPassword(uid, newPassword);
    }

    @Override
    @Transactional
    public void resetPassword(String uid, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new SystemException("New password is required");
        }
        userInfoMapper.resetUserInfoPassword(passwordEncoder.encode(newPassword), uid);
        userInfoMapper.updateLastPasswordChangeAt(uid);
        principalCacheService.refreshPrincipal(uid);
    }

    @Override
    @Transactional
    public void updateUserStatus(String uid, boolean active, boolean accountLocked) {
        UserInfo update = new UserInfo();
        update.setUid(uid);
        update.setActive(active);
        update.setAccountLocked(accountLocked);
        userInfoMapper.updateUserInfoByUidWithUserInfo(update);
        userInfoMapper.updateAccountLocked(uid, accountLocked);
        principalCacheService.refreshPrincipal(uid);
    }

    @Override
    @Transactional
    public UserInfo bindPhoneNumber(String uid, String phoneNumber) {
        validatePhoneNumber(phoneNumber);
        UserInfo existing = userInfoMapper.getUserInfoByPhoneNumber(phoneNumber);
        if (existing != null && !existing.getUid().equals(uid)) {
            throw new SystemException("Phone number already exists");
        }
        userInfoMapper.updatePhoneNumberByUid(uid, phoneNumber);
        principalCacheService.refreshPrincipal(uid);
        return getUserInfoByUid(uid);
    }

    @Override
    @Transactional
    public UserInfo resetPhoneNumber(String uid, String currentPhoneNumber, String newPhoneNumber) {
        UserInfo currentUser = getUserInfoByUid(uid);
        if (currentUser.getPhoneNumber() == null || !currentUser.getPhoneNumber().equals(currentPhoneNumber)) {
            throw new SystemException("Current phone number does not match");
        }
        return bindPhoneNumber(uid, newPhoneNumber);
    }

    @Override
    @Transactional
    public void deleteUserInfoByUid(String uid) {
        userRoleMapper.deleteByUid(uid);
        userInfoMapper.deleteUserInfoByUid(uid);
        tokenInfoMapper.deleteTokenInfoByUid(uid);
        principalCacheService.evictPrincipal(uid);
    }

    @Override
    @Transactional
    public UserInfo bootstrapAdmin(UserInfo userInfo) {
        if (userInfoMapper.countUsers() > 0) {
            throw new SystemException("Bootstrap is only available before any user exists");
        }
        if (userInfo.getUsername() == null || userInfo.getUsername().isBlank()) {
            throw new SystemException("Username is required");
        }
        if (userInfo.getPassword() == null || userInfo.getPassword().isBlank()) {
            throw new SystemException("Password is required");
        }

        userInfo.setNickname(userInfo.getNickname() == null || userInfo.getNickname().isBlank() ? userInfo.getUsername() : userInfo.getNickname());
        userInfo.setGroupIds(userInfo.getGroupIds() == null || userInfo.getGroupIds().isBlank() ? "ROOT" : userInfo.getGroupIds());
        userInfo.setRoles(userInfo.getRoles() == null || userInfo.getRoles().isBlank() ? "SUPER_ADMIN,ADMIN,USER" : userInfo.getRoles());
        userInfo.setActive(true);
        userInfo.setAccountLocked(false);
        return createUser(userInfo);
    }

    private void validateBeforeCreate(UserInfo userInfo) {
        if (userInfo.getUsername() == null || userInfo.getUsername().isBlank()) {
            throw new SystemException("Username is required");
        }
        if (userInfo.getPassword() == null || userInfo.getPassword().isBlank()) {
            throw new SystemException("Password is required");
        }
        if (userInfoMapper.getUserInfoByUsername(userInfo.getUsername()) != null) {
            throw new SystemException("Username already exists");
        }
        if (userInfo.getPhoneNumber() != null && !userInfo.getPhoneNumber().isBlank()) {
            validatePhoneNumber(userInfo.getPhoneNumber());
            if (userInfoMapper.getUserInfoByPhoneNumber(userInfo.getPhoneNumber()) != null) {
                throw new SystemException("Phone number already exists");
            }
        }
    }

    private String normalizeRoles(String roles) {
        Set<String> roleCodes = splitRoles(roles);
        if (roleCodes.isEmpty()) {
            roleCodes.add(DEFAULT_ROLE);
        }
        validateRoleCodes(roleCodes);
        return String.join(",", roleCodes);
    }

    private void syncUserRoles(String uid, String roles) {
        Set<String> roleCodes = splitRoles(roles);
        userRoleMapper.deleteByUid(uid);
        if (!roleCodes.isEmpty()) {
            userRoleMapper.batchInsert(uid, List.copyOf(roleCodes));
        }
    }

    private void validateRoleCodes(Set<String> roleCodes) {
        if (!roleCodes.isEmpty() && roleInfoMapper.countByRoleCodes(List.copyOf(roleCodes)) != roleCodes.size()) {
            throw new SystemException("One or more roles do not exist");
        }
    }

    private Set<String> splitRoles(String roles) {
        if (roles == null || roles.isBlank()) {
            return new LinkedHashSet<>();
        }
        return List.of(roles.split(",")).stream()
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void validatePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new SystemException("Phone number is required");
        }
    }

    private List<UserInfo> enrichUsersWithGroups(List<UserInfo> users) {
        if (users == null || users.isEmpty()) {
            return List.of();
        }

        Set<String> allGroupIds = new LinkedHashSet<>();
        for (UserInfo user : users) {
            allGroupIds.addAll(user.getGroupIdList());
        }

        Map<String, GroupsInfo> groupsById = new HashMap<>();
        if (!allGroupIds.isEmpty()) {
            groupsInfoService.getByGroupIds(List.copyOf(allGroupIds))
                    .forEach(group -> groupsById.put(group.getGroupId(), group));
        }

        for (UserInfo user : users) {
            List<GroupsInfo> groups = new ArrayList<>();
            for (String groupId : user.getGroupIdList()) {
                GroupsInfo group = groupsById.get(groupId);
                if (group != null) {
                    groups.add(group);
                }
            }
            user.setGroups(groups.isEmpty() ? Collections.emptyList() : groups);
        }
        return users;
    }
}
