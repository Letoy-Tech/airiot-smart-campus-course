package com.letoy.main.role.assembler;

import com.letoy.main.role.dto.request.SaveRoleRequest;
import com.letoy.main.role.entity.RoleInfo;

public final class RoleInfoAssembler {

    private RoleInfoAssembler() {
    }

    public static RoleInfo toRoleInfo(SaveRoleRequest request) {
        return RoleInfo.builder()
                .roleCode(request.getRoleCode())
                .roleName(request.getRoleName())
                .description(request.getDescription())
                .sortOrder(request.getSortOrder())
                .status(request.getStatus())
                .build();
    }

    public static RoleInfo toRoleInfo(String roleCode, SaveRoleRequest request) {
        RoleInfo roleInfo = toRoleInfo(request);
        roleInfo.setRoleCode(roleCode);
        return roleInfo;
    }
}
