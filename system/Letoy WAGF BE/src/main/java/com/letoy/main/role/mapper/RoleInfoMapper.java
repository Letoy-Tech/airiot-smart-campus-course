package com.letoy.main.role.mapper;

import com.letoy.main.role.entity.RoleInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoleInfoMapper {

    int insert(RoleInfo roleInfo);

    int updateByRoleCode(RoleInfo roleInfo);

    int deleteByRoleCode(@Param("roleCode") String roleCode);

    RoleInfo selectByRoleCode(@Param("roleCode") String roleCode);

    List<RoleInfo> selectAll(@Param("roleName") String roleName, @Param("status") Integer status);

    int countByRoleCodes(@Param("roleCodes") List<String> roleCodes);
}
