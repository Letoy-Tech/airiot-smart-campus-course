package com.letoy.main.role.service.impl;

import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.role.mapper.UserRoleMapper;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.common.exception.SystemException;
import com.letoy.main.role.service.RoleInfoService;
import com.letoy.main.auth.service.PrincipalCacheService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RoleInfoServiceImpl implements RoleInfoService {

    private final RoleInfoMapper roleInfoMapper;
    private final UserRoleMapper userRoleMapper;
    private final UserInfoMapper userInfoMapper;
    private final PrincipalCacheService principalCacheService;

    public RoleInfoServiceImpl(RoleInfoMapper roleInfoMapper,
                               UserRoleMapper userRoleMapper,
                               UserInfoMapper userInfoMapper,
                               PrincipalCacheService principalCacheService) {
        this.roleInfoMapper = roleInfoMapper;
        this.userRoleMapper = userRoleMapper;
        this.userInfoMapper = userInfoMapper;
        this.principalCacheService = principalCacheService;
    }

    @Override
    public List<RoleInfo> listRoles(String roleName, Integer status) {
        return roleInfoMapper.selectAll(roleName, status);
    }

    @Override
    public RoleInfo getRole(String roleCode) {
        RoleInfo roleInfo = roleInfoMapper.selectByRoleCode(roleCode);
        if (roleInfo == null) {
            throw new SystemException("Role does not exist");
        }
        return roleInfo;
    }

    @Override
    @Transactional
    public RoleInfo createRole(RoleInfo roleInfo) {
        if (roleInfo.getRoleCode() == null || roleInfo.getRoleCode().isBlank()) {
            throw new SystemException("Role code is required");
        }
        if (roleInfo.getRoleName() == null || roleInfo.getRoleName().isBlank()) {
            throw new SystemException("Role name is required");
        }
        if (roleInfoMapper.selectByRoleCode(roleInfo.getRoleCode()) != null) {
            throw new SystemException("Role code already exists");
        }
        if (roleInfo.getStatus() == null) {
            roleInfo.setStatus(1);
        }
        if (roleInfo.getSortOrder() == null) {
            roleInfo.setSortOrder(0);
        }
        roleInfoMapper.insert(roleInfo);
        return getRole(roleInfo.getRoleCode());
    }

    @Override
    @Transactional
    public RoleInfo updateRole(RoleInfo roleInfo) {
        getRole(roleInfo.getRoleCode());
        roleInfoMapper.updateByRoleCode(roleInfo);
        return getRole(roleInfo.getRoleCode());
    }

    @Override
    @Transactional
    public void deleteRole(String roleCode) {
        getRole(roleCode);
        if (userRoleMapper.countByRoleCode(roleCode) > 0) {
            throw new SystemException("Role is assigned to users and cannot be deleted");
        }
        roleInfoMapper.deleteByRoleCode(roleCode);
    }

    @Override
    public List<RoleInfo> getUserRoles(String uid) {
        ensureUserExists(uid);
        return userRoleMapper.selectRolesByUid(uid);
    }

    @Override
    @Transactional
    public void assignRoles(String uid, List<String> roleCodes) {
        UserInfo userInfo = ensureUserExists(uid);
        Set<String> normalizedCodes = normalizeRoleCodes(roleCodes);
        if (!normalizedCodes.isEmpty() && roleInfoMapper.countByRoleCodes(List.copyOf(normalizedCodes)) != normalizedCodes.size()) {
            throw new SystemException("One or more roles do not exist");
        }

        userRoleMapper.deleteByUid(uid);
        if (!normalizedCodes.isEmpty()) {
            userRoleMapper.batchInsert(uid, List.copyOf(normalizedCodes));
        }

        UserInfo update = new UserInfo();
        update.setUid(uid);
        update.setRoles(String.join(",", normalizedCodes));
        userInfoMapper.updateUserInfoByUidWithUserInfo(update);
        principalCacheService.refreshPrincipal(userInfo.getUid());
    }

    private UserInfo ensureUserExists(String uid) {
        UserInfo userInfo = userInfoMapper.getUserInfoByUid(uid);
        if (userInfo == null) {
            throw new SystemException("User does not exist");
        }
        return userInfo;
    }

    private Set<String> normalizeRoleCodes(List<String> roleCodes) {
        if (roleCodes == null) {
            return new LinkedHashSet<>();
        }
        return roleCodes.stream()
                .filter(code -> code != null && !code.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
