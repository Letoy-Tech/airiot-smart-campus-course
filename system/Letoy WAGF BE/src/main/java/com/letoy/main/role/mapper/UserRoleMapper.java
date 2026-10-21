package com.letoy.main.role.mapper;

import com.letoy.main.role.entity.RoleInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserRoleMapper {

    int deleteByUid(@Param("uid") String uid);

    int deleteByRoleCode(@Param("roleCode") String roleCode);

    int countByRoleCode(@Param("roleCode") String roleCode);

    int batchInsert(@Param("uid") String uid, @Param("roleCodes") List<String> roleCodes);

    List<String> selectRoleCodesByUid(@Param("uid") String uid);

    List<RoleInfo> selectRolesByUid(@Param("uid") String uid);
}
