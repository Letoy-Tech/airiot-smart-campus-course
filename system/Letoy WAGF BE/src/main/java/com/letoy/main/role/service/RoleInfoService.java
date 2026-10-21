package com.letoy.main.role.service;

import com.letoy.main.role.entity.RoleInfo;

import java.util.List;

public interface RoleInfoService {

    List<RoleInfo> listRoles(String roleName, Integer status);

    RoleInfo getRole(String roleCode);

    RoleInfo createRole(RoleInfo roleInfo);

    RoleInfo updateRole(RoleInfo roleInfo);

    void deleteRole(String roleCode);

    List<RoleInfo> getUserRoles(String uid);

    void assignRoles(String uid, List<String> roleCodes);
}
