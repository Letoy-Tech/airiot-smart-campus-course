package com.letoy.main.role.assembler;

import com.letoy.main.role.dto.response.RoleResponse;
import com.letoy.main.role.entity.RoleInfo;

public final class RoleResponseAssembler {

    private RoleResponseAssembler() {
    }

    public static RoleResponse toResponse(RoleInfo roleInfo) {
        if (roleInfo == null) {
            return null;
        }
        return RoleResponse.builder()
                .id(roleInfo.getId())
                .roleCode(roleInfo.getRoleCode())
                .roleName(roleInfo.getRoleName())
                .description(roleInfo.getDescription())
                .sortOrder(roleInfo.getSortOrder())
                .status(roleInfo.getStatus())
                .createTime(roleInfo.getCreateTime())
                .updateTime(roleInfo.getUpdateTime())
                .build();
    }
}
